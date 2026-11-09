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
 *   4. **Εγγραφή αρχείου `ready`**, create-if-absent σε συναλλαγή, + ίχνος `remote_fetch`.
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
import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { judgeContainerFile } from '@/lib/files/container-file-verdict';
import { CONTENT_SIGNATURE_HEAD_BYTES } from '@/lib/files/content-signature';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { placementForNewFile } from '@/lib/files/new-file-placement';
import { peekStreamHead } from '@/lib/files/stream-head';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { OutboundBodyError } from '@/lib/security/outbound-fetch';
import { STREAM_TOO_LARGE_ERROR } from '@/lib/storage/sha256-pass-through';
import { fileStorageBucket } from '@/server/files/file-record-bucket';
import { streamObjectOnce, type MeasuredStream } from '@/server/storage/stream-object-once.server';
import { generateDeterministicFileId } from '@/services/enterprise-id.service';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import { buildPendingFileRecordData } from '@/services/file-record';
import { readyFileRecordData } from '@/services/file-record/ready-file-record.server';
import {
  judgeDownloadedContent,
  judgeDownloadedSize,
  type AcceptedDownload,
  type DownloadedAssetVerdict,
} from '@/subapps/catalog/schema/judge-downloaded-asset';
import type { AssetFetchFailure } from '@/subapps/catalog/vocabulary/asset-fetch';
import { CATALOG_ASSET_MAX_BYTES, MEDIA_CONTENT_STORAGE_CATEGORY } from '@/subapps/catalog/vocabulary/asset-files';
import type { CatalogAssetRole } from '@/subapps/catalog/vocabulary/asset-roles';
import type { AssetKind } from '@/subapps/catalog/vocabulary/attribute-types';

const MEDIA_PLACEMENT = placementForNewFile({ kind: 'catalog-media' });

/** Το πρόθεμα των προσωρινών αντικειμένων — ένα, ώστε ο κύκλος ζωής (Μ-β5) να τα βρίσκει όλα. */
export const CATALOG_MEDIA_STAGING_PREFIX = 'staging/catalog-media';

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
export interface KeptMediaContent {
  readonly fileId: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly kind: AssetKind;
  readonly ext: string;
  readonly contentType: string;
  /** Η εγγραφή αρχείου **υπήρχε ήδη** (ίδιο περιεχόμενο από άλλη διεύθυνση ή παρτίδα). */
  readonly alreadyKept: boolean;
}

export type QuarantineOutcome =
  | { readonly ok: true; readonly content: KeptMediaContent }
  | { readonly ok: false; readonly failure: AssetFetchFailure; readonly params?: Readonly<Record<string, string | number>> };

/**
 * Η εγγραφή περιεχομένου υπάρχει αλλά **δεν** είναι ζωντανή (στον κάδο ανακύκλωσης ή ανολοκλήρωτη). Δεν υιοθετείται αρχείο
 * που πρόκειται να σβηστεί. ⏳ Μ-β5: ο κύκλος ζωής της καραντίνας θα το επαναφέρει αντί να πετά.
 */
export class MediaContentUnavailableError extends Error {
  constructor(readonly fileId: string) {
    super(`Quarantined media content ${fileId} exists but is not live`);
    this.name = 'MediaContentUnavailableError';
  }
}

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
    createdBy: ctx.uid,
    storagePlacement: MEDIA_PLACEMENT,
    fileId: mediaContentFileIdOf(ctx.companyId, measured.sha256, signature.ext),
  });
}

type ContentRecord = ReturnType<typeof contentRecord>;

/** Create-if-absent σε συναλλαγή. `true` ⇒ γεννήθηκε τώρα· υπάρχουσα αλλά όχι ζωντανή ⇒ {@link MediaContentUnavailableError}. */
async function keepRecord(ctx: AuthContext, built: ContentRecord, measured: MeasuredStream): Promise<boolean> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS[FILE_COLLECTION.company]).doc(built.fileId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const verdict = judgeContainerFile(built.fileId, snap.data() ?? null, {
        owner: { kind: 'company', companyId: ctx.companyId },
        entityType: ENTITY_TYPES.CATALOG_MEDIA_CONTENT,
        entityId: measured.sha256,
        contentType: () => true,
      });
      if (verdict.kind !== 'accepted') throw new MediaContentUnavailableError(built.fileId);
      return false;
    }
    tx.create(ref, readyFileRecordData(built, { sizeBytes: measured.size, placement: MEDIA_PLACEMENT, hash: measured.sha256 }));
    return true;
  });
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
    const created = await keepRecord(ctx, built, stored.measured);
    if (created) {
      await recordFileAudit({ fileId: built.fileId, action: 'remote_fetch', performedBy: ctx.uid, companyId: ctx.companyId, metadata: { uri: media.uri } });
    }
    const { signature, kind } = verdict;
    return {
      ok: true,
      content: { fileId: built.fileId, sha256: stored.measured.sha256, sizeBytes: stored.measured.size, kind, ext: signature.ext, contentType: signature.contentType, alreadyKept: !created },
    };
  } catch (error) {
    const failure = transferFailureOf(error);
    if (failure === null) throw error;
    return { ok: false, failure };
  }
}
