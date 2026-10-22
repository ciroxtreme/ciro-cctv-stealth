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
    const outPath = 'cctv_banyuasin_live.jpg';
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
    
    let passedTurnstile = false;
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
        passedTurnstile = true;
        break;
      }
    }

    if (!passedTurnstile) {
      console.log('[!] Gagal lolos Cloudflare Turnstile setelah 80 detik. Batalkan proses!');
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
      throw new Error('Gagal: Masih tertahan di verifikasi Cloudflare Turnstile (Timeout)!');
    }




    // Cari marker CCTV di peta atau trigger modal kamera berdasarkan nama/target
    const requestedTarget = (process.env.CAM_TARGET || 'sembawa').toLowerCase();
    console.log(`[3] Mencari kamera target: "${requestedTarget}" di peta / daftar kamera...`);

    const selectResult = await page.evaluate((targetName) => {
      // 1. Cari elemen menu/link/list kamera yang teksnya mengandung nama target dan trigger klik
      const clickableElements = Array.from(document.querySelectorAll('a, button, li, .list-group-item, span, td, h5, h6, [onclick]'));
      const foundItem = clickableElements.find(el => {
        const txt = (el.innerText || el.textContent || '').toLowerCase().trim();
        return txt === targetName || (targetName.length > 3 && txt.includes(targetName));
      });

      if (foundItem) {
        // Jangan sembunyikan modal jika item menu yang memicunya
        foundItem.click();
        return { clicked: true, method: 'menuItemClick', text: foundItem.innerText };
      }

      // 2. Jika tidak ada menu yang cocok, cari marker Leaflet
      const markers = Array.from(document.querySelectorAll('.leaflet-marker-icon'));
      const targetMarker = markers.find(m => {
        const title = (m.title || m.alt || '').toLowerCase();
        return title.includes(targetName);
      });

      if (targetMarker) {
        targetMarker.click();
        return { clicked: true, method: 'markerDirect', title: targetMarker.title };
      }

      return { clicked: false, totalMarkers: markers.length };
    }, requestedTarget);

    console.log('[*] Status seleksi kamera:', JSON.stringify(selectResult));

    // Tunggu popup video / modal kamera selesai dimuat
    console.log('[4] Menunggu popup modal video CCTV muncul...');
    await page.waitForSelector('.modal.show, .leaflet-popup-content, video, canvas, iframe', { timeout: 15000 }).catch(() => null);
    await new Promise(r => setTimeout(r, 6000));

    // Pastikan modal yang terbuka memiliki video aktif
    await page.evaluate((targetName) => {
      document.querySelectorAll('video').forEach(v => {
        v.muted = true;
        v.play().catch(() => null);
      });
      // Jika modal belum show tapi ada di DOM, paksa show modal yang cocok
      const modals = Array.from(document.querySelectorAll('.modal, [class*="modal"]'));
      const openModal = modals.find(m => m.classList.contains('show') || m.style.display === 'block');
      if (!openModal) {
        const matching = modals.find(m => (m.innerText || m.textContent || '').toLowerCase().includes(targetName));
        if (matching) {
          matching.classList.add('show');
          matching.classList.remove('fade');
          matching.style.display = 'block';
          matching.style.visibility = 'visible';
          matching.style.zIndex = '99999';
        }
      }
    }, requestedTarget);

    // Debug isi HTML dan frame yang ada di halaman
    let debugInfo = {};
    try {
      debugInfo = await page.evaluate(() => {
        const visibleModals = Array.from(document.querySelectorAll('.modal.show, .modal[style*="display: block"], .leaflet-popup')).map(m => m.innerText ? m.innerText.substring(0, 50) : '');
        const modalDetails = Array.from(document.querySelectorAll('.modal, [class*="modal"]')).map(m => ({
          id: m.id,
          classes: m.className,
          display: m.style.display,
          text: (m.innerText || '').substring(0, 30)
        }));
        return {
          url: window.location.href,
          title: document.title,
          hasLeaflet: typeof window.L !== 'undefined',
          markerCount: document.querySelectorAll('.leaflet-marker-icon').length,
          popupCount: document.querySelectorAll('.leaflet-popup').length,
          modalCount: document.querySelectorAll('.modal, [class*="modal"], [id*="modal"]').length,
          visibleModals,
          modalDetails,
          hasVideo: document.querySelectorAll('video, canvas, iframe').length
        };
      });
      console.log('[DEBUG] Info Halaman:', JSON.stringify(debugInfo));
    } catch (e) {
      console.log('[!] Error evaluate debug info:', e.message);
    }

    // Cari elemen modal atau popup Leaflet yang terisi konten video
    const captureResult = await page.evaluate(() => {
      const activeEl = document.querySelector('.modal.show, .modal[style*="display: block"], .leaflet-popup-content, .modal-content');
      if (activeEl) {
        const rect = activeEl.getBoundingClientRect();
        if (rect.width > 30 && rect.height > 30) {
          return { found: true, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }
      }
      return { found: false };
    });

    console.log('[*] Modal rect check:', JSON.stringify(captureResult));

    // Validasi ketat: Jika modal/video TIDAK ditemukan atau tidak visible, jangan fallback ke peta!
    if (!captureResult.found) {
      console.log('[!] Modal video kamera target tidak terbuka/visible di layar! Tolak screenshot peta.');
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
      throw new Error(`Kamera "${requestedTarget}" belum terbuka di modal video. Menghentikan proses agar peta tidak terkirim!`);
    }

    // Ambil screenshot tepat pada modal kamera target (bukan peta dasar)
    try {
      const modalEl = await page.$('.modal.show, .modal[style*="display: block"], .leaflet-popup-content, .modal-content');
      if (modalEl) {
        console.log('[+] Mengambil screenshot modal frame video target...');
        await modalEl.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
      } else {
        throw new Error('Element modal target tidak dapat di-binding.');
      }
    } catch (e) {
      console.log('[!] Gagal memotret elemen modal:', e.message);
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
      throw new Error(`Gagal memotret modal: ${e.message}`);
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
