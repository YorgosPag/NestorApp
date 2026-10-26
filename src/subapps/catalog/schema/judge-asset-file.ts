/**
 * =============================================================================
 * ΑΝΗΚΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΣΕ ΑΥΤΟ ΤΟ ΜΕΣΟ; (ADR-923 §5.10.3 · Δ9)
 * =============================================================================
 *
 * Η κρίση πριν γραφτεί `fileId` σε ένα μέσο — **καθαρή**, κοινή σε οθόνη (2δ) και διακομιστή (`asset-writer`).
 *
 * 🔑 **Επέκταση, όχι δεύτερος κριτής**: κατοχή · δοχείο · «ζωντανό» κρίνονται από τον **έναν** κριτή της πλατφόρμας
 *   (`judgeContainerFile` — ΠΚΑ, ΠΕΑ, τεκμήρια μεταβίβασης). Εδώ προστίθεται μόνο ό,τι είναι του καταλόγου: τύπος ανά
 *   **είδος** (`assetKindAcceptsFile`), όριο ανά είδος, και αποδόσεις έτοιμες με την τρέχουσα συνταγή.
 * 🔑 **Το `fileId` έρχεται από τον πελάτη — ποτέ δεν το εμπιστευόμαστε**: ένα ξένο id θα έδενε στο μέσο αρχείο άλλου.
 *
 * @module subapps/catalog/schema/judge-asset-file
 */

import { ENTITY_TYPES } from '@/config/domain-constants';
import { judgeContainerFile, type ContainerFileRefusal } from '@/lib/files/container-file-verdict';
import { catalogRenditionsStanding, needsCatalogRenditions, type CatalogRenditions } from '../renditions/catalog-renditions';
import { assetKindAcceptsFile, CATALOG_ASSET_MAX_BYTES, type AssetFileTypeFacts } from '../vocabulary/asset-files';
import type { AssetKind } from '../vocabulary/attribute-types';
import type { CatalogIssue, CatalogIssueCode } from './catalog-issues';

/** Το μέσο όπως το χρειάζεται η κρίση. */
export interface AssetFileTarget {
  readonly companyId: string;
  readonly assetId: string;
  readonly kind: AssetKind;
}

/**
 * Το **μετρημένο** μέγεθος του αντικειμένου (μεταδεδομένα του κάδου, από τον διακομιστή). 🔒 Το `sizeBytes` της εγγραφής
 * το **δηλώνει ο πελάτης** στην οριστικοποίηση — χρησιμοποιείται μόνο όταν δεν υπάρχει μέτρηση (οθόνη, πριν σταλεί).
 */
export interface AssetFileMeasurement {
  readonly storedSizeBytes: number | null;
}

const FILE_PATH = 'fileId';
const BYTES_PER_MB = 1024 * 1024;

const ISSUE_OF_REFUSAL: Readonly<Record<Exclude<ContainerFileRefusal, 'file-wrong-type'>, CatalogIssueCode>> = {
  'file-missing': 'fileNotFound',
  'file-not-yours': 'fileForeignOwner',
  'file-not-ready': 'fileNotReady',
};

function text(data: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = data[key];
  return typeof value === 'string' ? value : undefined;
}

/** Κατάληξη + MIME ενός εγγράφου αρχείου, διαβασμένα με ασφάλεια — ο ΕΝΑΣ αναγνώστης για κρίση και γραφέα. */
export function assetFileTypeFactsOf(data: Readonly<Record<string, unknown>>): AssetFileTypeFacts {
  return { ext: text(data, 'ext'), contentType: text(data, 'contentType') };
}

function issue(code: CatalogIssueCode, params?: Readonly<Record<string, string | number>>): readonly CatalogIssue[] {
  return [params ? { code, path: FILE_PATH, params } : { code, path: FILE_PATH }];
}

/** Τύπος ως προς το είδος — «άλλο είδος» ή «η κατάληξη και το MIME διαφωνούν». */
function typeIssues(kind: AssetKind, facts: AssetFileTypeFacts): readonly CatalogIssue[] {
  const verdict = assetKindAcceptsFile(kind, facts);
  if (verdict === 'accepted') return [];
  return issue(verdict === 'typeConflict' ? 'fileTypeConflict' : 'fileKindMismatch', { kind });
}

function sizeIssues(kind: AssetKind, sizeBytes: number): readonly CatalogIssue[] {
  const maxBytes = CATALOG_ASSET_MAX_BYTES[kind];
  return sizeBytes > maxBytes ? issue('fileTooLarge', { maxMb: maxBytes / BYTES_PER_MB }) : [];
}

/**
 * **Δέχεται αυτό το είδος αυτό το αρχείο, πριν ανέβει έστω ένα byte;** — ο προέλεγχος της οθόνης (2δ), με **τα ίδια**
 * σκέλη τύπου και μεγέθους που τρέχει η {@link judgeAssetFile} στη σύνδεση. Ό,τι κόβει εδώ θα το έκοβε και ο διακομιστής·
 * ό,τι περνά εδώ το ξανακρίνει ο διακομιστής (κατοχή · μετρημένο μέγεθος · αποδόσεις).
 */
export function judgeAssetUpload(kind: AssetKind, file: AssetFileTypeFacts & { readonly sizeBytes: number }): readonly CatalogIssue[] {
  const byType = typeIssues(kind, file);
  return byType.length > 0 ? byType : sizeIssues(kind, file.sizeBytes);
}

/**
 * **Αλλαγή είδους με δεμένο αρχείο**: ταιριάζει το αρχείο και στο **νέο** είδος; — η ΜΙΑ κρίση, για τον γραφέα
 * (`updateCatalogAsset`) και για το πρόχειρο της οθόνης. Εύρημα στο `kind` (εκεί το διορθώνει ο άνθρωπος). Ένα δεμένο
 * αρχείο πέρασε ήδη την κρίση τύπου, άρα η μόνη δυνατή αστοχία εδώ είναι «άλλο είδος».
 */
export function attachedFileKindIssues(nextKind: AssetKind, attached: AssetFileTypeFacts): readonly CatalogIssue[] {
  return assetKindAcceptsFile(nextKind, attached) === 'accepted' ? [] : [{ code: 'fileKindMismatch', path: 'kind', params: { kind: nextKind } }];
}

/** Οι αποδόσεις του αρχείου ως προς την **τρέχουσα** συνταγή (μόνο για εικόνες που αποδίδονται). */
function renditionIssues(kind: AssetKind, data: Readonly<Record<string, unknown>>): readonly CatalogIssue[] {
  if (!needsCatalogRenditions(kind, assetFileTypeFactsOf(data))) return [];
  const recorded = data.catalogRenditions as CatalogRenditions | undefined;
  switch (catalogRenditionsStanding(recorded)) {
    case 'ready':
      return [];
    case 'failed':
      return issue('renditionsFailed', recorded?.status === 'failed' ? { failure: recorded.failure } : undefined);
    case 'stale':
      return issue('renditionsNotReady');
  }
}

/**
 * **Η κρίση**: κενός πίνακας = το αρχείο δένεται. Ένα εύρημα κάθε φορά, με τη σειρά «υπάρχει → δικό σου → έτοιμο → τύπος →
 * μέγεθος → αποδόσεις» — η πρώτη αποτυχία είναι αυτή που μπορεί να διορθώσει ο άνθρωπος.
 */
export function judgeAssetFile(
  target: AssetFileTarget,
  fileId: string,
  data: Readonly<Record<string, unknown>> | null,
  measurement: AssetFileMeasurement = { storedSizeBytes: null },
): readonly CatalogIssue[] {
  const verdict = judgeContainerFile(fileId, data, {
    owner: { kind: 'company', companyId: target.companyId },
    entityType: ENTITY_TYPES.CATALOG_ASSET,
    entityId: target.assetId,
    contentType: (record) => assetKindAcceptsFile(target.kind, assetFileTypeFactsOf(record)) === 'accepted',
  });
  if (verdict.kind === 'refused') {
    if (verdict.reason !== 'file-wrong-type') return issue(ISSUE_OF_REFUSAL[verdict.reason]);
    return typeIssues(target.kind, assetFileTypeFactsOf(data ?? {}));
  }
  const record = data ?? {};
  const sizeBytes = measurement.storedSizeBytes ?? (typeof record.sizeBytes === 'number' ? record.sizeBytes : null);
  // Fail-closed: ένα «έτοιμο» αρχείο χωρίς μέγεθος δεν έχει περάσει από οριστικοποίηση που ξέρουμε.
  if (sizeBytes === null) return issue('fileNotReady');
  const bySize = sizeIssues(target.kind, sizeBytes);
  return bySize.length > 0 ? bySize : renditionIssues(target.kind, record);
}
