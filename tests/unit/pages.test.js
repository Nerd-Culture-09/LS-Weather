import { createPage, flush } from '../helpers/instances';
import { respondWith, holdRequests } from '../helpers/requests';

const stored = (key) => my.__storage.get(key);

// ---------------------------------------------------------------------------

describe('welcome page (pages/index)', () => {
  let page;

  beforeEach(() => {
    page = createPage('pages/index/index');
    page.onLoad({});
  });

  it('loads the dictionary and clears the title bar', () => {
    expect(page.data.i18n.index.title).toBe('Welcome to LS Weather APP');
    expect(page.data.topInset).toBe(92);
  });

  it('asks for a name instead of continuing with an empty one', () => {
    page.onContinue();
    expect(page.data.firstnameError).toBe('Please enter your first name.');
    expect(my.navigateTo).not.toHaveBeenCalled();
  });

  it('treats spaces only as empty', () => {
    page.onFirstnameChange('   ');
    page.onContinue();
    expect(page.data.firstnameError).toBe('Please enter your first name.');
  });

  it('does not continue while the field shows a validation error', () => {
    page.onFirstnameChange('L3rato');
    page.onFirstnameValidationError('Use letters only, e.g. Lerato.');
    page.onContinue();
    expect(my.navigateTo).not.toHaveBeenCalled();
  });

  it('opens the weather page with the trimmed, encoded name', () => {
    page.onFirstnameChange('  Mary Ann ');
    page.onFirstnameValidationError('');
    page.onContinue();
    expect(my.navigateTo).toHaveBeenCalledWith({ url: '/pages/view-weather/view-weather?firstname=Mary%20Ann' });
  });

  it('shares a link to the welcome page that is not tied to one city', () => {
    const share = page.onShareAppMessage();
    expect(share).toMatchObject({ title: 'LS Weather', path: 'pages/index/index' });
    expect(share.desc).not.toMatch(/Maseru/);
  });
});

// ---------------------------------------------------------------------------

describe('policy page (pages/enter-third-party-no)', () => {
  let page;

  beforeEach(() => {
    page = createPage('pages/enter-third-party-no/enter-third-party-no');
    page.onLoad();
  });

  it('asks for a policy number instead of calling the API with nothing', async () => {
    await page.onContinue();
    expect(my.hideKeyboard).toHaveBeenCalled();
    expect(page.data.policyNoErrorField).toBe('Please enter your policy number.');
    expect(my.request).not.toHaveBeenCalled();
  });

  it('does not call the API while the number is invalid', async () => {
    page.onPolicyChange('12a');
    page.onPolicyValidationError('Policy numbers contain digits only.');
    await page.onContinue();
    expect(my.request).not.toHaveBeenCalled();
  });

  it('clears any earlier error when the lookup succeeds', async () => {
    respondWith(() => ({ responseCode: '200' }));
    page.setData({ apiError: true });
    page.onPolicyChange('10023456');
    await page.onContinue();

    expect(my.request).toHaveBeenCalledTimes(1);
    expect(page.data).toMatchObject({ apiError: false, dialogVisible: false, isLoading: false });
  });

  it('shows the service message for response code 9', async () => {
    respondWith(() => ({ responseCode: '9', responseDesc: 'Policy not found' }));
    page.onPolicyChange('10023456');
    await page.onContinue();

    expect(page.data).toMatchObject({
      dialogVisible: true, errorMessage: 'Policy not found', apiError: false, isLoading: false,
    });
  });

  it('shows the error screen when the request fails', async () => {
    respondWith(() => ({ fail: { error: 19, errorMessage: 'HTTP error' } }));
    page.onPolicyChange('10023456');
    await page.onContinue();

    expect(page.data).toMatchObject({ apiError: true, isLoading: false });
  });

  it('stays on the form when the user cancels the request', async () => {
    respondWith(() => ({ fail: { errorMessage: 'Canceled by user' } }));
    page.onPolicyChange('10023456');
    await page.onContinue();

    expect(page.data).toMatchObject({ apiError: false, isLoading: false });
  });

  it('closes the error screen and the dialog', () => {
    page.setData({ apiError: true, dialogVisible: true });
    page.handleCancel();
    page.handleClose();
    expect(page.data).toMatchObject({ apiError: false, dialogVisible: false });
  });
});

// ---------------------------------------------------------------------------

describe('place picker (pages/places)', () => {
  let page;

  const geocoding = (names) => ({
    results: names.map((name, i) => ({ id: i + 1, name, admin1: 'Region', country: 'Country', latitude: i, longitude: i })),
  });
  const tapRow = (list, index) => ({ currentTarget: { dataset: { list, index } } });

  beforeEach(() => {
    page = createPage('pages/places/places');
    page.onLoad();
  });

  it('starts with no saved or recent places, using Open-Meteo', () => {
    expect(page.data).toMatchObject({ provider: 'open-meteo', saved: [], recent: [], searchActive: false });
  });

  describe('search', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      respondWith((options) => geocoding([decodeURIComponent(options.url.match(/name=([^&]*)/)[1])]));
    });

    it('waits until typing pauses, then searches once', async () => {
      page.onQueryInput({ detail: { value: 'Ca' } });
      await jest.advanceTimersByTimeAsync(200);
      page.onQueryInput({ detail: { value: 'Cape' } });
      await jest.advanceTimersByTimeAsync(200);
      expect(my.request).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(200);
      expect(my.request).toHaveBeenCalledTimes(1);
      expect(my.request.mock.calls[0][0].url).toContain('name=Cape');
      expect(page.data.results.map((r) => r.name)).toEqual(['Cape']);
      expect(page.data.searching).toBe(false);
    });

    it('does not search for a single letter', async () => {
      page.onQueryInput({ detail: { value: 'C' } });
      await jest.advanceTimersByTimeAsync(1000);
      expect(my.request).not.toHaveBeenCalled();
      expect(page.data.searchActive).toBe(false);
    });

    it('searches straight away on the keyboard search key', async () => {
      page.onQueryInput({ detail: { value: 'Paris' } });
      page.onSearchConfirm();
      await jest.advanceTimersByTimeAsync(0);
      expect(my.request).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1000);
      expect(my.request).toHaveBeenCalledTimes(1); // the debounced search was cancelled
    });

    it('drops a pending search when the page is closed', async () => {
      page.onQueryInput({ detail: { value: 'Cape' } });
      page.onUnload();
      await jest.advanceTimersByTimeAsync(1000);
      expect(my.request).not.toHaveBeenCalled();
    });

    it('clears the query and results', async () => {
      page.onQueryInput({ detail: { value: 'Paris' } });
      await jest.advanceTimersByTimeAsync(400);
      page.onClearQuery();
      expect(page.data).toMatchObject({ query: '', searchActive: false, results: [] });
    });
  });

  it('ignores a slow response for an older query', async () => {
    const held = holdRequests();
    page.runSearch('Paris');
    page.runSearch('London');

    held[1].reply(geocoding(['London']));
    await flush();
    held[0].reply(geocoding(['Paris']));
    await flush();

    expect(page.data.results.map((r) => r.name)).toEqual(['London']);
  });

  it('shows an error message when search fails', async () => {
    respondWith(() => ({ fail: { error: 12 } }));
    await page.runSearch('Paris');
    expect(page.data).toMatchObject({ searchError: true, results: [], searching: false });
  });

  describe('with results', () => {
    beforeEach(async () => {
      respondWith(() => geocoding(['Cape Town', 'Paris']));
      await page.runSearch('a');
    });

    it('saves and unsaves a place with a confirmation', () => {
      page.onToggleSaved(tapRow('results', 0));
      expect(page.data.saved.map((p) => p.name)).toEqual(['Cape Town']);
      expect(page.data.results[0].saved).toBe(true);
      expect(stored('ls.savedPlaces')[0]).not.toHaveProperty('saved'); // display flag is not stored
      expect(my.showToast).toHaveBeenLastCalledWith(expect.objectContaining({ content: 'Saved for your trip' }));

      page.onToggleSaved(tapRow('saved', 0));
      expect(page.data.saved).toEqual([]);
      expect(my.showToast).toHaveBeenLastCalledWith(expect.objectContaining({ content: 'Removed from saved places' }));
    });

    it('chooses a place and goes back to the weather', () => {
      page.onSelectPlace(tapRow('results', 1));
      expect(stored('ls.place')).toMatchObject({ name: 'Paris', isCurrent: false });
      expect(stored('ls.recentPlaces').map((p) => p.name)).toEqual(['Paris']);
      expect(my.navigateBack).toHaveBeenCalled();
    });

    it('opens the weather page when it was opened on its own', () => {
      getCurrentPages.mockReturnValue([{}]);
      page.onSelectPlace(tapRow('results', 0));
      expect(my.redirectTo).toHaveBeenCalledWith({ url: '/pages/view-weather/view-weather' });
    });

    it('does not list a saved place under recent as well', () => {
      page.onSelectPlace(tapRow('results', 0));
      page.onToggleSaved(tapRow('results', 0));
      expect(page.data.saved.map((p) => p.name)).toEqual(['Cape Town']);
      expect(page.data.recent).toEqual([]);
    });
  });

  describe('current location', () => {
    it('uses the device position (named by coordinates without Google)', async () => {
      my.getLocation.mockImplementation(({ success }) => success({ latitude: '-29.3167', longitude: '27.4833' }));
      await page.onUseCurrentLocation();

      expect(stored('ls.place')).toMatchObject({
        id: 'current', isCurrent: true, name: 'Current location', subtitle: '29.32°S, 27.48°E', source: 'device',
      });
      expect(stored('ls.recentPlaces')).toBeUndefined();
      expect(page.data.locating).toBe(false);
      expect(my.navigateBack).toHaveBeenCalled();
    });

    it('explains how to allow location when it is unavailable', async () => {
      my.getLocation.mockImplementation(({ fail }) => fail({ error: 11 }));
      await page.onUseCurrentLocation();

      expect(page.data).toMatchObject({ locationErrorVisible: true, locating: false });
      page.onCloseLocationError();
      expect(page.data.locationErrorVisible).toBe(false);
    });

    it('ignores a second tap while locating', async () => {
      my.getLocation.mockImplementation(() => {}); // never answers
      page.onUseCurrentLocation();
      page.onUseCurrentLocation();
      expect(my.getLocation).toHaveBeenCalledTimes(1);
    });
  });
});

describe('place picker with a Google key', () => {
  let page;

  beforeEach(() => {
    jest.doMock('../../constants/app_constants', () => ({
      ...jest.requireActual('../../constants/app_constants'),
      GOOGLE_MAPS_API_KEY: 'test-key',
    }));
    page = createPage('pages/places/places');
    page.onLoad();
    my.getLocation.mockImplementation(({ success }) => success({ latitude: -29.31, longitude: 27.48 }));
  });

  afterEach(() => {
    jest.dontMock('../../constants/app_constants');
  });

  it('credits Google for results', () => {
    expect(page.data.provider).toBe('google');
  });

  it('names the current location by its town', async () => {
    respondWith(() => ({
      status: 'OK',
      results: [{
        formatted_address: 'Maseru, Lesotho',
        address_components: [
          { long_name: 'Maseru', short_name: 'Maseru', types: ['locality'] },
          { long_name: 'Lesotho', short_name: 'LS', types: ['country'] },
        ],
      }],
    }));
    await page.onUseCurrentLocation();

    expect(stored('ls.place')).toMatchObject({
      id: 'current', isCurrent: true, name: 'Maseru', subtitle: 'Lesotho', countryCode: 'LS', source: 'google',
    });
  });

  it('still uses the location when naming it fails', async () => {
    respondWith(() => ({ fail: { error: 403 } }));
    await page.onUseCurrentLocation();

    expect(stored('ls.place')).toMatchObject({ name: 'Current location', subtitle: '29.31°S, 27.48°E', source: 'device' });
    expect(page.data.locationErrorVisible).toBe(false);
  });

  it('writes northern and western coordinates correctly when Google has no name', async () => {
    my.getLocation.mockImplementation(({ success }) => success({ latitude: 48.8584, longitude: -2.2945 }));
    respondWith(() => ({ status: 'ZERO_RESULTS', results: [] }));
    await page.onUseCurrentLocation();

    expect(stored('ls.place').subtitle).toBe('48.86°N, 2.29°W');
  });
});
