//! Global UI feedback state: a toast stack and a loading overlay. Ports the
//! Quasar `Notify` (src/App.vue, src/utils/utils.ts) and `Loading`
//! (src/layouts/baseContainer.vue) usage into Dioxus signals.
//!
//! Toasts auto-dismiss after [`TOAST_TIMEOUT_MS`] (Quasar Notify's default; the
//! Vue app never overrode `timeout`). Page-level colored variants
//! (negative/info/locked) are added when the pages that need them land in
//! Phase 5; for now App.vue only emits the default (icon-only) toasts.

use dioxus::prelude::*;

use crate::util::time::sleep_ms;

/// Quasar Notify's default timeout; the Vue app never set an explicit one.
pub const TOAST_TIMEOUT_MS: u64 = 5000;

/// Toast color variants, mirroring the Quasar Notify styles the app used
/// (default grey; negative red; locked red w/ block icon; info amber).
#[derive(Clone, Copy, PartialEq)]
pub enum ToastKind {
    Default,
    Negative,
    Locked,
    Info,
}

impl ToastKind {
    pub fn class(self) -> &'static str {
        match self {
            ToastKind::Default => "qx-toast",
            ToastKind::Negative => "qx-toast qx-toast-negative",
            ToastKind::Locked => "qx-toast qx-toast-locked",
            ToastKind::Info => "qx-toast qx-toast-info",
        }
    }
}

#[derive(Clone, PartialEq)]
pub struct Toast {
    pub id: u32,
    pub message: String,
    pub icon: Option<&'static str>,
    pub kind: ToastKind,
}

/// Thin reactive wrapper; construct inside a component (`Signal::new` panics
/// outside the Dioxus runtime).
#[derive(Clone, Copy)]
pub struct UiState {
    /// `Some(message)` shows the loading overlay.
    pub loading: Signal<Option<String>>,
    pub toasts: Signal<Vec<Toast>>,
    next_id: Signal<u32>,
}

impl Default for UiState {
    fn default() -> Self {
        Self::new()
    }
}

impl UiState {
    pub fn new() -> Self {
        Self {
            loading: Signal::new(None),
            toasts: Signal::new(Vec::new()),
            next_id: Signal::new(0),
        }
    }

    pub fn notify(&mut self, message: impl Into<String>) {
        self.push_toast(message.into(), None, ToastKind::Default);
    }

    pub fn notify_with_icon(&mut self, message: impl Into<String>, icon: Option<&'static str>) {
        self.push_toast(message.into(), icon, ToastKind::Default);
    }

    /// `Error: <err>` in red (Quasar `type: 'negative'`).
    pub fn notify_error(&mut self, err: impl std::fmt::Display) {
        self.push_toast(format!("Error: {err}"), None, ToastKind::Negative);
    }

    /// Amber info toast with an info icon (Quasar `notifyInfo`).
    pub fn notify_info(&mut self, message: impl Into<String>) {
        self.push_toast(message.into(), Some("info"), ToastKind::Info);
    }

    /// "Device is locked" in red with a block icon (Quasar `notifyDeviceLocked`).
    pub fn notify_device_locked(&mut self) {
        self.push_toast("Device is locked".to_string(), Some("block"), ToastKind::Locked);
    }

    fn push_toast(&mut self, message: String, icon: Option<&'static str>, kind: ToastKind) {
        let id = {
            let mut next = self.next_id;
            let id = *next.read();
            next.set(id.wrapping_add(1));
            id
        };
        self.toasts.write().push(Toast {
            id,
            message,
            icon,
            kind,
        });

        // Auto-dismiss after the timeout. Signals are Copy, so the async task
        // captures `toasts` by value and only writes it (no FnMut capture issue).
        let mut toasts = self.toasts;
        spawn(async move {
            sleep_ms(TOAST_TIMEOUT_MS).await;
            toasts.write().retain(|t| t.id != id);
        });
    }

    pub fn show_loading(&mut self, message: impl Into<String>) {
        self.loading.set(Some(message.into()));
    }

    pub fn hide_loading(&mut self) {
        if self.loading.read().is_some() {
            self.loading.set(None);
        }
    }
}
