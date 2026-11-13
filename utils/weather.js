/**
 * Presentation helpers for Open-Meteo responses.
 * Times from the API are local ISO strings like "2026-11-12T17:30"
 * (the requests pass timezone=auto), so they are read by position rather
 * than through Date to avoid device-timezone drift.
 */

/*
 * WMO weather interpretation codes -> label key + Lucide icon for day/night.
 * Ordered from mildest to most severe: the array index is the severity rank.
 */
const CONDITIONS = [
  { codes: [0], key: 'clear', day: 'sun', night: 'moon' },
  { codes: [1], key: 'mainly_clear', day: 'sun', night: 'moon' },
  { codes: [2], key: 'partly_cloudy', day: 'cloud-sun', night: 'cloud-moon' },
  { codes: [3], key: 'overcast', day: 'cloud', night: 'cloud' },
  { codes: [45, 48], key: 'fog', day: 'cloud-fog', night: 'cloud-fog' },
  { codes: [51, 53, 55], key: 'drizzle', day: 'cloud-drizzle', night: 'cloud-drizzle' },
  { codes: [80, 81], key: 'showers', day: 'cloud-sun-rain', night: 'cloud-moon-rain' },
  { codes: [61, 63], key: 'rain', day: 'cloud-rain', night: 'cloud-rain' },
  { codes: [65, 82], key: 'heavy_rain', day: 'cloud-rain-wind', night: 'cloud-rain-wind' },
  { codes: [56, 57], key: 'freezing_drizzle', day: 'cloud-hail', night: 'cloud-hail' },
  { codes: [66, 67], key: 'freezing_rain', day: 'cloud-hail', night: 'cloud-hail' },
  { codes: [85, 86], key: 'snow_showers', day: 'cloud-snow', night: 'cloud-snow' },
  { codes: [71, 73, 75, 77], key: 'snow', day: 'cloud-snow', night: 'cloud-snow' },
  { codes: [95, 96, 99], key: 'thunderstorm', day: 'cloud-lightning', night: 'cloud-lightning' },
];

// Drizzle and everything more severe counts as precipitation
const PRECIP_RANK = CONDITIONS.findIndex((c) => c.key === 'drizzle');

// A day is drawn as wet only when rain is likely, not merely possible
const WET_PROBABILITY = 40; // %
const WET_AMOUNT = 1; // mm over the day

// Icons where the sun is the subject get the warm accent; everything else is white
const SUNNY_ICONS = ['sun', 'cloud-sun', 'cloud-sun-rain'];
const SUN_COLOR = '#ffd27a';
const ICON_COLOR = '#ffffff';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function rankOf(code) {
  return CONDITIONS.findIndex((c) => c.codes.indexOf(code) !== -1);
}

function describeRank(rank, isDay, labels) {
  const match = CONDITIONS[rank];
  let icon = 'thermometer';
  if (match) {
    icon = isDay ? match.day : match.night;
  }

  return {
    icon,
    iconColor: SUNNY_ICONS.indexOf(icon) !== -1 ? SUN_COLOR : ICON_COLOR,
    label: match ? labels[match.key] : labels.unknown,
  };
}

export function describeWeather(code, isDay, labels) {
  return describeRank(rankOf(code), isDay, labels);
}

/**
 * Severity rank that best describes a whole day, from its daytime hourly codes.
 *
 * Open-Meteo's daily weather_code is the MOST SEVERE hour of the day, so a
 * single hour of drizzle at 3 am would label a sunny day as rain. Instead:
 *  - if rain is likely (probability or amount), show the worst wet daytime hour;
 *  - otherwise show the condition covering the most daylight hours.
 * Returns -1 when there are no usable hours.
 */
export function summariseDay(daytimeCodes, probabilityMax, precipitationSum) {
  const ranks = daytimeCodes.map(rankOf).filter((r) => r >= 0);
  if (!ranks.length) {
    return -1;
  }

  const wet = ranks.filter((r) => r >= PRECIP_RANK);
  const likely = probabilityMax >= WET_PROBABILITY || precipitationSum >= WET_AMOUNT;
  if (wet.length && likely) {
    return Math.max.apply(null, wet);
  }

  // Vote by icon so "clear" and "mainly clear" hours count together;
  // ties go to the more severe group
  const groups = {};
  ranks.forEach((r) => {
    const icon = CONDITIONS[r].day;
    groups[icon] = groups[icon] || { votes: 0, top: r };
    groups[icon].votes += 1;
    groups[icon].top = Math.max(groups[icon].top, r);
  });
  const winner = Object.keys(groups)
    .sort((a, b) => groups[b].votes - groups[a].votes || groups[b].top - groups[a].top)[0];

  // Within the winning icon, the most frequent rank decides the label
  const count = {};
  ranks.filter((r) => CONDITIONS[r].day === winner).forEach((r) => {
    count[r] = (count[r] || 0) + 1;
  });
  return Number(Object.keys(count).sort((a, b) => count[b] - count[a] || b - a)[0]);
}

export function toCompass(degrees) {
  const normalised = ((degrees % 360) + 360) % 360;
  return COMPASS[Math.round(normalised / 45) % 8];
}

export function timeOf(iso) {
  return iso ? iso.slice(11, 16) : '--:--';
}

function minutesOf(iso) {
  return Number.parseInt(iso.slice(11, 13), 10) * 60 + Number.parseInt(iso.slice(14, 16), 10);
}

export function greetingKey(iso) {
  const hour = Number.parseInt(iso.slice(11, 13), 10);
  if (hour < 12) return 'greeting_morning';
  if (hour < 18) return 'greeting_afternoon';
  return 'greeting_evening';
}

export function humidityKey(percent) {
  if (percent < 30) return 'humidity_dry';
  if (percent < 65) return 'humidity_comfortable';
  return 'humidity_humid';
}

/**
 * Position of the sun on a half-circle arc, as percentages of the arc box
 * (x from the left, y from the horizon). Clamped to the horizon at night.
 * `trail` is the rotation (deg) for the elapsed-daylight ring in the template.
 */
export function sunPosition(nowIso, sunriseIso, sunsetIso) {
  const now = minutesOf(nowIso);
  const rise = minutesOf(sunriseIso);
  const set = minutesOf(sunsetIso);
  const progress = Math.min(Math.max((now - rise) / Math.max(set - rise, 1), 0), 1);
  const angle = Math.PI * progress;

  return {
    x: ((1 - Math.cos(angle)) / 2 * 100).toFixed(1),
    y: (Math.sin(angle) * 100).toFixed(1),
    trail: (180 * progress - 45).toFixed(1),
    up: now >= rise && now <= set,
  };
}

/*
 * ---------- Hour-by-hour sun dial ----------
 * One full turn of the dial is one day-night cycle:
 *  - top half: today's daylight, sunrise (left horizon) over the top to sunset (right);
 *  - bottom half: the night after, sunset back round to tomorrow's sunrise.
 * Angles (phi, radians) run clockwise from the sunrise point: 0 .. 2π.
 * Minutes are counted from today's local midnight (tomorrow's run past 1440).
 */

const TWO_PI = Math.PI * 2;

export function buildDayCycle(daily, hourly, nowIso, t) {
  const rise = minutesOf(daily.sunrise[0]);
  const set = minutesOf(daily.sunset[0]);
  const nextRise = 1440 + minutesOf(daily.sunrise[1] || daily.sunrise[0]);
  const hours = [];

  if (hourly && hourly.time && hourly.time.length) {
    const base = minutesOf(hourly.time[0]); // the API starts at today's 00:00
    const count = Math.min(hourly.time.length, 48);

    for (let i = 0; i < count; i++) {
      const condition = describeWeather(hourly.weather_code[i], hourly.is_day[i] === 1, t.conditions);
      const rain = hourly.precipitation_probability ? hourly.precipitation_probability[i] : 0;
      hours.push({
        minute: base + i * 60,
        time: hourly.time[i].slice(11, 16),
        temp: Math.round(hourly.temperature_2m[i]),
        icon: condition.icon,
        iconColor: condition.iconColor,
        label: condition.label,
        rain: rain || 0,
        wind: Math.round(hourly.wind_speed_10m[i]),
        humidity: hourly.relative_humidity_2m[i],
      });
    }
  }

  return { rise, set, nextRise, now: minutesOf(nowIso), hours };
}

// Minute of the cycle -> dial angle, clamped to the cycle
export function cycleAngle(cycle, minute) {
  if (minute <= cycle.set) {
    const day = (minute - cycle.rise) / Math.max(cycle.set - cycle.rise, 1);
    return Math.max(day, 0) * Math.PI;
  }
  const night = (minute - cycle.set) / Math.max(cycle.nextRise - cycle.set, 1);
  return Math.PI + Math.min(night, 1) * Math.PI;
}

// Dial angle -> minute of the cycle
export function cycleMinute(cycle, phi) {
  if (phi <= Math.PI) {
    return cycle.rise + (phi / Math.PI) * (cycle.set - cycle.rise);
  }
  return cycle.set + ((phi - Math.PI) / Math.PI) * (cycle.nextRise - cycle.set);
}

/**
 * The forecast hour closest to a minute of the cycle, kept inside the half
 * it belongs to: daylight hours on the top half, night hours on the bottom,
 * so the readout always matches where the marker is.
 */
export function cycleHour(cycle, minute, night) {
  const hours = cycle.hours;
  if (!hours.length) {
    return null;
  }

  const last = hours.length - 1;
  const lo = night ? cycle.set : cycle.rise;
  const hi = night ? cycle.nextRise : cycle.set;
  let index = Math.min(Math.max(Math.round((minute - hours[0].minute) / 60), 0), last);

  while (index < last && hours[index].minute < lo) index += 1;
  while (index > 0 && hours[index].minute > hi) index -= 1;
  return hours[index];
}

// Point on the dial ring for an angle, as % of the dial's square face
export function dialPoint(phi) {
  return {
    x: (50 - 50 * Math.cos(phi)).toFixed(2),
    y: (50 - 50 * Math.sin(phi)).toFixed(2),
  };
}

/**
 * Angle under a finger. (x, y) and the face rect are in the same viewport px.
 * While dragging, crossing the sunrise seam on the left would jump from one
 * end of the cycle to the other, so the angle sticks to the end it came from.
 */
export function angleAt(rect, x, y, previous) {
  const radius = rect.width / 2;
  const dx = x - (rect.left + radius);
  const dy = (rect.top + radius) - y;
  let phi = Math.PI - Math.atan2(dy, dx); // 0 .. 2π, clockwise from the left horizon

  if (previous !== undefined && previous !== null && Math.abs(phi - previous) > Math.PI) {
    phi = previous < Math.PI ? 0 : TWO_PI;
  }
  return Math.min(Math.max(phi, 0), TWO_PI);
}

function dayLabel(dateStr, index, t) {
  if (index === 0) return t.today;
  const parts = dateStr.split('-').map(Number);
  return t.days[new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay()];
}

/**
 * Hourly weather codes grouped by date: the daylight hours (is_day from the
 * API, so sunrise/sunset fit the place and season) and, as a fallback, all hours.
 */
function hourlyCodesByDate(hourly) {
  const byDate = {};
  if (!hourly || !hourly.time) {
    return byDate;
  }

  hourly.time.forEach((time, i) => {
    const date = time.slice(0, 10);
    byDate[date] = byDate[date] || { day: [], all: [] };
    byDate[date].all.push(hourly.weather_code[i]);
    if (hourly.is_day[i] === 1) {
      byDate[date].day.push(hourly.weather_code[i]);
    }
  });
  return byDate;
}

/**
 * Rows for the 7-day list. Each row carries a min-to-max bar positioned on a
 * shared scale for the whole week, so warmer days visibly sit further right.
 */
export function buildForecast(daily, hourly, t) {
  const mins = daily.temperature_2m_min;
  const maxs = daily.temperature_2m_max;
  const weekLow = Math.min.apply(null, mins);
  const weekHigh = Math.max.apply(null, maxs);
  const span = Math.max(weekHigh - weekLow, 1);
  const hours = hourlyCodesByDate(hourly);

  return daily.time.map((date, i) => {
    const rain = (daily.precipitation_probability_max && daily.precipitation_probability_max[i]) || 0;
    const amount = (daily.precipitation_sum && daily.precipitation_sum[i]) || 0;

    let codes = [];
    if (hours[date]) {
      codes = hours[date].day.length ? hours[date].day : hours[date].all;
    }
    let rank = summariseDay(codes, rain, amount);
    if (rank < 0) {
      rank = rankOf(daily.weather_code[i]); // no hourly data: the daily code is all we have
    }
    const condition = describeRank(rank, true, t.conditions);

    return {
      date,
      day: dayLabel(date, i, t),
      isToday: i === 0,
      icon: condition.icon,
      iconColor: condition.iconColor,
      label: condition.label,
      rain,
      min: Math.round(mins[i]),
      max: Math.round(maxs[i]),
      barLeft: ((mins[i] - weekLow) / span * 100).toFixed(1),
      barWidth: Math.max((maxs[i] - mins[i]) / span * 100, 8).toFixed(1),
    };
  });
}
