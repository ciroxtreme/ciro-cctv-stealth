const { chromium } = require('playwright');
const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN || '8899978543:AAHlrCjXZbiJwcI_OZIzXrGdpKC5_BCGCEs';
const CHAT_ID = process.env.CHAT_ID || '1936436999';

(async () => {
  console.log('[INFO] Launching Rebrowser/Playwright Stealth Browser...');

  const chromePath = fs.existsSync('/usr/bin/google-chrome-stable') 
    ? '/usr/bin/google-chrome-stable' 
    : (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);

  const launchOptions = {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--window-size=1280,850'
    ]
  };

  if (chromePath) {
    console.log(`[*] Using installed Real Google Chrome binary at: ${chromePath}`);
    launchOptions.executablePath = chromePath;
  }

  const browser = await chromium.launch(launchOptions);

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Infinix X6880 Build/AP3A.240905.015.A2; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/155.0.8059.43 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();

  // Inject cookies jika ada
  const cfClearanceVal = process.env.CF_CLEARANCE;
  if (cfClearanceVal && cfClearanceVal !== 'init') {
    console.log('[*] Injecting cf_clearance to Playwright context...');
    await context.addCookies([
      {
        name: 'cf_clearance',
        value: cfClearanceVal,
        domain: '.banyuasinkab.go.id',
        path: '/',
        secure: true,
        httpOnly: true
      }
    ]);
  }

  const portalUrl = 'https://cctv.banyuasinkab.go.id/';
  console.log(`[1] Navigasi ke portal: ${portalUrl}`);
  await page.goto(portalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Tunggu Turnstile
  console.log('[2] Memantau Cloudflare Turnstile...');
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(2000);
    const title = await page.title();
    console.log(`[*] Detik ke-${(i + 1) * 2} | Judul: "${title}" | URL: ${page.url()}`);

    if (!title.toLowerCase().includes('just a moment') && !title.toLowerCase().includes('security verification')) {
      console.log('[+] Lolos Turnstile di Playwright!');
      break;
    }
  }

  const requestedTarget = (process.env.CAM_TARGET || 'sembawa').toLowerCase();
  console.log(`[3] Membuka kamera target: "${requestedTarget}"...`);

  await page.evaluate((targetName) => {
    const modals = Array.from(document.querySelectorAll('.modal, [class*="modal"]'));
    const matchingModal = modals.find(m => m.innerText && m.innerText.toLowerCase().includes(targetName));
    if (matchingModal) {
      matchingModal.classList.add('show');
      matchingModal.classList.remove('fade');
      matchingModal.style.display = 'block';
      matchingModal.style.opacity = '1';
      matchingModal.style.visibility = 'visible';
      matchingModal.style.zIndex = '99999';
      const v = matchingModal.querySelector('video');
      if (v) v.play().catch(() => null);
    }
  }, requestedTarget);

  await page.waitForTimeout(5000);

  const outPath = 'cctv_banyuasin_live.jpg';
  await page.screenshot({ path: outPath, quality: 90, type: 'jpeg' });
  console.log(`[4] Screenshot tersimpan di ${outPath}`);

  await browser.close();
})();
