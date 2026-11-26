"""capture_corridor.py — DRAFT REVISI (belum di-push).
Perubahan vs versi main saat ini:
  - Banyuasin: HAPUS hardcoded 22.0 / 36.5. Skor dari traffic.analyze_snapshot()
    (YOLO hitung kendaraan). Kalau tidak bisa dinilai -> "TIDAK DINILAI".
  - Palembang: frame-diff diambil 3x lalu median (bukan 1x 4 detik),
    lalu di-cross-check dengan YOLO di foto hasil capture. Kalau diff
    >= 80 tapi YOLO cuma <= 1 kendaraan -> pakai YOLO (kasus KM 12).
  - Threshold status pindah ke traffic.status_from_score() (<25 / <60).
  - Log mentah (diff, YOLO, blur) dicetak tiap kamera biar bisa diaudit.
  - CHAT_ID default dihapus dari kode; wajib dari env / secrets.
"""
import subprocess
import os
import time
import json
import urllib.request
import re
import statistics

from traffic import analyze_snapshot, reconcile_with_motion, YOLO_ENABLED

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
CHAT_ID = os.environ.get("CHAT_ID", "")
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
        url, data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            res = json.loads(resp.read().decode())
            return res.get("ok", False)
    except Exception as e:
        print(f"[-] Telegram error: {e}")
        return False


def send_telegram_text(text):
    """Kirim satu pesan teks (dipakai ringkasan lalin di akhir patroli)."""
    import urllib.parse
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    data = urllib.parse.urlencode(
        {"chat_id": CHAT_ID, "text": text, "parse_mode": "HTML"}).encode()
    try:
        with urllib.request.urlopen(url, data=data, timeout=20) as resp:
            res = json.loads(resp.read().decode())
            return res.get("ok", False)
    except Exception as e:
        print(f"[-] Telegram text error: {e}")
        return False


def _one_diff_sample(cam):
    """Satu sampel frame-diff 4 detik. Return skor 0..100 atau None."""
    cmd = [
        "ffmpeg", "-y",
        "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
        "-i", cam["url"],
        "-t", "4",
        "-filter_complex", "tblend=all_mode=difference,blackframe=amount=0:threshold=12",
        "-f", "null", "-"
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=12)
        matches = re.findall(r"pblack:(\d+)", proc.stderr)
        if matches:
            vals = [int(m) for m in matches]
            return max(0.0, 100.0 - (sum(vals) / len(vals)))
    except Exception as e:
        print(f"[-] Frame diff error: {e}")
    return None


def _median_diff(cam, samples=3):
    """Median dari N sampel — satu sampel noise tidak lagi menentukan hasil."""
    vals = []
    for _ in range(samples):
        v = _one_diff_sample(cam)
        if v is not None:
            vals.append(v)
        time.sleep(1)
    if not vals:
        return None
    med = statistics.median(vals)
    print(f"[*] {cam['name']} diff samples={vals} median={med:.1f}")
    return med


def _caption(cam, result):
    # 2026-11-20 atas permintaan Ciro: caption HANYA titik lokasi.
    # Status/skor/deskripsi/detail dihapus — yang menilai ya yang lihat foto.
    return f"📍 <b>Titik:</b> {cam['name']}"


def analyze_and_send_palembang(cam):
    print(f"\n[+] Processing Palembang: {cam['name']}...")
    out_img = f"output/{cam['id']}.jpg"

    # MODE CEPAT (YOLO dimatikan 2026-11-20): skip frame-diff juga.
    # Diff tanpa cross-check YOLO itu yang dulu bikin KM 12 kosong
    # dapat 100.0 PADAT — dan 3x sampel 4 detik cuma buang waktu.
    # Langsung capture foto -> kirim. Yang menilai ya yang lihat foto.
    diff_score = _median_diff(cam, samples=3) if YOLO_ENABLED else None

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

    # Penilai utama = YOLO di foto; diff hanya cross-check (KM 12 fix).
    # MODE CEPAT: YOLO mati -> analyze_snapshot kembalikan yolo-disabled
    # (TIDAK DINILAI), reconcile teruskan apa adanya, foto tetap terkirim.
    yolo = analyze_snapshot(out_img)
    result = reconcile_with_motion(yolo, diff_score)
    print(f"[*] {cam['name']}: {result}")

    ok = send_telegram_photo(out_img, _caption(cam, result))
    print(f"[✓] {cam['name']} sent to Telegram: {ok}")


def _patrol_once():
    os.makedirs("output", exist_ok=True)
    print(f"=== PATROL MODE: FILTER={FILTER_TARGET} ===")

    if FILTER_TARGET in ["ALL", "PALEMBANG"]:
        print("=== TAHAP 1: CCTV KOTA PALEMBANG (3 KAMERA) ===")
        for cam in PALEMBANG_CAMS:
            analyze_and_send_palembang(cam)
            time.sleep(1)

    target_banyuasin = []
    if FILTER_TARGET in ["ALL", "BANYUASIN"]:
        target_banyuasin = BANYUASIN_CAMS
    elif FILTER_TARGET.isdigit():
        target_banyuasin = [c for c in BANYUASIN_CAMS if c["id"] == FILTER_TARGET]

    if target_banyuasin:
        print(f"\n=== TAHAP 2: CCTV KABUPATEN BANYUASIN VIA CAMOUFOX STEALTH ENGINE ({len(target_banyuasin)} KAMERA) ===")
        cam_ids = [c["id"] for c in target_banyuasin]
        banyuasin_ok = False

        # Prioritas 1: Gunakan Camoufox Stealth Browser Engine (Byparr/Turnstile Auto-Solver)
        if os.path.exists("capture_banyuasin_camoufox.py"):
            print("[*] Menjalankan Camoufox Stealth Engine untuk bypass Turnstile Banyuasin...")
            cmd_camou = [sys.executable, "capture_banyuasin_camoufox.py"] + cam_ids
            try:
                proc_c = subprocess.run(cmd_camou, timeout=300)
                if proc_c.returncode == 0:
                    print("[✓] Camoufox sukses mengambil snapshot kamera Banyuasin!")
                    banyuasin_ok = True
                else:
                    print(f"[-] Camoufox exit code: {proc_c.returncode}, beralih ke fallback cfsolve...")
            except Exception as ec:
                print(f"[-] Error menjalankan Camoufox: {ec}")

        # Prioritas 2 (Fallback): Gunakan binary cfsolve jika Camoufox tidak tersedia / gagal
        if not banyuasin_ok:
            binary_path = None
            for candidate in ("bin/capture_cctv",
                              "cfsolve/target/release/capture_cctv",
                              "./target_release_capture_cctv"):
                if os.path.exists(candidate):
                    binary_path = candidate
                    break

            if binary_path is not None:
                profile_path = "cfsolve/profiles/safari-26-ios.json"
                if not os.path.exists(profile_path):
                    profile_path = "profiles/safari-26-ios.json"

                proxy_val = os.environ.get("CF_PROXY", "").strip()
                if not proxy_val and os.path.exists("proxy_active.txt"):
                    with open("proxy_active.txt") as f:
                        proxy_val = f.read().strip()

                env = os.environ.copy()
                if proxy_val:
                    env["CF_PROXY"] = proxy_val

                cmd_cf = [binary_path, profile_path, "output"] + cam_ids
                for attempt in range(1, 4):
                    print(f"Attempt {attempt}/3: Running cfsolve ({binary_path})...")
                    try:
                        proc = subprocess.run(cmd_cf, env=env)
                        if proc.returncode == 0:
                            print(f"[✓] cfsolve sukses di attempt {attempt}")
                            banyuasin_ok = True
                            break
                    except Exception as e:
                        print(f"[-] cfsolve execution error: {e}")
                        break
                    time.sleep(2)

        if not banyuasin_ok:
            print("[-] Seluruh engine bypass gagal, Tahap 2 dilewati.")
            return

        for cam in target_banyuasin:
            img_path = f"output/banyuasin_{cam['id']}.jpg"
            # DULU: status/score ditentukan dari ID kamera (22.0 / 36.5).
            # SEKARANG: dihitung dari isi foto. Kalau gagal -> TIDAK DINILAI.
            result = analyze_snapshot(img_path)
            print(f"[*] {cam['name']}: {result}")
            if not os.path.exists(img_path) or os.path.getsize(img_path) <= 1000:
                print(f"[-] Image for {cam['name']} ({img_path}) not found or empty")
                continue
            ok = send_telegram_photo(img_path, _caption(cam, result))
            print(f"[✓] {cam['name']} sent to Telegram: {ok}")
            time.sleep(1)


def run_patrol():
    """Patroli lengkap + 1 pesan ringkasan lalin di bawah semua foto.

    Ringkasan lalin (lalin.py) JANGAN PERNAH menggagalkan patroli:
    kalau deteksinya error / tidak ada data, patroli tetap sukses
    terkirim, cuma pesannya yang tidak muncul.
    """
    _patrol_once()
    try:
        from lalin import build_lalin_message
        msg = build_lalin_message()
        if msg and BOT_TOKEN and CHAT_ID:
            ok = send_telegram_text(msg)
            print(f"[✓] lalin summary sent to Telegram: {ok}")
        elif msg:
            print("[-] lalin: BOT_TOKEN/CHAT_ID kosong, pesan tidak dikirim")
            print(msg)
    except Exception as e:
        print(f"[-] lalin gagal (patroli tetap terkirim): {e}")


if __name__ == "__main__":
    run_patrol()
