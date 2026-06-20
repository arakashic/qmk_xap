import '@testing-library/jest-dom'

// jsdom does not implement ResizeObserver; stub it for Radix primitives that use it (e.g. Slider)
if (typeof ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
