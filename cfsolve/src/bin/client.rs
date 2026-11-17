//! CFSOLVE v4.0 Ultra-Fast Thin Client
//! Sends request to daemon unix socket and prints token in < 1ms client overhead.

use std::env;
use std::process;
use std::time::Instant;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixStream;

#[derive(Serialize)]
struct RequestPayload {
    url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    sitekey: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cdata: Option<String>,
    blank_page: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    proxy: Option<String>,
}

#[derive(Deserialize)]
struct ResponsePayload {
    status: String,
    #[serde(default)]
    token: Option<String>,
    #[serde(default)]
    clearance: Option<String>,
    #[serde(default)]
    error: Option<String>,
    #[serde(default)]
    elapsed_ms: u128,
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: client <URL> [--sitekey <KEY>] [--blank] [--socket <PATH>] [--proxy <URL>]");
        process::exit(1);
    }

    let url = args[1].clone();
    let mut sitekey = None;
    let mut blank_page = false;
    let mut socket_path = "/tmp/cfsolve.sock".to_string();
    let mut proxy = None;

    let mut i = 2;
    while i < args.len() {
        match args[i].as_str() {
            "--sitekey" => {
                if i + 1 < args.len() {
                    sitekey = Some(args[i + 1].clone());
                    i += 1;
                }
            }
            "--blank" => {
                blank_page = true;
            }
            "--socket" => {
                if i + 1 < args.len() {
                    socket_path = args[i + 1].clone();
                    i += 1;
                }
            }
            "--proxy" => {
                if i + 1 < args.len() {
                    proxy = Some(args[i + 1].clone());
                    i += 1;
                }
            }
            _ => {}
        }
        i += 1;
    }

    let payload = RequestPayload {
        url,
        sitekey,
        action: None,
        cdata: None,
        blank_page,
        proxy,
    };

    let stream = match UnixStream::connect(&socket_path).await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("❌ Failed to connect to cfsolve daemon at {}: {}", socket_path, e);
            eprintln!("💡 Tip: Make sure the daemon is running (`daemon /tmp/cfsolve.sock`)");
            process::exit(1);
        }
    };

    let (reader, mut writer) = stream.into_split();
    let req_json = serde_json::to_string(&payload).unwrap();
    if let Err(e) = writer.write_all(format!("{}\n", req_json).as_bytes()).await {
        eprintln!("❌ Failed to send request: {}", e);
        process::exit(1);
    }

    let mut lines = BufReader::new(reader).lines();
    if let Ok(Some(line)) = lines.next_line().await {
        match serde_json::from_str::<ResponsePayload>(&line) {
            Ok(resp) => {
                if resp.status == "ok" {
                    if let Some(tok) = resp.token {
                        println!("{}", tok);
                    } else if let Some(clr) = resp.clearance {
                        println!("cf_clearance={}", clr);
                    }
                    eprintln!("⚡ Completed in {}ms (Engine Execution)", resp.elapsed_ms);
                } else {
                    eprintln!("❌ Error from daemon: {}", resp.error.unwrap_or_default());
                    process::exit(1);
                }
            }
            Err(e) => {
                eprintln!("❌ Failed to parse daemon response: {}", e);
                process::exit(1);
            }
        }
    } else {
        eprintln!("❌ Daemon closed connection without response");
        process::exit(1);
    }
}
