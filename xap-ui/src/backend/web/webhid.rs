//! WebHID transport: request/open devices and write reports. Port of
//! `src/xap-runtime/webhid.ts` semantics: `submit` produces a 65-byte report
//! whose `report[0]` is the report id and `report[1..]` the 64-byte payload;
//! `sendReport(report[0], report[1..])` mirrors the TS call.

use web_sys::HidDevice;

pub const XAP_USAGE_PAGE: u16 = 0xFF51;
pub const XAP_USAGE: u16 = 0x0058;

/// `navigator.hid`, or None if WebHID is absent (mirrors `'hid' in navigator`).
pub fn hid() -> Option<web_sys::Hid> {
    let nav = web_sys::window()?.navigator();
    if js_sys::Reflect::has(nav.as_ref(), &wasm_bindgen::JsValue::from_str("hid")).unwrap_or(false) {
        Some(nav.hid())
    } else {
        None
    }
}

pub fn is_webhid_supported() -> bool {
    hid().is_some()
}

/// `navigator.hid.requestDevice({filters: [{usagePage, usage}]})`.
pub async fn request_devices() -> Result<Vec<HidDevice>, String> {
    let hid = hid().ok_or_else(|| "WebHID is not supported".to_string())?;

    let filter = web_sys::HidDeviceFilter::new();
    filter.set_usage_page(XAP_USAGE_PAGE);
    filter.set_usage(XAP_USAGE);
    let opts = web_sys::HidDeviceRequestOptions::new(&[filter]);

    let array = hid
        .request_device(&opts)
        .await
        .map_err(|e| format!("requestDevice failed: {e:?}"))?;

    Ok(array.iter().collect())
}

/// `device.open()` if `!device.opened()`.
pub async fn open(device: &HidDevice) -> Result<(), String> {
    if !device.opened() {
        device
            .open()
            .await
            .map_err(|e| format!("device.open failed: {e:?}"))?;
    }
    Ok(())
}

/// `device.sendReport(report[0], report[1..])` — fire and forget the promise
/// (mirrors browser.ts's `sendReportCb` `.catch`-logged write). The write is
/// initiated synchronously; the returned promise is dropped.
pub fn send_report(device: &HidDevice, report: &[u8]) {
    let Some((&report_id, payload)) = report.split_first() else {
        return;
    };
    let mut payload = payload.to_vec();
    if let Err(e) = device.send_report_with_u8_slice(report_id, &mut payload) {
        log::error!("sendReport failed: {e:?}");
    }
}
