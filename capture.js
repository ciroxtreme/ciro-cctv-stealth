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


    const sessionVal = 'eyJpdiI6InJ0U1ZrcFlRUy9LVlZjMG5USzh3aFE9PSIsInZhbHVlIjoiVHlPUTJqTERFVWVkOUREd1ZOWnpwYXlMVTJBREdBa3dkaUdJdHNMSGhZZGN6RkZjMU9HNFlaVjlFbk9tdlFnYVNFSWI4RThOMXYwQ1BVZlRqakJLN2JxSnpMVEJLNUNwQnpXVmcwYnk0TUxiUnROYkxIek8vTG9DcUs2Vm5IRm8iLCJtYWMiOiIxOTgzMDViYjMzNjQ2YmU3YzkzNWFlOTdmODQzNzEyNTdmZTY5NjRjZDkxNDZjNTM5M2Y1N2RhZmNlMjEzMDgxIiwidGFnIjoiIn0=';
    const xsrfVal = 'eyJpdiI6Ii9WK1FWbU9OM0ZNQyszVjZQeHJxenc9PSIsInZhbHVlIjoiem5OckRWbWJ3MU5mRndqbHFnZWdFenE3VzZWd3RySk5XNllJalkvL1hRKzNNNG9XSmkyMzc2YWNLQk9LblBNdG54WDNGak1mNVFVaGt3bHdZcGQ1aFlEaGtLR3VHaC9QVWIwUUlYMWpKVjh1K295akRCUFpXdk52OTFHZ29WaCsiLCJtYWMiOiI2OWQ2MTM1YmYzMjczNmYxNDcwNmRkOWRhY2E3YzIxZmQ1OWI5MTFhZWZjNDJkYmNkMDhjOWVjYzUxMjU2YTRlIiwidGFnIjoiIn0=';

    const cfClearanceVal = 'OG5Qm03XqUZdztBC4nE8Tq65MYrLAALN5o4oEZztb1E-1792644003-1.2.1.1-NZPSq8lHXA5r1pwx6j2pni.R.2zXA2Pte_74JclsKdjpXKKKURvtHiF_CpEZbGnIg5z.3NGflCtiHzEEz8VVWGeGaQ2wtsBLIUl1A.aAAPYIuSuMdK_2Vm_ISRl9USal50v.uqA2tRJGlGmAjqydqvMWOCpyITDrfB_zKdav0zjC3vy_ovI.4iQXey8lm1P6nLJWZU.XLi5KRomJVln3Ip_OTGaAWUD.1Om3VfApVjWwAMg0l20YPV3RoNp1AW6T2oWFsoFZwVgA9aIifjftVNLmbOfDhhfIqFwmuSvqE9KPz3uy2sE5MiyzcKbs9VlWaA8vxwP_5UFm_p62sPcrys9qPF.Klt1dKd_AopyME6yD_iI16oSFVW4BpequbShWh4xEKaOirt_uEsWGYm3iKiqr6NZNGcQmDXeVbT4KLdwBpJOGPtVRLaxyUl2sHh4Fgxtp1xNPi0yRDXzQLc3OM.XecDCsgKPW8kAurBLeLro2A0PWJEAPG36Bd1bBZhuo1_LWQxDFDAhED0nNi581Bg';

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
    
    // Auto-solver loop Turnstile
    for (let i = 0; i < 25; i++) {
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

      // Deteksi dan klik Turnstile widget
      try {
        const frames = page.frames();
        for (const frame of frames) {
          if (frame.url().includes('challenges.cloudflare.com')) {
            const el = await frame.$('body, #challenge-stage, input[type="checkbox"], .ctp-checkbox-label, .ctp-label');
            if (el) {
              const box = await el.boundingBox();
              if (box) {
                console.log(`[*] Klik checkbox Turnstile di koordinat (${box.x + 25}, ${box.y + 25})`);
                await page.mouse.click(box.x + 25, box.y + 25);
              } else {
                await el.click().catch(() => null);
              }
            }
          }
        }

        // Coba klik container challenge jika di main frame
        const cfContainer = await page.$('#cf-turnstile, #challenge-stage, iframe[src*="challenges.cloudflare.com"]');
        if (cfContainer) {
          const cBox = await cfContainer.boundingBox();
          if (cBox) {
            console.log(`[*] Klik challenge container di koordinat (${cBox.x + 30}, ${cBox.y + cBox.height / 2})`);
            await page.mouse.click(cBox.x + 30, cBox.y + cBox.height / 2);
          }
        }
      } catch (e) {
        console.log('[!] Auto-click attempt:', e.message);
      }
    }




    // Cari marker CCTV di peta atau trigger modal kamera berdasarkan nama/target
    const requestedTarget = (process.env.CAM_TARGET || 'sembawa').toLowerCase();
    console.log(`[3] Mencari kamera target: "${requestedTarget}" di peta / daftar kamera...`);

    const selectResult = await page.evaluate((targetName) => {
      // 1. Cek apakah ada elemen list/menu/link kamera dengan teks nama target
      const allElements = Array.from(document.querySelectorAll('a, button, li, .list-group-item, span, td, h5, h6'));
      const foundLink = allElements.find(el => el.innerText && el.innerText.toLowerCase().trim() === targetName.trim());
      if (foundLink) {
        foundLink.click();
        return { clicked: true, method: 'menuItem', name: foundLink.innerText };
      }

      // 2. Cek apakah ada modal yang sesuai dengan target
      const modals = Array.from(document.querySelectorAll('.modal, [class*="modal"]'));
      const matchingModal = modals.find(m => m.innerText && m.innerText.toLowerCase().includes(targetName));
      if (matchingModal) {
        matchingModal.classList.add('show');
        matchingModal.style.display = 'block';
        return { clicked: true, method: 'modalDirect', id: matchingModal.id };
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

    if (targetElement) {
      console.log('[+] Popup video CCTV ditemukan! Mengambil screenshot frame video...');
      await targetElement.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
    } else {
      console.log('[*] Popup modal spesifik tidak terisolasi, mengambil screenshot area peta live...');
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
