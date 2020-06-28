import {flags, Event} from './event';
import {locale as l} from './locale';
import gematriya from 'gematriya';

/** Represents a day 1-49 of counting the Omer from Pesach to Shavuot */
export class OmerEvent extends Event {
  /**
   * @param {HDate} date
   * @param {number} omerDay
   */
  constructor(date, omerDay) {
    super(date, `Omer ${omerDay}`, flags.OMER_COUNT, {omer: omerDay});
  }
  /**
   * @todo use gettext()
   * @param {string} [locale] Optional locale name (defaults to active locale).
   * @return {string}
   */
  render(locale) {
    const omer = this.getAttrs().omer;
    const nth = (locale == 'he') ? gematriya(omer) : l.ordinal(omer);
    return nth + ' ' + l.gettext('day of the Omer', locale);
  }
  /**
   * Returns translation of "Omer 22" without ordinal numbers.
   * @param {string} [locale] Optional locale name (defaults to active locale).
   * @return {string}
   */
  renderBrief(locale) {
    return l.gettext('Omer', locale) + ' ' + this.getAttrs().omer;
  }
}
