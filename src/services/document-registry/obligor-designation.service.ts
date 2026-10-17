/**
 * @fileoverview ADR-915 §26 — **η πράξη** «ορισμός υπευθύνου»: ποιος από τους ιδιοκτήτες ενός ακινήτου είναι ο ΕΝΑΣ
 *   υπεύθυνος επικοινωνίας για τα έγγραφα ακινήτου (ΠΕΑ · ταυτότητα κτιρίου).
 * @related obligor-designations.server.ts (I/O) · lib/document-validity/obligor-lead.ts (η αλυσίδα) ·
 *   app/api/document-registry/obligor-designations/route.ts (το σύνορο)
 * @module services/document-registry/obligor-designation.service
 *
 * 🔑 **Ο κριτής είναι ο ΙΔΙΟΣ αναγνώστης που έφτιαξε την οθόνη** (`readDocumentRegistry`): «είναι ιδιοκτήτης;» κρίνεται
 *    πάνω στην **ίδια** αλήθεια που είδε ο άνθρωπος — καμία δεύτερη λογική κυριότητας, καμία εμπιστοσύνη στον πελάτη.
 *    Ακίνητο που δεν είναι στο μητρώο του γραφείου (ξένο · ανύπαρκτο) ≡ `absent` — ποτέ «υπάρχει αλλά όχι δικό σου».
 * 🔑 Η επαναφορά στην αυτόματη επιλογή (`contactId: null`) επιτρέπεται **πάντα** — ακόμη κι όταν οι ιδιοκτήτες δεν
 *    διαβάστηκαν: σβήνει μια παλιά επιλογή, δεν ισχυρίζεται τίποτα για κανέναν.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';

import { readDocumentRegistry } from './document-registry.service';
import { writeObligorDesignation, type ObligorDesignationOutcome } from './obligor-designations.server';

export const obligorDesignationBody = z.object({
  propertyId: z.string().trim().min(1),
  /** `null` = επαναφορά στην αυτόματη επιλογή. */
  contactId: z.string().trim().min(1).nullable(),
});

export type ObligorDesignationBody = z.infer<typeof obligorDesignationBody>;

export interface ObligorDesignationActor {
  readonly companyId: string;
  readonly uid: string;
  readonly name: string | null;
}

/**
 * Κάθε έκβαση λέει στον άνθρωπο κάτι διαφορετικό:
 * - `absent`        — το ακίνητο δεν είναι στο μητρώο **του γραφείου** (ή δεν έχει γραμμή που να ρωτά ιδιοκτήτη)
 * - `owners-unknown`— οι ιδιοκτήτες δεν διαβάστηκαν τώρα ⇒ κανείς δεν κρίνεται «ιδιοκτήτης»
 * - `not-an-owner`  — η επαφή δεν είναι ιδιοκτήτης του ακινήτου
 */
export type ObligorDesignationResult =
  | { readonly ok: true; readonly outcome: ObligorDesignationOutcome }
  | { readonly ok: false; readonly refusal: 'absent' | 'owners-unknown' | 'not-an-owner' };

export async function designateRegistryObligor(
  db: Firestore,
  actor: ObligorDesignationActor,
  body: ObligorDesignationBody,
  now: Date,
): Promise<ObligorDesignationResult> {
  const registry = await readDocumentRegistry(db, actor.companyId, now);
  const label = registry.properties[body.propertyId];
  if (label === undefined) return { ok: false, refusal: 'absent' };
  if (body.contactId !== null) {
    if (label.ownerContactIds === null) return { ok: false, refusal: 'owners-unknown' };
    if (!label.ownerContactIds.includes(body.contactId)) return { ok: false, refusal: 'not-an-owner' };
  }
  const names = Object.fromEntries(Object.entries(registry.people).map(([id, person]) => [id, person.name]));
  const outcome = await writeObligorDesignation(db, {
    companyId: actor.companyId,
    actorUid: actor.uid,
    actorName: actor.name,
    property: { id: body.propertyId, scope: label.scope, name: label.name },
    nextContactId: body.contactId,
    names,
    nowIso: now.toISOString(),
  });
  return { ok: true, outcome };
}
