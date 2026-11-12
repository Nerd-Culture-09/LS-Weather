/*
 * Jest unit tests for the LS Weather mini program.
 *
 * The app code is written for the Alipay mini-program runtime (ES modules,
 * root-absolute imports like '/i18n/en', and globals such as `my`, `getApp`,
 * `Page`). tests/helpers/mini-env.js fakes that runtime in Node.
 *
 * Babel options live here rather than in a babel.config.js so Mini Program
 * Studio's own compiler never picks them up.
 */
module.exports = {
  testEnvironment: 'node',
  // The whole project (not just tests/) so source files no test loads still
  // show up in the coverage report at 0% instead of silently disappearing
  roots: ['<rootDir>'],
  testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
  modulePathIgnorePatterns: ['<rootDir>/coverage/', '<rootDir>/\\.mini-ide'],
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/mini-env.js'],

  transform: {
    '^.+\\.js$': ['babel-jest', {
      babelrc: false,
      configFile: false,
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    }],
  },

  // Mini programs resolve '/i18n/en' from the project root
  moduleNameMapper: {
    '^/(.*)$': '<rootDir>/$1',
  },

  clearMocks: true,

  collectCoverageFrom: [
    'app.js',
    'constants/**/*.js',
    'utils/**/*.js',
    'services/**/*.js',
    'i18n/**/*.js',
    'components/**/*.js',
    'pages/**/*.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html', 'lcov'],

  // `npm test` fails if any of these drops below 80%
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
};
