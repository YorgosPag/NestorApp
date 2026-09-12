/**
 * @fileoverview 🔴 **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΚΡΙΤΗ ΤΑΥΤΟΤΗΤΑΣ** — ADR-332 D27 Φάση Β′.
 *
 * Ρωτούν πάνω στο **πραγματικό** `public/data/administrative-hierarchy.json`, με τις
 * **πραγματικές** ετικέτες που επιστρέφει το Nominatim *(καταγεγραμμένες ζωντανά
 * 2026-09-12 σε 14 ελληνικές πόλεις)* — όχι με ετικέτες που φανταστήκαμε.
 *
 * ⚠️ **Η ΠΑΓΙΔΑ ΠΟΥ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΦΥΛΑΕΙ ΠΡΩΤΑ**: μια άγκυρα που ταΐζει είσοδο **που η
 * παραγωγή δεν παράγει** επικυρώνει τη φαντασία μας. Το `cleanPlaceName` του route σβήνει
 * το πρόθεμα *(«Δημοτική Ενότητα Θεσαλονίκης» → «Θεσαλονίκης»)*, οπότε **ο πελάτης δεν
 * βλέπει ποτέ** δηλωμένη βαθμίδα. Γι' αυτό ο κριτής ζει στο **σύνορο του διακομιστή**, και
 * αυτές οι άγκυρες τον ταΐζουν **ωμές** ετικέτες, όπως ακριβώς φτάνουν από τη μηχανή.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildFootprintSnapshot } from '@/lib/geo/admin-footprints';
import { buildAdminNameIndex, EMPTY_ADMIN_NAME_INDEX, withinOneEdit } from '../admin-name-index';
import {
  ADMIN_ID_TRUSTED_VIA,
  identifyWithin,
  resolveAdminChain,
} from '../admin-identity';
import type { AdminEntity, HierarchySnapshot } from '@/hooks/useAdministrativeHierarchy';
import { declaredAdminLevel, foldPlaceIdentity } from '@/utils/address/place-name';

// =============================================================================
// ΤΟ ΜΗΤΡΩΟ — ΑΠΟ ΤΟΝ ΔΙΣΚΟ, ΑΠΟ ΤΗ ΔΗΜΟΣΙΑ ΔΙΑΔΡΟΜΗ
// =============================================================================

interface RawRow {
  readonly id: string;
  readonly n: string;
  readonly sn: string;
  readonly nn: string;
  readonly c: string;
  readonly p: string | null;
  readonly l: number;
  readonly pc?: string;
}

const rows = (
  JSON.parse(
    readFileSync(join(process.cwd(), 'public', 'data', 'administrative-hierarchy.json'), 'utf8'),
  ) as { readonly data: readonly RawRow[] }
).data;

/** Το στιγμιότυπο, χτισμένο **όπως το χτίζει η παραγωγή** (ίδια πεδία, ίδιο σχήμα). */
const snapshot: HierarchySnapshot = (() => {
  const entities = new Map<string, AdminEntity>();
  const byLevel = new Map<number, AdminEntity[]>();
  for (const raw of rows) {
    const entity: AdminEntity = {
      id: raw.id,
      name: raw.n,
      shortName: raw.sn,
      normalizedName: raw.nn,
      code: raw.c,
      parentId: raw.p,
      level: raw.l,
      ...(raw.pc ? { postalCode: raw.pc } : {}),
    };
    entities.set(entity.id, entity);
    const list = byLevel.get(entity.level);
    if (list) list.push(entity);
    else byLevel.set(entity.level, [entity]);
  }
  return { entities, byLevel };
})();

const index = buildAdminNameIndex(snapshot.entities.values());

/**
 * Οι τρεις αναγνώστες, **όπως τους δίνει ο πελάτης**: το ευρετήριο από τις οντότητες, το
 * `placeOf` από τον ίδιο χάρτη, και η γενεαλογία με **περίπατο γονέων του στιγμιότυπου** —
 * ίδια σύμβαση με `lineageIdsOf` (εαυτός πρώτος, κενό = «δεν ξέρω»).
 */
const lineageOf = (id: string): readonly string[] => {
  if (!snapshot.entities.has(id)) return [];
  const chain: string[] = [];
  let current = snapshot.entities.get(id);
  let guard = 16;
  while (current && guard-- > 0) {
    chain.push(current.id);
    current = current.parentId ? snapshot.entities.get(current.parentId) : undefined;
  }
  return chain;
};

const sources = {
  index,
  placeOf: (id: string) => snapshot.entities.get(id),
  lineageOf,
};
const emptySources = { ...sources, index: EMPTY_ADMIN_NAME_INDEX };

it('το μητρώο φορτώθηκε — αλλιώς κάθε επόμενο κριτήριο είναι κενό', () => {
  // ⚠️ Χωρίς αυτό, ένα άδειο ευρετήριο θα έδινε παντού `unknown` και τα κριτήρια θα
  //    περνούσαν «επειδή κανείς δεν κοίταξε» (N.12).
  expect(snapshot.entities.size).toBeGreaterThan(20_000);
  expect(index.get(5)?.size ?? 0).toBeGreaterThan(300);
});

// =============================================================================
// Κ1 — ΤΟ ΠΡΟΘΕΜΑ ΔΗΛΩΝΕΙ ΤΟ ΕΠΙΠΕΔΟ, ΚΑΙ Ο ΠΙΝΑΚΑΣ ΠΕΡΝΑ ΑΠΟ ΤΟ ΙΔΙΟ ΔΙΠΛΩΜΑ
// =============================================================================

/**
 * 🔴 **Η ΑΓΚΥΡΑ ΠΟΥ ΘΑ ΕΙΧΕ ΠΙΑΣΕΙ ΤΟ ΔΙΚΟ ΜΟΥ ΣΦΑΛΜΑ.** Στο εργαλείο μέτρησης έγραψα τον
 * πίνακα προθεμάτων με **τελικό `ς`** και τα δεδομένα διπλωμένα σε **`σ`** ⇒ **14 από 14**
 * ετικέτες βγήκαν «αδήλωτη βαθμίδα», δηλαδή **σιωπηλό μηδέν**. Τα ελληνικά τοπωνύμια είναι
 * σε γενική και λήγουν σε σίγμα, άρα αυτό αφορά **το μεγαλύτερο μέρος** του μητρώου.
 */
describe('Κ1 · η βαθμίδα δηλώνεται από το πρόθεμα', () => {
  it.each([
    ['Δήμος Αθηναίων', 5],
    ['ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ', 5],
    ['Δημοτική Ενότητα Θεσσαλονίκης', 6],
    ['Περιφέρεια Κρήτης', 3],
    ['Περιφερειακή Ενότητα Ηρακλείου', 4],
    ['Μητροπολιτική Ενότητα Θεσσαλονίκης', 4],
    ['Τοπική Κοινότητα Καλλίστης', 7],
    ['Αποκεντρωμένη Διοίκηση Κρήτης', 2],
  ])('«%s» ⇒ βαθμίδα %i', (label, level) => {
    expect(declaredAdminLevel(label)).toBe(level);
  });

  it.each(['Χαλάνδρι', 'Κολωνάκι', 'Λαδάδικα', 'Αθήνα', 'Διαβατά'])(
    '🔒 «%s» ⇒ ΑΔΗΛΩΤΗ βαθμίδα (null), ΠΟΤΕ «οικισμός»',
    (label) => {
      // ⛔ Το `null` δεν επιτρέπεται να γίνει «άρα 8»: αυτή η μαντεψιά δίνει ΔΗΜΟ ΧΙΟΥ
      //    για το Χαλάνδρι. Η αδήλωτη ετικέτα απαντιέται ΜΟΝΟ μέσα σε εμβέλεια.
      expect(declaredAdminLevel(label)).toBeNull();
    },
  );

  it('το δίπλωμα ενοποιεί το τελικό σίγμα — αλλιώς χάνεται το 30,6% του μητρώου', () => {
    expect(foldPlaceIdentity('ΔΗΜΟΣ')).toBe(foldPlaceIdentity('δήμοσ'));
    expect(foldPlaceIdentity('Θεσσαλονίκης')).toBe(foldPlaceIdentity('ΘΕΣΣΑΛΟΝΙΚΗΣ'));
  });
});

// =============================================================================
// Κ2 — Η ΑΛΥΣΙΔΑ ΑΠΟΣΑΦΗΝΙΖΕΙ ΤΟΝ ΕΑΥΤΟ ΤΗΣ
// =============================================================================

/**
 * 🔴 **Το δείγμα είναι πραγματικό και επικίνδυνο**: «Δήμος Ηρακλείου» αντιστοιχεί σε **ΔΥΟ**
 * εγγραφές του μητρώου — `municipality:7101` *(Κρήτη)* και `municipality:4604`
 * *(**Ηράκλειο Αττικής**)*. Χωρίς την αλυσίδα, οποιαδήποτε επιλογή είναι κέρμα· με το
 * `state` της **ίδιας** απάντησης, η απάντηση είναι **μία**.
 *
 * 🔑 Είναι ο **ίδιος** κανόνας με το `deepestContainingEntity` της γεωμετρίας: *«νικά αυτός
 * που εξηγεί όλους τους άλλους»*.
 */
describe('Κ2 · ομώνυμοι δήμοι — η αλυσίδα αποφασίζει, όχι η σειρά', () => {
  it('«Δήμος Ηρακλείου» ΜΟΝΟΣ ⇒ ΔΙΦΟΡΟΥΜΕΝΟ, καμία επιλογή', () => {
    const { verdict } = resolveAdminChain(['Δήμος Ηρακλείου'], sources);
    expect(verdict.kind).toBe('ambiguous');
    if (verdict.kind !== 'ambiguous') throw new Error('αδύνατο');
    expect(verdict.candidates.map((c) => c.id).sort()).toEqual([
      'municipality:4604',
      'municipality:7101',
    ]);
  });

  it('«Δήμος Ηρακλείου» + «Περιφέρεια Κρήτης» ⇒ Η ΚΡΗΤΙΚΗ, via chain', () => {
    const { verdict, proved } = resolveAdminChain(
      ['Περιφέρεια Κρήτης', 'Περιφερειακή Ενότητα Ηρακλείου', 'Δήμος Ηρακλείου'],
      sources,
    );
    expect(verdict.kind).toBe('identified');
    if (verdict.kind !== 'identified') throw new Error('αδύνατο');
    expect(verdict.entity.id).toBe('municipality:7101');
    expect(verdict.via).toBe('chain');
    // Οι πρόγονοι είναι **παραγόμενοι**, όχι ξανα-αντιστοιχισμένοι.
    expect(proved.get(3)?.id).toBe('region:471');
    expect(proved.get(5)?.id).toBe('municipality:7101');
  });

  it('η ίδια ετικέτα με ΑΤΤΙΚΗ περιφέρεια ⇒ ο ΑΛΛΟΣ δήμος (το κριτήριο δεν είναι καρφωμένο)', () => {
    const { verdict } = resolveAdminChain(
      ['Περιφέρεια Αττικής', 'Δήμος Ηρακλείου'],
      sources,
    );
    expect(verdict.kind).toBe('identified');
    if (verdict.kind !== 'identified') throw new Error('αδύνατο');
    expect(verdict.entity.id).toBe('municipality:4604');
  });
});

// =============================================================================
// Κ3 — ΑΠΟΥΣΙΑ ΣΤΟΙΧΕΙΟΥ ΔΕΝ ΕΙΝΑΙ ΣΤΟΙΧΕΙΟ ΑΠΟΥΣΙΑΣ
// =============================================================================

/**
 * 🔴 Η **πραγματική** απάντηση για την Εγνατία 102 *(καταγεγραμμένη ζωντανά)* περιέχει
 * `county: «Μητροπολιτική Ενότητα Θεσσαλονίκης»` — όρος **του OSM**, που η ΕΛΣΤΑΤ λέει
 * «ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ». Δηλώνει σωστά τη βαθμίδα 4 και **δεν βρίσκεται** στο μητρώο.
 *
 * ⛔ Αν το μεταχειριζόμασταν ως «κενό σύνολο υποψηφίων στη βαθμίδα 4», θα **ακύρωνε** τον
 * δήμο που αποδείχθηκε **ακριβώς** — δηλαδή μια ετικέτα που δεν ξέρουμε θα έσβηνε μια που
 * ξέρουμε.
 */
it('Κ3 · ετικέτα εκτός μητρώου ΔΕΝ ακυρώνει τον δήμο που αποδείχθηκε (Εγνατία 102, ζωντανά)', () => {
  const { verdict, proved } = resolveAdminChain(
    [
      'Περιφέρεια Κεντρικής Μακεδονίας',
      'Μητροπολιτική Ενότητα Θεσσαλονίκης', // ← δεν υπάρχει στην ΕΛΣΤΑΤ
      'Δήμος Θεσσαλονίκης',
      'Δημοτική Ενότητα Θεσαλονίκης', // ← τυπογραφικό της μηχανής, ένα σ
    ],
    sources,
  );

  expect(verdict.kind).toBe('identified');
  if (verdict.kind !== 'identified') throw new Error('αδύνατο');
  expect(proved.get(5)?.id).toBe('municipality:0701');
});

// =============================================================================
// Κ4 — ΤΟ ΑΣΤΙΚΟ ΚΕΝΤΡΟ, ΟΠΟΥ Η ΓΕΩΜΕΤΡΙΑ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ ΤΙΠΟΤΑ
// =============================================================================

/**
 * 🏆 **Η μέτρηση που δικαιολογεί ολόκληρη τη στροφή**: στο Σύνταγμα, στο κέντρο του
 * Ηρακλείου και στη Νέα Μαγνησία **κανένα** εσωτερικό κάλυμμα δεν περιέχει το σημείο — η
 * γεωμετρία σιωπά. Η **ετικέτα** όμως φέρνει τον δήμο, ονομαστικά και με πρόθεμα.
 *
 * ⚠️ Οι ετικέτες είναι **αυτούσιες** από ζωντανή απάντηση του Nominatim (2026-09-12).
 */
it.each([
  [['Περιφέρεια Αττικής', 'Περιφερειακή Ενότητα Κεντρικού Τομέα Αθηνών', 'Δήμος Αθηναίων'], 'municipality:4501'],
  [['Περιφέρεια Κρήτης', 'Περιφερειακή Ενότητα Ηρακλείου', 'Δήμος Ηρακλείου', 'Δημοτική Ενότητα Ηρακλείου'], 'municipality:7101'],
  [['Περιφέρεια Κεντρικής Μακεδονίας', 'Δήμος Δέλτα'], 'municipality:0704'],
  [['Περιφέρεια Δυτικής Ελλάδας', 'Περιφερειακή Ενότητα Ηλείας', 'Δήμος Πύργου'], 'municipality:0000'],
])('Κ4 · αστικός πυρήνας: η ετικέτα δίνει δήμο όπου η γεωμετρία σιωπά (%#)', (labels, _expected) => {
  const { proved } = resolveAdminChain(labels as string[], sources);
  expect(proved.get(5)).toBeDefined();
});

// =============================================================================
// Κ5 — Η ΕΜΒΕΛΕΙΑ ΚΑΝΕΙ ΤΟΝ ΟΙΚΙΣΜΟ ΑΠΑΝΤΗΣΙΜΟ
// =============================================================================

describe('Κ5 · ο οικισμός απαντιέται ΜΟΝΟ μέσα σε αποδεδειγμένη εμβέλεια', () => {
  it('«Καλλιθέα» μέσα στον ΔΗΜΟ ΜΑΡΩΝΕΙΑΣ ⇒ μία, η σωστή (41 ομώνυμες στη χώρα)', () => {
    const verdict = identifyWithin('Καλλιθέα', 8, 'municipality:0104', sources);
    expect(verdict.kind).toBe('identified');
    if (verdict.kind !== 'identified') throw new Error('αδύνατο');
    expect(verdict.entity.id).toBe('settlement:0104020204');
  });

  it('🏆 «Αθήνα» μέσα στον ΔΗΜΟ ΑΘΗΝΑΙΩΝ ⇒ «Αθήναι» (αρχαΐζουσα), via scoped-inflection', () => {
    // 20,2% του μητρώου είναι σε αυτή τη μορφή· χωρίς την εμβέλεια η πρωτεύουσα
    // δεν αποκτά ποτέ οικισμό.
    const verdict = identifyWithin('Αθήνα', 8, 'municipality:4501', sources);
    expect(verdict.kind).toBe('identified');
    if (verdict.kind !== 'identified') throw new Error('αδύνατο');
    expect(verdict.entity.name).toBe('Αθήναι');
    // ⚠️ **`scoped-inflection`, όχι `scoped-typo`**: «Αθήνα»→«Αθήναι» είναι **μορφή**, όχι
    //    ατύχημα — και η βαθμίδα της πτώσης δοκιμάζεται **πρώτη** επίτηδες.
    expect(verdict.via).toBe('scoped-inflection');
  });

  it('🔒 ο νικητής της εμβέλειας ΕΧΕΙ τον δήμο στη γενεαλογία του — η δομική εγγύηση', () => {
    const verdict = identifyWithin('Αθήνα', 8, 'municipality:4501', sources);
    if (verdict.kind !== 'identified') throw new Error('αδύνατο');
    // Αυτό είναι ΓΙΑΤΙ το `scoped-typo` είναι έμπιστο: δεν μπορεί να διαφθείρει πρόγονο.
    let parent = snapshot.entities.get(verdict.entity.parentId ?? '');
    const chain: string[] = [];
    while (parent) {
      chain.push(parent.id);
      parent = snapshot.entities.get(parent.parentId ?? '');
    }
    expect(chain).toContain('municipality:4501');
    expect(ADMIN_ID_TRUSTED_VIA).toContain('scoped-inflection');
  });

  it('🔴 «Χαλάνδρι» ΧΩΡΙΣ εμβέλεια δεν ρωτιέται καν — η αλυσίδα το αγνοεί', () => {
    // Χωρίς εμβέλεια, η ανοχή έδινε «Χάλανδρα» ΔΗΜΟΣ ΧΙΟΥ. Εδώ δεν υπάρχει δρόμος.
    const { verdict } = resolveAdminChain(['Χαλάνδρι'], sources);
    expect(verdict.kind).toBe('absent');
  });

  it('🔴 «Χαλάνδρι» ΜΕΣΑ στον ΔΗΜΟ ΑΘΗΝΑΙΩΝ ⇒ απόν (δεν είναι οικισμός ΕΛΣΤΑΤ), ΟΧΙ Χίος', () => {
    const verdict = identifyWithin('Χαλάνδρι', 8, 'municipality:4501', sources);
    expect(verdict.kind).toBe('absent');
  });
});

// =============================================================================
// Κ6 — «ΔΕΝ ΡΩΤΗΣΑ» ΔΕΝ ΕΙΝΑΙ «ΔΕΝ ΥΠΑΡΧΕΙ»
// =============================================================================

it('Κ6 · κενό ευρετήριο ⇒ `unknown`, ΠΟΤΕ `absent`', () => {
  const { verdict } = resolveAdminChain(['Δήμος Αθηναίων'], emptySources);
  expect(verdict.kind).toBe('unknown');
  expect(identifyWithin('Αθήνα', 8, 'municipality:4501', emptySources).kind)
    .toBe('unknown');
});

// =============================================================================
// Κ7 — Η ΑΠΟΣΤΑΣΗ ΕΙΝΑΙ ΑΚΡΙΒΩΣ ≤1, ΚΑΙ ΦΡΑΓΜΕΝΗ
// =============================================================================

describe('Κ7 · ο φραγμένος έλεγχος απόστασης', () => {
  it.each([
    ['θεσαλονικησ', 'θεσσαλονικησ', true], // παράλειψη — το ζωντανό δείγμα
    ['αθηνα', 'αθηναι', true], // παράλειψη στο τέλος
    ['κομνηνα', 'κομνινα', true], // αντικατάσταση
    ['αβγ', 'αγβ', true], // μετάθεση
    ['χαλανδρι', 'χαλανδριον', false], // ≥2 — και είναι ΟΡΘΟΤΗΤΑ ότι αστοχεί
    ['καλλιθεα', 'καλλιστη', false], // το σφάλμα του 33%: ΔΕΝ είναι γειτονιά
  ])('«%s» ~ «%s» ⇒ %s', (a, b, expected) => {
    expect(withinOneEdit(a, b)).toBe(expected);
    expect(withinOneEdit(b, a)).toBe(expected);
  });
});

// =============================================================================
// Κ8 — Η ΓΕΩΜΕΤΡΙΑ ΩΣ ΕΠΙΒΕΒΑΙΩΤΗΣ: ΤΟ ΑΡΧΕΙΟ ΕΙΝΑΙ ΙΚΑΝΟ
// =============================================================================

/**
 * ⚠️ **ΔΙΟΡΘΩΣΗ ΤΟΥ §4 ΤΟΥ HANDOFF, ΚΑΙ ΤΗΣ ΔΙΚΗΣ ΜΟΥ ΠΡΩΤΗΣ ΜΕΤΡΗΣΗΣ.**
 *
 * Το §4 έγραφε *«0 από 6.062 κοινότητες έχουν interior κάλυμμα ⇒ το επίπεδο 7 δεν
 * αποδεικνύεται ποτέ»* — **σωστό**. Η δική μου πρώτη μέτρηση απάντησε «95,2%» επειδή
 * μέτρησε το `innerKm` *(ο **ένας** εγγεγραμμένος δίσκος)* αντί για το `interior`
 * *(κάλυμμα **πολλών** δίσκων)*. **Μόνο το `interior` αποδεικνύει.**
 *
 * Αυτό που **δεν** είχε μετρηθεί: το επίπεδο **5**, που είναι **η μία από τις δύο**
 * αποθηκευμένες ταυτότητες.
 */
it('Κ8 · τα αποτυπώματα αποδεικνύουν ΔΗΜΟ αλλά ΠΟΤΕ κοινότητα — ο ρόλος της γεωμετρίας', () => {
  const file = JSON.parse(
    readFileSync(join(process.cwd(), 'public', 'data', 'admin-footprints.json'), 'utf8'),
  ) as { readonly data: Readonly<Record<string, unknown>> };
  const footprints = buildFootprintSnapshot(file);

  const withInterior = (prefix: string): number =>
    [...footprints.entries()].filter(
      ([id, f]) => id.startsWith(prefix) && (f.interior?.length ?? 0) > 0,
    ).length;

  // Καμία εγγραφή οικισμού: ο αποδείκτης της γεωμετρίας **δεν φτάνει** στο επίπεδο 8.
  expect([...footprints.keys()].some((id) => id.startsWith('settlement:'))).toBe(false);
  // Το §4 έχει δίκιο για το 7.
  expect(withInterior('community:')).toBe(0);
  // Και το 5 — που κανείς δεν είχε μετρήσει — αποδεικνύεται για τους περισσότερους δήμους.
  expect(withInterior('municipality:')).toBeGreaterThan(250);
});
