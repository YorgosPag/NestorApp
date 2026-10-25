import 'server-only';

/**
 * @fileoverview **Η ΑΠΟΔΕΙΞΗ ΑΠΟ ΤΟ SOFT DELETE** — γραμμή καθολικού χωρίς sha256, όπου ούτε αντίγραφο ούτε πηγή κρατούν
 *               πια τα bytes: επαναφορά → μέτρηση → επαναδιαγραφή (ADR-916 Φ-Δ.7β · Ο13β (ii)).
 * @related server/storage/soft-deleted-object.server.ts (το ΕΝΑ σημείο soft delete) · handover-delivery-ledger.server.ts
 *          (ο εντοπιστής `sourceObject` + το ημερολόγιο `recovery`) · handover-delivery-hash.server.ts (ο καλών)
 * @module server/property-handover-delivery/handover-delivery-recovery.server
 *
 * 🔑 **Κρατάμε την απόδειξη, όχι το περιεχόμενο** (Google Vault / Purview preservation hold): ό,τι σβήστηκε **μένει**
 *    σβησμένο. Η επαναφορά υπάρχει **μόνο** επειδή ένα soft-deleted αντικείμενο δεν διαβάζεται· η γενιά που γεννήσαμε
 *    ξανασβήνεται αμέσως μετά τη μέτρηση. Μένει μόνο το sha256, με ειλικρινή προέλευση `restored-source`.
 * 🔴 **Ποτέ ξένα bytes**: (α) η soft-deleted γενιά πρέπει να είναι **η** `sourceGeneration` της γραμμής, με το crc32c και το
 *    μέγεθός της· (β) επαναφορά μόνο σε **κενό** όνομα· (γ) μετριέται και ξανασβήνεται **μόνο** η γενιά που καταγράψαμε.
 * 🛡️ **Δίχτυ κρασαρίσματος**: η γενιά γράφεται στο ημερολόγιο αμέσως μετά την επαναφορά — κάθε επόμενη εκτέλεση
 *    ολοκληρώνει (`resume`). Κρασάρισμα **ανάμεσα** σε επαναφορά και ημερολόγιο ⇒ υιοθεσία: ζωντανό αντικείμενο με ίδια
 *    bytes, γεννημένο **μετά** τη μίσθωση εκείνης της εκτέλεσης, είναι δικό μας.
 */

import type { Bucket, File } from '@google-cloud/storage';

import { fileStorageBucket } from '@/server/files/file-record-bucket';
import { sha256OfStoredObject } from '@/server/storage/object-sha256.server';
import { statObjects } from '@/server/storage/placement-copy';
import { deleteLiveGeneration, restoreIntoVacantName, statSoftDeleted } from '@/server/storage/soft-deleted-object.server';

import type { HandoverCopyContext } from './handover-delivery-copy.server';
import { releaseOrphanedSourceBytes } from './handover-delivery-orphan-release.server';
import {
  claimDeliveryRecovery,
  recordDeliverySha256,
  recordRecoveryRestored,
  settleDeliveryRecovery,
  type HandoverLedgerProof,
  type HandoverSourceObject,
} from './handover-delivery-ledger.server';

export type HandoverRecoveryContext = Pick<HandoverCopyContext, 'adminDb' | 'handover'>;

/** Ανοχή ρολογιού ανάμεσα στον διακομιστή (μίσθωση) και στο GCS (`timeCreated`) — για την υιοθεσία μόνο. */
const CLOCK_SKEW_MS = 5 * 60_000;

/** Η μία ανάκτηση που εξετάζεται: γραμμή + πού + ποια γενιά. */
interface RecoveryTarget {
  readonly row: HandoverLedgerProof;
  readonly located: HandoverSourceObject;
  readonly bucket: Bucket;
}

const sameBytes = (file: File, row: HandoverLedgerProof): boolean =>
  file.metadata.crc32c === row.crc32c && Number(file.metadata.size) === row.size;

async function liveObject(target: RecoveryTarget): Promise<File | null> {
  const [file] = await statObjects(target.bucket, [target.located.path]);
  return file ?? null;
}

/** Το sha256 της γενιάς που επαναφέραμε — **μόνο** αν είναι ακόμη αυτή και κρατά τα bytes της γραμμής. */
async function proveRestored(ctx: HandoverRecoveryContext, target: RecoveryTarget, generation: string): Promise<string | null> {
  const live = await liveObject(target);
  if (live === null || String(live.metadata.generation) !== generation || !sameBytes(live, target.row)) return null;
  const measured = await sha256OfStoredObject(live);
  if (measured.kind !== 'hashed') return null;
  const { sourceFileId, crc32c, size } = target.row;
  const written = await recordDeliverySha256(ctx.adminDb, ctx.handover.id, { sourceFileId, crc32c, size, sha256: measured.sha256, origin: 'restored-source' });
  return written.kind === 'hashed' ? written.sha256 : null;
}

/** Μέτρηση (αν χρειάζεται) → επαναδιαγραφή **μόνο** της δικής μας γενιάς → κλείσιμο ημερολογίου. */
async function finishRestored(ctx: HandoverRecoveryContext, target: RecoveryTarget, generation: string): Promise<string | null> {
  const sha256 = target.row.sha256 ?? (await proveRestored(ctx, target, generation));
  // `changed` ⇒ κάποιος ξανάγραψε το όνομα μετά από εμάς — δεν είναι πια δικό μας, δεν αγγίζεται.
  await deleteLiveGeneration(target.bucket, target.located.path, generation);
  await settleDeliveryRecovery(ctx.adminDb, ctx.handover.id, target.row.sourceFileId);
  // Ο24 — ΜΕΤΑ το κλείσιμο της ανάκτησης (ποτέ όσο ζει η γενιά που επαναφέραμε): ορφανή πηγή ⇒ στον sweeper.
  if (sha256 !== null) await releaseOrphanedSourceBytes(ctx.adminDb, ctx.handover.id, target.row.sourceFileId);
  return sha256;
}

/** Υιοθεσία μετά από κρασάρισμα ανάμεσα σε επαναφορά και ημερολόγιο — η γενιά, ή `null` αν το ζωντανό δεν είναι δικό μας. */
async function adoptedGeneration(target: RecoveryTarget, since: string): Promise<string | null> {
  const live = await liveObject(target);
  if (live === null || !sameBytes(live, target.row) || String(live.metadata.generation) === target.row.sourceGeneration) return null;
  const created = Date.parse(String(live.metadata.timeCreated ?? ''));
  return Number.isFinite(created) && created >= Date.parse(since) - CLOCK_SKEW_MS ? String(live.metadata.generation) : null;
}

/** Η επαναφορά — μόνο αν η soft-deleted γενιά είναι **αυτή** της γραμμής· η νέα γενιά καταγράφεται **πριν** τη μέτρηση. */
async function restoreAndProve(ctx: HandoverRecoveryContext, target: RecoveryTarget, sourceGeneration: string): Promise<string | null> {
  const deleted = await statSoftDeleted(target.bucket, target.located.path, sourceGeneration);
  if (deleted === null || !sameBytes(deleted, target.row)) {
    await settleDeliveryRecovery(ctx.adminDb, ctx.handover.id, target.row.sourceFileId);
    return null;
  }
  const outcome = await restoreIntoVacantName(target.bucket, target.located.path, sourceGeneration);
  if (outcome.kind === 'absent') await settleDeliveryRecovery(ctx.adminDb, ctx.handover.id, target.row.sourceFileId);
  // `live-exists` ⇒ ζωντανό ξένο αντικείμενο: τίποτα· η μίσθωση λήγει και ξαναδοκιμάζεται αργότερα.
  if (outcome.kind !== 'restored') return null;
  // Γενιά από την ΑΠΑΝΤΗΣΗ του GCS — ποτέ από νέα ανάγνωση του ονόματος (ίσως το έγραψε άλλος στο μεταξύ). Χωρίς αυτήν:
  // πετά, και η επόμενη εκτέλεση υιοθετεί (ίδια bytes, γεννημένο μετά τη μίσθωση) ή αφήνει.
  if (outcome.generation === null) throw new Error(`Restore of ${target.located.path} returned no generation`);
  await recordRecoveryRestored(ctx.adminDb, ctx.handover.id, target.row.sourceFileId, outcome.generation);
  return finishRestored(ctx, target, outcome.generation);
}

/**
 * **Ανακτά την απόδειξη μιας γραμμής από το soft delete** — το sha256 που γράφτηκε, ή `null`. Καλείται για γραμμή που
 * **αποδεδειγμένα** δεν έχει υποψήφια (όχι σφάλμα δικτύου), **και** για γραμμή με ανοιχτό ημερολόγιο (δίχτυ). Πετά σε βλάβη:
 * το ημερολόγιο μένει ανοιχτό και η επόμενη εκτέλεση συνεχίζει από εκεί.
 */
export async function recoverDeliveredRow(ctx: HandoverRecoveryContext, row: HandoverLedgerProof): Promise<string | null> {
  const located = row.sourceObject;
  if (located === null || row.sourceGeneration === null) return null;
  const target: RecoveryTarget = { row, located, bucket: fileStorageBucket(located.placement) };
  const claim = await claimDeliveryRecovery(ctx.adminDb, ctx.handover.id, row.sourceFileId);
  if (claim.kind === 'resume') return finishRestored(ctx, target, claim.restoredGeneration);
  if (claim.kind !== 'claimed') return null;
  const adopted = claim.adoptSince === null ? null : await adoptedGeneration(target, claim.adoptSince);
  if (adopted === null) return restoreAndProve(ctx, target, row.sourceGeneration);
  await recordRecoveryRestored(ctx.adminDb, ctx.handover.id, row.sourceFileId, adopted);
  return finishRestored(ctx, target, adopted);
}

/** Ανοιχτό ημερολόγιο με γενιά που γεννήσαμε — π.χ. το sha256 γράφτηκε από άλλη υποψήφια πριν την επαναδιαγραφή. */
export const hasOpenRecovery = (row: HandoverLedgerProof): boolean =>
  row.recovery !== null && row.recovery.settledAt === null && row.recovery.restoredGeneration !== null;
