// Mencegah window console tambahan muncul di Windows saat build release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    snapbox_desktop_lib::run()
}
