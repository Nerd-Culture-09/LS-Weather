/*
 * Load a page or component module and turn its config into a live instance,
 * roughly the way the mini-program runtime does:
 *   - data is deep-copied, and setData copies too (the real runtime serialises it);
 *   - setData callbacks run asynchronously, after "render";
 *   - page/component methods are called with `this` = the instance.
 */
const path = require('path');
const { registry, clone } = require('./mini-runtime');

const ROOT = path.resolve(__dirname, '..', '..');

function requireFresh(relativePath) {
  jest.isolateModules(() => {
    require(path.join(ROOT, relativePath));
  });
}

function makeSetData(instance) {
  return function setData(patch, callback) {
    Object.keys(patch).forEach((key) => {
      instance.data[key] = clone(patch[key]);
    });
    if (callback) {
      Promise.resolve().then(callback);
    }
  };
}

function loadPage(relativePath) {
  const before = registry.pages.length;
  requireFresh(relativePath);
  if (registry.pages.length === before) {
    throw new Error(`${relativePath} did not call Page()`);
  }
  return registry.pages[registry.pages.length - 1];
}

function createPage(relativePath) {
  const config = loadPage(relativePath);
  const page = { ...config, data: clone(config.data || {}) };
  page.setData = makeSetData(page);
  return page;
}

function createComponent(relativePath, props = {}) {
  const before = registry.components.length;
  requireFresh(relativePath);
  if (registry.components.length === before) {
    throw new Error(`${relativePath} did not call Component()`);
  }
  const config = registry.components[registry.components.length - 1];

  const component = {
    ...(config.methods || {}),
    data: clone(config.data || {}),
    props: { ...(config.props || {}), ...props },
  };
  component.setData = makeSetData(component);
  ['didMount', 'didUpdate', 'didUnmount'].forEach((hook) => {
    if (config[hook]) component[hook] = config[hook];
  });
  return component;
}

// Let pending promise callbacks (and setData callbacks) run
function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

module.exports = { createPage, createComponent, flush, ROOT };
