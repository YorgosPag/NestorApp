/**
 * @fileoverview ADR-915 §35 — **η πράξη** «απόφαση μόνιμης υποχρέωσης»: ο άνθρωπος επιβεβαιώνει (ή εξαιρεί με λόγο) ότι
 *   αυτό το ακίνητο οφείλει να έχει σε ισχύ αυτό το έγγραφο όσο ζει.
 * @related upkeep-declarations.server.ts (I/O) · lib/document-validity/property-upkeep.ts (πρόταση · απαίτηση) ·
 *   app/api/document-registry/upkeep-declarations/route.ts (το σύνορο) · obligor-designation.service.ts (το ιδίωμα)
 * @module services/document-registry/upkeep-declaration.service
 *
 * 🔑 **Ο κριτής είναι ο ΕΝΑΣ κριτής υποκειμένου** (`readUpkeepSubject`, §36) — τα ΙΔΙΑ κατηγορήματα «του γραφείου;» με το
 *    μητρώο, χωρίς το όριο ανάγνωσής του: ακίνητο ξένο · ανύπαρκτο ≡ `absent` (ποτέ «υπάρχει αλλά όχι δικό σου»)·
 *    στο αρχείο ή στον κάδο ≡ `retired`. (Μέχρι το §36 ο κριτής ήταν όλο το `readDocumentRegistry`.)
 * 🔑 **Η πρόταση την υπολογίζει ο διακομιστής** (`upkeepProposalOf` πάνω στην κλάση + φάση που διάβασε), ποτέ ο πελάτης:
 *    το ίχνος «τι πρότεινε η εφαρμογή» δεν γίνεται να το γράψει όποιος στέλνει το αίτημα.
 * 🔑 Ο νόμος αποφασίζει ποιο είδος είναι μόνιμη υποχρέωση (`standingObligation`), όχι το αίτημα ⇒ `not-standing`.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { documentKindSpec } from '@/config/document-validity/document-validity';
import { upkeepProposalOf } from '@/lib/document-validity/property-upkeep';
import type { UpkeepDeclarationBody, UpkeepDeclarationRefusal } from '@/lib/document-validity/upkeep-declaration-request';
import { readUpkeepSubject, upkeepSubjectOf } from './upkeep-subject.server';
import { writeUpkeepDeclaration, type UpkeepDeclarationOutcome } from './upkeep-declarations.server';

export interface UpkeepDeclarationActor {
  readonly companyId: string;
  readonly uid: string;
  readonly name: string | null;
}

export type UpkeepDeclarationResult =
  | { readonly ok: true; readonly outcome: UpkeepDeclarationOutcome }
  | { readonly ok: false; readonly refusal: UpkeepDeclarationRefusal };

export async function declareRegistryUpkeep(
  db: Firestore,
  actor: UpkeepDeclarationActor,
  body: UpkeepDeclarationBody,
  now: Date,
): Promise<UpkeepDeclarationResult> {
  if (documentKindSpec(body.documentKind).standingObligation === null) return { ok: false, refusal: 'not-standing' };
  const subject = await readUpkeepSubject(db, actor.companyId, body.propertyId);
  if (subject.kind !== 'subject') return { ok: false, refusal: subject.kind };
  const { property } = subject;
  const outcome = await writeUpkeepDeclaration(db, {
    companyId: actor.companyId,
    actorUid: actor.uid,
    actorName: actor.name,
    property: { id: property.id, scope: property.scope, name: property.name },
    documentKind: body.documentKind,
    next: body.decision === null ? null : { decision: body.decision, exemptionReason: body.exemptionReason },
    proposal: upkeepProposalOf(body.documentKind, upkeepSubjectOf(property)),
    nowIso: now.toISOString(),
  });
  return { ok: true, outcome };
}
