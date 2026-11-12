import { weatherApi } from '../../services/api';
import * as places from '../../services/places';
import {
  getCurrentPlace,
  setCurrentPlace,
  getRecentPlaces,
  getSavedPlaces,
  toggleSavedPlace,
  samePlace,
} from '../../services/place-store';
import { DEFAULT_PLACE } from '../../constants/app_constants';
import { respondWith } from '../helpers/requests';

const CAPE_TOWN = {
  id: 'om-3369157', name: 'Cape Town', subtitle: 'Western Cape, South Africa',
  latitude: -33.92584, longitude: 18.42322, countryCode: 'ZA', source: 'open-meteo', isCurrent: false,
};

function place(n) {
  return { ...CAPE_TOWN, id: `om-${n}`, name: `Place ${n}` };
}

const lastRequest = () => my.request.mock.calls[my.request.mock.calls.length - 1][0];

// ---------------------------------------------------------------------------

describe('weatherApi', () => {
  it('asks for current conditions at the given place, in its local time', async () => {
    respondWith(() => ({ current: { temperature_2m: 18 } }));

    await expect(weatherApi.getCurrentWeather(CAPE_TOWN)).resolves.toEqual({ current: { temperature_2m: 18 } });

    const { url, method } = lastRequest();
    expect(method).toBe('GET');
    expect(url).toMatch(/^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
    expect(url).toContain('latitude=-33.92584&longitude=18.42322&timezone=auto');
    expect(url).toContain('current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day');
  });

  it('falls back to Maseru when no place is given', async () => {
    respondWith(() => ({}));
    await weatherApi.getCurrentWeather();
    expect(lastRequest().url).toContain(`latitude=${DEFAULT_PLACE.latitude}&longitude=${DEFAULT_PLACE.longitude}`);
  });

  it('asks for the 7-day outlook plus the hourly data the forecast and dial need', async () => {
    respondWith(() => ({}));
    await weatherApi.getWeatherForcast(CAPE_TOWN);

    const { url } = lastRequest();
    expect(url).toContain('forecast_days=7');
    expect(url).toContain('daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset');
    expect(url).toContain('hourly=weather_code,is_day,temperature_2m,precipitation_probability,wind_speed_10m,relative_humidity_2m');
  });

  it('rejects with the request error', async () => {
    respondWith(() => ({ fail: { error: 12, errorMessage: 'Network error' } }));
    await expect(weatherApi.getWeatherForcast(CAPE_TOWN)).rejects.toEqual({ error: 12, errorMessage: 'Network error' });
  });

  it('posts the customer lookup and resolves its body', async () => {
    respondWith(() => ({ responseCode: '200' }));
    await expect(weatherApi.getCustomerInfo('10023456')).resolves.toEqual({ responseCode: '200' });

    const request = lastRequest();
    expect(request.method).toBe('POST');
    expect(request.url).toMatch(/\/G$/);
    expect(request.headers.Authorization).toMatch(/^ApiKey /);
  });
});

// ---------------------------------------------------------------------------

describe('place search without a Google key (Open-Meteo)', () => {
  it('reports that Google is off', () => {
    expect(places.usingGoogle()).toBe(false);
  });

  it('encodes the query and maps results to places', async () => {
    respondWith(() => ({
      results: [
        { id: 3369157, name: 'Cape Town', admin1: 'Western Cape', country: 'South Africa', country_code: 'ZA', latitude: -33.92584, longitude: 18.42322 },
        { id: 932505, name: 'Maseru', admin1: 'Maseru', country: 'Lesotho', country_code: 'LS', latitude: -29.31667, longitude: 27.48333 },
        { id: 1, name: 'Nowhere', country: 'Atlantis', latitude: 0, longitude: 0 },
      ],
    }));

    const response = await places.searchPlaces("Mohale's Hoek");

    expect(lastRequest().url).toContain("geocoding-api.open-meteo.com/v1/search?name=Mohale's%20Hoek&count=10");
    expect(response.provider).toBe('open-meteo');
    expect(response.places[0]).toEqual({
      id: 'om-3369157', name: 'Cape Town', subtitle: 'Western Cape, South Africa',
      latitude: -33.92584, longitude: 18.42322, countryCode: 'ZA', source: 'open-meteo',
    });
    // region equal to the name is not repeated; a missing region is skipped
    expect(response.places[1].subtitle).toBe('Lesotho');
    expect(response.places[2].subtitle).toBe('Atlantis');
  });

  it('returns no places when nothing matches', async () => {
    respondWith(() => ({ generationtime_ms: 0.4 }));
    await expect(places.searchPlaces('qqqq')).resolves.toEqual({ provider: 'open-meteo', places: [] });
  });

  it('cannot name a location without Google, and does not try', async () => {
    await expect(places.reverseGeocode(-29.3, 27.4)).resolves.toBeNull();
    expect(my.request).not.toHaveBeenCalled();
  });
});

describe('place search with a Google key', () => {
  let google;

  beforeEach(() => {
    jest.isolateModules(() => {
      jest.doMock('../../constants/app_constants', () => ({
        ...jest.requireActual('../../constants/app_constants'),
        GOOGLE_MAPS_API_KEY: 'test-key',
      }));
      google = require('../../services/places');
    });
  });

  afterEach(() => {
    jest.dontMock('../../constants/app_constants');
  });

  it('searches with the Places API (New), asking only for the fields it shows', async () => {
    respondWith(() => ({
      places: [{
        id: 'ChIJLU7jZClu5kcR4PcOOO6p3I0',
        displayName: { text: 'Eiffel Tower' },
        formattedAddress: 'Eiffel Tower, Av. Gustave Eiffel, 75007 Paris, France',
        location: { latitude: 48.8584, longitude: 2.2945 },
      }],
    }));

    const response = await google.searchPlaces('eiffel');

    const request = lastRequest();
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(request.headers['X-Goog-Api-Key']).toBe('test-key');
    expect(request.headers['X-Goog-FieldMask']).toBe('places.id,places.displayName,places.formattedAddress,places.location');
    expect(JSON.parse(request.data)).toMatchObject({ textQuery: 'eiffel' });

    expect(response).toEqual({
      provider: 'google',
      places: [{
        id: 'g-ChIJLU7jZClu5kcR4PcOOO6p3I0',
        name: 'Eiffel Tower',
        subtitle: 'Av. Gustave Eiffel, 75007 Paris, France', // the name is not repeated
        latitude: 48.8584,
        longitude: 2.2945,
        source: 'google',
      }],
    });
  });

  it('handles places with partial details', async () => {
    respondWith(() => ({
      places: [
        // no display name: the address becomes the name, and is not repeated underneath
        { id: 'a', formattedAddress: '12 Kingsway, Maseru', location: { latitude: 1, longitude: 1 } },
        // address that does not start with the name is shown as-is
        { id: 'b', displayName: { text: 'Louvre Museum' }, formattedAddress: 'Rue de Rivoli, 75001 Paris, France', location: { latitude: 2, longitude: 2 } },
        // no address at all
        { id: 'c', displayName: { text: 'Somewhere' }, location: { latitude: 3, longitude: 3 } },
      ],
    }));

    const { places: found } = await google.searchPlaces('x');
    expect(found.map((p) => [p.name, p.subtitle])).toEqual([
      ['12 Kingsway, Maseru', ''],
      ['Louvre Museum', 'Rue de Rivoli, 75001 Paris, France'],
      ['Somewhere', ''],
    ]);
  });

  it('returns no places when Google finds nothing', async () => {
    respondWith(() => ({}));
    await expect(google.searchPlaces('qqqq')).resolves.toEqual({ provider: 'google', places: [] });
  });

  it('falls back to Open-Meteo when Google fails (bad key, quota, network)', async () => {
    respondWith((options) => (options.url.includes('googleapis')
      ? { fail: { error: 403 } }
      : { results: [{ id: 1, name: 'Paris', country: 'France', latitude: 48.85, longitude: 2.35 }] }));

    const response = await google.searchPlaces('Paris');

    expect(my.request).toHaveBeenCalledTimes(2);
    expect(response.provider).toBe('open-meteo');
    expect(response.places[0].name).toBe('Paris');
  });

  it('names the current location from its town and country', async () => {
    respondWith(() => ({
      status: 'OK',
      results: [{
        formatted_address: '123 Kingsway, Maseru, Lesotho',
        address_components: [
          { long_name: '123', short_name: '123', types: ['street_number'] },
          { long_name: 'Maseru', short_name: 'Maseru', types: ['locality', 'political'] },
          { long_name: 'Lesotho', short_name: 'LS', types: ['country', 'political'] },
        ],
      }],
    }));

    await expect(google.reverseGeocode(-29.31, 27.48)).resolves.toEqual({
      name: 'Maseru', subtitle: 'Lesotho', countryCode: 'LS',
    });
    expect(lastRequest().url).toContain('latlng=-29.31,27.48');
    expect(lastRequest().url).toContain('key=test-key');
  });

  it('uses the region when there is no town', async () => {
    respondWith(() => ({
      status: 'OK',
      results: [{
        formatted_address: 'Thaba-Tseka, Lesotho',
        address_components: [
          { long_name: 'Thaba-Tseka', short_name: 'TT', types: ['administrative_area_level_1'] },
          { long_name: 'Lesotho', short_name: 'LS', types: ['country'] },
        ],
      }],
    }));
    await expect(google.reverseGeocode(-29.5, 28.6)).resolves.toMatchObject({ name: 'Thaba-Tseka' });
  });

  it('uses the full address when there is no town or region, and copes with no country', async () => {
    respondWith(() => ({
      status: 'OK',
      results: [{
        formatted_address: 'Unnamed Road, Sani Pass',
        address_components: [{ long_name: 'Unnamed Road', short_name: 'Unnamed Road', types: ['route'] }],
      }],
    }));
    await expect(google.reverseGeocode(-29.6, 29.3)).resolves.toEqual({
      name: 'Unnamed Road, Sani Pass', subtitle: '', countryCode: '',
    });
  });

  it('gives up (null) when Google has no answer', async () => {
    respondWith(() => ({ status: 'ZERO_RESULTS', results: [] }));
    await expect(google.reverseGeocode(0, 0)).resolves.toBeNull();
  });
});

describe('getDeviceLocation', () => {
  it('returns numeric coordinates', async () => {
    my.getLocation.mockImplementation(({ success }) => success({ latitude: '-29.3167', longitude: '27.4833' }));
    await expect(places.getDeviceLocation()).resolves.toEqual({ latitude: -29.3167, longitude: 27.4833 });
  });

  it('rejects when location is unavailable', async () => {
    my.getLocation.mockImplementation(({ fail }) => fail({ error: 11, errorMessage: 'Permission denied' }));
    await expect(places.getDeviceLocation()).rejects.toMatchObject({ error: 11 });
  });
});

// ---------------------------------------------------------------------------

describe('place store', () => {
  it('starts on Maseru', () => {
    expect(getCurrentPlace()).toEqual(DEFAULT_PLACE);
    expect(getRecentPlaces()).toEqual([]);
    expect(getSavedPlaces()).toEqual([]);
  });

  it('remembers the chosen place and lists it as recent', () => {
    setCurrentPlace(CAPE_TOWN);
    expect(getCurrentPlace()).toEqual(CAPE_TOWN);
    expect(getRecentPlaces()).toEqual([CAPE_TOWN]);
  });

  it('keeps recents newest first, without duplicates, and at most six', () => {
    [1, 2, 3, 4, 5, 6, 7].forEach((n) => setCurrentPlace(place(n)));
    setCurrentPlace(place(4));

    expect(getRecentPlaces().map((p) => p.id)).toEqual(['om-4', 'om-7', 'om-6', 'om-5', 'om-3', 'om-2']);
  });

  it('does not add "current location" to recents (it changes as you move)', () => {
    setCurrentPlace({ ...CAPE_TOWN, id: 'current', isCurrent: true });
    expect(getCurrentPlace().id).toBe('current');
    expect(getRecentPlaces()).toEqual([]);
  });

  it('toggles saved places and reports the new state', () => {
    expect(toggleSavedPlace(CAPE_TOWN)).toBe(true);
    expect(getSavedPlaces()).toEqual([CAPE_TOWN]);
    expect(toggleSavedPlace(CAPE_TOWN)).toBe(false);
    expect(getSavedPlaces()).toEqual([]);
  });

  it('keeps working when storage is unavailable', () => {
    my.getStorageSync.mockImplementation(() => { throw new Error('storage disabled'); });
    my.setStorageSync.mockImplementation(() => { throw new Error('storage disabled'); });

    expect(getCurrentPlace()).toEqual(DEFAULT_PLACE);
    expect(() => setCurrentPlace(CAPE_TOWN)).not.toThrow();
    expect(() => toggleSavedPlace(CAPE_TOWN)).not.toThrow();
  });

  it('compares places by id and coordinates', () => {
    expect(samePlace(CAPE_TOWN, { ...CAPE_TOWN })).toBe(true);
    expect(samePlace(CAPE_TOWN, { ...CAPE_TOWN, latitude: 0 })).toBe(false);
    expect(samePlace(CAPE_TOWN, null)).toBe(false);
  });
});
