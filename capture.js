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
      defaultViewport: { width: 412, height: 915, isMobile: true, hasTouch: true }
    }
  });

  try {
    const userAgent = 'Mozilla/5.0 (Linux; Android 15; Infinix X6880 Build/AP3A.240905.015.A2; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/155.0.8059.43 Mobile Safari/537.36';
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true });


    const sessionVal = 'eyJpdiI6Imk5cUFFTkltYzQ3TDFTNXFzbmdqcVE9PSIsInZhbHVlIjoiQkZibS9CbEYva05jcnlFOTZtcjhnTk1qd1IxZ1dENk0zWlFiaDJQYU02Y3dtN0ZCc2pOQjVGRWFhUDJyMVQ5amtyUS9YUmlwVTBQQUFQeGN1bkhHQnhiQ09WdWVLUTJqQllHemtuQ1VRTkQ1QlpJOG1taEpLYS9UTEJWSnBOeEQiLCJtYWMiOiI3MDBkYjNkYjNmZTJlNTZkNWJjNjM2Yzc2ODlmN2QwYTE1ZGFmZTVhNzc1ZjQwYWIzODViNjQ4MjdhOTcwZWI0IiwidGFnIjoiIn0=';
    const xsrfVal = 'eyJpdiI6Ik56V0JkQ0t0QVBCMWU4OVVIWVdDY1E9PSIsInZhbHVlIjoiY1lmbWVibUxRNjRhMFJEdGhzV2xjaTlIdUVhRUxzUHk5NHFXR281b0FyUktTYzJ0bnRBYm14bis0UDBSeW5kSDBValNuMDd5bkZkeklVVXlUZGJRekhXWkNza0hMczNic09HMWFBOVFlZklERmxNVWhVYzBKNWlWcWdVdm51RUgiLCJtYWMiOiI5YjQwYTk4ZDQyOGQ3ZmNhNmU3MDY5NGVhODZmOWIzMzhlZDJiZGZjOWNkMDIyMjYzZjI3ZTllMjdkM2I4NTExIiwidGFnIjoiIn0=';
    const cfClearanceVal = process.env.CF_CLEARANCE || 'yt6zuk.vMzFaKMlARqmQYcR6MyEeFic5xnU2nWK9xD0-1792647523-1.2.1.1-nfHJwTi2WZ3mzB3K79BLLZ5cXgIguk8xXkgkj_.4fmRM7Ow9HtsoB3bHCXT3cR2n2zg3RUkHER1odkPlrGA.jZwUU5NZMIuUrdUj6qiSXgKSJ0x9E5TIAJsfdwADgRmYVv8lYVoY9RdLbRY1DSltc7M.Sr0hQoUtitibDnvqYaHunANqvGHbpzhF_3C5UD1Myfwz8YXa13SZ.asrUCvExu1dXgxS_ysQOUpMMR7eGohwOiNPAHxrZNsh_wlBRKHKUYJ_HssYNN4AZBeUSVJf_JwfuEVIrz3SMXD6_GtISbi9gGvyTrVuulZGNcr0008gb85Ro6XcP4IQbiXJ90dQNXl5YBT5rb5HC5Sph9065TibFmVbXwqTytHaAiCplOer3pAYcWjeeGYJwFAWUMiNu.2iI_1V2zlrsyo3wZodib.rbHElgU2rmaHEdNYMZxeGyjC3MjJplnr4QuvmMYf9ucD7HgcVI7Fm3Stg4jAF8svI_Zh1qasWyuRi9U01gY.SJeQs_N67.4Npcv4xmThpyA';
    const cfzAnalyticsVal = '%7B%22_cfa_clientId%22%3A%7B%22v%22%3A%2235698780624225624%22%2C%22e%22%3A1824180005296%7D%2C%22_cfa_sId%22%3A%7B%22v%22%3A%2221386557687092230%22%2C%22e%22%3A1792649324442%7D%7D';

    console.log('[*] Injecting mobile cookies from Infinix device...');
    await page.setCookie(
      {
        name: 'cf_clearance',
        value: cfClearanceVal,
        domain: '.banyuasinkab.go.id',
        path: '/',
        secure: true,
        httpOnly: true
      },
      {
        name: 'cfz_zaraz-analytics',
        value: cfzAnalyticsVal,
        domain: '.banyuasinkab.go.id',
        path: '/',
        secure: true,
        httpOnly: true
      },
      {
        name: 'XSRF-TOKEN',
        value: xsrfVal,
        domain: 'cctv.banyuasinkab.go.id',
        path: '/'
      },
      {
        name: 'cctv_banyuasin_session',
        value: sessionVal,
        domain: 'cctv.banyuasinkab.go.id',
        path: '/'
      },
      {
        name: 'laravel_session',
        value: sessionVal,
        domain: 'cctv.banyuasinkab.go.id',
        path: '/'
      }
    );


    const portalUrl = 'https://cctv.banyuasinkab.go.id/';
    console.log(`[1] Buka halaman peta utama: ${portalUrl}`);
    await page.goto(portalUrl, { waitUntil: 'networkidle2', timeout: 60000 });


    console.log('[2] Menunggu Cloudflare Turnstile & Peta Leaflet memuat...');
    
    // Tunggu Turnstile & Peta Leaflet memuat (puppeteer-real-browser turnstile: true otomatis menangani solving di background)
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 2000));
      let currentTitle = '';
      try {
        currentTitle = await page.title();
        console.log(`[*] Detik ke-${(i + 1) * 2} | Judul: "${currentTitle}" | URL: ${page.url()}`);
      } catch (e) {
        console.log(`[*] Detik ke-${(i + 1) * 2} | Navigasi halaman sedang berlangsung (Turnstile redirecting)...`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      
      if (!currentTitle.toLowerCase().includes('just a moment') && !currentTitle.toLowerCase().includes('security verification')) {
        console.log('[+] Lolos Turnstile Cloudflare! Masuk ke halaman peta!');
        break;
      }
    }




    // Cari marker CCTV di peta atau trigger modal kamera berdasarkan nama/target
    const requestedTarget = (process.env.CAM_TARGET || 'sembawa').toLowerCase();
    console.log(`[3] Mencari kamera target: "${requestedTarget}" di peta / daftar kamera...`);

    const selectResult = await page.evaluate((targetName) => {
      // Sembunyikan semua modal lain terlebih dahulu agar tidak menimpa kamera yang dipilih
      document.querySelectorAll('.modal, [class*="modal"]').forEach(m => {
        m.classList.remove('show');
        m.style.display = 'none';
      });

      // 1. Cek apakah ada elemen list/menu/link kamera dengan teks nama target
      const allElements = Array.from(document.querySelectorAll('a, button, li, .list-group-item, span, td, h5, h6'));
      const foundLink = allElements.find(el => el.innerText && el.innerText.toLowerCase().trim() === targetName.trim());
      if (foundLink) {
        foundLink.click();
      }

      // 2. Cek apakah ada modal yang sesuai dengan target dan tampilkan secara eksklusif
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
        return { clicked: true, method: 'modalDirect', id: matchingModal.id, name: targetName };
      }

      if (foundLink) {
        return { clicked: true, method: 'menuItem', name: foundLink.innerText };
      }

      // 3. Fallback: Cari marker CCTV kamera di peta
      const markers = Array.from(document.querySelectorAll('.leaflet-marker-icon'));
      const camMarker = markers.find(m => m.src && (m.src.includes('cctv') || m.src.includes('RED') || m.src.includes('cam')));
      if (camMarker) {
        camMarker.click();
        return { clicked: true, method: 'camMarker', src: camMarker.src };
      }

      return { clicked: false, totalMarkers: markers.length };
    }, requestedTarget);

    console.log('[*] Status seleksi kamera:', JSON.stringify(selectResult));

    // Tunggu popup modal video muncul di Leaflet
    console.log('[4] Menunggu popup modal video CCTV muncul...');
    await page.waitForSelector('.modal.show, .leaflet-popup-content, .modal-content, video, canvas', { timeout: 15000 }).catch(() => null);
    await new Promise(r => setTimeout(r, 5000));



    // Debug isi HTML dan frame yang ada di halaman
    let debugInfo = {};
    try {
      debugInfo = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          hasLeaflet: typeof window.L !== 'undefined',
          markerCount: document.querySelectorAll('.leaflet-marker-icon').length,
          popupCount: document.querySelectorAll('.leaflet-popup').length,
          modalCount: document.querySelectorAll('.modal, [class*="modal"], [id*="modal"]').length,
          hasVideo: document.querySelectorAll('video, canvas, iframe').length
        };
      });
      console.log('[DEBUG] Info Halaman:', JSON.stringify(debugInfo));
    } catch (e) {
      console.log('[!] Error evaluate debug info:', e.message);
    }


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

    // Ambil screenshot aman (hindari crash jika modal/elemen belum siap)
    try {
      if (targetElement) {
        console.log('[+] Popup video CCTV ditemukan! Mengambil screenshot frame video...');
        await targetElement.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
      } else {
        console.log('[*] Popup modal spesifik tidak terisolasi, mengambil screenshot area peta live...');
        await page.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
      }
    } catch (e) {
      console.log('[!] Element screenshot gagal, fallback ke page.screenshot():', e.message);
      await page.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
    }

    // Simpan artifact agar bisa di-review
    console.log(`[5] Screenshot tersimpan di ${outPath}`);

    // Verifikasi ketat sebelum kirim ke Telegram: jika 'Just a moment' ATAU error server (522, 502, 404), JANGAN kirim!
    const pageCheck = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      const title = document.title.toLowerCase();
      const isCloudflare = title.includes('just a moment') || text.includes('verifying you are human') || text.includes('performing security verification');
      const isServerError = text.includes('error code 522') || text.includes('502 bad gateway') || text.includes('404 not found');
      const hasLeafletMap = typeof window.L !== 'undefined' || document.querySelectorAll('.leaflet-container, .leaflet-marker-icon').length > 0;
      return { isCloudflare, isServerError, hasLeafletMap, title, textSnippet: text.substring(0, 150) };
    });

    console.log('[*] Status Validasi Halaman:', JSON.stringify(pageCheck));

    if (pageCheck.isCloudflare) {
      console.log('[!] Layar masih Cloudflare Turnstile. Hapus file screenshot dan lempar error agar tidak terkirim!');
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
      throw new Error('Gagal: Masih tertahan di verifikasi Cloudflare Turnstile!');
    } else if (pageCheck.isServerError) {
      console.log('[!] Server Diskominfo Banyuasin sedang error (522 Connection Timed Out / 404).');
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
      throw new Error('Gagal: Server Diskominfo Banyuasin error (522/404)!');
    } else if (!pageCheck.hasLeafletMap) {
      console.log('[!] Peta Leaflet belum ter-render sempurna.');
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
      throw new Error('Gagal: Peta Leaflet CCTV belum ter-render!');
    } else {
      console.log('[6] Sukses validasi live peta/kamera CCTV!');
    }



  } catch (err) {
    console.error('[ERROR] Gagal memotret peta CCTV:', err);
    process.exit(1);
  } finally {
    try { await browser.close(); } catch (e) {}
  }
})();
