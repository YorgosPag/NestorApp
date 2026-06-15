/**
 * ADR-460 — cross-tie pattern control ανενεργό σε κυκλική/τοίχωμα (όχι perimeter).
 */

import {
  resolveColumnFieldDisabled,
  resolveColumnFieldOptions,
  COLUMN_STRUCTURAL_KEYS,
} from '../column-command-keys';
import type { ColumnParams } from '../../../../../bim/types/column-types';

function params(over: Partial<ColumnParams> = {}): ColumnParams {
  return {
    kind: 'rectangular', position: { x: 0, y: 0, z: 0 }, anchor: 'center',
    width: 400, depth: 400, height: 3000, rotation: 0, sceneUnits: 'mm',
    baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
    ...over,
  };
}

describe('resolveColumnFieldDisabled — cross-tie pattern', () => {
  const key = COLUMN_STRUCTURAL_KEYS.crossTiePattern;

  it('ενεργό (perimeter) σε ορθογωνική', () => {
    expect(resolveColumnFieldDisabled(key, params())).toBe(false);
  });

  it('ΑΝΕΝΕΡΓΟ σε κυκλική', () => {
    expect(resolveColumnFieldDisabled(key, params({ kind: 'circular', width: 500 }))).toBe(true);
  });

  it('ΑΝΕΝΕΡΓΟ σε τοίχωμα (shear-wall)', () => {
    expect(resolveColumnFieldDisabled(key, params({ kind: 'shear-wall', width: 2000, depth: 250 }))).toBe(true);
  });

  it('ενεργό για άλλα πεδία (π.χ. cover) ανεξαρτήτως σχήματος', () => {
    expect(resolveColumnFieldDisabled(COLUMN_STRUCTURAL_KEYS.cover, params({ kind: 'circular', width: 500 }))).toBe(false);
  });
});

describe('resolveColumnFieldOptions — shape-aware cross-tie options (διαμάντι)', () => {
  const key = COLUMN_STRUCTURAL_KEYS.crossTiePattern;

  it('ορθογωνική → καμία περιστολή (null = όλα τα options, incl. διαμάντι)', () => {
    expect(resolveColumnFieldOptions(key, params())).toBeNull();
  });

  it('Γ (L-shape) → auto/grid χωρίς διαμάντι', () => {
    const opts = resolveColumnFieldOptions(key, params({ kind: 'L-shape', width: 600, depth: 600 }));
    expect(opts).toEqual(['auto', 'grid']);
    expect(opts).not.toContain('diamond');
  });

  it('άλλα πεδία (π.χ. cover) → null ανεξαρτήτως σχήματος', () => {
    expect(resolveColumnFieldOptions(COLUMN_STRUCTURAL_KEYS.cover, params({ kind: 'L-shape', width: 600, depth: 600 }))).toBeNull();
  });
});
