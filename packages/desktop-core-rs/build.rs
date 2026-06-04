const COMMANDS: &[&str] = &[
    "df_http_request",
    "df_session_get",
    "df_session_set",
    "df_session_clear",
    "df_storage_get",
    "df_storage_set",
    "df_storage_remove",
    "df_open_external",
    "df_copy_text",
    "df_notify",
    "df_file_open_dialog",
    "df_file_save_dialog",
    "df_file_read_text",
    "df_file_write_text",
    "df_file_export_json",
    "df_file_download",
    "df_update_install",
    "df_secure_storage_get",
    "df_secure_storage_set",
    "df_secure_storage_remove",
    "df_window_get_state",
    "df_window_set_state",
    "df_window_set_title",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
