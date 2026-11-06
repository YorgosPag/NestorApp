/**
 * @fileoverview **Ο ΕΝΑΣ γραφέας του κατόχου ευκαιρίας** (ADR-930 §3.8).
 * @module services/crm/opportunity-owner-transfer.server
 *
 * Μετά τη δημιουργία, το `assignedTo` το γράφει **μόνο** αυτό το αρχείο: οι κανόνες κλειδώνουν το πεδίο για τον
 * πελάτη (`OWNER_OWNED_FIELDS`) και το `PATCH /api/opportunities/[id]` το αρνείται. Η πόρτα είναι το
 * `POST /api/opportunities/[id]/owner`, και την ισοτιμία τη φυλά η CHECK 3.114 (Κ7).
 *
 * 🔑 **Ο νέος κάτοχος είναι ΕΝΕΡΓΟ μέλος του χώρου της ευκαιρίας** — ανάγνωση του βιβλίου μελών μέσα στην **ίδια**
 *    συναλλαγή (Salesforce: «ο νέος κάτοχος πρέπει να έχει πρόσβαση»). Πριν, ο ανατεθειμένος μπορούσε να τη δώσει σε
 *    uid **άλλης εταιρείας**.
 * 🔑 CAS στον αναμενόμενο κάτοχο + ιδεμπότητα: ο κανόνας `planOwnerTransfer` (καθαρός).
 * 🔑 Ιστορικό **μετά** το commit, με **ονόματα** (όχι uid) · ειδοποίηση στον νέο κάτοχο — και τα δύο δεν πετούν.
 * ⚠️ Φράχτης μισθωτή **και** εξουσία `transfer` (`requireOpportunityAccess`) είναι ευθύνη του route, **πριν**.
 */

import 'server-only';

import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { versionedWrite } from '@/lib/firestore/version-check';
import { isActiveWorkspaceMemberInTx } from '@/lib/workspace/active-member-in-transaction';
import { recordEntityUpdate } from '@/services/audit/record-entity-update';
import { announceOpportunityOwnerTransfer } from './opportunity-owner-notifier';
import { opportunityAuditResolvers } from './opportunity-audit-resolvers.server';
import {
  OWNER_HANDOFF_NOTE_FIELD,
  planOwnerTransfer,
  type OwnerTransferInvalidReason,
  type OwnerTransferRequest,
} from './opportunity-owner-transfer';

export interface OwnerTransferWrite {
  readonly opportunityId: string;
  readonly request: OwnerTransferRequest;
  readonly ctx: AuthContext;
}

export type OwnerTransferOutcome =
  | { readonly kind: 'unchanged'; readonly ownerUid: string }
  | { readonly kind: 'applied'; readonly ownerUid: string; readonly previousOwnerUid: string | null }
  | { readonly kind: 'conflict'; readonly currentOwnerUid: string | null }
  | { readonly kind: 'invalid'; readonly reason: OwnerTransferInvalidReason | 'owner_not_member' | 'no_tenant' };

interface Committed {
  readonly outcome: OwnerTransferOutcome;
  readonly before?: Readonly<Record<string, unknown>>;
  readonly written?: Readonly<Record<string, unknown>>;
  readonly note?: string | null;
  readonly version?: number;
}

const textOrNull = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

async function commitTransfer(db: Firestore, write: OwnerTransferWrite): Promise<Committed> {
  const ref = db.collection(COLLECTIONS.OPPORTUNITIES).doc(write.opportunityId);
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const before: Readonly<Record<string, unknown>> = snapshot.data() ?? {};
    const companyId = textOrNull(before.companyId);
    // Legacy έγγραφο (χωρίς εταιρεία): δεν υπάρχει βιβλίο μελών για να επαληθευτεί ο νέος κάτοχος ⇒ όχι μαντεψιά.
    if (companyId === null) return { outcome: { kind: 'invalid', reason: 'no_tenant' } };

    const plan = planOwnerTransfer(
      { companyId, createdBy: textOrNull(before.createdBy), assignedTo: textOrNull(before.assignedTo) },
      write.request,
    );
    if (plan.kind === 'invalid' || plan.kind === 'conflict') return { outcome: plan };
    if (plan.kind === 'unchanged') return { outcome: { kind: 'unchanged', ownerUid: plan.ownerUid } };

    if (!(await isActiveWorkspaceMemberInTx(tx, db, companyId, plan.newOwnerUid))) {
      return { outcome: { kind: 'invalid', reason: 'owner_not_member' } };
    }

    // Το σημείωμα ζει στο έγγραφο ως **το τελευταίο** — κενό ⇒ σβήνεται, ώστε να μη μείνει μπαγιάτικο.
    const set = { assignedTo: plan.newOwnerUid, [OWNER_HANDOFF_NOTE_FIELD]: plan.note ?? FieldValue.delete() };
    const versioned = versionedWrite(before, set, write.ctx.uid);
    tx.update(ref, versioned.data);
    return {
      outcome: { kind: 'applied', ownerUid: plan.newOwnerUid, previousOwnerUid: plan.previousOwnerUid },
      before,
      written: { assignedTo: plan.newOwnerUid, [OWNER_HANDOFF_NOTE_FIELD]: plan.note },
      note: plan.note,
      version: versioned.newVersion,
    };
  });
}

/** Δίνει την ευκαιρία στον νέο κάτοχο — ή λέει γιατί όχι. */
export async function applyOpportunityOwnerTransfer(db: Firestore, write: OwnerTransferWrite): Promise<OwnerTransferOutcome> {
  const committed = await commitTransfer(db, write);
  const { outcome, before, written, version } = committed;
  if (outcome.kind !== 'applied' || !before || !written || version === undefined) return outcome;

  await recordEntityUpdate({
    entityType: 'opportunity',
    entityId: write.opportunityId,
    before,
    written,
    ctx: write.ctx,
    entityName: textOrNull(before.title),
    resolvers: opportunityAuditResolvers(db, textOrNull(before.companyId) ?? write.ctx.companyId),
  });
  await announceOpportunityOwnerTransfer({
    opportunityId: write.opportunityId,
    opportunityTitle: textOrNull(before.title) ?? textOrNull(before.fullName),
    companyId: textOrNull(before.companyId) ?? write.ctx.companyId,
    newOwnerUid: outcome.ownerUid,
    actorUid: write.ctx.uid,
    note: committed.note ?? null,
    version,
  });
  return outcome;
}
