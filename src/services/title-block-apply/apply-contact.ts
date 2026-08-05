/**
 * @fileoverview ΜΕΛΕΤΗΤΗΣ → `contact_links` με ρόλο (ADR-745 Φ3β).
 *
 * **Κανένας νέος μηχανισμός.** Ο `linkContactToEntity` είναι ο SSoT σύνδεσης επαφής↔οντότητας
 * (ADR-032), είναι ιδεοδύναμος (ενεργός → skip, ανενεργός → επανενεργοποίηση), χτίζει
 * ντετερμινιστικό id, και η διαδρομή του αποδείχθηκε **άκρη-σε-άκρη** στη Φάση Δ με πραγματικό
 * `company_admin`. Το μόνο που προσθέτει αυτό το αρχείο είναι **η μετάφραση του στόχου**.
 *
 * @module services/title-block-apply/apply-contact
 */

import { linkContactToEntity } from '@/services/contact-link.service';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { BindingTarget } from '@/types/title-block-binding';
import { applyFailed, type ApplyTargetContext, type ApplyTargetResult } from './apply-types';

export async function applyContactTarget(
  target: Extract<BindingTarget, { kind: 'contact' }>,
  ctx: ApplyTargetContext,
): Promise<ApplyTargetResult> {
  const result = await linkContactToEntity({
    companyId: ctx.companyId,
    // Το `sourceWorkspaceId` είναι σήμερα **αχρησιμοποίητο ετικετάκι**: ο tenant ζει στο
    // `companyId` από το ADR-745 §9.1 κι έπειτα, και οι τρεις γραφείς του γράφουν εδώ τρία
    // διαφορετικά πράγματα (§9.2 #1). Δηλώνουμε την πηγή αντί να αντιγράψουμε ένα literal.
    sourceWorkspaceId: COLLECTIONS.TITLE_BLOCK_BINDINGS,
    sourceContactId: target.contactId,
    targetEntityType: 'project',
    targetEntityId: target.projectId,
    role: target.role,
    createdBy: ctx.userId,
    reason: `title-block:${ctx.snapshotValue}`,
  });

  if (!result.success) {
    return applyFailed(result.error ?? 'link failed', result.errorCode ?? 'LINK_FAILED');
  }
  return { success: true, detail: result.linkId };
}
