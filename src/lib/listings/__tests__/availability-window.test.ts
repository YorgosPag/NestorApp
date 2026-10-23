/**
 * Άγκυρες — **ΤΟ ΔΙΑΣΤΗΜΑ ΔΙΑΘΕΣΙΜΟΤΗΤΑΣ** (ADR-919 · ADR-777 §8.99.4 Δ2).
 *
 * Το διάστημα βγαίνει **μόνο** από την ακρίβεια· αν εδώ γλιστρήσει μια μέρα, η μηχανή θα
 * υποσχεθεί αγγελία ως «έτοιμη» μια μέρα νωρίτερα από όσο δηλώθηκε.
 */

import {
  availabilityWindowOf,
  scheduledAvailability,
} from '../availability-window';
import {
  AVAILABILITY_PRECISIONS,
  DEFAULT_AVAILABILITY_PRECISION,
  LISTING_AVAILABILITY_KINDS,
} from '@/types/listing-availability';

describe('Δ — το διάστημα ανά ακρίβεια', () => {
  it.each([
    ['2027-01-01', '2027-01-01', '2027-03-31'],
    ['2027-05-17', '2027-04-01', '2027-06-30'],
    ['2027-08-15', '2027-07-01', '2027-09-30'],
    ['2027-12-31', '2027-10-01', '2027-12-31'],
  ])('τρίμηνο: %s → %s…%s', (anchor, start, end) => {
    expect(availabilityWindowOf('quarter', anchor)).toEqual({ start, end });
  });

  it('μήνας: ο Φεβρουάριος δίσεκτου έτους τελειώνει στις 29', () => {
    expect(availabilityWindowOf('month', '2028-02-10')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(availabilityWindowOf('month', '2027-02-10')).toEqual({ start: '2027-02-01', end: '2027-02-28' });
  });

  it('ημέρα: αρχή = τέλος', () => {
    expect(availabilityWindowOf('day', '2027-09-03')).toEqual({ start: '2027-09-03', end: '2027-09-03' });
  });

  it('🔑 κάθε ημέρα του διαστήματος δίνει το ΙΔΙΟ διάστημα (η άγκυρα δεν μετακινεί τα όρια)', () => {
    const quarter = availabilityWindowOf('quarter', '2027-07-01');
    for (const day of ['2027-07-31', '2027-08-01', '2027-09-30']) {
      expect(availabilityWindowOf('quarter', day)).toEqual(quarter);
    }
  });
});

describe('Α — η άκυρη άγκυρα δεν γίνεται ποτέ εικασία', () => {
  it.each(['2027-02-30', '2027-13-01', '2027-00-10', '2027-9-1', '', 'σύντομα', '2027-09-01T00:00:00Z'])(
    '«%s» → null / unknown',
    (anchor) => {
      for (const precision of AVAILABILITY_PRECISIONS) {
        expect(availabilityWindowOf(precision, anchor)).toBeNull();
        expect(scheduledAvailability(precision, anchor)).toEqual({ kind: 'unknown' });
      }
    },
  );
});

describe('Κ — ο κατασκευαστής του `scheduled`', () => {
  it('κρατά την ακρίβεια μαζί με το διάστημα, ώστε η οθόνη να ξαναγράψει «Γ\' τρίμηνο»', () => {
    expect(scheduledAvailability('quarter', '2027-08-15')).toEqual({
      kind: 'scheduled',
      precision: 'quarter',
      window: { start: '2027-07-01', end: '2027-09-30' },
    });
  });

  it('το λεξιλόγιο είναι κλειστό, και η προεπιλογή είναι το τρίμηνο (Δ2)', () => {
    expect(LISTING_AVAILABILITY_KINDS).toEqual(['ready', 'scheduled', 'unknown']);
    expect(AVAILABILITY_PRECISIONS).toEqual(['quarter', 'month', 'day']);
    expect(DEFAULT_AVAILABILITY_PRECISION).toBe('quarter');
  });
});
