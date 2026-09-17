/**
 * **Ο ΓΡΑΦΕΑΣ, ΚΑΙ Η ΑΓΚΥΡΑ ΚΥΚΛΙΚΟΤΗΤΑΣ** — ADR-835 §22.
 *
 * 🔑 Το `read(write(x)) === x` ελέγχει **και τις δύο** κατευθύνσεις μαζί: δίπλωμα στα 75
 * οκτάδα, διαφυγή `TEXT`, ημι-ανοιχτό διάστημα. Μία απόκλιση και το κανάλι δεν
 * καταλαβαίνει το ημερολόγιό μας — δηλαδή χαμένες κρατήσεις χωρίς μήνυμα σφάλματος.
 */

import { readIcalCalendar, type IcalReadOptions } from '../ical-read';
import { ICAL_LINE_OCTETS } from '../ical-text';
import { writeIcalCalendar, type IcalWriteEvent } from '../ical-write';

const options: IcalReadOptions = { dateKeyOfInstant: (ms) => new Date(ms).toISOString().slice(0, 10) };

const event = (over: Partial<IcalWriteEvent> = {}): IcalWriteEvent => ({
  uid: 'stay_1@stay.nestorconstruct.gr',
  from: '2026-10-10',
  to: '2026-10-14',
  summary: 'Reserved',
  status: 'CONFIRMED',
  updatedAt: '2026-09-17T08:30:00.000Z',
  ...over,
});

const calendar = (events: readonly IcalWriteEvent[]): string =>
  writeIcalCalendar({ prodId: '-//Test//EN', name: 'Κατάλυμα', refreshInterval: 'PT1H', events });

describe('writeIcalCalendar', () => {
  it('γράφει ολοήμερα VEVENT με αποκλειστικό DTEND και CRLF', () => {
    const output = calendar([event()]);
    expect(output).toContain('DTSTART;VALUE=DATE:20261010\r\n');
    expect(output).toContain('DTEND;VALUE=DATE:20261014\r\n');
    expect(output).toContain('DTSTAMP:20260917T083000Z\r\n');
    expect(output.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('καμία φυσική γραμμή δεν ξεπερνά τα 75 οκτάδα — ούτε με ελληνικά', () => {
    const output = calendar([event({ uid: `${'δ'.repeat(120)}@stay.nestorconstruct.gr` })]);
    for (const line of output.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf-8') + 2).toBeLessThanOrEqual(ICAL_LINE_OCTETS);
    }
  });

  it('🔑 άγκυρα κυκλικότητας: ό,τι γράφουμε, το διαβάζουμε — με διπλωμένα και ελληνικά', () => {
    const events = [
      event(),
      event({ uid: `${'μ'.repeat(90)}@stay.nestorconstruct.gr`, from: '2026-11-01', to: '2026-11-02' }),
      event({ uid: 'hold_1@stay.nestorconstruct.gr', status: 'TENTATIVE', from: '2026-12-24', to: '2026-12-27' }),
    ];
    const result = readIcalCalendar(calendar(events), options);
    expect(result.ok && result.calendarName).toBe('Κατάλυμα');
    expect(result.ok && result.events).toEqual(
      events.map((e) => ({ uid: e.uid, from: e.from, to: e.to, summary: e.summary })),
    );
  });

  it('η διαφυγή του TEXT επιστρέφει αυτούσια (κόμμα · ερωτηματικό · backslash · νέα γραμμή)', () => {
    const summary = 'Κλειστό: συντήρηση, μπάνιο; \\ γραμμή\nδεύτερη';
    const result = readIcalCalendar(calendar([event({ summary })]), options);
    expect(result.ok && result.events[0]?.summary).toBe(summary);
  });
});
