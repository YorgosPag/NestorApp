/**
 * ADR-917 Λ10 · Α31 — a sync of the model never erases what the human typed on a managed BOQ row; on a
 * SUMMARY parent the price is derived (Ε2), so the model's 0 wins.
 */

import { buildGroupParentBoqRow, buildSingleEntityBoqRow } from '../boq-base-row';
import { HUMAN_OWNED_BOQ_FIELDS, withHumanOwnedFields } from '../boq-row-ownership';

const context = { companyId: 'c1', projectId: 'p1', buildingId: 'b1' };
const mapping = { categoryCode: 'OIK-3.05', titleEL: 'Τοίχος', unit: 'm2' } as const;

const humanEdits = {
  materialUnitCost: 12,
  laborUnitCost: 8,
  equipmentUnitCost: 1,
  status: 'submitted',
  notes: 'τιμή προσφοράς',
  wasteFactor: 0.05,
  linkedContractorId: 'cont_1',
};

describe('BOQ row ownership (Λ10 · Α31)', () => {
  it('🔴 the human\'s prices, status, notes, waste and links survive; the MODEL\'s quantity wins', () => {
    const built = buildSingleEntityBoqRow('boq_bim_w1', context, 'w1', 'wall', mapping, 42, null);
    const stored = { ...built, ...humanEdits, estimatedQuantity: 30 };
    const written = withHumanOwnedFields(built, stored);
    expect(written).toEqual(expect.objectContaining({ ...humanEdits, estimatedQuantity: 42 }));
  });

  it('🔴 Ε2: on a SUMMARY parent the prices are derived — the model\'s 0 replaces a legacy price', () => {
    const { payload } = buildGroupParentBoqRow('boq_bim_w2', context, 'w2', 'wall', mapping, 30, null, 'summary');
    const written = withHumanOwnedFields(payload, { ...payload, ...humanEdits });
    expect(written).toEqual(expect.objectContaining({ materialUnitCost: 0, laborUnitCost: 0, equipmentUnitCost: 0 }));
    expect(written).toEqual(expect.objectContaining({ status: 'submitted', notes: 'τιμή προσφοράς' }));
  });

  it('a WORK parent (column core) keeps its price — it is summed with its children', () => {
    const { payload } = buildGroupParentBoqRow('boq_bim_c1', context, 'c1', 'column', mapping, 1, null, 'work');
    expect(withHumanOwnedFields(payload, { ...payload, materialUnitCost: 90 }).materialUnitCost).toBe(90);
  });

  it('no stored row ⇒ the built defaults; a field absent from the stored row keeps the default', () => {
    const built = buildSingleEntityBoqRow('boq_bim_w3', context, 'w3', 'wall', mapping, 5, null);
    expect(withHumanOwnedFields(built, undefined)).toBe(built);
    expect(withHumanOwnedFields(built, { notes: 'x' }).materialUnitCost).toBe(0);
  });

  it('every human-owned field is a field the base row fills with a CONSTANT default (never a model field)', () => {
    const a = buildSingleEntityBoqRow('id', context, 'e1', 'wall', mapping, 1, null);
    const b = buildSingleEntityBoqRow('id', { ...context, floorId: 'f1' }, 'e2', 'slab', { ...mapping, unit: 'm3' }, 9, 'x');
    for (const field of HUMAN_OWNED_BOQ_FIELDS) expect([field, a[field]]).toEqual([field, b[field]]);
  });
});
