#!/usr/bin/env python3
"""
capture_banyuasin_camoufox.py
Bypass Cloudflare Turnstile di cctv.banyuasinkab.go.id menggunakan Camoufox Stealth Browser
(Firefox anti-detect engine) dengan auto-solving Turnstile dan unduh snapshot stream kamera Banyuasin.
Adopsi strategi precision-click dari Theyka/Sophomoresty Turnstile bypass.
"""

import os
import sys
import time
import socket
import urllib.parse
from camoufox.sync_api import Camoufox

def get_warp_or_proxy():
    # 1. Cek local Cloudflare WARP tunnel di port 40000
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1)
    try:
        s.connect(("127.0.0.1", 40000))
        s.close()
        print("✅ [WARP] Terdeteksi Cloudflare WARP SOCKS5 Tunnel aktif di 127.0.0.1:40000!")
        return {"server": "socks5://127.0.0.1:40000"}
    except Exception:
        pass

    # 2. Cek env CF_PROXY atau PROXY_URL
    env_proxy = os.environ.get("CF_PROXY", "").strip() or os.environ.get("PROXY_URL", "").strip()
    if env_proxy:
        try:
            p = urllib.parse.urlparse(env_proxy)
            if p.hostname and p.port:
                cfg = {"server": f"{p.scheme or 'http'}://{p.hostname}:{p.port}"}
                if p.username:
                    cfg["username"] = urllib.parse.unquote(p.username)
                if p.password:
                    cfg["password"] = urllib.parse.unquote(p.password)
                print(f"✅ [PROXY] Menggunakan proxy dari env: {cfg['server']}")
                return cfg
        except Exception:
            pass

    print("ℹ️ [DIRECT] Menggunakan koneksi langsung tanpa proxy.")
    return None

def click_turnstile(page):
    """
    Precision click mengadopsi teknik Sophomoresty & Theyka:
    1. Cari frame challenges.cloudflare.com
    2. Dapatkan bounding box frame / body
    3. Simulasikan klik natural pada koordinat checkbox (24, h/2)
    """
    try:
        for frame in page.frames:
            if "challenges.cloudflare.com" in (frame.url or ""):
                body_info = frame.evaluate("""() => {
                    const b = document.body;
                    if (!b) return null;
                    const r = b.getBoundingClientRect();
                    return { w: r.width, h: r.height };
                }""")
                if body_info and body_info.get("h", 0) > 0:
                    click_x = 24
                    click_y = float(body_info["h"]) / 2.0
                    print(f"🖱️ [*] Precision click Turnstile frame body ({click_x}, {click_y:.0f})...")
                    frame.click("body", position={"x": click_x, "y": click_y}, timeout=3000)
                    return True
                
                # Fallback: checkbox selector
                for sel in ("input[type='checkbox']", "#challenge-stage", ".ctp-checkbox-label"):
                    el = frame.query_selector(sel)
                    if el:
                        print(f"🖱️ [*] Fallback click Turnstile selector '{sel}'...")
                        el.click(timeout=3000)
                        return True
    except Exception as e:
        pass

    # Fallback klik bounding box iframe dari context page
    try:
        iframe_el = page.query_selector('iframe[src*="challenges.cloudflare.com"]')
        if iframe_el:
            box = iframe_el.bounding_box()
            if box and box.get("width", 0) > 0:
                px = box["x"] + 24
                py = box["y"] + box["height"] / 2
                print(f"🖱️ [*] Precision click page iframe ({px:.0f}, {py:.0f})...")
                page.mouse.click(px, py)
                return True
    except Exception:
        pass
    return False

def capture_banyuasin(output_dir="output", cam_ids=None):
    os.makedirs(output_dir, exist_ok=True)
    if not cam_ids:
        cam_ids = ["1", "2", "6", "11", "3", "10", "9", "5", "12", "4", "13"]

    print(f"🚀 [INIT] Memulai Camoufox Stealth Engine untuk {len(cam_ids)} kamera Banyuasin...")

    camoufox_kwargs = {
        "headless": False,  # Berjalan di dalam Xvfb virtual display
        "humanize": True,
        "i_know_what_im_doing": True,
        "window": (1280, 800)
    }

    proxy_cfg = get_warp_or_proxy()
    if proxy_cfg:
        camoufox_kwargs["proxy"] = proxy_cfg

    with Camoufox(**camoufox_kwargs) as browser:
        page = browser.new_page()

        portal_url = "https://cctv.banyuasinkab.go.id/"
        print(f"📡 [NAVIGASI] Mengakses portal {portal_url} ...")
        page.goto(portal_url, timeout=60000)

        # Monitor dan selesaikan Cloudflare Turnstile
        solved = False
        max_attempts = 4

        for attempt in range(1, max_attempts + 1):
            if attempt > 1:
                print(f"🔄 [RETRY] Percobaan ke-{attempt}/{max_attempts} menembus Turnstile (Reload)...")
                try:
                    page.reload(timeout=45000)
                except Exception as e:
                    print(f"⚠️ Reload error: {e}")
                    page.goto(portal_url, timeout=60000)

            last_click = 0
            for i in range(25):
                time.sleep(1.5)
                try:
                    title = page.title()
                except Exception:
                    continue

                if "just a moment" not in title.lower() and "security verification" not in title.lower():
                    print(f"🎉 [BERHASIL] Lolos Cloudflare Turnstile! Judul: '{title}'")
                    solved = True
                    break

                now = time.time()
                if now - last_click >= 3.0:
                    if click_turnstile(page):
                        last_click = now

            if solved:
                break

        if not solved:
            print("❌ [GAGAL] Tidak dapat menembus Cloudflare Turnstile setelah semua percobaan.")
            return False

        # Ekstrak cookies clearance untuk verifikasi
        cookies = page.context.cookies()
        clearance_cookie = next((c for c in cookies if c.get("name") == "cf_clearance"), None)
        if clearance_cookie:
            print(f"🔑 [TOKEN] cf_clearance diperoleh: {clearance_cookie.get('value')[:15]}...")

        # Ekstrak frame JPEG dari masing-masing /stream/<id> di dalam context browser yang sudah lolos Turnstile
        print(f"\n📸 [CAPTURE] Memulai pengambilan snapshot {len(cam_ids)} kamera...")
        success_count = 0

        for cid in cam_ids:
            out_file = os.path.join(output_dir, f"banyuasin_{cid}.jpg")
            stream_url = f"https://cctv.banyuasinkab.go.id/stream/{cid}"
            print(f"[*] Mengambil feed Cam ID {cid}: {stream_url} ...")

            js_fetch = """async (url) => {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 12000);
                    const res = await fetch(url, {
                        headers: {
                            'Referer': 'https://cctv.banyuasinkab.go.id/',
                            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                        },
                        signal: controller.signal
                    });
                    if (!res.ok) return { ok: false, status: res.status };

                    const reader = res.body.getReader();
                    let chunks = [];
                    let totalBytes = 0;

                    while (totalBytes < 1500000) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(value);
                        totalBytes += value.length;

                        let merged = new Uint8Array(totalBytes);
                        let offset = 0;
                        for (const c of chunks) {
                            merged.set(c, offset);
                            offset += c.length;
                        }

                        let soi = -1;
                        for (let j = 0; j < merged.length - 1; j++) {
                            if (merged[j] === 0xFF && merged[j+1] === 0xD8) {
                                soi = j;
                                break;
                            }
                        }

                        if (soi !== -1) {
                            let eoi = -1;
                            for (let k = soi + 2; k < merged.length - 1; k++) {
                                if (merged[k] === 0xFF && merged[k+1] === 0xD9) {
                                    eoi = k + 2;
                                    break;
                                }
                            }

                            if (eoi !== -1) {
                                clearTimeout(timeoutId);
                                reader.cancel();
                                const jpegBytes = merged.slice(soi, eoi);
                                let binary = '';
                                const len = jpegBytes.byteLength;
                                for (let b = 0; b < len; b++) {
                                    binary += String.fromCharCode(jpegBytes[b]);
                                }
                                return { ok: true, base64: btoa(binary), size: jpegBytes.length };
                            }
                        }
                    }
                    clearTimeout(timeoutId);
                    return { ok: false, error: 'Frame marker not found' };
                } catch (e) {
                    return { ok: false, error: String(e) };
                }
            }"""

            try:
                result = page.evaluate(js_fetch, stream_url)
                if result.get("ok") and result.get("base64"):
                    import base64
                    raw_data = base64.b64decode(result["base64"])
                    with open(out_file, "wb") as f:
                        f.write(raw_data)
                    print(f"  [✓] Cam {cid} tersimpan ({len(raw_data)} bytes) ➔ {out_file}")
                    success_count += 1
                else:
                    print(f"  [-] Cam {cid} gagal: {result.get('error') or result.get('status')}")
            except Exception as e:
                print(f"  [-] Exception saat capture Cam {cid}: {e}")

            time.sleep(0.5)

        print(f"\n🏁 [SELESAI] Berhasil mengambil {success_count}/{len(cam_ids)} kamera Banyuasin.")
        return success_count > 0

if __name__ == "__main__":
    try:
        cams = sys.argv[1:] if len(sys.argv) > 1 else None
        ok = capture_banyuasin("output", cams)
        sys.exit(0 if ok else 1)
    except Exception as e:
        import traceback
        print(f"❌ [CRASH] Fatal Camoufox exception: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
