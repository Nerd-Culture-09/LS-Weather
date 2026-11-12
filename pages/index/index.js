import { loadLanguage } from '../../i18n/i18n';
import { getTopInset } from '../../utils/layout';

const app = getApp();

Page({
  data: {
    i18n: null,
    topInset: 0,
    firstname: '',
    firstnameError: '',
  },

  onLoad() {
    loadLanguage(app.languageCode);
    this.setData({
      i18n: app.i18n,
      topInset: getTopInset(),
    });
  },

  onFirstnameChange(value) {
    this.setData({
      firstname: value,
    });
  },

  onFirstnameValidationError(errorMessage) {
    this.setData({
      firstnameError: errorMessage || '',
    });
  },

  onContinue() {
    const firstname = (this.data.firstname || '').trim();

    if (!firstname) {
      this.setData({
        firstnameError: this.data.i18n.validation.name_required,
      });
      return;
    }

    // The field already shows the live validation message
    if (this.data.firstnameError) {
      return;
    }

    my.navigateTo({
      url: `/pages/view-weather/view-weather?firstname=${encodeURIComponent(firstname)}`,
    });
  },

  onShareAppMessage() {
    return {
      title: 'LS Weather',
      desc: 'Live conditions and a 7-day outlook, at home or wherever your next trip takes you.',
      path: 'pages/index/index',
    };
  },
});
