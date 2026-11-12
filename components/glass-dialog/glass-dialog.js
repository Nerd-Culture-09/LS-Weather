Component({
  props: {
    visible: false,
    title: '',
    content: '',
    buttonText: 'Okay',
    onClose: () => {},
  },
  methods: {
    onClose() {
      this.props.onClose();
    },
    // Taps inside the card must not reach the backdrop's close handler
    onCardTap() {},
  },
});
