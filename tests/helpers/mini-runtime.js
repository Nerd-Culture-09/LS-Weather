/*
 * A small fake of the Alipay mini-program runtime, just enough for unit tests.
 *
 * - createMy(): the `my` API object; every method is a jest.fn().
 *   Storage is real (in memory) so place-store round-trips work.
 *   Selector queries read from `my.__layout` (rects keyed by selector).
 * - registry: what App(), Page() and Component() were called with.
 */

const registry = {
  app: null,
  pages: [],
  components: [],
};

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function createSelectorQuery(layout) {
  const producers = [];
  const query = {
    select(selector) {
      producers.push(() => clone(layout.rects[selector]) || null);
      return query;
    },
    boundingClientRect() {
      return query;
    },
    selectViewport() {
      producers.push(() => clone(layout.viewport));
      return query;
    },
    scrollOffset() {
      return query;
    },
    exec(callback) {
      const run = () => callback(producers.map((produce) => produce()));
      // Deferred mode lets a test control when the async measurement lands
      if (layout.deferred) {
        layout.pending.push(run);
      } else {
        run();
      }
    },
  };
  return query;
}

function createMy() {
  const storage = new Map();
  const layout = {
    rects: {},
    viewport: { scrollTop: 0, scrollLeft: 0 },
    deferred: false,
    pending: [],
  };

  return {
    request: jest.fn(),
    getStorageSync: jest.fn(({ key }) => ({ data: storage.has(key) ? clone(storage.get(key)) : null })),
    setStorageSync: jest.fn(({ key, data }) => {
      storage.set(key, clone(data));
    }),
    getSystemInfoSync: jest.fn(() => ({ language: 'en', statusBarHeight: 44, titleBarHeight: 48 })),
    getLocation: jest.fn(),
    showToast: jest.fn(),
    hideKeyboard: jest.fn(),
    navigateTo: jest.fn(),
    navigateBack: jest.fn(),
    redirectTo: jest.fn(),
    pageScrollTo: jest.fn(),
    createSelectorQuery: jest.fn(() => createSelectorQuery(layout)),
    call: jest.fn(),

    // Test-only handles
    __storage: storage,
    __layout: layout,
    __flushQueries() {
      const runs = layout.pending.splice(0);
      runs.forEach((run) => run());
    },
  };
}

module.exports = { registry, createMy, clone };
