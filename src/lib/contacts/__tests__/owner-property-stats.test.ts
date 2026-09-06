/**
 * =============================================================================
 * ADR-842 §7.6.13 Δ — **ΤΑ ΤΡΙΑ ΦΙΛΤΡΑ ΠΟΥ Η ΟΘΟΝΗ ΠΡΟΣΦΕΡΕ ΧΩΡΙΣ ΝΑ ΤΑ ΚΑΝΕΙ**
 * =============================================================================
 *
 * Το ερώτημα: *«όταν ο άνθρωπος διαλέγει «3-5 ακίνητα», **συμβαίνει** κάτι — και
 * συμβαίνει **αυτό** που λέει η ετικέτα;»*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΛΑΤΤΩΜΑ ΗΤΑΝ **ΣΙΩΠΗ**, ΚΑΙ ΓΙ' ΑΥΤΟ ΕΖΗΣΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `contactFiltersConfig` πρόσφερε «Αριθμός ακινήτων» · «Συνολικό εμβαδόν» ·
 * «Μόνο με ιδιοκτησίες». Το `filterContactsForPage` **δεν τα διάβαζε καν**. Ο
 * χρήστης άλλαζε την επιλογή, η λίστα δεν κουνιόταν, και **καμία** πύλη δεν είχε
 * τρόπο να το δει: δεν υπήρχε σφάλμα, δεν υπήρχε νεκρός κώδικας, υπήρχε **απουσία
 * σύνδεσης** ανάμεσα σε δύο αρχεία που κανείς δεν ζήτησε να συμφωνούν.
 *
 * ⇒ Γι' αυτό η πρώτη δοκιμή εδώ δεν είναι για τον κριτή — είναι ότι **κάθε τιμή του
 * λεξιλογίου αλλάζει πράγματι το αποτέλεσμα**. Ένας κάδος που δεν ξεχωρίζει κανέναν
 * είναι κάδος που δεν λειτουργεί, ό,τι κι αν λέει η ετικέτα του.
 */

import {
  EMPTY_OWNER_STATS,
  PROPERTIES_COUNT_BUCKETS,
  TOTAL_AREA_BUCKETS,
  matchesPropertiesCount,
  matchesTotalArea,
  summarizeByOwner,
} from '@/lib/contacts/owner-property-stats';
import type { Property } from '@/types/property-viewer';

/** Ελάχιστο ακίνητο — μόνο τα δύο πεδία που διαβάζει ο συναθροιστής. */
const property = (soldTo: string | undefined, area?: number): Property =>
  ({ id: `p_${soldTo ?? 'none'}_${area ?? 'x'}`, soldTo, area }) as unknown as Property;

describe('ADR-842 §7.6.13 Δ — συνάθροιση ανά ιδιοκτήτη', () => {
  it('μετρά πλήθος και αθροίζει εμβαδόν ανά ιδιοκτήτη', () => {
    const stats = summarizeByOwner([
      property('c1', 50),
      property('c1', 70),
      property('c2', 200),
    ]);

    expect(stats.c1).toEqual({ propertiesCount: 2, totalArea: 120 });
    expect(stats.c2).toEqual({ propertiesCount: 1, totalArea: 200 });
  });

  it('ακίνητο χωρίς ιδιοκτήτη δεν χρεώνεται σε κανέναν', () => {
    const stats = summarizeByOwner([property(undefined, 999), property('c1', 10)]);

    expect(Object.keys(stats)).toEqual(['c1']);
    expect(stats.c1.totalArea).toBe(10);
  });

  it('ακίνητο χωρίς εμβαδόν μετράει στο πλήθος αλλά προσθέτει 0', () => {
    const stats = summarizeByOwner([property('c1'), property('c1', 40)]);

    expect(stats.c1).toEqual({ propertiesCount: 2, totalArea: 40 });
  });

  it('κενή είσοδος δίνει κενό πίνακα, όχι σφάλμα', () => {
    expect(summarizeByOwner([])).toEqual({});
  });
});

describe('ADR-842 §7.6.13 Δ — κάθε κάδος ΞΕΧΩΡΙΖΕΙ κάτι', () => {
  /**
   * 🔑 Η άγκυρα του **αρχικού** ελαττώματος: αν ένας κάδος απαντά το ίδιο για κάθε
   * τιμή, τότε η επιλογή του στην οθόνη δεν κάνει τίποτα — ακριβώς η κατάσταση που
   * επιδιορθώνεται.
   */
  const COUNT_PROBES = [0, 1, 2, 3, 5, 6, 20];

  it.each(PROPERTIES_COUNT_BUCKETS.filter((b) => b !== 'all'))(
    'ο κάδος πλήθους «%s» δέχεται κάποια και απορρίπτει κάποια',
    (bucket) => {
      const verdicts = COUNT_PROBES.map((n) => matchesPropertiesCount(bucket, n));
      expect(verdicts).toContain(true);
      expect(verdicts).toContain(false);
    },
  );

  const AREA_PROBES = [0, 1, 100, 100.5, 101, 300, 301, 5000];

  it.each(TOTAL_AREA_BUCKETS.filter((b) => b !== 'all'))(
    'ο κάδος εμβαδού «%s» δέχεται κάποια και απορρίπτει κάποια',
    (bucket) => {
      const verdicts = AREA_PROBES.map((a) => matchesTotalArea(bucket, a));
      expect(verdicts).toContain(true);
      expect(verdicts).toContain(false);
    },
  );

  it('το «all» δεν φιλτράρει ποτέ — σε κανέναν από τους δύο άξονες', () => {
    for (const n of COUNT_PROBES) expect(matchesPropertiesCount('all', n)).toBe(true);
    for (const a of AREA_PROBES) expect(matchesTotalArea('all', a)).toBe(true);
  });

  it('άγνωστη τιμή κάδου δεν φιλτράρει και δεν πετάει (έρχεται από URL/φόρμα)', () => {
    expect(matchesPropertiesCount('ό,τι νά ναι', 4)).toBe(true);
    expect(matchesTotalArea('', 4)).toBe(true);
  });
});

describe('ADR-842 §7.6.13 Δ — τα όρια, ρητά', () => {
  it.each([
    ['1-2', 0, false], ['1-2', 1, true], ['1-2', 2, true], ['1-2', 3, false],
    ['3-5', 2, false], ['3-5', 3, true], ['3-5', 5, true], ['3-5', 6, false],
    ['6+', 5, false], ['6+', 6, true], ['6+', 999, true],
  ])('πλήθος %s με %i → %s', (bucket, count, expected) => {
    expect(matchesPropertiesCount(bucket as string, count as number)).toBe(expected);
  });

  it.each([
    ['0-100', 0, false], ['0-100', 0.5, true], ['0-100', 100, true], ['0-100', 100.5, false],
    ['101-300', 100, false], ['101-300', 100.5, true], ['101-300', 300, true], ['101-300', 300.5, false],
    ['301+', 300, false], ['301+', 300.5, true],
  ])('εμβαδόν %s με %f → %s', (bucket, area, expected) => {
    expect(matchesTotalArea(bucket as string, area as number)).toBe(expected);
  });

  /**
   * 🔴 **ΤΟ ΚΕΝΟ ΤΟΥ ΠΡΟΓΟΝΟΥ, ΩΣ ΕΚΤΕΛΕΣΜΕΝΗ ΑΠΟΔΕΙΞΗ.**
   *
   * Ο νεκρός `useContactsState` έγραφε `'101-300' → totalArea >= 101`, οπότε μια
   * επαφή με **100,5 τ.μ.** δεν ταίριαζε σε **κανέναν** κάδο και εξαφανιζόταν από
   * κάθε φίλτρο εμβαδού. Εδώ οι κάδοι είναι **συνεχείς**: κάθε θετικό εμβαδόν
   * ανήκει σε **ακριβώς έναν**.
   */
  it.each([0.5, 1, 100, 100.5, 101, 300, 300.5, 301, 10_000])(
    'κάθε θετικό εμβαδόν ανήκει σε ΑΚΡΙΒΩΣ έναν κάδο (%f)',
    (area) => {
      const hits = TOTAL_AREA_BUCKETS.filter((b) => b !== 'all').filter((b) =>
        matchesTotalArea(b, area),
      );
      expect(hits).toHaveLength(1);
    },
  );

  it('το μηδενικό εμβαδόν δεν ανήκει σε κανέναν κάδο — «δεν κατέχει» δεν είναι «μικρό»', () => {
    const hits = TOTAL_AREA_BUCKETS.filter((b) => b !== 'all').filter((b) =>
      matchesTotalArea(b, 0),
    );
    expect(hits).toHaveLength(0);
  });

  it('η ουδέτερη απάντηση είναι μηδέν και μηδέν', () => {
    expect(EMPTY_OWNER_STATS).toEqual({ propertiesCount: 0, totalArea: 0 });
  });
});
