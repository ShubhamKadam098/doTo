import '@testing-library/jest-dom/vitest'

/*
 * jsdom ships no ResizeObserver, and the anchored menus measure their trigger
 * through one. Without it they never open and every menu test fails for a
 * reason that has nothing to do with the app.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as typeof ResizeObserver
