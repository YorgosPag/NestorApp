/**
 * ADR-449 Slice 5 — structural finish factory + per-element override core.
 *
 * Επαληθεύει: createDefaultStructuralFinishSpec defaults (enabled/υλικά/πάχος) +
 * readFinishParamValue/applyFinishParam round-trip (enabled/interior/exterior/thickness)
 * incl. invalid-value no-ops (null) και default fallback όταν spec absent.
 */

import {
  createDefaultStructuralFinishSpec,
  readFinishParamValue,
  applyFinishParam,
  isFinishActive,
  STRUCTURAL_FINISH_INTERIOR_MATERIAL,
  STRUCTURAL_FINISH_EXTERIOR_MATERIAL,
  STRUCTURAL_FINISH_DEFAULT_THICKNESS_MM,
  type StructuralFinishSpec,
} from '../structural-finish-types';

describe('ADR-449 Slice 5 — createDefaultStructuralFinishSpec', () => {
  it('returns enabled spec με τα canonical plaster defaults', () => {
    const spec = createDefaultStructuralFinishSpec();
    expect(spec).toEqual<StructuralFinishSpec>({
      enabled: true,
      interiorMaterialId: STRUCTURAL_FINISH_INTERIOR_MATERIAL,
      exteriorMaterialId: STRUCTURAL_FINISH_EXTERIOR_MATERIAL,
      thickness: STRUCTURAL_FINISH_DEFAULT_THICKNESS_MM,
    });
  });

  it('default spec είναι ενεργό (isFinishActive)', () => {
    expect(isFinishActive(createDefaultStructuralFinishSpec())).toBe(true);
  });

  it('default πάχος = 15mm', () => {
    expect(STRUCTURAL_FINISH_DEFAULT_THICKNESS_MM).toBe(15);
  });
});

describe('ADR-449 Slice 5 — readFinishParamValue', () => {
  const spec = createDefaultStructuralFinishSpec();

  it('διαβάζει enabled ως on/off', () => {
    expect(readFinishParamValue(spec, 'enabled')).toBe('on');
    expect(readFinishParamValue({ ...spec, enabled: false }, 'enabled')).toBe('off');
  });

  it('διαβάζει υλικά + πάχος (rounded)', () => {
    expect(readFinishParamValue(spec, 'interiorMaterialId')).toBe(STRUCTURAL_FINISH_INTERIOR_MATERIAL);
    expect(readFinishParamValue(spec, 'exteriorMaterialId')).toBe(STRUCTURAL_FINISH_EXTERIOR_MATERIAL);
    expect(readFinishParamValue({ ...spec, thickness: 22.6 }, 'thickness')).toBe('23');
  });

  it('απών spec → πέφτει στα defaults', () => {
    expect(readFinishParamValue(undefined, 'enabled')).toBe('on');
    expect(readFinishParamValue(undefined, 'thickness')).toBe('15');
  });
});

describe('ADR-449 Slice 5 — applyFinishParam', () => {
  const spec = createDefaultStructuralFinishSpec();

  it('τoggle enabled on/off', () => {
    expect(applyFinishParam(spec, 'enabled', 'off')?.enabled).toBe(false);
    expect(applyFinishParam({ ...spec, enabled: false }, 'enabled', 'on')?.enabled).toBe(true);
  });

  it('αλλάζει υλικά', () => {
    expect(applyFinishParam(spec, 'interiorMaterialId', 'mat-x')?.interiorMaterialId).toBe('mat-x');
    expect(applyFinishParam(spec, 'exteriorMaterialId', 'mat-y')?.exteriorMaterialId).toBe('mat-y');
  });

  it('κενό υλικό → null (no-op)', () => {
    expect(applyFinishParam(spec, 'interiorMaterialId', '')).toBeNull();
    expect(applyFinishParam(spec, 'exteriorMaterialId', '')).toBeNull();
  });

  it('θετικό πάχος → εφαρμόζεται· μη-θετικό/NaN → null', () => {
    expect(applyFinishParam(spec, 'thickness', '20')?.thickness).toBe(20);
    expect(applyFinishParam(spec, 'thickness', '0')).toBeNull();
    expect(applyFinishParam(spec, 'thickness', '-5')).toBeNull();
    expect(applyFinishParam(spec, 'thickness', 'abc')).toBeNull();
  });

  it('απών spec → χτίζει από default + εφαρμόζει', () => {
    const next = applyFinishParam(undefined, 'thickness', '25');
    expect(next).not.toBeNull();
    expect(next?.thickness).toBe(25);
    expect(next?.enabled).toBe(true);
    expect(next?.interiorMaterialId).toBe(STRUCTURAL_FINISH_INTERIOR_MATERIAL);
  });
});
