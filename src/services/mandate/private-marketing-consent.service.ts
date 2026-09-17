/**
 * @fileoverview **Η ΣΥΝΑΙΝΕΣΗ ΓΙΑ ΚΛΕΙΣΤΗ ΔΙΑΘΕΣΗ** — αίτημα · παροχή · ανάκληση, ατομικά πάνω στην εντολή.
 * @related ADR-864 §5.4 · §17 (Ε-11…Ε-14) · §18 (Δ1 · Δ3) · §7 Α7-Α8 · Α16-Α21 · Α23 · Α27
 * @module services/mandate/private-marketing-consent.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΕΣΣΕΡΑ ΣΥΜΒΟΛΑΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Η παροχή ΕΚΤΕΛΕΙ το στένεμα στην ίδια συναλλαγή** (Ε-11): κανένα «μισοκλειστό» κοινό.
 * 2. **Η ανάκληση ΔΕΝ αφήνει ποτέ κλειστή διάθεση** (Ε-13): δημόσια ή απόσυρση, ίδια συναλλαγή.
 * 3. **Ο ίδιος κριτής με κάθε γραφέα** (`privateMarketingViolationsAdded`) τρέχει **μία** φορά, στο
 *    **τελικό** έγγραφο: συναίνεση προς Α **δεν** καλύπτει εντολή του Β.
 * 4. **Πολλά γραφεία = μία πράξη** (Δ3 · Α27): ο ιδιοκτήτης συναινεί προς **όλα** τα γραφεία χωρίς συναίνεση
 *    σε **μία** συναλλαγή, **ένα** γεγονός ανά εντολή· έστω μία άρνηση ⇒ **τίποτα** δεν γράφεται. Χωρίς αυτό,
 *    δύο μη αποκλειστικές εντολές έκαναν την κλειστή διάθεση **αδύνατη** (μετρημένο, §18.4).
 *
 * ⚠️ Ίχνος ADR-195 σε **κάθε** πράξη (Α18), **μετά** την επιτυχή γραφή και **έξω** από τη συναλλαγή.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import type { ListingActor } from '@/lib/owner-property/listing-custody';
import { consentTextVerdict, consentValuesFor, type ConsentSubmission } from '@/lib/mandate/private-marketing-consent-text';
import {
  mandateTermOf,
  privateMarketingEventsOf,
  privateMarketingStandingOf,
  privateMarketingViolationsAdded,
  requestRefusalOf,
} from '@/lib/mandate/private-marketing-standing';
import { generatePrivateMarketingEventId } from '@/services/enterprise-id.service';
import { readCompanyPublicName } from '@/services/company/company-public-name.reader';
import { attestationDocumentOf } from '@/services/mandate/attestation-document';
import { issueMandateConsentLink } from '@/services/mandate/mandate-consent.service';
import { sendMandateInvitation, type NotifyOutcome } from '@/services/mandate/mandate-invitation.service';
import type { MandateMessageKind } from '@/services/mandate/mandate-email-texts';
import {
  CHANNEL_OF,
  actorUserIdOf,
  auditActorOf,
  locateMandate,
  type AgencyActor,
  type ConsentActor,
  type OwnerAccountActor,
  type OwnerLinkActor,
} from '@/services/mandate/private-marketing-actor';
import { recordOwnerPropertyWrite } from '@/services/owner-property/owner-property-audit';
import { republishOwnerProperty } from '@/services/owner-property/owner-property-publication.service';
import type { OwnerPropertyWriteResult } from '@/services/owner-property/owner-property-write-result';
import type { OwnerProperty } from '@/types/owner-property';
import { AGENCY_ATTESTATION, OWNER_CONSENT, type BrokeredListingMandate, type MandateProof } from '@/types/owner-property-mandate';
import type {
  ClosedMarketingAudience,
  PrivateMarketingEvent,
  PrivateMarketingRefusal,
  PrivateMarketingRevocationOutcome,
} from '@/types/private-marketing-consent';

const logger = createModuleLogger('private-marketing-consent.service');

// =============================================================================
// 1. Ο ΠΥΡΗΝΑΣ — μία συναλλαγή, ένας κριτής, ένα ίχνος
// =============================================================================

export type PrivateMarketingOutcome =
  | OwnerPropertyWriteResult
  | { readonly kind: 'refused'; readonly reason: PrivateMarketingRefusal }
  | { readonly kind: 'requested'; readonly notify: NotifyOutcome };

/** Ένα γεγονός πάνω σε μία εντολή — η εντολή είναι η **προ** της πράξης (για το ίχνος). */
interface Applied {
  readonly mandate: BrokeredListingMandate;
  readonly event: PrivateMarketingEvent;
}

interface Mutated {
  readonly next: OwnerProperty;
  readonly applied: readonly Applied[];
  /** Νέος σύνδεσμος, όταν η πράξη χρειάζεται ειδοποίηση του ιδιοκτήτη (μία εντολή). */
  readonly token: string | null;
}

type Mutation = (property: OwnerProperty) => Mutated | PrivateMarketingRefusal | 'absent';

interface Written extends Mutated {
  readonly kind: 'written';
  readonly before: OwnerProperty;
}

/** Η εντολή με ένα γεγονός **προσαρτημένο** — ποτέ αντικατάσταση του ιστορικού. */
function withEvent(
  mandate: BrokeredListingMandate,
  event: PrivateMarketingEvent,
  consentNonce: string | null = mandate.consentNonce,
): BrokeredListingMandate {
  return { ...mandate, privateMarketing: [...privateMarketingEventsOf(mandate), event], consentNonce };
}

function replaceMandate(mandates: readonly BrokeredListingMandate[], mandate: BrokeredListingMandate): readonly BrokeredListingMandate[] {
  return [...mandates.filter((m) => m.agencyCompanyId !== mandate.agencyCompanyId), mandate];
}

async function mutateProperty(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  nowISOValue: string,
  mutate: Mutation,
): Promise<Written | PrivateMarketingOutcome> {
  const ref = adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).doc(ownerPropertyId);
  try {
    return await adminDb.runTransaction(async (tx) => {
      const before = ownerPropertyFromDocument((await tx.get(ref)).data(), ownerPropertyId);
      const mutated = before === null ? 'absent' : mutate(before);
      if (before === null || mutated === 'absent') return { kind: 'absent' } as const;
      if (typeof mutated === 'string') return { kind: 'refused', reason: mutated } as const;

      const violations = privateMarketingViolationsAdded(before, mutated.next, nowISOValue);
      if (violations.length > 0) return { kind: 'invalid-mandate', violations } as const;

      tx.set(ref, mutated.next);
      return { kind: 'written', before, ...mutated } as const;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Η συναίνεση κλειστής διάθεσης δεν γράφτηκε', { data: { ownerPropertyId }, error: message });
    return { kind: 'failed', message };
  }
}

/** Ίχνος (Α18): **μία** εγγραφή ανά πράξη, μία αλλαγή ανά εντολή που άγγιξε. */
async function recordAct(written: Written, actor: ListingActor): Promise<void> {
  await recordOwnerPropertyWrite(written.next, {
    actor,
    before: written.before,
    extraChanges: written.applied.map(({ mandate, event }) => ({
      field: 'privateMarketing',
      oldValue: privateMarketingStandingOf(mandate).kind,
      newValue: event.kind,
      label: mandate.agencyCompanyId,
    })),
  });
}

async function finish(adminDb: AdminFirestore, written: Written, who: ConsentActor): Promise<OwnerPropertyWriteResult> {
  await recordAct(written, auditActorOf(who));
  const republished = await republishOwnerProperty(adminDb, written.next);
  return { kind: 'saved', property: republished.property, publish: republished.publish };
}

async function notifyOwner(adminDb: AdminFirestore, kind: MandateMessageKind, written: Written): Promise<NotifyOutcome> {
  const first = written.applied[0];
  if (written.token === null || first === undefined) return { kind: 'failed' };
  return sendMandateInvitation(adminDb, kind, {
    clientContactId: first.mandate.clientContactId,
    agencyName: (await readCompanyPublicName(adminDb, first.mandate.agencyCompanyId)) ?? '',
    listingTitle: written.next.title,
    expiresAt: first.mandate.expiresAt,
    token: written.token,
    idempotencyKey: `private-marketing:${first.event.id}`,
  });
}

function isWritten(outcome: Written | PrivateMarketingOutcome): outcome is Written {
  return outcome.kind === 'written';
}

// =============================================================================
// 2. ΑΙΤΗΜΑ — το γραφείο ζητά (Ε-11)· τίποτα ορατό δεν αλλάζει
// =============================================================================

export async function requestPrivateMarketing(
  adminDb: AdminFirestore,
  input: { readonly ownerPropertyId: string; readonly actor: ListingActor; readonly audience: ClosedMarketingAudience; readonly nowISO: string },
): Promise<PrivateMarketingOutcome> {
  const who: AgencyActor = { kind: 'agency', actor: input.actor };
  const outcome = await mutateProperty(adminDb, input.ownerPropertyId, input.nowISO, (property) => {
    const mandate = locateMandate(property, who, null, input.nowISO);
    if (mandate === null) return 'absent';
    // Α29 · Α35 — ισχύει ήδη · αρνήθηκε · αναμονή: **ένας** κριτής, μέσα στη συναλλαγή (δύο κλικ ⇒ ένα email).
    const refusal = requestRefusalOf(mandate, input.nowISO);
    if (refusal !== null) return refusal;
    const event: PrivateMarketingEvent = {
      kind: 'requested',
      id: generatePrivateMarketingEventId(),
      at: input.nowISO,
      requestedByUserId: input.actor.uid,
      audience: input.audience,
    };
    // Νέος σύνδεσμος = νέα πρόσκληση· ο παλιός γίνεται `superseded` (ίδιο συμβόλαιο με το «ξαναστείλε»).
    const link = issueMandateConsentLink(property.id, mandate.clientContactId);
    const mandates = replaceMandate(property.mandates, withEvent(mandate, event, link.nonce));
    return { next: { ...property, mandates, updatedAt: input.nowISO }, applied: [{ mandate, event }], token: link.token };
  });
  if (!isWritten(outcome)) return outcome;

  await recordAct(outcome, input.actor);
  return { kind: 'requested', notify: await notifyOwner(adminDb, 'private-marketing-request', outcome) };
}

// =============================================================================
// 3. ΠΑΡΟΧΗ — σύνδεσμος · λογαριασμός (πολλά γραφεία) · έντυπο
// =============================================================================

/** Μία συναίνεση προς ένα γραφείο. `agencyCompanyId: null` = «η μοναδική εντολή που βλέπει ο δρων». */
interface ConsentLine {
  readonly agencyCompanyId: string | null;
  /** Το αίτημα που εκτελείται· `null` μόνο όταν ο ιδιοκτήτης/γραφείο στενεύει χωρίς αίτημα. */
  readonly requestId: string | null;
  readonly submission: ConsentSubmission;
}

interface GrantCommon {
  readonly ownerPropertyId: string;
  /** Το κοινό όταν **δεν** εκτελείται αίτημα (λογαριασμός · έντυπο). */
  readonly audience: ClosedMarketingAudience | null;
  readonly nowISO: string;
}

type GrantInput = GrantCommon &
  (
    | { readonly who: OwnerLinkActor; readonly line: ConsentLine }
    /** Το έντυπο (Ε-12): `documentFileId` κρίνεται από τον **έναν** κριτή (Δ1 · Α23). */
    | { readonly who: AgencyActor; readonly line: ConsentLine; readonly documentFileId: string | null }
    /** Ο ιδιοκτήτης προς **όλα** τα γραφεία μαζί (Δ3 · Α27). */
    | { readonly who: OwnerAccountActor; readonly lines: readonly ConsentLine[] }
  );

const linesOf = (input: GrantInput): readonly ConsentLine[] => ('lines' in input ? input.lines : [input.line]);

/** Κάθε γραφείο **μία** φορά — δύο γραμμές για την ίδια εντολή θα έγραφαν δύο γεγονότα για μία πράξη. */
function hasDuplicateAgency(lines: readonly ConsentLine[]): boolean {
  const named = lines.map((line) => line.agencyCompanyId ?? '');
  return new Set(named).size !== named.length;
}

/** Α19 — ποιο κοινό εκτελείται, ή γιατί το αίτημα είναι μπαγιάτικο. */
function grantedAudience(mandate: BrokeredListingMandate, line: ConsentLine, input: GrantInput): ClosedMarketingAudience | 'consent-request-stale' {
  const standing = privateMarketingStandingOf(mandate);
  if (line.requestId !== null) {
    return standing.kind === 'requested' && standing.request.id === line.requestId ? standing.request.audience : 'consent-request-stale';
  }
  // 🔴 Ο σύνδεσμος υπάρχει **μόνο** για να εκτελέσει αίτημα — χωρίς αίτημα δεν στενεύει τίποτα.
  if (input.who.kind === 'owner-link' || input.audience === null) return 'consent-request-stale';
  return input.audience;
}

/** Α20 · Α23 — η απόδειξη· στο έντυπο, το αρχείο **της βάσης**, ποτέ διαδρομή από το σύρμα. */
async function proofOf(adminDb: AdminFirestore, input: GrantInput): Promise<MandateProof | PrivateMarketingRefusal> {
  if (input.who.kind !== 'agency' || !('documentFileId' in input)) return { via: OWNER_CONSENT };
  const document = await attestationDocumentOf(adminDb, {
    fileId: input.documentFileId,
    companyId: input.who.actor.companyId,
    ownerPropertyId: input.ownerPropertyId,
  });
  if (document.kind === 'refused') return document.reason;
  return { via: AGENCY_ATTESTATION, attestedByUserId: input.who.actor.uid, attestedAt: input.nowISO, documentPath: document.storagePath };
}

/**
 * Πριν τη συναλλαγή: **ποια γραφεία** και **με ποια επωνυμία** — οι τιμές που έδειξε η οθόνη (CAS, Α8α).
 * ⚠️ Ανάγνωση `companies` μέσα στη συναλλαγή θα διεύρυνε το κλείδωμα· η μετάλλαξη ξαναελέγχει το γραφείο.
 */
async function agencyNamesOf(adminDb: AdminFirestore, input: GrantInput): Promise<ReadonlyMap<string, string> | null> {
  const snapshot = await adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).doc(input.ownerPropertyId).get();
  const property = ownerPropertyFromDocument(snapshot.data(), input.ownerPropertyId);
  if (property === null) return null;
  const names = new Map<string, string>();
  for (const line of linesOf(input)) {
    const mandate = locateMandate(property, input.who, line.agencyCompanyId, input.nowISO);
    if (mandate === null) return null;
    names.set(mandate.agencyCompanyId, (await readCompanyPublicName(adminDb, mandate.agencyCompanyId)) ?? '');
  }
  return names;
}

type AcceptedText = Extract<ReturnType<typeof consentTextVerdict>, { kind: 'accepted' }>;

interface LineContext {
  readonly input: GrantInput;
  readonly proof: MandateProof;
  readonly names: ReadonlyMap<string, string>;
}

function grantEvent(ctx: LineContext, line: ConsentLine, mandate: BrokeredListingMandate, audience: ClosedMarketingAudience, accepted: AcceptedText): PrivateMarketingEvent {
  return {
    kind: 'granted',
    id: generatePrivateMarketingEventId(),
    at: ctx.input.nowISO,
    requestId: line.requestId,
    audience,
    text: accepted.text,
    acknowledged: accepted.acknowledged,
    values: line.submission.values,
    locale: line.submission.locale,
    channel: CHANNEL_OF[ctx.input.who.kind],
    actorUserId: actorUserIdOf(ctx.input.who),
    proof: ctx.proof,
    term: mandateTermOf(mandate),
  };
}

/** Μία γραμμή → ένα γεγονός, ή ο λόγος άρνησης. Η **πρώτη** άρνηση σταματά ολόκληρη την πράξη (Α27). */
function applyLine(property: OwnerProperty, ctx: LineContext, line: ConsentLine): Applied | PrivateMarketingRefusal | 'absent' {
  const mandate = locateMandate(property, ctx.input.who, line.agencyCompanyId, ctx.input.nowISO);
  if (mandate === null) return 'absent';
  const agencyName = ctx.names.get(mandate.agencyCompanyId);
  if (agencyName === undefined) return 'consent-request-stale';
  const audience = grantedAudience(mandate, line, ctx.input);
  if (audience === 'consent-request-stale') return audience;

  const verdict = consentTextVerdict(line.submission, consentValuesFor(agencyName, mandate.expiresAt));
  if (verdict.kind === 'refused') return verdict.reason;
  return { mandate, event: grantEvent(ctx, line, mandate, audience, verdict) };
}

/** Όλες οι γραμμές, ή η πρώτη άρνηση. ⚠️ Ένα κοινό ανά πράξη: διαφορετικά κλειστά κοινά **δεν** συμπτύσσονται σιωπηλά. */
function applyLines(property: OwnerProperty, ctx: LineContext): readonly Applied[] | PrivateMarketingRefusal | 'absent' {
  const applied: Applied[] = [];
  for (const line of linesOf(ctx.input)) {
    const result = applyLine(property, ctx, line);
    if (typeof result === 'string') return result;
    const first = applied[0];
    if (first !== undefined && audienceOfEvent(first.event) !== audienceOfEvent(result.event)) return 'consent-request-stale';
    applied.push(result);
  }
  return applied;
}

const audienceOfEvent = (event: PrivateMarketingEvent): string | null => ('audience' in event ? event.audience : null);

function grantMutation(ctx: LineContext): Mutation {
  return (property) => {
    const applied = applyLines(property, ctx);
    if (typeof applied === 'string') return applied;
    const first = applied[0];
    if (first === undefined || first.event.kind !== 'granted') return 'consent-incomplete';

    // Το έντυπο ειδοποιεί τον ιδιοκτήτη για αμφισβήτηση (Ε-12) ⇒ χρειάζεται ζωντανό σύνδεσμο.
    const link = ctx.input.who.kind === 'agency' ? issueMandateConsentLink(property.id, first.mandate.clientContactId) : null;
    const mandates = applied.reduce(
      (all, { mandate, event }) => replaceMandate(all, withEvent(mandate, event, link?.nonce ?? mandate.consentNonce)),
      property.mandates,
    );
    const next = { ...property, marketingAudience: first.event.audience, mandates, updatedAt: ctx.input.nowISO };
    return { next, applied, token: link?.token ?? null };
  };
}

export async function grantPrivateMarketing(adminDb: AdminFirestore, input: GrantInput): Promise<PrivateMarketingOutcome> {
  if (linesOf(input).length === 0) return { kind: 'refused', reason: 'consent-incomplete' };
  if (hasDuplicateAgency(linesOf(input))) return { kind: 'refused', reason: 'consent-request-stale' };

  const proof = await proofOf(adminDb, input);
  if (typeof proof === 'string') return { kind: 'refused', reason: proof };

  const names = await agencyNamesOf(adminDb, input);
  if (names === null) return { kind: 'absent' };

  const outcome = await mutateProperty(adminDb, input.ownerPropertyId, input.nowISO, grantMutation({ input, proof, names }));
  if (!isWritten(outcome)) return outcome;

  const saved = await finish(adminDb, outcome, input.who);
  if (input.who.kind === 'agency') await notifyOwner(adminDb, 'private-marketing-attestation-notice', outcome);
  return saved;
}

// =============================================================================
// 4. ΠΡΑΞΕΙΣ ΤΟΥ ΙΔΙΟΚΤΗΤΗ ΣΕ ΜΙΑ ΕΝΤΟΛΗ — εντοπισμός, συναλλαγή, ίχνος
// =============================================================================

interface OwnerMandateInput {
  readonly ownerPropertyId: string;
  readonly who: OwnerLinkActor | OwnerAccountActor;
  /** Ποιο γραφείο — `null` στον σύνδεσμο (η μία εντολή του). */
  readonly agencyCompanyId: string | null;
  readonly nowISO: string;
}

type MandateMutation = (property: OwnerProperty, mandate: BrokeredListingMandate) => Mutated | PrivateMarketingRefusal;

/** Ο **ένας** δρόμος για ανάκληση και άρνηση: η εντολή εντοπίζεται μέσα στη συναλλαγή, ποτέ πριν. */
async function mutateOwnerMandate(adminDb: AdminFirestore, input: OwnerMandateInput, mutate: MandateMutation): Promise<PrivateMarketingOutcome> {
  const outcome = await mutateProperty(adminDb, input.ownerPropertyId, input.nowISO, (property) => {
    const mandate = locateMandate(property, input.who, input.agencyCompanyId, input.nowISO);
    return mandate === null ? 'absent' : mutate(property, mandate);
  });
  return isWritten(outcome) ? finish(adminDb, outcome, input.who) : outcome;
}

/** Το γεγονός είναι **του** ιδιοκτήτη: κανάλι και χρήστης από τον ίδιο τον δράστη. */
function ownerEventOrigin(who: OwnerLinkActor | OwnerAccountActor): Pick<Extract<PrivateMarketingEvent, { kind: 'revoked' }>, 'channel' | 'actorUserId'> {
  return { channel: who.kind === 'owner-link' ? 'link' : 'account', actorUserId: actorUserIdOf(who) };
}

// =============================================================================
// 5. ΑΝΑΚΛΗΣΗ — ποτέ κλειστή χωρίς συναίνεση (Ε-13 · Α16)
// =============================================================================

export async function revokePrivateMarketing(
  adminDb: AdminFirestore,
  input: OwnerMandateInput & { readonly outcome: PrivateMarketingRevocationOutcome },
): Promise<PrivateMarketingOutcome> {
  return mutateOwnerMandate(adminDb, input, (property, mandate) => {
    // 🔑 Η **έξοδος** μένει πάντα ανοιχτή: και χωρίς ενεργή συναίνεση, αρκεί η διάθεση να είναι κλειστή.
    if (privateMarketingStandingOf(mandate).kind !== 'granted' && property.marketingAudience === 'public') {
      return 'consent-not-granted';
    }
    const event: PrivateMarketingEvent = {
      kind: 'revoked',
      id: generatePrivateMarketingEventId(),
      at: input.nowISO,
      outcome: input.outcome,
      ...ownerEventOrigin(input.who),
    };
    // ⚠️ Η απόσυρση γράφει **και** `public`: αποσυρμένη-κλειστή χωρίς συναίνεση θα ήταν ακόμη παραβίαση.
    const next: OwnerProperty = {
      ...property,
      marketingAudience: 'public',
      lifecycle: input.outcome === 'withdrawn' ? 'withdrawn' : property.lifecycle,
      mandates: replaceMandate(property.mandates, withEvent(mandate, event)),
      updatedAt: input.nowISO,
    };
    return { next, applied: [{ mandate, event }], token: null };
  });
}

// =============================================================================
// 6. ΑΡΝΗΣΗ — «μη μου ξαναστείλετε» (Adobe Acrobat Sign · Α35)
// =============================================================================

/**
 * Ο ιδιοκτήτης αρνείται το **εκκρεμές** αίτημα. Τίποτα ορατό δεν αλλάζει (το κοινό μένει ως έχει)·
 * φράζονται **μόνο** τα επόμενα αιτήματα του γραφείου για **αυτούς** τους όρους.
 */
export async function declinePrivateMarketing(
  adminDb: AdminFirestore,
  /** `requestId`: το αίτημα που αρνείται — αίτημα που άλλαξε στο μεταξύ **δεν** αρνείται σιωπηλά (Α19). */
  input: OwnerMandateInput & { readonly requestId: string },
): Promise<PrivateMarketingOutcome> {
  return mutateOwnerMandate(adminDb, input, (property, mandate) => {
    const standing = privateMarketingStandingOf(mandate);
    if (standing.kind !== 'requested') return 'consent-not-requested';
    if (standing.request.id !== input.requestId) return 'consent-request-stale';
    const event: PrivateMarketingEvent = {
      kind: 'declined',
      id: generatePrivateMarketingEventId(),
      at: input.nowISO,
      ...ownerEventOrigin(input.who),
      term: mandateTermOf(mandate),
    };
    const next: OwnerProperty = { ...property, mandates: replaceMandate(property.mandates, withEvent(mandate, event)), updatedAt: input.nowISO };
    return { next, applied: [{ mandate, event }], token: null };
  });
}
