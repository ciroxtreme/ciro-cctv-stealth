"""test_traffic.py — DRAFT. Unit test logika skor (tanpa YOLO, tanpa foto).
Jalankan:  python3 -m pytest test_traffic.py -v
        atau python3 test_traffic.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from traffic import score_from_weighted_count, status_from_score, reconcile_with_motion


def test_kasus_patroli_04_08():
    # 0 kendaraan (Punti Kayu, Sembawa) -> lengang, skor kecil
    assert score_from_weighted_count(0) == 5.0
    assert status_from_score(5.0) == "🟢 LENGANG"
    # 1 truk (Darma Agung, Betung) -> lengang
    assert status_from_score(score_from_weighted_count(1.0)) == "🟢 LENGANG"
    # 3 truk (Air Batu, bobot 1.5 x 3 = 4.5) -> ramai, BUKAN lengang 22.0
    s = score_from_weighted_count(4.5)
    assert 45.0 <= s <= 65.0, s
    assert status_from_score(s) == "🟡 RAMAI NORMAL"
    # 8 kendaraan -> padat
    assert status_from_score(score_from_weighted_count(8)) == "🔴 PADAT MERAYAP"
    # Skor tidak pernah > 100
    assert score_from_weighted_count(99) <= 100.0


def test_km12_noise_ditolak():
    # KM 12: diff 100.0 tapi YOLO cuma 1 kendaraan -> pakai YOLO
    yolo = {"score": 18.0, "status": "🟢 LENGANG", "vehicles": {"truk": 1},
            "detail": "1 kendaraan", "method": "yolo-yolov8n"}
    out = reconcile_with_motion(yolo, 100.0)
    assert out["score"] == 18.0
    assert "noise" in out["detail"]


def test_yolo_gagal_jujur():
    # YOLO gagal + diff gagal -> TIDAK DINILAI, bukan skor karangan
    out = reconcile_with_motion({"score": None, "vehicles": {}}, None)
    assert out["score"] is None
    assert out["status"] == "⚪ TIDAK DINILAI"


if __name__ == "__main__":
    test_kasus_patroli_04_08()
    test_km12_noise_ditolak()
    test_yolo_gagal_jujur()
    print("semua test logika skor lolos ✓")
    # Contoh tabel skor buat review:
    for w in [0, 1, 1.5, 2, 3, 4.5, 6, 8, 10]:
        s = score_from_weighted_count(w)
        print(f"  bobot {w:>4} -> {s:>5}  {status_from_score(s)}")
