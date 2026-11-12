import { createComponent } from '../helpers/instances';

describe('input-field', () => {
  function field(props) {
    const component = createComponent('components/input-field/input-field', {
      onValueChange: jest.fn(),
      onValidationError: jest.fn(),
      onConfirm: jest.fn(),
      ...props,
    });
    component.didMount();
    return component;
  }

  const type = (component, value) => component.onInput({ detail: { value } });

  describe('first name', () => {
    it.each(['Lerato', 'Mary-Ann', "O'Neil", 'Mary Ann', 'Al'])('accepts %p', (value) => {
      const component = field({ validationType: 'name' });
      type(component, value);

      expect(component.data.errorMessage).toBe('');
      expect(component.props.onValueChange).toHaveBeenCalledWith(value, true);
      expect(component.props.onValidationError).toHaveBeenCalledWith('');
    });

    it.each([
      ['L3rato', 'Use letters only, e.g. Lerato.'],
      ['Mary  Ann', 'Use letters only, e.g. Lerato.'],
      ['-Lerato', 'Use letters only, e.g. Lerato.'],
      ['', 'Use letters only, e.g. Lerato.'],
      ['L', 'Your name needs at least 2 letters.'],
    ])('rejects %p with "%s"', (value, message) => {
      const component = field({ validationType: 'name' });
      type(component, value);

      expect(component.data.errorMessage).toBe(message);
      expect(component.props.onValueChange).toHaveBeenCalledWith(value, false);
      expect(component.props.onValidationError).toHaveBeenCalledWith(message);
    });
  });

  describe('policy number', () => {
    it('accepts digits only', () => {
      const component = field({ validationType: 'policy' });
      type(component, '10023456');
      expect(component.data.errorMessage).toBe('');
    });

    it.each(['12a', '12 34', '-1'])('rejects %p', (value) => {
      const component = field({ validationType: 'policy' });
      type(component, value);
      expect(component.data.errorMessage).toBe('Policy numbers contain digits only.');
    });
  });

  it('uses the translated message when the dictionary has one', () => {
    getApp().i18n = { validation: { name_length: 'Lebitso le khuts\'oane haholo.' } };
    const component = field({ validationType: 'name' });
    type(component, 'L');
    expect(component.data.errorMessage).toBe('Lebitso le khuts\'oane haholo.');
  });

  it('does not validate when no validation type is set', () => {
    const component = field({});
    type(component, '!!!');
    expect(component.data.errorMessage).toBe('');
    expect(component.props.onValueChange).toHaveBeenCalledWith('!!!', true);
  });

  it('starts from the value passed in', () => {
    expect(field({ value: 'Thabo' }).data.internalValue).toBe('Thabo');
  });

  it('tracks focus for the highlight', () => {
    const component = field({});
    component.onFocus();
    expect(component.data.focused).toBe(true);
    component.onBlur();
    expect(component.data.focused).toBe(false);
  });

  it('passes the keyboard "done" key to the parent', () => {
    const component = field({});
    component.onConfirm();
    expect(component.props.onConfirm).toHaveBeenCalled();
  });

  it('accepts anything for a validation type it does not know', () => {
    const component = field({ validationType: 'email' });
    type(component, 'not checked');
    expect(component.data.errorMessage).toBe('');
    expect(component.validateInput('x', undefined)).toBe('');
  });

  it('works when the parent does not listen to its events', () => {
    const component = createComponent('components/input-field/input-field', { validationType: 'name' });
    component.didMount();
    expect(() => {
      type(component, 'L3rato');
      component.onConfirm();
    }).not.toThrow();
    expect(component.data.errorMessage).toBe('Use letters only, e.g. Lerato.');
  });
});

describe('app-button', () => {
  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    createComponent('components/app-button/app-button', { onPress }).onTap();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores taps while disabled', () => {
    const onPress = jest.fn();
    createComponent('components/app-button/app-button', { onPress, disabled: true }).onTap();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('is a primary button by default and safe to tap without a handler', () => {
    const button = createComponent('components/app-button/app-button');
    expect(button.props).toMatchObject({ variant: 'primary', disabled: false });
    expect(() => button.onTap()).not.toThrow();
  });
});

describe('glass-dialog', () => {
  it('asks the parent to close it', () => {
    const onClose = jest.fn();
    createComponent('components/glass-dialog/glass-dialog', { onClose }).onClose();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open when the card itself is tapped', () => {
    const onClose = jest.fn();
    createComponent('components/glass-dialog/glass-dialog', { onClose }).onCardTap();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('is hidden with an "Okay" button by default and safe to close without a handler', () => {
    const dialog = createComponent('components/glass-dialog/glass-dialog');
    expect(dialog.props).toMatchObject({ visible: false, buttonText: 'Okay' });
    expect(() => dialog.onClose()).not.toThrow();
  });
});

// Display-only components: what matters is what they render by default
describe('display components', () => {
  it('lucide-icon draws a 20px, unrotated icon in the text colour by default', () => {
    const icon = createComponent('components/lucide-icon/lucide-icon', { name: 'sun' });
    expect(icon.props).toEqual({ name: 'sun', size: 20, color: '', rotate: 0 });
  });

  it('loading-spinner is hidden until asked to show', () => {
    expect(createComponent('components/loading-spinner/loading-spinner').props).toEqual({ isLoading: false });
  });

  it('app-background takes no options', () => {
    expect(createComponent('components/app-background/app-background').props).toEqual({});
  });
});
