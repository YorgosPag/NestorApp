import 'server-only';

/**
 * @fileoverview ADR-915 §28 Η-Β7 — **το πρόχειρο** ενός μηνύματος ανάθεσης: σε ποιον πάει, ποιοι συνιδιοκτήτες μπορούν να
 *   ενημερωθούν, τι ακριβώς θα γράφει. Το διαβάζουν **και** η προεπισκόπηση **και** η αποστολή — ό,τι είδε ο άνθρωπος
 *   είναι ό,τι φεύγει.
 * @related issuance-invitation-send.ts (η αποστολή) · services/email-templates/issuance-invitation-email.ts (ο συνθέτης)
 * @module server/issuance-invitations/issuance-invitation-draft
 *
 * 🔑 **Ο κριτής είναι ο ΙΔΙΟΣ αναγνώστης που έφτιαξε την οθόνη** (`readDocumentRegistry`): ποιος είναι ο υπεύθυνος,
 *    ποιοι οι συνιδιοκτήτες, σε ποιο στάδιο είναι η ανάθεση — μία αλήθεια (ίδιο ιδίωμα με το §27 Η4).
 * 🔑 **Ο παραλήπτης τον βρίσκει ο διακομιστής**: ο υπεύθυνος (§26) για την έγκριση, ο προτεινόμενος για την ανάθεση.
 *    Ο πελάτης στέλνει μόνο ποιον **είδε** (`lead-changed`) και ποιους συνιδιοκτήτες **διάλεξε** (υποσύνολο των επιλέξιμων).
 * 🔒 Email επαφής: **κύριο** (`primaryEmailOf`), από επαφή **του** μισθωτή (`readOwnedContactDocs` — ξένη ≡ ανύπαρκτη).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { issuanceKeyOf, issuanceStateOf, type IssuanceAssignmentRecord, type IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import type { IssuanceSendBody } from '@/lib/document-validity/issuance-request';
import { primaryEmailOf } from '@/lib/contacts/primary-email';
import { trimmedStringOrNull } from '@/lib/type-guards';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { extractContactDisplayName } from '@/server/lib/contact-doc-fields';
import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';
import { readDocumentRegistry } from '@/services/document-registry/document-registry.service';
import type { DocumentRegistryResponse, RegistryPropertyLabel, RegistryPropertyScope } from '@/services/document-registry/document-registry.types';
import { leadRefusalFor } from '@/services/document-registry/issuance-assignment.service';
import { issuanceAssignmentIdOf } from '@/services/document-registry/issuance-assignment-schema';
import type { IssuanceEmailFacts } from '@/services/email-templates/issuance-invitation-email';

/** Από ποια στάδια στέλνεται κάθε μήνυμα — **ίδια** με τον μειωτή (`request-approval` · `notify`), για καθαρή άρνηση στο πρόχειρο. */
const SENDABLE_FROM: Readonly<Record<IssuanceSendBody['audience'], readonly IssuanceStage[]>> = {
  owner: ['proposed'],
  professional: ['ownerApproved', 'sent'],
};

export interface DraftPerson {
  readonly contactId: string;
  readonly name: string | null;
  readonly email: string | null;
}

export interface IssuanceSendDraft {
  readonly audience: IssuanceSendBody['audience'];
  readonly recipient: DraftPerson & { readonly email: string };
  /** Οι **επιλέξιμοι** συνιδιοκτήτες (μόνο για έγκριση) — όσοι χωρίς email φαίνονται, αλλά δεν διαλέγονται. */
  readonly coOwners: readonly DraftPerson[];
  /** Όσους **διάλεξε** ο άνθρωπος — πάντα υποσύνολο των επιλέξιμων με email. */
  readonly informed: readonly DraftPerson[];
  readonly facts: IssuanceEmailFacts;
  readonly leadName: string | null;
  readonly property: { readonly id: string; readonly scope: RegistryPropertyScope; readonly name: string | null };
  readonly latestIssuedOn: string | null;
  readonly assignmentId: string;
  readonly record: IssuanceAssignmentRecord;
  readonly names: Readonly<Record<string, string | null>>;
}

export type DraftRefusal =
  | 'absent' | 'unavailable' | 'transition-refused' | 'lead-undesignated' | 'lead-changed' | 'no-email' | 'co-owner-unknown';

export type DraftOutcome = { readonly ok: true; readonly draft: IssuanceSendDraft } | { readonly ok: false; readonly refusal: DraftRefusal };

const refused = (refusal: DraftRefusal): DraftOutcome => ({ ok: false, refusal });

interface OpenAssignment {
  readonly registry: DocumentRegistryResponse;
  readonly label: RegistryPropertyLabel;
  readonly record: IssuanceAssignmentRecord;
  readonly latestIssuedOn: string | null;
  /** Ο υπεύθυνος (§26) — `null` όταν δεν ορίζεται. */
  readonly leadId: string | null;
}

/** Η ανάθεση **όπως τη βλέπει η οθόνη τώρα** — ανοιχτή, σε στάδιο που στέλνει αυτό το μήνυμα, και ίδια με ό,τι είδε ο άνθρωπος. */
function openAssignmentOf(body: IssuanceSendBody, registry: DocumentRegistryResponse): OpenAssignment | DraftRefusal {
  const issuance = registry.issuance[issuanceKeyOf(body.propertyId, body.documentKind)];
  const label = registry.properties[body.propertyId];
  if (issuance === undefined || label === undefined) return 'absent';
  const state = issuanceStateOf(issuance.record, issuance.latestIssuedOn);
  if (state.kind !== 'open' || state.stage !== body.expectedStage || !SENDABLE_FROM[body.audience].includes(state.stage)) {
    return 'transition-refused';
  }
  const leadId = label.obligorLead?.kind === 'designated' ? label.obligorLead.contactId : null;
  return { registry, label, record: state.record, latestIssuedOn: issuance.latestIssuedOn, leadId };
}

/** Ποιος παίρνει το μήνυμα — ο υπεύθυνος (ελεγμένος από τον ΕΝΑ κριτή) ή ο προτεινόμενος επαγγελματίας. */
function recipientIdOf(body: IssuanceSendBody, open: OpenAssignment): string | 'lead-undesignated' | 'lead-changed' {
  if (body.audience === 'professional') return open.record.professionalContactId;
  return leadRefusalFor(open.registry, body.propertyId, body.expectedOwnerContactId) ?? open.leadId ?? 'lead-undesignated';
}

/** Οι συνιδιοκτήτες = οι ιδιοκτήτες του ακινήτου εκτός του υπευθύνου — **μόνο** στην έγκριση. */
function coOwnerIdsOf(body: IssuanceSendBody, open: OpenAssignment): readonly string[] {
  if (body.audience !== 'owner' || open.leadId === null) return [];
  return (open.label.ownerContactIds ?? []).filter((id) => id !== open.leadId);
}

async function peopleOf(db: Firestore, companyId: string, ids: readonly string[]): Promise<ReadonlyMap<string, DraftPerson>> {
  const docs = await readOwnedContactDocs(db, companyId, ids);
  return new Map([...docs].map(([contactId, data]) => [contactId, {
    contactId,
    name: trimmedStringOrNull(extractContactDisplayName(data)),
    email: primaryEmailOf(Array.isArray(data.emails) ? data.emails : undefined),
  }] as const));
}

/** Οι επιλεγμένοι — `null` αν ο πελάτης έστειλε κάποιον που **δεν** είναι επιλέξιμος (ξένος, χωρίς email, ο υπεύθυνος). */
function informedOf(body: IssuanceSendBody, coOwners: readonly DraftPerson[]): readonly DraftPerson[] | null {
  const eligible = new Map(coOwners.filter((person) => person.email !== null).map((person) => [person.contactId, person] as const));
  const informed = [...new Set(body.informContactIds)].map((id) => eligible.get(id));
  return informed.every((person): person is DraftPerson => person !== undefined) ? informed : null;
}

/** **Το πρόχειρο** — ή η άρνηση με όνομα. Δεν γράφει τίποτα. */
export async function draftIssuanceMessage(db: Firestore, companyId: string, body: IssuanceSendBody, now: Date): Promise<DraftOutcome> {
  const registry = await readDocumentRegistry(db, companyId, now);
  if (!registry.issuanceKnown) return refused('unavailable');
  const open = openAssignmentOf(body, registry);
  if (typeof open === 'string') return refused(open);
  const recipientId = recipientIdOf(body, open);
  if (recipientId === 'lead-undesignated' || recipientId === 'lead-changed') return refused(recipientId);
  const coOwnerIds = coOwnerIdsOf(body, open);
  const ids = [recipientId, open.record.professionalContactId, ...coOwnerIds, ...(open.leadId === null ? [] : [open.leadId])];
  const [people, officeName] = await Promise.all([peopleOf(db, companyId, ids), readWorkspaceName(companyId).catch(() => '')]);
  const recipient = people.get(recipientId);
  if (recipient === undefined || recipient.email === null) return refused('no-email');
  const coOwners = coOwnerIds.flatMap((id) => people.get(id) ?? []);
  const informed = informedOf(body, coOwners);
  if (informed === null) return refused('co-owner-unknown');
  const draft = assemble({ body, open, people, officeName, companyId, recipient: { ...recipient, email: recipient.email }, coOwners, informed });
  return { ok: true, draft };
}

interface AssembleInput {
  readonly body: IssuanceSendBody;
  readonly open: OpenAssignment;
  readonly recipient: IssuanceSendDraft['recipient'];
  readonly coOwners: readonly DraftPerson[];
  readonly informed: readonly DraftPerson[];
  readonly people: ReadonlyMap<string, DraftPerson>;
  readonly officeName: string;
  readonly companyId: string;
}

function assemble(input: AssembleInput): IssuanceSendDraft {
  const { body, open, people } = input;
  const { registry, record, label, leadId } = open;
  return {
    audience: body.audience,
    recipient: input.recipient,
    coOwners: input.coOwners,
    informed: input.informed,
    facts: {
      officeName: trimmedStringOrNull(input.officeName),
      propertyLabel: label.name,
      documentKind: body.documentKind,
      professionalName: people.get(record.professionalContactId)?.name ?? null,
      credential: record.credential,
      note: body.note,
    },
    leadName: leadId === null ? null : people.get(leadId)?.name ?? null,
    property: { id: body.propertyId, scope: label.scope, name: label.name },
    latestIssuedOn: open.latestIssuedOn,
    assignmentId: issuanceAssignmentIdOf(input.companyId, body.propertyId, body.documentKind),
    record,
    names: Object.fromEntries(Object.entries(registry.people).map(([id, person]) => [id, person.name])),
  };
}
