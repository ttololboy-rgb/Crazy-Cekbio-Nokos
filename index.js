import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import P from "pino";
import fs from 'fs';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
let whatsappSock = null;
let isWhatsAppConnected = false;
let botStartTime = Date.now();
const DELAY_PER_NUMBER = 10000; // Jeda 10 detik per nomor
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ==========================================
// KONEKSI WHATSAPP (BAILEYS)
// ==========================================
async function startWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    whatsappSock = makeWASocket({
      version, auth: state, logger: P({ level: "silent" }),
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      markOnlineOnConnect: false, syncFullHistory: false
    });

    whatsappSock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) console.log("QR Tersedia (Gunakan menu Pairing di Web)");
      
      if (connection === "close") {
        isWhatsAppConnected = false;
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) setTimeout(startWhatsApp, 5000);
        else {
          if (fs.existsSync("./auth")) fs.rmSync("./auth", { recursive: true, force: true });
          setTimeout(startWhatsApp, 3000);
        }
      } else if (connection === "open") {
        isWhatsAppConnected = true;
        console.log(`✅ WhatsApp Terhubung!`);
      }
    });
    whatsappSock.ev.on("creds.update", saveCreds);
  } catch (error) { setTimeout(startWhatsApp, 10000); }
}

// ==========================================
// WEB UI (DASHBOARD)
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
      .glass-container { width: 100%; max-width: 800px; background: var(--card); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 40px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
      .header { text-align: center; margin-bottom: 30px; }
      .header h1 { font-size: 32px; font-weight: 800; background: linear-gradient(to right, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
      .header p { color: var(--muted); font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
      .card { background: rgba(15, 23, 42, 0.6); padding: 24px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.05); margin-bottom: 20px; }
      .card h3 { color: var(--muted); font-size: 14px; margin-bottom: 15px; }
      input { width: 100%; padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: #fff; font-size: 16px; outline: none; margin-bottom: 15px; }
      input:focus { border-color: var(--primary); }
      button { width: 100%; padding: 16px; background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; transition: 0.3s; }
      button:hover { box-shadow: 0 8px 25px rgba(99, 102, 241, 0.6); transform: translateY(-2px); }
      .badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-top: 15px; }
      .online { background: rgba(16, 185, 129, 0.1); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2); }
      .offline { background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }
      .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: pulse 2s infinite; }
      @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
      #checkResult, #pairResult { margin-top: 15px; text-align: left; font-family: monospace; font-size: 14px; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 10px; display: none; border: 1px solid rgba(255,255,255,0.05); }
      #pairResult { font-size: 24px; text-align: center; font-weight: bold; color: #38bdf8; letter-spacing: 2px; }
    </style>
  </head>
  <body>
    <div class="glass-container">
      <div class="header">
        <h1>CeazyCekbio System</h1>
        <p>Premium Web Checker</p>
        <div>${statusWA}</div>
      </div>

      <div class="card">
        <h3>📱 Pairing WhatsApp (Jika belum login)</h3>
        <input type="text" id="phoneInput" placeholder="Contoh: 628123456789">
        <button onclick="mintaKode()">Minta Kode Pairing</button>
        <div id="pairResult"></div>
      </div>

      <div class="card">
        <h3>🔍 Cek Nomor WhatsApp (Pisahkan dengan spasi)</h3>
        <input type="text" id="numberInput" placeholder="628123xxx 628987yyy">
        <button onclick="cekNomor()">Cek Nomor</button>
        <div id="checkResult"></div>
      </div>
      
      <div style="text-align: center; margin-top: 10px;">
        <a href="#" onclick="alert('⛔ AKSES DITOLAK!\\n\\nIni fitur khusus OWNER.')" style="color: #f87171; text-decoration: none; font-size: 14px; font-weight: bold;">
          ⚙️ Owner Panel
        </a>
      </div>
    </div>

    <script>
      async function mintaKode() {
        const phone = document.getElementById('phoneInput').value;
        const resultDiv = document.getElementById('pairResult');
        if(!phone) return alert('Masukkan nomor!');
        
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = "⏳ Memproses...";
        
        try {
          const res = await fetch('/api/pair?phone=' + phone);
          const data = await res.json();
          resultDiv.innerHTML = data.success ? "KODE: " + data.code : "❌ " + data.error;
        } catch(e) { resultDiv.innerHTML = "❌ Server Error."; }
      }

      async function cekNomor() {
        const numbers = document.getElementById('numberInput').value;
        const resultBox = document.getElementById('checkResult');
        if(!numbers) return alert('Masukkan nomor!');
        
        resultBox.style.display = 'block';
        resultBox.innerHTML = "⏳ Sedang mengecek (jeda 10 detik per nomor, harap tunggu)...";

        try {
          const res = await fetch('/api/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numbers: numbers })
          });
          const data = await res.json();
          
          if(data.success) {
            let html = "<b>HASIL CEK:</b><br><br>";
            data.results.forEach(r => {
              html += `${r.number} -> <span style="color:${r.status === 'TERDAFTAR' ? '#34d399' : '#f87171'}">${r.status}</span><br>`;
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
// API ENDPOINTS (UNTUK WEB)
// ==========================================
app.get('/api/pair', async (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.json({ success: false, error: 'Nomor kosong' });
  let formatted = phone.replace(/\D/g, '');
  if (formatted.startsWith('0')) formatted = '62' + formatted.substring(1);

  try {
    if (!whatsappSock) throw new Error("WhatsApp belum siap.");
    const code = await whatsappSock.requestPairingCode(formatted);
    res.json({ success: true, code: code });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/check', async (req, res) => {
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
    // Jeda aman 10 detik
    if (i < numbers.length - 1) await sleep(DELAY_PER_NUMBER);
  }

  res.json({ success: true, results: results });
});

// ==========================================
// JALANKAN SERVER
// ==========================================
startWhatsApp();
app.listen(PORT, '0.0.0.0', () => console.log(`🌐 Web & API jalan di port: ${PORT}`));
