pub async fn sleep_ms(ms: u64) {
    #[cfg(target_arch = "wasm32")]
    gloo_timers::future::TimeoutFuture::new(ms as u32).await;
    #[cfg(not(target_arch = "wasm32"))]
    tokio::time::sleep(std::time::Duration::from_millis(ms)).await;
}

/// Epoch millis (JS Date.now() parity for broadcast timestamps).
pub fn now_ms() -> f64 {
    #[cfg(target_arch = "wasm32")]
    return js_sys::Date::now();
    #[cfg(not(target_arch = "wasm32"))]
    return std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as f64;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn now_ms_returns_epoch_millis() {
        // 2020-01-01 in epoch millis; sanity-checks the unit (ms, not s/us).
        assert!(now_ms() > 1_577_836_800_000.0);
    }
}
