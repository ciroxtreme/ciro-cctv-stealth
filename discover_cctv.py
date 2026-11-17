import urllib.request
import json
import re
import sys

def main():
    print("[1] Mengambil halaman utama cctv.banyuasinkab.go.id...")
    req = urllib.request.Request("https://cctv.banyuasinkab.go.id/")
    req.add_header("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"Error fetching home: {e}")
        return

    m = re.search(r'csrf-token" content="([^"]+)', html)
    csrf = m.group(1) if m else ""
    print(f"[2] CSRF Token: {csrf}")

    # Request /employee/search
    data = urllib.parse.urlencode({'_token': csrf, 'keyword': ''}).encode()
    search_req = urllib.request.Request("https://cctv.banyuasinkab.go.id/employee/search", data=data)
    search_req.add_header("Referer", "https://cctv.banyuasinkab.go.id/")
    search_req.add_header("X-CSRF-TOKEN", csrf)
    search_req.add_header("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")
    
    try:
        with urllib.request.urlopen(search_req, timeout=15) as resp:
            res_json = json.loads(resp.read().decode('utf-8', errors='ignore'))
            print("=== CCTV DISCOVERY RESULT ===")
            for emp in res_json.get('employees', []):
                print(f"ID: {emp.get('id')} | Name: {emp.get('name')} | Lat: {emp.get('latitude')} | Lng: {emp.get('longitude')}")
    except Exception as e:
        print(f"Error searching: {e}")

if __name__ == "__main__":
    main()
