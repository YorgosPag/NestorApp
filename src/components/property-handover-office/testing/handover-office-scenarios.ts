/**
 * @fileoverview **Ο πίνακας σεναρίων της καρτέλας «Παράδοση»** — ένα σενάριο ανά λόγο της κρίσης (ADR-916 §5.15 Φ-Δ).
 * @related lib/property-handover/handover-office-status.ts (η κρίση) · PropertyHandoverOfficeHarness.tsx (η γκαλερί)
 * @module components/property-handover-office/testing/handover-office-scenarios
 *
 * 🔑 **Ένας πίνακας, δύο καταναλωτές**: οι άγκυρες της κρίσης και η γκαλερί διαβάζουν **αυτά** τα σενάρια — άρα η γκαλερί
 *    δεν μπορεί να δείχνει κατάσταση που η κρίση δεν παράγει, ούτε η κρίση να έχει λόγο που κανείς δεν είδε. Κάθε σενάριο
 *    **δηλώνει** τον λόγο που περιμένει· ο ίδιος ο πίνακας ελέγχεται ότι καλύπτει **όλους** τους λόγους.
 *
 * ⚠️ Συνθετικά δεδομένα μόνο — κανένα πρόσωπο, κανένα email πραγματικό.
 */

import type { HandoverOfficeContext } from '@/lib/property-handover/handover-office-status';
import type {
  HandoverOfficeReason,
  HandoverOfficeSignal,
  PropertyHandover,
  PropertyHandoverFileDelivery,
  PropertyHandoverInvitationLink,
  PropertyHandoverWithdrawal,
} from '@/types/property-handover';
import type { PropertyHandoverProtocolPointer } from '@/types/property-handover-protocol';

/** «Τώρα» των σεναρίων — σταθερό, ώστε λήξεις και «λήγει σύντομα» να είναι ντετερμινιστικά. */
export const SCENARIO_NOW = '2026-10-22T09:00:00.000Z';
const ISSUED_AT = '2026-10-01T09:00:00.000Z';
const DIGEST = 'c'.repeat(64);
const RECIPIENT = { userId: 'uid_buyer', acceptedAt: '2026-10-05T09:00:00.000Z', dossierId: 'pdos_demo' };
const CONTACT = 'cont_buyer';

export function handoverFixture(overrides: Partial<PropertyHandover> = {}): PropertyHandover {
  return {
    id: 'phov_demo', companyId: 'comp_demo', propertyId: 'prop_demo', recipientContactId: CONTACT,
    lifecycle: 'ready', completion: { source: 'final-contract', at: '2026-10-10T09:00:00.000Z' },
    recipient: RECIPIENT, invitation: issuedInvitation({ delivery: 'accepted' }), fileDelivery: null, protocol: null, withdrawal: null,
    createdAt: ISSUED_AT, updatedAt: ISSUED_AT,
    ...overrides,
  };
}

export function issuedInvitation(
  overrides: Partial<Extract<PropertyHandoverInvitationLink, { status: 'issued' }>> = {},
): PropertyHandoverInvitationLink {
  return {
    status: 'issued', invitationId: 'phin_demo', inviteeEmail: 'buyer@example.test', occasion: 'completion',
    issuedAt: ISSUED_AT, expiresAt: '2026-10-31T09:00:00.000Z', delivery: 'accepted', deliveryAttempts: 1,
    remindedAt: null, declinedAt: null,
    ...overrides,
  };
}

export function fileDeliveryFixture(overrides: Partial<PropertyHandoverFileDelivery> = {}): PropertyHandoverFileDelivery {
  return {
    state: 'delivered', delivered: 6, total: 6, awaitingReview: 0, bytes: 4_200_000, digest: DIGEST,
    startedAt: '2026-10-11T09:00:00.000Z', completedAt: '2026-10-11T09:04:00.000Z', lastError: null, unverifiable: 0,
    ...overrides,
  };
}

export function protocolPointerFixture(overrides: Partial<PropertyHandoverProtocolPointer> = {}): PropertyHandoverProtocolPointer {
  return {
    protocolId: 'phpr_00000000-0000-4000-8000-000000000001', revision: 1, digest: DIGEST,
    issuedAt: '2026-10-11T09:10:00.000Z', companyFileId: 'file_protocol_company', recipientFileId: 'file_protocol_buyer',
    ...overrides,
  };
}

/** Φ-Δ.5 — μια ανακλημένη παράδοση που είχε παραδώσει αρχεία (ό,τι παραδόθηκε μένει). */
export function withdrawnFixture(
  notice: PropertyHandoverWithdrawal['notice'] = { delivery: 'accepted', attempts: 1 },
): Partial<PropertyHandover> {
  return {
    lifecycle: 'withdrawn', fileDelivery: fileDeliveryFixture(), protocol: protocolPointerFixture(),
    withdrawal: { reason: 'Η πώληση ακυρώθηκε με δικαστική απόφαση.', withdrawnBy: 'uid_office', withdrawnAt: '2026-10-21T09:00:00.000Z', notice },
  };
}

export interface HandoverOfficeScenario {
  readonly id: string;
  readonly handover: PropertyHandover;
  readonly context: HandoverOfficeContext;
  readonly expected: { readonly reason: HandoverOfficeReason; readonly signals: readonly HandoverOfficeSignal[] };
}

const OPEN_SALE: HandoverOfficeContext['snapshot'] = { open: true, recipientContactIds: [CONTACT] };
/** Η πώληση έπεσε μετά την ολοκλήρωση (Ο4). */
const REVERTED_SALE: HandoverOfficeContext['snapshot'] = { open: false, recipientContactIds: [] };
const context = (overrides: Partial<HandoverOfficeContext> = {}): HandoverOfficeContext => ({
  snapshot: OPEN_SALE, sealConfigured: true, nowValue: SCENARIO_NOW, ...overrides,
});
const pendingBuyer = (invitation: PropertyHandoverInvitationLink | null): Partial<PropertyHandover> => ({
  lifecycle: 'awaiting-completion', completion: null, recipient: null, invitation,
});

const scenario = (
  id: string,
  reason: HandoverOfficeReason,
  handover: Partial<PropertyHandover>,
  options: { readonly context?: Partial<HandoverOfficeContext>; readonly signals?: readonly HandoverOfficeSignal[] } = {},
): HandoverOfficeScenario => ({
  id, handover: handoverFixture(handover), context: context(options.context), expected: { reason, signals: options.signals ?? [] },
});

/** Ένα σενάριο ανά λόγο, με τη σειρά προτεραιότητας της κρίσης — και όσα σήματα χρειάζονται δικό τους πάνελ. */
export const HANDOVER_OFFICE_SCENARIOS: readonly HandoverOfficeScenario[] = [
  scenario('cancelled', 'cancelled', { ...pendingBuyer(null), lifecycle: 'cancelled' }),
  scenario('withdrawn', 'withdrawn', withdrawnFixture(), { context: { snapshot: REVERTED_SALE } }),
  scenario('withdrawn-notice-undelivered', 'withdrawn', withdrawnFixture({ delivery: 'no-address', attempts: 1 }), {
    context: { snapshot: REVERTED_SALE }, signals: ['withdrawal-notice-undelivered'],
  }),
  scenario('withdrawn-buyer-again', 'withdrawn', withdrawnFixture(), { signals: ['buyer-again'] }),
  scenario('sale-reverted', 'sale-reverted', { fileDelivery: fileDeliveryFixture() }, { context: { snapshot: REVERTED_SALE } }),
  scenario('invitation-not-issued', 'invitation-not-issued', pendingBuyer(null)),
  scenario('no-address', 'no-address', pendingBuyer({ status: 'no-address', checkedAt: ISSUED_AT })),
  scenario('invitation-undeliverable', 'invitation-undeliverable', pendingBuyer(issuedInvitation({ delivery: 'unaddressable' }))),
  scenario('invitation-retrying', 'invitation-retrying', pendingBuyer(issuedInvitation({ delivery: 'failed', deliveryAttempts: 2 }))),
  scenario('declined', 'declined', pendingBuyer(issuedInvitation({ declinedAt: '2026-10-03T09:00:00.000Z' }))),
  scenario('invitation-expired', 'invitation-expired', pendingBuyer(issuedInvitation({ expiresAt: '2026-10-20T09:00:00.000Z' }))),
  scenario('awaiting-buyer', 'awaiting-buyer', pendingBuyer(issuedInvitation())),
  scenario('awaiting-buyer-expiring', 'awaiting-buyer', pendingBuyer(issuedInvitation({ expiresAt: '2026-10-25T09:00:00.000Z' })), { signals: ['invitation-expiring'] }),
  scenario('awaiting-completion', 'awaiting-completion', { lifecycle: 'awaiting-completion', completion: null }),
  scenario('delivery-queued', 'delivery-queued', {}),
  scenario('delivering', 'delivering', { fileDelivery: fileDeliveryFixture({ state: 'delivering', delivered: 2, digest: null, completedAt: null }) }),
  scenario('files-awaiting-review', 'delivering', { fileDelivery: fileDeliveryFixture({ state: 'delivering', delivered: 4, awaitingReview: 2, digest: null, completedAt: null }) }, { signals: ['files-awaiting-review'] }),
  scenario('unverifiable-rows', 'unverifiable-rows', { fileDelivery: fileDeliveryFixture({ state: 'delivering', digest: null, unverifiable: 1 }) }),
  scenario('digest-pending', 'digest-pending', { fileDelivery: fileDeliveryFixture({ digest: null }) }),
  scenario('awaiting-seal-configuration', 'awaiting-seal-configuration', { fileDelivery: fileDeliveryFixture() }, { context: { sealConfigured: false } }),
  scenario('protocol-due', 'protocol-due', { fileDelivery: fileDeliveryFixture() }),
  scenario('sealed', 'sealed', { fileDelivery: fileDeliveryFixture(), protocol: protocolPointerFixture() }),
];
