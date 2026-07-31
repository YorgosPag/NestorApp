/**
 * ADR-739 Φάση Δ — **ΦΡΟΥΡΟΣ 2 (ζωντανός)**: καμία οντότητα σκηνής δεν χάνει δεδομένα σε
 * JSON round-trip.
 *
 * ## Το σιωπηλό σφάλμα
 * Ένας `Map` δεν επιβιώνει `JSON.stringify` — γίνεται `{}` **χωρίς εξαίρεση και χωρίς
 * προειδοποίηση**. Πέντε *γενικοί* μηχανισμοί περνούν **κάθε** οντότητα από αυτό το
 * κανάλι: αποθήκευση/επαναφόρτωση σκηνής, `deepClone` για undo, διαγραφή+αναίρεση,
 * πρόχειρο, λανθάνουσα μνήμη ζωγραφικής. Άρα το σφάλμα δεν είναι «ένα bug του πίνακα»:
 * είναι μια **κλάση** που κάθε μελλοντική οντότητα μπορεί να ξαναγεννήσει.
 *
 * ## Γιατί δεν αρκεί το συμβόλαιο τύπου (`types/json-safe-entity.ts`)
 * Ο τύπος φρουρεί ό,τι κάποιος θυμήθηκε να καρφώσει με `AssertJsonSafe<…>`. Αυτό εδώ
 * διαβάζει τον **ζωντανό** κατάλογο `RENDERABLE_ENTITY_TYPES`: νέος τύπος οντότητας
 * μπαίνει στη λίστα και **αυτόματα** μπαίνει στον έλεγχο, χωρίς να χρειαστεί κανείς να το
 * θυμηθεί. Το ίδιο σχήμα με τα capability anchors του ADR-587 (ζωντανό μητρώο ↔ δηλωτικό).
 *
 * Είναι ακριβώς το μάθημα του **ADR-650 §M10e** (`services/dxf-scene-json.ts:52`): εκεί ο
 * loader διάλεγε πεδία με το χέρι και κάθε άλλο πεδίο χανόταν σιωπηλά· η διόρθωση δεν ήταν
 * «πρόσθεσε τα τέσσερα που λείπουν» αλλά δομική, *«so no FUTURE field can regress this way
 * either»*, φραγμένη από round-trip test. Ίδια συνταγή, ένα επίπεδο πιο πάνω.
 *
 * ## Τι κάνει διαφορετικά από ένα `expect(a).toEqual(b)`
 * Το `toEqual` λέει «διαφέρουν». Ο {@link findJsonUnsafePaths} λέει
 * `entity.model.cells → Map → γίνεται {} …` — **ποιο** πεδίο, **τι** είναι, **τι** του
 * συμβαίνει. Ένα test που δείχνει πού είναι το σφάλμα αξίζει δέκα που λένε ότι υπάρχει.
 *
 * @see types/json-safe-entity.ts — ο φρουρός χρόνου-μεταγλώττισης (ο αδελφός αυτού)
 * @see bim/table/__tests__/table-model-serialization.test.ts — η σημασιολογία του πίνακα
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §4, §18
 */

import { deepClone } from '@/lib/clone-utils';
import { RENDERABLE_ENTITY_TYPES } from '../../rendering/contract/renderable-entity-type';
import { makeEntityModel } from '../../rendering/hitTesting/__tests__/renderable-entity-fixtures';
import { createTableModel, toPersistedTableModel } from '../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../../bim/table/table-style-presets';
import type { TableEntity } from '../table-entity';
import type { TableModel } from '../table';
import type { AssertJsonSafe, JsonUnsafeKeys } from '../json-safe-entity';

// ──────────────────────────────────────────────────────────────────────────────
// Ο ανιχνευτής — λέει ΠΟΥ, όχι απλώς ΟΤΙ
// ──────────────────────────────────────────────────────────────────────────────

type UnsafeKind = 'Map' | 'Set' | 'Date' | 'RegExp' | 'function' | 'symbol' | 'bigint' | 'NaN' | 'Infinity';

/** Τι ακριβώς παθαίνει κάθε είδος στο `JSON.stringify` — το «γιατί» του ευρήματος. */
const LOSS_BY_KIND: Readonly<Record<UnsafeKind, string>> = {
  Map: 'γίνεται {} — ΟΛΑ τα κλειδιά χάνονται σιωπηλά',
  Set: 'γίνεται {} — ΟΛΑ τα μέλη χάνονται σιωπηλά',
  Date: 'γίνεται string και ΔΕΝ αναβιώνει ποτέ ως Date',
  RegExp: 'γίνεται {}',
  function: 'το κλειδί εξαφανίζεται εντελώς',
  symbol: 'το κλειδί εξαφανίζεται εντελώς',
  bigint: 'το JSON.stringify ΠΕΤΑΕΙ (η μόνη μη-σιωπηλή περίπτωση)',
  NaN: 'γίνεται null — αλλοίωση ΤΙΜΗΣ, όχι μορφής',
  Infinity: 'γίνεται null — αλλοίωση ΤΙΜΗΣ, όχι μορφής',
};

function unsafeKindOf(value: unknown): UnsafeKind | null {
  if (value instanceof Map) return 'Map';
  if (value instanceof Set) return 'Set';
  if (value instanceof Date) return 'Date';
  if (value instanceof RegExp) return 'RegExp';
  const t = typeof value;
  if (t === 'function') return 'function';
  if (t === 'symbol') return 'symbol';
  if (t === 'bigint') return 'bigint';
  // NaN/Infinity είναι η ύπουλη εκδοχή: το σχήμα επιβιώνει, η **τιμή** γίνεται null.
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return Number.isNaN(value) ? 'NaN' : 'Infinity';
  }
  return null;
}

const asRecord = (value: object): Record<string, unknown> => value as Record<string, unknown>;

/** Σύντομη, ασφαλής προεπισκόπηση τιμής για μήνυμα αποτυχίας. */
function preview(value: unknown): string {
  const kind = unsafeKindOf(value);
  if (kind) return kind;
  try {
    return (JSON.stringify(value) ?? String(value)).slice(0, 60);
  } catch {
    return String(value);
  }
}

/**
 * Σαρώνει αναδρομικά και επιστρέφει το **μονοπάτι** κάθε τιμής που δεν επιβιώνει JSON.
 * Κενός πίνακας = η οντότητα ταξιδεύει ακέραιη.
 */
function findJsonUnsafePaths(root: unknown, rootLabel = 'entity'): string[] {
  const found: string[] = [];
  /**
   * Οι **πρόγονοι** του τρέχοντος μονοπατιού — όχι «ό,τι έχει επισκεφθεί».
   *
   * Η διάκριση δεν είναι λεπτολογία: μία **κοινή αναφορά** (το ίδιο array σε δύο πεδία,
   * π.χ. `outline.vertices` και `footprint.vertices` του BIM fixture) είναι απολύτως
   * νόμιμη — το `JSON.stringify` απλώς τη γράφει δύο φορές. **Κύκλος** είναι μόνο η
   * αναφορά προς τα πίσω, στον ίδιο τον κλάδο· εκεί το `JSON.stringify` πετάει. Ένα
   * καθολικό `seen` θα κατήγγειλλε κάθε DAG ως κύκλο (και το έκανε, πριν διορθωθεί).
   */
  const ancestors = new Set<object>();

  const walk = (value: unknown, path: string): void => {
    const kind = unsafeKindOf(value);
    if (kind) {
      found.push(`${path} → ${kind} → ${LOSS_BY_KIND[kind]}`);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    if (ancestors.has(value)) {
      found.push(`${path} → κυκλική αναφορά — το JSON.stringify ΠΕΤΑΕΙ`);
      return;
    }
    ancestors.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`));
    } else {
      const record = asRecord(value);
      for (const key of Object.keys(record)) walk(record[key], `${path}.${key}`);
    }
    ancestors.delete(value);
  };

  walk(root, rootLabel);
  return found;
}

/**
 * Συγκρίνει «πριν» και «μετά» και επιστρέφει τα μονοπάτια που **απέκλιναν**. Το `undefined`
 * θεωρείται ισοδύναμο με απόν κλειδί (αυτό ακριβώς κάνει το `JSON.stringify` — δεν χάνεται
 * πληροφορία, το προαιρετικό πεδίο απλώς παραμένει απόν).
 */
function findRoundTripDivergences(before: unknown, after: unknown, rootLabel = 'entity'): string[] {
  const found: string[] = [];

  const walk = (a: unknown, b: unknown, path: string): void => {
    if (Object.is(a, b)) return;
    const kind = unsafeKindOf(a);
    if (kind) {
      found.push(`${path} → ${kind} → ${LOSS_BY_KIND[kind]} (μετά: ${preview(b)})`);
      return;
    }
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
      found.push(`${path}: ${preview(a)} ≠ ${preview(b)}`);
      return;
    }
    if (Array.isArray(a) !== Array.isArray(b)) {
      found.push(`${path}: ${preview(a)} ≠ ${preview(b)}`);
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) found.push(`${path}.length: ${a.length} ≠ ${b.length}`);
      const n = Math.max(a.length, b.length);
      for (let i = 0; i < n; i++) walk(a[i], b[i], `${path}[${i}]`);
      return;
    }
    const ra = asRecord(a);
    const rb = asRecord(b);
    for (const key of new Set([...Object.keys(ra), ...Object.keys(rb)])) {
      walk(ra[key], rb[key], `${path}.${key}`);
    }
  };

  walk(before, after, rootLabel);
  return found;
}

// ──────────────────────────────────────────────────────────────────────────────
// Το πεδίο ελέγχου
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 **ΓΝΩΣΤΗ ΑΠΟΚΛΙΣΗ ΤΟΥ ΚΟΙΝΟΥ FIXTURE — όχι εξαίρεση του φρουρού.**
 *
 * Το κοινό fixture του ADR-587 Φ10 (`rendering/hitTesting/__tests__/renderable-entity-
 * fixtures.ts`) φτιάχνει το `table` με `createTableModel(…)`, δηλαδή με **`TableModel`
 * (`Map`)**, ενώ το `TableEntity.model` είναι πλέον `PersistedTableModel` (ADR-739 Φ.Δ).
 * Η απόκλιση δεν σπάει τον compiler επειδή το fixture κάνει `as unknown as EntityModel`,
 * και δεν σπάει το `bounds-calculator-coverage` επειδή εκείνο το fixture τυχαίνει να έχει
 * **μηδέν κελιά** — δηλαδή είναι λάθος που σήμερα δεν κοστίζει τίποτα. Ακριβώς το είδος
 * που κοστίζει αύριο.
 *
 * Ο πίνακας **ελέγχεται κανονικά** παρακάτω, με το ΠΡΑΓΜΑΤΙΚΟ, ελεγμένο-από-compiler
 * σχήμα της οντότητας. Εδώ εξαιρείται μόνο το **μπαγιάτικο διπλό** του, καρφωμένο ρητά
 * ώστε να μην ξεχαστεί (βλ. describe «ΚΑΡΦΩΜΕΝΟ ΚΕΝΟ»).
 */
const STALE_SHARED_FIXTURE: readonly string[] = ['table'];

const REGISTRY_COVERED = RENDERABLE_ENTITY_TYPES.filter((t) => !STALE_SHARED_FIXTURE.includes(t));

/**
 * Οι `EntityType` που **δεν** είναι renderable, άρα δεν έχουν fixture πουθενά στο repo:
 * καθαρά editor-side δομές (`block`/`array`/`group`) και τα δύο annotation primitives που
 * ζουν εκτός του render contract. **Δεν καλύπτονται** από αυτό το test — γραμμένο ρητά
 * αντί για σιωπηλή περικοπή.
 */
const NOT_COVERED_ENTITY_TYPES: readonly string[] = [
  'block', 'array', 'group', 'center-mark', 'centerline',
];

/** Ο πίνακας όπως ζει **πραγματικά** στη σκηνή — τυποποιημένος, χωρίς κανένα cast. */
function makeRealTableEntity(): TableEntity {
  return {
    id: 'tbl_roundtrip',
    type: 'table',
    layerId: 'lyr_test',
    position: { x: 100, y: 200 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    model: toPersistedTableModel(
      createTableModel({
        columns: [
          { id: 'c1', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
          { id: 'c2', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'number', align: 'right' },
        ],
        rows: [
          { id: 'r1', rowClass: 'header', heightMm: 8 },
          { id: 'r2', rowClass: 'data', heightMm: 8 },
        ],
        cells: [
          ['r1', 'c1', { kind: 'text', value: 'Στοιχείο' }],
          ['r1', 'c2', { kind: 'text', value: 'Ποσότητα' }],
          ['r2', 'c1', { kind: 'text', value: 'Δοκός Δ1' }],
          ['r2', 'c2', { kind: 'text', value: 12.5 }],
        ],
        merges: [{ anchorRowId: 'r1', anchorColId: 'c1', rowSpan: 1, colSpan: 2 }],
      }),
    ),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Ο φρουρός πάνω στο ζωντανό μητρώο
// ──────────────────────────────────────────────────────────────────────────────

describe('ΦΡΟΥΡΟΣ — κάθε renderable οντότητα επιβιώνει JSON (ζωντανό μητρώο)', () => {
  it('καμία σιωπηλή περικοπή: ελεγμένοι + ρητά καρφωμένοι = ΟΛΟ το μητρώο', () => {
    expect([...REGISTRY_COVERED, ...STALE_SHARED_FIXTURE].sort())
      .toEqual([...RENDERABLE_ENTITY_TYPES].sort());
  });

  it.each(REGISTRY_COVERED)(
    '«%s» — μηδέν μη-σειριοποιήσιμη τιμή σε όλο το βάθος της οντότητας',
    (type) => {
      // Το μήνυμα αποτυχίας ΕΙΝΑΙ το ένοχο μονοπάτι (π.χ. «entity.model.cells → Map → …»).
      expect(findJsonUnsafePaths(makeEntityModel(type), `${type}`)).toEqual([]);
    },
  );

  it.each(REGISTRY_COVERED)(
    '«%s» — JSON round-trip ΚΑΙ deepClone (το μονοπάτι της αναίρεσης) είναι ταυτοτικά',
    (type) => {
      const entity = makeEntityModel(type);
      expect(findRoundTripDivergences(entity, JSON.parse(JSON.stringify(entity)), type)).toEqual([]);
      // Το `deepClone` ΕΙΝΑΙ `JSON.parse(JSON.stringify())`: ό,τι χάνεται στην αποθήκευση
      // χάνεται και στο στιγμιότυπο του undo — ίδιο κανάλι, δύο διαφορετικές συνέπειες.
      expect(findRoundTripDivergences(entity, deepClone(entity), type)).toEqual([]);
    },
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Ο πίνακας — ο λόγος ύπαρξης της Φάσης Δ
// ──────────────────────────────────────────────────────────────────────────────

describe('ΠΙΝΑΚΑΣ — με το ΠΡΑΓΜΑΤΙΚΟ σχήμα της οντότητας (χωρίς cast)', () => {
  it('μηδέν μη-σειριοποιήσιμη τιμή — ούτε στο μοντέλο, ούτε στις συγχωνεύσεις', () => {
    expect(findJsonUnsafePaths(makeRealTableEntity(), 'table')).toEqual([]);
  });

  it('round-trip + deepClone ταυτοτικά, με ΓΕΜΑΤΑ κελιά (4/4)', () => {
    const entity = makeRealTableEntity();
    expect(entity.model.cells).toHaveLength(4);
    expect(findRoundTripDivergences(entity, JSON.parse(JSON.stringify(entity)), 'table')).toEqual([]);
    expect(findRoundTripDivergences(entity, deepClone(entity), 'table')).toEqual([]);
  });

  it('ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΦΡΟΥΡΕΙ: το ευρετήριο μνήμης (`TableModel`) ΠΙΑΝΕΤΑΙ ως ένοχο', () => {
    // Αν κάποιος «απλοποιήσει» βάζοντας πάλι το runtime μοντέλο στην οντότητα, ο ανιχνευτής
    // δείχνει ακριβώς πού: `table.model.cells → Map`.
    const withRuntimeModel = { ...makeRealTableEntity(), model: createTableModel({ columns: [], rows: [] }) };
    const paths = findJsonUnsafePaths(withRuntimeModel, 'table');
    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain('table.model.cells → Map');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. Καρφωμένα κενά — γραμμένα, όχι σιωπηλά
// ──────────────────────────────────────────────────────────────────────────────

describe('ΚΑΡΦΩΜΕΝΟ ΚΕΝΟ — το κοινό fixture του ADR-587 Φ10 έμεινε πίσω', () => {
  it('το `makeEntityModel("table")` δίνει ΑΚΟΜΑ `Map` — μπαγιάτικο διπλό της οντότητας', () => {
    // 🔴 ΟΤΑΝ ΑΥΤΟ ΓΙΝΕΙ ΚΟΚΚΙΝΟ: το fixture διορθώθηκε (τυλίχθηκε σε `toPersistedTableModel`).
    // Τότε ΣΒΗΣΕ αυτό το describe και βγάλε το 'table' από το `STALE_SHARED_FIXTURE` —
    // ο πίνακας θα ελέγχεται πλέον και από τον βρόχο του μητρώου.
    const paths = findJsonUnsafePaths(makeEntityModel('table'), 'fixture');
    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain('fixture.model.cells → Map');
  });

  it('ο τύπος «table» παραμένει renderable — το κενό είναι του fixture, όχι του domain', () => {
    expect([...RENDERABLE_ENTITY_TYPES]).toContain('table');
  });
});

describe('ΓΝΩΣΤΑ ΚΕΝΑ — `EntityType` εκτός render contract (κανένα fixture στο repo)', () => {
  it.each(NOT_COVERED_ENTITY_TYPES)('«%s» δεν είναι renderable, άρα δεν ελέγχεται εδώ', (type) => {
    // Αν κάποιος τους κάνει renderable, μπαίνουν αυτόματα στον βρόχο του μητρώου — και
    // αυτό το test γίνεται κόκκινο, ζητώντας να ξαναγραφτεί η λίστα. Καμία σιωπή.
    expect([...RENDERABLE_ENTITY_TYPES]).not.toContain(type);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. ΑΝΤΙΣΤΡΟΦΟ — απόδειξη ότι ο ανιχνευτής δεν είναι μονίμως πράσινος
// ──────────────────────────────────────────────────────────────────────────────

describe('ΑΝΤΙΣΤΡΟΦΟ — ο ανιχνευτής ΠΙΑΝΕΙ ό,τι πρέπει (αλλιώς είναι διακοσμητικός)', () => {
  it('`Map` θαμμένος μέσα σε πίνακα μέσα σε αντικείμενο → ακριβές μονοπάτι', () => {
    const deep = { a: { b: [{ c: 1 }, { lookup: new Map([['k', 1]]) }] } };
    const paths = findJsonUnsafePaths(deep, 'x');
    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain('x.a.b[1].lookup → Map');
  });

  it('πιάνει `Set`, `Date`, συνάρτηση, `RegExp` — και τα τέσσερα ταυτόχρονα', () => {
    const dirty = { s: new Set([1]), d: new Date(0), f: () => 1, r: /x/ };
    const kinds = findJsonUnsafePaths(dirty, 'x').map((p) => p.split(' → ')[1]);
    expect(kinds.sort()).toEqual(['Date', 'RegExp', 'Set', 'function']);
  });

  it('πιάνει `NaN` / `Infinity` — αλλοίωση ΤΙΜΗΣ που το σχήμα κρύβει', () => {
    // `JSON.parse(JSON.stringify({ x: NaN }))` → `{ x: null }`: το κλειδί υπάρχει, η τιμή
    // είναι σκουπίδι. Ένα `toEqual` σε επίπεδο σχήματος δεν θα το έβλεπε ποτέ.
    const paths = findJsonUnsafePaths({ w: Number.NaN, h: Number.POSITIVE_INFINITY }, 'x');
    expect(paths).toHaveLength(2);
    expect(paths.join('|')).toContain('x.w → NaN');
  });

  it('ΚΟΙΝΗ αναφορά (DAG) ΔΕΝ είναι κύκλος — μηδέν ψευδώς θετικό', () => {
    // Πραγματικό εύρημα από την πρώτη εκτέλεση: το κοινό BIM fixture βάζει ΤΟ ΙΔΙΟ array
    // σε `outline.vertices` και `footprint.vertices`, και ένας καθολικός «visited» φρουρός
    // κατήγγειλλε 27 οντότητες ως κυκλικές. Το `JSON.stringify` τις γράφει μια χαρά.
    const shared = [{ x: 0 }];
    expect(findJsonUnsafePaths({ a: { v: shared }, b: { v: shared } }, 'x')).toEqual([]);
  });

  it('πιάνει κυκλική αναφορά (το `JSON.stringify` εκεί ΠΕΤΑΕΙ, δεν σιωπά)', () => {
    const cyclic: Record<string, unknown> = { id: 'a' };
    cyclic.self = cyclic;
    expect(findJsonUnsafePaths(cyclic, 'x')[0]).toContain('κυκλική αναφορά');
  });

  it('καθαρό αντικείμενο → κανένα εύρημα (μηδέν ψευδώς θετικά)', () => {
    const clean = { id: 'a', n: 1, ok: true, nil: null, list: [{ x: 0 }], nested: { deep: { s: '' } } };
    expect(findJsonUnsafePaths(clean, 'x')).toEqual([]);
    expect(findRoundTripDivergences(clean, deepClone(clean), 'x')).toEqual([]);
  });

  it('ο συγκριτής δείχνει το μονοπάτι ΜΕΤΑ από πραγματικό round-trip, όχι απλώς «διαφέρουν»', () => {
    const before = { model: { cells: new Map([['r1 c1', { value: 1 }]]) } };
    const after: unknown = JSON.parse(JSON.stringify(before));
    const [first] = findRoundTripDivergences(before, after, 'entity');
    expect(first).toContain('entity.model.cells → Map');
    expect(first).toContain('(μετά: {})'); // …και δείχνει ΤΙ έμεινε: το άδειο αντικείμενο
  });

  it('προαιρετικό πεδίο `undefined` ΔΕΝ είναι απόκλιση (το κλειδί απλώς λείπει)', () => {
    const before = { a: 1, opt: undefined };
    expect(findRoundTripDivergences(before, deepClone(before), 'x')).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. Ο καθρέφτης του φρουρού χρόνου-μεταγλώττισης
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Οι δύο επόμενες σταθερές δεν είναι «κώδικας test»: είναι **βεβαιώσεις τύπου**. Αν το
 * `TableEntity` ξαναποκτήσει `Map`, η πρώτη γίνεται `never` και **δεν μεταγλωττίζεται**·
 * αν το `TableModel` πάψει να έχει `Map`, η δεύτερη σπάει. Τις εκθέτουμε και ως runtime
 * assertions ώστε ο φρουρός τύπου να είναι **ορατός** στη σουίτα, όχι κρυμμένος.
 */
const TABLE_ENTITY_IS_JSON_SAFE: AssertJsonSafe<TableEntity> = true;
const TABLE_MODEL_CULPRIT_FIELD: JsonUnsafeKeys<TableModel> = 'cells';

describe('ΦΡΟΥΡΟΣ ΤΥΠΟΥ — `types/json-safe-entity.ts` (ελέγχεται από τον compiler)', () => {
  it('`AssertJsonSafe<TableEntity>` μεταγλωττίζεται ⇒ η οντότητα είναι καθαρή', () => {
    expect(TABLE_ENTITY_IS_JSON_SAFE).toBe(true);
  });

  it('`JsonUnsafeKeys<TableModel>` ονομάζει τον ένοχο: «cells»', () => {
    // Το διαγνωστικό δεν λέει «κάτι φταίει» — λέει ΠΟΙΟ πεδίο, στο hover του συντάκτη.
    expect(TABLE_MODEL_CULPRIT_FIELD).toBe('cells');
  });
});
