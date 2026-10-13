/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΗΣ ΠΟΡΤΑΣ** — τι δέχεται το PATCH του γραφείου ως κοινόχρηστα (ADR-777 §8.93).
 * @related api/properties/[id]/property-patch-helpers · lib/common-charges/common-charges
 *
 * 🔴 Ίδιος λόγος ύπαρξης με το `property-patch-media-order.test.ts`: το `PropertyPatchSchema` είναι `.passthrough()`,
 * άρα η γραμμή που επικυρώνει το `commonCharges` είναι **αφαιρέσιμη χωρίς να σπάσει τίποτα** — το πεδίο θα συνέχιζε
 * να γράφεται, απλώς χωρίς έλεγχο, και από εκεί θα έφτανε στη **δημόσια** αγγελία.
 */

import { PropertyPatchSchema } from '../property-patch-helpers';

describe('Π1 — η πόρτα δέχεται το μπλοκ', () => {
  it('απόν πεδίο περνά — τα κοινόχρηστα είναι προαιρετικά', () => {
    expect(PropertyPatchSchema.safeParse({ name: 'Δ1' }).success).toBe(true);
  });

  it.each([
    ['ποσό με παροχές', { monthlyAmount: 120, includes: ['heating'] }],
    ['χωρίς κοινόχρηστα', { monthlyAmount: 0, includes: null }],
    ['τίποτα δηλωμένο (σβήσιμο)', { monthlyAmount: null, includes: null }],
    ['ποσό, τίποτα από τον κατάλογο', { monthlyAmount: 120, includes: [] }],
  ])('%s ⇒ περνά', (_label, commonCharges) => {
    expect(PropertyPatchSchema.safeParse({ commonCharges }).success).toBe(true);
  });
});

describe('Π2 — η πόρτα απορρίπτει ό,τι δεν είναι δήλωση', () => {
  it.each([
    ['αρνητικό ποσό', { monthlyAmount: -1, includes: null }],
    ['δεκαδικό ποσό', { monthlyAmount: 120.5, includes: null }],
    ['ποσό πάνω από το όριο', { monthlyAmount: 5001, includes: null }],
    ['ποσό ως συμβολοσειρά', { monthlyAmount: '120', includes: null }],
    ['άγνωστη παροχή', { monthlyAmount: 120, includes: ['sauna'] }],
    ['μισό μπλοκ', { monthlyAmount: 120 }],
    ['άγνωστο κλειδί', { monthlyAmount: 120, includes: null, yearly: 1440 }],
    ['σκέτος αριθμός', 120],
    ['null', null],
  ])('🔴 %s ⇒ ΑΠΟΡΡΙΨΗ', (_label, commonCharges) => {
    expect(PropertyPatchSchema.safeParse({ commonCharges }).success).toBe(false);
  });
});

describe('Π3 — ό,τι περνά, γράφεται ΚΑΝΟΝΙΚΟΠΟΙΗΜΕΝΟ (η γενική διαδρομή γράφει το σώμα αυτούσιο)', () => {
  it('🔴 «περιλαμβάνουν» δίπλα σε «χωρίς κοινόχρηστα» ⇒ δεν φτάνει ποτέ στο έγγραφο', () => {
    const parsed = PropertyPatchSchema.parse({ commonCharges: { monthlyAmount: 0, includes: ['heating'] } });
    expect(parsed.commonCharges).toEqual({ monthlyAmount: 0, includes: null });
  });

  it('το σύνολο βγαίνει στη σειρά του καταλόγου', () => {
    const parsed = PropertyPatchSchema.parse({ commonCharges: { monthlyAmount: 90, includes: ['pool', 'water'] } });
    expect(parsed.commonCharges).toEqual({ monthlyAmount: 90, includes: ['water', 'pool'] });
  });
});
