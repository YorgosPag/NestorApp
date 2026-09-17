/**
 * **FIXTURES ΠΡΑΓΜΑΤΙΚΟΥ ΣΧΗΜΑΤΟΣ** — όχι εφευρημένα `.ics`, αλλά το σχήμα που στέλνουν
 * μετρημένα τα κανάλια (ADR-835 §22).
 *
 * @related ADR-835 §22 · lib/ical/ical-read.ts
 */

/** Ένωση γραμμών με **CRLF**, όπως το πρωτόκολλο. */
export const ics = (...lines: readonly string[]): string => `${lines.join('\r\n')}\r\n`;

/**
 * **Airbnb** — «Reserved» για κράτηση, «Airbnb (Not available)» για κλεισμένη μέρα, με
 * `DESCRIPTION` που κουβαλά σύνδεσμο κράτησης και 4 ψηφία τηλεφώνου (τα αγνοούμε).
 */
export const AIRBNB_FEED = ics(
  'BEGIN:VCALENDAR',
  'PRODID:-//Airbnb Inc//Hosting Calendar 1.0.0//EN',
  'CALSCALE:GREGORIAN',
  'VERSION:2.0',
  'X-WR-CALNAME:Airbnb (Διαμέρισμα στο κέντρο)',
  'BEGIN:VEVENT',
  'DTEND;VALUE=DATE:20261015',
  'DTSTART;VALUE=DATE:20261012',
  'UID:1a2b3c4d5e@airbnb.com',
  'DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HM',
  ' 123\\nPhone Number (Last 4 Digits): 1234',
  'SUMMARY:Reserved',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTEND;VALUE=DATE:20261020',
  'DTSTART;VALUE=DATE:20261018',
  'UID:9f8e7d6c5b@airbnb.com',
  'SUMMARY:Airbnb (Not available)',
  'END:VEVENT',
  'END:VCALENDAR',
);

/**
 * **Booking.com, ΗΜΕΡΑ 1** — `UID` opaque, και το «CLOSED - Not available» χρησιμοποιείται
 * **και** για το «safety event» έξι μηνών.
 */
export const BOOKING_FEED_DAY_1 = ics(
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Booking.com//Extranet Calendar//EN',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260915',
  'DTEND;VALUE=DATE:20260920',
  'UID:TRU-9LZDAN',
  'SUMMARY:CLOSED - Not available',
  'END:VEVENT',
  'END:VCALENDAR',
);

/**
 * **Booking.com, ΗΜΕΡΑ 2** — 🔴 **ΙΔΙΑ κράτηση, ΑΛΛΟ `UID`, μετακινημένο `DTSTART`**
 * (doorstep#41). Η ημέρα **αναχώρησης** είναι το μόνο σταθερό σημείο.
 */
export const BOOKING_FEED_DAY_2 = ics(
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Booking.com//Extranet Calendar//EN',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260916',
  'DTEND;VALUE=DATE:20260920',
  'UID:TRU-2BASUD',
  'SUMMARY:CLOSED - Not available',
  'END:VEVENT',
  'END:VCALENDAR',
);

/** **Vrbo** — `DTEND` απόν, `DURATION` σε ημέρες, και ζώνη ώρας στο `VTIMEZONE` με **RRULE**. */
export const VRBO_FEED = ics(
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//HomeAway.com, Inc.//EN',
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Athens',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0300',
  'TZNAME:EEST',
  'DTSTART:19700329T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261101',
  'DURATION:P4D',
  'UID:1234567890abcdef@vrbo.com',
  'SUMMARY:Reserved - Vrbo',
  'END:VEVENT',
  'END:VCALENDAR',
);
