import {
  describeWeather,
  summariseDay,
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
import en from '../../i18n/en.json';
import mohalesHoek from '../fixtures/mohales-hoek-forecast.json';
import maseruForecast from '../fixtures/maseru-forecast.json';
import maseruCurrent from '../fixtures/maseru-current.json';

const t = en.weather;
const SUN = '#ffd27a';
const WHITE = '#ffffff';

/*
 * Builds an Open-Meteo style forecast. Each day lists the codes for its
 * daylight hours (06:00-17:00); night hours use `night` (default clear).
 */
function forecast(days) {
  const daily = {
    time: [], weather_code: [], temperature_2m_min: [], temperature_2m_max: [],
    precipitation_probability_max: [], precipitation_sum: [],
  };
  const hourly = { time: [], weather_code: [], is_day: [] };

  days.forEach((d, i) => {
    const date = `2026-11-${String(12 + i).padStart(2, '0')}`;
    daily.time.push(date);
    daily.weather_code.push(d.dailyCode !== undefined ? d.dailyCode : 0);
    daily.temperature_2m_min.push(d.min !== undefined ? d.min : 10);
    daily.temperature_2m_max.push(d.max !== undefined ? d.max : 20);
    daily.precipitation_probability_max.push(d.chance || 0);
    daily.precipitation_sum.push(d.mm || 0);

    for (let h = 0; h < 24; h++) {
      const isDay = h >= 6 && h < 18;
      hourly.time.push(`${date}T${String(h).padStart(2, '0')}:00`);
      hourly.is_day.push(isDay ? 1 : 0);
      hourly.weather_code.push(isDay ? d.day[h - 6] : (d.night !== undefined ? d.night : 0));
    }
  });
  return { daily, hourly };
}

const allDay = (code) => Array(12).fill(code);

describe('describeWeather', () => {
  it('picks the day or night icon for the same code', () => {
    expect(describeWeather(0, true, t.conditions)).toEqual({ icon: 'sun', iconColor: SUN, label: 'Clear' });
    expect(describeWeather(0, false, t.conditions)).toEqual({ icon: 'moon', iconColor: WHITE, label: 'Clear' });
  });

  it('uses a warm tint only when the sun is the subject', () => {
    expect(describeWeather(2, true, t.conditions).iconColor).toBe(SUN); // cloud-sun
    expect(describeWeather(80, true, t.conditions).iconColor).toBe(SUN); // cloud-sun-rain
    expect(describeWeather(3, true, t.conditions).iconColor).toBe(WHITE); // cloud
    expect(describeWeather(95, true, t.conditions).iconColor).toBe(WHITE); // storm
  });

  it.each([
    [45, 'cloud-fog', 'Fog'],
    [53, 'cloud-drizzle', 'Drizzle'],
    [63, 'cloud-rain', 'Rain'],
    [65, 'cloud-rain-wind', 'Heavy rain'],
    [82, 'cloud-rain-wind', 'Heavy rain'],
    [66, 'cloud-hail', 'Freezing rain'],
    [73, 'cloud-snow', 'Snow'],
    [99, 'cloud-lightning', 'Thunderstorm'],
  ])('maps WMO code %i to %s / %s', (code, icon, label) => {
    expect(describeWeather(code, true, t.conditions)).toMatchObject({ icon, label });
  });

  it('falls back to a thermometer for codes it does not know', () => {
    expect(describeWeather(42, true, t.conditions)).toEqual({ icon: 'thermometer', iconColor: WHITE, label: 'Unknown' });
  });
});

describe('summariseDay', () => {
  it('returns -1 when there are no hours to summarise', () => {
    expect(summariseDay([], 0, 0)).toBe(-1);
    expect(summariseDay([42, 42], 0, 0)).toBe(-1);
  });

  it('ignores a passing shower when rain is unlikely', () => {
    const sunny = summariseDay(allDay(0), 0, 0);
    expect(summariseDay([0, 0, 0, 0, 0, 0, 51, 0, 0, 0, 0, 0], 14, 0.3)).toBe(sunny);
  });

  it('shows the worst wet hour once rain is likely by chance or amount', () => {
    const storm = summariseDay([95], 100, 6);
    expect(summariseDay([1, 51, 53, 95, 51, 1], 100, 6)).toBe(storm);
    expect(summariseDay([0, 0, 61, 0], 20, 1.5)).toBe(summariseDay([61], 20, 1.5)); // 1.5 mm, low chance
  });

  it('counts clear and mainly clear hours together against cloud', () => {
    // 4 clear + 4 mainly clear (both the sun icon) beat 5 overcast hours...
    const day = [0, 0, 0, 0, 1, 1, 1, 1, 3, 3, 3, 3, 3];
    const result = summariseDay(day, 0, 0);
    expect(result).not.toBe(summariseDay([3], 0, 0));
    // ...and the 4-4 label tie inside the sun group goes to the more severe "mainly clear"
    expect(result).toBe(summariseDay([1], 0, 0));
  });

  it('breaks a tie towards the more severe condition', () => {
    const day = [0, 0, 0, 3, 3, 3];
    expect(summariseDay(day, 0, 0)).toBe(summariseDay([3], 0, 0));
  });
});

describe('buildForecast', () => {
  /*
   * Regression: the 7-day list used Open-Meteo's daily weather_code, which is
   * the day's single worst hour. One hour of drizzle at 1 am made a sunny day
   * show rain. This is the real Mohale's Hoek data where that happened.
   */
  describe('real data that used to show the wrong icons (Mohale\'s Hoek)', () => {
    const rows = buildForecast(mohalesHoek.daily, mohalesHoek.hourly, t);

    it('still has the misleading daily codes in the fixture', () => {
      expect(mohalesHoek.daily.weather_code).toEqual([0, 3, 55, 95, 1, 51, 51]);
    });

    it('summarises each day from its daylight hours', () => {
      expect(rows.map((r) => r.icon)).toEqual([
        'sun', 'sun', 'cloud-drizzle', 'cloud-lightning', 'sun', 'sun', 'sun',
      ]);
      expect(rows.map((r) => r.label)).toEqual([
        'Clear', 'Clear', 'Drizzle', 'Thunderstorm', 'Clear', 'Clear', 'Mainly clear',
      ]);
    });

    it('keeps the rain chance badge from the API', () => {
      expect(rows.map((r) => r.rain)).toEqual([0, 0, 73, 100, 14, 14, 34]);
    });

    it('labels the first row Today and the rest by weekday', () => {
      expect(rows.map((r) => r.day)).toEqual(['Today', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed']);
      expect(rows[0].isToday).toBe(true);
      expect(rows.slice(1).every((r) => !r.isToday)).toBe(true);
    });
  });

  it('only looks at daylight hours (a wet night does not make a wet day)', () => {
    const { daily, hourly } = forecast([{ dailyCode: 61, day: allDay(0), night: 61, chance: 30, mm: 0.4 }]);
    expect(buildForecast(daily, hourly, t)[0]).toMatchObject({ icon: 'sun', label: 'Clear' });
  });

  it('uses all hours on a day with no daylight (polar night)', () => {
    const { daily, hourly } = forecast([{ day: allDay(3), night: 3 }]);
    hourly.is_day = hourly.is_day.map(() => 0);
    expect(buildForecast(daily, hourly, t)[0]).toMatchObject({ icon: 'cloud', label: 'Overcast' });
  });

  it('treats missing rain fields as no rain', () => {
    const { daily, hourly } = forecast([{ day: allDay(0) }]);
    delete daily.precipitation_probability_max;
    delete daily.precipitation_sum;
    expect(buildForecast(daily, hourly, t)[0]).toMatchObject({ rain: 0, icon: 'sun' });
  });

  it('falls back to the daily code when there is no hourly data', () => {
    const { daily } = forecast([{ dailyCode: 95, day: allDay(0) }]);
    expect(buildForecast(daily, undefined, t)[0]).toMatchObject({ icon: 'cloud-lightning' });
  });

  it('rounds temperatures and positions bars on one scale for the week', () => {
    const { daily, hourly } = forecast([
      { day: allDay(0), min: 9.6, max: 20.4 },
      { day: allDay(0), min: 14.2, max: 30.5 },
    ]);
    const rows = buildForecast(daily, hourly, t);

    expect(rows.map((r) => [r.min, r.max])).toEqual([[10, 20], [14, 31]]);
    // week runs 9.6 .. 30.5 (20.9 wide)
    expect(Number(rows[0].barLeft)).toBe(0);
    expect(Number(rows[1].barLeft)).toBeCloseTo((14.2 - 9.6) / 20.9 * 100, 1);
    expect(Number(rows[1].barWidth)).toBeCloseTo((30.5 - 14.2) / 20.9 * 100, 1);
  });

  it('never draws a bar narrower than 8%', () => {
    const { daily, hourly } = forecast([
      { day: allDay(0), min: 0, max: 30 },
      { day: allDay(0), min: 15, max: 15.1 },
    ]);
    expect(Number(buildForecast(daily, hourly, t)[1].barWidth)).toBe(8);
  });
});

describe('small formatters', () => {
  it.each([
    [0, 'N'], [44, 'NE'], [90, 'E'], [180, 'S'], [270, 'W'], [338, 'N'], [-90, 'W'], [720, 'N'],
  ])('toCompass(%i) is %s', (deg, dir) => {
    expect(toCompass(deg)).toBe(dir);
  });

  it('reads the clock time from a local ISO string', () => {
    expect(timeOf('2026-11-12T17:30')).toBe('17:30');
    expect(timeOf(undefined)).toBe('--:--');
  });

  it.each([
    ['2026-11-12T05:00', 'greeting_morning'],
    ['2026-11-12T11:59', 'greeting_morning'],
    ['2026-11-12T12:00', 'greeting_afternoon'],
    ['2026-11-12T17:59', 'greeting_afternoon'],
    ['2026-11-12T18:00', 'greeting_evening'],
  ])('greets %s with %s', (time, key) => {
    expect(greetingKey(time)).toBe(key);
  });

  it.each([[29, 'humidity_dry'], [30, 'humidity_comfortable'], [64, 'humidity_comfortable'], [65, 'humidity_humid']])(
    'describes %i%% humidity as %s',
    (value, key) => expect(humidityKey(value)).toBe(key),
  );
});

describe('sunPosition (compact arc)', () => {
  const rise = '2026-11-12T06:00';
  const set = '2026-11-12T18:00';

  it('starts on the left horizon at sunrise', () => {
    expect(sunPosition(rise, rise, set)).toEqual({ x: '0.0', y: '0.0', trail: '-45.0', up: true });
  });

  it('is at the top of the arc halfway through the day', () => {
    expect(sunPosition('2026-11-12T12:00', rise, set)).toEqual({ x: '50.0', y: '100.0', trail: '45.0', up: true });
  });

  it('rests on the right horizon after sunset and reports it is down', () => {
    expect(sunPosition('2026-11-12T21:00', rise, set)).toEqual({ x: '100.0', y: '0.0', trail: '135.0', up: false });
  });

  it('rests on the left horizon before sunrise', () => {
    expect(sunPosition('2026-11-12T04:00', rise, set)).toMatchObject({ x: '0.0', y: '0.0', up: false });
  });
});

describe('hour-by-hour dial maths', () => {
  // Maseru fixture: sunrise 05:08, sunset 18:39, tomorrow's sunrise 05:08, now 20:00
  const cycle = buildDayCycle(maseruForecast.daily, maseruForecast.hourly, maseruCurrent.current.time, t);
  const RISE = 5 * 60 + 8;
  const SET = 18 * 60 + 39;
  const NEXT_RISE = 1440 + RISE;

  it('reads the day-night cycle from the forecast', () => {
    expect(cycle).toMatchObject({ rise: RISE, set: SET, nextRise: NEXT_RISE, now: 20 * 60 });
    expect(cycle.hours).toHaveLength(48);
    expect(cycle.hours[0]).toMatchObject({ minute: 0, time: '00:00' });
    expect(cycle.hours[47]).toMatchObject({ minute: 47 * 60, time: '23:00' });
  });

  it('carries the hourly forecast values for the readout', () => {
    const noon = cycle.hours[12];
    expect(noon.temp).toBe(Math.round(maseruForecast.hourly.temperature_2m[12]));
    expect(noon.rain).toBe(maseruForecast.hourly.precipitation_probability[12]);
    expect(noon.wind).toBe(Math.round(maseruForecast.hourly.wind_speed_10m[12]));
    expect(noon.humidity).toBe(maseruForecast.hourly.relative_humidity_2m[12]);
    expect(noon.icon).toEqual(expect.any(String));
  });

  it.each([
    ['sunrise', RISE, 0],
    ['solar noon', (RISE + SET) / 2, Math.PI / 2],
    ['sunset', SET, Math.PI],
    ['midnight-ish (middle of the night)', (SET + NEXT_RISE) / 2, 1.5 * Math.PI],
    ["tomorrow's sunrise", NEXT_RISE, 2 * Math.PI],
  ])('puts %s at the right angle and back', (name, minute, angle) => {
    expect(cycleAngle(cycle, minute)).toBeCloseTo(angle, 10);
    expect(cycleMinute(cycle, angle)).toBeCloseTo(minute, 10);
  });

  it('clamps times outside the cycle to its ends', () => {
    expect(cycleAngle(cycle, 60)).toBe(0); // 01:00, before sunrise
    expect(cycleAngle(cycle, 2000)).toBe(2 * Math.PI); // past tomorrow's sunrise
  });

  it('keeps the readout on the side of the horizon the marker is on', () => {
    // Exactly at sunset (18:39): day side shows 18:00, night side shows 19:00
    expect(cycleHour(cycle, SET, false).time).toBe('18:00');
    expect(cycleHour(cycle, SET, true).time).toBe('19:00');
    // Exactly at sunrise (05:08): the day side must not show 05:00 (still dark)
    expect(cycleHour(cycle, RISE, false).time).toBe('06:00');
  });

  it('reaches into tomorrow for the late night', () => {
    const hour = cycleHour(cycle, cycleMinute(cycle, 1.5 * Math.PI), true);
    expect(hour).toMatchObject({ time: '00:00', minute: 1440 });
  });

  it('returns null when there is no hourly data', () => {
    expect(cycleHour({ ...cycle, hours: [] }, 600, false)).toBeNull();
  });

  it('builds an empty cycle without hourly data, and reuses today\'s sunrise if tomorrow\'s is missing', () => {
    const daily = { sunrise: ['2026-11-12T05:08'], sunset: ['2026-11-12T18:39'] };
    const bare = buildDayCycle(daily, undefined, '2026-11-12T12:00', t);
    expect(bare).toMatchObject({ nextRise: NEXT_RISE, hours: [] });
  });

  it('treats a missing hourly rain chance as 0%', () => {
    const hourly = { ...maseruForecast.hourly };
    delete hourly.precipitation_probability;
    const dry = buildDayCycle(maseruForecast.daily, hourly, maseruCurrent.current.time, t);
    expect(dry.hours.every((h) => h.rain === 0)).toBe(true);
  });

  it.each([
    [0, 0, 50],
    [Math.PI / 2, 50, 0],
    [Math.PI, 100, 50],
    [1.5 * Math.PI, 50, 100],
  ])('places angle %f at (%i%%, %i%%) of the dial face', (phi, x, y) => {
    const p = dialPoint(phi);
    expect(Number(p.x)).toBeCloseTo(x, 1);
    expect(Number(p.y)).toBeCloseTo(y, 1);
  });

  describe('angleAt (finger -> angle)', () => {
    // 220px dial, centre at (210, 410)
    const rect = { left: 100, top: 300, width: 220 };

    it.each([
      ['left horizon', 100, 410, 0],
      ['top', 210, 300, Math.PI / 2],
      ['right horizon', 320, 410, Math.PI],
      ['bottom', 210, 520, 1.5 * Math.PI],
    ])('reads the %s', (name, x, y, phi) => {
      expect(angleAt(rect, x, y)).toBeCloseTo(phi, 10);
    });

    it('does not jump from sunrise to the end of the night across the left seam', () => {
      // finger slides from just above to just below the left horizon
      const start = angleAt(rect, 101, 409);
      expect(start).toBeLessThan(0.05);
      expect(angleAt(rect, 101, 412, start)).toBe(0);
    });

    it('does not jump from the end of the night back to sunrise either', () => {
      const late = angleAt(rect, 101, 412);
      expect(late).toBeGreaterThan(2 * Math.PI - 0.05);
      expect(angleAt(rect, 101, 409, late)).toBe(2 * Math.PI);
    });
  });
});
