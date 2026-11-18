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
import { deliveryChangeTransitionAt } from '@/lib/document-validity/issuance-delivery-change';
import { issuanceActionOf, type IssuanceAssignmentBody } from '@/lib/document-validity/issuance-request';
import { trimmedStringOrNull } from '@/lib/type-guards';
import { announceDeliveryChange } from '@/server/issuance-invitations/issuance-delivery-change-notifier';
import { engageApprovedProfessional } from '@/server/issuance-invitations/issuance-space-invite';
import { extractContactDisplayName } from '@/server/lib/contact-doc-fields';
import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';
import { readDocumentRegistry } from './document-registry.service';
import { announceOfficeMoneyAction, announceOfficeObjection, orderMoneyBeforeOfficeAction, settleAfterOfficeAction } from './issuance-advance-office-money.server';
import type { DocumentRegistryResponse } from './document-registry.types';
import { issuanceAssignmentIdOf } from './issuance-assignment-schema';
import { writeIssuanceAction, type IssuanceWriteOutcome } from './issuance-assignments.server';
import { officeLedger } from './issuance-ledger';

export interface IssuanceRequester {
  readonly companyId: string;
  readonly uid: string;
  readonly name: string | null;
}

/**
 * Κάθε άρνηση λέει στον άνθρωπο κάτι διαφορετικό:
 * - `absent`              — η γραμμή δεν θέλει ανάθεση (ή το ακίνητο δεν είναι του γραφείου)
 * - `unavailable`         — ο κατάλογος αναθέσεων δεν διαβάστηκε τώρα
 * - `contact-unavailable` — ο επαγγελματίας (ή ο υπεύθυνος αυτοψίας, §45.15) δεν είναι επαφή του γραφείου
 * - `lead-undesignated` · `lead-changed` — η απόφαση δεν έχει (πια) τον ίδιο υπεύθυνο
 * - `stale` · `transition-refused` · `unqualified` · `actor-refused` — από τον γραφέα / τον μειωτή
 * - `settlement-busy`     — ADR-943 Φ5γ: κρατημένα χρήματα κινούνται αυτή τη στιγμή· τίποτα δεν γράφτηκε, ξαναδοκιμάστε
 */
export type IssuanceRefusal =
  | 'absent' | 'unavailable' | 'contact-unavailable' | 'lead-undesignated' | 'lead-changed' | 'settlement-busy'
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

/** Η **νέα** επαφή που φέρνει η πράξη — ο επαγγελματίας (§27) ή ο υπεύθυνος αυτοψίας (§45.15)· `null` = καμία. */
function contactBroughtBy(body: IssuanceAssignmentBody): string | null {
  if (body.action === 'propose') return body.professionalContactId;
  if (body.action === 'set-inspection-contact') return body.contactId;
  return null;
}

/** Ονόματα για το ιστορικό: όσα ξέρει το μητρώο + η νέα επαφή της πράξης (ελεγμένη ως επαφή του μισθωτή). */
async function namesFor(db: Firestore, actor: IssuanceRequester, body: IssuanceAssignmentBody, registry: DocumentRegistryResponse) {
  const names: Record<string, string | null> = Object.fromEntries(Object.entries(registry.people).map(([id, person]) => [id, person.name]));
  const contactId = contactBroughtBy(body);
  if (contactId === null) return names;
  const contact = (await readOwnedContactDocs(db, actor.companyId, [contactId])).get(contactId);
  if (contact === undefined) return null;
  return { ...names, [contactId]: trimmedStringOrNull(extractContactDisplayName(contact)) };
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
  // ADR-943 Φ5γ (Θ-3) — ακύρωση / απόφαση διαφοράς: πρώτα η εντολή χρημάτων της εγγραφής όπως θα είναι, μετά το γεγονός.
  const money = await orderMoneyBeforeOfficeAction(db, { companyId: actor.companyId, uid: actor.uid, body, latestIssuedOn: issuance.latestIssuedOn, now });
  if (money?.kind === 'busy') return refused('settlement-busy');
  const result = await writeIssuanceAction(db, {
    ledger: officeLedger(actor.companyId),
    writer: { kind: 'office', uid: actor.uid, name: actor.name, expectedStage: body.expectedStage },
    property: { id: body.propertyId, scope: label.scope, name: label.name },
    documentKind: body.documentKind,
    latestIssuedOn: issuance.latestIssuedOn,
    action: issuanceActionOf(body),
    names,
    nowIso: now.toISOString(),
  });
  await engageOnRecordedApproval(db, actor, body, result, now);
  if (result.ok && result.outcome === 'changed' && money !== null) {
    // Πρώτα τα λόγια (πάνω στην εγγραφή της πράξης — ό,τι θα κινηθεί), μετά τα χρήματα.
    await announceOfficeMoneyAction(db, { companyId: actor.companyId, body, record: result.record, registry, uid: actor.uid, now });
    await settleAfterOfficeAction(db, money, now);
  }
  if (result.ok && result.outcome === 'changed') {
    // ADR-943 Φ5δ (Ζ-3) — αντίρρηση για λογαριασμό του ιδιοκτήτη ⇒ η ίδια ειδοποίηση με του συνδέσμου (ποτέ δεν πετά).
    await announceOfficeObjection(db, { companyId: actor.companyId, body, record: result.record, registry, uid: actor.uid, now });
    // §45.20 Φ6γ — νέα ημερομηνία ή απόρριψη που απάντησε σε αίτημα του μηχανικού ⇒ ο μηχανικός μαθαίνει (ποτέ δεν πετά).
    await announceDeliveryChange(db, {
      assignmentId: issuanceAssignmentIdOf(actor.companyId, body.propertyId, body.documentKind),
      companyId: actor.companyId, propertyId: body.propertyId, documentKind: body.documentKind,
      record: result.record, registry, now,
    }, deliveryChangeTransitionAt(result.record, now.toISOString()));
  }
  return result;
}

/**
 * §42 — η **καταγεγραμμένη** έγκριση της προσφοράς είναι η ανάθεση, όπως και η έγκριση με σύνδεσμο: η ΙΔΙΑ πόρτα
 * πρόσκλησης στον χώρο (§39). Μετά την εγγραφή, ποτέ δεν πετά — η κάρτα δείχνει «δεν έχει σταλεί» με κουμπί αποστολής.
 */
async function engageOnRecordedApproval(db: Firestore, actor: IssuanceRequester, body: IssuanceAssignmentBody, result: IssuanceResult, now: Date): Promise<void> {
  if (body.action !== 'decide' || !result.ok || result.outcome !== 'changed' || result.stage !== 'accepted') return;
  await engageApprovedProfessional(db, actor, { propertyId: body.propertyId, documentKind: body.documentKind }, now);
}
