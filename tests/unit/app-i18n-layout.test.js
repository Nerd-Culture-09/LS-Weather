import { loadLanguage } from '../../i18n/i18n';
import { getTopInset } from '../../utils/layout';
import en from '../../i18n/en.json';
import st from '../../i18n/st.json';

const app = getApp();

describe('app.js', () => {
  it('uses the device language at launch', () => {
    my.getSystemInfoSync.mockReturnValue({ language: 'st' });
    app.onLaunch({ query: {} });
    expect(app.languageCode).toBe('st');
  });

  it('lets a LANG launch parameter override the device language', () => {
    my.getSystemInfoSync.mockReturnValue({ language: 'st' });
    app.onLaunch({ query: { LANG: 'en' } });
    expect(app.languageCode).toBe('en');
  });

  it('keeps the chosen language when brought back from the background', () => {
    app.languageCode = 'st';
    app.onShow({ query: { LANG: 'en' } });
    expect(app.languageCode).toBe('st');
  });

  it('stores the language and dictionary together', () => {
    app.setLanguage('st', st);
    expect(app.languageCode).toBe('st');
    expect(app.i18n).toBe(st);
  });
});

describe('loadLanguage', () => {
  it('loads English', () => {
    loadLanguage('en');
    expect(app.languageCode).toBe('en');
    expect(app.i18n).toBe(en);
  });

  it('loads Sesotho, filling untranslated keys with English', () => {
    loadLanguage('st');

    expect(app.languageCode).toBe('st');
    expect(app.i18n.index.title).toBe(st.index.title);
    expect(app.i18n.index.continue).toBe('Tsoela-pele');
    // st.json has no weather section yet: English shows instead of a blank
    expect(app.i18n.weather.today).toBe('Today');
    expect(app.i18n.index.subtitle).toBe(en.index.subtitle);
  });

  it('does not change the English dictionary while merging', () => {
    loadLanguage('st');
    loadLanguage('en');
    expect(app.i18n.index.title).toBe('Welcome to LS Weather APP');
  });

  it.each(['st-LS', 'ST_ls', 'St'])('accepts the region/case variant %s', (code) => {
    loadLanguage(code);
    expect(app.languageCode).toBe('st');
  });

  it.each(['fr', '', undefined, null])('falls back to English for %p', (code) => {
    loadLanguage(code);
    expect(app.languageCode).toBe('en');
    expect(app.i18n).toBe(en);
  });
});

describe('getTopInset', () => {
  it('adds the status bar and title bar heights', () => {
    expect(getTopInset()).toBe(44 + 48);
  });

  it('treats missing heights as zero', () => {
    my.getSystemInfoSync.mockReturnValue({});
    expect(getTopInset()).toBe(0);
  });

  it('returns 0 if system info is unavailable', () => {
    my.getSystemInfoSync.mockImplementation(() => { throw new Error('unavailable'); });
    expect(getTopInset()).toBe(0);
  });
});
