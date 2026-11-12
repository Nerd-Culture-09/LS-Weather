import { DEFAULT_PLACE } from '../constants/app_constants';

/*
 * The selected place plus recent and saved places, kept in local storage
 * so they survive restarts. Saved places are the trip-planning list.
 */

const KEYS = {
  current: 'ls.place',
  recent: 'ls.recentPlaces',
  saved: 'ls.savedPlaces',
};

const MAX_RECENT = 6;

function read(key, fallback) {
  try {
    const res = my.getStorageSync({ key });
    return res && res.data !== undefined && res.data !== null ? res.data : fallback;
  } catch (error) {
    return fallback;
  }
}

function write(key, data) {
  try {
    my.setStorageSync({ key, data });
  } catch (error) {
    console.log('Storage write failed', key, error);
  }
}

export function getCurrentPlace() {
  return read(KEYS.current, null) || DEFAULT_PLACE;
}

export function setCurrentPlace(place) {
  write(KEYS.current, place);

  // "Current location" changes as you move, so it is not worth remembering
  if (!place.isCurrent) {
    const others = getRecentPlaces().filter((p) => p.id !== place.id);
    write(KEYS.recent, [place].concat(others).slice(0, MAX_RECENT));
  }
}

export function getRecentPlaces() {
  return read(KEYS.recent, []);
}

export function getSavedPlaces() {
  return read(KEYS.saved, []);
}

// Returns true if the place is saved after the toggle
export function toggleSavedPlace(place) {
  const saved = getSavedPlaces();
  const exists = saved.some((p) => p.id === place.id);
  write(KEYS.saved, exists ? saved.filter((p) => p.id !== place.id) : saved.concat([place]));
  return !exists;
}

export function samePlace(a, b) {
  return Boolean(a && b) && a.id === b.id && a.latitude === b.latitude && a.longitude === b.longitude;
}
