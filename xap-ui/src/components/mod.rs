//! Shared UI components: Quasar-look primitives, key widgets, and the
//! BaseContainer layout.

use std::rc::Rc;

use xap_specs::constants::XapConstants;

pub mod color_picker;
pub mod key_label;
pub mod keyboard_layout;
pub mod keycode_picker;
pub mod layout;
pub mod primitives;

pub use layout::BaseContainer;

/// Prop-friendly wrapper for the (non-PartialEq) `XapConstants`. Compares by
/// `Rc` pointer so Dioxus can memoize components that take it as a prop.
#[derive(Clone)]
pub struct Constants(pub Rc<XapConstants>);

impl PartialEq for Constants {
    fn eq(&self, other: &Self) -> bool {
        Rc::ptr_eq(&self.0, &other.0)
    }
}
