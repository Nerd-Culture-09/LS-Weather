Component({
  props: {
    text: '',
    variant: 'primary', // 'primary' | 'ghost'
    disabled: false,
    onPress: () => {},
  },
  methods: {
    onTap() {
      if (this.props.disabled) {
        return;
      }
      this.props.onPress();
    },
  },
});
