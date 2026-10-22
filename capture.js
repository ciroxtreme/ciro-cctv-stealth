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

(async () => {
  console.log(`[INFO] Launching Real Browser for CCTV Banyuasin Cam ${CAM_ID}...`);

  const { browser, page } = await connect({
    headless: false,
    turnstile: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--window-size=1280,720'
    ],
    connectOption: {
      defaultViewport: { width: 1280, height: 720 }
    }
  });

  try {
    const targetUrl = `https://cctv.banyuasinkab.go.id/stream/${CAM_ID}`;

    let isSuccess = false;
    let attempt = 0;
    const maxAttempts = 6; // Coba verifikasi sampai 6 kali loop (maksimal ~60 detik)

    console.log(`[1] Navigating directly to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

    while (!isSuccess && attempt < maxAttempts) {
      attempt++;
      console.log(`[*] Checking verification status (Attempt ${attempt}/${maxAttempts})...`);

      // Cek apakah halaman masih berupa Cloudflare Challenge ("Just a moment...")
      const pageTitle = await page.title();
      const content = await page.content();

      const isStillChallenge = 
        pageTitle.includes('Just a moment') || 
        content.includes('challenges.cloudflare.com') ||
        content.includes('cf-browser-verification') ||
        content.includes('Enable JavaScript and cookies');

      if (isStillChallenge) {
        console.log(`[!] Still on Cloudflare Turnstile screen ("${pageTitle}"). Waiting 6s for solver...`);
        
        // Coba klik koordinat jika Turnstile widget terdeteksi
        try {
          const frames = page.frames();
          for (const f of frames) {
            if (f.url().includes('challenges.cloudflare.com')) {
              console.log('[*] Found Turnstile frame! Interacting...');
              const cb = await f.$('input[type="checkbox"], #challenge-stage, .ctp-checkbox-label, .main-content');
              if (cb) await cb.click();
            }
          }
        } catch(e) {}

        await new Promise(r => setTimeout(r, 6000));
        continue;
      }

      console.log(`[+] Cloudflare PASSED! Page title is now: "${pageTitle}"`);

      // Tunggu stream video / canvas / player jalan
      console.log('[*] Waiting for video element or live stream canvas...');
      try {
        await page.waitForSelector('video, canvas, #player, .video-js, img', { timeout: 12000 });
      } catch (e) {
        console.log('[!] Player selector wait timeout, continuing to inspect page...');
      }

      // Tunggu 5 detik agar gambar frame video benar-benar ter-render (bukan layar hitam)
      await new Promise(r => setTimeout(r, 5000));
      isSuccess = true;
    }

    const outPath = `cctv_banyuasin_${CAM_ID}.jpg`;
    
    // Prioritaskan screenshot elemen player/video agar gambarnya bersih tanpa border web
    const playerEl = await page.$('video, #player, .player, canvas, .video-js');
    if (playerEl) {
      console.log('[*] Player element found! Capturing crisp camera frame...');
      await playerEl.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
    } else {
      console.log('[*] Capturing full screen...');
      await page.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
    }

    console.log(`[+] Valid photo captured! Sending to Telegram...`);
    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const caption = `📸 <b>Snapshot Live Realtime [CCTV Banyuasin Cam ${CAM_ID}]</b> 🚦\n\n` +
      `🏢 <b>Wilayah:</b> Kab. Banyuasin (Verified Live Frame)\n` +
      `🕒 <b>Waktu:</b> ${now} WIB\n` +
      `🔗 <b>Endpoint:</b> <code>https://cctv.banyuasinkab.go.id/stream/${CAM_ID}</code>`;

    await sendPhotoToTelegram(outPath, caption);
    console.log('[+] Done!');
  } catch (err) {
    console.error('[ERROR] Failed to capture snapshot:', err);
    process.exit(1);
  } finally {
    try { await browser.close(); } catch (e) {}
  }
})();
