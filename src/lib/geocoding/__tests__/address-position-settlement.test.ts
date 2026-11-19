/**
 * @fileoverview Άγκυρες του **κανόνα 2β** — «τίποτα δεν άλλαξε» ΔΕΝ σημαίνει «υπάρχει απάντηση» (ADR-332 §D32).
 * @related lib/geocoding/address-position (`resolveAddressPosition`) · address-position-rules (`positionSettled`)
 *
 * Ζωντανό περιστατικό (2026-11-19): η έδρα της `cont_c4d79d09` («Ωραιόκαστρον», 570 13) γράφτηκε πριν το D31
 * **χωρίς θέση**. Μετά το D31 η μηχανή τη λύνει (40.7259, 22.9190), αλλά «Αποθήκευση» χωρίς αλλαγή ⇒ `unchanged`
 * ⇒ καμία ερώτηση, για πάντα.
 *
 * Κάθε «ρωτά» έχει **παρονομαστή** «δεν ρωτά»: χωρίς αυτούς, ένας κανόνας που ρωτά **πάντα** θα περνούσε —
 * και θα έσπαγε την πολιτική 1 αίτημα/δευτ. του Nominatim σε κάθε αποθήκευση.
 */

/* global describe, it, expect */

import {
  applyAddressPosition,
  positionSettled,
  resolveAddressPosition,
  type AddressGeocoder,
  type AddressLike,
  type GeocodeHit,
} from '../address-position';
import { GEOCODING_POLICY_REVISION } from '../geocoding-policy-revision';

const NOW = 1_763_500_000_000;

function spyGeocoder(answer: GeocodeHit | null | Error) {
  const calls: Array<Record<string, string | undefined>> = [];
  const geocode: AddressGeocoder = async (query) => {
    calls.push({ ...query });
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { geocode, calls };
}

const HQ: AddressLike = { street: 'ΒΙ.ΠΕ.', postalCode: '57013', city: 'Ωραιόκαστρον' };
const HQ_QUERY = { street: 'ΒΙ.ΠΕ.', postalCode: '57013', city: 'Ωραιόκαστρον' };
const HIT: GeocodeHit = { lat: 40.7259, lng: 22.919, accuracy: 'center', confidence: 0.55, variantUsed: 10 };

const unmatched = (revision: number, resolvedFor = HQ_QUERY): AddressLike => ({
  ...HQ,
  geocodeAttempt: { status: 'unmatched', revision, at: NOW - 1, resolvedFor },
});

describe('§D32 — κανόνας 2β: ρωτά ΜΟΝΟ όταν η θέση δεν έχει κριθεί για αυτό το κείμενο', () => {
  it('2β-1 — 🔴 Η ΚΑΡΔΙΑ: χωρίς θέση και χωρίς ίχνος ⇒ ΜΙΑ ερώτηση, και η θέση γράφεται', async () => {
    const { geocode, calls } = spyGeocoder(HIT);
    const { outcome, position } = await resolveAddressPosition(HQ, { ...HQ }, geocode, NOW);

    expect(outcome).toBe('geocoded');
    expect(calls).toHaveLength(1);
    expect(position.coordinates).toEqual({ lat: 40.7259, lng: 22.919 });
    expect(position.geocodeAttempt).toBeNull();
  });

  it('2β-2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ίχνος ΤΡΕΧΟΥΣΑΣ έκδοσης για το ίδιο κείμενο ⇒ ΜΗΔΕΝ ερωτήσεις', async () => {
    const { geocode, calls } = spyGeocoder(HIT);
    const stored = unmatched(GEOCODING_POLICY_REVISION);
    const { outcome, position } = await resolveAddressPosition(stored, { ...stored }, geocode, NOW);

    expect(outcome).toBe('unchanged');
    expect(calls).toHaveLength(0);
    // «Αυτούσια» ισχύει και για την αποτυχία — αλλιώς η επόμενη αποθήκευση θα ξαναρωτούσε.
    expect(position.geocodeAttempt).toEqual(stored.geocodeAttempt);
  });

  it('2β-3 — ίχνος ΠΑΛΙΑΣ έκδοσης ⇒ ΜΙΑ ερώτηση (η βελτίωση της μηχανής φτάνει χωρίς backfill)', async () => {
    const { geocode, calls } = spyGeocoder(HIT);
    const stored = unmatched(GEOCODING_POLICY_REVISION - 1);
    const { outcome } = await resolveAddressPosition(stored, { ...stored }, geocode, NOW);

    expect(outcome).toBe('geocoded');
    expect(calls).toHaveLength(1);
  });

  it('2β-4 — ίχνος για ΑΛΛΟ κείμενο ⇒ δεν ισχύει, ΜΙΑ ερώτηση', () => {
    expect(positionSettled(unmatched(GEOCODING_POLICY_REVISION, { ...HQ_QUERY, street: 'Άλλη' }))).toBe(false);
    expect(positionSettled(unmatched(GEOCODING_POLICY_REVISION))).toBe(true);
  });

  it('2β-5 — «δεν υπάρχει» ⇒ ίχνος με την τρέχουσα έκδοση και το ΕΡΩΤΗΜΑ — και η επόμενη αποθήκευση ΔΕΝ ρωτά', async () => {
    const first = await resolveAddressPosition(HQ, { ...HQ }, spyGeocoder(null).geocode, NOW);
    expect(first.outcome).toBe('unresolved');
    expect(first.position.geocodeAttempt).toEqual({
      status: 'unmatched', revision: GEOCODING_POLICY_REVISION, at: NOW, resolvedFor: HQ_QUERY,
    });

    const written = applyAddressPosition({ ...HQ }, first.position);
    const second = spyGeocoder(HIT);
    const { outcome } = await resolveAddressPosition(written, { ...written }, second.geocode, NOW + 1);
    expect(outcome).toBe('unchanged');
    expect(second.calls).toHaveLength(0);
  });

  it('2β-6 — «δεν μπόρεσα να ρωτήσω» ΔΕΝ γράφει ίχνος (άγνοια, όχι γνώση) ⇒ η επόμενη ξαναρωτά', async () => {
    const { outcome, position } = await resolveAddressPosition(HQ, { ...HQ }, spyGeocoder(new Error('down')).geocode, NOW);
    expect(outcome).toBe('geocoder-unavailable');
    expect(position.geocodeAttempt).toBeNull();
    expect(positionSettled(applyAddressPosition({ ...HQ }, position))).toBe(false);
  });

  it('2β-7 — θέση μηχανής που ΔΙΑΨΕΥΔΕΤΑΙ από το `resolvedFor` (κράτηση μετά από προθεσμία) ⇒ ΜΙΑ ερώτηση', async () => {
    const { geocode, calls } = spyGeocoder(HIT);
    const stale: AddressLike = {
      ...HQ,
      coordinates: { lat: 40.6, lng: 22.9 },
      geocodingMetadata: { confidence: 0.9, accuracy: 'exact', variantUsed: 1, resolvedFor: { ...HQ_QUERY, street: 'Παλιά' } },
    };
    const { outcome } = await resolveAddressPosition(stale, { ...stale }, geocode, NOW);
    expect(outcome).toBe('geocoded');
    expect(calls).toHaveLength(1);
  });

  it('2β-8 — ΠΑΡΟΝΟΜΑΣΤΕΣ: πινέζα ανθρώπου · θέση που ταιριάζει · προ-Ζ6 (`unverifiable`) ⇒ ΜΗΔΕΝ ερωτήσεις', () => {
    const point = { coordinates: { lat: 40.6, lng: 22.9 } };
    const meta = { confidence: 0.9, accuracy: 'exact' as const, variantUsed: 1 };
    expect(positionSettled({ ...HQ, ...point })).toBe(true);
    expect(positionSettled({ ...HQ, ...point, geocodingMetadata: { ...meta, resolvedFor: HQ_QUERY } })).toBe(true);
    // ⚠️ Χωρίς απόδειξη = άγνοια: ποτέ μαζικό re-geocode ολόκληρης της βάσης.
    expect(positionSettled({ ...HQ, ...point, geocodingMetadata: meta })).toBe(true);
  });

  it('2β-9 — σημείο και ίχνος ΔΕΝ συνυπάρχουν: η επιτυχία σβήνει το παλιό ίχνος', async () => {
    const stored = unmatched(GEOCODING_POLICY_REVISION - 1);
    const { position } = await resolveAddressPosition(stored, { ...stored }, spyGeocoder(HIT).geocode, NOW);
    const written = applyAddressPosition({ ...stored }, position) as AddressLike;
    expect(written.coordinates).toEqual({ lat: 40.7259, lng: 22.919 });
    expect(written.geocodeAttempt).toBeUndefined();
  });
});
