/**
 * ADR-422 L7.9-C — tests για τον construction-material thermal catalog (ρ/c/λ).
 * jest globals — ΟΧΙ vitest import.
 */

import { getConstructionMaterialThermal } from '../construction-material-thermal';

describe('getConstructionMaterialThermal', () => {
  it('γενικό id (mat-concrete) → RC ρ/c/λ', () => {
    expect(getConstructionMaterialThermal('mat-concrete')).toEqual({
      density: 2400,
      specificHeat: 840,
      lambda: 2.0,
    });
  });

  it('insulation: λ ≤ insulation-stop threshold (0.10)', () => {
    const t = getConstructionMaterialThermal('mat-insulation');
    expect(t?.lambda).toBeLessThanOrEqual(0.1);
  });

  it('longest-prefix match: graded παραλλαγή (mat-concrete-c25) → mat-concrete', () => {
    expect(getConstructionMaterialThermal('mat-concrete-c25')).toEqual(
      getConstructionMaterialThermal('mat-concrete'),
    );
  });

  it('roof-tile διακριτό από tile (longest-prefix, ΟΧΙ mat-tile)', () => {
    const roofTile = getConstructionMaterialThermal('mat-roof-tile');
    const tile = getConstructionMaterialThermal('mat-tile');
    expect(roofTile).toBeDefined();
    expect(roofTile).not.toEqual(tile);
  });

  it('άγνωστο / custom id → undefined (caller παραλείπει)', () => {
    expect(getConstructionMaterialThermal('custom-foo')).toBeUndefined();
    expect(getConstructionMaterialThermal('')).toBeUndefined();
    expect(getConstructionMaterialThermal(undefined)).toBeUndefined();
  });

  it('όλα τα κλειδιά: θετικά ρ/c/λ', () => {
    for (const id of ['mat-concrete', 'mat-screed', 'mat-insulation', 'mat-tile', 'mat-plaster', 'mat-gravel', 'mat-membrane']) {
      const t = getConstructionMaterialThermal(id);
      expect(t).toBeDefined();
      expect(t!.density).toBeGreaterThan(0);
      expect(t!.specificHeat).toBeGreaterThan(0);
      expect(t!.lambda).toBeGreaterThan(0);
    }
  });
});
