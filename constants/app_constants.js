export const DEFAULT_LANGUAGE = 'en';

// Shown until the user picks another place (the app's original location)
export const DEFAULT_PLACE = {
  id: 'default-maseru',
  name: 'Maseru',
  subtitle: 'Lesotho',
  latitude: -29.3167,
  longitude: 27.4833,
  countryCode: 'LS',
  source: 'default',
};

/*
 * Google Maps Platform key. Leave empty to use Open-Meteo's free geocoding.
 *
 * With a key, place search uses the Places API (New) Text Search and the
 * "current location" name comes from the Geocoding API. Enable both APIs in
 * the key's Google Cloud project (billing must be on) and restrict the key
 * to just those two APIs: it ships inside the mini-app package, so anyone
 * can extract it. Set a daily quota as a spending cap.
 */
export const GOOGLE_MAPS_API_KEY = '';
