# Crazy Panel — Android + Node.js

Starter panel web untuk mengelola proyek bot Node.js di Android melalui Termux. Login memakai username/password yang kamu tentukan sendiri di lingkungan server.

## Penting tentang website GitHub Pages
GitHub Pages hanya meng-host file statis. Ia tidak bisa menjalankan server Node.js, menyimpan sesi login server secara aman, atau menjalankan `bot.js`. Untuk fitur login server dan Start/Stop bot, jalankan backend ini di Termux atau layanan yang mendukung Node.js. Jangan letakkan password rahasia dalam HTML/JavaScript publik.

## Jalankan di Android (Termux)

1. Ekstrak ZIP ini ke penyimpanan HP.
2. Buka Termux dan pindah ke folder `Crazy-Panel` hasil ekstrak. Contoh, jika folder berada di Download:
   ```sh
   termux-setup-storage
   cd ~/storage/downloads/Crazy-Panel
   ```
   Sesuaikan path jika nama folder/lokasi berbeda.
3. Pasang Node.js dan dependency:
   ```sh
   pkg update
   pkg install nodejs
   npm install
   ```
4. Tentukan username dan password sendiri:
   ```sh
   export PANEL_USER='nama-admin-kamu'
   export PANEL_PASSWORD='buat-password-yang-kuat'
   export SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
   ```
   Jangan pakai contoh di atas sebagai password sungguhan; ganti dengan milikmu dan jangan kirimkan ke orang lain.
5. Jalankan:
   ```sh
   npm start
   ```
6. Buka `http://127.0.0.1:3000` di browser pada HP yang sama, lalu login dengan username/password yang kamu set.

## Format bot yang diunggah

ZIP bot harus memuat `package.json` dengan `scripts.start`, atau file `index.js`/`bot.js`. Jika bot memerlukan package NPM, buka folder proyek bot lewat Termux lalu jalankan `npm install` di folder tersebut sebelum menekan Start di panel. Jalankan hanya kode yang kamu percaya karena proses bot memiliki akses setara dengan Termux.

## Batasan

- Panel ini bukan Pterodactyl asli dan bukan hosting cloud.
- Bot berjalan di HP dan bisa berhenti jika Android membunuh Termux, perangkat mati, atau internet terputus.
- Jangan port-forward atau membuka port panel langsung ke internet. Untuk akses jarak jauh, gunakan solusi jaringan privat/HTTPS yang dikonfigurasi dengan benar.
- Panel ini mengelola proyek Node.js milikmu. Ia tidak menyediakan nomor virtual, akun WhatsApp, token Telegram, atau akses API pihak ketiga.
- Website GitHub Pages lama tidak otomatis berubah hanya karena ZIP ini dibuat. Kamu perlu mengunggah kode ke repo sendiri, dan backend tetap harus dijalankan terpisah.
