fn main() {
    use std::sync::Arc;

    use desktop_core_rs::CurlHttpAdapter;
    use desktop_core_rs::tauri_commands::desktop_core_plugin;
    use desktop_core_rs::DesktopCore;

    let core = DesktopCore::persistent_platform_with_http_adapter(
        "{{PRODUCT_ID}}",
        Arc::new(CurlHttpAdapter),
    )
    .expect("failed to initialize desktop core");

    tauri::Builder::default()
        .manage(core)
        .plugin(desktop_core_plugin())
        .run(tauri::generate_context!())
        .expect("failed to run {{APP_NAME}}");
}
