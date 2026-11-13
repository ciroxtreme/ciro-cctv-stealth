import urllib.request
import concurrent.futures
import re
import os

def find_working_proxy():
    print("[*] Mengambil daftar proxy publik...")
    urls = [
        "https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&protocol=http&proxy_format=ipport&format=text",
        "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt",
        "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt"
    ]
    candidates = []
    for u in urls:
        try:
            req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as r:
                lines = r.read().decode('utf-8', errors='ignore').splitlines()
                for line in lines:
                    line = line.strip()
                    if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5}$", line):
                        candidates.append(line)
        except Exception:
            pass

    print(f"[*] Total calon proxy: {len(candidates)}")

    def test_p(p):
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({'http': f"http://{p}", 'https': f"http://{p}"}))
        try:
            with opener.open("https://api.ipify.org", timeout=4) as resp:
                if resp.status == 200:
                    return f"http://{p}"
        except Exception:
            return None

    # Cari 5 proxy aktif pertama
    with concurrent.futures.ThreadPoolExecutor(max_workers=40) as ex:
        for res in ex.map(test_p, candidates[:120]):
            if res:
                print(f"[✓] Proxy hidup ditemukan: {res}")
                return res
    return None

if __name__ == "__main__":
    p = find_working_proxy()
    if p:
        with open("proxy_active.txt", "w") as f:
            f.write(p)
        print(f"SAVED: {p}")
