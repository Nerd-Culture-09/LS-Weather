import { createPage, flush } from '../helpers/instances';
import { respondWith, holdRequests } from '../helpers/requests';
import maseruCurrent from '../fixtures/maseru-current.json';
import maseruForecast from '../fixtures/maseru-forecast.json';

/*
 * Fixtures are a real Open-Meteo snapshot for Maseru at 20:00 local time:
 * sunrise 05:08, sunset 18:39, so "now" is after dark.
 */
const CAPE_TOWN = {
  id: 'om-3369157', name: 'Cape Town', subtitle: 'Western Cape, South Africa',
  latitude: -33.92584, longitude: 18.42322, countryCode: 'ZA', source: 'open-meteo', isCurrent: false,
};

function withTemp(temp) {
  const current = structuredClone(maseruCurrent);
  current.current.temperature_2m = temp;
  return current;
}

function serve(current = maseruCurrent, forecast = maseruForecast) {
  respondWith((options) => (options.url.includes('current=') ? current : forecast));
}

async function openWeather(query = { firstname: 'lerato' }) {
  const page = createPage('pages/view-weather/view-weather');
  page.onLoad(query);
  await flush();
  return page;
}

describe('weather page', () => {
  it('shows the current conditions for the default place', async () => {
    serve();
    const page = await openWeather();
    const c = maseruCurrent.current;

    expect(page.data.status).toBe('ready');
    expect(page.data.place.name).toBe('Maseru');
    expect(page.data.placeDetail).toBe('Lesotho');
    expect(page.data.firstname).toBe('Lerato');
    expect(page.data.greeting).toBe('Good evening');
    expect(page.data.current).toMatchObject({
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      icon: 'moon', // code 0 at night
      label: 'Clear',
      humidity: c.relative_humidity_2m,
      humidityNote: 'Dry air',
      windDir: 'N', // 338°
      windArrow: (c.wind_direction_10m + 180) % 360,
      updated: '20:00',
    });
    expect(page.data.today).toMatchObject({ sunrise: '05:08', sunset: '18:39' });
    expect(page.data.sun.up).toBe(false);
    expect(page.data.forecast).toHaveLength(7);
    expect(page.data.forecast[0].day).toBe('Today');
  });

  it.each([
    ['mary-ann', 'Mary-Ann'],
    ['THABO', 'Thabo'],
    ['mary%20ann', 'Mary Ann'],
  ])('capitalises the name %p as %p', async (raw, shown) => {
    serve();
    const page = await openWeather({ firstname: raw });
    expect(page.data.firstname).toBe(shown);
  });

  it('shows the error screen if the first load fails', async () => {
    respondWith(() => ({ fail: { error: 12 } }));
    const page = await openWeather();
    expect(page.data.status).toBe('error');
    expect(page.data.refreshing).toBe(false);
  });

  it('keeps the dashboard and shows a toast if a refresh fails', async () => {
    serve();
    const page = await openWeather();

    respondWith(() => ({ fail: { error: 12 } }));
    page.onRefresh();
    await flush();

    expect(page.data.status).toBe('ready');
    expect(page.data.refreshing).toBe(false);
    expect(my.showToast).toHaveBeenCalledWith({ type: 'fail', content: 'Something went wrong' });
  });

  it('opens the place picker', async () => {
    serve();
    const page = await openWeather();
    page.onChangePlace();
    expect(my.navigateTo).toHaveBeenCalledWith({ url: '/pages/places/places' });
  });

  it('reloads for a new place when coming back from the picker', async () => {
    serve();
    const page = await openWeather();
    my.__storage.set('ls.place', CAPE_TOWN);

    page.onShow();
    expect(page.data.status).toBe('loading');
    expect(page.data.placeDetail).toBe('Western Cape · South Africa');
    expect(my.pageScrollTo).toHaveBeenCalledWith({ scrollTop: 0, duration: 0 });
    await flush();

    expect(page.data.status).toBe('ready');
    expect(my.request.mock.calls.at(-1)[0].url).toContain('latitude=-33.92584');
  });

  it('does nothing on show when the place has not changed', async () => {
    serve();
    const page = await openWeather();
    my.request.mockClear();
    page.onShow();
    expect(my.request).not.toHaveBeenCalled();
  });

  it('ignores a late answer for a place the user already left', async () => {
    const held = holdRequests();
    const page = createPage('pages/view-weather/view-weather');
    page.onLoad({});

    my.__storage.set('ls.place', CAPE_TOWN);
    page.onShow();

    const [oldNow, oldOutlook, newNow, newOutlook] = held;
    newNow.reply(withTemp(5));
    newOutlook.reply(maseruForecast);
    await flush();
    oldNow.reply(withTemp(99)); // Maseru answers last
    oldOutlook.reply(maseruForecast);
    await flush();

    expect(page.data.place.name).toBe('Cape Town');
    expect(page.data.current.temp).toBe(5);
  });

  it('ignores a late failure for a place the user already left', async () => {
    const held = holdRequests();
    const page = createPage('pages/view-weather/view-weather');
    page.onLoad({});
    my.__storage.set('ls.place', CAPE_TOWN);
    page.onShow();

    const [oldNow, , newNow, newOutlook] = held;
    newNow.reply(maseruCurrent);
    newOutlook.reply(maseruForecast);
    await flush();
    oldNow.fail({ error: 12 }); // Maseru fails last
    await flush();

    expect(page.data.status).toBe('ready');
    expect(my.showToast).not.toHaveBeenCalled();
  });

  it('does not start a second refresh while one is running', async () => {
    serve();
    const page = await openWeather();
    const held = holdRequests();

    page.onRefresh();
    page.onRefresh();
    expect(held).toHaveLength(2); // one current + one forecast request, not four
    expect(page.data.refreshing).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('hour-by-hour sun dial', () => {
  // The dial face is 220px wide with its centre at (210, 410) on the page
  const FACE = { left: 100, top: 300, width: 220, height: 110 };
  const at = (x, y) => ({ touches: [{ pageX: x, pageY: y, clientX: x, clientY: y }] });
  const TOP = at(210, 300); // midday
  const RIGHT = at(320, 410); // sunset
  const BOTTOM = at(210, 520); // middle of the night

  let page;

  beforeEach(async () => {
    serve();
    page = await openWeather();
    my.__layout.rects['#ls-dial-face'] = FACE;
  });

  async function openDial() {
    page.onToggleSun();
    await flush();
  }

  it('opens on the current hour (after dark: the night side)', async () => {
    await openDial();

    expect(page.data.dial).toMatchObject({ open: true, night: true, full: true, when: 'Tonight', atNow: true });
    expect(page.data.dial.sel.time).toBe('20:00');
    expect(my.createSelectorQuery).toHaveBeenCalled(); // measured as soon as it opened
  });

  it('closes again', async () => {
    await openDial();
    page.onToggleSun();
    expect(page.data.dial.open).toBe(false);
  });

  it('reads midday when the sun is dragged to the top', async () => {
    await openDial();
    page.onDialTouchStart(TOP);
    page.onDialTouchEnd();

    expect(page.data.dial).toMatchObject({ night: false, full: false, when: 'Today', atNow: false });
    expect(page.data.dial.sel.time).toBe('12:00');
    expect(page.data.dial.sel.temp).toBe(Math.round(maseruForecast.hourly.temperature_2m[12]));
  });

  it('opens the full circle when dragged past sunset, into tomorrow', async () => {
    await openDial();
    page.onDialTouchStart(TOP);
    page.onDialTouchMove(RIGHT);
    page.onDialTouchMove(at(288, 488));
    page.onDialTouchMove(BOTTOM);
    page.onDialTouchEnd();

    expect(page.data.dial).toMatchObject({ night: true, full: true, when: 'Tomorrow' });
    expect(page.data.dial.sel.time).toBe('00:00');
  });

  it('settles the marker exactly on the hour shown', async () => {
    await openDial();
    page.onDialTouchStart(at(150, 320)); // somewhere mid-morning
    page.onDialTouchEnd();

    const { marker, sel } = page.data.dial;
    const phi = page.dialPhi;
    // marker sits on the ring at the angle of the selected hour
    expect(Number(marker.x)).toBeCloseTo(50 - 50 * Math.cos(phi), 1);
    expect(Number(marker.y)).toBeCloseTo(50 - 50 * Math.sin(phi), 1);
    expect(sel.time).toMatch(/^(0[6-9]|1[01]):00$/);
  });

  it('does not wrap from sunrise round to the end of the night', async () => {
    await openDial();
    page.onDialTouchStart(at(101, 409)); // just above the left horizon (sunrise)
    page.onDialTouchMove(at(101, 412)); // slips just below it
    expect(page.dialPhi).toBe(0);
    page.onDialTouchEnd();
    expect(page.data.dial).toMatchObject({ when: 'Today', night: false });
  });

  it('uses page coordinates, so a scrolled page does not throw the sun off', async () => {
    my.__layout.rects['#ls-dial-face'] = { ...FACE, top: FACE.top - 500 }; // on screen, after scrolling
    my.__layout.viewport = { scrollTop: 500, scrollLeft: 0 };
    await openDial();

    page.onDialTouchStart({ touches: [{ pageX: 210, pageY: 300, clientX: 210, clientY: -200 }] });
    expect(page.dialPhi).toBeCloseTo(Math.PI / 2, 10);
  });

  it('works out page coordinates itself when a touch has none', async () => {
    my.__layout.rects['#ls-dial-face'] = { ...FACE, top: FACE.top - 500 };
    my.__layout.viewport = { scrollTop: 500, scrollLeft: 0 };
    await openDial();

    page.onDialTouchStart({ touches: [{ clientX: 210, clientY: -200 }] });
    expect(page.dialPhi).toBeCloseTo(Math.PI / 2, 10);
  });

  it('ignores a stray move when no drag is in progress', async () => {
    await openDial();
    const before = page.dialPhi;
    page.onDialTouchMove(TOP);
    page.onDialTouchMove({ touches: [] });
    expect(page.dialPhi).toBe(before);
  });

  it('redraws at most every 32ms while dragging, and never drops the last position', async () => {
    await openDial();
    jest.useFakeTimers();

    page.onDialTouchStart(TOP); // drawn straight away
    expect(page.data.dial.night).toBe(false);

    page.onDialTouchMove(RIGHT); // within 32ms: queued
    page.onDialTouchMove(BOTTOM); // still queued, same redraw
    expect(page.data.dial.night).toBe(false);

    jest.advanceTimersByTime(32);
    expect(page.data.dial).toMatchObject({ night: true, full: true });
  });

  it('keeps moves made before the dial has been measured', async () => {
    my.__layout.deferred = true;
    await openDial(); // measurement pending

    page.onDialTouchStart(TOP);
    page.onDialTouchMove(RIGHT); // no measurement yet
    my.__flushQueries();

    expect(page.dialPhi).toBeCloseTo(Math.PI, 10);
  });

  it('ignores a measurement that arrives after the finger lifted', async () => {
    my.__layout.deferred = true;
    await openDial();
    my.__flushQueries(); // first measurement lands

    page.onDialTouchStart(TOP); // re-measure is pending again
    page.onDialTouchEnd();
    const settled = page.data.dial.sel.time;

    my.__layout.rects['#ls-dial-face'] = { ...FACE, left: 0 }; // layout moved meanwhile
    my.__flushQueries();
    expect(page.data.dial.sel.time).toBe(settled);
  });

  it('jumps back to now', async () => {
    await openDial();
    page.onDialTouchStart(TOP);
    page.onDialTouchEnd();

    page.onDialNow();
    expect(page.data.dial).toMatchObject({ atNow: true, when: 'Tonight' });
    expect(page.data.dial.sel.time).toBe('20:00');
  });

  it('ignores touches until the weather has loaded', () => {
    const fresh = createPage('pages/view-weather/view-weather');
    expect(() => {
      fresh.onToggleSun();
      fresh.onDialTouchStart(TOP);
      fresh.onDialTouchEnd();
    }).not.toThrow();
    expect(fresh.data.dial.open).toBe(false);
  });
});
