/**
 * ⚓ Επιλογέας ακινήτου της μεσιτείας — αποσυρμένο ακίνητο φαίνεται, δεν προσφέρεται
 * (ADR-230 · ADR-281 · ADR-329 §3.9)
 */

import { selectableUnits, type PropertySummary } from '../brokerage-form-types';

const LIVE: PropertySummary = { id: 'p1', name: 'Α1', status: 'available' };
const NO_STATUS: PropertySummary = { id: 'p2', name: 'Α2', status: null };
const ARCHIVED: PropertySummary = { id: 'p3', name: 'Α3', status: 'archived' };
const TRASHED: PropertySummary = { id: 'p4', name: 'Α4', status: 'deleted' };
const ALL = [LIVE, NO_STATUS, ARCHIVED, TRASHED];

describe('selectableUnits', () => {
  it('νέα σύμβαση: μόνο ζωντανά — και όσα δεν έχουν `status`', () => {
    expect(selectableUnits(ALL, '')).toEqual([LIVE, NO_STATUS]);
  });

  it('🔴 σύμβαση που ΗΔΗ δείχνει σε αρχειοθετημένο: φαίνεται, τελευταίο', () => {
    expect(selectableUnits(ALL, 'p3')).toEqual([LIVE, NO_STATUS, ARCHIVED]);
  });

  it('ζωντανό συνδεδεμένο δεν εμφανίζεται δύο φορές', () => {
    expect(selectableUnits(ALL, 'p1')).toEqual([LIVE, NO_STATUS]);
  });
});
