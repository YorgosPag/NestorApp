/**
 * ADR-652 M2 — Το palette ως ΜΙΑ λίστα: session (import) + cloud (βιβλιοθήκη).
 *
 * Pure merge (μηδέν παρενέργειες, μηδέν React) — ο SSoT για το «τι βλέπει ο χρήστης στα
 * Blocks μου»:
 *  - **cloud item** = μόνιμο, με άδεια/προέλευση, τοποθετήσιμο ΜΕΤΑ από hydration του blob.
 *  - **session def** = ήρθε με το τρέχον import, τοποθετήσιμο ΑΜΕΣΩΣ, ΟΧΙ ακόμα σωσμένο →
 *    δείχνει την ενέργεια «Αποθήκευση στη βιβλιοθήκη».
 *
 * **Σύγκρουση ονόματος = ΕΝΑ block** (πρακτική AutoCAD: ένας ορισμός ανά όνομα μέσα στο
 * σχέδιο — η εισαγωγή block με υπάρχον όνομα ΔΕΝ δημιουργεί δεύτερο ορισμό, επαναχρησιμοποιεί
 * τον ίδιο). Άρα όταν ένα imported block έχει το ίδιο όνομα με σωσμένο, δείχνουμε ΜΙΑ κάρτα —
 * την cloud, σημειωμένη ως σωσμένη (δεν προσφέρουμε δεύτερη αποθήκευση του ίδιου ονόματος).
 *
 * @see ./block-library-cloud-store.ts — cloud metadata
 * @see ./block-library-registry.ts — in-memory τοποθετήσιμοι ορισμοί
 */

import type {
  BlockBoundsMm,
  BlockCategory,
  BlockLibraryItem,
  BlockLibraryScope,
  BlockThumbnailVector,
  InSessionBlockDef,
} from './block-library-types';
import { getBlockThumbnail } from './block-thumbnail';

/**
 * Το «σε ποια βιβλιοθήκη ανήκει» μιας κάρτας — τα 4 scopes της μόνιμης βιβλιοθήκης ΣΥΝ
 * το `'session'` (ήρθε με το τρέχον import, δεν έχει σωθεί ακόμα πουθενά). Είναι η τιμή
 * που φιλτράρουν τα chips του palette.
 */
export type BlockPaletteScope = BlockLibraryScope | 'session';

export interface BlockPaletteEntry {
  /** Μοναδικό κλειδί λίστας: `blklib_*` id (cloud) ή `session:<name>` (import). */
  readonly key: string;
  readonly name: string;
  readonly boundsMm: BlockBoundsMm | null;
  readonly source: 'session' | 'cloud';
  /** Σε ποια βιβλιοθήκη ζει (φίλτρο + badge). */
  readonly scope: BlockPaletteScope;
  /** `null` για session block (δεν έχει δηλωθεί ακόμα κατηγορία). */
  readonly category: BlockCategory | null;
  /** i18n key ετικέτας (seeded περιεχόμενο)· `undefined` ⇒ δείξε το raw όνομα. */
  readonly labelKey?: string;
  /**
   * M4 — διανυσματικό preview της κάρτας. **Μία αναπαράσταση για τις δύο πηγές**: το session
   * block το χτίζει ζωντανά από τη γεωμετρία που έχει ήδη στη μνήμη, το cloud block το φέρνει
   * έτοιμο μέσα στο doc (μηδέν geometry download για μια κάρτα). `null` ⇒ η κάρτα πέφτει στο
   * ορθογώνιο αποτύπωμα των `boundsMm`.
   */
  readonly thumbnail: BlockThumbnailVector | null;
  /** Cloud metadata (άδεια/προέλευση/κατηγορία) — `null` για session-only. */
  readonly item: BlockLibraryItem | null;
  /** Δεν είναι ακόμα στη βιβλιοθήκη → προσφέρουμε «Αποθήκευση». */
  readonly canSave: boolean;
}

function sessionEntry(def: InSessionBlockDef): BlockPaletteEntry {
  return {
    key: `session:${def.name}`,
    name: def.name,
    boundsMm: def.boundsMm,
    source: 'session',
    scope: 'session',
    category: null,
    // Η γεωμετρία είναι ΗΔΗ στη μνήμη → το preview χτίζεται επιτόπου (identity-cached).
    thumbnail: getBlockThumbnail(def.localMembers),
    item: null,
    canSave: true,
  };
}

function cloudEntry(item: BlockLibraryItem): BlockPaletteEntry {
  return {
    key: item.id,
    name: item.name,
    boundsMm: item.boundsMm,
    source: 'cloud',
    scope: item.scope,
    category: item.category,
    labelKey: item.labelKey,
    // Προϋπολογισμένο τη στιγμή της εγγραφής (save/seed) — μηδέν geometry download.
    thumbnail: item.thumbnail ?? null,
    item,
    canSave: false,
  };
}

/**
 * Ενώνει τα session defs με τα cloud items σε μία λίστα καρτών. Σειρά: πρώτα τα φρέσκα
 * (import, δεν έχουν σωθεί ακόμα — αυτά ζητά ο χρήστης άμεσα μετά το import), μετά η
 * μόνιμη βιβλιοθήκη.
 */
export function mergeBlockPaletteEntries(
  sessionDefs: readonly InSessionBlockDef[],
  cloudItems: readonly BlockLibraryItem[],
): readonly BlockPaletteEntry[] {
  const savedNames = new Set(cloudItems.map((item) => item.name));
  const sessionOnly = sessionDefs
    .filter((def) => !savedNames.has(def.name))
    .map(sessionEntry);

  return [...sessionOnly, ...cloudItems.map(cloudEntry)];
}

/**
 * Μπορώ να ΔΙΑΓΡΑΨΩ αυτή την κάρτα; (M3 — το κουμπί του κάδου)
 *
 * Το seeded/partner περιεχόμενο (`builtin`) είναι read-only για όλους — ο πυρήνας
 * (`ScopedLibraryService`) το φυλά ούτως ή άλλως, όπως και οι `firestore.rules`. Εδώ
 * κρίνουμε μόνο ΤΙ ΔΕΙΧΝΟΥΜΕ: κουμπί που θα πετούσε σίγουρα σφάλμα δεν εμφανίζεται.
 */
export function canDeleteBlockEntry(
  entry: BlockPaletteEntry,
  userId: string | undefined,
): boolean {
  if (entry.source !== 'cloud' || !entry.item || entry.item.builtin) return false;
  return Boolean(userId) && entry.item.createdBy === userId;
}

/**
 * Μπορώ να ΔΗΜΟΣΙΕΥΣΩ αυτή την κάρτα; (M3 — προαγωγή ιδιωτικού → εταιρείας/έργου)
 *
 * ΜΟΝΟ ό,τι είναι ήδη στη ΔΙΚΗ ΜΟΥ ιδιωτική βιβλιοθήκη· ό,τι είναι ήδη κοινόχρηστο δεν
 * ξανα-δημοσιεύεται. Προσοχή: το κουμπί ΔΕΝ κρύβεται όταν λείπει το δικαίωμα αναδιανομής —
 * ο χρήστης πρέπει να δει τον νομικό λόγο και να μπορεί να διορθώσει την άδεια.
 */
export function canPromoteBlockEntry(
  entry: BlockPaletteEntry,
  userId: string | undefined,
): boolean {
  return canDeleteBlockEntry(entry, userId) && entry.scope === 'user';
}

/**
 * Μπορώ να ΕΠΕΞΕΡΓΑΣΤΩ το metadata αυτής της κάρτας; (M4 — μετονομασία/κατηγορία/άδεια)
 *
 * Ίδιο δικαίωμα με τη διαγραφή: δικό μου, μη-builtin, cloud. Ισχύει και για ΗΔΗ δημοσιευμένα
 * blocks (εταιρείας/έργου) — μια διόρθωση ονόματος/κατηγορίας δεν είναι λόγος να τα
 * ξεδημοσιεύσεις. Το session block ΔΕΝ έχει ακόμα metadata να επεξεργαστείς: πρώτα αποθήκευση.
 */
export function canEditBlockEntry(
  entry: BlockPaletteEntry,
  userId: string | undefined,
): boolean {
  return canDeleteBlockEntry(entry, userId);
}

/** Κανονικοποίηση ονόματος για σύγκριση ταυτότητας (case/space-insensitive — AutoCAD-like). */
function normalizeBlockName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

/**
 * Είναι το `name` ΗΔΗ πιασμένο από άλλη κάρτα; (M4 — φύλακας μετονομασίας)
 *
 * ΓΙΑΤΙ ΕΙΝΑΙ ΚΡΙΣΙΜΟ: το όνομα είναι το κλειδί ταυτότητας του ορισμού — το registry
 * (`block-library-registry`), το lazy hydration (`hydrateCloudBlockDef`) και ο dedup του
 * palette κλειδώνουν ΟΛΑ πάνω σε αυτό. Δύο αντικείμενα με το ίδιο όνομα ⇒ το tool θα
 * τοποθετούσε τη γεωμετρία του ΕΝΟΣ κάτω από την κάρτα του ΑΛΛΟΥ (last-wins). Ελέγχονται
 * ΚΑΙ τα session blocks: μια μετονομασία που «πατάει» εισαγόμενο block έχει το ίδιο πρόβλημα.
 */
export function isBlockNameTaken(
  entries: readonly BlockPaletteEntry[],
  name: string,
  exceptKey: string,
): boolean {
  const target = normalizeBlockName(name);
  if (!target) return false;
  return entries.some(
    (entry) => entry.key !== exceptKey && normalizeBlockName(entry.name) === target,
  );
}
