/**
 * @fileoverview ADR-846 **Φάση 6** — **Η ΑΓΚΥΡΑ ΤΗΣ ΠΡΟΕΙΔΟΠΟΙΗΣΗΣ ΠΟΥ ΔΕΝ ΕΜΠΟΔΙΖΕΙ.**
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 Η ΚΕΝΤΡΙΚΗ ΑΓΚΥΡΑ ΕΙΝΑΙ Η **Α1**, ΚΑΙ ΕΛΕΓΧΕΙ ΜΙΑ **ΔΙΑΦΟΡΑ**, ΟΧΙ ΜΙΑ ΤΙΜΗ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Ο **ίδιος** κριτής απαντά `'outside'` για κενή δήλωση — και **έχει δίκιο** στη βιτρίνα,
 * όπου *«δεν δήλωσα τίποτα κι έχω δέκα ακίνητα»* είναι γνήσιο `understated` *(άγκυρα Α5
 * του `coverage-agreement.test.ts`, που μένει **αμετάβλητη**)*.
 *
 * ⛔ Στη **φόρμα καταχώρισης** η ίδια τιμή θα ήταν καταστροφή: κάθε μεσίτης χωρίς βιτρίνα
 * θα κατηγορούνταν, σε **κάθε** καταχώριση, για παράβαση κανόνα **που δεν έθεσε ποτέ**.
 *
 * ⇒ Η Α1 **εκτελεί και τα δύο** μέσα στο ίδιο test: αν κάποιος μετακομίσει τον φρουρό
 * μέσα στον κριτή *(η «προφανής» απλοποίηση)*, η μία από τις δύο προσδοκίες **σπάει**.
 * Ο φρουρός δεν προστατεύεται από σχόλιο· προστατεύεται από εκτέλεση.
 *
 * ⚠️ **Η ομάδα Γ τρέχει σε ΠΡΑΓΜΑΤΙΚΑ αποτυπώματα** *(πρότυπο: `presence-admin-ids.test`)*.
 * Το μάθημα είναι γραμμένο: είκοσι άγκυρες με **κατασκευασμένα** `GeoFootprint` ήταν όλες
 * πράσινες ενώ η οθόνη απαντούσε «Κανείς».
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ADMIN_FOOTPRINTS_SOURCE } from '@/lib/geo/admin-footprints';
import { NO_FOOTPRINTS } from '@/types/geo/admin-footprint';
import type { DeclaredCoverage } from '@/types/agency-coverage';
import type { GeoFootprint } from '@/types/geo/admin-footprint';
import type { ListingPosition } from '@/types/public-listing';

import { verdictForPosition } from '../coverage-agreement';
import type { CoverageResolvers, LineageResolver } from '../coverage-match';
import { reachVoiceOf, type ReachInput } from '../coverage-reach';
import type { FootprintEntries } from '../presence-admin-ids';

const AT = '2026-09-10T00:00:00.000Z';

/** Κενός χάρτης αποτυπωμάτων = **«δεν ρώτησα»**, ποτέ «πουθενά». */
const NO_FOOTPRINTS_MAP: FootprintEntries = new Map<string, GeoFootprint>();

/** Θεσσαλονίκη — το κέντρο της δήλωσης στις ομάδες Α/Β. */
const HOME = { lat: 40.64, lng: 22.94 } as const;
/** ~9 χλμ ανατολικά — **μέσα** σε δήλωση 20 χλμ. */
const NEAR = { lat: 40.64, lng: 23.046 } as const;
/** Κασσάνδρα Χαλκιδικής, ~75 χλμ — **έξω** από κάθε δήλωση εδώ. */
const FAR = { lat: 40.06, lng: 23.36 } as const;
/** ~24 χλμ: **έξω** από τα 20 ως σημείο, **εντός** των ±10 χλμ αβεβαιότητας πόλης. */
const JUST_OUTSIDE = { lat: 40.64, lng: 23.223 } as const;

const RADIUS_20KM: DeclaredCoverage = { circle: { center: HOME, radiusKm: 20 } };

/**
 * ⚠️ **Καμία διοικητική γεωμετρία στις ομάδες Α/Β** — εκεί η ερώτηση είναι *«μιλάμε ή
 * σιωπούμε;»*, που κρίνεται σε **κύκλους**. Η ονομασία έχει δική της ομάδα και δικά της
 * δεδομένα.
 */
const RESOLVERS: CoverageResolvers = { lineageOf: () => [], footprintOf: NO_FOOTPRINTS };

/** Θέση με **δηλωμένη ακρίβεια γεωκωδικοποιητή** — ο μοχλός της Α5. */
function geocoded(accuracy: 'exact' | 'center', point: { lat: number; lng: number }): ListingPosition {
  return { kind: 'known', provenance: 'geocoded', point, locatedAt: AT, accuracy };
}

/** Πινέζα ανθρώπου — **βέβαιη** θέση, χωρίς ζώνη αβεβαιότητας. */
function pinned(point: { lat: number; lng: number }): ListingPosition {
  return { kind: 'known', provenance: 'manual', point, locatedAt: AT };
}

/** Η κλήση με τα προεπιλεγμένα της σουίτας — **ένα** σημείο αλλαγής ανά άγκυρα. */
function voice(overrides: Partial<ReachInput>) {
  return reachVoiceOf({
    coverage: RADIUS_20KM,
    position: pinned(FAR),
    resolvers: RESOLVERS,
    footprints: NO_FOOTPRINTS_MAP,
    nameOf: () => null,
    ...overrides,
  });
}

// =============================================================================
// Α — Η ΣΙΩΠΗ ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΚΑΙ ΕΧΕΙ ΤΕΣΣΕΡΙΣ ΑΙΤΙΕΣ
// =============================================================================

describe('Α — πότε ΔΕΝ μιλάμε', () => {
  it('🔴 Α1 — ΚΑΜΙΑ δήλωση ⇒ ΣΙΩΠΗ, ενώ ο ΙΔΙΟΣ κριτής λέει «outside»', () => {
    // Ο παρονομαστής: ο κριτής, ρωτημένος **απευθείας**, κατηγορεί.
    expect(verdictForPosition(null, pinned(NEAR), RESOLVERS)).toBe('outside');

    // …και ο φρουρός της φόρμας τον σταματά. Οι δύο γραμμές μαζί **είναι** η απόδειξη:
    // μετακίνησε τον φρουρό μέσα στον κριτή και η πρώτη σπάει· βγάλ' τον και σπάει η δεύτερη.
    expect(voice({ coverage: null, position: pinned(NEAR) })).toEqual({ kind: 'silent' });
  });

  it('Α2 — καμία θέση ακόμη (ο άνθρωπος πληκτρολογεί) ⇒ σιωπή', () => {
    expect(voice({ position: null })).toEqual({ kind: 'silent' });
  });

  it('Α3 — θέση δηλωμένη ως άγνωστη ⇒ σιωπή', () => {
    expect(voice({ position: { kind: 'unknown', reason: 'owner-declined' } })).toEqual({
      kind: 'silent',
    });
  });

  it('Α4 — ΕΝΤΟΣ της δήλωσης ⇒ σιωπή (καμία γραμμή που λέει το αυτονόητο)', () => {
    expect(voice({ position: pinned(NEAR) })).toEqual({ kind: 'silent' });
  });

  it('🏆 Α5 — ΙΔΙΟ σημείο, ΔΥΟ ακρίβειες: η αβεβαιότητα ΣΙΩΠΑ, η βεβαιότητα ΜΙΛΑ', () => {
    // Εδώ ξεπερνάμε το Zillow, που συγκρίνει ΤΚ με ΤΚ **σαν να ήξερε** τη διεύθυνση.
    expect(voice({ position: geocoded('center', JUST_OUTSIDE) })).toEqual({ kind: 'silent' });
    expect(voice({ position: geocoded('exact', JUST_OUTSIDE) }).kind).toBe('outside');
  });

  it('Α6 — «όλη η Ελλάδα» καλύπτει και το πιο μακρινό ⇒ σιωπή', () => {
    expect(voice({ coverage: { nationwide: true } })).toEqual({ kind: 'silent' });
  });
});

// =============================================================================
// Β — Η ΦΩΝΗ, ΚΑΙ Η ΑΝΩΝΥΜΗ ΕΚΔΟΧΗ ΤΗΣ
// =============================================================================

describe('Β — πότε μιλάμε, και τι λέμε όταν δεν ξέρουμε το όνομα', () => {
  it('Β1 — αποδεδειγμένα εκτός ⇒ «outside»', () => {
    expect(voice({}).kind).toBe('outside');
  });

  it('🔴 Β2 — ΧΩΡΙΣ αποτυπώματα το εύρημα ΕΠΙΒΙΩΝΕΙ, μόνο ανώνυμο', () => {
    // Η ετυμηγορία βγήκε από τη **γεωμετρία της δήλωσης**· το όνομα είναι επιπλέον
    // ευγένεια. Ένα «σιώπησε αν δεν ξέρεις όνομα» θα έκρυβε αληθινό εύρημα.
    expect(voice({})).toEqual({ kind: 'outside', areaName: null });
  });

  it('Β3 — ταυτότητα χωρίς όνομα στην ιεραρχία ⇒ ανώνυμο, ΠΟΤΕ ωμό id', () => {
    // Τα δύο αρχεία (αποτυπώματα · ιεραρχία) μπορούν να αποκλίνουν κατά μία ανάπτυξη.
    const spoken = voice({ nameOf: () => null });
    expect(spoken).toEqual({ kind: 'outside', areaName: null });
  });
});

// =============================================================================
// Γ — 🏆 Η ΟΝΟΜΑΣΙΑ, ΠΑΝΩ ΣΤΑ ΔΙΑΝΕΜΟΜΕΝΑ ΔΕΔΟΜΕΝΑ
// =============================================================================

describe('Γ 🏆 — το σκαλοπάτι που Zillow και Idealista δεν ανεβαίνουν', () => {
  interface HierarchyRow {
    readonly id: string;
    readonly n: string;
    readonly p: string | null;
  }

  const HIERARCHY_PATH = join(process.cwd(), 'public', 'data', 'administrative-hierarchy.json');
  const FOOTPRINTS_PATH = join(process.cwd(), 'public', 'data', 'admin-footprints.json');

  const hierarchy = JSON.parse(readFileSync(HIERARCHY_PATH, 'utf8')) as { data: HierarchyRow[] };
  const parents = new Map(hierarchy.data.map((row) => [row.id, row.p] as const));
  const names = new Map(hierarchy.data.map((row) => [row.id, row.n] as const));

  /**
   * ⚠️ **Στήνεται εδώ και δεν δανείζεται το `lineageIdsOf`**, που διαβάζει την πηγή του
   * **περιηγητή** — σε αυτή τη σουίτα δεν φορτώνει. Ίδια σύμβαση: **εαυτός πρώτος**.
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

  /**
   * **ΔΗΜΟΣ ΚΟΡΔΕΛΙΟΥ - ΕΥΟΣΜΟΥ** — και το όνομα **δεν** γράφτηκε από μνήμη: το ίδιο
   * σημείο ταξίδεψε ως *«Σταυρούπολη»* από handoff σε ADR σε άγκυρα, και ήταν **λάθος**.
   */
  const REAL_ADDRESS = { lat: 40.6643092, lng: 22.8976016 } as const;

  /** Δήλωση **στην Αθήνα** ⇒ το θεσσαλονικιώτικο σημείο είναι αποδεδειγμένα εκτός. */
  const ATHENS_20KM: DeclaredCoverage = { circle: { center: { lat: 37.98, lng: 23.73 }, radiusKm: 20 } };

  let footprints: FootprintEntries;

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

  it('🔴 Γ1 — Η ΠΕΡΙΟΧΗ ΟΝΟΜΑΖΕΤΑΙ: «ο ΔΗΜΟΣ ΚΟΡΔΕΛΙΟΥ - ΕΥΟΣΜΟΥ δεν είναι στις περιοχές σου»', () => {
    const spoken = reachVoiceOf({
      coverage: ATHENS_20KM,
      position: pinned(REAL_ADDRESS),
      resolvers: { lineageOf, footprintOf: (id) => footprints.get(id) ?? null },
      footprints,
      nameOf: (adminId) => names.get(adminId) ?? null,
    });

    expect(spoken).toEqual({ kind: 'outside', areaName: 'ΔΗΜΟΣ ΚΟΡΔΕΛΙΟΥ - ΕΥΟΣΜΟΥ' });
  });

  it('Γ2 — ανοιχτή θάλασσα: εκτός δήλωσης, ΚΑΝΕΝΑ κελί ⇒ μιλά ΧΩΡΙΣ όνομα', () => {
    const spoken = reachVoiceOf({
      coverage: ATHENS_20KM,
      position: pinned({ lat: 37.5, lng: 25.5 }),
      resolvers: { lineageOf, footprintOf: (id) => footprints.get(id) ?? null },
      footprints,
      nameOf: (adminId) => names.get(adminId) ?? null,
    });

    expect(spoken).toEqual({ kind: 'outside', areaName: null });
  });

  it('🔒 Γ3 — ΜΗ-ΠΑΛΙΝΔΡΟΜΗΣΗ: δήλωση ΣΤΗ Θεσσαλονίκη ⇒ σιωπή για το ίδιο σημείο', () => {
    // Ο παρονομαστής του Γ1: το σημείο **δεν** είναι εγγενώς «εκτός» — είναι εκτός
    // **εκείνης** της δήλωσης. Χωρίς αυτό, ένα σπασμένο `coverageOverCircle` που πάντα
    // απαντά `disjoint` θα άφηνε το Γ1 πράσινο.
    const spoken = reachVoiceOf({
      coverage: { circle: { center: REAL_ADDRESS, radiusKm: 10 } },
      position: pinned(REAL_ADDRESS),
      resolvers: { lineageOf, footprintOf: (id) => footprints.get(id) ?? null },
      footprints,
      nameOf: (adminId) => names.get(adminId) ?? null,
    });

    expect(spoken).toEqual({ kind: 'silent' });
  });
});

// =============================================================================
// Δ — 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΤΗΝ ΟΘΟΝΗ, ΟΧΙ ΑΠΟ ΤΗΝ ΚΡΙΣΗ ΜΟΥ
// =============================================================================

/**
 * 🔴 **ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ** *(ζωντανό περπάτημα 2026-09-10)*: η οθόνη έγραψε
 * **«Ο ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ»**. Το άρθρο ήταν καρφωμένο στο locale
 * *(`Ο {area} δεν είναι…`)* και ήταν σωστό για **έναν** τύπο οντότητας από τους έξι.
 *
 * ⚠️ **ΚΑΙ ΟΙ ΔΩΔΕΚΑ ΑΓΚΥΡΕΣ ΗΤΑΝ ΠΡΑΣΙΝΕΣ** — γιατί όλες ρωτούσαν τη **μηχανή**, και
 * η μηχανή είχε δίκιο: επέστρεφε `areaName: 'ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ'`, σωστά.
 * Το ελάττωμα ζούσε στη **διατύπωση**, όπου καμία άγκυρα δεν κοίταζε. Είναι, κατά λέξη,
 * το σχήμα §8.8.17: *«η δουλειά δεν έφτανε στην οθόνη»*.
 *
 * 🔑 **Η άγκυρα φυλάει την ΚΛΑΣΗ, όχι το δείγμα.** Δεν ελέγχει «λέει Η ή Ο;» — ελέγχει
 * ότι **κανένα** κείμενο αυτής της οικογένειας δεν **παρεμβάλλει όνομα διοικητικής
 * οντότητας μέσα σε πρόταση**. Όσο ισχύει αυτό, το γένος **δεν μπορεί** να τεθεί λάθος:
 * το πρόβλημα δεν λύνεται, **παύει να υπάρχει**.
 *
 * ⛔ **Γι' αυτό ΔΕΝ γράφτηκε ICU `select` πάνω στον τύπο**: θα κάλυπτε τους έξι τύπους
 * και θα κουβαλούσε το **ΑΓΙΟ ΟΡΟΣ** *(ουδέτερο, και εμφανίζεται σε **ΔΥΟ** τύπους)* ως
 * εξαίρεση **ονόματος** μέσα στον κώδικα — γραμματική εξαρτημένη από δεδομένα, που σπάει
 * σιωπηλά μόλις το λεξιλόγιο αποκτήσει όνομα άλλου γένους.
 */
describe('Δ 🔴 — το όνομα είναι ΕΤΙΚΕΤΑ, ποτέ γραμματικό υποκείμενο', () => {
  const LOCALES = ['el', 'en'] as const;

  /** Τα κλειδιά της οικογένειας, από το **ίδιο** αρχείο που διαβάζει η οθόνη. */
  function reachGroup(lang: string): Record<string, string> {
    const raw = readFileSync(
      join(process.cwd(), 'src', 'i18n', 'locales', lang, 'property-market.json'),
      'utf8',
    );
    const group = (JSON.parse(raw) as {
      offer: { form: { coverageReach?: Record<string, string> } };
    }).offer.form.coverageReach;
    if (group === undefined) throw new Error(`${lang}: λείπει το offer.form.coverageReach`);
    return group;
  }

  it.each(LOCALES)(
    '🔴 Δ1 [%s] — ΚΑΝΕΝΑ κλειδί δεν παρεμβάλλει {area}: το γένος δεν μπορεί να τεθεί λάθος',
    (lang) => {
      const offenders = Object.entries(reachGroup(lang))
        .filter(([, text]) => text.includes('{area}'))
        .map(([key]) => key);

      expect(offenders).toEqual([]);
    },
  );

  it.each(LOCALES)('Δ2 [%s] — η οικογένεια είναι ΠΛΗΡΗΣ και κανένα κείμενο δεν είναι κενό', (lang) => {
    const group = reachGroup(lang);

    // ⚠️ Το κλειδί `named` **μένει** στη λίστα παρότι δεν δέχεται πια όρισμα: η οθόνη
    //    διαλέγει ανάμεσα σε `named` και `unnamed`, και ένα λείπον κλειδί θα ζωγράφιζε
    //    ωμό κλειδί **μόνο** στη μία από τις δύο διαδρομές — δηλαδή σπάνια και σιωπηλά.
    expect(Object.keys(group).sort()).toEqual(
      ['allowed', 'manage', 'named', 'title', 'unnamed', 'why'].sort(),
    );
    for (const [key, text] of Object.entries(group)) {
      expect(`${lang}.${key}: ${text.trim()}`).not.toMatch(/: $/);
    }
  });
});
