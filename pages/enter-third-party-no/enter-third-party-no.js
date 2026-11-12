import { loadLanguage } from '../../i18n/i18n';
import { weatherApi } from '../../services/api';
import { getTopInset } from '../../utils/layout';

const app = getApp();

Page({
  data: {
    i18n: null,
    topInset: 0,
    apiError: false,
    isLoading: false,
    policyNo: '',
    policyNoErrorField: '',
    errorMessage: '',
    dialogVisible: false,
  },

  onLoad() {
    loadLanguage(app.languageCode);
    this.setData({
      i18n: app.i18n,
      topInset: getTopInset(),
    });
  },

  onPolicyChange(value) {
    this.setData({
      policyNo: value,
    });
  },

  onPolicyValidationError(errorMessage) {
    this.setData({
      policyNoErrorField: errorMessage || '',
    });
  },

  async onContinue() {
    my.hideKeyboard();
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!this.data.policyNo) {
      this.setData({
        policyNoErrorField: this.data.i18n.validation.policy_required,
      });
      return;
    }

    // The field already shows the validation message; don't call the API
    if (this.data.policyNoErrorField) {
      return;
    }

    try {
      this.setData({
        isLoading: true,
      });

      const response = await weatherApi.getCustomerInfo(this.data.policyNo);
      console.log(response);

      if (response.responseCode == '200') {
        this.setData({ apiError: false });
        console.log('ALL is good');
      }

      if (response.responseCode == '9') {
        this.setData({
          apiError: false,
          dialogVisible: true,
          errorMessage: response.responseDesc,
        });
        return;
      }
    } catch (error) {
      if (error.errorMessage == 'Operation cancelled' || error.errorMessage == 'Canceled by user') {
        this.setData({
          apiError: false,
        });
        return;
      }

      this.setData({
        apiError: true,
      });
    } finally {
      this.setData({
        isLoading: false,
      });
    }
  },

  handleCancel() {
    this.setData({
      apiError: false,
    });
  },

  handleClose() {
    this.setData({
      dialogVisible: false,
    });
  },
});
