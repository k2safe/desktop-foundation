fn main() {
    use desktop_core_rs::tauri_commands::desktop_core_plugin;
    use desktop_core_rs::DesktopCore;

    let core =
        DesktopCore::persistent_platform("demo-product").expect("failed to initialize desktop core");

    tauri::Builder::default()
        .manage(core)
        .plugin(desktop_core_plugin())
        .run(tauri::generate_context!())
        .expect("failed to run product demo");
}
