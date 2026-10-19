/**
 * ADR-916 §7 Α6–Α10 — η συμφιλίωση «πώληση ⇒ παραδόσεις».
 */

import { planPropertyHandovers, propertyHandoverSnapshotOf, type PropertyHandoverSnapshot } from '../handover-plan';
import { propertyHandoverIdOf } from '../property-handover-id';
import type { PropertyHandover } from '@/types/property-handover';

const NOW = '2026-10-19T12:00:00.000Z';
const LATER = '2026-10-20T09:00:00.000Z';
const COMPANY = 'comp_test';
const PROPERTY = 'prop_test';

function property(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    companyId: COMPANY,
    commercialStatus: 'sold',
    commercial: {
      owners: [
        { contactId: 'cont_anna', ownershipPct: 50, role: 'buyer' },
        { contactId: 'cont_nikos', ownershipPct: 50, role: 'buyer' },
      ],
      legalPhase: 'preliminary_signed',
    },
    ...overrides,
  };
}

function snapshotOf(raw: Record<string, unknown>): PropertyHandoverSnapshot {
  const snapshot = propertyHandoverSnapshotOf(PROPERTY, raw);
  if (!snapshot) throw new Error('expected a snapshot');
  return snapshot;
}

/** Εφαρμόζει το σχέδιο πάνω στις υπάρχουσες — η «βάση» μετά τη συναλλαγή. */
function apply(existing: readonly PropertyHandover[], raw: Record<string, unknown>, now: string): PropertyHandover[] {
  const byId = new Map(existing.map((h) => [h.id, h]));
  for (const write of planPropertyHandovers(snapshotOf(raw), existing, now)) byId.set(write.after.id, write.after);
  return [...byId.values()];
}

describe('propertyHandoverSnapshotOf', () => {
  it('ακίνητο χωρίς μισθωτή ⇒ κανένα στιγμιότυπο (ποτέ εφευρημένος κάτοχος)', () => {
    expect(propertyHandoverSnapshotOf(PROPERTY, property({ companyId: '' }))).toBeNull();
  });

  it('κράτηση ⇒ ανοιχτή, όχι ολοκληρωμένη', () => {
    const snapshot = snapshotOf(property({ commercialStatus: 'reserved' }));
    expect(snapshot.open).toBe(true);
    expect(snapshot.completed).toBe(false);
  });

  it('προς πώληση ⇒ κλειστή', () => {
    expect(snapshotOf(property({ commercialStatus: 'for-sale' })).open).toBe(false);
  });

  it('το παλιό κάτοπτρο `status` μετρά μόνο όταν λείπει το κανονικό (resolveCommercialStatus)', () => {
    expect(snapshotOf(property({ commercialStatus: undefined, status: 'sold' })).open).toBe(true);
  });

  it('άγνωστη νομική φάση ⇒ όχι ολοκληρωμένη (ποτέ από εικασία)', () => {
    const raw = property({ commercial: { owners: [{ contactId: 'cont_anna' }], legalPhase: 'signed-ish' } });
    expect(snapshotOf(raw).completed).toBe(false);
  });

  it('Α10 — ο οικοπεδούχος ΔΕΝ είναι παραλήπτης', () => {
    const raw = property({
      commercial: { owners: [{ contactId: 'cont_land', role: 'landowner' }, { contactId: 'cont_anna', role: 'buyer' }] },
    });
    expect(snapshotOf(raw).recipientContactIds).toEqual(['cont_anna']);
  });
});

describe('planPropertyHandovers', () => {
  it('Α6 — δέσμευση ⇒ μία παράδοση `awaiting-completion` ανά αγοραστή (Α8: συνιδιοκτήτες χωριστά)', () => {
    const handovers = apply([], property(), NOW);
    expect(handovers.map((h) => [h.recipientContactId, h.lifecycle])).toEqual([
      ['cont_anna', 'awaiting-completion'],
      ['cont_nikos', 'awaiting-completion'],
    ]);
    expect(handovers[0].id).toBe(propertyHandoverIdOf(COMPANY, PROPERTY, 'cont_anna'));
    expect(handovers[0].completion).toBeNull();
  });

  it('Α6 — οριστικό ⇒ `ready` με ολοκλήρωση γραμμένη ΜΙΑ φορά', () => {
    const opened = apply([], property(), NOW);
    const signed = property({ commercial: { ...(property().commercial as object), legalPhase: 'final_signed' } });
    const ready = apply(opened, signed, LATER);
    expect(ready.every((h) => h.lifecycle === 'ready')).toBe(true);
    expect(ready[0].completion).toEqual({ source: 'final-contract', at: LATER });
    expect(ready[0].createdAt).toBe(NOW);
    // ξανά αργότερα: η ολοκλήρωση ΔΕΝ ξαναγράφεται
    expect(planPropertyHandovers(snapshotOf(signed), ready, '2026-11-01T00:00:00.000Z')).toEqual([]);
  });

  it('Α7 — ιδεμπότητα: ίδια κατάσταση ⇒ ΜΗΔΕΝ εγγραφές', () => {
    const opened = apply([], property(), NOW);
    expect(planPropertyHandovers(snapshotOf(property()), opened, LATER)).toEqual([]);
  });

  it('Α6 — ακύρωση πριν την ολοκλήρωση ⇒ `cancelled`', () => {
    const opened = apply([], property(), NOW);
    const reverted = apply(opened, property({ commercialStatus: 'for-sale' }), LATER);
    expect(reverted.every((h) => h.lifecycle === 'cancelled')).toBe(true);
  });

  it('Α8 — ιδιοκτήτης που αφαιρέθηκε ⇒ `cancelled` ΜΟΝΟ ο δικός του', () => {
    const opened = apply([], property(), NOW);
    const onlyAnna = property({ commercial: { owners: [{ contactId: 'cont_anna', role: 'buyer' }] } });
    const result = apply(opened, onlyAnna, LATER);
    expect(Object.fromEntries(result.map((h) => [h.recipientContactId, h.lifecycle]))).toEqual({
      cont_anna: 'awaiting-completion',
      cont_nikos: 'cancelled',
    });
  });

  it('Α9 — `ready` είναι κολλώδες: η ακύρωση ΜΕΤΑ την ολοκλήρωση δεν το γυρίζει πίσω', () => {
    const signed = property({ commercial: { ...(property().commercial as object), legalPhase: 'final_signed' } });
    const ready = apply([], signed, NOW);
    const reverted = property({ commercialStatus: 'for-sale', commercial: { owners: [], legalPhase: 'none' } });
    expect(planPropertyHandovers(snapshotOf(reverted), ready, LATER)).toEqual([]);
  });

  it('Α9 — `ready` κολλώδες και όταν ο αγοραστής ΜΕΝΕΙ αλλά η νομική φάση γυρίζει πίσω', () => {
    const signed = property({ commercial: { ...(property().commercial as object), legalPhase: 'final_signed' } });
    const ready = apply([], signed, NOW);
    expect(planPropertyHandovers(snapshotOf(property()), ready, LATER)).toEqual([]);
  });

  it('η ακυρωμένη ξανανοίγει στην ΙΔΙΑ ταυτότητα όταν η επαφή ξαναγίνει αγοραστής', () => {
    const cancelled = apply(apply([], property(), NOW), property({ commercialStatus: 'for-sale' }), LATER);
    const reopened = apply(cancelled, property(), '2026-10-21T00:00:00.000Z');
    expect(reopened.map((h) => h.lifecycle)).toEqual(['awaiting-completion', 'awaiting-completion']);
    expect(reopened.map((h) => h.id)).toEqual(cancelled.map((h) => h.id));
  });

  it('η ταυτότητα δένει και τον μισθωτή — άλλος μισθωτής, άλλο έγγραφο', () => {
    expect(propertyHandoverIdOf('comp_a', PROPERTY, 'cont_anna')).not.toBe(propertyHandoverIdOf('comp_b', PROPERTY, 'cont_anna'));
  });
});
