import 'server-only';

/**
 * =============================================================================
 * ΤΑ PDF ΤΩΝ ΕΚΔΟΣΕΩΝ: λήψη · δέσμευση · διάθεση (ADR-923 §5.6.1)
 * =============================================================================
 *
 * Η κρίση ζει στο `publication-retention.ts`. Εδώ η πράξη, και η **σειρά** κάθε βήματος είναι η εγγύηση (ίδιο πρότυπο με ADR-864 §20):
 *
 * - **Λήψη**: `temporaryHold` πρώτα, μετά η καταγραφή, μετά τα bytes. Από την πρώτη λήψη η ίδια η πλατφόρμα αρνείται τη διαγραφή,
 *   ό,τι λάθος κι αν κάνει ο κώδικάς μας. Αν η διάθεση προλάβει, το hold αποτυγχάνει και δεν σερβίρεται τίποτα.
 * - **Διάθεση**: διαγραφή στον κάδο **πριν** από την ταφόπλακα. Αν ο κάδος αρνηθεί, η εγγραφή δεν λέει ψέματα.
 * - **Άρση δέσμευσης**: η εγγραφή πρώτα, το hold μετά, ώστε σάρωση στο ενδιάμεσο να σκοντάψει στο hold.
 *
 * 🔑 **Όχι GCS Retention `Locked`, σκόπιμα**: θέλει object retention στον κάδο, που το ADR-864 ανέβαλε επειδή ο κάδος είναι κοινός
 *    με την ανάπτυξη, και είναι μη αναστρέψιμο. Ένας κατάλογος δεν είναι νόμιμο τεκμήριο τύπου WORM: ένα λάθος PDF πρέπει να σβήνεται.
 * ⚠️ Ο ίδιος γραφέας της συλλογής μένει το `publication-run.server.ts` (`changePublicationRun`).
 * @module server/catalog/publishing/publication-retention.server
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import {
  canDeletePublicationByHand,
  canHoldPublication,
  priceVersionEndedAt,
  publicationHeldByPlatform,
  PUBLICATION_RETENTION_RULE,
  publicationRetentionStepOf,
  publicationRunOf,
  retentionPatch,
} from '@/subapps/catalog/publishing/publication-retention';
import type { CatalogIssueCode } from '@/subapps/catalog/schema/catalog-issues';
import type { PublicationDisposalCause } from '@/subapps/catalog/types/publication';
import { assertNoIssues } from '../catalog-write-error';
import { readListVersionsSnapshot } from '../price-version-reads.server';
import { publicationBucket } from './publication-bucket.server';
import { changePublicationRun, readOwnedPublicationRun, type StoredPublicationRun } from './publication-run.server';

const logger = createModuleLogger('CatalogPublicationRetention');

/** Ο δράστης στο ιστορικό — ίδιο σχήμα με `system:cron-purge`. */
export const PUBLICATION_RETENTION_ACTOR = 'system:cron-publication-retention';

function refuse(code: CatalogIssueCode): never {
  assertNoIssues([{ code, path: 'retention' }]);
  throw new Error(code);
}

async function setArtifactHolds(run: StoredPublicationRun, held: boolean): Promise<void> {
  await Promise.all(run.artifacts.map((artifact) => publicationBucket().file(artifact.storagePath).setMetadata({ temporaryHold: held })));
}

/** Βάζει την κράτηση της πλατφόρμας **πριν** από την εγγραφή που θα τη χρειαστεί (λήψη · δέσμευση · δημοσίευση). */
export function placeArtifactHolds(run: StoredPublicationRun): Promise<void> {
  return setArtifactHolds(run, true);
}

/**
 * Φέρνει την κράτηση της πλατφόρμας στην κατάσταση που λέει **η εγγραφή** (`publicationHeldByPlatform`, ο ένας κριτής). Καλείται
 * **μετά** από κάθε εγγραφή που μπορεί να αφαιρέσει λόγο κράτησης (άρση δέσμευσης · απόσυρση έκδοσης · αποτυχημένη δημοσίευση).
 * Η άρση γίνεται μόνο αν δεν μένει κανένας λόγος, ώστε κανένα σημείο να μη λύνει κράτηση που κρατά κάποιο άλλο.
 */
export async function syncArtifactHolds(run: StoredPublicationRun): Promise<void> {
  if (run.retention.disposal !== null) return;
  await setArtifactHolds(run, publicationHeldByPlatform(run));
}

/** Το hold φεύγει πρώτα, αλλιώς η πλατφόρμα αρνείται. Αντικείμενο που λείπει ⇒ η προηγούμενη προσπάθεια έφτασε ως εδώ. */
async function deleteArtifacts(run: StoredPublicationRun): Promise<void> {
  await Promise.all(run.artifacts.map(async (artifact) => {
    const file = publicationBucket().file(artifact.storagePath);
    const [exists] = await file.exists();
    if (!exists) return;
    await file.setMetadata({ temporaryHold: false });
    await file.delete({ ignoreNotFound: true });
  }));
}

/** Καλείται **πριν** σερβιριστούν bytes. Κάθε λήψη γράφεται στο ιστορικό με τον δράστη της. */
export async function recordPublicationDownload(ctx: AuthContext, run: StoredPublicationRun): Promise<void> {
  if (run.retention.downloadCount === 0) await setArtifactHolds(run, true);
  await changePublicationRun(run.id, ctx.uid, (current) => retentionPatch(current, {
    downloadCount: current.retention.downloadCount + 1,
    firstDownloadedAt: current.retention.firstDownloadedAt ?? nowISO(),
  }));
}

async function dispose(run: StoredPublicationRun, cause: PublicationDisposalCause, disposedBy: string): Promise<StoredPublicationRun | null> {
  await deleteArtifacts(run);
  const disposal = { disposedAt: nowISO(), disposedBy, cause, ruleId: PUBLICATION_RETENTION_RULE.id };
  return changePublicationRun(run.id, disposedBy, (current) => retentionPatch(current, { disposal }));
}

async function ownedRun(ctx: AuthContext, id: string): Promise<StoredPublicationRun> {
  return (await readOwnedPublicationRun(ctx, id)) ?? refuse('unknownReference');
}

/** Η χειροκίνητη διαγραφή: μόνο ό,τι δεν έφτασε σε κανέναν. */
export async function deletePublicationPdf(ctx: AuthContext, id: string): Promise<StoredPublicationRun | null> {
  const run = await ownedRun(ctx, id);
  if (!canDeletePublicationByHand(run)) refuse('publicationNotDeletable');
  return dispose(run, 'manual', ctx.uid);
}

/** Τοποθέτηση: το hold στην πλατφόρμα πρώτα, η εγγραφή μετά. Ο λόγος της πρώτης δέσμευσης δεν αντικαθίσταται ποτέ σιωπηλά. */
export async function placePublicationLegalHold(ctx: AuthContext, id: string, reason: string): Promise<StoredPublicationRun | null> {
  const run = await ownedRun(ctx, id);
  if (!canHoldPublication(run)) refuse('publicationNotHoldable');
  if (run.retention.legalHold !== null) refuse('publicationAlreadyOnHold');
  await setArtifactHolds(run, true);
  const legalHold = { placedBy: ctx.uid, placedAt: nowISO(), reason };
  return changePublicationRun(id, ctx.uid, (current) => retentionPatch(current, { legalHold }));
}

/** Άρση: το hold της πλατφόρμας μένει αν το κρατά άλλος λόγος (λήψη, δημοσίευση σε κοινό) — το κρίνει ο ένας κριτής. */
export async function releasePublicationLegalHold(ctx: AuthContext, id: string): Promise<StoredPublicationRun | null> {
  const run = await ownedRun(ctx, id);
  if (run.retention.legalHold === null) return run;
  const released = await changePublicationRun(id, ctx.uid, (current) => retentionPatch(current, { legalHold: null }));
  if (released !== null) await syncArtifactHolds(released);
  return released;
}

async function versionEndOf(db: Firestore, run: StoredPublicationRun): Promise<string | null> {
  if (run.priceVersion === null) return null;
  const versions = await readListVersionsSnapshot(db, run.companyId, run.priceVersion.priceListId);
  return priceVersionEndedAt(versions, run.priceVersion.priceListVersionId);
}

type SweepOutcome = 'kept' | 'deferred' | 'disposed' | 'failed';

async function stepRun(db: Firestore, run: StoredPublicationRun, now: string): Promise<SweepOutcome> {
  const step = publicationRetentionStepOf(run, await versionEndOf(db, run), now);
  if (step.kind === 'keep') return 'kept';
  if (step.kind === 'defer') {
    await changePublicationRun(run.id, PUBLICATION_RETENTION_ACTOR, () => ({ dispositionDueAt: step.dueAt }));
    return 'deferred';
  }
  await dispose(run, 'schedule', PUBLICATION_RETENTION_ACTOR);
  return 'disposed';
}

export type PublicationRetentionReport = Readonly<Record<SweepOutcome, number>> & { readonly considered: number };

/** Ένα πέρασμα. Ό,τι αποτύχει μένει με την ίδια προθεσμία και ξανακρίνεται στο επόμενο: ο κάδος που αρνείται δεν είναι σφάλμα κρίσης. */
export async function runPublicationRetention(db: Firestore = getAdminFirestore(), limit: number, now: string = nowISO()): Promise<PublicationRetentionReport> {
  // tenant-scope-exempt: εργασία συστήματος (cron) — ο κανόνας διατήρησης είναι ο ίδιος σε κάθε χώρο.
  const snap = await db.collection(COLLECTIONS.CATALOG_PUBLICATION_RUNS).where('dispositionDueAt', '<=', now).limit(limit).get();
  const counts: Record<SweepOutcome, number> = { kept: 0, deferred: 0, disposed: 0, failed: 0 };
  for (const doc of snap.docs) {
    const run = publicationRunOf(doc.data() as StoredPublicationRun);
    const outcome = await stepRun(db, run, now).catch((cause: unknown): SweepOutcome => {
      logger.error('Publication disposal failed', { runId: run.id, error: cause instanceof Error ? cause.message : String(cause) });
      return 'failed';
    });
    counts[outcome] += 1;
  }
  return { considered: snap.size, ...counts };
}
