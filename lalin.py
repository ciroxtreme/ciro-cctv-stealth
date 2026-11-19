"""lalin.py — Deteksi kemacetan Sungai Lilin -> Palembang dari tile traffic Google.

Cara kerja (tanpa API key, tanpa kartu kredit):
  Google Maps web mengambil warna macet dari tile gambar biasa
  (256x256 px per x/y/z). Modul ini mengunduh tile-tile di sepanjang
  rute, membaca warna pixel tepat di atas jalan, lalu mengklasifikasi:
    hijau       -> lancar
    kuning      -> macet ringan
    oranye      -> macet ringan (lebih padat dari kuning)
    merah       -> macet sedang
    merah gelap -> macet parah
  Warna lain (aspal abu-abu, sawah, sungai, label) diabaikan.

  Kalibrasi warna dari tile asli Palembang 2026-11-20:
    hijau traffic  = (22, 224, 152)  -- beda dari hijau sawah (211,248,226)
    merah traffic  = (235, 27, 27)
  Kuning/oranye/merah-gelap belum terlihat di tile kalibrasi (pagi buta
  jalannya sepi) jadi ambang batasnya tebakan dari palet standar Google;
  lihat classify_pixel() dan LEVEL_RULES di bawah.

Dependensi: STDLIB SAJA (urllib + zlib + struct). Tile PNG di-decode
sendiri karena runner GitHub Actions tidak punya PIL — dan memang
tidak boleh pip install apa-apa lagi di mode cepat (lihat traffic.py:
YOLO dimatikan 2026-11-20 supaya patroli cepat).

Dipakai oleh capture_corridor.run_patrol(): SETELAH semua foto
terkirim ke Telegram, satu pesan teks ringkasan dikirim di bawahnya.

Env:
  LALIN_ENABLED=0  -> matikan deteksi (default 1, nyala)
  LALIN_ZOOM       -> zoom tile (default 14)
"""

import math
import os
import struct
import urllib.request
import zlib
from concurrent.futures import ThreadPoolExecutor

LALIN_ENABLED = os.environ.get("LALIN_ENABLED", "1") != "0"
ZOOM = int(os.environ.get("LALIN_ZOOM", "14"))

# Nomor versi style Google — kalau suatu hari tile blank, kemungkinan
# besar angka ini berubah. Cek tile terbaru di browser dan update.
TILE_URL = "https://mt{sub}.google.com/vt/lyrs=m@221097413,traffic&x={x}&y={y}&z={z}"

# Ruas jalan Sungai Lilin -> Palembang (barat -> timur), Jl. Lintas Timur.
# Koordinat kota dari geocode 2026-11-20; titik tengah Gerbang KM 12
# interpolasi di koridor (sampel yang meleset dari jalan diabaikan).
SEGMENTS = [
    ("Jl. Lintas Timur (Sungai Lilin - Betung)",
     (-2.51016, 104.02861), (-2.84538, 104.22034)),
    ("Jl. Lintas Timur (Betung - Pangkalan Balai)",
     (-2.84538, 104.22034), (-2.8986, 104.40829)),
    ("Jl. Lintas Timur (Pangkalan Balai - Gerbang KM 12)",
     (-2.8986, 104.40829), (-2.96000, 104.60000)),
    ("Jl. Lintas Timur (Gerbang KM 12 - Palembang)",
     (-2.96000, 104.60000), (-2.98475, 104.75158)),
]

LEVELS = [
    ("lancar", "🟢"),
    ("macet ringan", "🟡"),
    ("macet sedang", "🟠"),
    ("macet parah", "🔴"),
    ("tidak ada data", "⚪"),
]


# --- PNG decoder (stdlib) ---------------------------------------------------
def _paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def decode_png(data):
    """Return (width, height, rgb_bytes) untuk PNG 8-bit.

    Mendukung color type 0 (gray), 2 (RGB), 3 (palette), 4 (gray+alpha),
    6 (RGBA). Tile Google yang dicek: type 3 (colormap) dan type 6.
    """
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("bukan PNG")
    pos = 8
    width = height = 0
    bitdepth = colortype = None
    palette = None
    idat = bytearray()
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        ctype = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        if ctype == b"IHDR":
            width, height, bitdepth, colortype = struct.unpack(">IIBB", chunk[:10])
            if bitdepth != 8:
                raise ValueError(f"bitdepth {bitdepth} tidak didukung")
        elif ctype == b"PLTE":
            palette = chunk
        elif ctype == b"IDAT":
            idat += chunk
        elif ctype == b"IEND":
            break
        pos += 12 + length
    if colortype == 0:
        channels, bpp = 1, 1
    elif colortype == 2:
        channels, bpp = 3, 3
    elif colortype == 3:
        channels, bpp = 1, 1
    elif colortype == 4:
        channels, bpp = 2, 2
    elif colortype == 6:
        channels, bpp = 4, 4
    else:
        raise ValueError(f"color type {colortype} tidak didukung")
    raw = zlib.decompress(bytes(idat))
    stride = width * bpp
    out = bytearray(width * height * 3)
    prev = bytearray(stride)
    p = 0
    for y in range(height):
        f = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        for i in range(len(line)):
            a = line[i - bpp] if i >= bpp else 0
            b = prev[i]
            c = prev[i - bpp] if i >= bpp else 0
            if f == 1:
                line[i] = (line[i] + a) & 0xFF
            elif f == 2:
                line[i] = (line[i] + b) & 0xFF
            elif f == 3:
                line[i] = (line[i] + (a + b) // 2) & 0xFF
            elif f == 4:
                line[i] = (line[i] + _paeth(a, b, c)) & 0xFF
            elif f != 0:
                raise ValueError(f"filter {f} tidak didukung")
        for x in range(width):
            o = (y * width + x) * 3
            px = line[x * bpp:(x + 1) * bpp]
            if colortype == 3:
                idx = px[0] * 3
                out[o:o + 3] = palette[idx:idx + 3]
            elif colortype == 2:
                out[o:o + 3] = px[0:3]
            elif colortype == 6:
                out[o:o + 3] = px[0:3]
            elif colortype == 0:
                out[o] = out[o + 1] = out[o + 2] = px[0]
            elif colortype == 4:
                out[o] = out[o + 1] = out[o + 2] = px[0]
        prev = line
    return width, height, bytes(out)


# --- Tile -------------------------------------------------------------------
def _fetch_tile(tx, ty, z):
    url = TILE_URL.format(sub=(tx + ty) % 4, x=tx, y=ty, z=z)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return decode_png(r.read())


def latlon_to_global_px(lat, lon, z):
    n = 2.0 ** z
    gx = (lon + 180.0) / 360.0 * n * 256.0
    s = math.sin(math.radians(lat))
    gy = (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n * 256.0
    return gx, gy


def _haversine_m(a, b):
    r = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dphi = math.radians(b[0] - a[0])
    dlmb = math.radians(b[1] - a[1])
    h = (math.sin(dphi / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2)
    return 2 * r * math.asin(math.sqrt(h))


def classify_pixel(r, g, b):
    """Warna pixel -> kategori traffic, atau None kalau bukan jalan macet.

    Hijau sawah/lapangan (211,248,226) lolos dari rule hijau karena R-nya
    tinggi; air (144,218,238) juga lolos. Yang kehitung hanya warna
    traffic yang pekat.
    """
    if g >= 180 and r < 120 and 80 <= b < 220 and g > r + 60:
        return "green"
    if r >= 200 and g >= 170 and b < 120:
        return "yellow"
    if r >= 220 and 90 <= g < 170 and b < 100:
        return "orange"
    if r >= 200 and g < 90 and b < 90:
        return "red"
    if 100 <= r < 200 and g < 70 and b < 70:
        return "darkred"
    return None


def _nearest_classified(rgb, w, h, px, py, max_r=3):
    """Pixel traffic terdekat dari titik sampel (radius max 3 px ~ 30 m).

    Garis jalan di tile cuma selebar beberapa pixel dan polyline OSRM
    bisa meleset sedikit — jadi cari dulu di titik persisnya, lalu
    melingkar ke luar sampai ketemu pixel traffic. Satu titik sampel
    = satu suara, supaya label jalan (teks oranye/merah) di dekat jalan
    tidak membanjiri hitungan.
    """
    for r in range(max_r + 1):
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                if max(abs(dx), abs(dy)) != r:
                    continue
                x, y = px + dx, py + dy
                if not (0 <= x < w and 0 <= y < h):
                    continue
                o = (y * w + x) * 3
                cat = classify_pixel(rgb[o], rgb[o + 1], rgb[o + 2])
                if cat:
                    return cat
    return None


def level_from_counts(counts):
    """counts: dict kategori -> jumlah pixel. Return (label, emoji)."""
    total = sum(counts.values())
    if total < 5:
        return LEVELS[4]
    frac = {k: v / total for k, v in counts.items()}
    dark = frac.get("darkred", 0.0)
    red = frac.get("red", 0.0)
    org = frac.get("orange", 0.0)
    yel = frac.get("yellow", 0.0)
    if dark >= 0.08 or (red + dark) >= 0.35:
        return LEVELS[3]
    if red >= 0.08 or org >= 0.25:
        return LEVELS[2]
    if org >= 0.08 or yel >= 0.08:
        return LEVELS[1]
    return LEVELS[0]


def _route_geometry(a, b):
    """Geometri jalan asli a->b dari OSRM (gratis, tanpa key).

    Garis lurus antar kota TIDAK bisa dipakai — jalan Lintas Timur
    berbelok-belok dan garis lurus malah motong sawah/sungai, sehingga
    sampelnya tidak kena jalan sama sekali (hasil tes 2026-11-20:
    0-1 pixel traffic per ruas). Kalau OSRM gagal, fallback ke garis
    lurus supaya tetap jalan, walau kurang akurat.
    Return list [(lat, lon), ...].
    """
    import json
    url = ("https://router.project-osrm.org/route/v1/driving/"
           f"{a[1]},{a[0]};{b[1]},{b[0]}"
           "?overview=full&geometries=geojson")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.load(r)
        coords = d["routes"][0]["geometry"]["coordinates"]
        pts = [(lat, lon) for lon, lat in coords]
        print(f"[*] lalin: OSRM {a} -> {b}: {len(pts)} titik, "
              f"{d['routes'][0]['distance'] / 1000:.1f} km")
        return pts
    except Exception as e:
        print(f"[-] lalin: OSRM gagal ({e}), pakai garis lurus")
        return _sample_points(a, b)


def _points_along(pts, step_m=300.0):
    """Titik tiap ~step_m meter di sepanjang polyline pts."""
    if len(pts) < 2:
        return pts
    out = [pts[0]]
    acc = 0.0
    for a, b in zip(pts, pts[1:]):
        d = _haversine_m(a, b)
        acc += d
        if acc >= step_m:
            out.append(b)
            acc = 0.0
    if out[-1] != pts[-1]:
        out.append(pts[-1])
    return out


def check_route():
    """Cek semua ruas. Return list [(nama_ruas, label, emoji, counts)]."""
    if not LALIN_ENABLED:
        return []
    # Kumpulkan tile unik yang dibutuhkan semua ruas.
    needed = {}
    seg_pixels = []
    for name, a, b in SEGMENTS:
        pts = _points_along(_route_geometry(a, b))
        sp = []
        for lat, lon in pts:
            gx, gy = latlon_to_global_px(lat, lon, ZOOM)
            tx, ty = int(gx // 256), int(gy // 256)
            px, py = int(gx % 256), int(gy % 256)
            needed[(tx, ty)] = True
            sp.append((tx, ty, px, py))
        seg_pixels.append((name, sp))

    tiles = {}

    def _load(key):
        tx, ty = key
        try:
            tiles[key] = _fetch_tile(tx, ty, ZOOM)
        except Exception as e:
            print(f"[-] lalin: tile {tx},{ty} gagal: {e}")

    with ThreadPoolExecutor(max_workers=8) as ex:
        list(ex.map(_load, list(needed.keys())))

    results = []
    for name, pts in seg_pixels:
        counts = {}
        for tx, ty, px, py in pts:
            t = tiles.get((tx, ty))
            if t is None:
                continue
            w, h, rgb = t
            if not (0 <= px < w and 0 <= py < h):
                continue
            cat = _nearest_classified(rgb, w, h, px, py)
            if cat:
                counts[cat] = counts.get(cat, 0) + 1
        label, emoji = level_from_counts(counts)
        print(f"[*] lalin {name}: {counts} -> {label}")
        results.append((name, label, emoji, counts))
    return results


def build_lalin_message():
    """Pesan Telegram: satu daftar macet per ruas, di bawah foto patroli."""
    try:
        results = check_route()
    except Exception as e:
        print(f"[-] lalin gagal total: {e}")
        return None
    if not results:
        return None
    lines = ["🚦 <b>LALIN: SUNGAI LILIN → PALEMBANG</b>", ""]
    for i, (name, label, emoji, _counts) in enumerate(results, 1):
        lines.append(f"{emoji} {i}. {name}: <b>{label}</b>")
    lines.append("")
    lines.append("ℹ️ <i>Dari warna traffic Google Maps — hijau lancar,"
                 " kuning/oranye ringan, merah sedang, merah gelap parah."
                 " Cek foto CCTV di atas buat bukti visualnya.</i>")
    return "\n".join(lines)
