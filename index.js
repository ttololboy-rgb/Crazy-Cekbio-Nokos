import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import P from "pino";
import fs from 'fs';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

let whatsappSock = null;
let isWhatsAppConnected = false;
let reconnectAttempts = 0;
let botStartTime = Date.now();

const DELAY_PER_NUMBER = 10000; // Jeda 10 detik per nomor (Aman)
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ==========================================
// KONEKSI WHATSAPP
// ==========================================
async function startWhatsApp() {
  try {
    if (reconnectAttempts >= 5) return setTimeout(() => { reconnectAttempts = 0; startWhatsApp(); }, 3600000);
    reconnectAttempts++;
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    whatsappSock = makeWASocket({
      version, auth: state, logger: P({ level: "silent" }),
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      markOnlineOnConnect: false, syncFullHistory: false
    });

    whatsappSock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) console.log("QR Tersedia (gunakan Pairing di Web)");
      if (connection === "close") {
        isWhatsAppConnected = false;
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) setTimeout(startWhatsApp, 5000);
        else {
          if (fs.existsSync("./auth")) fs.rmSync("./auth", { recursive: true, force: true });
          setTimeout(startWhatsApp, 3000);
        }
      } else if (connection === "open") {
        isWhatsAppConnected = true; reconnectAttempts = 0;
        console.log(`✅ WA Connected.`);
      }
    });
    whatsappSock.ev.on("creds.update", saveCreds);
  } catch (error) { setTimeout(startWhatsApp, 10000); }
}

// ==========================================
// WEB DASHBOARD PREMIUM (UTAMA)
// ==========================================
app.get('/', (req, res) => {
  const uptime = Math.floor((Date.now() - botStartTime) / 60000);
  const statusWA = isWhatsAppConnected 
    ? '<span class="badge online"><i class="dot"></i> Online</span>' 
    : '<span class="badge offline"><i class="dot"></i> Offline</span>';

  res.send(`
  <!DOCTYPE html>
  <html lang="id">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CeazyCekbio | Web Panel</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
      :root { --primary: #6366f1; --secondary: #8b5cf6; --bg: #0f172a; --card: rgba(30, 41, 59, 0.7); --text: #f8fafc; --muted: #94a3b8; }
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
      body { background: var(--bg); color: var(--text); min-height: 100vh; display: flex; align-items: center; justify-content: center; background-image: radial-gradient(circle at 15% 50%, rgba(99, 102, 241, 0.15), transparent 25%), radial-gradient(circle at 85% 30%, rgba(139, 92, 246, 0.15), transparent 25%); padding: 20px; }
      .glass-container { width: 100%; max-width: 900px; background: var(--card); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 40px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
      .header { text-align: center; margin-bottom: 40px; }
      .header h1 { font-size: 32px; font-weight: 800; background: linear-gradient(to right, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
      .header p { color: var(--muted); font-size: 14px; letter-spacing: 1px; text-transform: uppercase; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
      .card { background: rgba(15, 23, 42, 0.6); padding: 24px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.05); }
      .card h3 { color: var(--muted); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
      .card .value { font-size: 24px; font-weight: 800; }
      .badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; }
      .badge.online { background: rgba(16, 185, 129, 0.1); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2); }
      .badge.offline { background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }
      .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: pulse 2s infinite; }
      @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
      .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
      .btn { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px; border-radius: 12px; font-size: 16px; font-weight: 600; text-decoration: none; transition: all 0.3s; cursor: pointer; border: none; }
      .btn-primary { background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4); }
      .btn-danger { background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }
      .input-group { margin-top: 20px; display: flex; gap: 10px; }
      input[type="text"] { flex: 1; padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(15, 23, 42, 0.6); color: #fff; font-size: 16px; outline: none; }
      input[type="text"]:focus { border-color: #6366f1; }
      #result-box { margin-top: 20px; padding: 20px; border-radius: 12px; background: rgba(0,0,0,0.3); display: none; white-space: pre-wrap; font-family: monospace; font-size: 14px; border: 1px solid rgba(255,255,255,0.05); }
      @media (max-width: 600px) { .actions { grid-template-columns: 1fr; } .glass-container { padding: 24px; } }
    </style>
  </head>
  <body>
    <div class="glass-container">
      <div class="header">
        <h1>CeazyCekbio Web</h1>
        <p>Premium Web Checker v20.0</p>
      </div>
      
      <div class="grid">
        <div class="card">
          <h3>Status WhatsApp</h3>
          <div class="value">${statusWA}</div>
        </div>
        <div class="card">
          <h3>Uptime Server</h3>
          <div class="value">${uptime} <span style="font-size:16px;color:var(--muted)">menit</span></div>
        </div>
      </div>

      <div class="actions">
        <a href="/pairing" class="btn btn-primary">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          Pairing WhatsApp
        </a>
        <a href="#" onclick="alert('⛔ AKSES DITOLAK!\\n\\nIni fitur khusus OWNER.')" class="btn btn-danger">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          Owner Panel
        </a>
      </div>

      <div style="margin-top: 30px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 30px;">
        <h3 style="color: var(--muted); margin-bottom: 10px;">🔍 Cek Nomor WhatsApp</h3>
        <div class="input-group">
          <input type="text" id="numberInput" placeholder="Contoh: 628123456789, 628987654321">
          <button class="btn btn-primary" onclick="cekNomor()" style="width: auto; padding: 0 30px;">Cek</button>
        </div>
        <div id="result-box"></div>
      </div>

    </div>

    <script>
      async function cekNomor() {
        const numbers = document.getElementById('numberInput').value;
        const resultBox = document.getElementById('result-box');
        if(!numbers) return alert('Masukkan nomor!');
        
        resultBox.style.display = 'block';
        resultBox.innerHTML = "⏳ Sedang mengecek (jeda 10 detik per nomor)...";

        try {
          const res = await fetch('/api/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numbers: numbers })
          });
          const data = await res.json();
          
          if(data.success) {
            let html = "<b>HASIL CEK:</b>\\n\\n";
            data.results.forEach(r => {
              html += `${r.number} -> <span style="color:${r.status === 'TERDAFTAR' ? '#34d399' : '#f87171'}">${r.status}</span>\\n`;
            });
            resultBox.innerHTML = html;
          } else {
            resultBox.innerHTML = "❌ Error: " + data.error;
          }
        } catch (e) {
          resultBox.innerHTML = "❌ Gagal terhubung ke server.";
        }
      }
    </script>
  </body>
  </html>
  `);
});

// ==========================================
// HALAMAN PAIRING
// ==========================================
app.get('/pairing', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="id">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pairing WhatsApp</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Inter', sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: rgba(30, 41, 59, 0.8); backdrop-filter: blur(10px); padding: 40px; border-radius: 24px; width: 100%; max-width: 400px; border: 1px solid rgba(255,255,255,0.1); text-align: center; }
      h2 { margin-bottom: 20px; font-weight: 800; }
      input { width: 100%; padding: 16px; margin-bottom: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(15, 23, 42, 0.6); color: #fff; font-size: 16px; outline: none; box-sizing: border-box; }
      input:focus { border-color: #6366f1; }
      button { width: 100%; padding: 16px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; transition: 0.3s; }
      button:hover { box-shadow: 0 8px 25px rgba(99, 102, 241, 0.6); }
      #result { margin-top: 25px; font-size: 24px; font-weight: 800; color: #38bdf8; letter-spacing: 2px; }
      a { color: #94a3b8; text-decoration: none; font-size: 14px; display: block; margin-top: 20px; }
      a:hover { color: white; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>📱 Pairing WA</h2>
      <input type="text" id="phone" placeholder="Contoh: 628123456789">
      <button onclick="mintaKode()">Minta Kode</button>
      <div id="result"></div>
      <a href="/">⬅️ Kembali ke Dashboard</a>
    </div>
    <script>
      async function mintaKode() {
        const phone = document.getElementById('phone').value;
        const resultDiv = document.getElementById('result');
        if(!phone) return alert('Masukkan nomor!');
        resultDiv.innerHTML = "⏳ Memproses...";
        try {
          const res = await fetch('/api/pairing?phone=' + phone);
          const data = await res.json();
          resultDiv.innerHTML = data.success ? "KODE: " + data.code : "❌ " + data.error;
        } catch(e) { resultDiv.innerHTML = "❌ Error."; }
      }
    </script>
  </body>
  </html>
  `);
});

// ==========================================
// API ENDPOINTS
// ==========================================
app.get('/api/pairing', async (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.json({ success: false, error: 'Nomor kosong' });
  let formatted = phone.replace(/\D/g, '');
  if (formatted.startsWith('0')) formatted = '62' + formatted.substring(1);

  try {
    if (!whatsappSock) throw new Error("Bot WA belum siap.");
    const code = await whatsappSock.requestPairingCode(formatted);
    res.json({ success: true, code: code });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/check', express.json(), async (req, res) => {
  if (!isWhatsAppConnected) return res.json({ success: false, error: 'WhatsApp belum terhubung.' });
  
  const numbersText = req.body.numbers;
  if (!numbersText) return res.json({ success: false, error: 'Nomor kosong.' });

  const numbers = numbersText.split(/[\s,\n]+/).filter(n => n);
  const results = [];

  for (let i = 0; i < numbers.length; i++) {
    let c = numbers[i].toString().replace(/\D/g, '');
    if (c.startsWith('0')) c = '62' + c.substring(1);
    else if (c.startsWith('8')) c = '62' + c;

    try {
      const [result] = await whatsappSock.onWhatsApp(c + "@s.whatsapp.net");
      results.push({ number: c, status: (result && result.exists) ? 'TERDAFTAR' : 'TIDAK TERDAFTAR' });
    } catch (e) {
      results.push({ number: c, status: 'ERROR' });
    }

    if (i < numbers.length - 1) await sleep(DELAY_PER_NUMBER);
  }

  res.json({ success: true, results: results });
});

// ==========================================
// START SERVER
// ==========================================
startWhatsApp();
app.listen(PORT, '0.0.0.0', () => console.log(`🌐 Web Checker jalan di http://localhost:${PORT}`));
