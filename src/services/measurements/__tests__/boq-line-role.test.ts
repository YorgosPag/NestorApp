/**
 * ADR-917 §7 Α20–Α24 — «μετράει αυτή η γραμμή;» (Λ7).
 * Κάθε `it` ονομάζει τη μετάλλαξη που υπάρχει για να πιάσει.
 */

import {
  countableBoqLines,
  excludedSummaryIds,
  partitionCountableBoqLines,
  resolveBoqGroupRole,
  type BoqRoleInput,
} from '../boq-line-role';
import { computeBuildingSummary } from '../cost-engine';
import { groupBoqCost } from '../boq-cost-groups';
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
