import { loadLanguage } from '../../i18n/i18n';
import { getTopInset } from '../../utils/layout';
import {
  searchPlaces,
  reverseGeocode,
  getDeviceLocation,
  usingGoogle,
} from '../../services/places';
import {
  setCurrentPlace,
  getRecentPlaces,
  getSavedPlaces,
  toggleSavedPlace,
} from '../../services/place-store';

const app = getApp();

const SEARCH_DELAY_MS = 350;
const MIN_QUERY_LENGTH = 2;

// Only these fields are stored; `saved` is display-only
function toPlace(item) {
  return {
    id: item.id,
    name: item.name,
    subtitle: item.subtitle,
    latitude: item.latitude,
    longitude: item.longitude,
    countryCode: item.countryCode || '',
    source: item.source,
    isCurrent: Boolean(item.isCurrent),
  };
}

function formatCoords(latitude, longitude) {
  const lat = Math.abs(latitude).toFixed(2) + '°' + (latitude < 0 ? 'S' : 'N');
  const lon = Math.abs(longitude).toFixed(2) + '°' + (longitude < 0 ? 'W' : 'E');
  return lat + ', ' + lon;
}

Page({
  data: {
    i18n: null,
    topInset: 0,
    query: '',
    searchActive: false,
    searching: false,
    searchError: false,
    provider: 'open-meteo',
    results: [],
    saved: [],
    recent: [],
    locating: false,
    locationErrorVisible: false,
  },

  onLoad() {
    loadLanguage(app.languageCode || 'en');
    this.searchTimer = null;
    this.searchSeq = 0;

    this.setData({
      i18n: app.i18n,
      topInset: getTopInset(),
      provider: usingGoogle() ? 'google' : 'open-meteo',
    });
    this.refreshLists();
  },

  onUnload() {
    clearTimeout(this.searchTimer);
  },

  // Re-reads saved/recent and marks which rows are saved
  refreshLists(results) {
    const saved = getSavedPlaces();
    const savedIds = saved.map((p) => p.id);
    const decorate = (list) => list.map((p) => Object.assign({}, p, {
      saved: savedIds.indexOf(p.id) !== -1,
    }));

    this.setData({
      saved: decorate(saved),
      recent: decorate(getRecentPlaces().filter((p) => savedIds.indexOf(p.id) === -1)),
      results: decorate(results || this.data.results),
    });
  },

  // ---------- Search ----------

  onQueryInput(e) {
    const query = e.detail.value;
    const active = query.trim().length >= MIN_QUERY_LENGTH;

    clearTimeout(this.searchTimer);
    this.setData({ query, searchActive: active });

    if (!active) {
      this.searchSeq += 1; // drop any in-flight response
      this.setData({ results: [], searching: false, searchError: false });
      return;
    }

    this.setData({ searching: true });
    this.searchTimer = setTimeout(() => this.runSearch(query.trim()), SEARCH_DELAY_MS);
  },

  onSearchConfirm() {
    const query = this.data.query.trim();
    if (query.length >= MIN_QUERY_LENGTH) {
      clearTimeout(this.searchTimer);
      this.runSearch(query);
    }
  },

  onClearQuery() {
    clearTimeout(this.searchTimer);
    this.searchSeq += 1;
    this.setData({ query: '', searchActive: false, results: [], searching: false, searchError: false });
  },

  async runSearch(query) {
    this.searchSeq += 1;
    const seq = this.searchSeq;

    try {
      const response = await searchPlaces(query);
      if (seq !== this.searchSeq) return; // a newer search has started
      this.setData({ provider: response.provider, searchError: false });
      this.refreshLists(response.places);
    } catch (error) {
      if (seq !== this.searchSeq) return;
      console.log('Place search failed', error);
      this.setData({ results: [], searchError: true });
    } finally {
      if (seq === this.searchSeq) {
        this.setData({ searching: false });
      }
    }
  },

  // ---------- Selecting / saving ----------

  onSelectPlace(e) {
    const { list, index } = e.currentTarget.dataset;
    this.choose(toPlace(this.data[list][index]));
  },

  onToggleSaved(e) {
    const { list, index } = e.currentTarget.dataset;
    const nowSaved = toggleSavedPlace(toPlace(this.data[list][index]));
    this.refreshLists();
    my.showToast({
      type: 'none',
      content: nowSaved ? this.data.i18n.places.saved_toast : this.data.i18n.places.removed_toast,
      duration: 1200,
    });
  },

  choose(place) {
    setCurrentPlace(place);

    if (getCurrentPages().length > 1) {
      my.navigateBack();
    } else {
      my.redirectTo({ url: '/pages/view-weather/view-weather' });
    }
  },

  // ---------- Current location ----------

  async onUseCurrentLocation() {
    if (this.data.locating) {
      return;
    }

    this.setData({ locating: true });
    const t = this.data.i18n.places;

    try {
      const coords = await getDeviceLocation();
      let named = null;

      try {
        named = await reverseGeocode(coords.latitude, coords.longitude);
      } catch (error) {
        console.log('Reverse geocoding failed', error);
      }

      this.choose({
        id: 'current',
        isCurrent: true,
        name: named ? named.name : t.current_location,
        subtitle: named ? named.subtitle : formatCoords(coords.latitude, coords.longitude),
        latitude: coords.latitude,
        longitude: coords.longitude,
        countryCode: named ? named.countryCode : '',
        source: named ? 'google' : 'device',
      });
    } catch (error) {
      console.log('Location unavailable', error);
      this.setData({ locationErrorVisible: true });
    } finally {
      this.setData({ locating: false });
    }
  },

  onCloseLocationError() {
    this.setData({ locationErrorVisible: false });
  },
});
