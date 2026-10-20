/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Γ1–Γ6 — **η κρίση της αντιγραφής**: τι αντιγράφεται τώρα, με ποιον δεσμό αναθεώρησης, και το
 *   αποτύπωμα του καθολικού. Καθαρές συναρτήσεις — καμία βάση, κανένας κάδος.
 */

import {
  fileDeliveryStateOf,
  handoverDeliveryDigest,
  planHandoverDelivery,
  type HandoverDeliveredRow,
} from '@/lib/property-handover/handover-delivery-plan';
import type { PropertyHandoverFileDelivery } from '@/types/property-handover';

const row = (sourceFileId: string, copyFileId = `copy_${sourceFileId}`): HandoverDeliveredRow =>
  ({ sourceFileId, copyFileId, crc32c: `crc_${sourceFileId}`, size: 100 });
const files = (...ids: string[]) => ids.map((sourceFileId) => ({ sourceFileId }));
const NO_PREDECESSORS = new Map<string, string>();

const RECIPIENT = { userId: 'uid_anna', acceptedAt: '2026-10-20T09:00:00.000Z', dossierId: 'pdos_1' };
const DELIVERED: PropertyHandoverFileDelivery = {
  state: 'delivered', delivered: 2, total: 2, awaitingReview: 0, bytes: 200, digest: 'd', startedAt: 'a', completedAt: 'b', lastError: null,
};

describe('Γ1 — οφείλεται αντιγραφή ΜΟΝΟ σε ολοκληρωμένη πώληση ΜΕ αποδεκτή πρόσκληση', () => {
  it.each([
    ['σε αναμονή ολοκλήρωσης, με παραλήπτη', { lifecycle: 'awaiting-completion', recipient: RECIPIENT, fileDelivery: null }, null],
    ['ολοκληρωμένη, χωρίς παραλήπτη (δεν υπάρχει φάκελος-προορισμός)', { lifecycle: 'ready', recipient: null, fileDelivery: null }, null],
    ['ακυρωμένη', { lifecycle: 'cancelled', recipient: RECIPIENT, fileDelivery: null }, null],
    ['ολοκληρωμένη + παραλήπτης, ποτέ δεν ξεκίνησε', { lifecycle: 'ready', recipient: RECIPIENT, fileDelivery: null }, 'pending'],
    ['ολοκληρωμένη + παραλήπτης, παραδομένη', { lifecycle: 'ready', recipient: RECIPIENT, fileDelivery: DELIVERED }, 'delivered'],
  ] as const)('%s ⇒ %s', (_case, handover, expected) => {
    expect(fileDeliveryStateOf(handover)).toBe(expected);
  });
});

describe('Γ2–Γ5 — το σχέδιο της εκτέλεσης', () => {
  it('Γ2 — αντιγράφει ΜΟΝΟ ό,τι λείπει από το καθολικό (συνέχιση μετά από διακοπή = ο ίδιος κώδικας)', () => {
    const plan = planHandoverDelivery({ deliverable: files('f3', 'f1', 'f2'), delivered: [row('f1')], predecessorOf: NO_PREDECESSORS, budget: 10 });
    expect(plan.copies.map((copy) => copy.deliverable.sourceFileId)).toEqual(['f2', 'f3']);
    expect(plan).toMatchObject({ remaining: 0, total: 3 });
  });

  it('Γ3 — ιδεμπότητα: όλα παραδομένα ⇒ ΚΑΜΙΑ αντιγραφή', () => {
    const plan = planHandoverDelivery({ deliverable: files('f1', 'f2'), delivered: [row('f1'), row('f2')], predecessorOf: NO_PREDECESSORS, budget: 10 });
    expect(plan).toEqual({ copies: [], remaining: 0, total: 2 });
  });

  it('Γ4 — νέα αναθεώρηση πηγής ⇒ ΝΕΟ αντίγραφο δεμένο με το αντίγραφο της προηγούμενης· η παλιά μένει στο σύνολο (ιστορικό)', () => {
    const plan = planHandoverDelivery({
      deliverable: files('manual_v2'), delivered: [row('manual_v1', 'copy_v1')], predecessorOf: new Map([['manual_v2', 'manual_v1']]), budget: 10,
    });
    expect(plan.copies).toEqual([{ deliverable: { sourceFileId: 'manual_v2' }, revisionOfFileId: 'copy_v1' }]);
    expect(plan.total).toBe(2);
  });

  it('Γ4β — προκάτοχος που ΔΕΝ παραδόθηκε ποτέ ⇒ `revisionOfFileId: null`, ποτέ δεσμός σε ανύπαρκτο αντίγραφο', () => {
    const plan = planHandoverDelivery({
      deliverable: files('manual_v2'), delivered: [], predecessorOf: new Map([['manual_v2', 'manual_v1']]), budget: 10,
    });
    expect(plan.copies[0]?.revisionOfFileId).toBeNull();
  });

  it('Γ5 — ο προϋπολογισμός κόβει με ΣΤΑΘΕΡΗ σειρά και λέει πόσα μένουν', () => {
    const plan = planHandoverDelivery({ deliverable: files('c', 'a', 'd', 'b'), delivered: [], predecessorOf: NO_PREDECESSORS, budget: 2 });
    expect(plan.copies.map((copy) => copy.deliverable.sourceFileId)).toEqual(['a', 'b']);
    expect(plan).toMatchObject({ remaining: 2, total: 4 });
  });

  it('Γ5β — πηγή που ΣΒΗΣΤΗΚΕ μετά την παράδοση μένει στο σύνολο: ό,τι παραδόθηκε δεν αφαιρείται (Δ5 · Δ8)', () => {
    const plan = planHandoverDelivery({ deliverable: files('f2'), delivered: [row('f1'), row('f2')], predecessorOf: NO_PREDECESSORS, budget: 10 });
    expect(plan).toEqual({ copies: [], remaining: 0, total: 2 });
  });
});

describe('Γ6 — το αποτύπωμα του καθολικού', () => {
  it('ανεξάρτητο της σειράς εγγραφής · αλλάζει με ΟΠΟΙΑΔΗΠΟΤΕ γραμμή · κενό ⇒ `null`', async () => {
    const forward = await handoverDeliveryDigest([row('f1'), row('f2')]);
    expect(forward).toMatch(/^[0-9a-f]{64}$/);
    expect(await handoverDeliveryDigest([row('f2'), row('f1')])).toBe(forward);
    expect(await handoverDeliveryDigest([row('f1'), { ...row('f2'), crc32c: 'tampered' }])).not.toBe(forward);
    expect(await handoverDeliveryDigest([])).toBeNull();
  });
});
