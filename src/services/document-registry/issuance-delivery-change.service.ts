/**
 * @fileoverview ADR-915 §45.20 Φ6γ — **η πράξη του μηχανικού** «Αίτημα νέας ημερομηνίας», από τον χώρο της συμμετοχής του.
 * @related lib/document-validity/issuance-delivery-change.ts (η κρίση) · issuance-assignments.server.ts (ο ΕΝΑΣ γραφέας) ·
 *   issuance-engagement-host-adapter.ts (ο ΕΝΑΣ κριτής της συμμετοχής) · app/api/engagements/[engagementId]/issuance/delivery-change
 * @module services/document-registry/issuance-delivery-change.service
 *
 * 🔑 **Ο ΕΝΑΣ δρόμος πράξης μηχανικού** (`writeEngagementIssuanceAction`): δική του ενεργή συμμετοχή, κρίση της μέσα στη
 *    συναλλαγή, ο ίδιος γραφέας και μειωτής με το γραφείο. Εδώ μένει μόνο η πράξη και η ειδοποίηση του γραφείου.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import type { IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import { deliveryChangeTransitionAt } from '@/lib/document-validity/issuance-delivery-change';
import { announceDeliveryChange } from '@/server/issuance-invitations/issuance-delivery-change-notifier';
import { writeEngagementIssuanceAction, type EngagementIssuanceRefusal } from './issuance-engagement-action.server';

export interface DeliveryChangeRequestInput {
  readonly uid: string;
  readonly name: string | null;
  readonly engagementId: string;
  readonly dueOn: string;
  readonly reason: string;
  /** Το στάδιο που **είδε** ο μηχανικός (CAS, όπως το γραφείο). */
  readonly expectedStage: IssuanceStage | null;
  readonly now: Date;
}

/** Οι αρνήσεις του κοινού δρόμου πράξης μηχανικού (`EngagementIssuanceRefusal`). */
export type DeliveryChangeRefusal = EngagementIssuanceRefusal;

export type DeliveryChangeResult =
  | { readonly ok: true; readonly outcome: 'changed' | 'unchanged' }
  | { readonly ok: false; readonly refusal: DeliveryChangeRefusal };

export async function requestIssuanceDeliveryChange(db: Firestore, input: DeliveryChangeRequestInput): Promise<DeliveryChangeResult> {
  const written = await writeEngagementIssuanceAction(db, {
    uid: input.uid, name: input.name, engagementId: input.engagementId, expectedStage: input.expectedStage, now: input.now,
    action: { kind: 'request-delivery-change', dueOn: input.dueOn, reason: input.reason },
  });
  if (!written.ok) return written;
  const { outcome, assignment, registry, companyId } = written;
  if (outcome.outcome === 'changed') {
    await announceDeliveryChange(db, {
      assignmentId: assignment.id, companyId, propertyId: assignment.propertyId, documentKind: assignment.documentKind,
      record: outcome.record, registry, now: input.now,
    }, deliveryChangeTransitionAt(outcome.record, input.now.toISOString()));
  }
  return { ok: true, outcome: outcome.outcome };
}
