const express = require('express');
const session = require('express-session');
const multer = require('multer');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_USER = process.env.PANEL_USER || 'admin';
const ADMIN_PASS = process.env.PANEL_PASSWORD;
if (!ADMIN_PASS) {
  console.error('Atur PANEL_PASSWORD terlebih dahulu. Lihat README.md.');
  process.exit(1);
}

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const PROJECTS = path.join(DATA, 'projects');
fs.mkdirSync(PROJECTS, { recursive: true });
const processes = new Map();
const logs = new Map();
const upload = multer({
  dest: path.join(DATA, 'uploads'),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.zip') return cb(new Error('Hanya file ZIP yang diperbolehkan.'));
    cb(null, true);
  }
});
fs.mkdirSync(path.join(DATA, 'uploads'), { recursive: true });

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '1mb' }));
app.use(session({
  name: 'botpanel.sid',
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', secure: false, maxAge: 8 * 60 * 60 * 1000 }
}));

function auth(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Silakan login.' });
  return res.redirect('/login');
}
function safeName(s) {
  return typeof s === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(s);
}
function addLog(name, line) {
  const arr = logs.get(name) || [];
  arr.push(`[${new Date().toISOString()}] ${String(line).slice(0, 1500)}`);
  if (arr.length > 300) arr.splice(0, arr.length - 300);
  logs.set(name, arr);
}
function listProjects() {
  return fs.readdirSync(PROJECTS, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const p = d.name, child = processes.get(p);
      return { name: p, status: child && child.exitCode === null ? 'running' : 'stopped',
        hasPackage: fs.existsSync(path.join(PROJECTS, p, 'package.json')) };
    });
}

app.get('/login', (_req, res) => res.sendFile(path.join(ROOT, 'public', 'login.html')));
app.post('/login', (req, res) => {
  const user = String(req.body.username || '');
  const pass = String(req.body.password || '');
  if (user !== ADMIN_USER || pass !== ADMIN_PASS) return res.status(401).send('Login salah. <a href="/login">Coba lagi</a>');
  req.session.loggedIn = true;
  res.redirect('/');
});
app.post('/logout', auth, (req, res) => req.session.destroy(() => res.redirect('/login')));
app.use('/', auth, express.static(path.join(ROOT, 'public')));

app.get('/api/projects', auth, (_req, res) => res.json(listProjects()));
app.get('/api/logs/:name', auth, (req, res) => {
  if (!safeName(req.params.name)) return res.status(400).json({ error: 'Nama proyek tidak valid.' });
  res.json({ lines: logs.get(req.params.name) || [] });
});

app.post('/api/upload', auth, upload.single('project'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Pilih file ZIP.' });
  const defaultName = path.basename(req.file.originalname, '.zip').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 35);
  const name = String(req.body.name || defaultName);
  try {
    if (!safeName(name)) throw new Error('Nama proyek hanya boleh huruf, angka, _ dan - (maksimal 40 karakter).');
    if (fs.existsSync(path.join(PROJECTS, name))) throw new Error('Nama proyek sudah digunakan.');
    const zip = new AdmZip(req.file.path);
    const entries = zip.getEntries();
    if (!entries.length || entries.length > 2000) throw new Error('ZIP kosong atau berisi terlalu banyak file.');
    for (const e of entries) {
      const entryName = e.entryName.replace(/\\/g, '/');
      if (entryName.startsWith('/') || entryName.split('/').some(part => part === '..')) {
        throw new Error('ZIP ditolak karena memiliki jalur file tidak aman.');
      }
    }
    const tempDir = path.join(PROJECTS, `.upload-${crypto.randomBytes(8).toString('hex')}`);
    fs.mkdirSync(tempDir);
    zip.extractAllTo(tempDir, true);
    // If ZIP contains one top-level folder, use its contents as project root.
    const children = fs.readdirSync(tempDir);
    let source = tempDir;
    if (children.length === 1 && fs.statSync(path.join(tempDir, children[0])).isDirectory()) source = path.join(tempDir, children[0]);
    const finalDir = path.join(PROJECTS, name);
    fs.renameSync(source, finalDir);
    if (source !== tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    addLog(name, 'Proyek diunggah. Periksa package.json dan entry point sebelum menjalankan.');
    res.json({ ok: true, name });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Gagal membaca ZIP.' });
  } finally {
    fs.rmSync(req.file.path, { force: true });
  }
});

app.post('/api/:action/:name', auth, async (req, res) => {
  const { action, name } = req.params;
  if (!safeName(name)) return res.status(400).json({ error: 'Nama proyek tidak valid.' });
  const dir = path.join(PROJECTS, name);
  if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Proyek tidak ditemukan.' });
  if (!['start', 'stop', 'restart'].includes(action)) return res.status(404).json({ error: 'Aksi tidak dikenal.' });
  const stop = () => new Promise(resolve => {
    const child = processes.get(name);
    if (!child || child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 4000).unref();
    setTimeout(resolve, 4500).unref();
  });
  const start = () => {
    if (processes.has(name) && processes.get(name).exitCode === null) throw new Error('Bot sudah berjalan.');
    const pkgPath = path.join(dir, 'package.json');
    let command, args;
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.scripts && pkg.scripts.start) {
        command = 'npm'; args = ['start'];
      } else if (fs.existsSync(path.join(dir, 'index.js'))) {
        command = process.execPath; args = ['index.js'];
      } else if (fs.existsSync(path.join(dir, 'bot.js'))) {
        command = process.execPath; args = ['bot.js'];
      } else throw new Error('Tidak ada scripts.start, index.js, atau bot.js.');
    } else if (fs.existsSync(path.join(dir, 'index.js'))) {
      command = process.execPath; args = ['index.js'];
    } else if (fs.existsSync(path.join(dir, 'bot.js'))) {
      command = process.execPath; args = ['bot.js'];
    } else throw new Error('Tambahkan package.json atau file index.js/bot.js.');
    const child = spawn(command, args, { cwd: dir, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    processes.set(name, child);
    addLog(name, `Menjalankan: ${command} ${args.join(' ')}`);
    child.stdout.on('data', d => addLog(name, d.toString()));
    child.stderr.on('data', d => addLog(name, d.toString()));
    child.on('error', e => addLog(name, `Gagal menjalankan proses: ${e.message}`));
    child.on('exit', (code, signal) => addLog(name, `Proses berhenti (code=${code}, signal=${signal}).`));
  };
  try {
    if (action === 'stop') await stop();
    else if (action === 'start') start();
    else { await stop(); start(); }
    res.json({ ok: true, projects: listProjects() });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.use((err, _req, res, _next) => res.status(400).json({ error: err.message || 'Permintaan gagal.' }));
app.listen(PORT, '0.0.0.0', () => console.log(`Crazy Panel aktif di http://127.0.0.1:${PORT}`));
process.on('SIGINT', () => {
  for (const child of processes.values()) if (child.exitCode === null) child.kill('SIGTERM');
  process.exit(0);
});
