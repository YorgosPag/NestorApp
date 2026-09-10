/**
 * Άγκυρες της **ΖΩΗΣ** μιας θέσης μετά την πρώτη εγγραφή — `lib/geocoding/address-position`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Ζ — ΦΡΕΣΚΑΔΑ (εύρημα 2026-09-10, ADR-332 D27 Βήμα Β)
 * ────────────────────────────────────────────────────────────────────────────
 * Το `keepStored` επέστρεφε `verifiedAt: null`, και το `applyAddressPosition` **αφαιρεί** το
 * κλειδί όταν είναι `null`. Άρα **κάθε** αποθήκευση που δεν αγγίζει τη θέση (ετικέτα, σειρά,
 * διακοπή του γεωκωδικοποιητή) **έσβηνε** την ημερομηνία επιβεβαίωσης — και ο δείκτης
 * φρεσκάδας έπεφτε σε «ποτέ» χωρίς να αλλάξει τίποτα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Η — Η ΠΙΝΕΖΑ ΤΟΥ ΑΝΘΡΩΠΟΥ ΜΕΝΕΙ (ADR-332 D27 Βήμα Β, Φ2β)
 * ────────────────────────────────────────────────────────────────────────────
 * Πρακτική: Revit (αλλαγή διεύθυνσης δεν μετακινεί την πινέζα) · Apple Maps (η πινέζα του
 * σπιτιού διαφέρει από την κάρτα) · Salesforce Maps (το Verified υπερισχύει). **Και παραπάνω**:
 * η απόκλιση **μετριέται** και επιστρέφεται — το Salesforce κρατά τη μπαγιάτικη θέση σιωπηλά.
 */

import {
  resolveAddressPosition,
  resolveAddressPositions,
  type AddressGeocoder,
  type AddressLike,
  type GeocodeHit,
} from '../address-position';
import { HUMAN_PIN_DRIFT_FLOOR_METRES } from '../geocoding-thresholds';

const NOW = 1_757_000_000_000;
const EARLIER = NOW - 86_400_000;

/** Ο γεωκωδικοποιητής-μάρτυρας — μετρά τι ρωτήθηκε. */
function witness(answer: GeocodeHit | null | Error): { geocode: AddressGeocoder; calls: number[] } {
  const calls: number[] = [];
  const geocode: AddressGeocoder = async () => {
    calls.push(calls.length + 1);
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { geocode, calls };
}

/** Η πόρτα της Σαμοθράκης 16 (μετρημένη, ADR-332 D27). */
const DOOR = { lat: 40.6642462, lng: 22.8975146 };

/** Ο δρόμος — ~15 μ. από την πόρτα, `interpolated`: ΜΕΣΑ στην αβεβαιότητα της μηχανής. */
const HIT_SAME_STREET: GeocodeHit = { lat: 40.6643548, lng: 22.8975059, accuracy: 'interpolated', confidence: 0.8, variantUsed: 1 };

/** Εγνατίας 147 — ~5 χλμ. από την πόρτα, `exact`. */
const HIT_FAR: GeocodeHit = { lat: 40.6401, lng: 22.9444, accuracy: 'exact', confidence: 0.93, variantUsed: 2 };

/** Αποθηκευμένη **ανθρώπινη** πινέζα: σημείο χωρίς μεταδεδομένα μηχανής. */
const HUMAN_16: AddressLike & { id: string } = {
  id: 'addr-16',
  street: 'Σαμοθράκης',
  number: '16',
  city: 'Ελευθέριο Κορδελιό',
  coordinates: DOOR,
  source: 'dragged',
  verifiedAt: EARLIER,
};

/** Αποθηκευμένη θέση **μηχανής**: σημείο με μεταδεδομένα. */
const MACHINE_16: AddressLike & { id: string } = {
  ...HUMAN_16,
  coordinates: { lat: HIT_SAME_STREET.lat, lng: HIT_SAME_STREET.lng },
  source: 'geocoded',
  geocodingMetadata: { confidence: 0.8, accuracy: 'interpolated', variantUsed: 1 },
};

describe('Ζ — η ΦΡΕΣΚΑΔΑ μιας θέσης δεν σβήνεται από αποθήκευση που δεν την αγγίζει', () => {
  it('Ζ1 — τίποτα σχετικό δεν άλλαξε ⇒ `verifiedAt` ΑΥΤΟΥΣΙΟ στο έγγραφο', async () => {
    const { geocode } = witness(HIT_SAME_STREET);

    const { addresses } = await resolveAddressPositions([MACHINE_16], [{ ...MACHINE_16 }], geocode, NOW);

    expect(addresses[0].verifiedAt).toBe(EARLIER);
  });

  it('Ζ2 — ο γεωκωδικοποιητής δεν απάντησε ⇒ θέση ΚΑΙ `verifiedAt` αυτούσια (άγνοια, όχι γνώση)', async () => {
    const { geocode } = witness(new Error('geocoder-unavailable'));

    const { addresses } = await resolveAddressPositions([MACHINE_16], [{ ...MACHINE_16, number: '18' }], geocode, NOW);

    expect(addresses[0].coordinates).toEqual(MACHINE_16.coordinates);
    expect(addresses[0].verifiedAt).toBe(EARLIER);
  });
});

describe('Η — η πινέζα του ΑΝΘΡΩΠΟΥ μένει όταν αλλάζει αργότερα το κείμενο', () => {
  it('Η1 — νέος αριθμός, ίδια πινέζα ⇒ `human-kept`: σημείο, προέλευση και φρεσκάδα ΑΥΤΟΥΣΙΑ', async () => {
    const { geocode, calls } = witness(HIT_SAME_STREET);

    const { outcome, position, drift } = await resolveAddressPosition(
      HUMAN_16, { ...HUMAN_16, number: '18' }, geocode, NOW,
    );

    expect(outcome).toBe('human-kept');
    expect(position.coordinates).toEqual(DOOR);
    expect(position.source).toBe('dragged');
    expect(position.geocodingMetadata).toBeNull();
    expect(position.verifiedAt).toBe(EARLIER);
    // Ρωτήθηκε ΜΟΝΟ για μέτρηση — όσα αιτήματα και πριν (ο παλιός κανόνας 3 ρωτούσε επίσης).
    expect(calls).toHaveLength(1);
    // Ο δρόμος είναι ~15 μ. μακριά, μέσα στην αβεβαιότητα της μηχανής ⇒ καμία συμβουλή.
    expect(drift).toBeUndefined();
  });

  it('Η2 — η νέα διεύθυνση λύνεται ΜΑΚΡΙΑ ⇒ η πινέζα μένει, αλλά επιστρέφεται ΜΕΤΡΗΜΕΝΗ απόκλιση', async () => {
    const { geocode } = witness(HIT_FAR);

    const { outcome, position, drift } = await resolveAddressPosition(
      HUMAN_16, { ...HUMAN_16, street: 'Εγνατίας', number: '147', city: 'Θεσσαλονίκη' }, geocode, NOW,
    );

    expect(outcome).toBe('human-kept');
    expect(position.coordinates).toEqual(DOOR);
    expect(drift?.distanceMetres).toBeGreaterThan(4_000);
    // `exact` δεν έχει αβεβαιότητα ⇒ το όριο είναι το κατώφλι κτιρίου.
    expect(drift?.toleranceMetres).toBe(HUMAN_PIN_DRIFT_FLOOR_METRES);
  });

  it('Η3 — ρητή δήλωση «μετακίνησε στη διεύθυνση» ⇒ `geocoded`, η πινέζα του ανθρώπου αντικαθίσταται', async () => {
    const { geocode } = witness(HIT_FAR);

    const { outcome, position } = await resolveAddressPosition(
      HUMAN_16, { ...HUMAN_16 }, geocode, NOW, { relocate: true },
    );

    expect(outcome).toBe('geocoded');
    expect(position.coordinates).toEqual({ lat: HIT_FAR.lat, lng: HIT_FAR.lng });
    expect(position.geocodingMetadata?.accuracy).toBe('exact');
  });

  it('Η4 — ΠΑΡΟΝΟΜΑΣΤΗΣ: θέση ΜΗΧΑΝΗΣ + νέο κείμενο ⇒ `geocoded` (δεν υπάρχει άνθρωπος να κρατηθεί)', async () => {
    const { geocode } = witness(HIT_FAR);

    const { outcome } = await resolveAddressPosition(
      MACHINE_16, { ...MACHINE_16, street: 'Εγνατίας', number: '147', city: 'Θεσσαλονίκη' }, geocode, NOW,
    );

    expect(outcome).toBe('geocoded');
  });

  it('Η5 — ο γεωκωδικοποιητής δεν απάντησε ⇒ η πινέζα μένει, καμία (ψεύτικη) απόκλιση', async () => {
    const { geocode } = witness(new Error('geocoder-unavailable'));

    const { outcome, position, drift } = await resolveAddressPosition(
      HUMAN_16, { ...HUMAN_16, number: '18' }, geocode, NOW,
    );

    expect(outcome).toBe('human-kept');
    expect(position.coordinates).toEqual(DOOR);
    expect(drift).toBeUndefined();
  });

  it('Η6 — σε επίπεδο εγγράφου: η απόκλιση ταξιδεύει ΜΕ ταυτότητα, η δήλωση μετακίνησης ΑΝΑ ταυτότητα', async () => {
    const { geocode } = witness(HIT_FAR);
    const other = { ...HUMAN_16, id: 'addr-other' };

    const { addresses, drifts, tally } = await resolveAddressPositions(
      [HUMAN_16, other],
      [{ ...HUMAN_16, street: 'Εγνατίας', number: '147' }, { ...other }],
      geocode,
      NOW,
      { relocateIds: new Set(['addr-other']) },
    );

    expect(drifts).toEqual([expect.objectContaining({ addressId: 'addr-16' })]);
    expect(addresses[1].coordinates).toEqual({ lat: HIT_FAR.lat, lng: HIT_FAR.lng });
    expect(tally['human-kept']).toBe(1);
    expect(tally.geocoded).toBe(1);
  });
});

describe('Β7 — η ΓΡΑΦΗ χωρίς κενά στα άκρα, στο ένα σύνορο εγγραφής', () => {
  it('«Σαμοθράκης » ⇒ γράφεται «Σαμοθράκης» — και ΔΕΝ μετρά ως αλλαγή ταυτότητας (μηδέν αιτήματα)', async () => {
    const { geocode, calls } = witness(HIT_SAME_STREET);

    const { addresses, tally } = await resolveAddressPositions(
      [MACHINE_16], [{ ...MACHINE_16, street: 'Σαμοθράκης ' }], geocode, NOW,
    );

    expect(addresses[0].street).toBe('Σαμοθράκης');
    expect(tally.unchanged).toBe(1);
    expect(calls).toHaveLength(0);
  });
});
