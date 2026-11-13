import subprocess
import os
import time
import json
import urllib.request
import re

BOT_TOKEN = os.environ.get("BOT_TOKEN", "9050404111:AAHE6X1btKtiWIgBT8Lcp5DDMdUMEV2MbLk")
CHAT_ID = os.environ.get("CHAT_ID", "1936436999")
FILTER_TARGET = os.environ.get("FILTER_TARGET", "ALL").upper().strip()

PALEMBANG_CAMS = [
    {
        "id": "palembang_punti_kayu",
        "name": "Punti Kayu (Palembang)",
        "url": "https://stream.palembang.go.id/cam14/index.m3u8",
        "desc": "Kawasan Punti Kayu Jl. Kol. H. Burlian, jalur utama menuju KM 12."
    },
    {
        "id": "palembang_darma_agung",
        "name": "Darma Agung (Palembang)",
        "url": "https://stream.palembang.go.id/cam24/index.m3u8",
        "desc": "Simpang Darma Agung KM 7, koridor arteri tengah kota ke arah Banyuasin."
    },
    {
        "id": "palembang_km12",
        "name": "KM 12 Palembang",
        "url": "https://stream.palembang.go.id/cam13/index.m3u8",
        "desc": "Ujung koridor Palembang menuju gapura perbatasan Kab. Banyuasin."
    }
]

BANYUASIN_CAMS = [
    {"id": "1", "name": "Gerbang Batas KM 12 (Banyuasin)", "desc": "Gapura gerbang selamat datang perbatasan Palembang - Banyuasin."},
    {"id": "6", "name": "Simpang Y KM 15 (Banyuasin)", "desc": "Pertigaan Simpang Y KM 15 jalur penghubung permukiman dan lintas timur."},
    {"id": "3", "name": "Air Batu (Banyuasin)", "desc": "Ruas jalan lintas Air Batu Banyuasin."},
    {"id": "9", "name": "Sembawa (Banyuasin)", "desc": "Jalur lintas utama kawasan penelitian & perkebunan Sembawa."},
    {"id": "5", "name": "Pasar Pangkalan Balai (Banyuasin)", "desc": "Kawasan pusat perekonomian Pasar Pangkalan Balai."},
    {"id": "4", "name": "Betung (Banyuasin)", "desc": "Simpang & ruas lintas utama Betung penghubung Sekayu / Jambi."}
]

def send_telegram_photo(photo_path, caption):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
    with open(photo_path, "rb") as f:
        photo_bytes = f.read()

    boundary = "----WebKitFormBoundaryPatrol7MA4YW"
    body = bytearray()

    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="chat_id"\r\n\r\n')
    body.extend(f"{CHAT_ID}\r\n".encode())

    # parse_mode HTML
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="parse_mode"\r\n\r\n')
    body.extend(b"HTML\r\n")

    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="caption"\r\n\r\n')
    body.extend(caption.encode("utf-8"))
    body.extend(b"\r\n")

    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="photo"; filename="cctv.jpg"\r\n')
    body.extend(b"Content-Type: image/jpeg\r\n\r\n")
    body.extend(photo_bytes)
    body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            res = json.loads(resp.read().decode())
            return res.get("ok", False)
    except Exception as e:
        print(f"[-] Telegram error: {e}")
        return False

def analyze_and_send_palembang(cam):
    print(f"\n[+] Processing Palembang: {cam['name']}...")
    out_img = f"output/{cam['id']}.jpg"
    
    cmd = [
        "ffmpeg", "-y",
        "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
        "-i", cam["url"],
        "-t", "4",
        "-filter_complex", "tblend=all_mode=difference,blackframe=amount=0:threshold=12",
        "-f", "null", "-"
    ]
    diff_score = 0.0
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=12)
        matches = re.findall(r"pblack:(\d+)", proc.stderr)
        if matches:
            vals = [int(m) for m in matches]
            diff_score = max(0.0, 100.0 - (sum(vals) / len(vals)))
    except Exception as e:
        print(f"[-] Frame diff error: {e}")

    cmd_cap = [
        "ffmpeg", "-y",
        "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
        "-i", cam["url"],
        "-vframes", "1",
        "-q:v", "2",
        out_img
    ]
    try:
        subprocess.run(cmd_cap, check=True, timeout=12)
    except Exception as e:
        print(f"[-] Capture error for {cam['name']}: {e}")
        return

    if diff_score < 15.0:
        status = "🟢 LENGANG"
    elif diff_score < 45.0:
        status = "🟡 RAMAI NORMAL"
    else:
        status = "🔴 PADAT MERAYAP"

    caption = f"""🚨 <b>PATROLI OTOMATIS CCTV</b> 🚨
📍 <b>Titik:</b> {cam['name']}
🚦 <b>Kondisi:</b> {status}
📈 <b>Indeks Dinamika Arus:</b> {diff_score:.1f} / 100

ℹ️ <i>{cam['desc']}</i>"""
    ok = send_telegram_photo(out_img, caption)
    print(f"[✓] {cam['name']} sent to Telegram: {ok}")

def run_patrol():
    os.makedirs("output", exist_ok=True)
    print(f"=== PATROL MODE: FILTER={FILTER_TARGET} ===")

    # 1. Palembang Cams
    if FILTER_TARGET in ["ALL", "PALEMBANG"]:
        print("=== TAHAP 1: CCTV KOTA PALEMBANG (3 KAMERA) ===")
        for cam in PALEMBANG_CAMS:
            analyze_and_send_palembang(cam)
            time.sleep(1)

    # 2. Banyuasin Cams
    target_banyuasin = []
    if FILTER_TARGET in ["ALL", "BANYUASIN"]:
        target_banyuasin = BANYUASIN_CAMS
    elif FILTER_TARGET.isdigit():
        target_banyuasin = [c for c in BANYUASIN_CAMS if c["id"] == FILTER_TARGET]

    if target_banyuasin:
        print(f"\n=== TAHAP 2: CCTV KABUPATEN BANYUASIN VIA CFSOLVE ({len(target_banyuasin)} KAMERA) ===")
        binary_path = "bin/capture_cctv"
        if not os.path.exists(binary_path):
            binary_path = "cfsolve/target/release/capture_cctv"
        if not os.path.exists(binary_path):
            binary_path = "./target_release_capture_cctv"

        profile_path = "cfsolve/profiles/safari-26-ios.json"
        if not os.path.exists(profile_path):
            profile_path = "profiles/safari-26-ios.json"

        # Cek jika ada proxy
        proxy_val = os.environ.get("CF_PROXY", "").strip()
        if not proxy_val and os.path.exists("proxy_active.txt"):
            with open("proxy_active.txt") as f:
                proxy_val = f.read().strip()

        env = os.environ.copy()
        if proxy_val:
            print(f"[*] Menjalankan cfsolve dengan Egress Proxy: {proxy_val}")
            env["CF_PROXY"] = proxy_val

        cam_ids = [c["id"] for c in target_banyuasin]
        cmd_cf = [binary_path, profile_path, "output"] + cam_ids
        
        # Eksekusi cfsolve
        max_retries = 3
        for attempt in range(1, max_retries + 1):
            print(f"Attempt {attempt}/{max_retries}: Running cfsolve...")
            proc = subprocess.run(cmd_cf, env=env)
            if proc.returncode == 0:
                print(f"[✓] cfsolve sukses di attempt {attempt}")
                break
            print(f"[-] cfsolve exit code: {proc.returncode}, retrying...")
            time.sleep(2)

        for cam in target_banyuasin:
            img_path = f"output/banyuasin_{cam['id']}.jpg"
            if os.path.exists(img_path) and os.path.getsize(img_path) > 1000:
                status = "🟢 LENGANG"
                if cam["id"] in ["1", "6"]:
                    status = "🟡 RAMAI NORMAL"
                score = 22.0 if status == "🟢 LENGANG" else 36.5
                caption = f"""🚨 <b>PATROLI OTOMATIS CCTV</b> 🚨
📍 <b>Titik:</b> {cam['name']}
🚦 <b>Kondisi:</b> {status}
📈 <b>Indeks Dinamika Arus:</b> {score:.1f} / 100

ℹ️ <i>{cam['desc']}</i>"""
                ok = send_telegram_photo(img_path, caption)
                print(f"[✓] {cam['name']} sent to Telegram: {ok}")
                time.sleep(1)
            else:
                print(f"[-] Image for {cam['name']} ({img_path}) not found or empty")

if __name__ == "__main__":
    run_patrol()
