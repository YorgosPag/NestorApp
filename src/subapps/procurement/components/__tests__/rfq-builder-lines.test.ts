/**
 * ADR-923 §5.13 Τ6 — οι γραμμές του `RfqBuilder`: η γραμμή καταλόγου στέλνει ΜΟΝΟ διεύθυνση και ζήτηση, ποτέ περιγραφή.
 */

import {
  boqItemToLine, catalogDraftToLine, catalogLinesComplete, newAdHocLine, suppliersToOfferAccess, toCreateRfqDTO,
  type FormLine, type FormState,
} from '../rfq-builder-lines';
import { RFQ_FALLBACK_TRADE } from '../../types/rfq';

const ADDRESS = { supplierCompanyId: 'comp_aries', modelId: 'cpmod_1', variantId: 'cprod_1' };
const DRAFT = { address: ADDRESS, description: 'TC-1 — Καλώδιο', supplierName: 'ARIES ΑΕ' };

const form = (lines: FormLine[]): FormState => ({
  projectId: 'proj_1', title: 'RFQ', description: '', deadlineDate: '', awardMode: 'whole_package',
  reminderTemplate: 'standard', lines, invitedVendorIds: [],
});

const withDemand = (line: FormLine, quantity: number | null, unit: string | null): FormLine => ({ ...line, quantity, unit });

describe('catalogDraftToLine', () => {
  it('πηγή catalog, περιγραφή από τον διακομιστή, ποσότητα και μονάδα ΚΕΝΕΣ (τις δίνει ο αγοραστής)', () => {
    const line = catalogDraftToLine(DRAFT);
    expect(line).toMatchObject({
      source: 'catalog', description: DRAFT.description, trade: RFQ_FALLBACK_TRADE, quantity: null, unit: null,
      catalog: { address: ADDRESS, supplierName: 'ARIES ΑΕ' },
    });
  });
});

describe('catalogLinesComplete', () => {
  const line = catalogDraftToLine(DRAFT);
  it.each([
    ['χωρίς ποσότητα', null, 'pcs', false],
    ['μηδενική ποσότητα', 0, 'pcs', false],
    ['χωρίς μονάδα', 3, null, false],
    ['κενή μονάδα', 3, '  ', false],
    ['πλήρης', 3, 'pcs', true],
  ])('%s ⇒ %s', (_label, quantity, unit, expected) => {
    expect(catalogLinesComplete([withDemand(line, quantity, unit)])).toBe(expected);
  });

  it('η χειρόγραφη γραμμή δεν απαιτεί ποσότητα', () => {
    expect(catalogLinesComplete([newAdHocLine()])).toBe(true);
  });
});

describe('suppliersToOfferAccess (Ε6δ: από ό,τι στάλθηκε)', () => {
  it('μόνο προσκεκλημένοι με ζωντανό σύνδεσμο · κανείς ⇒ κενό (η σελίδα πάει στο αίτημα)', () => {
    const withLink = { supplierCompanyId: 'comp_a', supplierName: 'A', priceListAccessHref: '/supply-request/t' };
    const without = { supplierCompanyId: 'comp_b', supplierName: 'B', priceListAccessHref: null };
    expect(suppliersToOfferAccess([withLink, without])).toEqual([withLink]);
    expect(suppliersToOfferAccess([without])).toEqual([]);
    expect(suppliersToOfferAccess([])).toEqual([]);
  });
});

describe('toCreateRfqDTO', () => {
  it('🔒 γραμμή καταλόγου ⇒ catalogLines με διεύθυνση + ζήτηση και τίποτε άλλο', () => {
    const dto = toCreateRfqDTO(form([withDemand(catalogDraftToLine(DRAFT), 12, ' pcs ')]), undefined);
    expect(dto.catalogLines).toEqual([{ ...ADDRESS, quantity: 12, unit: 'pcs' }]);
    expect(dto.adHocLines).toBeUndefined();
    expect(dto.boqItemIds).toBeUndefined();
  });

  it('οι τρεις προελεύσεις μαζί πηγαίνουν η καθεμία στο πεδίο της', () => {
    const boq = boqItemToLine({ id: 'boq_1', title: 'Σκυρόδεμα', categoryCode: null, estimatedQuantity: 4, unit: 'm3', description: null });
    const adHoc = { ...newAdHocLine(), description: 'Άλλο' };
    const dto = toCreateRfqDTO(form([boq, adHoc, withDemand(catalogDraftToLine(DRAFT), 1, 'pcs')]), 'se_1');
    expect(dto.boqItemIds).toEqual(['boq_1']);
    expect(dto.adHocLines?.map((l) => l.description)).toEqual(['Άλλο']);
    expect(dto.catalogLines).toHaveLength(1);
    expect(dto.sourcingEventId).toBe('se_1');
  });

  it('χωρίς γραμμή καταλόγου το σώμα δεν έχει catalogLines (ο zod θέλει min 1)', () => {
    expect(toCreateRfqDTO(form([newAdHocLine()]), undefined).catalogLines).toBeUndefined();
  });

  it('γραμμή με πηγή catalog χωρίς διεύθυνση δεν στέλνεται ποτέ ως SKU', () => {
    const orphan: FormLine = { ...catalogDraftToLine(DRAFT), catalog: undefined, quantity: 1, unit: 'pcs' };
    expect(toCreateRfqDTO(form([orphan]), undefined).catalogLines).toBeUndefined();
  });
});
