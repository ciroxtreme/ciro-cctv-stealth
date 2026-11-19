"""
traffic.py — DRAFT, belum di-push ke repo.
Modul skor lalu lintas bersama untuk ciro-cctv-stealth.

Masalah yang diperbaiki (temuan patroli 20 Nov 2026, 04:08 WIB):
  1. Banyuasin: skor hardcoded 22.0 / 36.5 di capture_corridor*.py.
     Air Batu konvoi truk tetap "LENGANG 22.0", Simpang Y sepi tetap
     "RAMAI NORMAL 36.5". Tidak ada pengukuran sama sekali.
  2. Palembang: skor frame-diff ffmpeg (100 - rata-rata pblack) dari
     SATU sampel 4 detik. KM 12 kosong total tapi dapat 100.0 PADAT
     MERAYAP — kemungkinan noise malam / flicker stream, bukan macet.

Prinsip baru:
  - Skor dihitung dari ISI FOTO, bukan dari ID kamera.
  - Satu foto -> hitung kendaraan dengan YOLOv8n (COCO).
  - Kalau YOLO / OpenCV tidak tersedia, atau foto terlalu buram,
    hasilnya "TIDAK DINILAI" — JANGAN pernah mengarang skor 22.0/36.5.
  - Palembang: YOLO jadi penilai utama; frame-diff hanya cross-check.
    Kalau diff >= 80 tapi YOLO cuma lihat <= 1 kendaraan, itu sinyal
    noise -> pakai skor YOLO + catat warning di log.

Dependensi baru:
  ultralytics + opencv-python-headless.
  WORKAROUND 2026-11-20: file workflow (.github/workflows/*.yml) TIDAK
  bisa diubah lewat GitHub API Muse — token App-nya tidak punya izin
  "Workflows" (403), dan izin itu tidak bisa ditambah dari menu Settings.
  Jadi dependensi TIDAK diinstal lewat workflow, melainkan di-bootstrap
  sendiri oleh kode ini saat jalan di GitHub Actions (lihat
  ensure_deps() di bawah): kalau ultralytics/cv2 belum ada, pip install
  sendiri sekali per run. Di luar Actions (mis. tes lokal) bootstrap
  ini tidak jalan — di sana hasilnya "TIDAK DINILAI" kalau deps hilang.
  Model yolov8n.pt (~6 MB) diunduh sekali oleh ultralytics.
"""

import os
import subprocess
import sys

# --- Konfigurasi -----------------------------------------------------------
YOLO_MODEL = os.environ.get("TRAFFIC_YOLO_MODEL", "yolov8n.pt")
YOLO_CONF = float(os.environ.get("TRAFFIC_YOLO_CONF", "0.35"))
# Laplacian variance di bawah ini = foto terlalu buram / berkabut.
# Nilai ini tebakan awal — kalibrasi dari foto Pasar P. Balai (1) yang buram.
BLUR_THRESHOLD = float(os.environ.get("TRAFFIC_BLUR_THRESHOLD", "25.0"))

# COCO class id -> bobot. Truk/bus menuhin jalan lebih dari motor.
VEHICLE_WEIGHTS = {
    2: 1.0,   # car
    3: 0.5,   # motorcycle
    5: 1.5,   # bus
    7: 1.5,   # truck
}
VEHICLE_NAMES = {2: "mobil", 3: "motor", 5: "bus", 7: "truk"}

# Titik kalibrasi skor: (jumlah kendaraan berbobot, skor).
# 0 kendaraan -> 5.0 (bukan 0, biar beda dari "gagal ukur").
# 1 truk     -> ~18  Lengang
# 3 truk (bobot 4.5) -> ~58  Ramai Normal  (kasus Air Batu 04:09 tadi)
# 6 kendaraan -> ~72 Padat Merayap
_SCORE_POINTS = [(0, 5.0), (1, 18.0), (2, 30.0), (3, 45.0),
                 (4, 54.0), (6, 72.0), (8, 85.0), (10, 96.0)]


_DEPS_TRIED = False


def ensure_deps():
    """Install ultralytics + opencv kalau belum ada — HANYA di GitHub Actions.

    Dipanggil sekali sebelum YOLO pertama dipakai. Kalau pip install gagal
    (mis. timeout), jangan crash: kembalikan False dan pemanggil akan
    menghasilkan TIDAK DINILAI seperti biasa.
    """
    global _DEPS_TRIED
    if _DEPS_TRIED:
        return False
    _DEPS_TRIED = True
    if os.environ.get("GITHUB_ACTIONS") != "true":
        return False
    try:
        import ultralytics  # noqa: F401
        import cv2  # noqa: F401
        return True
    except ImportError:
        pass
    print("[*] traffic: dependensi YOLO belum ada, pip install...")
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--quiet",
             "ultralytics", "opencv-python-headless"],
            check=True, timeout=300)
        print("[✓] traffic: pip install selesai")
        return True
    except Exception as e:
        print(f"[-] traffic: pip install gagal: {e}")
        return False


def status_from_score(score):
    """Threshold baru. Dulu: <15 lengang, <45 ramai. Sekarang skor
    sudah berbasis jumlah kendaraan, jadi batasnya digeser."""
    if score is None:
        return "⚪ TIDAK DINILAI"
    if score < 25.0:
        return "🟢 LENGANG"
    if score < 60.0:
        return "🟡 RAMAI NORMAL"
    return "🔴 PADAT MERAYAP"


def score_from_weighted_count(weighted, occupancy=0.0):
    """Interpolasi linear antar titik kalibrasi, + bonus okupansi.

    occupancy = total luas bounding box kendaraan / luas frame (0..1).
    Kalau kendaraan menutup >15% frame, tambah sampai +10 poin.
    """
    pts = _SCORE_POINTS
    if weighted <= pts[0][0]:
        score = pts[0][1]
    elif weighted >= pts[-1][0]:
        score = pts[-1][1]
    else:
        score = pts[-1][1]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            if x0 <= weighted <= x1:
                score = y0 + (y1 - y0) * (weighted - x0) / (x1 - x0)
                break
    bonus = max(0.0, min(10.0, (occupancy - 0.15) * 50.0))
    return round(min(100.0, score + bonus), 1)


def check_blur(image_path):
    """Return (is_blurry, variance) atau (None, None) kalau cv2 tidak ada.

    Dipakai untuk kasus Pasar P. Balai (1) 04:09:35 — foto berkabut/silau,
    kendaraan tidak bisa dihitung. Lebih jujur bilang tidak dinilai.
    """
    try:
        import cv2
    except ImportError:
        ensure_deps()
        try:
            import cv2
        except ImportError:
            return None, None
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None, None
    var = float(cv2.Laplacian(img, cv2.CV_64F).var())
    return var < BLUR_THRESHOLD, round(var, 1)


def count_vehicles(image_path):
    """Hitung kendaraan dengan YOLOv8n.

    Return dict: {weighted, count, by_type, occupancy, model}
    Raise RuntimeError kalau ultralytics / model tidak bisa dimuat —
    pemanggil HARUS mengubahnya jadi TIDAK DINILAI, bukan skor palsu.
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        ensure_deps()
        try:
            from ultralytics import YOLO
        except ImportError as e:
            raise RuntimeError(f"ultralytics tidak terinstal: {e}")
    model = YOLO(YOLO_MODEL)  # unduh otomatis sekali, lalu cache
    results = model.predict(image_path, conf=YOLO_CONF, verbose=False)
    if not results:
        return {"weighted": 0.0, "count": 0, "by_type": {}, "occupancy": 0.0}

    boxes = results[0].boxes
    weighted = 0.0
    by_type = {}
    area = 0.0
    img_h, img_w = results[0].orig_shape
    frame_area = float(img_h * img_w) or 1.0
    for box in boxes:
        cls = int(box.cls[0])
        if cls not in VEHICLE_WEIGHTS:
            continue
        w = VEHICLE_WEIGHTS[cls]
        weighted += w
        name = VEHICLE_NAMES[cls]
        by_type[name] = by_type.get(name, 0) + 1
        x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
        area += max(0.0, x2 - x1) * max(0.0, y2 - y1)
    return {
        "weighted": round(weighted, 1),
        "count": sum(by_type.values()),
        "by_type": by_type,
        "occupancy": round(area / frame_area, 3),
    }


def analyze_snapshot(image_path):
    """Penilai utama untuk SATU foto (dipakai Banyuasin + Palembang).

    Return dict yang selalu punya kunci: score (float|None),
    status, method, detail (string buat log), vehicles.
    score=None artinya TIDAK DINILAI — caption harus menampilkan itu,
    bukan angka karangan.
    """
    if not image_path or not os.path.exists(image_path):
        return {"score": None, "status": "⚪ TIDAK DINILAI",
                "method": "missing-file", "detail": "file tidak ada",
                "vehicles": {}}
    if os.path.getsize(image_path) <= 1000:
        return {"score": None, "status": "⚪ TIDAK DINILAI",
                "method": "empty-file", "detail": "file <= 1000 byte",
                "vehicles": {}}

    blurry, var = check_blur(image_path)
    if blurry:
        return {"score": None, "status": "⚪ TIDAK DINILAI",
                "method": "blurry",
                "detail": f"foto terlalu buram/berkabut (laplacian var={var})",
                "vehicles": {}}

    try:
        v = count_vehicles(image_path)
    except Exception as e:
        return {"score": None, "status": "⚪ TIDAK DINILAI",
                "method": "yolo-error", "detail": str(e)[:200],
                "vehicles": {}}

    score = score_from_weighted_count(v["weighted"], v["occupancy"])
    return {"score": score, "status": status_from_score(score),
            "method": "yolo-yolov8n",
            "detail": (f"{v['count']} kendaraan (bobot {v['weighted']}), "
                       f"{v['by_type']}, okupansi {v['occupancy']:.0%}, "
                       f"blur var={var}"),
            "vehicles": v["by_type"]}


def reconcile_with_motion(yolo_result, diff_score):
    """Palembang: bandingkan skor YOLO vs frame-diff ffmpeg.

    Kalau diff >= 80 tapi YOLO <= 1 kendaraan berbobot -> hampir pasti
    noise malam (kasus KM 12 = 100.0 padahal jalan kosong). Pakai YOLO,
    catat warning. Kalau tidak ada YOLO (score None), pakai diff apa
    adanya tapi tetap dilog mentahnya.
    """
    if yolo_result.get("score") is not None:
        if diff_score is not None and diff_score >= 80.0 \
                and yolo_result["vehicles"] and \
                sum(yolo_result["vehicles"].values()) <= 1:
            print(f"[!] diff {diff_score:.1f} vs YOLO "
                  f"{yolo_result['score']}: kemungkinan noise, pakai YOLO")
            yolo_result["detail"] += f" | diff ffmpeg {diff_score:.1f} diabaikan (noise?)"
            return yolo_result
        return yolo_result
    # Fallback kalau YOLO gagal: diff median (lihat capture_corridor.py),
    # tapi skornya ditandai sebagai estimasi gerak, bukan hitungan kendaraan.
    if diff_score is None:
        return {"score": None, "status": "⚪ TIDAK DINILAI",
                "method": "motion-fallback-failed", "detail": "YOLO + diff gagal",
                "vehicles": {}}
    return {"score": round(diff_score, 1),
            "status": status_from_score(diff_score),
            "method": "motion-fallback",
            "detail": f"YOLO gagal, fallback frame-diff median {diff_score:.1f}",
            "vehicles": {}}
