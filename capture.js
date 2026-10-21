const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const BOT_TOKEN = process.env.BOT_TOKEN || '8899978543:AAHlrCjXZbiJwcI_OZIzXrGdpKC5_BCGCEs';
const CHAT_ID = process.env.CHAT_ID || '1936436999';
const CAM_ID = process.env.CAM_ID || '4';

async function sendPhotoToTelegram(photoPath, caption) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const photoBytes = fs.readFileSync(photoPath);

  const bodyParts = [];
  bodyParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${CHAT_ID}\r\n`));
  bodyParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n`));
  bodyParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`));
  bodyParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="cctv_banyuasin_${CAM_ID}.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`));
  bodyParts.push(photoBytes);
  bodyParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const totalBody = Buffer.concat(bodyParts);

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: totalBody
  });
  const data = await res.json();
  console.log('Telegram sendPhoto response:', data);
}

(async () => {
  console.log(`[INFO] Launching Puppeteer Stealth for CCTV Banyuasin Cam ${CAM_ID}...`);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,720'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36');

    const targetUrl = `https://cctv.banyuasinkab.go.id/stream/${CAM_ID}`;
    const portalUrl = 'https://cctv.banyuasinkab.go.id/';

    console.log(`[1] Visiting portal to pass Cloudflare Turnstile: ${portalUrl}`);
    await page.goto(portalUrl, { waitUntil: 'networkidle2', timeout: 45000 });

    // Tunggu jika ada Cloudflare challenge
    console.log('[2] Waiting 6 seconds for challenge clearance...');
    await new Promise(r => setTimeout(r, 6000));

    console.log(`[3] Navigating to stream endpoint: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Tunggu 3 detik agar frame gambar termuat sempurna
    await new Promise(r => setTimeout(r, 3000));

    const outPath = `cctv_banyuasin_${CAM_ID}.jpg`;
    await page.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
    console.log(`[4] Screenshot saved to ${outPath}`);

    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const caption = `📸 <b>Snapshot Live Realtime [CCTV Banyuasin Cam ${CAM_ID}]</b> 🚦\n\n` +
      `🏢 <b>Wilayah:</b> Kab. Banyuasin (Bypass Cloudflare via GitHub Actions)\n` +
      `🕒 <b>Waktu:</b> ${now} WIB\n` +
      `🔗 <b>Endpoint:</b> <code>https://cctv.banyuasinkab.go.id/stream/${CAM_ID}</code>`;

    await sendPhotoToTelegram(outPath, caption);
    console.log('[5] Successfully sent snapshot to Telegram!');
  } catch (err) {
    console.error('[ERROR] Failed to capture snapshot:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
