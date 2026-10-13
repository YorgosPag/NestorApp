/**
 * ⚓ ADR-838 · ADR-777 §8.94 — το σύνορο ανάγνωσης των αποθηκευμένων αξιώσεων νομιμότητας.
 *
 * Γεννήθηκε μαζί με τον πρώτο γραφέα: δύσμορφο στοιχείο δεν φτάνει ποτέ ως «δηλωμένο» στη δημόσια αγγελία.
 */

import { readLegalityClaims } from '../legality-claim-reading';

const WHOLE = [{ propertyId: 'prop_1', spaceId: null }];
const VALID = {
  kind: 'energy-performance',
  subject: WHOLE,
  tier: 'self-declared',
  value: 'B+',
  authority: null,
  assertedAt: '2026-10-13T18:00:00.000Z',
  validUntil: '2034-03-12',
};

describe('readLegalityClaims', () => {
  it('τίποτα αποθηκευμένο, ή όχι πίνακας ⇒ καμία αξίωση', () => {
    for (const raw of [undefined, null, {}, 'x', 7]) expect(readLegalityClaims(raw)).toEqual([]);
  });

  it('καλοσχηματισμένη αξίωση διαβάζεται αυτούσια, χωρίς ξένα πεδία', () => {
    expect(readLegalityClaims([{ ...VALID, documentUrl: 'https://…' }])).toEqual([VALID]);
  });

  it.each([
    ['άγνωστο είδος', { ...VALID, kind: 'fire-safety' }],
    ['άγνωστη βαθμίδα', { ...VALID, tier: 'trusted' }],
    ['χωρίς στιγμή δήλωσης', { ...VALID, assertedAt: null }],
    ['κενό υποκείμενο', { ...VALID, subject: [] }],
    ['αδιάβαστος χώρος στο υποκείμενο', { ...VALID, subject: [{ propertyId: 7, spaceId: null }] }],
    ['ΠΕΑ δεμένο σε δωμάτιο (είδος ολόκληρου ακινήτου)', { ...VALID, subject: [{ propertyId: 'prop_1', spaceId: 'room_a' }] }],
    ['ανώνυμη πάνω από αυτοδήλωση', { ...VALID, tier: 'registry-verified', authority: null }],
    ['τιμή που δεν είναι κείμενο', { ...VALID, value: 12 }],
    ['σκουπίδι', 'όχι αντικείμενο'],
  ])('🔴 %s ⇒ ΠΕΤΙΕΤΑΙ (ποτέ «διορθώνεται»)', (_label, claim) => {
    expect(readLegalityClaims([claim])).toEqual([]);
  });

  it('κρατά τις καλές και πετά τις δύσμορφες, με τη σειρά του εγγράφου', () => {
    const second = { ...VALID, kind: 'short-stay-registry', value: '00001234567' };
    expect(readLegalityClaims([VALID, { kind: 'x' }, second])).toEqual([VALID, second]);
  });
});
