import os
import sys
import time
from camoufox.sync_api import Camoufox

BOT_TOKEN = os.environ.get("BOT_TOKEN", "8899978543:AAHlrCjXZbiJwcI_OZIzXrGdpKC5_BCGCEs")
CHAT_ID = os.environ.get("CHAT_ID", "1936436999")
CAM_TARGET = os.environ.get("CAM_TARGET", "pasar p.balai").lower()

print(f"[INFO] Launching Camoufox (Byparr Engine) for target: {CAM_TARGET}...")

with Camoufox(
    headless=False,
    humanize=True,
    disable_coop=True,
    window=(412, 915)
) as browser:
    page = browser.new_page()

    # Inject cf_clearance jika tersedia
    cf_token = os.environ.get("CF_CLEARANCE")
    if cf_token and cf_token != "init":
        print("[*] Injecting cf_clearance to Camoufox session...")
        page.context.add_cookies([{
            "name": "cf_clearance",
            "value": cf_token,
            "domain": ".banyuasinkab.go.id",
            "path": "/",
            "secure": True,
            "httpOnly": True
        }])

    portal_url = "https://cctv.banyuasinkab.go.id/"
    print(f"[1] Navigasi ke portal: {portal_url}")
    page.goto(portal_url, timeout=60000)

    print("[2] Memantau Cloudflare Turnstile & Peta Leaflet...")
    passed = False
    for i in range(25):
        time.sleep(2)
        title = page.title()
        print(f"[*] Detik ke-{(i + 1) * 2} | Judul: \"{title}\" | URL: {page.url}")

        if "just a moment" not in title.lower() and "security verification" not in title.lower():
            print("[+] SUKSES Lolos Turnstile via Camoufox (Byparr Engine)!")
            passed = True
            break
        
        # Coba klik checkbox Turnstile jika muncul di iframe
        try:
            for frame in page.frames:
                if "challenges.cloudflare.com" in frame.url:
                    checkbox = frame.query_selector("input[type='checkbox'], #challenge-stage, .ctp-checkbox-label")
                    if checkbox:
                        print("[*] Mengklik Turnstile checkbox dengan natural mouse...")
                        checkbox.click()
        except Exception as e:
            pass

    # Buka modal CCTV yang dipilih
    print(f"[3] Menampilkan feed kamera: \"{CAM_TARGET}\"...")
    page.evaluate("""(targetName) => {
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
    }""", CAM_TARGET)

    time.sleep(5)
    out_path = "cctv_banyuasin_live.jpg"
    page.screenshot(path=out_path, quality=90, type="jpeg")
    print(f"[4] Screenshot berhasil disimpan di: {out_path}")

print("[DONE] Selesai eksekusi Camoufox.")
