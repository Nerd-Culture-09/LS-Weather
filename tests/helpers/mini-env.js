/*
 * Installed before every test file (jest.config.js -> setupFilesAfterEnv).
 * Puts the mini-program globals in place and gives each test a fresh `my`.
 */
const { registry, createMy } = require('./mini-runtime');

global.App = (config) => {
  registry.app = config;
};
global.Page = (config) => {
  registry.pages.push(config);
};
global.Component = (config) => {
  registry.components.push(config);
};

// The real app object from app.js. Modules call getApp() at import time and
// keep the reference, so it must stay the same object; tests reset its fields.
global.my = createMy();
require('../../app.js');
const app = registry.app;
global.getApp = () => app;

beforeEach(() => {
  global.my = createMy();
  global.getCurrentPages = jest.fn(() => [{}, {}]);
  app.languageCode = 'en';
  app.i18n = null;

  // The app logs freely; keep test output readable (tests can still assert on it)
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  console.log.mockRestore();
  console.info.mockRestore();
});
