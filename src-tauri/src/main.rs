#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(e) = app_lib::run() {
        eprintln!("Fatal error: {}", e);
        std::process::exit(1);
    }
}