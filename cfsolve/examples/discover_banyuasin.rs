use anyhow::Result;
use cfsolve::{Browser, Options};
use url::Url;
use tokio::runtime::Builder;
use serde_json::Value;

fn main() -> Result<()> {
    let browser = Browser::read("profiles/safari-26-ios.json")?;
    let options = Options {
        proxy: None,
        trusted_root: None,
        sink: None,
    };
    let runtime = Builder::new_multi_thread().enable_all().build()?;
    runtime.block_on(async {
        let base_url = Url::parse("https://cctv.banyuasinkab.go.id/")?;
        println!("[1] Memulai bypass Cloudflare...");
        let client = browser.client(&options)?;
        let clearance = browser.solve_with_client(&client, &base_url, &options).await?;
        println!("[2] Clearance didapat! cf_clearance: {}", clearance.clearance);

        println!("[3] Mengambil CSRF token dari halaman utama...");
        let home_resp = client.http.get("https://cctv.banyuasinkab.go.id/").send().await?;
        let home_html = home_resp.text().await?;
        
        let csrf_re = regex::Regex::new(r#"meta name="csrf-token" content="([^"]+)""#)?;
        let csrf_token = csrf_re.captures(&home_html)
            .map(|c| c[1].to_string())
            .unwrap_or_default();
        println!("[4] CSRF Token: {}", csrf_token);

        println!("[5] Mengambil daftar kamera via /employee/search ...");
        let form_params = [
            ("_token", csrf_token.as_str()),
            ("keyword", ""),
        ];
        let search_resp = client.http
            .post("https://cctv.banyuasinkab.go.id/employee/search")
            .header("Referer", "https://cctv.banyuasinkab.go.id/")
            .header("X-CSRF-TOKEN", &csrf_token)
            .header("X-Requested-With", "XMLHttpRequest")
            .form(&form_params)
            .send()
            .await?;

        println!("HTTP Status /employee/search: {}", search_resp.status());
        let search_text = search_resp.text().await?;
        println!("Response: {}", search_text);

        Ok(())
    })
}
