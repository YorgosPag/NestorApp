/**
 * 🏢 ENTERPRISE — DXF group code **101 «Embedded Object»** (SSoT, leaf: μηδέν imports)
 *
 * ## Τι είναι το 101
 * Στο DXF R2018+ ο κωδικός `101` ΔΕΝ είναι δεδομένο της οντότητας: είναι **ΤΟΜΗ ΕΝΟΤΗΤΑΣ**,
 * ισοδύναμη με τα `0` (νέα οντότητα) και `100` (νέα subclass). Ό,τι ακολουθεί ανήκει σε ένα
 * **ενσωματωμένο αντικείμενο** — άλλο namespace κωδικών — και **σταματά** την ανάγνωση tags
 * της host οντότητας.
 *
 * ## Το περιστατικό (μετρημένο 2026-07-30, `47_ergasia.dxf`)
 * Ο `parseEntity` ισοπεδώνει τα group codes σε `Record<string,string>` (`data[code] = value`)
 * και σταματούσε **μόνο** στο `0`. Άρα σε κάθε MTEXT με στήλες, οι κωδικοί του embedded object
 * **επέγραφαν** τους πραγματικούς της οντότητας:
 *
 * | code | DXF (host)                     | ο parser κρατούσε (embedded) |
 * |------|--------------------------------|------------------------------|
 * | 10/20| 407717.5228 / 4502407.4932     | 1.0 / 0.0  (text direction)  |
 * | 41   | 0.5                            | 0                            |
 * | 71   | 1 (top-left attachment)        | 2 (column type = dynamic)    |
 * | 44   | 1.0 (line spacing)             | 0.5 (column width)           |
 *
 * Η θέση γινόταν **(1, 0)**. Επειδή το σχέδιο είναι γεωαναφερμένο (ΕΓΣΑ87), το
 * `dropOutOfExtentsEntities` τα θεωρούσε «origin junk» και τα πετούσε: **10 MTEXT εξαφανίζονταν
 * σιωπηλά** (75 MTEXT στο ENTITIES → 65 οντότητες σκηνής).
 *
 * ## Γιατί ΔΕΝ πετάμε το embedded object
 * Περιέχει τα **MTEXT columns**. Το ezdxf το φορτώνει σε κλάση `MTextColumns`
 * (`load_columns_from_embedded_object`) και το **ξαναγράφει** στο export
 * (`export_embedded_object`). Πέταγμα = απλώς **νέα** σιωπηλή απώλεια, μια σκάλα πιο κάτω.
 * Άρα: το κρατάμε **ωμό** (ζεύγη) πάνω στην οντότητα και το **τυποποιούμε** κατ' απαίτηση.
 *
 * ## Γιατί type-agnostic
 * Ο ΙΔΙΟΣ μηχανισμός ισχύει σε **ATTRIB/ATTDEF** (embedded MTEXT· LibreDWG: κοινή subclass
 * `AcDbMTextObjectEmbedded`). Ο διαχωριστής είναι **ΕΝΑΣ** και δεν ρωτά τύπο οντότητας —
 * μόνο ο *τυποποιητής* των στηλών ({@link parseMTextColumns}) είναι MTEXT-specific.
 * Μια οντότητα μπορεί να έχει **ΠΑΝΩ ΑΠΟ ΕΝΑ** embedded object → πίνακας από buckets.
 *
 * @see https://ezdxf.readthedocs.io/ — `ezdxf.entities.MTextColumns`
 * @see dxf-entity-parser.ts — ο μόνος streaming καταναλωτής (zero-alloc μονοπάτι)
 * @see ADR-635 — DXF import coverage (η ίδια γραμμή: «εισάγεις ό,τι μπορείς, αναφέρεις ό,τι όχι»)
 */

// ============================================================================
// SENTINEL
// ============================================================================

/** Ο group code που ανοίγει ενσωματωμένο αντικείμενο. Τομή ενότητας, όχι δεδομένο. */
export const EMBEDDED_OBJECT_CODE = '101';

/**
 * Η τιμή που γράφει το AutoCAD δίπλα στο `101`. Κρατιέται ως **τεκμηρίωση + fixture anchor**:
 * ο διαχωρισμός γίνεται στον **κωδικό**, όχι στη συμβολοσειρά (άλλα εργαλεία γράφουν άλλη
 * ετικέτα· το `101` παραμένει τομή ενότητας σε κάθε περίπτωση).
 */
export const EMBEDDED_OBJECT_MARKER = 'Embedded Object';

// ============================================================================
// ΤΥΠΟΙ
// ============================================================================

/** Ένα ωμό ζεύγος DXF (group code, τιμή) — ίδιο σχήμα με το `EntityData.pairs` (ADR-507). */
export type DxfPair = readonly [string, string];

/** Τα ζεύγη ΕΝΟΣ ενσωματωμένου αντικειμένου, στη σειρά ροής. */
export type EmbeddedObjectTags = ReadonlyArray<DxfPair>;

/** Όλα τα ενσωματωμένα αντικείμενα μιας οντότητας (ένα bucket ανά `101`). */
export type EmbeddedObjectList = ReadonlyArray<EmbeddedObjectTags>;

/** Μεταβλητή μορφή, μόνο για το streaming μονοπάτι του parser. */
export type EmbeddedObjectBuckets = DxfPair[][];

/** Αποτέλεσμα διαχωρισμού: τα tags της host οντότητας + τα ενσωματωμένα αντικείμενα. */
export interface EmbeddedSplitResult {
  own: DxfPair[];
  embedded: EmbeddedObjectBuckets;
}

// ============================================================================
// ΔΙΑΧΩΡΙΣΜΟΣ (streaming primitives + καθαρή συνάρτηση)
// ============================================================================

/** True όταν ο κωδικός ανοίγει ενσωματωμένο αντικείμενο. */
export function isEmbeddedObjectCode(code: string): boolean {
  return code === EMBEDDED_OBJECT_CODE;
}

/**
 * Ανοίγει νέο bucket. Ο πίνακας **δημιουργείται τεμπέλικα** (πρώτο `101`) ώστε οι ~99% των
 * οντοτήτων χωρίς embedded object να μην πληρώνουν ούτε μία allocation — ίδια αρχή με το
 * `NOOP_COLLECTOR` του `dxf-mtext-chunks.ts` (ο parser τρέχει σε προϋπολογισμό 500k οντοτήτων).
 */
export function openEmbeddedObject(buckets: EmbeddedObjectBuckets | null): EmbeddedObjectBuckets {
  const target = buckets ?? [];
  target.push([]);
  return target;
}

/** Προσθέτει ζεύγος στο **τρέχον** (τελευταίο) ενσωματωμένο αντικείμενο. */
export function appendEmbeddedPair(
  buckets: EmbeddedObjectBuckets,
  code: string,
  value: string,
): void {
  buckets[buckets.length - 1].push([code, value]);
}

/**
 * Καθαρή εκδοχή: χωρίζει μια ροή ζευγών σε `{ own, embedded }`.
 *
 * Χρησιμοποιεί **τις ίδιες** primitives με τον parser — δεν υπάρχει δεύτερη υλοποίηση της
 * λογικής «πού τελειώνει η host οντότητα» (κανόνας N.0.2: όχι δίδυμα).
 */
export function splitEmbeddedObjects(pairs: Iterable<DxfPair>): EmbeddedSplitResult {
  const own: DxfPair[] = [];
  let embedded: EmbeddedObjectBuckets | null = null;

  for (const pair of pairs) {
    if (isEmbeddedObjectCode(pair[0])) {
      embedded = openEmbeddedObject(embedded);
      continue;
    }
    if (embedded) {
      appendEmbeddedPair(embedded, pair[0], pair[1]);
      continue;
    }
    own.push(pair);
  }

  return { own, embedded: embedded ?? [] };
}

// ============================================================================
// MTEXT COLUMNS (ο τυποποιητής — MTEXT-specific)
// ============================================================================

/**
 * Τύπος στηλών (code 71). **Union αντί για γυμνό number**: το `2` δεν λέει τίποτα στον καλούντα,
 * το `'dynamic'` λέει. Άγνωστη τιμή ⇒ `undefined` ⇒ ο parser επιστρέφει `null` (δεν μαντεύουμε).
 */
export type MTextColumnType = 'none' | 'static' | 'dynamic';

const COLUMN_TYPE_BY_VALUE: Readonly<Record<string, MTextColumnType>> = {
  '0': 'none',
  '1': 'static',
  '2': 'dynamic',
};

/** Τα αριθμητικά πεδία των στηλών, με τα ονόματα του ezdxf. */
type MTextColumnScalarKey =
  | 'count'
  | 'definedHeight'
  | 'width'
  | 'gutterWidth'
  | 'totalWidth'
  | 'totalHeight';

/**
 * Χάρτης group code → πεδίο. Πηγή: DXF R2018 MTEXT embedded object.
 * (`70` flag, `10/20/30` text direction, `11/21/31` επαναλαμβανόμενο insertion point και
 * `40` επαναλαμβανόμενο reference column width **δεν** τυποποιούνται: είναι αντίγραφα τιμών
 * που η host οντότητα ήδη κατέχει — τα κρατά μόνο το ωμό bucket, για round-trip.)
 */
const COLUMN_SCALAR_BY_CODE: Readonly<Record<string, MTextColumnScalarKey>> = {
  '41': 'definedHeight',
  '42': 'totalWidth',
  '43': 'totalHeight',
  '44': 'width',
  '45': 'gutterWidth',
  '72': 'count',
};

/** Τυποποιημένη περιγραφή στηλών MTEXT (ονοματολογία κατά ezdxf `MTextColumns`). */
export interface MTextColumnsData {
  /** code 71 — 0=none, 1=static, 2=dynamic. */
  readonly columnType: MTextColumnType;
  /** code 72 — πλήθος στηλών (σε dynamic-manual: πλήθος υψών). */
  readonly count?: number;
  /** code 73 — αυτόματο ύψος στηλών. */
  readonly autoHeight?: boolean;
  /** code 74 — αντίστροφη ροή στηλών. */
  readonly reversedFlow?: boolean;
  /** code 41 — ορισμένο ύψος στήλης. */
  readonly definedHeight?: number;
  /** code 44 — πλάτος στήλης. */
  readonly width?: number;
  /** code 45 — απόσταση μεταξύ στηλών (gutter). */
  readonly gutterWidth?: number;
  /** code 42 — συνολικό πλάτος του συνόλου των στηλών. */
  readonly totalWidth?: number;
  /** code 43 — συνολικό ύψος. */
  readonly totalHeight?: number;
  /**
   * code 46 — ύψος **ανά στήλη** (dynamic manual). **ΕΠΑΝΑΛΑΜΒΑΝΟΜΕΝΟΣ** κωδικός: γι' αυτό
   * είναι πίνακας και γι' αυτό ο τυποποιητής διαβάζει τα **ordered pairs**, όχι flat record.
   */
  readonly heights?: readonly number[];
}

function toFinite(value: string): number | undefined {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

/** DXF flag: οτιδήποτε ≠ 0 είναι αληθές· μη-αριθμός ⇒ `undefined` (απών, όχι ψευδής). */
function toFlag(value: string): boolean | undefined {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n !== 0 : undefined;
}

/**
 * Τυποποιεί τα ζεύγη ΕΝΟΣ ενσωματωμένου αντικειμένου σε {@link MTextColumnsData}.
 *
 * Επιστρέφει `null` όταν λείπει ο κωδικός `71` (τύπος στηλών) — δηλαδή όταν το bucket **δεν**
 * είναι περιγραφή στηλών MTEXT. ⚠️ Κάλεσέ το **μόνο** για embedded objects οντότητας MTEXT:
 * το embedded object ενός ATTRIB είναι ολόκληρο MTEXT (άλλη σημασιολογία στους ίδιους κωδικούς).
 */
export function parseMTextColumns(pairs: Iterable<DxfPair>): MTextColumnsData | null {
  let columnType: MTextColumnType | undefined;
  let autoHeight: boolean | undefined;
  let reversedFlow: boolean | undefined;
  const scalars: Partial<Record<MTextColumnScalarKey, number>> = {};
  const heights: number[] = [];

  for (const [code, value] of pairs) {
    if (code === '71') { columnType = COLUMN_TYPE_BY_VALUE[value.trim()]; continue; }
    if (code === '73') { autoHeight = toFlag(value); continue; }
    if (code === '74') { reversedFlow = toFlag(value); continue; }
    if (code === '46') {
      const h = toFinite(value);
      if (h !== undefined) heights.push(h);
      continue;
    }
    const key = COLUMN_SCALAR_BY_CODE[code];
    if (key === undefined) continue;
    const n = toFinite(value);
    if (n !== undefined) scalars[key] = n;
  }

  if (columnType === undefined) return null;
  return {
    columnType,
    ...scalars,
    ...(autoHeight !== undefined && { autoHeight }),
    ...(reversedFlow !== undefined && { reversedFlow }),
    ...(heights.length > 0 && { heights }),
  };
}

/**
 * Βολικό πέρασμα πάνω σε ΟΛΑ τα ενσωματωμένα αντικείμενα μιας οντότητας: επιστρέφει την πρώτη
 * έγκυρη περιγραφή στηλών (μια οντότητα μπορεί να έχει >1 embedded object, αλλά **μία** στήλωση).
 */
export function findMTextColumns(embedded: EmbeddedObjectList | undefined): MTextColumnsData | null {
  if (!embedded) return null;
  for (const bucket of embedded) {
    const columns = parseMTextColumns(bucket);
    if (columns) return columns;
  }
  return null;
}
