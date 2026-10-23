/**
 * ΑΓΚΥΡΕΣ — η ΜΙΑ φράση της υπόσχεσης (ADR-919 §11).
 *
 * 🔑 Με τα **πραγματικά** locale bundles, όχι mock `t`: η άγκυρα ρωτά τι διαβάζει ο άνθρωπος, και πιάνει και το
 * λείπον κλειδί (ο μεταφραστής bundle επιστρέφει το ίδιο το κλειδί).
 */

import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import enShared from '@/i18n/locales/en/common-shared.json';
import { scheduledAvailability } from '@/lib/listings/availability-window';
import type { ScheduledAvailability } from '@/types/availability-history';
import type { AvailabilityPrecision } from '@/types/listing-availability';

import { availabilityPromisePhrase } from '../availability-phrase';

const elT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared', 'el');
const enT = createBundleTranslate({ 'common-shared': enShared }, 'common-shared', 'en');

function promise(precision: AvailabilityPrecision, anchor: string): ScheduledAvailability {
  const availability = scheduledAvailability(precision, anchor);
  if (availability.kind !== 'scheduled') throw new Error(`άκυρη άγκυρα ${anchor}`);
  return availability;
}

describe('Φ — η ακρίβεια που δηλώθηκε, ποτέ ψεύτικη ημέρα', () => {
  it('Φ1 — τρίμηνο: «Γ΄ τρίμηνο 2027» από οποιαδήποτε άγκυρα μέσα του', () => {
    expect(availabilityPromisePhrase(promise('quarter', '2027-08-17'), elT, 'el')).toBe('Γ΄ τρίμηνο 2027');
    expect(availabilityPromisePhrase(promise('quarter', '2027-01-01'), elT, 'el')).toBe('Α΄ τρίμηνο 2027');
    expect(availabilityPromisePhrase(promise('quarter', '2027-12-31'), elT, 'el')).toBe('Δ΄ τρίμηνο 2027');
  });

  it('Φ2 — μήνας: ονομαστική του μήνα, όχι ημερομηνία', () => {
    expect(availabilityPromisePhrase(promise('month', '2027-09-20'), elT, 'el')).toBe('Σεπτέμβριος 2027');
  });

  it('Φ3 — ημέρα: πλήρης ημερομηνία χωρίς ημέρα εβδομάδας', () => {
    expect(availabilityPromisePhrase(promise('day', '2027-09-15'), elT, 'el')).toBe('15 Σεπτεμβρίου 2027');
  });

  it('Φ4 — η γλώσσα είναι όρισμα: ίδια υπόσχεση στα αγγλικά, χωρίς ωμό κλειδί', () => {
    const phrase = availabilityPromisePhrase(promise('quarter', '2027-08-17'), enT, 'en');
    expect(phrase).toContain('2027');
    expect(phrase).not.toContain('listingAvailability');
    expect(availabilityPromisePhrase(promise('month', '2027-09-20'), enT, 'en')).toBe('September 2027');
  });
});

describe('Ζ — καμία ζώνη ώρας δεν μετακινεί την ημέρα (UTC)', () => {
  it('Ζ1 — η 1η του μήνα μένει στον ίδιο μήνα, ό,τι κι αν είναι το TZ της διεργασίας', () => {
    expect(availabilityPromisePhrase(promise('month', '2027-10-01'), elT, 'el')).toBe('Οκτώβριος 2027');
    expect(availabilityPromisePhrase(promise('day', '2027-10-01'), elT, 'el')).toBe('1 Οκτωβρίου 2027');
  });
});
