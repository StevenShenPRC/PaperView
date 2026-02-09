use tauri::image::Image;
use tauri::{AppHandle, Manager, Window};

struct OwnedImage {
    rgba: Vec<u8>,
    width: u32,
    height: u32,
}

pub fn update_window_icon(window: &Window, theme: tauri::Theme) {
    let _app_handle = window.app_handle();

    // Determine which icon to load
    let icon_img = match theme {
        tauri::Theme::Dark => get_dark_icon(),
        _ => get_light_icon(),
    };

    if let Some(img_data) = icon_img {
        // Create Image reference from owned data
        let img = Image::new(&img_data.rgba, img_data.width, img_data.height);
        if let Err(e) = window.set_icon(img) {
            eprintln!("Failed to set window icon: {}", e);
        }
    }
}

fn get_light_icon() -> Option<OwnedImage> {
    const LIGHT_ICON_BYTES: &[u8] = include_bytes!("../icons/icon-light.png");

    bytes_to_image(LIGHT_ICON_BYTES)
}

fn get_dark_icon() -> Option<OwnedImage> {
    const DARK_ICON_BYTES: &[u8] = include_bytes!("../icons/icon-dark.png");
    bytes_to_image(DARK_ICON_BYTES)
}

pub fn update_tray_icon(_app: &AppHandle, _theme: tauri::Theme) {
    // Reserved for future implementation
}

fn bytes_to_image(bytes: &[u8]) -> Option<OwnedImage> {
    use image::GenericImageView;

    let img = image::load_from_memory(bytes).ok()?;
    let (width, height) = img.dimensions();
    let rgba = img.into_rgba8().into_vec();

    Some(OwnedImage {
        rgba,
        width,
        height,
    })
}
