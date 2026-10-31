/**
 * Η μία μετάβαση της φόρμας για τον δεσμό τιμής — ADR-923 §5.11 «3ε»: διαλέγεις ⇒ τιμές και φύρα, πληκτρολογείς ⇒ αποσύνδεση.
 */

import type { BoqPriceSource } from '@/types/boq';
import { buildBOQUpdatePayload, createInitialState, withFormField } from '../useBOQEditorState';

const SOURCE: BoqPriceSource = {
  authority: 'project',
  priceListId: 'cprl_island',
  priceListVersionId: 'cplv_1',
  versionNumber: 1,
  lineId: 'line_a',
  subjectKey: 'costItem:OIK-4.01:*',
  unit: 'm2',
  priceQuantity: 10,
  breakdown: { material: 8000, labor: 3000, equipment: 1000 },
  defaultWasteBp: 500,
  appliedAt: '2026-10-31T10:00:00.000Z',
  appliedBy: 'user_1',
};

const empty = () => createInitialState(null, 'OIK-4', 'proj_1');
const NUMBERS = { numericEstimated: 1, numericWaste: 0, materialCost: 8, laborCost: 3, equipmentCost: 1 };

describe('withFormField', () => {
  it('ο δεσμός φέρνει τιμές ανά μονάδα και φύρα', () => {
    expect(withFormField(empty(), 'priceSource', SOURCE)).toMatchObject({ materialUnitCost: '8', laborUnitCost: '3', equipmentUnitCost: '1', wasteFactor: '5' });
  });

  it('φύρα που όρισε ο άνθρωπος δεν αγγίζεται', () => {
    const own = withFormField(empty(), 'wasteFactor', '12');
    expect(own.wastePolicy).toBe('overridden');
    expect(withFormField(own, 'priceSource', SOURCE).wasteFactor).toBe('12');
  });

  it('πληκτρολογημένη τιμή αποσυνδέει · η αποσύνδεση κρατά τις τιμές', () => {
    const bound = withFormField(empty(), 'priceSource', SOURCE);
    expect(withFormField(bound, 'laborUnitCost', '4').priceSource).toBeNull();
    expect(withFormField(bound, 'priceSource', null)).toMatchObject({ priceSource: null, materialUnitCost: '8' });
  });

  it('άσχετο πεδίο δεν αγγίζει τον δεσμό', () => {
    expect(withFormField(withFormField(empty(), 'priceSource', SOURCE), 'notes', 'x').priceSource).toEqual(SOURCE);
  });
});

describe('buildBOQUpdatePayload', () => {
  it('δεσμός και προέλευση ταξιδεύουν μαζί', () => {
    const payload = buildBOQUpdatePayload(withFormField(empty(), 'priceSource', SOURCE), NUMBERS, false);
    expect(payload).toMatchObject({ priceSource: SOURCE, priceAuthority: 'project' });
    expect(buildBOQUpdatePayload(empty(), NUMBERS, false)).toMatchObject({ priceSource: null, priceAuthority: 'item' });
  });

  it('κλειδωμένη σύνοψη δεν στέλνει ούτε τιμή ούτε δεσμό', () => {
    expect(buildBOQUpdatePayload(empty(), NUMBERS, true)).not.toHaveProperty('priceSource');
  });
});
