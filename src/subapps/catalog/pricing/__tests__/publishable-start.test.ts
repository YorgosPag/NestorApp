/**
 * `publishableStart` — η πρόταση «ισχύει από» μιας νέας έκδοσης (ADR-923 §5.11 «3δ»).
 *
 * Το συμβόλαιο που μετρά: ό,τι **προτείνεται** περνά **πάντα** τον κριτή της δημοσίευσης (`judgeVersionPublication`) —
 * ο ίδιος κανόνας σε δύο σημεία θα απέκλινε σιωπηλά. Οι αναμενόμενες ημέρες χτίζονται με τα ίδια τοπικά μεσάνυχτα
 * (`dayAfterInstant`), ώστε το test να μην εξαρτάται από τη ζώνη ώρας του μηχανήματος.
 */

import { dayAfterInstant } from '@/lib/calendar/date-key';
import { judgeVersionPublication, publishableStart, type PriceVersionRef } from '../version-timeline';

const NOW = Date.parse('2026-11-07T10:00:00.000Z');
const DAY = 86_400_000;

const published = (number: number, validFrom: string): PriceVersionRef => ({ id: `v${number}`, number, status: 'published', validFrom });
const superseded = (number: number, validFrom: string): PriceVersionRef => ({ id: `v${number}`, number, status: 'superseded', validFrom });
const draft = (validFrom: string | null): PriceVersionRef => ({ id: 'draft', number: 99, status: 'draft', validFrom });

describe('publishableStart', () => {
  it('χωρίς δημοσιευμένη ⇒ κανένας φράχτης, πρόταση = αύριο', () => {
    const start = publishableStart([draft(null)], NOW);
    expect(start).toEqual({ earliest: null, suggested: dayAfterInstant(NOW), after: null });
  });

  it('τελευταία δημοσιευμένη στο παρελθόν ⇒ φράχτης την επόμενη ημέρα της, πρόταση = αύριο', () => {
    const from = new Date(NOW - 8 * DAY).toISOString();
    const start = publishableStart([superseded(1, new Date(NOW - 20 * DAY).toISOString()), published(2, from)], NOW);
    expect(start.after).toBe(2);
    expect(start.earliest).toBe(dayAfterInstant(Date.parse(from)));
    expect(start.suggested).toBe(dayAfterInstant(NOW));
  });

  it('μελλοντική δημοσιευμένη ⇒ η πρόταση πηγαίνει ΜΕΤΑ από αυτήν, όχι αύριο', () => {
    const future = new Date(NOW + 10 * DAY).toISOString();
    const start = publishableStart([published(1, future)], NOW);
    expect(start.suggested).toBe(start.earliest);
    expect(Date.parse(start.suggested ?? '')).toBeGreaterThan(Date.parse(future));
  });

  it('η δημοσιευμένη ξεκινά ΑΥΡΙΟ ⇒ η πρόταση είναι μεθαύριο (αυστηρά μετά)', () => {
    const tomorrow = dayAfterInstant(NOW) ?? '';
    const start = publishableStart([published(1, tomorrow)], NOW);
    expect(start.suggested).toBe(dayAfterInstant(Date.parse(tomorrow)));
  });

  it('η σειρά κρίνεται με τον ΑΡΙΘΜΟ της έκδοσης, όπως ο κριτής', () => {
    const start = publishableStart([published(2, new Date(NOW - 2 * DAY).toISOString()), published(1, new Date(NOW - 9 * DAY).toISOString())], NOW);
    expect(start.after).toBe(2);
  });

  it.each([
    ['χωρίς δημοσιευμένη', [] as PriceVersionRef[]],
    ['δημοσιευμένη χθες', [published(1, new Date(NOW - DAY).toISOString())]],
    ['δημοσιευμένη σήμερα το πρωί', [published(1, new Date(NOW - 2 * 3_600_000).toISOString())]],
    ['μελλοντική δημοσιευμένη', [published(1, new Date(NOW + 30 * DAY).toISOString())]],
  ])('%s ⇒ η πρόταση ΠΕΡΝΑ τον κριτή της δημοσίευσης', (_label, versions) => {
    const { suggested } = publishableStart(versions, NOW);
    expect(judgeVersionPublication(draft(suggested), versions)).toBeNull();
  });

  it('η ημέρα ΠΡΙΝ από τον φράχτη ΑΠΟΡΡΙΠΤΕΤΑΙ από τον κριτή — ο φράχτης δεν είναι αυστηρότερος ούτε χαλαρότερος', () => {
    const versions = [published(1, new Date(NOW - 3 * DAY).toISOString())];
    const { earliest } = publishableStart(versions, NOW);
    const dayBefore = new Date(Date.parse(earliest ?? '') - DAY).toISOString();
    expect(judgeVersionPublication(draft(earliest), versions)).toBeNull();
    expect(judgeVersionPublication(draft(dayBefore), versions)).toBe('versionValidFromNotAfterPrevious');
  });
});
