/**
 * =============================================================================
 * Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΕΙΚΟΝΑΣ ΔΗΜΟΣΙΕΥΣΗΣ ΕΝΟΣ DXF (ADR-922)
 * =============================================================================
 *
 * Ροή: bytes DXF (αποσυμπίεση gzip αν χρειάζεται) → `parseDxfScene` (ο ΕΝΑΣ parser, ADR-033) →
 *   `rasterizeDxfForPublication` (το ΕΝΑ χωνί raster) → PNG **δίπλα στο πρωτότυπο** (`fileCompanionPath`,
 *   ίδιος κάδος — ADR-895 Α2) → `publishRaster` στην εγγραφή (`ready` | `failed`).
 *
 * 🔑 **Δύο είσοδοι, ένας γραφέας** (Box Representations: «ζήτα ⇒ φτιάχνεται»):
 *   1. `POST /api/files/{fileId}/publish-raster` — ο πελάτης το ζητά μόλις δει DXF χωρίς κατάσταση.
 *   2. Το δίχτυ ασφαλείας της δημοσίευσης (`ensureDossierPublishRasters`) — δηλωμένο DXF χωρίς έτοιμη εικόνα.
 *
 * IDEMPOTENCY: καταγεγραμμένη έκβαση (`ready`/`failed`) ⇒ επιστρέφεται χωρίς I/O. Το PNG έχει ντετερμινιστικό
 *   όνομα και η μετατροπή είναι καθαρή ⇒ δύο ταυτόχρονες κλήσεις γράφουν **τα ίδια** bytes και την ίδια έκβαση.
 *
 * ⚠️ **`failed` ΜΟΝΟ για τα bytes** (μη αναγνώσιμο · άδειο σχέδιο · αποτυχία απόδοσης). Βλάβη αποθήκευσης/δικτύου
 *   **πετά** και δεν καταγράφεται: θα καταδίκαζε για πάντα ένα σωστό σχέδιο για μια παροδική στιγμή.
 * 🔒 **Ποτέ download token**: το PNG είναι ιδιωτικό όσο και το DXF. Στον κόσμο φτάνει μόνο μέσα από το ράφι, που το
 *   ξαναποκωδικοποιεί και του αφαιρεί κάθε μεταδεδομένο (`public-shelf-sanitise`).
 *
 * @module services/floorplans/dxf-publish-raster.service
 */

import 'server-only';

import { gunzipSync } from 'zlib';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { fileCompanionPath } from '@/lib/files/file-companion-objects';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { createModuleLogger } from '@/lib/telemetry';
import type { CustodyKind } from '@/lib/workspace/custody-scope';
import { fileRecordBucket } from '@/server/files/file-record-bucket';
import { parseDxfScene } from '@/app/api/floorplans/process/floorplan-process.service';
import { rasterizeDxfForPublication } from '@/services/dxf-raster/dxf-publish-rasterizer';
import type { SceneUnits } from '@/subapps/dxf-viewer/utils/scene-units';

import { isDxfFile, type DxfPublishRaster, type DxfPublishRasterFailure } from './dxf-publish-raster';

const logger = createModuleLogger('DxfPublishRaster');

/** Η εγγραφή όσο τη χρειάζεται ο γραφέας. */
export interface DxfPublishRasterRecord {
  readonly ext?: string;
  readonly storagePath?: string;
  readonly storagePlacement?: unknown;
  readonly userDrawingUnits?: SceneUnits;
  readonly publishRaster?: DxfPublishRaster;
}

export interface DxfPublishRasterTarget {
  /** Το διαμέρισμα της εγγραφής — αποδεδειγμένο από τον καλούντα (αλυσίδα κατοχής), ποτέ μαντεμένο. */
  readonly custody: CustodyKind;
  readonly fileId: string;
  readonly record: DxfPublishRasterRecord;
}

/** Τα bytes «δεν είναι σχέδιο» — ονομασμένη αιτία που **καταγράφεται**, σε αντίθεση με κάθε άλλη εξαίρεση. */
class DxfContentError extends Error {
  constructor(readonly failure: DxfPublishRasterFailure, message: string) {
    super(message);
    this.name = 'DxfContentError';
  }
}

const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

/** Κάποιοι γραφείς αποθηκεύουν DXF συμπιεσμένα (`compressed: gzip`) — η υπογραφή των bytes το λέει χωρίς μεταδεδομένα. */
function inflatedDxfBytes(bytes: Buffer): Buffer {
  return bytes.length > 2 && bytes[0] === GZIP_MAGIC_0 && bytes[1] === GZIP_MAGIC_1 ? gunzipSync(bytes) : bytes;
}

/** Bytes → PNG + διαστάσεις. Πετά {@link DxfContentError} για ό,τι ανήκει στο ίδιο το σχέδιο. */
async function renderPublishRaster(
  bytes: Buffer,
  units: SceneUnits | undefined,
): Promise<{ png: Buffer; width: number; height: number }> {
  let parsed: Awaited<ReturnType<typeof parseDxfScene>>;
  try {
    parsed = await parseDxfScene(inflatedDxfBytes(bytes), units);
  } catch (cause) {
    throw new DxfContentError('unreadable', cause instanceof Error ? cause.message : String(cause));
  }
  if (parsed.scene.entities.length === 0) throw new DxfContentError('empty-drawing', 'DXF has no entities');

  let raster: ReturnType<typeof rasterizeDxfForPublication>;
  try {
    raster = rasterizeDxfForPublication(parsed.scene);
  } catch (cause) {
    throw new DxfContentError('render-failed', cause instanceof Error ? cause.message : String(cause));
  }
  if (raster.svgStats.renderedEntities === 0) {
    throw new DxfContentError('empty-drawing', 'DXF has no drawable entities');
  }
  return { png: Buffer.from(raster.png), width: raster.width, height: raster.height };
}

async function recordOutcome(adminDb: AdminFirestore, target: DxfPublishRasterTarget, state: DxfPublishRaster) {
  await adminDb
    .collection(COLLECTIONS[FILE_COLLECTION[target.custody]])
    .doc(target.fileId)
    .update({ publishRaster: state });
}

/**
 * **Εξασφαλίζει την εικόνα δημοσίευσης** — επιστρέφει την καταγεγραμμένη έκβαση, ή `null` όταν το αρχείο δεν είναι
 * DXF / δεν έχει bytes. Πετά **μόνο** σε βλάβη υποδομής (δεν καταγράφεται τίποτα — η επόμενη κλήση ξαναδοκιμάζει).
 *
 * @param dxfBytes — τα bytes, όταν ο καλών τα έχει ήδη (η αλυσίδα κατοχής τα κατέβασε)· αλλιώς κατεβαίνουν εδώ.
 */
export async function ensureDxfPublishRaster(
  adminDb: AdminFirestore,
  target: DxfPublishRasterTarget,
  dxfBytes?: Buffer,
): Promise<DxfPublishRaster | null> {
  const { record, fileId } = target;
  if (!isDxfFile(record)) return null;
  if (record.publishRaster !== undefined) return record.publishRaster;
  const storagePath = record.storagePath?.trim() ?? '';
  if (storagePath === '') return null;

  // ADR-895 Α2 — ο κάδος αποφασίζεται από την εγγραφή· το PNG ζει ΔΙΠΛΑ στο πρωτότυπο, στον ίδιο κάδο.
  const bucket = fileRecordBucket(record);
  const bytes = dxfBytes ?? (await bucket.file(storagePath).download())[0];

  let state: DxfPublishRaster;
  try {
    const { png, width, height } = await renderPublishRaster(bytes, record.userDrawingUnits);
    await bucket.file(fileCompanionPath(storagePath, 'dxfPublishRaster')).save(png, {
      contentType: 'image/png',
      resumable: false,
      metadata: {
        cacheControl: 'private, max-age=0',
        metadata: { derivedFrom: fileId, source: 'dxf-publish-raster' },
      },
    });
    state = { status: 'ready', width, height, renderedAt: nowISO() };
  } catch (cause) {
    if (!(cause instanceof DxfContentError)) throw cause;
    logger.warn('DXF publish raster: the drawing does not render', { fileId, failure: cause.failure, error: cause.message });
    state = { status: 'failed', failure: cause.failure, failedAt: nowISO() };
  }

  await recordOutcome(adminDb, target, state);
  logger.info('DXF publish raster recorded', { fileId, status: state.status });
  return state;
}
