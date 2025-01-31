/* eslint-disable max-len */
import {Locale} from './locale';
import {flags, Event} from './event';
import {Zmanim} from './zmanim';
import {months} from './hdate';

const days = {
  FRI: 5,
  SAT: 6,
};

/**
 * @private
 * @constant
 * This method returns the tzais (nightfall) based on the opinion of the
 * Geonim calculated as 30 minutes after sunset during the equinox
 * (on March 16, about 4 days before the astronomical equinox, the day that
 * a solar hour is 60 minutes) in Yerushalayim.
 * @see {https://kosherjava.com/zmanim/docs/api/com/kosherjava/zmanim/ComplexZmanimCalendar.html#getTzaisGeonim7Point083Degrees()}
 */
const TZEIT_3MEDIUM_STARS = 7.083;

/**
 * @private
 * @param {Event} e
 * @param {HDate} hd
 * @param {number} dow
 * @param {Location} location
 * @param {HebrewCalendar.Options} options
 * @return {Event}
 */
export function makeCandleEvent(e, hd, dow, location, options) {
  let havdalahTitle = false;
  let useHavdalahOffset = dow == days.SAT;
  let mask = e ? e.getFlags() : flags.LIGHT_CANDLES;
  if (typeof e !== 'undefined') {
    // if linked event && dow == FRI, use Candle lighting time & title
    if (dow != days.FRI) {
      if (mask & (flags.LIGHT_CANDLES_TZEIS | flags.CHANUKAH_CANDLES)) {
        useHavdalahOffset = true;
      } else if (mask & flags.YOM_TOV_ENDS) {
        havdalahTitle = true;
        useHavdalahOffset = true;
      }
    }
  } else if (dow == days.SAT) {
    havdalahTitle = true;
    mask = flags.LIGHT_CANDLES_TZEIS;
  }
  // if offset is 0 or undefined, we'll use tzeit time
  const offset = useHavdalahOffset ? options.havdalahMins : options.candleLightingMins;
  const zmanim = new Zmanim(hd, location.getLatitude(), location.getLongitude());
  const time = offset ? zmanim.sunsetOffset(offset) : zmanim.tzeit(options.havdalahDeg);
  if (isNaN(time.getTime())) {
    return null; // no sunset
  }
  if (havdalahTitle) {
    return new HavdalahEvent(hd, mask, time, location, options.havdalahMins, e);
  } else {
    return new CandleLightingEvent(hd, mask, time, location, e);
  }
}

/** An event that has an `eventTime` and `eventTimeStr` */
export class TimedEvent extends Event {
  /**
   * @param {HDate} date
   * @param {string} desc Description (not translated)
   * @param {number} mask
   * @param {Date} eventTime
   * @param {Location} location
   * @param {Event} linkedEvent
   */
  constructor(date, desc, mask, eventTime, location, linkedEvent) {
    super(date, desc, mask);
    this.eventTime = Zmanim.roundTime(eventTime);
    this.location = location;
    const timeFormat = location.getTimeFormatter();
    this.eventTimeStr = Zmanim.formatTime(this.eventTime, timeFormat);
    if (typeof linkedEvent !== 'undefined') {
      this.linkedEvent = linkedEvent;
    }
  }
  /**
   * @param {string} [locale] Optional locale name (defaults to active locale).
   * @return {string}
   */
  render(locale) {
    return Locale.gettext(this.getDesc(), locale) + ': ' + this.eventTimeStr;
  }
  /**
   * Returns translation of "Candle lighting" without the time.
   * @param {string} [locale] Optional locale name (defaults to active locale).
   * @return {string}
   */
  renderBrief(locale) {
    return Locale.gettext(this.getDesc(), locale);
  }
}

/** Havdalah after Shabbat or holiday */
export class HavdalahEvent extends TimedEvent {
  /**
   * @param {HDate} date
   * @param {number} mask
   * @param {Date} eventTime
   * @param {Location} location
   * @param {number} havdalahMins
   * @param {Event} linkedEvent
   */
  constructor(date, mask, eventTime, location, havdalahMins, linkedEvent) {
    super(date, 'Havdalah', mask, eventTime, location, linkedEvent);
    if (havdalahMins) {
      this.havdalahMins = havdalahMins;
    }
  }
  /**
   * @param {string} [locale] Optional locale name (defaults to active locale).
   * @return {string}
   */
  render(locale) {
    return this.renderBrief(locale) + ': ' + this.eventTimeStr;
  }
  /**
   * Returns translation of "Havdalah" without the time.
   * @param {string} [locale] Optional locale name (defaults to active locale).
   * @return {string}
   */
  renderBrief(locale) {
    let str = Locale.gettext(this.getDesc(), locale);
    if (this.havdalahMins) {
      const min = Locale.gettext('min', locale);
      str += ` (${this.havdalahMins} ${min})`;
    }
    return str;
  }
  /** @return {string} */
  getEmoji() {
    return '✨';
  }
}

/** Candle lighting before Shabbat or holiday */
export class CandleLightingEvent extends TimedEvent {
  /**
   * @param {HDate} date
   * @param {number} mask
   * @param {Date} eventTime
   * @param {Location} location
   * @param {Event} linkedEvent
   */
  constructor(date, mask, eventTime, location, linkedEvent) {
    super(date, 'Candle lighting', mask, eventTime, location, linkedEvent);
  }
  /** @return {string} */
  getEmoji() {
    return '🕯️';
  }
}

/**
 * Makes a pair of events representing fast start and end times
 * @private
 * @param {Event} ev
 * @param {Location} location
 * @return {Event}
 */
export function makeFastStartEnd(ev, location) {
  const desc = ev.getDesc();
  if (desc === 'Yom Kippur') {
    return ev;
  }
  ev = ev.clone();
  const hd = ev.getDate();
  const dt = hd.greg();
  const zmanim = new Zmanim(dt, location.getLatitude(), location.getLongitude());
  if (desc === 'Erev Tish\'a B\'Av') {
    const sunset = zmanim.sunset();
    ev.startEvent = makeTimedEvent(hd, sunset, 'Fast begins', ev, location);
  } else if (desc.substring(0, 11) === 'Tish\'a B\'Av') {
    ev.endEvent = makeTimedEvent(hd, zmanim.tzeit(TZEIT_3MEDIUM_STARS), 'Fast ends', ev, location);
  } else {
    const dawn = zmanim.alotHaShachar();
    ev.startEvent = makeTimedEvent(hd, dawn, 'Fast begins', ev, location);
    if (dt.getDay() !== 5 && !(hd.getDate() === 14 && hd.getMonth() === months.NISAN)) {
      ev.endEvent = makeTimedEvent(hd, zmanim.tzeit(TZEIT_3MEDIUM_STARS), 'Fast ends', ev, location);
    }
  }
  return ev;
}

/**
 * @private
 * @param {HDate} hd
 * @param {Date} time
 * @param {string} desc
 * @param {Event} ev
 * @param {Location} location
 * @return {TimedEvent}
 */
function makeTimedEvent(hd, time, desc, ev, location) {
  if (isNaN(time.getTime())) {
    return null;
  }
  return new TimedEvent(hd, desc, ev.getFlags(), time, location, ev);
}


/**
 * Makes a candle-lighting event for Chankah (not on Friday/Saturday)
 * @private
 * @param {Event} ev
 * @param {HDate} hd
 * @param {Location} location
 * @return {TimedEvent}
 */
export function makeWeekdayChanukahCandleLighting(ev, hd, location) {
  const zmanim = new Zmanim(hd.greg(), location.getLatitude(), location.getLongitude());
  const candleLightingTime = zmanim.dusk();
  // const candleLightingTime = zmanim.tzeit(4.6667);
  return makeTimedEvent(hd, candleLightingTime, ev.getDesc(), ev, location);
}
