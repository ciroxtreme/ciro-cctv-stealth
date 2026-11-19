"""capture_corridor_ci.py — DRAFT REVISI (belum di-push).

DULU: file ini duplikat ~217 baris dari capture_corridor.py, dengan
daftar Banyuasin 11 kamera (id 1,2,6,11,3,10,9,5,12,4,13) dan
hardcoded yang sama: id 1,2,6,11 -> 36.5, sisanya -> 22.0.
Dua file yang diduplikat = dua tempat bug bisa beda versi.

SEKARANG: file ini jadi wrapper tipis. Semua logika tinggal di
capture_corridor.py + traffic.py. Yang CI tambahkan cuma daftar
kamera Banyuasin lengkap (11 titik, 2 sudut per titik) — itu data,
bukan logika skor.

Cara pakai di workflow (cctv_corridor_patrol.yml) tetap sama:
  python3 capture_corridor_ci.py
"""
import capture_corridor as cc

# Daftar lengkap Banyuasin di CI: 11 file gambar (6 titik, beberapa
# titik punya 2 sudut kamera). ID ini harus cocok dengan yang dipakai
# binary cfsolve (output/banyuasin_<id>.jpg).
cc.BANYUASIN_CAMS = [
    {"id": "1", "name": "Gerbang KM-12 (Kamera 1)", "desc": "Gapura batas perbatasan Palembang - Banyuasin KM 12."},
    {"id": "2", "name": "Gerbang KM-12 2 (Kamera 2)", "desc": "Gapura batas perbatasan Palembang - Banyuasin KM 12 (Sudut 2)."},
    {"id": "6", "name": "Simpang Y KM 15 1 (Kamera 1)", "desc": "Pertigaan Simpang Y KM 15 jalur penghubung permukiman dan lintas timur."},
    {"id": "11", "name": "Simpang Y KM 15 2 (Kamera 2)", "desc": "Pertigaan Simpang Y KM 15 jalur penghubung permukiman dan lintas timur (Sudut 2)."},
    {"id": "3", "name": "Air Batu (Kamera 1)", "desc": "Ruas jalan lintas Air Batu Banyuasin."},
    {"id": "10", "name": "Air Batu 2 (Kamera 2)", "desc": "Ruas jalan lintas Air Batu Banyuasin (Sudut 2)."},
    {"id": "9", "name": "Sembawa", "desc": "Jalur lintas utama kawasan penelitian & perkebunan Sembawa."},
    {"id": "5", "name": "Pasar P.Balai (Kamera 1)", "desc": "Kawasan pusat perekonomian Pasar Pangkalan Balai."},
    {"id": "12", "name": "Pasar P.Balai 2 (Kamera 2)", "desc": "Kawasan pusat perekonomian Pasar Pangkalan Balai (Sudut 2)."},
    {"id": "4", "name": "Betung (Kamera 1)", "desc": "Simpang & ruas lintas utama Betung penghubung Sekayu / Jambi."},
    {"id": "13", "name": "Betung 2 (Kamera 2)", "desc": "Simpang & ruas lintas utama Betung penghubung Sekayu / Jambi (Sudut 2)."},
]

if __name__ == "__main__":
    cc.run_patrol()
