import '@testing-library/jest-dom/vitest'

// jsdom lacks these browser APIs used by the UI.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false },
  })
}
class RO { observe() {} unobserve() {} disconnect() {} }
window.ResizeObserver = window.ResizeObserver || RO
window.scrollTo = () => {}
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {}
