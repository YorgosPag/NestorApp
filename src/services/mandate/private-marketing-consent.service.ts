/**
 * @fileoverview **Η ΣΥΝΑΙΝΕΣΗ ΓΙΑ ΚΛΕΙΣΤΗ ΔΙΑΘΕΣΗ** — αίτημα · παροχή · ανάκληση, ατομικά πάνω στην εντολή.
 * @related ADR-864 §5.4 · §17 (Ε-11…Ε-14) · §7 Α7-Α8 · Α16-Α21 · types/private-marketing-consent.ts
 * @module services/mandate/private-marketing-consent.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΙΑ ΣΥΜΒΟΛΑΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Η παροχή ΕΚΤΕΛΕΙ το στένεμα στην ίδια συναλλαγή** (Ε-11): κανένα «μισοκλειστό» κοινό,
 *    κανένα παράθυρο όπου υπάρχει συναίνεση χωρίς αποτέλεσμα ή αποτέλεσμα χωρίς συναίνεση.
 * 2. **Η ανάκληση ΔΕΝ αφήνει ποτέ κλειστή διάθεση** (Ε-13): δημόσια ή απόσυρση, ίδια συναλλαγή.
 * 3. **Ο ίδιος κριτής με κάθε γραφέα** (`privateMarketingViolationsAdded`) τρέχει και εδώ, στο
 *    φρέσκο έγγραφο: συναίνεση προς το γραφείο Α **δεν** καλύπτει εντολή του γραφείου Β.
 *
 * ⚠️ Ίχνος ADR-195 σε **κάθε** γεγονός (Α18), **μετά** την επιτυχή γραφή και **έξω** από τη
 * συναλλαγή (το σώμα της ξαναεκτελείται). Γραφή εκτός `persist()` επειδή χρειάζεται CAS.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { custodyOf, isPersonalCustody, mayAdminister, type ListingActor } from '@/lib/owner-property/listing-custody';
import {
  consentTextVerdict,
  consentValuesFor,
  type ConsentSubmission,
} from '@/lib/mandate/private-marketing-consent-text';
import {
  consentBearingMandates,
  mandateTermOf,
  privateMarketingEventsOf,
  privateMarketingStandingOf,
  privateMarketingViolationsAdded,
} from '@/lib/mandate/private-marketing-standing';
import { generatePrivateMarketingEventId } from '@/services/enterprise-id.service';
import { readCompanyPublicName } from '@/services/company/company-public-name.reader';
import { issueMandateConsentLink } from '@/services/mandate/mandate-consent.service';
import { sendMandateInvitation, type NotifyOutcome } from '@/services/mandate/mandate-invitation.service';
import type { MandateMessageKind } from '@/services/mandate/mandate-email-texts';
import { recordOwnerPropertyWrite } from '@/services/owner-property/owner-property-audit';
import { republishOwnerProperty } from '@/services/owner-property/owner-property-publication.service';
import type { OwnerPropertyWriteResult } from '@/services/owner-property/owner-property-write-result';
import type { OwnerProperty } from '@/types/owner-property';
import {
  AGENCY_ATTESTATION,
  OWNER_CONSENT,
  type BrokeredListingMandate,
  type MandateProof,
} from '@/types/owner-property-mandate';
import {
  type ClosedMarketingAudience,
  type PrivateMarketingChannel,
  type PrivateMarketingEvent,
  type PrivateMarketingRefusal,
  type PrivateMarketingRevocationOutcome,
} from '@/types/private-marketing-consent';

const logger = createModuleLogger('private-marketing-consent.service');

// =============================================================================
// 1. ΠΟΙΟΣ ΕΝΕΡΓΕΙ — τρεις ταυτότητες, τρεις κανόνες εύρεσης εντολής
// =============================================================================

/**
 * 🔑 **Η εύρεση της εντολής ΕΙΝΑΙ η εξουσιοδότηση.** Ο σύνδεσμος ονομάζει πρόσκληση (`nonce`)·
 * ο ιδιοκτήτης με λογαριασμό ονομάζει γραφείο **μέσα** στη δική του καταχώρηση· το γραφείο
 * βρίσκει **μόνο** τη δική του εντολή. Αποτυχία ⇒ `absent`, ποτέ «υπάρχει αλλά όχι για σένα».
 */
type ConsentActor =
  | { readonly kind: 'owner-link'; readonly nonce: string; readonly clientContactId: string }
  | { readonly kind: 'owner-account'; readonly actor: ListingActor; readonly agencyCompanyId: string }
  | { readonly kind: 'agency'; readonly actor: ListingActor };

const CHANNEL_OF: Record<ConsentActor['kind'], PrivateMarketingChannel> = {
  'owner-link': 'link',
  'owner-account': 'account',
  agency: 'form',
};

function locateMandate(
  property: OwnerProperty,
  who: ConsentActor,
  nowISOValue: string,
): BrokeredListingMandate | null {
  const bearing = consentBearingMandates(property.mandates, nowISOValue);
  switch (who.kind) {
    case 'owner-link':
      return bearing.find((m) => m.consentNonce === who.nonce && m.clientContactId === who.clientContactId) ?? null;
    case 'owner-account':
      if (!isPersonalCustody(property) || !mayAdminister(custodyOf(property), who.actor)) return null;
      return bearing.find((m) => m.agencyCompanyId === who.agencyCompanyId) ?? null;
    case 'agency':
      return bearing.find((m) => who.actor.companyId !== null && m.agencyCompanyId === who.actor.companyId) ?? null;
  }
}

/** Ποιος γράφεται στο ίχνος — ο σύνδεσμος δεν έχει λογαριασμό, έχει **επαφή**. */
function auditActorOf(who: ConsentActor): ListingActor {
  return who.kind === 'owner-link' ? { uid: who.clientContactId, companyId: null } : who.actor;
}

function actorUserIdOf(who: ConsentActor): string | null {
  return who.kind === 'owner-link' ? null : who.actor.uid;
}

// =============================================================================
// 2. Ο ΠΥΡΗΝΑΣ — μία συναλλαγή, ένας κριτής, ένα ίχνος
// =============================================================================

export type PrivateMarketingOutcome =
  | OwnerPropertyWriteResult
  | { readonly kind: 'refused'; readonly reason: PrivateMarketingRefusal }
  | { readonly kind: 'requested'; readonly notify: NotifyOutcome };

interface Mutated {
  readonly next: OwnerProperty;
  readonly event: PrivateMarketingEvent;
  /** Νέος σύνδεσμος, όταν το γεγονός χρειάζεται ειδοποίηση του ιδιοκτήτη. */
  readonly token: string | null;
}

type Mutation = (property: OwnerProperty, mandate: BrokeredListingMandate) => Mutated | PrivateMarketingRefusal;

interface Written extends Mutated {
  readonly kind: 'written';
  readonly before: OwnerProperty;
  readonly mandate: BrokeredListingMandate;
}

/** Η εντολή με ένα γεγονός **προσαρτημένο** — ποτέ αντικατάσταση του ιστορικού. */
function withEvent(
  mandate: BrokeredListingMandate,
  event: PrivateMarketingEvent,
  consentNonce: string | null = mandate.consentNonce,
): BrokeredListingMandate {
  return { ...mandate, privateMarketing: [...privateMarketingEventsOf(mandate), event], consentNonce };
}

function replaceMandate(property: OwnerProperty, mandate: BrokeredListingMandate): readonly BrokeredListingMandate[] {
  return [...property.mandates.filter((m) => m.agencyCompanyId !== mandate.agencyCompanyId), mandate];
}

async function mutateMandate(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  who: ConsentActor,
  nowISOValue: string,
  mutate: Mutation,
): Promise<Written | PrivateMarketingOutcome> {
  const ref = adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).doc(ownerPropertyId);
  try {
    return await adminDb.runTransaction(async (tx) => {
      const before = ownerPropertyFromDocument((await tx.get(ref)).data(), ownerPropertyId);
      const mandate = before === null ? null : locateMandate(before, who, nowISOValue);
      if (before === null || mandate === null) return { kind: 'absent' } as const;

      const mutated = mutate(before, mandate);
      if (typeof mutated === 'string') return { kind: 'refused', reason: mutated } as const;

      const violations = privateMarketingViolationsAdded(before, mutated.next, nowISOValue);
      if (violations.length > 0) return { kind: 'invalid-mandate', violations } as const;

      tx.set(ref, mutated.next);
      return { kind: 'written', before, mandate, ...mutated } as const;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Η συναίνεση κλειστής διάθεσης δεν γράφτηκε', { data: { ownerPropertyId }, error: message });
    return { kind: 'failed', message };
  }
}

/** Ίχνος (Α18) + επαναπροβολή — **μετά** την επιτυχή γραφή. */
async function finish(adminDb: AdminFirestore, written: Written, who: ConsentActor): Promise<OwnerPropertyWriteResult> {
  await recordOwnerPropertyWrite(written.next, {
    actor: auditActorOf(who),
    before: written.before,
    extraChanges: [
      {
        field: 'privateMarketing',
        oldValue: privateMarketingStandingOf(written.mandate).kind,
        newValue: written.event.kind,
        label: written.mandate.agencyCompanyId,
      },
    ],
  });
  const republished = await republishOwnerProperty(adminDb, written.next);
  return { kind: 'saved', property: republished.property, publish: republished.publish };
}

async function notifyOwner(
  adminDb: AdminFirestore,
  kind: MandateMessageKind,
  written: Written,
): Promise<NotifyOutcome> {
  if (written.token === null) return { kind: 'failed' };
  return sendMandateInvitation(adminDb, kind, {
    clientContactId: written.mandate.clientContactId,
    agencyName: (await readCompanyPublicName(adminDb, written.mandate.agencyCompanyId)) ?? '',
    listingTitle: written.next.title,
    expiresAt: written.mandate.expiresAt,
    token: written.token,
    idempotencyKey: `private-marketing:${written.event.id}`,
  });
}

function isWritten(outcome: Written | PrivateMarketingOutcome): outcome is Written {
  return outcome.kind === 'written';
}

// =============================================================================
// 3. ΑΙΤΗΜΑ — το γραφείο ζητά (Ε-11)· τίποτα ορατό δεν αλλάζει
// =============================================================================

export async function requestPrivateMarketing(
  adminDb: AdminFirestore,
  input: { readonly ownerPropertyId: string; readonly actor: ListingActor; readonly audience: ClosedMarketingAudience; readonly nowISO: string },
): Promise<PrivateMarketingOutcome> {
  const who: ConsentActor = { kind: 'agency', actor: input.actor };
  const outcome = await mutateMandate(adminDb, input.ownerPropertyId, who, input.nowISO, (property, mandate) => {
    if (privateMarketingStandingOf(mandate).kind === 'granted') return 'consent-already-granted';
    const event: PrivateMarketingEvent = {
      kind: 'requested',
      id: generatePrivateMarketingEventId(),
      at: input.nowISO,
      requestedByUserId: input.actor.uid,
      audience: input.audience,
    };
    // Νέος σύνδεσμος = νέα πρόσκληση· ο παλιός γίνεται `superseded` (ίδιο συμβόλαιο με το «ξαναστείλε»).
    const link = issueMandateConsentLink(property.id, mandate.clientContactId);
    const next = { ...property, mandates: replaceMandate(property, withEvent(mandate, event, link.nonce)), updatedAt: input.nowISO };
    return { next, event, token: link.token };
  });
  if (!isWritten(outcome)) return outcome;

  await recordOwnerPropertyWrite(outcome.next, {
    actor: input.actor,
    before: outcome.before,
    extraChanges: [{ field: 'privateMarketing', oldValue: privateMarketingStandingOf(outcome.mandate).kind, newValue: 'requested', label: outcome.mandate.agencyCompanyId }],
  });
  return { kind: 'requested', notify: await notifyOwner(adminDb, 'private-marketing-request', outcome) };
}

// =============================================================================
// 4. ΠΑΡΟΧΗ — σύνδεσμος · λογαριασμός · έντυπο· εκτελεί το στένεμα (Ε-11 · Ε-12)
// =============================================================================

interface GrantInput {
  readonly ownerPropertyId: string;
  readonly who: ConsentActor;
  readonly submission: ConsentSubmission;
  /** Το αίτημα που εκτελείται· `null` μόνο όταν ο ιδιοκτήτης/γραφείο στενεύει χωρίς αίτημα. */
  readonly requestId: string | null;
  /** Το κοινό όταν **δεν** εκτελείται αίτημα (λογαριασμός · έντυπο). */
  readonly audience: ClosedMarketingAudience | null;
  /** Μόνο στο έντυπο: το ανεβασμένο υπογεγραμμένο αρχείο (Α20). */
  readonly documentPath: string | null;
  readonly nowISO: string;
}

/** Α19 — ποιο κοινό εκτελείται, ή γιατί το αίτημα είναι μπαγιάτικο. */
function grantedAudience(
  mandate: BrokeredListingMandate,
  input: GrantInput,
): ClosedMarketingAudience | 'consent-request-stale' {
  const standing = privateMarketingStandingOf(mandate);
  if (input.requestId !== null) {
    return standing.kind === 'requested' && standing.request.id === input.requestId
      ? standing.request.audience
      : 'consent-request-stale';
  }
  // 🔴 Ο σύνδεσμος υπάρχει **μόνο** για να εκτελέσει αίτημα — χωρίς αίτημα δεν στενεύει τίποτα.
  if (input.who.kind === 'owner-link' || input.audience === null) return 'consent-request-stale';
  return input.audience;
}

function proofOf(input: GrantInput): MandateProof | 'consent-document-missing' {
  if (input.who.kind !== 'agency') return { via: OWNER_CONSENT };
  const documentPath = input.documentPath?.trim() ?? '';
  if (documentPath === '') return 'consent-document-missing';
  return { via: AGENCY_ATTESTATION, attestedByUserId: input.who.actor.uid, attestedAt: input.nowISO, documentPath };
}


/**
 * Πριν τη συναλλαγή: **ποιο γραφείο**, ώστε να διαβαστεί η επωνυμία που έδειξε η οθόνη.
 *
 * ⚠️ Ανάγνωση βάσης μέσα στη συναλλαγή που δεν αφορά το έγγραφο θα διεύρυνε το κλείδωμα· γι' αυτό
 * γίνεται **εδώ**, και η μετάλλαξη ξαναελέγχει ότι μιλά για το **ίδιο** γραφείο.
 */
async function agencyOf(
  adminDb: AdminFirestore,
  input: GrantInput,
): Promise<{ readonly agencyCompanyId: string; readonly agencyName: string } | null> {
  const snapshot = await adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).doc(input.ownerPropertyId).get();
  const property = ownerPropertyFromDocument(snapshot.data(), input.ownerPropertyId);
  const mandate = property === null ? null : locateMandate(property, input.who, input.nowISO);
  if (mandate === null) return null;
  const agencyName = (await readCompanyPublicName(adminDb, mandate.agencyCompanyId)) ?? '';
  return { agencyCompanyId: mandate.agencyCompanyId, agencyName };
}

function grantMutation(
  input: GrantInput,
  proof: MandateProof,
  agency: { readonly agencyCompanyId: string; readonly agencyName: string },
): Mutation {
  return (property, mandate) => {
    if (mandate.agencyCompanyId !== agency.agencyCompanyId) return 'consent-request-stale';
    const audience = grantedAudience(mandate, input);
    if (audience === 'consent-request-stale') return audience;

    const verdict = consentTextVerdict(input.submission, consentValuesFor(agency.agencyName, mandate.expiresAt));
    if (verdict.kind === 'refused') return verdict.reason;

    const event: PrivateMarketingEvent = {
      kind: 'granted',
      id: generatePrivateMarketingEventId(),
      at: input.nowISO,
      requestId: input.requestId,
      audience,
      text: verdict.text,
      acknowledged: verdict.acknowledged,
      values: input.submission.values,
      locale: input.submission.locale,
      channel: CHANNEL_OF[input.who.kind],
      actorUserId: actorUserIdOf(input.who),
      proof,
      term: mandateTermOf(mandate),
    };
    // Το έντυπο ειδοποιεί τον ιδιοκτήτη για αμφισβήτηση (Ε-12) ⇒ χρειάζεται ζωντανό σύνδεσμο.
    const link = input.who.kind === 'agency' ? issueMandateConsentLink(property.id, mandate.clientContactId) : null;
    const updated = withEvent(mandate, event, link?.nonce ?? mandate.consentNonce);
    const next = { ...property, marketingAudience: audience, mandates: replaceMandate(property, updated), updatedAt: input.nowISO };
    return { next, event, token: link?.token ?? null };
  };
}

export async function grantPrivateMarketing(adminDb: AdminFirestore, input: GrantInput): Promise<PrivateMarketingOutcome> {
  const proof = proofOf(input);
  if (proof === 'consent-document-missing') return { kind: 'refused', reason: proof };

  const agency = await agencyOf(adminDb, input);
  if (agency === null) return { kind: 'absent' };

  const outcome = await mutateMandate(adminDb, input.ownerPropertyId, input.who, input.nowISO, grantMutation(input, proof, agency));
  if (!isWritten(outcome)) return outcome;

  const saved = await finish(adminDb, outcome, input.who);
  if (input.who.kind === 'agency') await notifyOwner(adminDb, 'private-marketing-attestation-notice', outcome);
  return saved;
}

// =============================================================================
// 5. ΑΝΑΚΛΗΣΗ — ποτέ κλειστή χωρίς συναίνεση (Ε-13 · Α16)
// =============================================================================

export async function revokePrivateMarketing(
  adminDb: AdminFirestore,
  input: {
    readonly ownerPropertyId: string;
    readonly who: Exclude<ConsentActor, { kind: 'agency' }>;
    readonly outcome: PrivateMarketingRevocationOutcome;
    readonly nowISO: string;
  },
): Promise<PrivateMarketingOutcome> {
  const outcome = await mutateMandate(adminDb, input.ownerPropertyId, input.who, input.nowISO, (property, mandate) => {
    // 🔑 Η **έξοδος** μένει πάντα ανοιχτή: και χωρίς ενεργή συναίνεση, αρκεί η διάθεση να είναι κλειστή.
    if (privateMarketingStandingOf(mandate).kind !== 'granted' && property.marketingAudience === 'public') {
      return 'consent-not-granted';
    }
    const event: PrivateMarketingEvent = {
      kind: 'revoked',
      id: generatePrivateMarketingEventId(),
      at: input.nowISO,
      outcome: input.outcome,
      channel: input.who.kind === 'owner-link' ? 'link' : 'account',
      actorUserId: actorUserIdOf(input.who),
    };
    // ⚠️ Η απόσυρση γράφει **και** `public`: αποσυρμένη-κλειστή χωρίς συναίνεση θα ήταν ακόμη παραβίαση,
    //    και η επαναφορά αργότερα είναι ρητή πράξη του ιδιοκτήτη.
    const next: OwnerProperty = {
      ...property,
      marketingAudience: 'public',
      lifecycle: input.outcome === 'withdrawn' ? 'withdrawn' : property.lifecycle,
      mandates: replaceMandate(property, withEvent(mandate, event)),
      updatedAt: input.nowISO,
    };
    return { next, event, token: null };
  });
  return isWritten(outcome) ? finish(adminDb, outcome, input.who) : outcome;
}
