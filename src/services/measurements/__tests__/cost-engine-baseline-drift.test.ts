/**
 * Unit tests — computeBaselineDrift (ADR-675)
 *
 * Απόκλιση του live BIM μοντέλου από το ΠΑΓΩΜΕΝΟ υπογεγραμμένο baseline
 * (`estimatedQuantity`). Διαφορετικός άξονας από το `computeVariance`
 * (estimated vs actual as-built). Το baseline δεν μεταβάλλεται ποτέ — η
 * απόκλιση είναι ένδειξη για ανθρώπινο revision (5D-BIM cost πρακτική).
 */
import { computeBaselineDrift } from '../cost-engine';
import type { BOQItem } from '@/types/boq';

function item(overrides: Partial<BOQItem>): BOQItem {
  return {
    id: 'boq-1', companyId: 'c1', projectId: 'p1', buildingId: 'b1',
    scope: 'building', linkedFloorId: null, linkedUnitId: null, linkedUnitIds: null,
    costAllocationMethod: 'by_area', customAllocations: null,
    categoryCode: 'OIK-2', subCategoryCode: null, title: 't', description: null,
    unit: 'pcs', estimatedQuantity: 10, actualQuantity: null, wasteFactor: 0, wastePolicy: 'inherited',
    materialUnitCost: 0, laborUnitCost: 0, equipmentUnitCost: 0, priceAuthority: 'master',
    linkedPhaseId: null, linkedTaskId: null, linkedInvoiceId: null, linkedContractorId: null,
    source: 'bim-auto', measurementMethod: 'bim', status: 'certified', qaStatus: 'pending',
    notes: null, createdBy: null, approvedBy: null, createdAt: 'x', updatedAt: 'x',
    ...overrides,
  };
}

describe('computeBaselineDrift (ADR-675)', () => {
  it('null όταν δεν παρακολουθείται liveQuantity', () => {
    expect(computeBaselineDrift(item({ liveQuantity: null }))).toBeNull();
    expect(computeBaselineDrift(item({}))).toBeNull();
  });

  it('null όταν το live ταυτίζεται με το υπογεγραμμένο baseline (καμία απόκλιση)', () => {
    expect(computeBaselineDrift(item({ estimatedQuantity: 10, liveQuantity: 10 }))).toBeNull();
  });

  it('αρνητική απόκλιση — το μοντέλο μίκρυνε κάτω από το baseline', () => {
    const d = computeBaselineDrift(item({ estimatedQuantity: 10, liveQuantity: 7, liveQuantitySyncedAt: 'ts' }));
    expect(d).toEqual({ baseline: 10, live: 7, delta: -3, percent: -30, syncedAt: 'ts' });
  });

  it('θετική απόκλιση — το μοντέλο μεγάλωσε πάνω από το baseline', () => {
    const d = computeBaselineDrift(item({ estimatedQuantity: 8, liveQuantity: 10 }));
    expect(d).toMatchObject({ baseline: 8, live: 10, delta: 2, percent: 25, syncedAt: null });
  });

  it('percent = 0 όταν baseline = 0 (αποφυγή διαίρεσης με μηδέν)', () => {
    const d = computeBaselineDrift(item({ estimatedQuantity: 0, liveQuantity: 4 }));
    expect(d).toMatchObject({ baseline: 0, live: 4, delta: 4, percent: 0 });
  });
});
