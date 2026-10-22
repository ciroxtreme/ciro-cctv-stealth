const { connect } = require('puppeteer-real-browser');
const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN || '8899978543:AAHlrCjXZbiJwcI_OZIzXrGdpKC5_BCGCEs';
const CHAT_ID = process.env.CHAT_ID || '1936436999';

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
  console.log('[INFO] Launching Real Browser to scrape CCTV Banyuasin Map...');

  const { browser, page } = await connect({
    headless: false,
    turnstile: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--enable-webgl',
      '--enable-webgl2',
      '--window-size=1280,850'
    ],
    connectOption: {
      defaultViewport: { width: 1280, height: 850 }
    }
  });

  try {
    const portalUrl = 'https://cctv.banyuasinkab.go.id/';
    console.log(`[1] Buka halaman peta utama: ${portalUrl}`);
    await page.goto(portalUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('[2] Menunggu Cloudflare Turnstile & Peta Leaflet memuat...');
    
    // Tunggu Turnstile otomatis selesai / redirect
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const currentTitle = await page.title();
      console.log(`[*] Detik ke-${(i + 1) * 2} | Judul: "${currentTitle}" | URL: ${page.url()}`);
      if (!currentTitle.toLowerCase().includes('just a moment')) {
        console.log('[+] Lolos Turnstile Cloudflare! Masuk ke halaman peta!');
        break;
      }
      // Coba klik Turnstile jika ada
      try {
        const frames = page.frames();
        for (const frame of frames) {
          if (frame.url().includes('challenges.cloudflare.com')) {
            const cb = await frame.$('input[type="checkbox"], #challenge-stage, .ctp-checkbox-label');
            if (cb) {
              console.log('[*] Menemukan checkbox Turnstile di iframe, klik!');
              await cb.click();
            }
          }
        }
      } catch (e) {}
    }


    // Cari marker CCTV di peta (Leaflet marker)
    console.log('[3] Mencari ikon marker kamera di peta Leaflet...');
    const markerSelector = '.leaflet-marker-icon, img[src*="cctv"], img[src*="marker"], .marker-cluster';
    
    try {
      await page.waitForSelector(markerSelector, { timeout: 15000 });
      console.log('[+] Marker CCTV ditemukan di peta!');
    } catch (e) {
      console.log('[!] Selector marker belum muncul, mencoba scroll/klik layer...');
    }

    // Klik marker CCTV pertama yang ada di peta
    const clicked = await page.evaluate((sel) => {
      const markers = document.querySelectorAll(sel);
      console.log('Total marker ditemukan:', markers.length);
      for (const m of markers) {
        // Cari marker yang punya gambar kamera atau cluster
        if (m) {
          m.click();
          return true;
        }
      }
      return false;
    }, markerSelector);

    console.log('[*] Status klik marker CCTV:', clicked);

    // Tunggu popup modal video ("Pasar P.Balai 2") muncul
    console.log('[4] Menunggu popup video CCTV muncul...');
    await new Promise(r => setTimeout(r, 6000));

    // Cari elemen popup dialog / video player di dalam modal
    const modalSelector = '.leaflet-popup-content, .modal-content, video, canvas, iframe';
    let targetElement = null;
    try {
      targetElement = await page.$(modalSelector);
    } catch (e) {}

    const outPath = 'cctv_banyuasin_live.jpg';

    if (targetElement) {
      console.log('[+] Popup video CCTV ditemukan! Mengambil screenshot frame video...');
      await targetElement.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
    } else {
      console.log('[*] Popup modal spesifik tidak terisolasi, mengambil screenshot area peta live...');
      await page.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
    }

    // Simpan artifact agar bisa di-review
    console.log(`[5] Screenshot tersimpan di ${outPath}`);

    // Verifikasi sebelum kirim ke Telegram: jika masih 'Just a moment', jangan kirim ke Telegram!
    const finalTitle = await page.title();
    if (finalTitle.toLowerCase().includes('just a moment')) {
      console.log('[!] Screenshot masih berada di layar verifikasi Cloudflare. Melewati pengiriman ke Telegram sesuai SOP!');
    } else {
      const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      const caption = `📸 <b>Snapshot Live Realtime [CCTV Kab. Banyuasin]</b> 🚦\n\n` +
        `🏢 <b>Lokasi:</b> Pasar P.Balai & Sekitar (Leaflet Map Capture)\n` +
        `🕒 <b>Waktu:</b> ${now} WIB\n` +
        `🔗 <b>Portal:</b> <code>https://cctv.banyuasinkab.go.id/</code>`;

      await sendPhotoToTelegram(outPath, caption).catch(e => console.log('Telegram send error:', e.message));
      console.log('[6] Sukses memproses pengiriman ke Telegram!');
    }

  } catch (err) {
    console.error('[ERROR] Gagal memotret peta CCTV:', err);
    process.exit(1);
  } finally {
    try { await browser.close(); } catch (e) {}
  }
})();
