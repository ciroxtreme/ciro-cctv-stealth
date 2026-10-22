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
  console.log(`[INFO] Launching Real Browser (Turnstile Auto-Solve) for CCTV Banyuasin Cam ${CAM_ID}...`);

  const { browser, page } = await connect({
    headless: false,
    turnstile: true, // AUTO-BYPASS CLOUDFLARE TURNSTILE
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
    const portalUrl = 'https://cctv.banyuasinkab.go.id/';

    console.log(`[1] Visiting portal to acquire Cloudflare session: ${portalUrl}`);
    await page.goto(portalUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

    console.log('[2] Waiting 6 seconds for Cloudflare Turnstile auto-solve...');
    await new Promise(r => setTimeout(r, 6000));

    console.log(`[3] Navigating to stream target: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 35000 }).catch(() => null);

    console.log('[4] Stabilizing video stream frame...');
    await new Promise(r => setTimeout(r, 5000));

    // Cari elemen player video jika ada, jika tidak screenshot layar penuh
    const videoElement = await page.$('video, canvas, #player, .player, .video-js');
    const outPath = `cctv_banyuasin_${CAM_ID}.jpg`;

    if (videoElement) {
      console.log('[*] Video element found! Capturing video frame...');
      await videoElement.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
    } else {
      console.log('[*] Capturing full page screenshot...');
      await page.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
    }

    console.log(`[5] Screenshot saved to ${outPath}`);

    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const caption = `📸 <b>Snapshot Live Realtime [CCTV Banyuasin Cam ${CAM_ID}]</b> 🚦\n\n` +
      `🏢 <b>Wilayah:</b> Kab. Banyuasin (Bypass Cloudflare Real-Browser)\n` +
      `🕒 <b>Waktu:</b> ${now} WIB\n` +
      `🔗 <b>Endpoint:</b> <code>https://cctv.banyuasinkab.go.id/stream/${CAM_ID}</code>`;

    await sendPhotoToTelegram(outPath, caption);
    console.log('[6] Successfully sent snapshot to Telegram!');
  } catch (err) {
    console.error('[ERROR] Failed to capture snapshot:', err);
    process.exit(1);
  } finally {
    try { await browser.close(); } catch (e) {}
  }
})();
