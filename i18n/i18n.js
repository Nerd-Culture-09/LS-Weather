import en from '/i18n/en';
import st from '/i18n/st';

const app = getApp();

const dictionaries = { en, st };

/**
 * Deep-merge a translation over the English dictionary so any key that
 * has not been translated yet falls back to English instead of rendering
 * an empty string.
 */
function withFallback(base, override) {
  const result = Object.assign({}, base);
  Object.keys(override || {}).forEach((key) => {
    const value = override[key];
    const isNested = value && typeof value === 'object' && !Array.isArray(value);
    result[key] = isNested ? withFallback(base[key] || {}, value) : value;
  });
  return result;
}

/**
 * Load language code translation dictionary
 * @param lang {String} Language code eg. st, en, en-US...
 * @example
 * loadLanguage(languageCode)
 */
function loadLanguage(lang) {
  let languageCode = String(lang || 'en').toLowerCase().split(/[-_]/)[0];

  if (!dictionaries[languageCode]) {
    languageCode = 'en';
  }

  const dictionary = languageCode === 'en' ? en : withFallback(en, dictionaries[languageCode]);
  app.setLanguage(languageCode, dictionary);
}

export { loadLanguage }
