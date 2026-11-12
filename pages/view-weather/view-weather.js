import { weatherApi } from '../../services/api';
import { loadLanguage } from '../../i18n/i18n';
import { getCurrentPlace, samePlace } from '../../services/place-store';
import { getTopInset } from '../../utils/layout';
import {
  describeWeather,
  toCompass,
  timeOf,
  greetingKey,
  humidityKey,
  sunPosition,
  buildForecast,
  buildDayCycle,
  cycleAngle,
  cycleMinute,
  cycleHour,
  dialPoint,
  angleAt,
} from '../../utils/weather';

const app = getApp();

const TWO_PI = Math.PI * 2;
// Cap dial redraws while dragging (~30 per second)
const DIAL_RENDER_MS = 32;

// "Mohale's Hoek District, Lesotho" -> "Mohale's Hoek District · Lesotho"
function placeDetail(place) {
  return (place.subtitle || '').split(', ').filter(Boolean).join(' · ');
}

// "lerato" -> "Lerato", "mary-ann" -> "Mary-Ann"
function displayName(name) {
  return name.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (match, sep, letter) => sep + letter.toUpperCase());
}

Page({
  data: {
    i18n: null,
    topInset: 0,
    place: {},
    placeDetail: '',
    firstname: '',
    // 'loading' (first fetch) | 'ready' | 'error'
    status: 'loading',
    refreshing: false,
    greeting: '',
    current: {},
    today: {},
    sun: {},
    forecast: [],
    // Hour-by-hour sun dial (see dialState)
    dial: { open: false },
  },

  onLoad(options) {
    loadLanguage(app.languageCode || 'en');
    const place = getCurrentPlace();

    this.setData({
      i18n: app.i18n,
      topInset: getTopInset(),
      place,
      placeDetail: placeDetail(place),
      firstname: displayName(decodeURIComponent(options.firstname || '')),
    });

    this.loadWeather();
  },

  // Coming back from the place picker with a different place
  onShow() {
    const place = getCurrentPlace();
    if (this.data.i18n && !samePlace(place, this.data.place)) {
      this.setData({ place, placeDetail: placeDetail(place), status: 'loading' });
      my.pageScrollTo({ scrollTop: 0, duration: 0 });
      this.loadWeather();
    }
  },

  onChangePlace() {
    my.navigateTo({ url: '/pages/places/places' });
  },

  async loadWeather() {
    // Keep the dashboard on screen during a refresh; only the first load blanks it
    const hasData = this.data.status === 'ready';
    const place = this.data.place;
    this.setData(hasData ? { refreshing: true } : { status: 'loading' });

    try {
      const [now, outlook] = await Promise.all([
        weatherApi.getCurrentWeather(place),
        weatherApi.getWeatherForcast(place),
      ]);

      // Ignore a response for a place the user has already switched away from
      if (!samePlace(place, this.data.place)) {
        return;
      }

      this.setData(Object.assign({ status: 'ready' }, this.present(now, outlook)));
    } catch (error) {
      console.log('Weather request failed', error);

      if (!samePlace(place, this.data.place)) {
        return;
      }

      if (hasData) {
        my.showToast({ type: 'fail', content: this.data.i18n.general.api_error_heading });
      } else {
        this.setData({ status: 'error' });
      }
    } finally {
      this.setData({ refreshing: false });
    }
  },

  // Shapes the two Open-Meteo responses into what the template renders
  present(now, outlook) {
    const t = this.data.i18n.weather;
    const c = now.current;
    const d = outlook.daily;
    const condition = describeWeather(c.weather_code, c.is_day === 1, t.conditions);
    const rainToday = d.precipitation_probability_max ? d.precipitation_probability_max[0] : 0;

    // Kept off `data`: 48 hourly rows the template never renders as a list
    this.cycle = buildDayCycle(d, outlook.hourly, c.time, t);
    this.dialPhi = this.nowAngle();

    return {
      greeting: t[greetingKey(c.time)],
      current: {
        temp: Math.round(c.temperature_2m),
        feelsLike: Math.round(c.apparent_temperature),
        icon: condition.icon,
        iconColor: condition.iconColor,
        label: condition.label,
        humidity: c.relative_humidity_2m,
        humidityNote: t[humidityKey(c.relative_humidity_2m)],
        wind: Math.round(c.wind_speed_10m),
        windDir: toCompass(c.wind_direction_10m),
        // wind_direction is where it blows from; the arrow points where it is going
        windArrow: (c.wind_direction_10m + 180) % 360,
        precipitation: c.precipitation,
        updated: timeOf(c.time),
      },
      today: {
        max: Math.round(d.temperature_2m_max[0]),
        min: Math.round(d.temperature_2m_min[0]),
        rain: rainToday || 0,
        sunrise: timeOf(d.sunrise[0]),
        sunset: timeOf(d.sunset[0]),
      },
      sun: sunPosition(c.time, d.sunrise[0], d.sunset[0]),
      forecast: buildForecast(d, outlook.hourly, t),
      dial: this.dialState(this.dialPhi, this.data.dial.open),
    };
  },

  // ---------- Hour-by-hour sun dial ----------

  nowAngle() {
    return cycleAngle(this.cycle, this.cycle.now);
  },

  // Everything the dial template needs for a marker angle
  dialState(phi, open) {
    const cycle = this.cycle;
    const t = this.data.i18n.weather;
    const night = phi > Math.PI;
    const hour = cycleHour(cycle, cycleMinute(cycle, phi), night);
    const nowPhi = this.nowAngle();
    const nowHour = cycleHour(cycle, cycle.now, nowPhi > Math.PI);

    let when = t.today;
    if (hour && hour.minute >= 1440) {
      when = t.tomorrow;
    } else if (night) {
      when = t.tonight;
    }

    return {
      open,
      night,
      // Past sunset the dial opens to the full circle so the night half shows
      full: night,
      marker: dialPoint(phi),
      nowPoint: dialPoint(nowPhi),
      // Same half-ring rotation trick as the compact arc, one ring per half
      trailDay: (180 * Math.min(phi, Math.PI) / Math.PI - 45).toFixed(1),
      trailNight: (180 * Math.max(phi - Math.PI, 0) / Math.PI - 45).toFixed(1),
      sel: hour,
      when,
      // Hides the "Now" button while the readout already shows the current hour
      atNow: hour === nowHour,
    };
  },

  onToggleSun() {
    if (!this.cycle) {
      return;
    }
    const open = !this.data.dial.open;
    this.dialPhi = this.nowAngle();
    // Measure as soon as the dial is on screen, so the first drag responds immediately
    this.setData({ dial: this.dialState(this.dialPhi, open) }, () => {
      if (open) {
        this.measureDial();
      }
    });
  },

  onDialNow() {
    this.dialPhi = this.nowAngle();
    this.setData({ dial: this.dialState(this.dialPhi, true) });
  },

  /*
   * The dial is measured in page coordinates (viewport rect + scroll offset)
   * and fingers are read with pageX/pageY, so the sun stays under the finger
   * even if the page scrolls mid-drag (the dial sets disableScroll, but not
   * every runtime honours it).
   */
  // Async: stores the dial face's position in page coordinates
  measureDial(done) {
    my.createSelectorQuery()
      .select('#ls-dial-face').boundingClientRect()
      .selectViewport().scrollOffset()
      .exec((res) => {
        const rect = res && res[0];
        const scroll = (res && res[1]) || {};
        if (rect) {
          this.dialRect = {
            left: rect.left + (scroll.scrollLeft || 0),
            top: rect.top + (scroll.scrollTop || 0),
            width: rect.width,
          };
          this.dialScroll = scroll;
        }
        if (done) {
          done();
        }
      });
  },

  onDialTouchStart(e) {
    const touch = e.touches && e.touches[0];
    if (!touch || !this.cycle) {
      return;
    }
    this.dialDragging = true;
    this.dialMoved = false;
    this.dialTouch = this.pagePoint(touch, this.dialScroll);

    // Respond at once with the last measurement (if any)...
    if (this.dialRect) {
      this.applyDialTouch();
    }
    // ...and re-measure in case the layout changed; then apply the latest finger position
    this.measureDial(() => {
      if (this.dialDragging && this.dialTouch) {
        this.applyDialTouch();
      }
    });
  },

  onDialTouchMove(e) {
    const touch = e.touches && e.touches[0];
    if (!touch || !this.dialDragging) {
      return;
    }
    this.dialTouch = this.pagePoint(touch, this.dialScroll);
    if (this.dialRect) {
      this.applyDialTouch();
    }
  },

  applyDialTouch() {
    // The first point of a drag jumps straight to the finger; later ones keep seam continuity
    this.moveDial(this.dialTouch.x, this.dialTouch.y, this.dialMoved);
    this.dialMoved = true;
  },

  // Finger position in page coordinates
  pagePoint(touch, scroll) {
    if (typeof touch.pageY === 'number') {
      return { x: touch.pageX, y: touch.pageY };
    }
    const s = scroll || { scrollTop: 0, scrollLeft: 0 };
    return { x: touch.clientX + (s.scrollLeft || 0), y: touch.clientY + (s.scrollTop || 0) };
  },

  // Settle the marker on the hour the readout is showing
  onDialTouchEnd() {
    clearTimeout(this.dialTimer);
    this.dialTimer = null;
    this.dialDragging = false;
    this.dialTouch = null;
    if (!this.cycle) {
      return;
    }

    const night = this.dialPhi > Math.PI;
    const hour = cycleHour(this.cycle, cycleMinute(this.cycle, this.dialPhi), night);
    if (hour) {
      this.dialPhi = Math.min(Math.max(cycleAngle(this.cycle, hour.minute), 0), TWO_PI);
    }
    this.setData({ dial: this.dialState(this.dialPhi, true) });
  },

  moveDial(x, y, dragging) {
    this.dialPhi = angleAt(this.dialRect, x, y, dragging ? this.dialPhi : null);

    if (Date.now() - (this.dialDrawnAt || 0) >= DIAL_RENDER_MS) {
      this.drawDial();
    } else if (!this.dialTimer) {
      this.dialTimer = setTimeout(() => {
        this.dialTimer = null;
        this.drawDial();
      }, DIAL_RENDER_MS);
    }
  },

  drawDial() {
    this.dialDrawnAt = Date.now();
    this.setData({ dial: this.dialState(this.dialPhi, true) });
  },

  onRefresh() {
    if (this.data.refreshing || this.data.status === 'loading') {
      return;
    }
    this.loadWeather();
  },
});
