// English fallbacks, used if the i18n dictionary has not been loaded yet
const DEFAULT_MESSAGES = {
  name_format: 'Use letters only, e.g. Lerato.',
  name_length: 'Your name needs at least 2 letters.',
  policy_format: 'Policy numbers contain digits only.',
};

function message(key) {
  const app = getApp();
  const messages = (app.i18n && app.i18n.validation) || {};
  return messages[key] || DEFAULT_MESSAGES[key];
}

Component({
  mixins: [],
  data: {
    errorMessage: '',
    validationType: null,
    internalValue: '',
    focused: false,
  },
  props: {
    value: '',
    label: '',
    inputType: 'text',
    validationType: '',
    placeholder: '',
    // Error set by the parent (e.g. "required" on submit); shown alongside live validation
    error: '',
    onValueChange: () => {},
    onValidationError: () => {},
    onConfirm: () => {},
  },
  didMount() {
    this.setData({
      validationType: this.props.validationType || null,
      internalValue: this.props.value || '',
    });
  },
  methods: {
    onInput(e) {
      const value = e.detail.value;
      let errorMessage = '';

      this.setData({
        internalValue: value,
      });

      if (this.data.validationType) {
        errorMessage = this.validateInput(value, this.data.validationType);
        this.setData({
          errorMessage: errorMessage,
        });
      }

      if (this.props.onValueChange) {
        // Pass both value and validation status
        this.props.onValueChange(value, errorMessage === '');
      }

      if (this.props.onValidationError) {
        this.props.onValidationError(errorMessage || '');
      }
    },

    onFocus() {
      this.setData({ focused: true });
    },

    onBlur() {
      this.setData({ focused: false });
    },

    onConfirm() {
      if (this.props.onConfirm) {
        this.props.onConfirm();
      }
    },

    validateInput(value, type) {
      if (!type) {
        return '';
      }

      switch (type) {
        case 'name':
          return this.validateFirstname(value);
        case 'policy':
          return this.validatePolicyNo(value);
        default:
          return '';
      }
    },

    validateFirstname(value) {
      if (!/^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/.test(value)) {
        return message('name_format');
      }

      if (value.length < 2) {
        return message('name_length');
      }

      return '';
    },

    validatePolicyNo(value) {
      if (!/^[0-9]+$/.test(value)) {
        return message('policy_format');
      }

      return '';
    },
  },
});
