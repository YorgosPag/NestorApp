import 'server-only';

/**
 * =============================================================================
 * ΚΑΡΑΝΤΙΝΑ ΜΕΣΩΝ ΑΠΟ ΔΙΕΥΘΥΝΣΗ — ροή → κρίση → αρχείο με κλειδί από το περιεχόμενο (ADR-934 §5.2.2 Μ-β3)
 * =============================================================================
 *
 * Ο **ΕΝΑΣ** γραφέας αρχείων `catalog_media_content`. Παίρνει το σώμα μιας λήψης (`fetchGuardedStream`) και:
 *   1. **Πρώτα bytes → κρίση** (`judgeDownloadedContent`): HTML · άγνωστο · λάθος είδος · σύγκρουση τύπου ⇒ απόρριψη και
 *      **ακύρωση** της ροής, χωρίς να κατέβει το υπόλοιπο. Πάνω από τους μεγάλους (Akeneo/Salsify κατεβάζουν πρώτα).
 *   2. **Ροή στον κάδο** (`streamObjectOnce`) με όριο το μέγιστο του **είδους** — όχι του ρόλου: μετά τα πρώτα bytes το
 *      είδος είναι γνωστό, άρα το όριο στενεύει (μια εικόνα κόβεται στα 200 MiB, όχι στα 500 του BIM).
 *   3. **Μέγεθος → κρίση** (`judgeDownloadedSize`, ίδιο `judgeAssetUpload` με το ανέβασμα) **πριν** την προαγωγή ⇒ κανένα
 *      ορφανό αντικείμενο στο τελικό κλειδί.
 *   4. **Εγγραφή αρχείου `ready`** μέσω του `media-content-revival`: γέννηση · υιοθέτηση · επαναφορά από τον κάδο ·
 *      αναγέννηση πάνω σε επιτύμβιο (Μ-β5) — σε συναλλαγή, με ίχνος.
 *
 * 🔑 **Κάτοχος = το περιεχόμενο** (`entityId` = sha256), `fileId` = ντετερμινιστικό από (χώρος, sha256, κατάληξη) ⇒ ίδιο
 *   αρχείο από δύο διευθύνσεις ή δύο παρτίδες = **ένα** αρχείο, δομικά ιδεμπότητο. Η κατάληξη μπαίνει στην ταυτότητα γιατί
 *   μπαίνει στο κλειδί αποθήκευσης: τα ίδια bytes με άλλη ερμηνεία (`.zip` / `.docx`) είναι άλλο αρχείο.
 * 🔑 **Θέση = ΕΕ** (`placementForNewFile({ kind: 'catalog-media' })`, ADR-895 Ε1).
 * ⛔ **Δεν δένει τίποτα σε μέσο** (Μ-δ: αντίγραφο) και **δεν** γράφει την ταυτότητα της διεύθυνσης (`media-source.server`).
 *
 * @module server/catalog/media-quarantine.server
 */

import { ENTITY_TYPES, FILE_DOMAINS } from '@/config/domain-constants';
import { filenameFromUrl } from '@/config/file-types/classification-registry';
import type { AuthContext } from '@/lib/auth';
import { CONTENT_SIGNATURE_HEAD_BYTES } from '@/lib/files/content-signature';
import { placementForNewFile } from '@/lib/files/new-file-placement';
import { systemSpaceActorOf } from '@/lib/files/system-file-space';
import { peekStreamHead } from '@/lib/files/stream-head';
import { OutboundBodyError } from '@/lib/security/outbound-fetch';
import { STREAM_TOO_LARGE_ERROR } from '@/lib/storage/sha256-pass-through';
import { fileStorageBucket } from '@/server/files/file-record-bucket';
import { streamObjectOnce, type MeasuredStream } from '@/server/storage/stream-object-once.server';
import { generateDeterministicFileId } from '@/services/enterprise-id.service';
import { buildPendingFileRecordData } from '@/services/file-record';
import { readyFileRecordData } from '@/services/file-record/ready-file-record.server';
import {
  judgeDownloadedContent,
  judgeDownloadedSize,
  type AcceptedDownload,
  type DownloadedAssetVerdict,
} from '@/subapps/catalog/schema/judge-downloaded-asset';
import { CATALOG_MEDIA_STAGING_PREFIX, type AssetFetchFailure } from '@/subapps/catalog/vocabulary/asset-fetch';
import { assetKindAcceptsFile, CATALOG_ASSET_MAX_BYTES, MEDIA_CONTENT_STORAGE_CATEGORY } from '@/subapps/catalog/vocabulary/asset-files';
import type { CatalogAssetRole } from '@/subapps/catalog/vocabulary/asset-roles';
import { ASSET_KINDS, type AssetKind } from '@/subapps/catalog/vocabulary/attribute-types';
import type { MediaContentFacts } from '@/subapps/catalog/types/catalog-media';
import { keepMediaContentRecord, mediaContentFileRef, mediaContentStateIn } from './media-content-revival.server';

const MEDIA_PLACEMENT = placementForNewFile({ kind: 'catalog-media' });

/** Το σώμα μιας λήψης και ό,τι δήλωσε ο τρίτος γι' αυτό. */
export interface DownloadedMedia {
  readonly role: CatalogAssetRole;
  /** Το **κανονικό** URI. */
  readonly uri: string;
  /** Το `AttachmentFilename` του xChange, αν δόθηκε. */
  readonly filename: string | null;
  /** Το `Content-Type` της απάντησης. */
  readonly contentType: string | null;
  /** Ο καλών το έχει ήδη πάρει από το `fetchGuardedStream`· εδώ διαβάζεται **ή** ακυρώνεται, πάντα. */
  readonly body: ReadableStream<Uint8Array>;
  /** Μοναδικό ανά προσπάθεια (π.χ. id λήψης + αριθμός προσπάθειας) — δίνει το προσωρινό κλειδί. */
  readonly attemptKey: string;
}

/** Το περιεχόμενο που κρατήθηκε. */
export interface KeptMediaContent extends MediaContentFacts {
  /** Η εγγραφή αρχείου **υπήρχε ήδη** (ίδιο περιεχόμενο από άλλη διεύθυνση ή παρτίδα). */
  readonly alreadyKept: boolean;
}

export type QuarantineOutcome =
  | { readonly ok: true; readonly content: KeptMediaContent }
  | { readonly ok: false; readonly failure: AssetFetchFailure; readonly params?: Readonly<Record<string, string | number>> };

/** Το `fileId` του περιεχομένου — ντετερμινιστικό: ίδιος χώρος + ίδια bytes + ίδια κατάληξη ⇒ ίδιο αρχείο. */
export function mediaContentFileIdOf(companyId: string, sha256: string, ext: string): string {
  return generateDeterministicFileId(`catalog-media:${companyId}:${sha256}:${ext}`);
}

const stagingPathOf = (companyId: string, attemptKey: string): string => `${CATALOG_MEDIA_STAGING_PREFIX}/${companyId}/${attemptKey}`;

/** Σφάλμα της ροής που είναι **αποτυχία λήψης** (όριο · σιωπή της πηγής) — κάθε άλλο είναι βλάβη και πετιέται. */
function transferFailureOf(error: unknown): AssetFetchFailure | null {
  if (error instanceof OutboundBodyError) return error.code === 'too_large' ? 'tooLarge' : 'timeout';
  if (error instanceof Error && error.message === STREAM_TOO_LARGE_ERROR) return 'tooLarge';
  return null;
}

const refusalOf = (verdict: Extract<DownloadedAssetVerdict, { ok: false }>): QuarantineOutcome =>
  verdict.params ? { ok: false, failure: verdict.failure, params: verdict.params } : { ok: false, failure: verdict.failure };

function contentRecord(ctx: AuthContext, media: DownloadedMedia, accepted: AcceptedDownload, measured: MeasuredStream) {
  const { kind, signature } = accepted;
  const named = media.filename ?? filenameFromUrl(media.uri);
  return buildPendingFileRecordData({
    companyId: ctx.companyId,
    entityType: ENTITY_TYPES.CATALOG_MEDIA_CONTENT,
    entityId: measured.sha256,
    domain: FILE_DOMAINS.CATALOG,
    category: MEDIA_CONTENT_STORAGE_CATEGORY[kind],
    originalFilename: named !== '' ? named : `${measured.sha256}.${signature.ext}`,
    contentType: signature.contentType,
    ext: signature.ext,
    // 🔑 Μ-β7: ο διαχειριστής του χώρου, ποτέ ο άνθρωπος — εκείνος γράφεται στο ίχνος (`media-content-revival` · `auditKept`).
    createdBy: systemSpaceActorOf(ENTITY_TYPES.CATALOG_MEDIA_CONTENT),
    storagePlacement: MEDIA_PLACEMENT,
    fileId: mediaContentFileIdOf(ctx.companyId, measured.sha256, signature.ext),
  });
}

type ContentRecord = ReturnType<typeof contentRecord>;

const textField = (data: Readonly<Record<string, unknown>>, key: string): string | null => (typeof data[key] === 'string' ? (data[key] as string) : null);

/** Το είδος από τον τύπο του αρχείου: οι οικογένειες του `ASSET_KIND_FILE_CATEGORIES` δεν επικαλύπτονται, άρα ταιριάζει **ένα**. */
const kindOfKept = (ext: string, contentType: string): AssetKind | null =>
  ASSET_KINDS.find((kind) => assetKindAcceptsFile(kind, { ext, contentType }) === 'accepted') ?? null;

/** Περιεχόμενο που κρατιέται: ζωντανό, ή στον κάδο αλλά **ανακτήσιμο** (Μ-β5: επαναφέρεται αν ο τρίτος απαντήσει 304). */
export interface KeptMediaRecord {
  readonly state: 'live' | 'trashed';
  readonly content: MediaContentFacts;
}

/**
 * **Το περιεχόμενο σε καραντίνα, αν κρατιέται ακόμη** — για το conditional GET (304: τίποτα δεν κατεβαίνει, άρα ό,τι λέμε
 * για το αρχείο πρέπει να βγει από την εγγραφή του). Επιτύμβιο · ξένο · αλλοιωμένο ⇒ `null`, και ο καλών κατεβάζει ξανά.
 */
export async function readKeptMediaContent(ctx: AuthContext, fileId: string, sha256: string): Promise<KeptMediaRecord | null> {
  const data = (await mediaContentFileRef(fileId).get()).data() ?? null;
  const state = mediaContentStateIn(ctx, fileId, sha256, data);
  if (data === null || (state !== 'live' && state !== 'trashed')) return null;
  const ext = textField(data, 'ext');
  const contentType = textField(data, 'contentType');
  const sizeBytes = typeof data.sizeBytes === 'number' ? data.sizeBytes : null;
  const kind = ext !== null && contentType !== null ? kindOfKept(ext, contentType) : null;
  if (ext === null || contentType === null || sizeBytes === null || kind === null) return null;
  return { state, content: { fileId, sha256, sizeBytes, kind, ext, contentType } };
}

/** Ροή → κρίση μεγέθους → προαγωγή. Επιστρέφει την εγγραφή που αντιστοιχεί στα bytes, ή την άρνηση του μεγέθους. */
interface StoreDecision {
  built: ContentRecord | null;
  sizeRefusal: DownloadedAssetVerdict | null;
}

async function storeContent(ctx: AuthContext, media: DownloadedMedia, accepted: AcceptedDownload, body: ReadableStream<Uint8Array>) {
  const decision: StoreDecision = { built: null, sizeRefusal: null };
  const stored = await streamObjectOnce({
    bucket: fileStorageBucket(MEDIA_PLACEMENT),
    stagingPath: stagingPathOf(ctx.companyId, media.attemptKey),
    body,
    contentType: accepted.signature.contentType,
    maxBytes: CATALOG_ASSET_MAX_BYTES[accepted.kind],
    destinationOf: (measured) => {
      decision.sizeRefusal = judgeDownloadedSize(accepted, measured.size);
      if (decision.sizeRefusal !== null) return null;
      decision.built = contentRecord(ctx, media, accepted, measured);
      return decision.built.storagePath;
    },
  });
  return { stored, ...decision };
}

/** Πρώτα bytes → κρίση. Απόρριψη ⇒ η ροή ακυρώνεται εδώ (η σύνδεση με τον τρίτο κλείνει). */
async function judgeHead(media: DownloadedMedia): Promise<{ verdict: DownloadedAssetVerdict; stream: ReadableStream<Uint8Array> }> {
  const { head, stream } = await peekStreamHead(media.body, CONTENT_SIGNATURE_HEAD_BYTES);
  const verdict = judgeDownloadedContent({ role: media.role, head, uri: media.uri, filename: media.filename, contentType: media.contentType });
  if (!verdict.ok) await stream.cancel().catch(() => undefined);
  return { verdict, stream };
}

/**
 * **Κράτα το περιεχόμενο μιας λήψης σε καραντίνα** — ή πες με κωδικό γιατί όχι. Βλάβες (κάδος · βάση) πετιούνται· μόνο ό,τι
 * είναι ιδιότητα του αρχείου ή της μεταφοράς γίνεται κωδικός (Μ9).
 */
export async function quarantineDownloadedMedia(ctx: AuthContext, media: DownloadedMedia): Promise<QuarantineOutcome> {
  try {
    const { verdict, stream } = await judgeHead(media);
    if (!verdict.ok) return refusalOf(verdict);
    const { stored, built, sizeRefusal } = await storeContent(ctx, media, verdict, stream);
    if (sizeRefusal !== null && !sizeRefusal.ok) return refusalOf(sizeRefusal);
    if (stored.kind === 'declined' || built === null) throw new Error('Media content was declined without a size verdict');
    const record = readyFileRecordData(built, { sizeBytes: stored.measured.size, placement: MEDIA_PLACEMENT, hash: stored.measured.sha256 });
    const kept = await keepMediaContentRecord(ctx, { fileId: built.fileId, sha256: stored.measured.sha256, record, uri: media.uri });
    const { signature, kind } = verdict;
    return {
      ok: true,
      content: { fileId: built.fileId, sha256: stored.measured.sha256, sizeBytes: stored.measured.size, kind, ext: signature.ext, contentType: signature.contentType, alreadyKept: kept !== 'created' },
    };
  } catch (error) {
    const failure = transferFailureOf(error);
    if (failure === null) throw error;
    return { ok: false, failure };
  }
}
