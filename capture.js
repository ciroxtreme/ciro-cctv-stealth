const { connect } = require('puppeteer-real-browser');
const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN || '8899978543:AAHlrCjXZbiJwcI_OZIzXrGdpKC5_BCGCEs';
const CHAT_ID = process.env.CHAT_ID || '1936436999';
const CAM_ID = process.env.CAM_ID || '4';

async function sendPhotoToTelegram(photoPath, caption) {
  const form = new FormData();
  form.append('chat_id', CHAT_ID);
  form.append('photo', fs.createReadStream(photoPath));
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    body: form
  });
  const data = await res.json();
  console.log('Telegram sendPhoto response:', data);
  return data;
}

async function sendErrorMessage(msg) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: msg,
        parse_mode: 'HTML'
      })
    });
  } catch (e) {}
}

(async () => {
  console.log(`[INFO] Launching Real Browser for CCTV Banyuasin Cam ${CAM_ID}...`);

  const { browser, page } = await connect({
    headless: false,
    turnstile: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--enable-webgl',
      '--enable-webgl2',
      '--window-size=1280,720'
    ],
    connectOption: {
      defaultViewport: { width: 1280, height: 720 }
    }
  });

  try {
    const targetUrl = `https://cctv.banyuasinkab.go.id/stream/${CAM_ID}`;
    const portalUrl = 'https://cctv.banyuasinkab.go.id/';

    console.log(`[1] Step 1: Navigasi ke portal Banyuasin...`);
    await page.goto(portalUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Loop verifikasi Turnstile
    let passed = false;
    for (let i = 1; i <= 8; i++) {
      const title = await page.title();
      const content = await page.content();

      const isChallenge = 
        title.includes('Just a moment') || 
        content.includes('challenges.cloudflare.com') ||
        content.includes('Enable JavaScript and cookies');

      if (!isChallenge) {
        passed = true;
        console.log(`[+] Lolos Turnstile di Portal! Title: ${title}`);
        break;
      }

      console.log(`[*] Percobaan verifikasi Turnstile ${i}/8...`);
      // Coba klik checkbox dalam iframe
      try {
        for (const frame of page.frames()) {
          if (frame.url().includes('challenges.cloudflare.com')) {
            const el = await frame.$('input[type="checkbox"], #challenge-stage, .ctp-checkbox-label');
            if (el) await el.click();
          }
        }
      } catch (e) {}

      await new Promise(r => setTimeout(r, 5000));
    }

    console.log(`[2] Step 2: Buka halaman target stream: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 35000 }).catch(() => null);

    // Cek ulang apakah di halaman stream ada tantangan Turnstile kedua
    for (let i = 1; i <= 6; i++) {
      const title = await page.title();
      if (!title.includes('Just a moment')) {
        break;
      }
      console.log(`[*] Menunggu verifikasi stream ${i}/6...`);
      await new Promise(r => setTimeout(r, 4000));
    }

    // ============================================================
    // VALIDASI KETAT: JANGAN KIRIM JIKA MASIH HALAMAN CLOUDFLARE!
    // ============================================================
    const finalTitle = await page.title();
    const finalContent = await page.content();

    const isStillBlocked = 
      finalTitle.includes('Just a moment') ||
      finalContent.includes('challenges.cloudflare.com') ||
      finalContent.includes('challenge-error-text');

    if (isStillBlocked) {
      console.error('❌ VALIDASI GAGAL: Masih tertahan di Cloudflare Turnstile screen. Foto TIDAK AKAN DIKIRIM ke Telegram!');
      await sendErrorMessage(
        `⚠️ <b>Bypass CCTV Banyuasin Gagal</b>\n` +
        `Server Cloudflare Banyuasin saat ini memberikan proteksi ketat (Managed Challenge CAPTCHA) sehingga runner tidak bisa melewatinya secara otomatis.\n\n` +
        `🔗 Silakan tonton langsung lewat browser Anda:\nhttps://cctv.banyuasinkab.go.id/stream/${CAM_ID}`
      );
      process.exit(1);
    }

    // Tunggu elemen player / canvas video benar-benar ada
    console.log('[3] Mencari elemen video player...');
    let targetElement = null;
    try {
      targetElement = await page.waitForSelector('video, canvas, #player, .player, .video-js', { timeout: 15000 });
    } catch (e) {
      console.log('Video element selector wait timeout.');
    }

    // Beri jeda 4 detik agar video buffer ter-render (bukan layar hitam/blank)
    await new Promise(r => setTimeout(r, 4000));

    const outPath = `cctv_banyuasin_${CAM_ID}.jpg`;
    if (targetElement) {
      console.log('[*] Elemen player ditemukan! Memotret frame video...');
      await targetElement.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
    } else {
      console.log('[*] Memotret tampilan halaman stream...');
      await page.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
    }

    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const caption = `📸 <b>Snapshot Live Realtime [CCTV Banyuasin Cam ${CAM_ID}]</b> 🚦\n\n` +
      `🏢 <b>Wilayah:</b> Kab. Banyuasin (Verified Live Frame)\n` +
      `🕒 <b>Waktu:</b> ${now} WIB\n` +
      `🔗 <b>Endpoint:</b> <code>https://cctv.banyuasinkab.go.id/stream/${CAM_ID}</code>`;

    await sendPhotoToTelegram(outPath, caption);
    console.log('[+] Berhasil mengirim foto live yang tervalidasi ke Telegram!');
  } catch (err) {
    console.error('[ERROR] Execution failed:', err);
    process.exit(1);
  } finally {
    try { await browser.close(); } catch (e) {}
  }
})();
