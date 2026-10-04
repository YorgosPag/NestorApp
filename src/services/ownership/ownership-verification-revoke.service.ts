/**
 * @module services/ownership/ownership-verification-revoke.service
 * @description **Η ΑΝΑΚΛΗΣΗ μιας επαλήθευσης κατοχής** (ADR-900 §8 #2, Β3) — ο **ένας** γραφέας του `revoked`.
 *
 * Δύο πόρτες, μία πράξη:
 * - **διαχειριστής** (`super_admin`, ουρά `/admin/ownership-verifications`): λόγος από το κλειστό σύνολο, από
 *   `verified` **ή** `superseded` (μια παλιά απόδειξη μπορεί να αποδειχθεί πλαστή αργότερα)·
 * - **ο ίδιος ο κάτοχος** (σχήμα Zillow «unclaim»): λόγος πάντα `owner-request`, μόνο τη **δική** του `verified`.
 *
 * 🔑 **ΜΙΑ συναλλαγή** πάνω στις **ίδιες** κλειδαριές με την επαλήθευση (`ownership-claim-locks.ts`):
 * κατάσταση + κλειδαριές + (όταν έπεσε η τελευταία βεβαίωση) δημόσια μονάδα `historical`. Ίχνος και ειδοποίηση
 * **μετά**, ποτέ μέσα (δεν αναιρούν μια γραμμένη απόφαση).
 *
 * Ο λόγος κρίνει τη μονάδα (UPRN · Zillow): `ownership-ended`/`owner-request` λένε «άλλαξε ο άνθρωπος», όχι
 * «δεν υπάρχει το σπίτι» ⇒ η μονάδα μένει. Καμία αυτόματη επαναφορά προηγούμενου κατόχου (Google Business
 * Profile): αν θέλει, ξαναϋποβάλλει.
 */

import 'server-only';

import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { readReleaseLocks, releaseClaimLocks } from './ownership-claim-locks';
import { announceOwnershipDecision } from './ownership-decision-notifier.service';
import { recordVerificationAudit } from './ownership-verification-record';
import type {
  OwnershipRevocationReason,
  OwnershipVerification,
  OwnershipVerificationStatus,
} from '@/types/ownership-verification';

/** Ποιος ανακαλεί — η πόρτα **κρίνει** τι επιτρέπεται. */
export type RevocationActor =
  | { readonly kind: 'admin'; readonly uid: string }
  | { readonly kind: 'owner'; readonly uid: string };

export interface RevokeInput {
  readonly verificationId: string;
  readonly actor: RevocationActor;
  readonly reason: OwnershipRevocationReason;
  readonly note: string | null;
  readonly nowIso: string;
}

export type RevokeOutcome =
  | { readonly kind: 'revoked'; readonly unitRetired: boolean }
  | { readonly kind: 'refused'; readonly reason: 'not-found' | 'not-revocable' | 'reason-not-allowed' };

type RevokeResult = {
  readonly outcome: RevokeOutcome;
  readonly record: OwnershipVerification | null;
  /** Η κατάσταση **πριν** — για το ίχνος (`verified`/`superseded` → `revoked`). */
  readonly previous: OwnershipVerificationStatus | null;
};

const refused = (reason: Extract<RevokeOutcome, { kind: 'refused' }>['reason']): RevokeResult => ({
  outcome: { kind: 'refused', reason },
  record: null,
  previous: null,
});

/** Τι επιτρέπει η κάθε πόρτα — καθαρό, ελέγξιμο χωρίς Firestore. */
export function revocationRefusal(
  record: Pick<OwnershipVerification, 'uid' | 'status'>,
  actor: RevocationActor,
  reason: OwnershipRevocationReason,
): Extract<RevokeOutcome, { kind: 'refused' }>['reason'] | null {
  if (actor.kind === 'owner') {
    if (reason !== 'owner-request') return 'reason-not-allowed';
    // Ξένη απόδειξη = «δεν υπάρχει» για τον κάτοχο: η απάντηση δεν μαρτυρά ότι υπάρχει.
    if (record.uid !== actor.uid) return 'not-found';
    return record.status === 'verified' ? null : 'not-revocable';
  }
  if (reason === 'owner-request') return 'reason-not-allowed';
  return record.status === 'verified' || record.status === 'superseded' ? null : 'not-revocable';
}

async function applyRevocation(db: AdminFirestore, tx: Transaction, input: RevokeInput): Promise<RevokeResult> {
  const ref = db.collection(COLLECTIONS.OWNERSHIP_VERIFICATIONS).doc(input.verificationId);
  const snap = await tx.get(ref);
  if (!snap.exists) return refused('not-found');
  const current = snap.data() as OwnershipVerification;
  const refusal = revocationRefusal(current, input.actor, input.reason);
  if (refusal !== null) return refused(refusal);

  const locks = await readReleaseLocks(db, tx, current, input.reason);
  const revoked: OwnershipVerification = {
    ...current,
    status: 'revoked',
    decidedAt: input.nowIso,
    decidedBy: input.actor.uid,
    reviewNote: input.note,
    revocationReason: input.reason,
  };
  const { unitRetired } = releaseClaimLocks(tx, locks, input.nowIso);
  tx.set(ref, revoked);
  return {
    outcome: { kind: 'revoked', unitRetired },
    record: revoked,
    previous: current.status,
  };
}

/** Η ανάκληση — ΜΙΑ συναλλαγή· ίχνος + ειδοποίηση μετά. */
export async function revokeOwnershipVerification(db: AdminFirestore, input: RevokeInput): Promise<RevokeOutcome> {
  const result = await db.runTransaction((tx) => applyRevocation(db, tx, input));
  if (result.record !== null) {
    await recordVerificationAudit(result.record, result.previous);
    await announceOwnershipDecision(db, result.record);
  }
  return result.outcome;
}
