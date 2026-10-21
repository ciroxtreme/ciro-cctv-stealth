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

// Fungsi bantu klik checkbox Cloudflare Turnstile
async function trySolveTurnstile(page) {
  try {
    console.log('[*] Looking for Cloudflare Turnstile iframe or checkbox...');
    // Tunggu iframe challenge jika muncul
    await page.waitForSelector('iframe[src*="challenges.cloudflare.com"]', { timeout: 8000 }).catch(() => null);

    const frames = page.frames();
    for (const frame of frames) {
      if (frame.url().includes('challenges.cloudflare.com')) {
        console.log('[*] Found Turnstile frame:', frame.url());
        const checkbox = await frame.$('input[type="checkbox"], #challenge-stage, .ctp-checkbox-label');
        if (checkbox) {
          console.log('[*] Clicking Cloudflare checkbox inside iframe!');
          await checkbox.click();
          await new Promise(r => setTimeout(r, 4000));
          return true;
        }
      }
    }

    // Coba koordinat tengah kotak jika selector tidak ketemu
    const cfBox = await page.$('#challenge-stage, .main-content');
    if (cfBox) {
      const box = await cfBox.boundingBox();
      if (box) {
        console.log(`[*] Clicking around challenge bounding box (${box.x + 50}, ${box.y + 50})...`);
        await page.mouse.click(box.x + 50, box.y + 50);
        await new Promise(r => setTimeout(r, 4000));
      }
    }
  } catch (e) {
    console.log('[*] Turnstile click attempt error:', e.message);
  }
}

(async () => {
  console.log(`[INFO] Launching Puppeteer Stealth for CCTV Banyuasin Cam ${CAM_ID}...`);
  const browser = await puppeteer.launch({
    headless: false, // Menjalankan di virtual screen xvfb / headful mode agar Turnstile tidak mendeteksi headless
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,720'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36');

    const targetUrl = `https://cctv.banyuasinkab.go.id/stream/${CAM_ID}`;
    const portalUrl = 'https://cctv.banyuasinkab.go.id/';

    console.log(`[1] Visiting portal: ${portalUrl}`);
    await page.goto(portalUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Tunggu dan coba selesaikan Turnstile jika ada
    await trySolveTurnstile(page);

    console.log('[2] Waiting 8 seconds for redirect/challenge verification...');
    await new Promise(r => setTimeout(r, 8000));

    console.log(`[3] Navigating to stream endpoint: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);

    // Coba klik Turnstile sekali lagi jika muncul di endpoint stream
    await trySolveTurnstile(page);
    await new Promise(r => setTimeout(r, 5000));

    const outPath = `cctv_banyuasin_${CAM_ID}.jpg`;
    await page.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
    console.log(`[4] Screenshot saved to ${outPath}`);

    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const caption = `📸 <b>Snapshot Live Realtime [CCTV Banyuasin Cam ${CAM_ID}]</b> 🚦\n\n` +
      `🏢 <b>Wilayah:</b> Kab. Banyuasin (Puppeteer Auto-Solve Turnstile)\n` +
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
