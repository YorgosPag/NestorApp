/**
 * ADR-917 §7 Α20–Α24 — «μετράει αυτή η γραμμή;» (Λ7).
 * Κάθε `it` ονομάζει τη μετάλλαξη που υπάρχει για να πιάσει.
 */

import {
  countableBoqLines,
  excludedSummaryIds,
  isSummaryBoqLine,
  writesDerivedPrice,
  partitionCountableBoqLines,
  resolveBoqGroupRole,
  type BoqRoleInput,
} from '../boq-line-role';
import { computeBuildingSummary } from '../cost-engine';
import { deriveSummaryCost, derivedSummaryCosts, groupBoqCost } from '../boq-cost-groups';
import { normalizeBOQItem } from '../boq-document-normalize';
import type { BOQItem } from '@/types/boq';

const ids = (items: readonly BoqRoleInput[]): string[] => items.map((item) => item.id);

/** Τοίχος DNA: γονέας-σύνοψη + μία γραμμή ανά στρώση (μαζί με τον πυρήνα) */
const dnaWall = (groupRole: BOQItem['groupRole'] | undefined): BoqRoleInput[] => [
  { id: 'boq_bim_w1', isGroupParent: true, groupRole, sourceEntityType: 'wall' },
  { id: 'boq_bim_w1_layer_core', parentBoqItemId: 'boq_bim_w1', isGroupParent: false, sourceEntityType: 'wall' },
  { id: 'boq_bim_w1_layer_plaster', parentBoqItemId: 'boq_bim_w1', isGroupParent: false, sourceEntityType: 'wall' },
];

/** Κολόνα: γονέας = στατικός πυρήνας (εργασία) + σοβάς */
const column = (groupRole: BOQItem['groupRole'] | undefined): BoqRoleInput[] => [
  { id: 'boq_bim_c1', isGroupParent: true, groupRole, sourceEntityType: 'column' },
  { id: 'boq_bim_c1_finish_mat-plaster-int', parentBoqItemId: 'boq_bim_c1', isGroupParent: false, sourceEntityType: 'column' },
];

describe('partitionCountableBoqLines (ADR-917 Λ7)', () => {
  it('Α20 τοίχος DNA μετρά ΜΙΑ φορά — μέσω των στρώσεων (σπάει αν ξαναμετρηθεί η σύνοψη)', () => {
    const { countable, excludedSummaries } = partitionCountableBoqLines(dnaWall('summary'));
    expect(ids(countable)).toEqual(['boq_bim_w1_layer_core', 'boq_bim_w1_layer_plaster']);
    expect(excludedSummaries).toEqual([{ item: expect.objectContaining({ id: 'boq_bim_w1' }), childCount: 2 }]);
  });

  it('Α21 κολόνα = πυρήνας + σοβάς (σπάει αν αγνοηθεί γονέας-εργασία)', () => {
    expect(ids(countableBoqLines(column('work')))).toEqual(['boq_bim_c1', 'boq_bim_c1_finish_mat-plaster-int']);
  });

  it('Α22 σύνοψη χωρίς παρόντα children μετρά — ο τοίχος δεν εξαφανίζεται', () => {
    const [parent] = dnaWall('summary');
    expect(ids(countableBoqLines([parent]))).toEqual(['boq_bim_w1']);
  });

  it('Α23 παλιό έγγραφο χωρίς ρόλο: ο ρόλος ΑΠΟΔΕΙΚΝΥΕΤΑΙ από τον builder (wall ⇒ σύνοψη, column ⇒ εργασία)', () => {
    expect(ids(countableBoqLines(dnaWall(undefined)))).not.toContain('boq_bim_w1');
    expect(ids(countableBoqLines(column(undefined)))).toContain('boq_bim_c1');
    expect(resolveBoqGroupRole(dnaWall(undefined)[0])).toEqual({ role: 'summary', basis: 'source-entity' });
    expect(resolveBoqGroupRole(column(null)[0])).toEqual({ role: 'work', basis: 'source-entity' });
  });

  it('Α24 γονέας χωρίς αποδείξιμο ρόλο ⇒ μετρά ΚΑΙ δηλώνεται (ποτέ σιωπηλή εικασία)', () => {
    const items: BoqRoleInput[] = [
      { id: 'p', isGroupParent: true, sourceEntityType: 'slab' },
      { id: 'c', parentBoqItemId: 'p' },
    ];
    const { countable, unresolvedGroupRoleCount } = partitionCountableBoqLines(items);
    expect(ids(countable)).toEqual(['p', 'c']);
    expect(unresolvedGroupRoleCount).toBe(1);
  });

  it('ο ρητός ρόλος υπερισχύει της απόδειξης από την οντότητα', () => {
    expect(resolveBoqGroupRole({ id: 'x', isGroupParent: true, groupRole: 'work', sourceEntityType: 'wall' }))
      .toEqual({ role: 'work', basis: 'explicit' });
  });

  it('γραμμή που δεν είναι γονέας: κανένας ρόλος, πάντα μετρά', () => {
    expect(resolveBoqGroupRole({ id: 'x', groupRole: 'summary' })).toEqual({ role: null, basis: null });
    expect(excludedSummaryIds([{ id: 'x', groupRole: 'summary' }]).size).toBe(0);
  });

  it('idempotent: διαμέριση του ήδη διαμερισμένου συνόλου δεν αλλάζει τίποτα', () => {
    const once = countableBoqLines(dnaWall('summary'));
    expect(countableBoqLines(once)).toEqual(once);
  });
});

describe('computeBuildingSummary — Λ7 (ίδιο κατηγόρημα με τον πυρήνα κόστους)', () => {
  const priced = { materialUnitCost: 10, laborUnitCost: 0, equipmentUnitCost: 0, buildingId: 'b1', unit: 'm2' };
  const items: BOQItem[] = [
    normalizeBOQItem('boq_bim_w1', { ...priced, categoryCode: 'OIK-3', estimatedQuantity: 20, isGroupParent: true, groupRole: 'summary', sourceEntityType: 'wall' }),
    normalizeBOQItem('boq_bim_w1_layer_core', { ...priced, categoryCode: 'OIK-3', estimatedQuantity: 20, parentBoqItemId: 'boq_bim_w1' }),
    normalizeBOQItem('boq_bim_w1_layer_plaster', { ...priced, categoryCode: 'OIK-4', estimatedQuantity: 20, parentBoqItemId: 'boq_bim_w1' }),
  ];

  it('Α20 ο τοίχος DNA αθροίζεται μία φορά και η σύνοψη δηλώνεται', () => {
    const summary = computeBuildingSummary('b1', items, new Map());
    expect(summary.totalEstimatedCost).toBe(400);
    expect(summary.totalItems).toBe(3);
    expect(summary.excludedSummaryItemCount).toBe(1);
    expect(summary.categories.find((c) => c.categoryCode === 'OIK-3')?.itemCount).toBe(1);
  });
});

describe('normalizeBOQItem — τα πεδία ομάδας φτάνουν στους αθροιστές', () => {
  it('μεταφέρει parentBoqItemId / isGroupParent / groupRole / liveQuantity (σπάει αν πεταχτούν ξανά)', () => {
    const item = normalizeBOQItem('x', {
      parentBoqItemId: 'p', isGroupParent: false, groupRole: 'work', layerIndex: 2, materialId: 'm', liveQuantity: 7,
    });
    expect(item).toMatchObject({
      parentBoqItemId: 'p', isGroupParent: false, groupRole: 'work', layerIndex: 2, materialId: 'm', liveQuantity: 7,
    });
  });
});

describe('groupBoqCost — οι πίνακες μετρήσεων (ADR-917 Λ7)', () => {
  const priced = { materialUnitCost: 10, laborUnitCost: 0, equipmentUnitCost: 0, categoryCode: 'OIK-3', estimatedQuantity: 20 };
  const items: BOQItem[] = [
    normalizeBOQItem('boq_bim_w1', { ...priced, isGroupParent: true, groupRole: 'summary', linkedFloorId: 'f1' }),
    normalizeBOQItem('boq_bim_w1_layer_core', { ...priced, parentBoqItemId: 'boq_bim_w1', linkedFloorId: 'f1' }),
  ];

  it('η σύνοψη ΦΑΙΝΕΤΑΙ στην ομάδα αλλά ΔΕΝ αθροίζεται (σπάει αν αθροιστεί ή κρυφτεί)', () => {
    const [group] = groupBoqCost(items, (item) => item.linkedFloorId ?? '');
    expect(group.items.map((item) => item.id)).toEqual(['boq_bim_w1', 'boq_bim_w1_layer_core']);
    expect(group.totalCost).toBe(200);
  });
});

describe('derivedSummaryCosts — η σύνοψη είναι παράγωγο (ADR-917 Ε2 · Α32)', () => {
  const layer = (id: string, unitCost: number, quantity: number) =>
    normalizeBOQItem(id, { materialUnitCost: unitCost, laborUnitCost: 0, equipmentUnitCost: 0, estimatedQuantity: quantity, parentBoqItemId: 'boq_bim_w1', categoryCode: 'OIK-4' });
  const summary = (own: number) =>
    normalizeBOQItem('boq_bim_w1', { materialUnitCost: own, laborUnitCost: 0, equipmentUnitCost: 0, estimatedQuantity: 20, isGroupParent: true, groupRole: 'summary', categoryCode: 'OIK-3' });

  it('🔴 Σ στρώσεων και τιμή μονάδας = Σ ÷ ποσότητα σύνοψης — η δική της τιμή αγνοείται', () => {
    const derived = derivedSummaryCosts([summary(999), layer('l1', 10, 20), layer('l2', 5, 20)]);
    expect(derived.get('boq_bim_w1')).toEqual({ layerCount: 2, totalCost: 300, unitRate: 15 });
  });

  it('🔴 σύνοψη ΧΩΡΙΣ στρώσεις δεν είναι παράγωγο — μετρά με τη δική της τιμή (Α22)', () => {
    expect(derivedSummaryCosts([summary(7)]).has('boq_bim_w1')).toBe(false);
  });

  it('γονέας «work» (κολόνα) δεν είναι παράγωγο — αθροίζεται μαζί με τα παιδιά', () => {
    const work = normalizeBOQItem('boq_bim_c1', { materialUnitCost: 5, estimatedQuantity: 1, isGroupParent: true, groupRole: 'work', categoryCode: 'OIK-2' });
    const child = normalizeBOQItem('boq_bim_c1_finish_x', { materialUnitCost: 5, estimatedQuantity: 1, parentBoqItemId: 'boq_bim_c1', categoryCode: 'OIK-4' });
    expect(derivedSummaryCosts([work, child]).size).toBe(0);
  });

  it('ποσότητα 0 ⇒ τιμή μονάδας null (ποτέ διαίρεση με το μηδέν)', () => {
    expect(deriveSummaryCost(0, [10])).toEqual({ layerCount: 1, totalCost: 10, unitRate: null });
  });
});

describe('writesDerivedPrice — η τιμή σύνοψης δεν πληκτρολογείται (ADR-917 Ε2 · Α33)', () => {
  const summary = { id: 'w', isGroupParent: true, groupRole: 'summary' as const, materialUnitCost: 7, laborUnitCost: 0, equipmentUnitCost: 0 };

  it('🔴 νέα τιμή ≠ 0 σε σύνοψη ⇒ άρνηση', () => {
    expect(writesDerivedPrice(summary, { materialUnitCost: 12 })).toBe(true);
    expect(writesDerivedPrice(summary, { laborUnitCost: 3 })).toBe(true);
  });

  it('🔴 ίδια τιμή ή 0 ⇒ επιτρέπεται (συγχρονισμός μοντέλου · καθαρισμός) — όπως ο κανόνας', () => {
    expect(writesDerivedPrice(summary, { materialUnitCost: 7, laborUnitCost: 0 })).toBe(false);
    expect(writesDerivedPrice(summary, { materialUnitCost: 0 })).toBe(false);
    expect(writesDerivedPrice(summary, { notes: undefined } as never)).toBe(false);
  });

  it('🔴 παλιά σύνοψη χωρίς ρόλο, αποδεδειγμένη από τον builder (τοίχος) ⇒ επίσης κλειδωμένη', () => {
    const legacy = { id: 'w', isGroupParent: true, sourceEntityType: 'wall' as const, materialUnitCost: 0 };
    expect(isSummaryBoqLine(legacy)).toBe(true);
    expect(writesDerivedPrice(legacy, { materialUnitCost: 5 })).toBe(true);
  });

  it('γραμμή στρώσης, απλή γραμμή, γονέας «work» ⇒ ελεύθερη τιμή', () => {
    expect(writesDerivedPrice({ id: 'l', parentBoqItemId: 'w', materialUnitCost: 0 }, { materialUnitCost: 5 })).toBe(false);
    expect(writesDerivedPrice({ id: 'x', materialUnitCost: 0 }, { materialUnitCost: 5 })).toBe(false);
    expect(writesDerivedPrice({ id: 'c', isGroupParent: true, groupRole: 'work', materialUnitCost: 0 }, { materialUnitCost: 5 })).toBe(false);
  });
});
