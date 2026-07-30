/**
 * ADR-736 — **Η ΑΝΙΧΝΕΥΣΗ**: τι συνημμένα δηλώνει ένα DXF.
 *
 * Τρέχει μέσα στον `DxfSceneBuilder`, άρα **και οι δύο πόρτες εισαγωγής** την παίρνουν δωρεάν:
 * Door A (client `handleFileImport`) και Door B (server `/api/floorplans/process`, ίδιος builder).
 * Αυτό είναι σκόπιμο και όχι λεπτομέρεια: το ADR-635 Φ C.18 τεκμηριώνει τι κοστίζει όταν μια
 * δυνατότητα υλοποιείται στη **μία** πόρτα — **117 γραμμοσκιάσεις χάθηκαν σε hard refresh**.
 *
 * ⚠️ **Ανίχνευση ≠ επίλυση.** Εδώ διαβάζουμε **μόνο** τι δηλώνει το αρχείο. Κάθε αναφορά
 * γεννιέται `missing` (ή `unsupported`) — **ποτέ** `resolved`. Το να βρεθούν τα πραγματικά αρχεία
 * είναι δουλειά του client resolver, γίνεται με αρχεία που δίνει ο χρήστης, και **επιτρέπεται να
 * αποτύχει**.
 *
 * ⚠️ **Καμία πρόσβαση σε filesystem, ποτέ.** Οι διαδρομές που διαβάζονται εδώ γράφτηκαν σε **ξένο
 * μηχάνημα** (`Z:\Jobs\…` του τοπογράφου). Ο browser δεν μπορεί —και δεν πρέπει— να τις ανοίξει.
 * Είναι **κείμενο προς εμφάνιση** συν ένα basename για ταύτιση ονόματος· τίποτα άλλο. Γι' αυτό
 * δεν εμπλέκεται ο `lib/security/path-sanitizer` (είναι `server-only` και επικυρώνει **Firebase
 * Storage** διαδρομές έναντι allowlist — σωστός για τη δουλειά του, δομικά ακατάλληλος εδώ).
 *
 * **Πηγή αλήθειας για τους κωδικούς:** AutoCAD DXF Reference (IMAGEDEF / BLOCK / *DEFINITION /
 * OLE2FRAME), διασταυρωμένη με **μέτρηση του πραγματικού αρχείου** — όχι μνήμη.
 *
 * @see types/dxf-external-reference.ts — το μοντέλο + η ταξινομία των 6 ειδών
 * @see utils/dxf-mline-style-parser.ts — το αδελφό OBJECTS pre-pass (ADR-635 Φ C.7)
 */

import type {
  DxfExternalReference,
  DxfExternalReferenceKind,
  DxfReferenceVec2,
} from '../types/dxf-external-reference';
import {
  findDxfSectionRange,
  collectDxfRecordPairs,
  firstPairValue,
  type DxfCodePair,
} from './dxf-section-scan';
import { foreignAssetBasename } from '../io/shared/foreign-asset-basename';

/** `BLOCK` group 70 — bit 4 = external reference· bit 8 = xref **overlay** (δεν αλυσιδώνεται). */
const BLOCK_FLAG_IS_XREF = 4;
const BLOCK_FLAG_IS_OVERLAY = 8;

/** Οι ορισμοί underlay ζουν στο OBJECTS και διαφέρουν **μόνο** στο όνομα του τύπου. */
const UNDERLAY_DEFINITION_KINDS: Readonly<Record<string, DxfExternalReferenceKind>> = {
  PDFDEFINITION: 'pdf-underlay',
  DWFDEFINITION: 'dwf-underlay',
  DGNDEFINITION: 'dgn-underlay',
};

/**
 * Όλες οι εξωτερικές αναφορές που δηλώνει το αρχείο, από **τρεις** sections.
 *
 * Η σειρά είναι ντετερμινιστική (OBJECTS → BLOCKS → ENTITIES) ώστε δύο εισαγωγές του ίδιου
 * αρχείου να δίνουν **ίδια λίστα με ίδια σειρά** — προϋπόθεση για idempotent επανεισαγωγή.
 */
export function buildExternalReferences(lines: readonly string[]): DxfExternalReference[] {
  return [
    ...scanSectionForReferences(lines, 'OBJECTS', objectRecordToReference),
    ...scanSectionForReferences(lines, 'BLOCKS', blockRecordToReference),
    ...scanSectionForReferences(lines, 'ENTITIES', oleRecordToReference),
  ];
}

/** Μετατροπέας μιας εγγραφής σε αναφορά· `null` = «δεν με αφορά αυτός ο τύπος». */
type RecordToReference = (
  type: string,
  pairs: readonly DxfCodePair[],
) => DxfExternalReference | null;

/**
 * Σαρώνει μια section και επιστρέφει ό,τι ο μετατροπέας αναγνώρισε.
 *
 * ⚠️ Τα ζεύγη μαζεύονται **μόνο** για εγγραφές που ο μετατροπέας θα κοιτούσε — αλλιώς θα
 * δεσμεύαμε έναν πίνακα ανά οντότητα σε ολόκληρο το ENTITIES (2.923 στο δείγμα) για να βρούμε
 * μηδέν OLE. Γι' αυτό ο έλεγχος τύπου γίνεται **πριν** τη συλλογή, με `wantsType`.
 */
function scanSectionForReferences(
  lines: readonly string[],
  sectionName: string,
  toReference: RecordToReference,
): DxfExternalReference[] {
  const range = findDxfSectionRange(lines, sectionName);
  if (!range) return [];

  const out: DxfExternalReference[] = [];
  let i = range.start;
  while (i < range.end - 1) {
    if (lines[i]?.trim() !== '0') { i += 2; continue; }
    const type = lines[i + 1]?.trim() ?? '';
    if (!wantsType(type)) { i += 2; continue; }
    const { pairs, next } = collectDxfRecordPairs(lines, i + 2, range.end);
    const ref = toReference(type, pairs);
    if (ref) out.push(ref);
    i = next;
  }
  return out;
}

/** Οι μόνοι τύποι εγγραφής που κουβαλούν εξωτερική αναφορά — φίλτρο πριν τη συλλογή ζευγών. */
function wantsType(type: string): boolean {
  return type === 'IMAGEDEF'
    || type === 'DATALINK'
    || type === 'BLOCK'
    || type === 'OLE2FRAME'
    || type === 'OLEFRAME'
    || type in UNDERLAY_DEFINITION_KINDS;
}

// ── OBJECTS section ───────────────────────────────────────────────────────────

/** OBJECTS: `IMAGEDEF` (το μόνο που αποδίδουμε) + οι ορισμοί underlay + `DATALINK`. */
function objectRecordToReference(
  type: string,
  pairs: readonly DxfCodePair[],
): DxfExternalReference | null {
  if (type === 'IMAGEDEF') return imagedefToReference(pairs);
  const underlayKind = UNDERLAY_DEFINITION_KINDS[type];
  if (underlayKind) return underlayToReference(pairs, underlayKind);
  if (type === 'DATALINK') return datalinkToReference(pairs);
  return null;
}

/**
 * `IMAGEDEF` → raster αναφορά. **Εδώ ζει η διαδρομή του αρχείου** (group 1).
 *
 * Codes: **1**=διαδρομή · **5**=handle (το `IMAGE` group 340 δείχνει εδώ) · **10/20**=μέγεθος σε
 * pixels · **11/21**=μέγεθος ενός pixel σε μονάδες σχεδίου · **280**=ήταν φορτωμένο στο AutoCAD.
 *
 * ⚠️ Ένα `IMAGEDEF` μπορεί να εξυπηρετεί **πολλά** `IMAGE` (σχέση **1:N**). Γι' αυτό η αναφορά
 * παράγεται από τον **ορισμό**, ποτέ από την οντότητα — αλλιώς το ίδιο υπόβαθρο τοποθετημένο
 * δύο φορές θα εμφανιζόταν ως δύο συνημμένα και θα ανέβαινε δύο φορές.
 */
function imagedefToReference(pairs: readonly DxfCodePair[]): DxfExternalReference {
  const rawPath = firstPairValue(pairs, '1') ?? '';
  const handle = firstPairValue(pairs, '5');
  const imageSizePx = vec2FromPairs(pairs, '10', '20');
  const pixelSizeUnits = vec2FromPairs(pairs, '11', '21');
  return {
    id: handle ?? `raster:${rawPath.toLowerCase()}`,
    kind: 'raster',
    status: 'missing',
    rawPath,
    basename: foreignAssetBasename(rawPath),
    ...(handle ? { sourceHandle: handle } : {}),
    ...(imageSizePx ? { imageSizePx } : {}),
    ...(pixelSizeUnits ? { pixelSizeUnits } : {}),
    loadedInSource: firstPairValue(pairs, '280') === '1',
  };
}

/**
 * `PDFDEFINITION` / `DWFDEFINITION` / `DGNDEFINITION` → underlay αναφορά.
 * Codes: **1**=αρχείο · **2**=όνομα σελίδας/φύλλου · **5**=handle.
 * `unsupported`: ανιχνεύεται και **δηλώνεται**, δεν αποδίδεται (το δείγμα έχει μηδέν).
 */
function underlayToReference(
  pairs: readonly DxfCodePair[],
  kind: DxfExternalReferenceKind,
): DxfExternalReference {
  const rawPath = firstPairValue(pairs, '1') ?? '';
  const handle = firstPairValue(pairs, '5');
  const page = firstPairValue(pairs, '2');
  return {
    id: handle ?? `${kind}:${rawPath.toLowerCase()}`,
    kind,
    status: 'unsupported',
    rawPath,
    basename: foreignAssetBasename(rawPath),
    ...(handle ? { sourceHandle: handle } : {}),
    ...(page ? { detail: page } : {}),
  };
}

/**
 * `DATALINK` (σύνδεσμος σε Excel) → αναφορά χωρίς απόδοση.
 *
 * ⚠️ **Οι κωδικοί δεν έχουν επαληθευτεί σε πραγματικό αρχείο** — το δείγμα έχει **μηδέν**
 * DATALINK. Παίρνουμε το **1** ως όνομα συνδέσμου και το **302** ως connection string, που είναι
 * η τεκμηρίωση· όταν εμφανιστεί πραγματικό αρχείο, **μέτρησέ το πριν το εμπιστευτείς**. Ό,τι κι
 * αν βγει, η κατάσταση παραμένει `unsupported`, οπότε λάθος κωδικός δεν παράγει λάθος απόδοση —
 * μόνο φτωχότερη ετικέτα.
 */
function datalinkToReference(pairs: readonly DxfCodePair[]): DxfExternalReference {
  const name = firstPairValue(pairs, '1') ?? '';
  const rawPath = firstPairValue(pairs, '302') ?? '';
  const handle = firstPairValue(pairs, '5');
  return {
    id: handle ?? `data-link:${name.toLowerCase()}`,
    kind: 'data-link',
    status: 'unsupported',
    rawPath,
    basename: rawPath ? foreignAssetBasename(rawPath) : name,
    ...(handle ? { sourceHandle: handle } : {}),
    ...(name ? { detail: name } : {}),
  };
}

// ── BLOCKS section ────────────────────────────────────────────────────────────

/**
 * `BLOCK` με flag 70 bit 4 → **xref** (εξωτερικό σχέδιο). Codes: **1**=διαδρομή · **2**=όνομα ·
 * **5**=handle · **70**=σημαίες.
 *
 * ⚠️ Ο έλεγχος είναι **bitmask, όχι ισότητα**: ένα xref είναι συνήθως `4`, αλλά ένα overlay είναι
 * `12` (4|8) και ένα εξαρτημένο `20` (4|16). `flags === 4` θα έχανε τα δύο τελευταία σιωπηλά.
 * **Μετρημένο στο δείγμα: 18 blocks, flags μόνο `0` και `1` ⇒ κανένα xref.** Το `1` είναι
 * «anonymous block», άσχετο με xref — γι' αυτό ο έλεγχος είναι στο bit 4 και όχι «flags ≠ 0».
 */
function blockRecordToReference(
  type: string,
  pairs: readonly DxfCodePair[],
): DxfExternalReference | null {
  if (type !== 'BLOCK') return null;
  const flags = parseInt(firstPairValue(pairs, '70') ?? '0', 10) || 0;
  if ((flags & BLOCK_FLAG_IS_XREF) === 0) return null;

  const rawPath = firstPairValue(pairs, '1') ?? '';
  const name = firstPairValue(pairs, '2') ?? '';
  const handle = firstPairValue(pairs, '5');
  return {
    id: handle ?? `xref:${name.toLowerCase()}`,
    kind: 'xref',
    status: 'unsupported',
    rawPath,
    basename: foreignAssetBasename(rawPath),
    ...(handle ? { sourceHandle: handle } : {}),
    ...(name ? { detail: name } : {}),
    isOverlay: (flags & BLOCK_FLAG_IS_OVERLAY) !== 0,
  };
}

// ── ENTITIES section ──────────────────────────────────────────────────────────

/**
 * `OLE2FRAME` → **η μοναδική εξαίρεση: τα bytes είναι ΜΕΣΑ στο αρχείο** (δυαδικά chunks `310`).
 *
 * Συνέπεια που αλλάζει τη σημασία της κατάστασης: ένα OLE **δεν λείπει ποτέ** — δεν υπάρχει
 * εξωτερικό αρχείο να χαθεί. Είναι `unsupported` (δεν το αποδίδουμε), **όχι** `missing`.
 * Codes: **3**=τύπος OLE (π.χ. `Excel.Sheet.12`) · **5**=handle · **310**=δυαδικά chunks.
 */
function oleRecordToReference(
  type: string,
  pairs: readonly DxfCodePair[],
): DxfExternalReference | null {
  if (type !== 'OLE2FRAME' && type !== 'OLEFRAME') return null;
  const handle = firstPairValue(pairs, '5');
  const oleType = firstPairValue(pairs, '3') ?? '';
  return {
    id: handle ?? `ole:${oleType.toLowerCase()}`,
    kind: 'ole-embedded',
    status: 'unsupported',
    rawPath: '',
    basename: oleType,
    ...(handle ? { sourceHandle: handle } : {}),
    ...(oleType ? { detail: oleType } : {}),
  };
}

// ── shared ────────────────────────────────────────────────────────────────────

/**
 * Ζεύγος αριθμών από δύο κωδικούς (π.χ. `10`/`20`), ή `undefined` αν λείπει/δεν είναι αριθμός.
 * `undefined` αντί για `{x:0,y:0}`: το μηδέν είναι **νόμιμη τιμή** και δεν πρέπει να συγχέεται
 * με «δεν διαβάστηκε» — ίδιο σκεπτικό με το `parseIntSysvar` του entity parser.
 */
function vec2FromPairs(
  pairs: readonly DxfCodePair[],
  xCode: string,
  yCode: string,
): DxfReferenceVec2 | undefined {
  const x = parseFloat(firstPairValue(pairs, xCode) ?? '');
  const y = parseFloat(firstPairValue(pairs, yCode) ?? '');
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x, y };
}
