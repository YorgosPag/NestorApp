import 'server-only';

/**
 * @fileoverview ADR-943 §5.9 — **η πληρωμή της προκαταβολής με τον σύνδεσμο που ενέκρινε**: όψη, έναρξη, έκβαση απόπειρας.
 * @related issuance-invitation-answer.ts (η έγκριση) · server/payments/payment-checkout-launch.ts (ο πάροχος) ·
 *   server/payments/payment-payee-service.ts (`readyPayeeOf`) · services/document-registry/issuance-advance-payment.server.ts
 *   (η καταγραφή της είσπραξης + η κρατημένη μεταφορά)
 * @module server/issuance-invitations/issuance-advance-checkout
 *
 * 🔑 **Ποιος πληρώνει**: ο κάτοχος του συνδέσμου που **ενέκρινε** (`readRedeemedInvitationByToken`) — και μόνο όσο η απόφαση
 *    της ανάθεσης δείχνει **αυτό** το `invitationId` (βάση `owner-link-approval`). Νέα πρόταση/ακύρωση ⇒ `superseded`.
 * 🔑 **§29 ισχύει και εδώ**: σύνδεσμος με κωδικό ⇒ τίποτα για ακίνητο ή ποσό πριν τον κωδικό· κάθε πράξη τον φέρνει ξανά.
 * 🔑 **Σειρά της έναρξης** (Airbnb/Upwork: πρώτα τρόπος απόδοσης, μετά χρήματα): η προκαταβολή περιμένει πληρωμή → ο
 *    λογαριασμός έχει marketplace και τον τρόπο → ο μηχανικός είναι **ενεργός στον χώρο** και ο δικαιούχος του `authorized`
 *    **στο API** (αλλιώς ειδοποιείται και ο ιδιοκτήτης ακούει «περιμένουμε τον μηχανικό») → κλείνουν οι ανοιχτές συνεδρίες
 *    της ίδιας ανάθεσης → η συνεδρία γράφεται **πριν** από τον πάροχο → `split=1`.
 * 🔑 **Ποσό από τον διακομιστή** (`advanceStateOf`), ποτέ από τον πελάτη· η στιγμή του ρητού αιτήματος έναρξης (Κ-6) =
 *    η στιγμή της έναρξης, γραμμένη στη συνεδρία και από εκεί στο γεγονός `funded`.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { createBundleTranslate } from '@/i18n/bundle-translate';
import { isOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { documentRequestLocation } from '@/lib/document-validity/document-request-link';
import { publicUrl } from '@/lib/http/public-origin';
import type { IssuanceSpaceLink } from '@/services/email-templates/issuance-invitation-email';
import elRequest from '@/i18n/locales/el/document-request.json';
import enRequest from '@/i18n/locales/en/document-request.json';
import { issuanceStateOf, type IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { advanceStateOf, type AdvanceState } from '@/lib/document-validity/issuance-advance';
import { agreedQuoteOf } from '@/lib/document-validity/issuance-quote';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { trimmedStringOrNull } from '@/lib/type-guards';
import { readRedeemedInvitationByToken } from '@/server/invitations/invitation-redeem';
import type { IssuanceAdvancePayableSubject } from '@/server/payments/payable-subject';
import { closePendingCheckoutsOf } from '@/server/payments/payment-checkout-closing';
import { CHECKOUT_LIFETIME_MS, launchCheckoutAtProvider } from '@/server/payments/payment-checkout-launch';
import { createPaymentCheckout, readPaymentCheckout, type PaymentCheckoutRecord } from '@/server/payments/payment-checkout-store';
import { readyPayeeOf } from '@/server/payments/payment-payee-service';
import { readPaymentPayee } from '@/server/payments/payment-payee-store';
import type { PaymentProvider } from '@/server/payments/payment-provider';
import { paymentProviderForCompany } from '@/server/payments/payment-provider-registry';
import { attemptExpiresInMs, paymentAttemptOutcomeOf } from '@/server/accounting/payments/invoice-payment-attempt';
import { generatePaymentCheckoutId } from '@/services/enterprise-id.service';
import { readHostedIssuanceContext, type HostedIssuanceContext } from '@/services/document-registry/issuance-advance-payment.server';
import { issuanceRecordOf } from '@/services/document-registry/issuance-assignment-schema';
import type { OnlinePaymentMethod } from '@/subapps/accounting/types/online-payment';
import type {
  IssuanceAdvanceAttemptResponse,
  IssuanceAdvanceCheckoutBody,
  IssuanceAdvanceCheckoutResult,
  IssuanceAdvancePaymentView,
  IssuanceInvitation,
  IssuanceLinkGateView,
} from '@/types/issuance-invitation';

import { announcePayeeRequired } from './issuance-advance-notifier';
import { activeIssuanceEngagementOf } from './issuance-active-engagement';
import type { LinkRefused } from './issuance-invitation-answer';
import { ISSUANCE_INVITATION_LOCATOR, parseIssuanceInvitation } from './issuance-invitation-kind';
import { checkIssuanceAccessCode, issuanceGateViewOf } from './issuance-link-access';

/** Ο υπεύθυνος που ενέκρινε, η ανάθεση όπως τη βλέπει το γραφείο, και πού βρίσκεται η προκαταβολή. */
interface AdvancePayer {
  readonly invitation: IssuanceInvitation;
  readonly context: HostedIssuanceContext;
  readonly record: IssuanceAssignmentRecord;
  readonly state: AdvanceState;
}

type PayerResolution = { readonly ok: true; readonly payer: AdvancePayer } | LinkRefused | { readonly kind: 'unavailable' };

const SUPERSEDED: LinkRefused = { kind: 'refused', reason: 'superseded' };

/** Token ⇒ η πρόσκληση ενός **απαντημένου** συνδέσμου (ο ΕΝΑΣ δρόμος για όψη, έναρξη και έκβαση απόπειρας). */
async function readApprovingInvitation(
  db: Firestore, token: string, now: Date,
): Promise<{ readonly invitation: IssuanceInvitation } | LinkRefused | { readonly kind: 'unavailable' }> {
  const found = await readRedeemedInvitationByToken(db, ISSUANCE_INVITATION_LOCATOR, { token, nowValue: now.toISOString() });
  if (found.kind === 'secret-missing') return { kind: 'unavailable' };
  if (found.kind === 'refused') return { kind: 'refused', reason: found.reason };
  const invitation = parseIssuanceInvitation(found.stored, found.invitationId);
  return invitation === null ? { kind: 'unavailable' } : { invitation };
}

/** Η απόφαση της ανάθεσης είναι **η έγκριση αυτού του συνδέσμου** — και η ανάθεση είναι ανοιχτή, αναληφθείσα. */
function approvedByThisLink(record: IssuanceAssignmentRecord, latestIssuedOn: string | null, invitationId: string): boolean {
  const decision = record.decision;
  const state = issuanceStateOf(record, latestIssuedOn);
  return state.kind === 'open' && state.stage === 'accepted' && decision !== null && decision.outcome === 'approved'
    && decision.basis === 'owner-link-approval' && decision.invitationId === invitationId;
}

/** Token ⇒ ο κάτοχος του συνδέσμου που ενέκρινε **προσφορά με προκαταβολή**. Κάθε άλλη περίπτωση ⇒ ονομασμένη άρνηση. */
async function resolveAdvancePayer(db: Firestore, token: string, now: Date): Promise<PayerResolution> {
  const read = await readApprovingInvitation(db, token, now);
  if (!('invitation' in read)) return read;
  const { invitation } = read;
  if (invitation.audience !== 'owner') return SUPERSEDED;
  const context = await readHostedIssuanceContext(db, invitation.companyId, invitation.assignmentId, now);
  if (context === 'unknown') return { kind: 'unavailable' };
  if (context === null) return SUPERSEDED;
  const record = issuanceRecordOf(context.assignment);
  if (!approvedByThisLink(record, context.latestIssuedOn, invitation.id)) return SUPERSEDED;
  const state = advanceStateOf(record);
  return state.kind === 'none' ? SUPERSEDED : { ok: true, payer: { invitation, context, record, state } };
}

function marketplaceMethodsOf(provider: PaymentProvider | null): readonly OnlinePaymentMethod[] {
  return provider === null || provider.marketplace === null ? [] : provider.methods;
}

/** Ο μηχανικός της ανάθεσης: η **ενεργή** συμμετοχή του στον χώρο (ο ΕΝΑΣ δρόμος). `null` ⇒ δεν μπήκε / ανενεργή. */
function engineerUidOf(db: Firestore, payer: AdvancePayer, now: Date): Promise<string | null> {
  const { assignment, registry } = payer.context;
  return activeIssuanceEngagementOf(db, assignment, registry, now.toISOString()).then((engagement) => engagement?.uid ?? null);
}

/** Η όψη — **καμία** κλήση στον πάροχο, καμία εγγραφή (GET): ο δικαιούχος όπως τον ξέρουμε. */
async function advanceViewOf(db: Firestore, payer: AdvancePayer, now: Date): Promise<IssuanceAdvancePaymentView> {
  const { invitation, context, record } = payer;
  const provider = paymentProviderForCompany(invitation.companyId);
  const engineerUid = await engineerUidOf(db, payer, now);
  const payee = provider === null || engineerUid === null ? null : await readPaymentPayee(db, provider.id, engineerUid);
  const advance = agreedQuoteOf(record)?.advance ?? null;
  if (advance === null) throw new Error('advance state without agreed advance terms');
  return {
    recipientName: context.registry.people[invitation.contactId]?.name ?? null,
    officeName: await readWorkspaceName(invitation.companyId).then(trimmedStringOrNull, () => null),
    propertyLabel: context.label.name,
    documentKind: invitation.documentKind,
    professionalName: context.registry.people[record.professionalContactId]?.name ?? null,
    advance,
    state: payer.state.kind,
    methods: marketplaceMethodsOf(provider),
    payeeReady: payee?.status === 'authorized',
  };
}

export type AdvanceLanding =
  | { readonly kind: 'advance'; readonly advance: IssuanceAdvancePaymentView }
  | { readonly kind: 'code-required'; readonly gate: IssuanceLinkGateView }
  | LinkRefused
  | { readonly kind: 'unavailable' };

/**
 * **Η όψη της πληρωμής** για σύνδεσμο που απαντήθηκε (`already-used` στην όψη της απάντησης). Με κωδικό (§29): χωρίς
 * `accessCode` ⇒ μόνο η πύλη· με κωδικό ⇒ μία προσπάθεια, μετά η όψη. Καλείται από την όψη **και** το ξεκλείδωμα.
 */
export async function viewIssuanceAdvance(db: Firestore, token: string, accessCode: string | null, now: Date): Promise<AdvanceLanding> {
  const resolved = await resolveAdvancePayer(db, token, now);
  if (!('ok' in resolved)) return resolved;
  const { payer } = resolved;
  if (payer.invitation.accessCode !== null) {
    if (accessCode === null) {
      const recipientName = payer.context.registry.people[payer.invitation.contactId]?.name ?? null;
      const officeName = await readWorkspaceName(payer.invitation.companyId).then(trimmedStringOrNull, () => null);
      return { kind: 'code-required', gate: issuanceGateViewOf(payer.invitation, recipientName, officeName) };
    }
    const check = await checkIssuanceAccessCode(db, payer.invitation, accessCode, now.toISOString());
    if (!check.ok) return { kind: 'refused', reason: check.refusal, remaining: check.remaining };
  }
  return { kind: 'advance', advance: await advanceViewOf(db, payer, now) };
}

function providerDescriptionOf(payer: AdvancePayer, locale: 'el' | 'en'): string {
  const t = createBundleTranslate({ 'document-request': locale === 'el' ? elRequest : enRequest }, 'document-request', locale);
  return t('advance.providerDescription', { property: payer.context.label.name ?? payer.invitation.assignmentId });
}

function newAdvanceCheckout(payer: AdvancePayer, input: AdvanceCheckoutInput, provider: PaymentProvider, payeeReference: string, amountMinor: number): PaymentCheckoutRecord {
  const createdAt = input.now.toISOString();
  const subject: IssuanceAdvancePayableSubject = {
    kind: 'issuance-advance', companyId: payer.invitation.companyId, assignmentId: payer.invitation.assignmentId,
    withdrawalWaiverAt: createdAt,
  };
  return {
    checkoutId: generatePaymentCheckoutId(), companyId: payer.invitation.companyId, subject,
    provider: provider.id, method: input.body.method, amountMinor, currency: 'EUR', status: 'pending',
    providerReference: null, paymentReference: null, lastFailure: null,
    marketplace: { payeeReference, transferReference: null, transferDue: false, lease: null },
    createdAt, expiresAt: new Date(input.now.getTime() + CHECKOUT_LIFETIME_MS).toISOString(), updatedAt: createdAt,
  };
}

export interface AdvanceCheckoutInput {
  readonly body: IssuanceAdvanceCheckoutBody;
  readonly origin: string;
  readonly now: Date;
}

export type AdvanceCheckoutOutcome = { readonly kind: 'result'; readonly result: IssuanceAdvanceCheckoutResult } | LinkRefused | { readonly kind: 'unavailable' };

const refusedWith = (reason: Extract<IssuanceAdvanceCheckoutResult, { status: 'refused' }>['reason']): AdvanceCheckoutOutcome => (
  { kind: 'result', result: { status: 'refused', reason } }
);

/** Ο μηχανικός δέχεται πληρωμές; Αν όχι, ειδοποιείται (μία φορά τη μέρα) — ο ιδιοκτήτης ακούει «περιμένουμε τον μηχανικό». */
async function payeeReferenceOf(db: Firestore, payer: AdvancePayer, provider: PaymentProvider, now: Date): Promise<string | null> {
  const engineerUid = await engineerUidOf(db, payer, now);
  if (engineerUid === null) return null;
  const readiness = await readyPayeeOf(db, provider, engineerUid);
  if (readiness.kind === 'ready') return readiness.payeeReference;
  await announcePayeeRequired({ context: payer.context, engineerUid, now });
  return null;
}

/** **Η έναρξη πληρωμής προκαταβολής** — βλ. κεφαλίδα για τη σειρά. */
export async function startIssuanceAdvanceCheckout(db: Firestore, token: string, input: AdvanceCheckoutInput): Promise<AdvanceCheckoutOutcome> {
  const resolved = await resolveAdvancePayer(db, token, input.now);
  if (!('ok' in resolved)) return resolved;
  const { payer } = resolved;
  const check = await checkIssuanceAccessCode(db, payer.invitation, input.body.accessCode, input.now.toISOString());
  if (!check.ok) return { kind: 'refused', reason: check.refusal, remaining: check.remaining };
  if (payer.state.kind !== 'awaiting-payment') return refusedWith('not-payable');
  const provider = paymentProviderForCompany(payer.invitation.companyId);
  if (provider === null || !marketplaceMethodsOf(provider).includes(input.body.method)) return refusedWith('method-unavailable');
  const payeeReference = await payeeReferenceOf(db, payer, provider, input.now);
  if (payeeReference === null) return refusedWith('payee-not-ready');
  const record = newAdvanceCheckout(payer, input, provider, payeeReference, payer.state.amountMinor);
  await closePendingCheckoutsOf(db, provider, record.subject);
  await createPaymentCheckout(db, record);
  const result = await launchCheckoutAtProvider(db, provider, record, {
    description: providerDescriptionOf(payer, input.body.locale), locale: input.body.locale, origin: input.origin,
  });
  return { kind: 'result', result };
}

/**
 * Ο σύνδεσμος πληρωμής για την **απόδειξη έγκρισης** (email): ο **ίδιος** σύνδεσμος που ενέκρινε, μόνο αν η έγκριση άφησε
 * προκαταβολή που περιμένει πληρωμή. Λήγει μαζί με την υπογραφή του (`expiresAt` της πρόσκλησης). `null` ⇒ κανένα κουμπί.
 */
export function advancePaymentLinkOf(token: string, invitation: IssuanceInvitation, record: IssuanceAssignmentRecord | null): IssuanceSpaceLink | null {
  if (invitation.audience !== 'owner' || record === null || advanceStateOf(record).kind !== 'awaiting-payment') return null;
  const link = publicUrl(documentRequestLocation(token));
  return link === null ? null : { link, expiresAt: invitation.expiresAt };
}

/** **Η έκβαση μιας απόπειρας** — μόνο για συνεδρία της **ίδιας** ανάθεσης· ξένη ή ανύπαρκτη ⇒ ίδια άρνηση. */
export async function readIssuanceAdvanceAttempt(db: Firestore, token: string, checkoutId: string, now: Date): Promise<IssuanceAdvanceAttemptResponse | LinkRefused | { readonly kind: 'unavailable' }> {
  const read = await readApprovingInvitation(db, token, now);
  if (!('invitation' in read)) return read;
  const { invitation } = read;
  const record = await readPaymentCheckout(db, checkoutId);
  const subject = record?.subject;
  if (record === null || subject?.kind !== 'issuance-advance'
    || !isOwnedByCompany(subject, invitation.companyId) || subject.assignmentId !== invitation.assignmentId) {
    return { status: 'refused', reason: 'unknown-attempt' };
  }
  return { status: 'ok', attempt: paymentAttemptOutcomeOf(record), expiresInMs: attemptExpiresInMs(record, now.getTime()) };
}
