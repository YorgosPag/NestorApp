/**
 * =============================================================================
 * ΕΙΝΑΙ ΑΥΤΑ ΤΑ BYTES ΑΡΧΕΙΟ ΑΥΤΟΥ ΤΟΥ ΡΟΛΟΥ; (ADR-934 §5.2 Μ4 · Μ9 · §5.2.2 Μ-β2)
 * =============================================================================
 *
 * Η κρίση ενός μέσου που κατέβηκε από διεύθυνση προμηθευτή — **καθαρή**, πριν γραφτεί οτιδήποτε. Δύο βήματα, επειδή τα
 * bytes φτάνουν ως **ροή**:
 *   1. {@link judgeDownloadedContent} στα **πρώτα** bytes: σελίδα HTML / άγνωστο / άλλο είδος / σύγκρουση δηλώσεων ⇒ η ροή
 *      κόβεται εκεί, χωρίς να κατέβει το υπόλοιπο.
 *   2. {@link judgeDownloadedSize} στο **μετρημένο** μέγεθος, στο τέλος της ροής.
 *
 * 🔑 **Το περιεχόμενο αποφασίζει** `ext`/`contentType` της εγγραφής (`content-signature`)· οι δηλώσεις του τρίτου
 *   (κατάληξη · `AttachmentFilename` · `Content-Type`) μόνο **ελέγχονται** απέναντί του. Ένα `.jpg` που είναι PNG είναι
 *   PNG — ίδια οικογένεια, καμία σύγκρουση.
 * 🔑 **Επέκταση, όχι δεύτερος κριτής**: τύπος ανά είδος και όριο ανά είδος περνούν από το **ίδιο** `judgeAssetUpload`
 *   που κρίνει το ανέβασμα από την οθόνη. Εδώ προστίθεται μόνο ό,τι υπάρχει επειδή τα bytes ήρθαν από ξένο server.
 * 🔑 **Δηλώσεις που δεν λένε τίποτα** δεν προκαλούν σύγκρουση: ό,τι ο WHATWG MIME Sniffing ορίζει ως ανιχνεύσιμο αντί
 *   για δεσμευτικό (`text/plain` · `application/octet-stream` · `unknown/unknown` …) και κάθε δήλωση οικογένειας κειμένου.
 *   Μετρημένη πρακτική: servers στέλνουν IFC ως `text/plain` και SVG ως `text/xml`· η απόρριψή τους θα ήταν ψευδής.
 *
 * @module subapps/catalog/schema/judge-downloaded-asset
 */

import {
  extractExtension,
  filenameFromUrl,
  prefixSpecFor,
  specByExt,
  specByMime,
  type FileCategory,
} from '@/config/file-types/classification-registry';
import { sniffContent, type ContentSignature } from '@/lib/files/content-signature';
import type { AssetFetchFailure } from '../vocabulary/asset-fetch';
import { assetKindAcceptsFile, CATALOG_ASSET_MAX_BYTES } from '../vocabulary/asset-files';
import { ASSET_ROLE_KINDS, type CatalogAssetRole } from '../vocabulary/asset-roles';
import type { AssetKind } from '../vocabulary/attribute-types';
import type { CatalogIssueCode } from './catalog-issues';
import { judgeAssetUpload } from './judge-asset-file';

/** Ό,τι ξέρουμε για ένα μέσο όταν έχουν φτάσει τα πρώτα bytes. */
export interface DownloadedAssetHead {
  readonly role: CatalogAssetRole;
  /** Τα πρώτα bytes (`CONTENT_SIGNATURE_HEAD_BYTES`) — λιγότερα μόνο αν το αρχείο είναι μικρότερο. */
  readonly head: Uint8Array;
  /** Η διεύθυνση από την οποία κατέβηκε (κανονική). */
  readonly uri: string;
  /** Το `AttachmentFilename` του xChange, αν δόθηκε. */
  readonly filename: string | null;
  /** Το `Content-Type` της απάντησης. */
  readonly contentType: string | null;
}

/** Δεκτό περιεχόμενο: το είδος του μέσου και ό,τι θα γράψει η εγγραφή αρχείου. */
export interface AcceptedDownload {
  readonly kind: AssetKind;
  readonly signature: ContentSignature;
}

export type DownloadedAssetVerdict =
  | ({ readonly ok: true } & AcceptedDownload)
  | { readonly ok: false; readonly failure: AssetFetchFailure; readonly params?: Readonly<Record<string, string | number>> };

/** Το όριο της ροής για έναν ρόλο: το μεγαλύτερο όριο των ειδών που δέχεται — το είδος το ξέρουμε μόνο από τα bytes. */
export function downloadByteLimitFor(role: CatalogAssetRole): number {
  return Math.max(...ASSET_ROLE_KINDS[role].map((kind) => CATALOG_ASSET_MAX_BYTES[kind]));
}

// ─── Δηλώσεις του τρίτου ─────────────────────────────────────────────────────────────────────────────────────────────

/** WHATWG MIME Sniffing: τύποι που ζητούν ανίχνευση αντί να δεσμεύουν (+ το `binary/octet-stream` των παλιών S3). */
const SNIFFABLE_MIMES: ReadonlySet<string> = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
  'application/unknown',
  'unknown/unknown',
  '*/*',
  'text/plain',
]);

/** Οικογένειες που δεν δεσμεύουν τίποτα για τα bytes (κείμενο · XML · «άγνωστο» του μητρώου). */
const NON_COMMITTAL_CATEGORIES: ReadonlySet<FileCategory> = new Set<FileCategory>(['text', 'unknown']);

const baseMime = (contentType: string | null): string => contentType?.split(';')[0].trim().toLowerCase() ?? '';

/** Οι καταλήξεις που δηλώνει ο τρίτος, με σειρά εμπιστοσύνης: όνομα αρχείου → διεύθυνση. Μόνο όσες ξέρει το μητρώο. */
function declaredExtensions(facts: DownloadedAssetHead): readonly string[] {
  const candidates = [extractExtension(facts.filename ?? undefined), extractExtension(filenameFromUrl(facts.uri))];
  return candidates.filter((ext) => ext !== '' && specByExt(ext) !== null);
}

function declaredMimeCategory(contentType: string | null): FileCategory | null {
  const mime = baseMime(contentType);
  if (SNIFFABLE_MIMES.has(mime)) return null;
  return specByMime(mime)?.category ?? prefixSpecFor(mime)?.category ?? null;
}

/** Οι οικογένειες που **δεσμεύονται** από τις δηλώσεις του τρίτου (κατάληξη · MIME). */
function committedCategories(facts: DownloadedAssetHead): readonly FileCategory[] {
  const byExt = declaredExtensions(facts).map((ext) => specByExt(ext)?.category ?? null);
  const categories = [...byExt, declaredMimeCategory(facts.contentType)];
  return categories.filter((category): category is FileCategory => category !== null && !NON_COMMITTAL_CATEGORIES.has(category));
}

function contentCategory(signature: ContentSignature): FileCategory | null {
  return specByExt(signature.ext)?.category ?? prefixSpecFor(signature.contentType)?.category ?? null;
}

// ─── Η κρίση ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const refused = (failure: AssetFetchFailure, params?: Readonly<Record<string, string | number>>): DownloadedAssetVerdict =>
  params ? { ok: false, failure, params } : { ok: false, failure };

/**
 * **Τα πρώτα bytes**: σελίδα HTML ⇒ `notAFile` · άγνωστο ⇒ `unknownContent` · είδος που ο ρόλος δεν δέχεται ⇒
 * `kindMismatch` · δηλωμένη οικογένεια άλλη από των bytes ⇒ `typeConflict`. Αλλιώς: το είδος + η υπογραφή.
 */
export function judgeDownloadedContent(facts: DownloadedAssetHead): DownloadedAssetVerdict {
  const [declaredExt] = declaredExtensions(facts);
  const sniffed = sniffContent(facts.head, declaredExt ?? null);
  if (sniffed === 'html') return refused('notAFile');
  if (sniffed === null) return refused('unknownContent');
  const kind = ASSET_ROLE_KINDS[facts.role].find((candidate) => assetKindAcceptsFile(candidate, sniffed) === 'accepted');
  if (kind === undefined) return refused('kindMismatch');
  const actual = contentCategory(sniffed);
  if (committedCategories(facts).some((declared) => declared !== actual)) return refused('typeConflict');
  return { ok: true, kind, signature: sniffed };
}

/** Τα ευρήματα που μπορεί να βγάλει το `judgeAssetUpload` — κάθε άλλο είναι λάθος προγραμματισμού, όχι του αρχείου. */
const FAILURE_OF_UPLOAD_ISSUE: Readonly<Partial<Record<CatalogIssueCode, AssetFetchFailure>>> = {
  fileTooLarge: 'tooLarge',
  fileKindMismatch: 'kindMismatch',
  fileTypeConflict: 'typeConflict',
};

/** **Το μετρημένο μέγεθος**, με το ίδιο `judgeAssetUpload` του ανεβάσματος (τύπος + όριο ανά είδος). `null` = δεκτό. */
export function judgeDownloadedSize(accepted: AcceptedDownload, sizeBytes: number): DownloadedAssetVerdict | null {
  const [issue] = judgeAssetUpload(accepted.kind, { ...accepted.signature, sizeBytes });
  if (issue === undefined) return null;
  const failure = FAILURE_OF_UPLOAD_ISSUE[issue.code];
  if (failure === undefined) throw new Error(`[judge-downloaded-asset] unexpected issue "${issue.code}" from judgeAssetUpload`);
  return refused(failure, issue.params);
}
