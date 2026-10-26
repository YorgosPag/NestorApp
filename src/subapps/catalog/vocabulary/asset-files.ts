/**
 * =============================================================================
 * ΤΑ ΑΡΧΕΙΑ ΤΩΝ ΜΕΣΩΝ ΤΟΥ ΚΑΤΑΛΟΓΟΥ (ADR-923 §5.10.3) — είδος ↔ τύπος αρχείου · όρια · θέση
 * =============================================================================
 *
 * Το μέσο λέει **τι είναι** (ρόλος) και **τι bytes** δέχεται (είδος: εικόνα · έγγραφο · BIM · βίντεο). Εδώ το είδος
 * συναντά το **μητρώο τύπων αρχείων** της πλατφόρμας (`classification-registry`) — **κανένας** δεύτερος πίνακας MIME.
 *
 * 🔑 **Η κατάληξη αποφασίζει, το MIME επιβεβαιώνει**: ο browser στέλνει `''` ή `application/octet-stream` για ένα
 *   `.rfa`/`.ifc`, άρα μόνο το MIME θα απέρριπτε νόμιμα αρχεία BIM. Όταν όμως **και τα δύο** λένε κάτι και διαφωνούν
 *   στην κατηγορία (PDF μετονομασμένο σε `.jpg`), το αρχείο **δεν** περνά: μία από τις δύο δηλώσεις ψεύδεται.
 * 🔑 **Όρια ανά είδος, σε ΕΝΑ σημείο** (Γ6): το Akeneo δεν βάζει δικό του όριο — το βάζει ο διακομιστής. Εδώ το όριο
 *   είναι απόφαση **ανά είδος**· οι κανόνες Storage επιβάλλουν το **ταβάνι** ({@link CATALOG_ASSET_UPLOAD_CEILING_BYTES})
 *   στη διαδρομή `catalog_asset`, και η άγκυρα `catalog-asset-storage-ceiling.test.ts` κρατά τους δύο αριθμούς ίσους.
 *
 * @module subapps/catalog/vocabulary/asset-files
 */

import {
  FILE_CATEGORIES,
  FILE_DOMAINS,
  type FileCategory as StorageFileCategory,
  type FileDomain,
} from '@/config/domain-constants';
import {
  FILE_TYPE_REGISTRY,
  MIME_PREFIX_SPECS,
  prefixSpecFor,
  specByExt,
  specByMime,
  type FileCategory as FileTypeCategory,
} from '@/config/file-types/classification-registry';
import type { CatalogAssetRole } from './asset-roles';
import type { AssetKind } from './attribute-types';

/** Ποιες κατηγορίες του μητρώου τύπων δέχεται κάθε είδος. Το έγγραφο = **PDF** (φύλλο δεδομένων · εγχειρίδιο · πιστοποιητικό · EPD). */
export const ASSET_KIND_FILE_CATEGORIES: Readonly<Record<AssetKind, readonly FileTypeCategory[]>> = {
  image: ['image'],
  document: ['pdf'],
  bim: ['bim'],
  video: ['video'],
};

const MIB = 1024 * 1024;

/**
 * Μέγιστο μέγεθος αρχείου ανά είδος. Εικόνα 200 MB (TIFF εκτύπωσης με προφίλ) · έγγραφο 100 MB · BIM 500 MB (οικογένειες
 * Revit/μοντέλα IFC) · βίντεο 500 MB.
 */
export const CATALOG_ASSET_MAX_BYTES: Readonly<Record<AssetKind, number>> = {
  image: 200 * MIB,
  document: 100 * MIB,
  bim: 500 * MIB,
  video: 500 * MIB,
};

/** Το ταβάνι που επιβάλλουν οι κανόνες Storage στη διαδρομή `catalog_asset` — το μέγιστο των ορίων ανά είδος. */
export const CATALOG_ASSET_UPLOAD_CEILING_BYTES = Math.max(...Object.values(CATALOG_ASSET_MAX_BYTES));

/**
 * Πού ανεβαίνει το αρχείο κάθε ρόλου (`buildStoragePath`: τομέας · κατηγορία). Δεμένο στη ρίζα των ρόλων: νέος ρόλος
 * χωρίς γραμμή σπάει τη μεταγλώττιση. Οι κατηγορίες είναι οι **υπάρχουσες** του αποθετηρίου — καμία νέα.
 */
export const CATALOG_ASSET_UPLOAD_TARGET: Readonly<Record<CatalogAssetRole, { readonly domain: FileDomain; readonly category: StorageFileCategory }>> = {
  photo: { domain: FILE_DOMAINS.CATALOG, category: FILE_CATEGORIES.PHOTOS },
  drawing: { domain: FILE_DOMAINS.CATALOG, category: FILE_CATEGORIES.DRAWINGS },
  datasheet: { domain: FILE_DOMAINS.CATALOG, category: FILE_CATEGORIES.DOCUMENTS },
  manual: { domain: FILE_DOMAINS.CATALOG, category: FILE_CATEGORIES.DOCUMENTS },
  certificate: { domain: FILE_DOMAINS.CATALOG, category: FILE_CATEGORIES.PERMITS },
  epd: { domain: FILE_DOMAINS.CATALOG, category: FILE_CATEGORIES.DOCUMENTS },
  bim: { domain: FILE_DOMAINS.CATALOG, category: FILE_CATEGORIES.MODELS },
  video: { domain: FILE_DOMAINS.CATALOG, category: FILE_CATEGORIES.VIDEOS },
};

/** Ό,τι χρειάζεται η κρίση από ένα αρχείο — δομικό (το `FileRecord` το ικανοποιεί). */
export interface AssetFileTypeFacts {
  readonly ext?: string;
  readonly contentType?: string;
}

/** Η κρίση: δεκτό · άλλο είδος · οι δύο δηλώσεις (κατάληξη/MIME) διαφωνούν. */
export type AssetFileTypeVerdict = 'accepted' | 'kindMismatch' | 'typeConflict';

/** MIME που δεν λέει τίποτα (ο browser δεν ήξερε) — δεν μετρά ως δήλωση. */
function isSilentMime(contentType: string | undefined): boolean {
  const mime = contentType?.split(';')[0].trim().toLowerCase() ?? '';
  return mime === '' || mime === 'application/octet-stream';
}

function categoryByMime(contentType: string | undefined): FileTypeCategory | null {
  if (isSilentMime(contentType)) return null;
  return specByMime(contentType?.split(';')[0].trim())?.category ?? prefixSpecFor(contentType)?.category ?? null;
}

/**
 * **Δέχεται αυτό το είδος αυτό το αρχείο;** — η ΜΙΑ κρίση, κοινή σε οθόνη (2δ) και διακομιστή. Η κατάληξη αποφασίζει,
 * το MIME αποφασίζει μόνο όταν η κατάληξη δεν λέει τίποτα (βίντεο: το μητρώο τα γνωρίζει ανά πρόθεμα `video/`).
 */
export function assetKindAcceptsFile(kind: AssetKind, facts: AssetFileTypeFacts): AssetFileTypeVerdict {
  const byExt = specByExt(facts.ext)?.category ?? null;
  const byMime = categoryByMime(facts.contentType);
  if (byExt !== null && byMime !== null && byExt !== byMime) return 'typeConflict';
  const category = byExt ?? byMime;
  return category !== null && ASSET_KIND_FILE_CATEGORIES[kind].includes(category) ? 'accepted' : 'kindMismatch';
}

/**
 * Το φίλτρο του επιλογέα αρχείων (`<input accept>`) για ένα σύνολο ειδών — **παράγεται** από το μητρώο τύπων και τον
 * πίνακα είδους ↔ κατηγορίας, ώστε ο επιλογέας να προτείνει ακριβώς ό,τι θα δεχτεί η {@link assetKindAcceptsFile}.
 * Καταλήξεις (`.ifc`, `.rfa` — ο browser δεν ξέρει MIME) **και** οικογένειες MIME (`video/*`). Είναι **υπόδειξη**: ό,τι
 * ρίχνεται με σύρσιμο ξανακρίνεται.
 */
export function assetAcceptAttribute(kinds: readonly AssetKind[]): string {
  const categories = new Set(kinds.flatMap((kind) => ASSET_KIND_FILE_CATEGORIES[kind]));
  const extensions = FILE_TYPE_REGISTRY.filter((spec) => categories.has(spec.category)).flatMap((spec) => spec.extensions.map((ext) => `.${ext}`));
  const prefixes = MIME_PREFIX_SPECS.filter((spec) => categories.has(spec.category)).map((spec) => `${spec.prefix}*`);
  return [...new Set([...extensions, ...prefixes])].join(',');
}
