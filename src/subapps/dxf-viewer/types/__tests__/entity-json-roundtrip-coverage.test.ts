/**
 * ADR-739 Φάση Δ — **ΦΡΟΥΡΟΣ 2 (ζωντανός)**: καμία οντότητα σκηνής δεν χάνει δεδομένα σε
 * JSON round-trip.
 *
 * ## Το σιωπηλό σφάλμα
 * Ένας `Map` δεν επιβιώνει `JSON.stringify` — γίνεται `{}` **χωρίς εξαίρεση και χωρίς
 * προειδοποίηση**. **ΤΡΕΙΣ** *γενικοί* μηχανισμοί περνούν **κάθε** οντότητα από αυτό το
 * κανάλι — μετρημένοι στον κώδικα, όχι εκτιμημένοι:
 *   1. αποθήκευση/επαναφόρτωση σκηνής — `services/dxf-firestore-storage.impl.ts:169`,
 *   2. αναίρεση — `core/commands/.../UpdateEntityCommand.ts:38` (`deepClone`),
 *   3. διαγραφή + αναίρεση — `DeleteEntityCommand.ts:169,301`.
 * Άρα το σφάλμα δεν είναι «ένα bug του πίνακα»: είναι μια **κλάση** που κάθε μελλοντική
 * οντότητα μπορεί να ξαναγεννήσει.
 *
 * ⚠️ **ΔΕΝ είναι πέντε** (η πρώτη γραφή αυτού του αρχείου έλεγε πέντε). Τα δύο που
 * αφαιρέθηκαν, ελεγμένα ένα-ένα:
 *   - **Πρόχειρο** (`systems/clipboard/EntityClipboardStore.ts`) — χρησιμοποιεί
 *     `structuredClone`, που **διατηρεί** τον `Map`· το JSON είναι μόνο fallback.
 *   - **Λανθάνουσα μνήμη ζωγραφικής** (`rendering/passes/EntityPass.getCacheKey`) —
 *     **νεκρός κώδικας** (το `RenderPipeline` δεν καλείται από πουθενά), και ούτως ή
 *     άλλως κλειδί **μνήμης**, όχι αποθήκευση: τίποτα δεν επιβιώνει εκεί εξ ορισμού.
 * Ένας αριθμός σε σχόλιο που κανείς δεν μέτρησε είναι η ίδια κλάση σφάλματος με ένα
 * νούμερο σε παραδοτέο που κανείς δεν πήρε (ADR-720).
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
import type { RenderableEntityType } from '../../rendering/contract/renderable-entity-type';
import { makeEntityModel } from '../../rendering/hitTesting/__tests__/renderable-entity-fixtures';
import {
  cellText,
  createTableModel,
  getCell,
  resolveTableModel,
  toPersistedTableModel,
} from '../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../../bim/table/table-style-presets';
import { isTableEntity } from '../table-entity';
import { activeTableModel } from '../../bim/table/table-worksheet-resolve';
import { tableWorksheetFields } from '../../bim/table/__tests__/make-table-entity';
import type { EntityType } from '../base-entity';
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
 * **Καμία εξαίρεση.** Ο βρόχος τρέχει πάνω σε ΟΛΟ το ζωντανό μητρώο, `table`
 * συμπεριλαμβανομένου.
 *
 * Ιστορικό, γιατί το λάθος είναι διδακτικό: μέχρι την ADR-739 Φ.Δ βήμα 1 εδώ υπήρχε ένα
 * `STALE_SHARED_FIXTURE = ['table']` — δηλαδή ο φρουρός **εξαιρούσε ακριβώς τον τύπο για
 * τον οποίο γράφτηκε**. Αιτία: το κοινό fixture του ADR-587 Φ10 κρατούσε ακόμη
 * `createTableModel(…)` (`Map`) ενώ η οντότητα είχε γίνει `PersistedTableModel`, και η
 * απόκλιση περνούσε αόρατη επειδή (α) το fixture έκανε `as unknown as EntityModel` και
 * (β) είχε **μηδέν κελιά**, οπότε `Map` και ακολουθία έδειχναν ίδιοι. Το fixture
 * διορθώθηκε στην πηγή: `toPersistedTableModel(…)` **και γεμάτα κελιά**.
 */
const REGISTRY_COVERED: readonly RenderableEntityType[] = RENDERABLE_ENTITY_TYPES;

/**
 * Οι `EntityType` που **δεν** είναι renderable, άρα δεν έχουν fixture πουθενά στο repo:
 * καθαρά editor-side δομές (`block`/`array`/`group`) και τα δύο annotation primitives που
 * ζουν εκτός του render contract. **Δεν καλύπτονται** από αυτό το test — γραμμένο ρητά
 * αντί για σιωπηλή περικοπή.
 *
 * Το `satisfies` δεν είναι διακόσμηση: κάνει κάθε εγγραφή **υπαρκτό** `EntityType`, οπότε
 * ένα τυπογραφικό ή μια λίστα που έμεινε πίσω από διαγραφή τύπου σπάει εδώ.
 */
const NOT_COVERED_ENTITY_TYPES = [
  'block', 'array', 'group', 'center-mark', 'centerline',
] as const satisfies readonly EntityType[];

/**
 * Ό,τι δεν είναι **ούτε** renderable **ούτε** ρητά καταγεγραμμένο ως ακάλυπτο. Οφείλει να
 * είναι `never`: οι δύο λίστες μαζί πρέπει να είναι **ολόκληρο** το `EntityType`.
 *
 * Χωρίς αυτό, οι δύο λίστες απαντούσαν μόνο «δεν είναι renderable» — δηλαδή ένας νέος
 * `EntityType` που δεν μπαίνει στο render contract θα έμενε **σιωπηλά εκτός ελέγχου**,
 * χωρίς ούτε ένα κόκκινο. Ίδιο σχήμα με τη χειρόγραφη λίστα πεδίων του ADR-650 §M10e.
 */
type UnaccountedEntityType = Exclude<
  EntityType,
  RenderableEntityType | (typeof NOT_COVERED_ENTITY_TYPES)[number]
>;

/**
 * `true` όσο δεν έχει ξεφύγει κανένας τύπος· αλλιώς αντικείμενο — η ανάθεση **δεν
 * μεταγλωττίζεται** και το μήνυμα του compiler **ονομάζει** τον ξεχασμένο τύπο.
 * Ίδιο μοτίβο με το `AssertJsonSafe` του `types/json-safe-entity.ts` (§5 παρακάτω).
 */
type AssertEveryEntityTypeAccounted<T> = [T] extends [never]
  ? true
  : { readonly ΞΕΧΑΣΜΕΝΟΣ_ENTITY_TYPE: T };

const EVERY_ENTITY_TYPE_ACCOUNTED: AssertEveryEntityTypeAccounted<UnaccountedEntityType> = true;

/** Ο πίνακας όπως ζει **πραγματικά** στη σκηνή — τυποποιημένος, χωρίς κανένα cast. */
function makeRealTableEntity(): TableEntity {
  return {
    id: 'tbl_roundtrip',
    type: 'table',
    layerId: 'lyr_test',
    position: { x: 100, y: 200 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    ...tableWorksheetFields(toPersistedTableModel(
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
        // ADR-750 Φ1 — οι ρητές ακμές μπαίνουν στο fixture ΕΠΙΤΗΔΕΣ: το `edges` είναι το
        // δεύτερο πεδίο που ζει ως `Map` στη μνήμη, άρα ο γενικός ανιχνευτής πρέπει να το
        // περνά από την ίδια δοκιμασία με τα κελιά — αλλιώς ο φρουρός θα φύλαγε τη μισή πόρτα.
        edges: [
          ['H', 'r2', 'c1', { visible: true, colorHex: '#ff00ff', widthMm: 0.5 }],
          ['V', 'r2', '$end', { visible: true, colorHex: '#00aa00', widthMm: 0.13, dashMm: [1, 1] }],
        ],
      }),
    )),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Ο φρουρός πάνω στο ζωντανό μητρώο
// ──────────────────────────────────────────────────────────────────────────────

describe('ΦΡΟΥΡΟΣ — κάθε renderable οντότητα επιβιώνει JSON (ζωντανό μητρώο)', () => {
  it('καμία σιωπηλή περικοπή: ο βρόχος τρέχει σε ΟΛΟ το μητρώο, `table` μέσα', () => {
    expect([...REGISTRY_COVERED].sort()).toEqual([...RENDERABLE_ENTITY_TYPES].sort());
    expect([...REGISTRY_COVERED]).toContain('table');
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

  it('round-trip + deepClone ταυτοτικά, με ΓΕΜΑΤΑ κελιά (4/4) ΚΑΙ ρητές ακμές (2/2)', () => {
    const entity = makeRealTableEntity();
    expect(activeTableModel(entity).cells).toHaveLength(4);
    expect(activeTableModel(entity).edges).toHaveLength(2);
    expect(findRoundTripDivergences(entity, JSON.parse(JSON.stringify(entity)), 'table')).toEqual([]);
    expect(findRoundTripDivergences(entity, deepClone(entity), 'table')).toEqual([]);
  });

  it('ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΦΡΟΥΡΕΙ: το ευρετήριο μνήμης (`TableModel`) ΠΙΑΝΕΤΑΙ ως ένοχο', () => {
    // Αν κάποιος «απλοποιήσει» βάζοντας πάλι το runtime μοντέλο στην οντότητα, ο ανιχνευτής
    // δείχνει ακριβώς πού. Τα **τρία** ευρετήρια ονομάζονται χωριστά επίτηδες: μια σκέτη
    // μέτρηση («ένα ένοχο μονοπάτι») θα έμενε πράσινη αν κάποτε ένα από αυτά γινόταν πάλι
    // απλό αντικείμενο — δηλαδή ο φρουρός θα σιωπούσε ακριβώς όταν χανόταν κάτι.
    // ADR-739 Επίπεδο Β — το `rowLinks` είναι το τρίτο, με την ίδια αρχή «λίστα στο αρχείο,
    // ευρετήριο στη μνήμη»: ο `Map` εδώ είναι ΣΩΣΤΟΣ, αρκεί να μη φτάσει ποτέ στην οντότητα.
    //
    // 🔴 ADR-833 Φάση 2 — **ΚΑΙ ΤΟ ΒΑΘΟΣ ΜΕΓΑΛΩΣΕ**: το μοντέλο ζει πλέον μέσα σε
    // `worksheets[]`, δηλαδή ο ανιχνευτής πρέπει να διασχίσει **πίνακα αντικειμένων** για να
    // φτάσει στους `Map`. Ένας ρηχός ανιχνευτής θα έμενε πράσινος ακριβώς επειδή το πεδίο
    // μετακόμισε — η σιωπή που αυτό το αρχείο υπάρχει για να μην υπάρχει. Το μονοπάτι στο
    // μήνυμα το **ονομάζει**: `table.worksheets[0].model.cells → Map`.
    const entity = makeRealTableEntity();
    const withRuntimeModel = {
      ...entity,
      worksheets: [{ ...entity.worksheets[0], model: createTableModel({ columns: [], rows: [] }) }],
    };
    const paths = findJsonUnsafePaths(withRuntimeModel, 'table');
    expect(paths).toHaveLength(3);
    expect(paths.some((p) => p.includes('worksheets[0].model.cells → Map'))).toBe(true);
    expect(paths.some((p) => p.includes('worksheets[0].model.edges → Map'))).toBe(true);
    expect(paths.some((p) => p.includes('worksheets[0].model.rowLinks → Map'))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. Καρφωμένα κενά — γραμμένα, όχι σιωπηλά
// ──────────────────────────────────────────────────────────────────────────────

describe('ΤΟ ΚΟΙΝΟ FIXTURE ΤΟΥ ADR-587 — ίδιο σχήμα με την οντότητα, όχι διπλό της', () => {
  it('το `makeEntityModel("table")` δίνει **ακολουθία** κελιών, κανέναν `Map`', () => {
    expect(findJsonUnsafePaths(makeEntityModel('table'), 'fixture')).toEqual([]);
  });

  it('…και τα κελιά του είναι ΓΕΜΑΤΑ — αλλιώς ο έλεγχος δεν αποδεικνύει τίποτα', () => {
    // 🔴 Με μηδέν κελιά, `Map` και ακολουθία επιβιώνουν και οι δύο ένα round-trip: ο
    // φρουρός θα ήταν μονίμως πράσινος πάνω σε λάθος σχήμα. Τα κελιά ΕΙΝΑΙ ο έλεγχος.
    const entity = makeEntityModel('table');
    expect(isTableEntity(entity)).toBe(true);
    if (!isTableEntity(entity)) return; // στένεμα τύπου· το expect από πάνω είναι ο έλεγχος
    expect(Array.isArray(activeTableModel(entity).cells)).toBe(true);
    expect(activeTableModel(entity).cells.length).toBeGreaterThanOrEqual(2);
  });

  it('τα κελιά φτάνουν ΣΤΗ ΜΗΧΑΝΗ: το `resolveTableModel` τα ξαναβρίσκει στη θέση τους', () => {
    // Ο δυνατός από τους τρεις ελέγχους: δεν ρωτά «τι σχήμα έχει το πεδίο» αλλά «φτάνει το
    // περιεχόμενο εκεί που το διαβάζει η διάταξη». Με `Map` στη θέση της ακολουθίας, το
    // `createTableModel` αποσυνθέτει τα ζεύγη [κλειδί, κελί] σαν να ήταν τριάδες και χτίζει
    // κλειδιά-σκουπίδια: το `getCell` γυρίζει `undefined` και ο πίνακας δείχνει ΑΔΕΙΟΣ —
    // χωρίς καμία εξαίρεση, ακριβώς η σιωπή που φρουρεί αυτό το αρχείο.
    const entity = makeEntityModel('table');
    expect(isTableEntity(entity)).toBe(true);
    if (!isTableEntity(entity)) return;
    const model = resolveTableModel(activeTableModel(entity));
    expect(cellText(getCell(model, 'r1', 'c1'))).toBe('Στοιχείο');
    expect(cellText(getCell(model, 'r2', 'c2'))).toBe('12.5');
  });
});

describe('ΓΝΩΣΤΑ ΚΕΝΑ — `EntityType` εκτός render contract (κανένα fixture στο repo)', () => {
  it.each(NOT_COVERED_ENTITY_TYPES)('«%s» δεν είναι renderable, άρα δεν ελέγχεται εδώ', (type) => {
    // Αν κάποιος τους κάνει renderable, μπαίνουν αυτόματα στον βρόχο του μητρώου — και
    // αυτό το test γίνεται κόκκινο, ζητώντας να ξαναγραφτεί η λίστα. Καμία σιωπή.
    expect([...RENDERABLE_ENTITY_TYPES]).not.toContain(type);
  });

  it('ΚΑΘΕ `EntityType` λογοδοτεί: renderable ⊎ ρητά ακάλυπτοι = ΟΛΟ το union', () => {
    // Ο πραγματικός έλεγχος είναι του compiler (`AssertEveryEntityTypeAccounted`): νέος
    // τύπος που δεν μπαίνει σε καμία από τις δύο λίστες σπάει τη μεταγλώττιση, ονομαστικά.
    // Εδώ εκτίθεται ώστε να είναι ΟΡΑΤΟΣ στη σουίτα — ένας φρουρός που κανείς δεν βλέπει
    // είναι φρουρός που κάποιος θα σβήσει.
    expect(EVERY_ENTITY_TYPE_ACCOUNTED).toBe(true);
    // …και οι δύο λίστες είναι ΞΕΝΕΣ μεταξύ τους: ένας τύπος δεν γίνεται και τα δύο.
    const both = RENDERABLE_ENTITY_TYPES.filter(
      (t) => (NOT_COVERED_ENTITY_TYPES as readonly string[]).includes(t),
    );
    expect(both).toEqual([]);
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
