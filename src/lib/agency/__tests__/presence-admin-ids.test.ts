/**
 * @fileoverview 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ §9 #13, ΠΑΝΩ ΣΤΑ ΠΡΑΓΜΑΤΙΚΑ ΔΕΔΟΜΕΝΑ** — ADR-846.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ **ΠΡΑΓΜΑΤΙΚΑ** ΔΕΔΟΜΕΝΑ, ΚΑΙ ΟΧΙ ΚΑΤΑΣΚΕΥΑΣΜΕΝΑ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Η αστοχία που γέννησε αυτή τη φάση **ζούσε στα δεδομένα**, όχι στη μηχανή: οι είκοσι
 * άγκυρες του εσωτερικού καλύμματος *(§8.8.17)* τροφοδοτούσαν **κατασκευασμένα**
 * `GeoFootprint` με **υγιές** `innerKm`, και ήταν όλες πράσινες ενώ η ΠΕΡΙΦΕΡΕΙΑ
 * ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ απαντούσε **«Κανείς»** στην οθόνη.
 *
 * ⇒ Εδώ περνά **το ίδιο αρχείο** που κατεβάζει ο φυλλομετρητής, μέσα από **τον ίδιο**
 * αναγνώστη και **την ίδια** γενεαλογία. Πρότυπο: `geo/__tests__/admin-footprints-data`.
 *
 * ⚠️ **Οι συντεταγμένες είναι ΠΡΑΓΜΑΤΙΚΕΣ αγγελίες**, επαληθευμένες με
 * `isPointInGeoRings` πάνω στα πολύγωνα της πηγής *(§8.8.17)* — όχι εφευρημένα σημεία.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { lineageIdsOf } from '@/hooks/useAdministrativeHierarchy';
import { ADMIN_FOOTPRINTS_SOURCE } from '@/lib/geo/admin-footprints';
import { showcaseFixture } from '../__fixtures__/showcase-fixture';
import type { CoverageResolvers, LineageResolver } from '../coverage-match';
import { deepestContainingEntity, presenceAdminIdsOf } from '../presence-admin-ids';
import { applyShowcaseFilters } from '../showcase-filter';

const FOOTPRINTS_PATH = join(process.cwd(), 'public', 'data', 'admin-footprints.json');
const HIERARCHY_PATH = join(process.cwd(), 'public', 'data', 'administrative-hierarchy.json');

interface HierarchyRow {
  readonly id: string;
  readonly n: string;
  readonly p: string | null;
}

const hierarchy = JSON.parse(readFileSync(HIERARCHY_PATH, 'utf8')) as { data: HierarchyRow[] };
const parents = new Map(hierarchy.data.map((row) => [row.id, row.p] as const));

/**
 * ⚠️ **Ο γενεαλόγος στήνεται ΕΔΩ και δεν δανείζεται το `lineageIdsOf`**, γιατί εκείνο
 * διαβάζει το `HIERARCHY_SOURCE` του **περιηγητή**, που σε αυτή τη σουίτα δεν φορτώνει.
 * Η **σύμβαση** είναι ίδια *(εαυτός πρώτος, φρουρός 16)* — και η ίδια η ταυτότητα των
 * δύο υλοποιήσεων ελέγχεται στην ομάδα Σ.
 */
const lineageOf: LineageResolver = (entityId) => {
  if (!parents.has(entityId)) return [];
  const lineage: string[] = [];
  let current: string | null = entityId;
  let guard = 16;
  while (current !== null && guard-- > 0) {
    lineage.push(current);
    current = parents.get(current) ?? null;
  }
  return lineage;
};

/** Το `id` από το **όνομα** — τα ονόματα είναι σταθερά, τα ids όχι. */
function idOf(name: string): string {
  const row = hierarchy.data.find((entry) => entry.n === name);
  if (row === undefined) throw new Error(`Δεν βρέθηκε στην ιεραρχία: ${name}`);
  return row.id;
}

// Πραγματικές αγγελίες (§8.8.17, ground truth με `isPointInGeoRings`).
const DIAM_95 = { lat: 40.6306898, lng: 22.9468742 } as const; // εντός Δήμου Θεσσαλονίκης
const DIAM_80 = { lat: 40.6643092, lng: 22.8976016 } as const; // Σταυρούπολη — ΕΚΤΟΣ δήμου
const MEZONETA_95 = { lat: 37.98098, lng: 23.7333 } as const; // Αθήνα
const AEGEAN = { lat: 37.5, lng: 25.5 } as const; // ανοιχτή θάλασσα

let footprints: ReadonlyMap<string, import('@/types/geo/admin-footprint').GeoFootprint>;

beforeAll(async () => {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.endsWith('/data/admin-footprints.json')) throw new Error(`Απρόσμενο fetch: ${url}`);
    return { json: async () => JSON.parse(readFileSync(FOOTPRINTS_PATH, 'utf8')) } as Response;
  }) as typeof fetch;

  await ADMIN_FOOTPRINTS_SOURCE.load();
  const loaded = ADMIN_FOOTPRINTS_SOURCE.peek();
  if (loaded === null) throw new Error('Τα αποτυπώματα δεν φορτώθηκαν');
  footprints = loaded;
});

// =============================================================================
// Α — Ο ΕΠΙΛΥΤΗΣ ΠΑΝΩ ΣΤΑ ΔΙΑΝΕΜΟΜΕΝΑ ΔΕΔΟΜΕΝΑ
// =============================================================================

describe('Α 🏆 — ο κύκλος βρίσκει το ΒΑΘΥΤΕΡΟ κελί, και η ιεραρχία δίνει τα υπόλοιπα', () => {
  it('🔴 Α1 — ΤΟ ΕΥΡΗΜΑ: το ακίνητο που η ΠΕΡΙΦΕΡΕΙΑ δεν μπορούσε να δει', () => {
    // Ο **παρονομαστής**, και είναι το μισό της απόδειξης: η ΠΕΡΙΦΕΡΕΙΑ **δεν** μπορεί
    // να αποδείξει τον εγκλεισμό γεωμετρικά — το πλέγμα των ~9 χλμ δεν πιάνει την ακτή.
    const region = idOf('ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ');
    const municipality = idOf('ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ');

    const deepest = deepestContainingEntity({ center: DIAM_95, radiusKm: 0 }, footprints, lineageOf);

    expect(deepest).toBe(municipality);
    // …και **αυτή** είναι η θεραπεία: ο πρόγονος βγαίνει από την ιεραρχία, όχι από γεωμετρία.
    expect(lineageOf(deepest as string)).toContain(region);
  });

  it('🔴 Α2 — Η ΑΒΕΒΑΙΟΤΗΤΑ ΑΝΕΒΑΖΕΙ ΕΠΙΠΕΔΟ, ΔΕΝ ΜΑΝΤΕΥΕΙ', () => {
    // Ίδιο σημείο, ακτίνα **250 m** (`interpolated`): ο δήμος **παύει** να αποδεικνύεται
    // και η απάντηση ανεβαίνει στην Π.Ε. — **ποτέ** «μάλλον ο δήμος».
    const exact = deepestContainingEntity({ center: DIAM_80, radiusKm: 0 }, footprints, lineageOf);
    const fuzzy = deepestContainingEntity(
      { center: DIAM_80, radiusKm: 0.25 },
      footprints,
      lineageOf,
    );

    expect(exact).toBe(idOf('ΔΗΜΟΣ ΚΟΡΔΕΛΙΟΥ - ΕΥΟΣΜΟΥ'));
    expect(fuzzy).toBe(idOf('ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ'));
    // 🔒 Και στις δύο περιπτώσεις η ΠΕΡΙΦΕΡΕΙΑ παραμένει απαντήσιμη — η ακρίβεια που
    //    χάθηκε κόστισε **βάθος**, όχι **αλήθεια**.
    expect(lineageOf(fuzzy as string)).toContain(idOf('ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ'));
  });

  it('Α3 — ΜΗ-ΠΑΛΙΝΔΡΟΜΗΣΗ: η Αθήνα λύνεται, και ΔΕΝ αγγίζει την Κ. Μακεδονία', () => {
    const deepest = deepestContainingEntity(
      { center: MEZONETA_95, radiusKm: 0 },
      footprints,
      lineageOf,
    );

    expect(deepest).toBe(idOf('ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ'));
    expect(lineageOf(deepest as string)).toContain(idOf('ΠΕΡΙΦΕΡΕΙΑ ΑΤΤΙΚΗΣ'));
    expect(lineageOf(deepest as string)).not.toContain(idOf('ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ'));
  });

  it('🔴 Α4 — ΚΑΜΙΑ ΑΠΟΔΕΙΞΗ ⇒ `null`, ποτέ «το πιο κοντινό»', () => {
    // Ανοιχτή θάλασσα, και μεγάλος κύκλος στη στεριά: το `null` είναι **απάντηση**, όχι
    // αποτυχία. Ένα «το πλησιέστερο» εδώ θα ήταν ισχυρισμός παρουσίας χωρίς απόδειξη.
    expect(deepestContainingEntity({ center: AEGEAN, radiusKm: 0 }, footprints, lineageOf)).toBeNull();
    expect(
      deepestContainingEntity({ center: DIAM_95, radiusKm: 50 }, footprints, lineageOf),
    ).toBeNull();
  });

  it('🔒 Α5 — ΧΩΡΙΣ ΑΠΟΤΥΠΩΜΑΤΑ δεν ισχυρίζεται τίποτα (ο φρουρός ΕΚΤΕΛΕΙΤΑΙ)', () => {
    // ⚠️ Δεν είναι διακοσμητικό: αυτή **ακριβώς** είναι η κατάσταση του διακομιστή αν ο
    //    `readAdminFootprints` επιστρέψει `null` — και ο λόγος που ο γραφέας **δεν
    //    γράφει** το πεδίο τότε, αντί να γράψει κενό σύνολο.
    expect(deepestContainingEntity({ center: DIAM_95, radiusKm: 0 }, new Map(), lineageOf)).toBeNull();
    expect(presenceAdminIdsOf([{ center: DIAM_95, radiusKm: 0 }], new Map(), lineageOf)).toEqual([]);
  });

  it('🔴 Α6 — ΑΓΝΩΣΤΗ ΙΕΡΑΡΧΙΑ ⇒ καμία ταυτότητα, ποτέ αυθαίρετη επιλογή', () => {
    // Κενή γενεαλογία = «δεν ξέρω». Ο κανόνας *«ποιος εξηγεί τους άλλους»* δεν έχει
    // νικητή, και η συνάρτηση **δεν πέφτει πίσω** σε «ο πρώτος που βρήκα».
    const unloaded: LineageResolver = () => [];
    expect(
      deepestContainingEntity({ center: DIAM_95, radiusKm: 0 }, footprints, unloaded),
    ).toBeNull();
  });
});

// =============================================================================
// Β — ΤΟ ΣΥΝΟΛΟ: ΑΠΟΡΡΟΦΗΣΗ ΚΑΙ ΑΝΤΙΜΟΝΟΠΩΛΙΑΚΟ ΣΧΗΜΑ
// =============================================================================

describe('Β 🏆 — σύνολο, όχι λίστα: το πεδίο λέει ΠΟΥ και δεν μπορεί να πει ΠΟΣΑ', () => {
  it('🔴 Β1 — ΔΥΟ ΑΓΓΕΛΙΕΣ ΣΤΟΝ ΙΔΙΟ ΔΗΜΟ ΔΙΝΟΥΝ ΜΙΑ ΤΑΥΤΟΤΗΤΑ', () => {
    // Ο **δομικός** αντιμονοπωλιακός φρουρός: μετά την απορρόφηση **δεν υπάρχει αριθμός
    // αποθέματος να ταξινομηθεί**, ακόμη κι αν η άγκυρα της σειράς παρακαμφθεί (§8.8.8).
    const near = { lat: 40.6307, lng: 22.9469 } as const;
    const ids = presenceAdminIdsOf(
      [
        { center: DIAM_95, radiusKm: 0 },
        { center: near, radiusKm: 0 },
      ],
      footprints,
      lineageOf,
    );

    expect(ids).toEqual([idOf('ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ')]);
  });

  it('🔴 Β2 — Ο ΠΡΟΓΟΝΟΣ ΑΠΟΡΡΟΦΑΤΑΙ ΑΠΟ ΤΟΝ ΑΠΟΓΟΝΟ, και δεν χάνεται απάντηση', () => {
    // Ο ένας κύκλος αποδεικνύει **δήμο**, ο άλλος μόνο **Π.Ε.** Η Π.Ε. φεύγει — γιατί η
    // γενεαλογία του δήμου τη συνεπάγεται — και το ερώτημα «Π.Ε.» **εξακολουθεί** να
    // απαντιέται. Αυτή η δεύτερη προσδοκία είναι που κάνει την απορρόφηση **ανώδυνη**.
    const ids = presenceAdminIdsOf(
      [
        { center: DIAM_95, radiusKm: 0 },
        { center: DIAM_80, radiusKm: 0.25 },
      ],
      footprints,
      lineageOf,
    );

    expect(ids).toEqual([idOf('ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ')]);
    expect(ids.flatMap(lineageOf)).toContain(idOf('ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ'));
  });

  it('Β3 — ΔΥΟ ΞΕΧΩΡΙΣΤΕΣ ΠΕΡΙΟΧΕΣ μένουν δύο (η απορρόφηση δεν καταπίνει)', () => {
    // Ο παρονομαστής της Β1/Β2: χωρίς αυτό, ένα «κράτα πάντα έναν» θα τις άφηνε πράσινες.
    const ids = presenceAdminIdsOf(
      [
        { center: DIAM_95, radiusKm: 0 },
        { center: MEZONETA_95, radiusKm: 0 },
      ],
      footprints,
      lineageOf,
    );

    expect([...ids].sort()).toEqual(
      [idOf('ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ'), idOf('ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ')].sort(),
    );
  });

  it('Β4 — κύκλος χωρίς απόδειξη ΔΕΝ μολύνει τους υπόλοιπους', () => {
    const ids = presenceAdminIdsOf(
      [
        { center: AEGEAN, radiusKm: 0 },
        { center: MEZONETA_95, radiusKm: 0 },
      ],
      footprints,
      lineageOf,
    );

    expect(ids).toEqual([idOf('ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ')]);
  });

  it('Β5 — ιδεμποτής: ίδιοι κύκλοι, ίδιο σύνολο', () => {
    const circles = [
      { center: DIAM_95, radiusKm: 0 },
      { center: MEZONETA_95, radiusKm: 0 },
    ];
    expect(presenceAdminIdsOf(circles, footprints, lineageOf)).toEqual(
      presenceAdminIdsOf(circles, footprints, lineageOf),
    );
  });
});

// =============================================================================
// Σ — Η ΣΥΜΒΑΣΗ ΤΩΝ ΔΥΟ ΓΕΝΕΑΛΟΓΩΝ
// =============================================================================

describe('Σ — η ΣΥΜΒΑΣΗ της γενεαλογίας, ίδια και στις τρεις υλοποιήσεις', () => {
  it('🔴 Σ1 — ΕΑΥΤΟΣ ΠΡΩΤΟΣ, ΡΙΖΑ ΤΕΛΕΥΤΑΙΑ — και η αλυσίδα είναι ΠΡΑΓΜΑΤΙΚΗ', () => {
    // ⚠️ Χωρίς αυτό, η σουίτα θα μπορούσε να είναι πράσινη πάνω σε **δικό της** περίπατο
    //    που τυχαίνει να συμφωνεί — π.χ. αν επέστρεφε **όλες** τις οντότητες.
    const municipality = idOf('ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ');
    const chain = lineageOf(municipality);

    expect(chain[0]).toBe(municipality);
    expect(chain).toContain(idOf('ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ'));
    expect(chain).toContain(idOf('ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ'));
    // Η ρίζα δεν έχει γονέα — άρα η αλυσίδα **τελειώνει**, δεν κόβεται από τον φρουρό.
    expect(parents.get(chain[chain.length - 1] as string)).toBeNull();
    expect(chain.length).toBeLessThan(16);
  });

  it('🔴 Σ2 — «ΔΕΝ ΞΕΡΩ» ΕΙΝΑΙ ΚΕΝΟΣ ΠΙΝΑΚΑΣ, ΚΑΙ ΣΤΙΣ ΔΥΟ ΥΛΟΠΟΙΗΣΕΙΣ', () => {
    // 🔑 Η **κοινή σύμβαση** είναι το μόνο που τις δένει: ο περιηγητής *(`lineageIdsOf`,
    //    με μη-φορτωμένο στιγμιότυπο εδώ)* και ο δίσκος απαντούν **το ίδιο** για το
    //    άγνωστο — και ο επιλυτής βασίζεται σε αυτό για να απαντήσει `null` (Α6).
    expect(lineageOf('municipality:ΑΝΥΠΑΡΚΤΟ')).toEqual([]);
    expect(lineageIdsOf('municipality:ΑΝΥΠΑΡΚΤΟ')).toEqual([]);
  });
});

// =============================================================================
// Φ — ΤΟ ΦΙΛΤΡΟ ΤΗΣ ΟΘΟΝΗΣ: `?area=region:112`
// =============================================================================

describe('Φ 🔴 — ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΕΛΕΓΕ «ΚΑΝΕΙΣ»', () => {
  /** Οι πραγματικοί επιλυτές: γενεαλογία από τον δίσκο, αποτυπώματα από το ίδιο αρχείο. */
  const resolvers = (): CoverageResolvers => ({
    lineageOf,
    footprintOf: (adminId) => footprints.get(adminId) ?? null,
  });

  const visible = (
    showcases: readonly ReturnType<typeof showcaseFixture>[],
    adminId: string,
  ): readonly string[] =>
    applyShowcaseFilters(showcases, { occupation: null, where: { adminId } }, resolvers()).map(
      (showcase) => showcase.companyId,
    );

  /** Γραφείο **χωρίς καμία δήλωση** — μόνο η απόδειξη μιλά. */
  const proven = showcaseFixture({
    companyId: 'comp_proven',
    coverage: null,
    presence: [{ center: DIAM_95, radiusKm: 0 }],
    presenceAdminIds: [idOf('ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ')],
  });

  it('🔴 Φ1 — Η ΠΕΡΙΦΕΡΕΙΑ ΤΟΝ ΒΛΕΠΕΙ ΠΛΕΟΝ (η θεραπεία, στην ίδια διαδρομή με την οθόνη)', () => {
    expect(visible([proven], idOf('ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ'))).toEqual(['comp_proven']);
  });

  it('Φ2 — ο ΔΗΜΟΣ εξακολουθεί να τον βλέπει (καμία παλινδρόμηση στο στενό ερώτημα)', () => {
    expect(visible([proven], idOf('ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ'))).toEqual(['comp_proven']);
  });

  it('🔴 Φ3 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ΑΛΛΗ περιφέρεια ΔΕΝ τον βλέπει', () => {
    // Χωρίς αυτό, ένα «πάντα ναι» θα άφηνε τα Φ1/Φ2 πράσινα και θα κατέργει τον άξονα.
    expect(visible([proven], idOf('ΠΕΡΙΦΕΡΕΙΑ ΑΤΤΙΚΗΣ'))).toEqual([]);
  });

  it('🔴 Φ4 — ΓΕΩΜΕΤΡΙΑ ΜΟΝΗ ΤΗΣ: το έγγραφο ΠΡΙΝ τη φάση δουλεύει ακόμη στον ΔΗΜΟ', () => {
    // ⚠️ **Η απόδειξη ότι η ένωση ΣΥΜΠΛΗΡΩΝΕΙ**: κενές ταυτότητες *(κάθε παλιό έγγραφο)*,
    //    και ο δήμος εξακολουθεί να απαντά από το εσωτερικό κάλυμμα (§8.8.17).
    const legacy = showcaseFixture({
      companyId: 'comp_legacy',
      coverage: null,
      presence: [{ center: DIAM_95, radiusKm: 0 }],
      presenceAdminIds: [],
    });

    expect(visible([legacy], idOf('ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ'))).toEqual(['comp_legacy']);
    // …και **ΑΥΤΟ ΑΚΡΙΒΩΣ** ήταν το εύρημα: η περιφέρεια τον έχανε.
    expect(visible([legacy], idOf('ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ'))).toEqual([]);
  });
});
