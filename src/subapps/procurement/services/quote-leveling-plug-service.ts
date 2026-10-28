/**
 * **Ο ΕΝΑΣ γραφέας** του `Quote.levelingPlugs` (ADR-327 §8.5 — BuildingConnected «plug»): ο PM ορίζει/αφαιρεί το ποσό
 * που καλύπτει ένα κενό ΑΥΤΗΣ της προσφοράς σε μια γραμμή RFQ.
 *
 * - **Συναλλαγή**: ανάγνωση-μεταβολή-εγγραφή του πίνακα — δύο PM σε διαφορετικές γραμμές δεν σβήνουν ο ένας τον άλλον.
 * - **Φράχτης**: ίδια εταιρεία (`requireOwnedSnapshot`) · η γραμμή ανήκει στο RFQ της προσφοράς (ο ΕΝΑΣ αναγνώστης
 *   `readRfqLines`) — ξένο id = σφάλμα, ποτέ «ορφανή» κάλυψη.
 * - **Ιδεμποτικό** (`upsertLevelingPlug`): ίδια τιμή ⇒ καμία εγγραφή, καμία γραμμή ιστορικού.
 * - **Ιστορικό**: `leveling_plug_set` / `leveling_plug_cleared` στο `auditTrail` της προσφοράς + entity audit (ADR-195).
 * - Η σύγκριση ξαναϋπολογίζεται μόνη της: το `useComparison` ακούει τις αλλαγές των προσφορών.
 *
 * @module subapps/procurement/services/quote-leveling-plug-service
 * @enterprise ADR-327 §8.5
 */

import 'server-only';

import admin from 'firebase-admin';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { EntityAuditService } from '@/services/entity-audit.service';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import type { AuthContext } from '@/lib/auth';
import type { Quote, QuoteAuditEntry, QuoteLevelingPlug } from '../types/quote';
import { PROCUREMENT_RESOURCE, requireOwnedSnapshot } from './procurement-owned-doc';
import { getRfq } from './rfq-service';
import { readRfqLines } from './rfq-line-service';
import { describePlugValue, upsertLevelingPlug, type LevelingPlugChange } from '../utils/leveling-plugs';

/** Η γραμμή RFQ πρέπει να ανήκει στο RFQ ΑΥΤΗΣ της προσφοράς. */
async function assertRfqLine(ctx: AuthContext, rfqId: string | null, rfqLineId: string): Promise<void> {
  const rfq = rfqId ? await getRfq(ctx.companyId, rfqId) : null;
  if (!rfq) throw new Error('Quote is not linked to an RFQ: leveling plugs need RFQ lines');
  const lines = await readRfqLines(rfq);
  if (!lines.some((l) => l.id === rfqLineId)) throw new Error(`RFQ line ${rfqLineId} does not belong to RFQ ${rfqId}`);
}

function plugAudit(uid: string, change: LevelingPlugChange, previous: QuoteLevelingPlug | null): QuoteAuditEntry {
  return {
    timestamp: admin.firestore.Timestamp.now(),
    userId: uid,
    action: change.amount === null ? 'leveling_plug_cleared' : 'leveling_plug_set',
    previousValue: `${change.rfqLineId}:${describePlugValue(previous)}`,
    newValue: `${change.rfqLineId}:${change.amount === null ? '—' : describePlugValue({ amount: change.amount })}`,
    source: 'system',
    ip: null,
  };
}

export async function setQuoteLevelingPlug(
  ctx: AuthContext,
  quoteId: string,
  change: LevelingPlugChange,
): Promise<QuoteLevelingPlug[]> {
  return safeFirestoreOperation(async (db) => {
    const ref = db.collection(COLLECTIONS.QUOTES).doc(quoteId);
    const subject = { resource: PROCUREMENT_RESOURCE.QUOTE, resourceId: quoteId } as const;
    const peek = requireOwnedSnapshot<Quote>(await ref.get(), ctx.companyId, subject);
    await assertRfqLine(ctx, peek.rfqId, change.rfqLineId);

    const result = await db.runTransaction(async (tx) => {
      const current = requireOwnedSnapshot<Quote>(await tx.get(ref), ctx.companyId, subject);
      const now = admin.firestore.Timestamp.now();
      const upsert = upsertLevelingPlug(current.levelingPlugs ?? [], change, { setBy: ctx.uid, setAt: now });
      if (!upsert.changed) return { ...upsert, displayNumber: current.displayNumber };
      tx.update(ref, sanitizeForFirestore({
        levelingPlugs: upsert.plugs,
        auditTrail: [...(current.auditTrail ?? []), plugAudit(ctx.uid, change, upsert.previous)],
        updatedAt: now,
      }));
      return { ...upsert, displayNumber: current.displayNumber };
    });

    if (result.changed) {
      safeFireAndForget(EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.QUOTE,
        entityId: quoteId,
        entityName: `#${result.displayNumber}`,
        action: 'updated',
        changes: [{
          field: `levelingPlugs.${change.rfqLineId}`,
          oldValue: result.previous?.amount ?? null,
          newValue: change.amount,
        }],
        performedBy: ctx.uid,
        performedByName: null,
        companyId: ctx.companyId,
      }), 'quote-leveling-plug-service.set');
    }
    return result.plugs;
  });
}
