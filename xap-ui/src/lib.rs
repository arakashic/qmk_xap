//! Shared library surface for the xap-ui crate. The binary (`main.rs`) launches
//! the Dioxus app; examples and tests import these modules via `xap_ui::`.

pub mod app;
pub mod backend;
pub mod components;
pub mod pages;
pub mod store;
pub mod util;
