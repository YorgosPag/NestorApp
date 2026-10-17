/**
 * @fileoverview ADR-915 §27 — **η πράξη** «ανάθεση έκδοσης»: πρόταση · απόφαση ιδιοκτήτη · ενημέρωση · απάντηση ·
 *   ακύρωση, πάνω στην ΜΙΑ ανάθεση (γραφείο, ακίνητο, είδος).
 * @related issuance-assignments.server.ts (I/O) · lib/document-validity/issuance-assignment.ts (ο μειωτής) ·
 *   app/api/document-registry/issuance-assignments/route.ts (το σύνορο)
 * @module services/document-registry/issuance-assignment.service
 *
 * 🔑 **Ο κριτής είναι ο ΙΔΙΟΣ αναγνώστης που έφτιαξε την οθόνη** (`readDocumentRegistry`, όπως η §26 Ζ5): «θέλει αυτή η
 *    γραμμή ανάθεση;», «ποιο είναι το νεότερο έγγραφο;», «ποιος είναι ο υπεύθυνος;» κρίνονται πάνω στην **ίδια** αλήθεια.
 * 🔑 **Η απόφαση ανήκει στον ΥΠΕΥΘΥΝΟ ιδιοκτήτη** (§26): τον βρίσκει ο διακομιστής, **ποτέ** ο πελάτης. Ο πελάτης στέλνει
 *    ποιον **είδε** (`expectedOwnerContactId`)· αν ο υπεύθυνος άλλαξε στο μεταξύ ⇒ `lead-changed`, ποτέ απόφαση στο
 *    όνομα άλλου. Χωρίς υπεύθυνο ⇒ `lead-undesignated` («ορίστε πρώτα υπεύθυνο» — αλλιώς θα αποφάσιζε ένας για όλους
 *    χωρίς βάση, ΑΚ 789).
 * 🔑 **Ο επαγγελματίας είναι επαφή ΤΟΥ μισθωτή** (`readOwnedContactDocs`): ξένη ≡ ανύπαρκτη (ADR-742).
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { issuanceKeyOf } from '@/lib/document-validity/issuance-assignment';
import { issuanceActionOf, type IssuanceAssignmentBody } from '@/lib/document-validity/issuance-request';
import { trimmedStringOrNull } from '@/lib/type-guards';
import { extractContactDisplayName } from '@/server/lib/contact-doc-fields';
import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';
import { readDocumentRegistry } from './document-registry.service';
import type { DocumentRegistryResponse } from './document-registry.types';
import { writeIssuanceAction, type IssuanceWriteOutcome } from './issuance-assignments.server';

export interface IssuanceRequester {
  readonly companyId: string;
  readonly uid: string;
  readonly name: string | null;
}

/**
 * Κάθε άρνηση λέει στον άνθρωπο κάτι διαφορετικό:
 * - `absent`              — η γραμμή δεν θέλει ανάθεση (ή το ακίνητο δεν είναι του γραφείου)
 * - `unavailable`         — ο κατάλογος αναθέσεων δεν διαβάστηκε τώρα
 * - `contact-unavailable` — ο επαγγελματίας δεν είναι επαφή του γραφείου
 * - `lead-undesignated` · `lead-changed` — η απόφαση δεν έχει (πια) τον ίδιο υπεύθυνο
 * - `stale` · `transition-refused` · `unqualified` · `actor-refused` — από τον γραφέα / τον μειωτή
 */
export type IssuanceRefusal =
  | 'absent' | 'unavailable' | 'contact-unavailable' | 'lead-undesignated' | 'lead-changed'
  | Extract<IssuanceWriteOutcome, { ok: false }>['refusal'];

export type IssuanceResult = Extract<IssuanceWriteOutcome, { ok: true }> | { readonly ok: false; readonly refusal: IssuanceRefusal };

type Refused = { readonly ok: false; readonly refusal: IssuanceRefusal };
const refused = (refusal: IssuanceRefusal): Refused => ({ ok: false, refusal });

/**
 * Η απόφαση ανήκει στον **υπεύθυνο** — ο κριτής τον βρίσκει, και ο υπεύθυνος που είδε ο άνθρωπος πρέπει να είναι αυτός.
 * Μετά τον έλεγχο, το αίτημα μεταφράζεται από την ΙΔΙΑ συνάρτηση με την αισιόδοξη οθόνη (`issuanceActionOf`).
 */
function leadRefusalOf(body: IssuanceAssignmentBody, registry: DocumentRegistryResponse): Refused | null {
  if (body.action !== 'decide') return null;
  const refusal = leadRefusalFor(registry, body.propertyId, body.expectedOwnerContactId);
  return refusal === null ? null : refused(refusal);
}

/**
 * **Ο ΕΝΑΣ κριτής του υπευθύνου** (§26 · §27 Η4 · §28): υπάρχει ρητός/παραγόμενος υπεύθυνος, **και** είναι αυτός που είδε
 * ο άνθρωπος. Τον μοιράζονται η καταγραφή απόφασης και η αποστολή συνδέσμου έγκρισης — ποτέ δύο ορισμοί του «ποιος».
 */
export function leadRefusalFor(
  registry: DocumentRegistryResponse,
  propertyId: string,
  expectedOwnerContactId: string | null,
): 'lead-undesignated' | 'lead-changed' | null {
  const lead = registry.properties[propertyId]?.obligorLead ?? null;
  if (lead === null || lead.kind !== 'designated') return 'lead-undesignated';
  return lead.contactId === expectedOwnerContactId ? null : 'lead-changed';
}

/** Ονόματα για το ιστορικό: όσα ξέρει το μητρώο + ο νέος επαγγελματίας (ελεγμένος ως επαφή του μισθωτή). */
async function namesFor(db: Firestore, actor: IssuanceRequester, body: IssuanceAssignmentBody, registry: DocumentRegistryResponse) {
  const names: Record<string, string | null> = Object.fromEntries(Object.entries(registry.people).map(([id, person]) => [id, person.name]));
  if (body.action !== 'propose') return names;
  const contact = (await readOwnedContactDocs(db, actor.companyId, [body.professionalContactId])).get(body.professionalContactId);
  if (contact === undefined) return null;
  return { ...names, [body.professionalContactId]: trimmedStringOrNull(extractContactDisplayName(contact)) };
}

export async function actOnIssuanceAssignment(db: Firestore, actor: IssuanceRequester, body: IssuanceAssignmentBody, now: Date): Promise<IssuanceResult> {
  const registry = await readDocumentRegistry(db, actor.companyId, now);
  if (!registry.issuanceKnown) return refused('unavailable');
  const issuance = registry.issuance[issuanceKeyOf(body.propertyId, body.documentKind)];
  const label = registry.properties[body.propertyId];
  if (issuance === undefined || label === undefined) return refused('absent');
  const leadRefusal = leadRefusalOf(body, registry);
  if (leadRefusal !== null) return leadRefusal;
  const names = await namesFor(db, actor, body, registry);
  if (names === null) return refused('contact-unavailable');
  return writeIssuanceAction(db, {
    companyId: actor.companyId,
    writer: { kind: 'office', uid: actor.uid, name: actor.name, expectedStage: body.expectedStage },
    property: { id: body.propertyId, scope: label.scope, name: label.name },
    documentKind: body.documentKind,
    latestIssuedOn: issuance.latestIssuedOn,
    action: issuanceActionOf(body),
    names,
    nowIso: now.toISOString(),
  });
}
