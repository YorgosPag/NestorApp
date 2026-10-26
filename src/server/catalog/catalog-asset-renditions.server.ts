import 'server-only';

/**
 * =============================================================================
 * Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΩΝ ΑΠΟΔΟΣΕΩΝ ΕΝΟΣ ΜΕΣΟΥ ΚΑΤΑΛΟΓΟΥ (ADR-923 §5.10.3 · Δ10)
 * =============================================================================
 *
 * Ροή: γενιά του πρωτοτύπου (`statStorageObject`) → bytes **αυτής** της γενιάς (`readStorageObjectGeneration`, όριο
 *   εικόνας) → **ένας** αναγνώστης μεταδεδομένων (`imageRasterFactsIn` — χρώμα της πηγής) → **μία** αποκωδικοποίηση με
 *   στροφή (`decodeOriented`) → δύο αποδόσεις (`encodeRasterRendition`, `clone()`) → δίπλα στο πρωτότυπο
 *   (`fileCompanionPath`, ίδιος κάδος — ADR-895 Α2) → `catalogRenditions` στην εγγραφή (`ready` | `failed`).
 *
 * 🔑 **Δύο είσοδοι, ένας γραφέας** (Akeneo transformations: ο στόχος παράγεται από την πηγή):
 *   1. Η σύνδεση αρχείου ↔ μέσου (`POST /api/catalog/assets/[id]/file`) — **προληπτικά**, πριν δεθεί το αρχείο.
 *   2. Η έκδοση (Φ5) ως δίχτυ ασφαλείας — αποδόσεις παλιότερης συνταγής ή παλιότερης γενιάς ξαναφτιάχνονται.
 *
 * IDEMPOTENCY: έκβαση της **τρέχουσας** συνταγής **και** της **τρέχουσας** γενιάς ⇒ επιστρέφεται χωρίς λήψη. Ονόματα
 *   ντετερμινιστικά, καθαρή μετατροπή ⇒ δύο ταυτόχρονες κλήσεις γράφουν τα ίδια bytes· στην ίδια διεργασία μοιράζονται
 *   **μία** δουλειά (ουρά ιδεμπότητη ανά αρχείο·συνταγή·γενιά, ≤ {@link RENDITION_ENCODE_CONCURRENCY} ταυτόχρονα).
 * ⚠️ **`failed` ΜΟΝΟ για τα bytes** (μη αποκωδικοποιήσιμα · πάνω από το όριο). Βλάβη αποθήκευσης/δικτύου ή γενιά που
 *   άλλαξε στο μεταξύ **πετά** και δεν καταγράφεται: θα καταδίκαζε για πάντα μια σωστή φωτογραφία.
 * 🔒 **Ποτέ download token, ποτέ EXIF/GPS**: οι αποδόσεις είναι ιδιωτικές όσο και το πρωτότυπο.
 *
 * @module server/catalog/catalog-asset-renditions.server
 */

import type { Bucket } from '@google-cloud/storage';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type sharp from 'sharp';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createPriorityTaskQueue } from '@/lib/async/priority-task-queue';
import { nowISO } from '@/lib/date-local';
import { fileCompanionPath, type FileCompanionKind } from '@/lib/files/file-companion-objects';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import type { ImageColour } from '@/lib/images/image-colour';
import { imageRasterFactsIn } from '@/lib/images/stored-image-dimensions';
import { readStorageObjectGeneration, statStorageObject } from '@/lib/storage/storage-object-stream';
import { createModuleLogger } from '@/lib/telemetry';
import type { CustodyKind } from '@/lib/workspace/custody-scope';
import { fileRecordBucket } from '@/server/files/file-record-bucket';
import { readImageMetadata } from '@/server/images/image-metadata';
import { decodeOriented, encodeRasterRendition, type RasterRenditionSpec } from '@/server/images/raster-encoder';
import {
  CATALOG_RENDITION_RECIPE_VERSION,
  catalogRenditionsStanding,
  type CatalogRenditionFacts,
  type CatalogRenditionFailure,
  type CatalogRenditions,
  type CatalogRenditionUse,
} from '@/subapps/catalog/renditions/catalog-renditions';
import { CATALOG_ASSET_MAX_BYTES } from '@/subapps/catalog/vocabulary/asset-files';

const logger = createModuleLogger('CatalogAssetRenditions');

/**
 * 🔑 **Η ΣΥΝΤΑΓΗ** (πολιτική) — ζει εδώ, ο μηχανισμός στο `raster-encoder`. Κάθε αλλαγή ⇒ ανέβασε το
 * `CATALOG_RENDITION_RECIPE_VERSION` (η άγκυρα του test κλειδώνει τη συνταγή στην έκδοσή της).
 * - web: sRGB · 2048 · JPEG q82 4:2:0 (Akeneo `scale` + `colorspace` + `optimize_jpeg`).
 * - print: ο χώρος της πηγής · ως 12000 px (A1 στα 300 ppi = 9933 px· το όριο προστατεύει μόνο τη μνήμη) · JPEG q95
 *   4:4:4 (καμία υποδειγματοληψία χρώματος — τα κόκκινα/μπλε άκρα ενός λογότυπου μένουν καθαρά στο τυπωμένο).
 */
export const CATALOG_RENDITION_SPECS: Readonly<Record<CatalogRenditionUse, RasterRenditionSpec>> = {
  web: { box: { fit: 'max-edge', px: 2048 }, colour: 'srgb', jpegQuality: 82, chromaSubsampling: '4:2:0' },
  print: { box: { fit: 'max-edge', px: 12000 }, colour: 'preserve', jpegQuality: 95, chromaSubsampling: '4:4:4' },
};

const COMPANION_OF_USE: Readonly<Record<CatalogRenditionUse, FileCompanionKind>> = {
  web: 'catalogWebRendition',
  print: 'catalogPrintRendition',
};

/** Μία βαριά κωδικοποίηση τη φορά ανά διεργασία — μια εικόνα εκτύπωσης 200 MB είναι εκατοντάδες MB αποκωδικοποιημένη. */
export const RENDITION_ENCODE_CONCURRENCY = 1;
const queue = createPriorityTaskQueue(RENDITION_ENCODE_CONCURRENCY);

/** Η εγγραφή όσο τη χρειάζεται ο γραφέας. */
export interface CatalogRenditionRecord {
  readonly storagePath?: string;
  readonly storagePlacement?: unknown;
  readonly catalogRenditions?: CatalogRenditions;
}

export interface CatalogRenditionTarget {
  /** Το διαμέρισμα της εγγραφής — αποδεδειγμένο από τον καλούντα, ποτέ μαντεμένο. */
  readonly custody: CustodyKind;
  readonly fileId: string;
  readonly record: CatalogRenditionRecord;
}

/** Τα bytes «δεν δίνουν αποδόσεις» — ονομασμένη αιτία που **καταγράφεται**, σε αντίθεση με κάθε άλλη εξαίρεση. */
class RenditionContentError extends Error {
  constructor(readonly failure: CatalogRenditionFailure) {
    super(failure);
    this.name = 'RenditionContentError';
  }
}

/** Πού και από ποια γενιά — ό,τι μοιράζονται οι δύο αποδόσεις. */
interface RenditionSource {
  readonly fileId: string;
  readonly storagePath: string;
  readonly bucket: Bucket;
  readonly generation: string;
}

async function sourceBytes(source: RenditionSource): Promise<Buffer> {
  const bytes = await readStorageObjectGeneration(source.storagePath, source.generation, { bucket: source.bucket });
  // Η γενιά άλλαξε ανάμεσα στο stat και στη λήψη ⇒ συναγωνισμός, όχι κακά bytes: πετά, η επόμενη κλήση ξαναδοκιμάζει.
  if (bytes === null) throw new Error(`catalog rendition source generation ${source.generation} vanished`);
  return Buffer.from(bytes);
}

async function sourceColour(bytes: Buffer): Promise<ImageColour> {
  const facts = await imageRasterFactsIn(bytes, readImageMetadata);
  if (facts === null || facts.colour === null) throw new RenditionContentError('undecodable');
  return facts.colour;
}

async function encodeUse(pipeline: sharp.Sharp, colour: ImageColour, use: CatalogRenditionUse) {
  try {
    return await encodeRasterRendition(pipeline.clone(), colour, CATALOG_RENDITION_SPECS[use]);
  } catch (cause) {
    logger.warn('Catalog rendition: the bytes do not encode', { use, error: cause instanceof Error ? cause.message : String(cause) });
    throw new RenditionContentError('undecodable');
  }
}

/** Μία απόδοση: κωδικοποίηση → αντικείμενο δίπλα στο πρωτότυπο → ό,τι μετρήθηκε. */
async function writeUse(pipeline: sharp.Sharp, colour: ImageColour, use: CatalogRenditionUse, source: RenditionSource): Promise<CatalogRenditionFacts> {
  const rendition = await encodeUse(pipeline, colour, use);
  await source.bucket.file(fileCompanionPath(source.storagePath, COMPANION_OF_USE[use])).save(rendition.bytes, {
    contentType: rendition.contentType,
    resumable: false,
    metadata: {
      cacheControl: 'private, max-age=0',
      metadata: {
        derivedFrom: source.fileId,
        source: 'catalog-rendition',
        recipe: String(CATALOG_RENDITION_RECIPE_VERSION),
        sourceGeneration: source.generation,
      },
    },
  });
  const { contentType, width, height, colour: measured, assumedProfile, colourPreserved } = rendition;
  return { contentType, width, height, sizeBytes: rendition.bytes.length, colour: measured, assumedProfile, colourPreserved };
}

async function render(source: RenditionSource, sizeBytes: number | null): Promise<CatalogRenditions> {
  const stamp = { recipe: CATALOG_RENDITION_RECIPE_VERSION, sourceGeneration: source.generation };
  try {
    if (sizeBytes !== null && sizeBytes > CATALOG_ASSET_MAX_BYTES.image) throw new RenditionContentError('tooLarge');
    const bytes = await sourceBytes(source);
    const colour = await sourceColour(bytes);
    const pipeline = decodeOriented(bytes);
    const web = await writeUse(pipeline, colour, 'web', source);
    const print = await writeUse(pipeline, colour, 'print', source);
    return { status: 'ready', ...stamp, renderedAt: nowISO(), web, print };
  } catch (cause) {
    if (!(cause instanceof RenditionContentError)) throw cause;
    return { status: 'failed', ...stamp, failure: cause.failure, failedAt: nowISO() };
  }
}

/** Η καταγεγραμμένη έκβαση περιγράφει **αυτή** τη γενιά με **αυτή** τη συνταγή; */
function isCurrent(recorded: CatalogRenditions | undefined, generation: string): recorded is CatalogRenditions {
  return recorded !== undefined && catalogRenditionsStanding(recorded) !== 'stale' && recorded.sourceGeneration === generation;
}

/**
 * **Εξασφαλίζει τις αποδόσεις** — επιστρέφει την καταγεγραμμένη έκβαση της **τρέχουσας** συνταγής και γενιάς, ή `null`
 * όταν η εγγραφή δεν έχει bytes. Πετά **μόνο** σε βλάβη υποδομής (τίποτα δεν καταγράφεται — η επόμενη κλήση ξαναδοκιμάζει).
 */
export async function ensureCatalogAssetRenditions(
  adminDb: AdminFirestore,
  target: CatalogRenditionTarget,
): Promise<CatalogRenditions | null> {
  const { record, fileId } = target;
  const storagePath = record.storagePath?.trim() ?? '';
  if (storagePath === '') return null;
  const bucket = fileRecordBucket(record);
  const stat = await statStorageObject(storagePath, { bucket });
  if (stat.kind === 'absent') return null;
  if (isCurrent(record.catalogRenditions, stat.generation)) return record.catalogRenditions;

  const source: RenditionSource = { fileId, storagePath, bucket, generation: stat.generation };
  const key = `${fileId}@${CATALOG_RENDITION_RECIPE_VERSION}@${stat.generation}`;
  const state = await queue.schedule(key, { priority: 0, group: 'catalog-renditions' }, () => render(source, stat.size));
  await adminDb.collection(COLLECTIONS[FILE_COLLECTION[target.custody]]).doc(fileId).update({ catalogRenditions: state });
  logger.info('Catalog renditions recorded', { fileId, status: state.status, recipe: state.recipe, generation: stat.generation });
  return state;
}
