import 'server-only';

/**
 * =============================================================================
 * ΓΡΑΦΕΑΣ ΕΓΓΡΑΦΗΣ ΠΕΡΙΕΧΟΜΕΝΟΥ ΚΑΡΑΝΤΙΝΑΣ — γέννηση · υιοθέτηση · ΕΠΑΝΑΦΟΡΑ · ΑΝΑΓΕΝΝΗΣΗ (ADR-934 §5.2.2 Μ-β5)
 * =============================================================================
 *
 * Το `fileId` του περιεχομένου είναι ντετερμινιστικό, άρα η εγγραφή του **επιστρέφει**: πριν το Μ-β5, ίδια bytes μετά από κάδο ή
 * εκκαθάριση έδιναν **για πάντα** `contentUnavailable` (η εγγραφή υπήρχε, αλλά όχι ζωντανή). Εδώ κάθε κατάσταση του κριτή
 * (`mediaContentStateOf`) έχει **δηλωμένη** πράξη, σε συναλλαγή:
 *   - `trashed` ⇒ **επαναφορά** (`fileRestoreFields` — ίδια πεδία με την επαναφορά ανθρώπου) · ίχνος `restore`
 *   - `purged`  ⇒ **αναγέννηση** πάνω στο επιτύμβιο, με τα bytes που μόλις προήχθησαν · ίχνος `remote_fetch`
 *   - `foreign` ⇒ {@link MediaContentUnavailableError} — ποτέ δεν ξαναγράφεται εγγραφή που δεν είναι δική μας.
 *
 * 🏆 Πάνω από τους μεγάλους: ο κάδος του Drive/Box επαναφέρει μόνο με χέρι ανθρώπου· εδώ **η ίδια η ζήτηση** των ίδιων bytes
 *   επαναφέρει — και με 304 (`restoreTrashedMediaContent`) **χωρίς** να κατέβει ούτε byte.
 *
 * @module server/catalog/media-content-revival.server
 */

import type { DocumentReference } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_LIFECYCLE_STATES } from '@/config/file-lifecycle-states';
import type { AuthContext } from '@/lib/auth';
import { fileRestoreFields } from '@/lib/files/file-trash-fields';
import { isSystemSpaceEntityType, systemSpaceActorOf } from '@/lib/files/system-file-space';
import { FieldValue, getAdminFirestore } from '@/lib/firebaseAdmin';
import { fileRecordBucket } from '@/server/files/file-record-bucket';
import { statObjects } from '@/server/storage/placement-copy';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import { mediaContentStateOf, type MediaContentState } from '@/subapps/catalog/import/media-content-state';

/** Η εγγραφή περιεχομένου υπάρχει αλλά **δεν** είναι δική μας (άλλος χώρος · άλλα bytes · αλλοιωμένη). Ποτέ υιοθέτηση. */
export class MediaContentUnavailableError extends Error {
  constructor(readonly fileId: string) {
    super(`Quarantined media content ${fileId} exists but is not ours`);
    this.name = 'MediaContentUnavailableError';
  }
}

/** Τι έγινε στην εγγραφή — ονομασμένο, ποτέ boolean. */
export type KeptContentOutcome = 'created' | 'kept' | 'restored' | 'reborn';

type Data = Readonly<Record<string, unknown>>;

/**
 * Η εγγραφή περιεχομένου ζει στον **χώρο συστήματος** (Μ-β6, `lib/files/system-file-space.ts`) — όχι στο `files` του ανθρώπου:
 * καμία λίστα, κάδος ή αναζήτηση χρήστη δεν τη βλέπει. Ο **ένας** δείκτης για revival · καραντίνα · αποδέσμευση.
 */
export const mediaContentFileRef = (fileId: string): DocumentReference =>
  getAdminFirestore().collection(COLLECTIONS.FILES_SYSTEM).doc(fileId);

/** Η κατάσταση του περιεχομένου **αυτού του χώρου**, για αυτά τα bytes. */
export const mediaContentStateIn = (ctx: AuthContext, fileId: string, sha256: string, data: Data | null): MediaContentState =>
  mediaContentStateOf({ companyId: ctx.companyId, fileId, sha256 }, data);

/**
 * Τα πεδία επαναφοράς, με δράστη τον **διαχειριστή του χώρου** που δηλώνει η ίδια η εγγραφή (ADR-934 §5.2.2 Μ-β7) — ποτέ το uid
 * του ανθρώπου: εκείνος γράφεται στο ίχνος (`auditKept`). Καλείται μόνο σε κατάσταση `trashed`, όπου ο κριτής έχει ήδη επιβεβαιώσει
 * τον τύπο· άγνωστος τύπος εδώ = αλλοιωμένη εγγραφή ⇒ άρνηση, ποτέ εφεδρεία στον άνθρωπο.
 */
function restoreFieldsFor(fileId: string, data: Data | null): Record<string, unknown> {
  const entityType = data?.entityType;
  if (!isSystemSpaceEntityType(entityType)) throw new MediaContentUnavailableError(fileId);
  return fileRestoreFields({ activeState: FILE_LIFECYCLE_STATES.ACTIVE, by: systemSpaceActorOf(entityType), now: FieldValue.serverTimestamp() });
}

/** Το ίχνος της πράξης — **μετά** τη γραφή· η υιοθέτηση ζωντανού δεν γράφει τίποτα. */
async function auditKept(ctx: AuthContext, fileId: string, outcome: KeptContentOutcome, uri: string): Promise<void> {
  if (outcome === 'kept') return;
  const action = outcome === 'restored' ? 'restore' : 'remote_fetch';
  await recordFileAudit({ fileId, action, performedBy: ctx.uid, companyId: ctx.companyId, metadata: { uri, revival: outcome } });
}

export interface KeepContentRequest {
  readonly fileId: string;
  readonly sha256: string;
  /** Η **πλήρης** έτοιμη εγγραφή — για γέννηση ή αναγέννηση. */
  readonly record: Record<string, unknown>;
  /** Για το ίχνος. */
  readonly uri: string;
}

/**
 * **Κράτα την εγγραφή των bytes που μόλις προήχθησαν** — create-if-absent, ή επαναφορά, ή αναγέννηση, σε μία συναλλαγή.
 * Τα bytes υπάρχουν ήδη στο κλειδί τους (`streamObjectOnce`), άρα καμία κατάσταση δεν οδηγεί σε εγγραφή χωρίς αντικείμενο.
 */
export async function keepMediaContentRecord(ctx: AuthContext, request: KeepContentRequest): Promise<KeptContentOutcome> {
  const ref = mediaContentFileRef(request.fileId);
  const outcome = await getAdminFirestore().runTransaction(async (tx): Promise<KeptContentOutcome> => {
    const data = (await tx.get(ref)).data() ?? null;
    const state = mediaContentStateIn(ctx, request.fileId, request.sha256, data);
    switch (state) {
      case 'live': return 'kept';
      case 'trashed': tx.update(ref, restoreFieldsFor(request.fileId, data)); return 'restored';
      case 'purged': tx.set(ref, request.record); return 'reborn';
      case 'absent': tx.create(ref, request.record); return 'created';
      case 'foreign': throw new MediaContentUnavailableError(request.fileId);
    }
  });
  await auditKept(ctx, request.fileId, outcome, request.uri);
  return outcome;
}

/** Τα bytes της εγγραφής είναι ακόμη στη θέση τους; — η εγγραφή στον κάδο δεν εγγυάται ότι κανείς δεν τα έσβησε. */
async function bytesStillThere(data: Data): Promise<boolean> {
  const storagePath = typeof data.storagePath === 'string' ? data.storagePath : null;
  if (storagePath === null) return false;
  const [found] = await statObjects(fileRecordBucket(data), [storagePath]);
  return found !== undefined;
}

/**
 * **304 πάνω σε περιεχόμενο στον κάδο** ⇒ επαναφορά χωρίς λήψη. `true` ⇒ το περιεχόμενο είναι πλέον ζωντανό· `false` ⇒ δεν
 * επαναφέρθηκε (εκκαθαρίστηκε στο μεταξύ · χάθηκαν τα bytes · ξένο) και ο καλών **κατεβάζει ξανά**, ποτέ ψεύτικο «έτοιμο».
 */
export async function restoreTrashedMediaContent(ctx: AuthContext, fileId: string, sha256: string, uri: string): Promise<boolean> {
  const ref = mediaContentFileRef(fileId);
  const before = (await ref.get()).data() ?? null;
  const state = mediaContentStateIn(ctx, fileId, sha256, before);
  if (state !== 'trashed' || before === null) return state === 'live';
  if (!(await bytesStillThere(before))) return false;
  const restored = await getAdminFirestore().runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data() ?? null;
    const now = mediaContentStateIn(ctx, fileId, sha256, data);
    if (now === 'trashed') tx.update(ref, restoreFieldsFor(fileId, data));
    return now === 'trashed' ? 'restored' : now;
  });
  if (restored === 'restored') await auditKept(ctx, fileId, 'restored', uri);
  return restored === 'restored' || restored === 'live';
}
