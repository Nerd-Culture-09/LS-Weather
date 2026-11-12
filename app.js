App({
  languageCode: '',
  i18n: null,
  


  onLaunch(options) {
    // 第一次打开
    // options.query == {number:1}
    console.info('App onLaunch');

    const systemInfo = my.getSystemInfoSync();
    this.languageCode = systemInfo.language; // Use device langauge as fallback

    if (options.query && options.query.LANG) {
      this.languageCode = options.query.LANG;
    }
  },
  onShow(options) {
    // 从后台被 scheme 重新打开
    // options.query == {number:1}
  }, 
 
  setLanguage(languageCode, i18n) {
    this.languageCode = languageCode;
    this.i18n = i18n;
  }
});
