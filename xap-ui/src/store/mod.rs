//! App stores ported from the Pinia stores (src/utils/deviceStore.ts,
//! src/utils/broadcastStore.ts).
//!
//! Testing approach: `Signal::new` panics outside the Dioxus runtime
//! (verified empirically: a plain `#[test]` hits "Components run in the
//! Dioxus runtime"). All state + logic therefore lives in pure data structs
//! (`DeviceStoreData`, `BroadcastStoreData`) with ordinary unit tests; the
//! `DeviceStore` / `BroadcastStore` newtypes are thin `Signal<...Data>`
//! wrappers for component use and contain no logic of their own, except
//! read-first guards that skip no-op `write()`s (a `write()` schedules a
//! rerender even when nothing changes). The guards go through `Signal`, so
//! they cannot be unit-tested without the runtime; they are deliberately
//! left untested rather than pulling in a Dioxus test harness.

pub mod broadcast;
pub mod device;
pub mod ui;
