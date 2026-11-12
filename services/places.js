import { GOOGLE_MAPS_API_KEY } from '../constants/app_constants';

/*
 * Place search and reverse geocoding.
 * Uses Google Maps Platform when GOOGLE_MAPS_API_KEY is set, otherwise
 * Open-Meteo's free geocoding API (no key). If a Google call fails (bad key,
 * quota, network), search falls back to Open-Meteo so the feature keeps working.
 *
 * Every place has the same shape:
 * { id, name, subtitle, latitude, longitude, countryCode?, source, isCurrent? }
 */

const GOOGLE_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const OPEN_METEO_SEARCH_URL = 'https://geocoding-api.open-meteo.com/v1/search';

const MAX_RESULTS = 10;

function request(options) {
  return new Promise((resolve, reject) => {
    my.request(Object.assign({ method: 'GET', dataType: 'json' }, options, {
      success: (res) => resolve(res.data),
      fail: reject,
    }));
  });
}

export function usingGoogle() {
  return Boolean(GOOGLE_MAPS_API_KEY);
}

// "Paris" + "Paris, France" -> "France"; nothing when the address is the name
function withoutLeadingName(name, address) {
  if (!address || address === name) return '';
  const prefix = name + ', ';
  return address.indexOf(prefix) === 0 ? address.slice(prefix.length) : address;
}

async function searchGoogle(query) {
  const data = await request({
    url: GOOGLE_TEXT_SEARCH_URL,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      // Only the fields we render: keeps the response small and the SKU cheaper
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    data: JSON.stringify({ textQuery: query, pageSize: MAX_RESULTS, languageCode: 'en' }),
  });

  return (data.places || []).map((place) => {
    const name = place.displayName ? place.displayName.text : place.formattedAddress;
    return {
      id: 'g-' + place.id,
      name,
      subtitle: withoutLeadingName(name, place.formattedAddress),
      latitude: place.location.latitude,
      longitude: place.location.longitude,
      source: 'google',
    };
  });
}

async function searchOpenMeteo(query) {
  const data = await request({
    url: `${OPEN_METEO_SEARCH_URL}?name=${encodeURIComponent(query)}&count=${MAX_RESULTS}&language=en&format=json`,
  });

  return (data.results || []).map((result) => ({
    id: 'om-' + result.id,
    name: result.name,
    subtitle: [result.admin1 !== result.name ? result.admin1 : '', result.country].filter(Boolean).join(', '),
    latitude: result.latitude,
    longitude: result.longitude,
    countryCode: result.country_code,
    source: 'open-meteo',
  }));
}

/**
 * @returns {Promise<{provider: 'google'|'open-meteo', places: Array}>}
 */
export async function searchPlaces(query) {
  if (usingGoogle()) {
    try {
      return { provider: 'google', places: await searchGoogle(query) };
    } catch (error) {
      console.log('Google place search failed, using Open-Meteo', error);
    }
  }
  return { provider: 'open-meteo', places: await searchOpenMeteo(query) };
}

/**
 * Town/city name for coordinates. Needs Google; resolves null without a key
 * or when Google has no answer, and callers fall back to "Current location".
 */
export async function reverseGeocode(latitude, longitude) {
  if (!usingGoogle()) {
    return null;
  }

  const data = await request({
    url: `${GOOGLE_GEOCODE_URL}?latlng=${latitude},${longitude}&language=en&key=${GOOGLE_MAPS_API_KEY}`,
  });

  if (data.status !== 'OK' || !data.results.length) {
    return null;
  }

  const components = data.results[0].address_components;
  const find = (type) => components.find((c) => c.types.indexOf(type) !== -1);
  const town = find('locality') || find('postal_town') || find('administrative_area_level_2') || find('administrative_area_level_1');
  const country = find('country');

  return {
    name: town ? town.long_name : data.results[0].formatted_address,
    subtitle: country ? country.long_name : '',
    countryCode: country ? country.short_name : '',
  };
}

export function getDeviceLocation() {
  return new Promise((resolve, reject) => {
    my.getLocation({
      type: 0,
      success: (res) => resolve({
        latitude: parseFloat(res.latitude),
        longitude: parseFloat(res.longitude),
      }),
      fail: reject,
    });
  });
}
