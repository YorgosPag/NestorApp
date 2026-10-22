/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Γ31 · Γ33 (Φ-Γ2 Σ4) — **η κρίση του Πρωτοκόλλου** και **τα σύνορα ανάγνωσής του**: πότε
 *   οφείλεται, ποια αναθεώρηση, ποτέ πρωτόκολλο που δεν αποδεικνύεται (Ο13). Καθαρές συναρτήσεις — καμία βάση.
 */

import { planHandoverProtocol } from '@/lib/property-handover/handover-protocol-plan';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import { handoverProtocolIdOf } from '@/lib/property-handover/property-handover-id';
import { propertyHandoverProtocolFromDocument } from '@/lib/property-handover/property-handover-protocol-from-document';
import type { PropertyHandover, PropertyHandoverFileDelivery } from '@/types/property-handover';
import type { PropertyHandoverProtocolPointer } from '@/types/property-handover-protocol';

const DIGEST_1 = 'a'.repeat(64);
const DIGEST_2 = 'b'.repeat(64);
const RECIPIENT = { userId: 'uid_anna', acceptedAt: '2026-10-20T09:00:00.000Z', dossierId: 'pdos_1' };

const delivery = (overrides: Partial<PropertyHandoverFileDelivery> = {}): PropertyHandoverFileDelivery => ({
  state: 'delivered', delivered: 2, total: 2, awaitingReview: 0, bytes: 200, digest: DIGEST_1,
  startedAt: '2026-10-21T08:00:00.000Z', completedAt: '2026-10-21T08:05:00.000Z', lastError: null, unverifiable: 0,
  ...overrides,
});

const pointer = (overrides: Partial<PropertyHandoverProtocolPointer> = {}): PropertyHandoverProtocolPointer => ({
  protocolId: handoverProtocolIdOf('phov_1', DIGEST_1), revision: 1, digest: DIGEST_1, issuedAt: '2026-10-21T08:06:00.000Z',
  companyFileId: 'file_company_1', recipientFileId: 'file_recipient_1',
  ...overrides,
});

type PlanInput = Parameters<typeof planHandoverProtocol>[0];
const handover = (overrides: Partial<PlanInput> = {}): PlanInput => ({
  id: 'phov_1', lifecycle: 'ready', recipient: RECIPIENT, fileDelivery: delivery(), protocol: null, ...overrides,
});

describe('Γ31 — οφείλεται Πρωτόκολλο ΜΟΝΟ πάνω σε πλήρως αποδεδειγμένο καθολικό', () => {
  it.each<[string, Partial<PlanInput>]>([
    ['πώληση σε αναμονή', { lifecycle: 'awaiting-completion' }],
    ['ακυρωμένη', { lifecycle: 'cancelled' }],
    ['χωρίς αποδεκτή πρόσκληση', { recipient: null }],
    ['καμία εκτέλεση ακόμη', { fileDelivery: null }],
  ])('%s ⇒ not-ready', (_, overrides) => {
    expect(planHandoverProtocol(handover(overrides))).toEqual({ kind: 'not-due', reason: 'not-ready', unverifiable: 0 });
  });

  it('η παράδοση συνεχίζεται ⇒ not-delivered', () => {
    expect(planHandoverProtocol(handover({ fileDelivery: delivery({ state: 'delivering', digest: null }) })))
      .toEqual({ kind: 'not-due', reason: 'not-delivered', unverifiable: 0 });
  });

  it('🔴 Ο13 — γραμμή χωρίς αποδείξιμα bytes ⇒ ΚΑΝΕΝΑ πρωτόκολλο, ονομασμένο για το γραφείο', () => {
    expect(planHandoverProtocol(handover({ fileDelivery: delivery({ state: 'delivering', digest: null, unverifiable: 2 }) })))
      .toEqual({ kind: 'not-due', reason: 'unverifiable-rows', unverifiable: 2 });
  });

  it('ζώνη ασφαλείας: `delivered` χωρίς αποτύπωμα ⇒ digest-pending, ποτέ πρωτόκολλο', () => {
    expect(planHandoverProtocol(handover({ fileDelivery: delivery({ digest: null }) })).kind).toBe('not-due');
  });

  it('πρώτη φορά ⇒ αναθεώρηση 1, χωρίς supersedes, με id από (παράδοση, αποτύπωμα)', () => {
    expect(planHandoverProtocol(handover())).toEqual({
      kind: 'due', protocolId: handoverProtocolIdOf('phov_1', DIGEST_1), ledgerDigest: DIGEST_1, revision: 1, supersedesProtocolId: null,
    });
  });

  it('ιδεμπότητα: ο δείκτης σφραγίζει ήδη ΑΥΤΟ το καθολικό ⇒ current', () => {
    expect(planHandoverProtocol(handover({ protocol: pointer() }))).toEqual({ kind: 'current', protocolId: pointer().protocolId });
  });

  it('συμπλήρωση (Δ5) ⇒ αναθεώρηση N+1 που αντικαθιστά την N', () => {
    const plan = planHandoverProtocol(handover({ protocol: pointer({ revision: 3 }), fileDelivery: delivery({ digest: DIGEST_2 }) }));
    expect(plan).toEqual({
      kind: 'due', protocolId: handoverProtocolIdOf('phov_1', DIGEST_2), ledgerDigest: DIGEST_2, revision: 4,
      supersedesProtocolId: pointer().protocolId,
    });
  });

  it('το id διακρίνει αποτύπωμα ΚΑΙ παράδοση', () => {
    const ids = new Set([handoverProtocolIdOf('phov_1', DIGEST_1), handoverProtocolIdOf('phov_1', DIGEST_2), handoverProtocolIdOf('phov_2', DIGEST_1)]);
    expect(ids.size).toBe(3);
    expect(handoverProtocolIdOf('phov_1', DIGEST_1)).toMatch(/^phpr_/);
  });
});

const STORED_HANDOVER = {
  companyId: 'comp_1', propertyId: 'prop_1', recipientContactId: 'cont_1', lifecycle: 'ready', completion: null,
  recipient: RECIPIENT, invitation: null, createdAt: 'x', updatedAt: 'y',
};

describe('Γ33 — τα σύνορα ανάγνωσης κρατούν τον δείκτη και τη μέτρηση του Ο13', () => {
  it('ο δείκτης διαβάζεται αυτούσιος · αδιάβαστος ⇒ null (ποτέ μισός δείκτης)', () => {
    expect(propertyHandoverFromDocument({ ...STORED_HANDOVER, protocol: pointer() }, 'phov_1')?.protocol).toEqual(pointer());
    expect(propertyHandoverFromDocument({ ...STORED_HANDOVER, protocol: { ...pointer(), revision: 0 } }, 'phov_1')?.protocol).toBeNull();
    expect(propertyHandoverFromDocument(STORED_HANDOVER, 'phov_1')?.protocol).toBeNull();
  });

  it('πρόοδος πριν τη Σ4 ⇒ unverifiable 0 · αποθηκευμένη ⇒ αυτούσια', () => {
    const { unverifiable: _, ...legacy } = delivery();
    expect(propertyHandoverFromDocument({ ...STORED_HANDOVER, fileDelivery: legacy }, 'phov_1')?.fileDelivery?.unverifiable).toBe(0);
    const stored = delivery({ state: 'delivering', unverifiable: 3 });
    expect(propertyHandoverFromDocument({ ...STORED_HANDOVER, fileDelivery: stored }, 'phov_1')?.fileDelivery?.unverifiable).toBe(3);
  });

  const PROTOCOL = {
    ...pointer(), protocolId: 'ignored', companyId: 'comp_1', propertyId: 'prop_1', handoverId: 'phov_1', recipientUserId: 'uid_anna',
    supersedesProtocolId: null, pdfSha256: 'c'.repeat(64), legalText: { version: 1, digest: 'sha256:abc' }, rows: 2, bytes: 200,
  };

  it('το πρωτόκολλο διαβάζεται με την ταυτότητα ΑΠΟ ΕΞΩ', () => {
    const read = propertyHandoverProtocolFromDocument(PROTOCOL, 'phpr_outside');
    expect(read?.protocolId).toBe('phpr_outside');
    expect(read?.legalText).toEqual({ version: 1, digest: 'sha256:abc' });
  });

  it.each<[string, Record<string, unknown>]>([
    ['pdfSha256 όχι hex', { pdfSha256: 'XYZ' }],
    ['χωρίς έκδοση κειμένου', { legalText: null }],
    ['supersedes κενό', { supersedesProtocolId: '' }],
    ['χωρίς κάτοχο', { companyId: '' }],
  ])('%s ⇒ null', (_, overrides) => {
    expect(propertyHandoverProtocolFromDocument({ ...PROTOCOL, ...overrides }, 'phpr_1')).toBeNull();
  });
});
