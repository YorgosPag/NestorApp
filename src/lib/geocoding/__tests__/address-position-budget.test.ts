/**
 * Π — **Η αποθήκευση δεν περιμένει τη μηχανή πάνω από όσο δηλώνει** (ADR-332 D27 Ζ5).
 *
 * 🔴 **Μετρημένο ζωντανά: 61,4 δευτερόλεπτα.** Ένας **μη κρίσιμος** γραφέας (η επίλυση θέσης) κρατούσε την
 * «Αποθήκευση» ένα λεπτό, επειδή η σάρωση ρωτούσε τη μηχανή **σειριακά, χωρίς προθεσμία** — και η μηχανή
 * δοκιμάζει **έως 8 παραλλαγές** με `sleep(1100ms)` ανάμεσά τους.
 *
 * ── Η ΑΡΧΗ: *deadline propagation* (Google SRE) — το ίδιο πρότυπο που το Β13 έβαλε ήδη στο **αντίστροφο** ──
 * Κάθε διεύθυνση ρωτά **πόσο απομένει** πριν ρωτήσει τη μηχανή. Όποια δεν χωρά παίρνει `budget-exhausted`:
 * η θέση της **μένει άθικτη**, τίποτα δεν σβήνεται, η επόμενη αποθήκευση ξαναλύνει.
 *
 * 🔑 **Γιατί ΟΓΔΟΗ έκβαση και όχι `geocoder-unavailable`**: «δεν πρόλαβα» **δεν είναι** «δεν απάντησε».
 * Οι δύο έχουν την ίδια πράξη (κράτα τη θέση) αλλά **διαφορετική αιτία** — και μια λογιστική που τις
 * ισοπεδώνει διαβάζεται λάθος: «ο γεωκωδικοποιητής είναι πεσμένος» ενώ στην πραγματικότητα *εμείς* κόψαμε.
 *
 * 🔑 **Προτεραιότητα: θέσεις πριν από συμβουλές.** Το `keepHumanPin` ξοδεύει αίτημα **μόνο** για να μετρήσει
 * απόκλιση — συμβουλή, όχι θέση. Όταν ο προϋπολογισμός στενεύει, θυσιάζεται **αυτή πρώτη**, ποτέ μια θέση.
 */

import {
  ADDRESS_POSITION_OUTCOMES,
  resolveAddressPosition,
  resolveAddressPositions,
  type AddressGeocoder,
  type AddressLike,
  type GeocodeHit,
} from '../address-position';

const NOW = 1_756_000_000_000;

const HIT: GeocodeHit = { lat: 40.6401, lng: 22.9444, accuracy: 'exact', confidence: 0.93, variantUsed: 2 };
const EGNATIA: AddressLike = { street: 'Εγνατίας', number: '147', city: 'Θεσσαλονίκη' };

/**
 * Θέση που την έβαλε **η μηχανή**, όχι άνθρωπος.
 *
 * 🔑 Χωρίς τα `geocodingMetadata` μια αποθηκευμένη συντεταγμένη λογίζεται **ανθρώπινη πινέζα** (κανόνας 2γ)
 * και η αλλαγή κειμένου οδηγεί στο `keepHumanPin` — δηλαδή σε **συμβουλή**, όχι σε ερώτηση θέσης.
 * Η πρώτη γραφή αυτών των αγκυρών το ξέχασε και τρεις από αυτές μετρούσαν **άλλο μονοπάτι**.
 */
const MACHINE_POSITION = {
  coordinates: { lat: 40.60, lng: 22.90 },
  geocodingMetadata: { confidence: 0.9, accuracy: 'exact' as const, variantUsed: 2 },
};

function spyGeocoder(answer: GeocodeHit | null = HIT): {
  geocode: AddressGeocoder;
  calls: Array<Record<string, string | undefined>>;
} {
  const calls: Array<Record<string, string | undefined>> = [];
  const geocode: AddressGeocoder = async (query) => {
    calls.push({ ...query });
    return answer;
  };
  return { geocode, calls };
}

/** Προϋπολογισμός που έχει ήδη εξαντληθεί. */
const SPENT = { remainingMs: () => 0, advisoryReserveMs: 3_000 };
/** Προϋπολογισμός άφθονος. */
const AMPLE = { remainingMs: () => 60_000, advisoryReserveMs: 3_000 };
/** Απομένει χρόνος για **θέση**, αλλά όχι για **συμβουλή**. */
const TIGHT = { remainingMs: () => 1_000, advisoryReserveMs: 3_000 };

describe('Π — προθεσμία στην επίλυση θέσεων', () => {
  it('Π1 — εξαντλημένος προϋπολογισμός ⇒ budget-exhausted, ΚΑΜΙΑ κλήση, θέση ΑΝΕΠΑΦΗ', async () => {
    const { geocode, calls } = spyGeocoder();
    const stored: AddressLike = {
      ...EGNATIA,
      coordinates: { lat: 40.60, lng: 22.90 },
      geocodingMetadata: { confidence: 0.9, accuracy: 'exact', variantUsed: 2 },
    };
    const incoming: AddressLike = { ...stored, street: 'Τσιμισκή' };

    const { outcome, position } = await resolveAddressPosition(stored, incoming, geocode, NOW, {
      budget: SPENT,
    });

    expect(outcome).toBe('budget-exhausted');
    expect(calls).toHaveLength(0);
    // Τίποτα δεν σβήνεται: η επόμενη αποθήκευση ξαναλύνει.
    expect(position.coordinates).toEqual({ lat: 40.60, lng: 22.90 });
  });

  it('Π1β — «δεν πρόλαβα» ΔΕΝ είναι «δεν απάντησε»: ξεχωριστές εκβάσεις', async () => {
    const stored: AddressLike = { ...EGNATIA, ...MACHINE_POSITION };
    const incoming: AddressLike = { ...stored, street: 'Τσιμισκή' };

    const failing: AddressGeocoder = async () => {
      throw new Error('δίκτυο');
    };
    const down = await resolveAddressPosition(stored, incoming, failing, NOW, { budget: AMPLE });
    const cut = await resolveAddressPosition(stored, incoming, spyGeocoder().geocode, NOW, { budget: SPENT });

    expect(down.outcome).toBe('geocoder-unavailable');
    expect(cut.outcome).toBe('budget-exhausted');
    expect(down.outcome).not.toBe(cut.outcome);
  });

  it('Π1γ — ΧΩΡΙΣ δηλωμένο προϋπολογισμό η συμπεριφορά μένει ΑΚΡΙΒΩΣ η παλιά', async () => {
    // Ο παρονομαστής: αν η προθεσμία «διέρρεε» ως προεπιλογή, κάθε υπάρχων καλών θα άλλαζε σιωπηλά.
    const { geocode, calls } = spyGeocoder();
    const stored: AddressLike = { ...EGNATIA, coordinates: { lat: 40.60, lng: 22.90 } };
    const incoming: AddressLike = { ...stored, street: 'Τσιμισκή', source: undefined };

    const { outcome } = await resolveAddressPosition(stored, incoming, geocode, NOW);

    expect(outcome).not.toBe('budget-exhausted');
    expect(calls.length).toBeGreaterThan(0);
  });

  it('Π2 — ΣΤΕΝΟΣ προϋπολογισμός: θυσιάζεται η ΣΥΜΒΟΥΛΗ, όχι η θέση', async () => {
    // Ανθρώπινη πινέζα + αλλαγμένο κείμενο ⇒ `human-kept`. Το αίτημα εκεί είναι **μόνο** για
    // να μετρηθεί απόκλιση. Με στενό χρόνο: η πινέζα μένει, η απόκλιση δεν μετριέται, καμία κλήση.
    const { geocode, calls } = spyGeocoder();
    const stored: AddressLike = {
      ...EGNATIA,
      coordinates: { lat: 40.60, lng: 22.90 },
      source: 'dragged',
    };
    const incoming: AddressLike = { ...stored, street: 'Τσιμισκή' };

    const { outcome, position, drift } = await resolveAddressPosition(stored, incoming, geocode, NOW, {
      budget: TIGHT,
    });

    expect(outcome).toBe('human-kept');
    expect(position.coordinates).toEqual({ lat: 40.60, lng: 22.90 });
    expect(drift).toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it('Π2β — με ΑΦΘΟΝΟ προϋπολογισμό η συμβουλή ΜΕΤΡΙΕΤΑΙ (η Π2 δοκιμάζει πραγματικό διακόπτη)', async () => {
    const { geocode, calls } = spyGeocoder();
    const stored: AddressLike = {
      ...EGNATIA,
      coordinates: { lat: 40.60, lng: 22.90 },
      source: 'dragged',
    };
    const incoming: AddressLike = { ...stored, street: 'Τσιμισκή' };

    const { outcome, drift } = await resolveAddressPosition(stored, incoming, geocode, NOW, {
      budget: AMPLE,
    });

    expect(outcome).toBe('human-kept');
    expect(calls).toHaveLength(1);
    expect(drift).toBeDefined();
  });

  it('Π3 — η λογιστική ΠΑΡΑΓΕΤΑΙ και περιέχει την όγδοη έκβαση', async () => {
    expect(ADDRESS_POSITION_OUTCOMES).toContain('budget-exhausted');
    expect(ADDRESS_POSITION_OUTCOMES).toHaveLength(8);

    const { geocode } = spyGeocoder();
    const stored: AddressLike = { id: 'a1', ...EGNATIA, ...MACHINE_POSITION };
    const incoming: AddressLike = { ...stored, street: 'Τσιμισκή' };

    const { tally } = await resolveAddressPositions([stored], [incoming], geocode, NOW, { budget: SPENT });

    // Κλειστή λογιστική: το «0» τυπώνεται, δεν σιωπά.
    expect(Object.keys(tally).sort()).toEqual([...ADDRESS_POSITION_OUTCOMES].sort());
    expect(tally['budget-exhausted']).toBe(1);
  });

  it('Π5 — ΑΡΓΗ μηχανή: η ίδια η κλήση φράζεται, δεν αρκεί ο έλεγχος ΠΡΙΝ από αυτήν', async () => {
    // 🔴 **ΤΟ ΚΕΝΟ ΠΟΥ ΒΡΗΚΕ Η ΖΩΝΤΑΝΗ ΜΕΤΡΗΣΗ (2026-09-12).** Η πρώτη γραφή έλεγχε «απομένει χρόνος;»
    // **πριν** την κλήση. Με **μία** διεύθυνση ο έλεγχος περνά μία φορά και μετά η κλήση τρέχει
    // ανεμπόδιστη: η σκάλα των 8 παραλλαγών μέτρησε **29,2″** ενώ ο προϋπολογισμός ήταν **9**.
    // Εδώ η μηχανή δεν απαντά ποτέ· η άγκυρα απαιτεί να γυρίσει ο γραφέας **μόνος του**.
    const never = new Promise<GeocodeHit | null>(() => undefined);
    const geocode: AddressGeocoder = () => never;
    const stored: AddressLike = { ...EGNATIA, ...MACHINE_POSITION };
    const incoming: AddressLike = { ...stored, street: 'Τσιμισκή' };

    const { outcome, position } = await resolveAddressPosition(stored, incoming, geocode, NOW, {
      budget: { remainingMs: () => 30, advisoryReserveMs: 0 },
    });

    expect(outcome).toBe('budget-exhausted');
    // Και πάλι: τίποτα δεν σβήνεται.
    expect(position.coordinates).toEqual(MACHINE_POSITION.coordinates);
  });

  it('Π5β — ΠΑΡΟΝΟΜΑΣΤΗΣ: αργή μηχανή ΜΕΣΑ στον χρόνο απαντά κανονικά', async () => {
    // Χωρίς αυτόν, η Π5 θα ήταν πράσινη ακόμη κι αν κόβαμε **κάθε** κλήση.
    const geocode: AddressGeocoder = async () => {
      await new Promise((r) => setTimeout(r, 10));
      return HIT;
    };
    const stored: AddressLike = { ...EGNATIA, ...MACHINE_POSITION };
    const incoming: AddressLike = { ...stored, street: 'Τσιμισκή' };

    const { outcome } = await resolveAddressPosition(stored, incoming, geocode, NOW, {
      budget: { remainingMs: () => 5_000, advisoryReserveMs: 0 },
    });

    expect(outcome).toBe('geocoded');
  });

  it('Π4 — η εκκρεμότητα ταξιδεύει ΟΝΟΜΑΣΤΙΚΑ, όχι μόνο ως αριθμός', async () => {
    // «Γνωστά εκκρεμές» αντί για «σιωπηλά μπαγιάτικο»: χωρίς ταυτότητα, η οθόνη ξέρει ότι *κάτι*
    // περιμένει αλλά δεν μπορεί να δείξει **ποιο** — δηλαδή ο άνθρωπος δεν μαθαίνει τίποτα χρήσιμο.
    const { geocode } = spyGeocoder();
    const stored: AddressLike = { id: 'addr_7', ...EGNATIA, ...MACHINE_POSITION };
    const incoming: AddressLike = { ...stored, street: 'Τσιμισκή' };

    const { pendingIds } = await resolveAddressPositions([stored], [incoming], geocode, NOW, {
      budget: SPENT,
    });

    expect(pendingIds).toEqual(['addr_7']);
  });

  it('Π4β — ΠΑΡΟΝΟΜΑΣΤΗΣ: με άφθονο χρόνο δεν εκκρεμεί τίποτα', async () => {
    const { geocode } = spyGeocoder();
    const stored: AddressLike = { id: 'addr_7', ...EGNATIA, ...MACHINE_POSITION };
    const incoming: AddressLike = { ...stored, street: 'Τσιμισκή' };

    const { pendingIds } = await resolveAddressPositions([stored], [incoming], geocode, NOW, {
      budget: AMPLE,
    });

    expect(pendingIds).toEqual([]);
  });

  it('Π3β — ο προϋπολογισμός εξαντλείται ΣΤΗ ΜΕΣΗ: οι πρώτες λύνονται, οι επόμενες κρατούν θέση', async () => {
    // Η πραγματική μορφή του προβλήματος: επαφή με πολλές διευθύνσεις. Δεν θυσιάζονται όλες —
    // θυσιάζονται **όσες δεν χωρούν**, και μόνο αυτές.
    let budget = 10_000;
    const calls: string[] = [];
    const geocode: AddressGeocoder = async (query) => {
      calls.push(query.street ?? '');
      budget -= 6_000; // κάθε κλήση τρώει μεγάλο μέρος του προϋπολογισμού
      return HIT;
    };

    const stored: AddressLike[] = [
      { id: 'a1', ...EGNATIA, ...MACHINE_POSITION, coordinates: { lat: 40.1, lng: 22.1 } },
      { id: 'a2', ...EGNATIA, ...MACHINE_POSITION, coordinates: { lat: 40.2, lng: 22.2 } },
      { id: 'a3', ...EGNATIA, ...MACHINE_POSITION, coordinates: { lat: 40.3, lng: 22.3 } },
    ];
    const incoming = stored.map((a, i) => ({ ...a, street: `Νέα Οδός ${i}` }));

    const { addresses, tally } = await resolveAddressPositions(stored, incoming, geocode, NOW, {
      budget: { remainingMs: () => budget, advisoryReserveMs: 3_000 },
    });

    expect(calls.length).toBeGreaterThan(0);
    expect(tally['budget-exhausted']).toBeGreaterThan(0);
    // Καμία διεύθυνση δεν έχασε τη θέση της.
    expect(addresses.every((a) => a.coordinates !== undefined)).toBe(true);
  });
});
