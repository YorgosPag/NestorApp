/**
 * imported-material-presets.test — ADR-683 Φ4. Κλειδώνει το keyword mapping «όνομα → PBR preset»
 * με τα ΠΡΑΓΜΑΤΙΚΑ (truncated) ονόματα υλικών της καρέκλας HMI Aeron (μετρημένα από το `.glb`,
 * 2026-07-22) + τη σειρά προτεραιότητας (δέρμα ΠΡΙΝ ύφασμα) + τα null όρια + τους color helpers.
 */

import {
  resolveImportedMaterialPreset,
  resolveImportedMaterialPresetFor,
  importedPresetHex,
  importedPresetRgba,
} from '../imported-material-presets';

describe('resolveImportedMaterialPreset — καρέκλα HMI Aeron (πραγματικά truncated ονόματα)', () => {
  it('HMI-_Polished_Al (γυαλισμένο αλουμίνιο) → metal (μεταλλικό)', () => {
    const preset = resolveImportedMaterialPreset('HMI-_Polished_Al');
    expect(preset?.key).toBe('metal');
    expect(preset?.metalness).toBeGreaterThan(0.5);
  });

  it('HMI-Aeron-Leathe (truncated «Leather») → leather, ΟΧΙ fabric (σειρά προτεραιότητας)', () => {
    // Το όνομα περιέχει ΚΑΙ «aeron» (ύφασμα): το δέρμα πρέπει να κερδίσει.
    expect(resolveImportedMaterialPreset('HMI-Aeron-Leathe')?.key).toBe('leather');
  });

  it('HMI-Aeron-G1__Gr (πλέγμα πλάτης) → fabric', () => {
    expect(resolveImportedMaterialPreset('HMI-Aeron-G1__Gr')?.key).toBe('fabric');
  });

  it('HMI-3D01__Pellic (truncated «Pellicle») → fabric', () => {
    expect(resolveImportedMaterialPreset('HMI-3D01__Pellic')?.key).toBe('fabric');
  });
});

describe('resolveImportedMaterialPreset — γενικές οικογένειες', () => {
  it.each([
    ['Inox_304', 'metal'],
    ['Glass_Clear', 'glass'],
    ['Oak_Natural', 'wood'],
    ['Rubber_Caster', 'plastic'],
    ['Beton_C25', 'stone'],
  ])('%s → %s', (name, key) => {
    expect(resolveImportedMaterialPreset(name)?.key).toBe(key);
  });

  it('μη-μεταλλικό preset δεν γυαλίζει (metalness 0)', () => {
    expect(resolveImportedMaterialPreset('Oak_Natural')?.metalness).toBe(0);
  });

  it('το γυαλί είναι διάφανο', () => {
    const glass = resolveImportedMaterialPreset('Glass_Clear');
    expect(glass?.transparent).toBe(true);
    expect(glass?.opacity).toBeLessThan(1);
  });
});

describe('resolveImportedMaterialPreset — null όρια', () => {
  it.each([[null], [undefined], [''], ['   '], ['XyzUnknown42']])(
    '%p → null (καμία μαντεψιά)',
    (name) => {
      expect(resolveImportedMaterialPreset(name as string | null | undefined)).toBeNull();
    },
  );
});

// ADR-683 Φ4 — auto-tier από ΟΝΟΜΑ ΚΟΜΒΟΥ όταν το υλικό είναι ανώνυμο (πραγματικό HMI_Aeron:
// 10 κόμβοι, κανένα ονομασμένο υλικό, σημασιολογία μόνο στα node names).
describe('resolveImportedMaterialPreset — node-name stems (πραγματικοί κόμβοι HMI_Aeron)', () => {
  it.each([
    ['HBase', 'metal'],     // βάση → μέταλλο (`base$`)
    ['HFrame', 'metal'],    // σκελετός
    ['HBkFrame', 'metal'],  // πλαίσιο πλάτης
    ['HSeatFrm', 'metal'],  // πλαίσιο καθίσματος (`frm`)
    ['HSFrmEdg', 'metal'],  // ακμή πλαισίου (`frm`/`edg`)
    ['HBFrmEdg', 'metal'],
    ['HSpndle', 'metal'],   // άξονας (`spndle`)
    ['HPellBk', 'fabric'],  // Pellicle πλάτης (`pell`)
    ['HPellSt', 'fabric'],  // Pellicle καθίσματος
    ['HArmPads', 'leather'],// μπράτσα (`armpad`)
  ])('%s → %s', (node, key) => {
    expect(resolveImportedMaterialPreset(node)?.key).toBe(key);
  });
});

describe('resolveImportedMaterialPresetFor — προτεραιότητα υλικό → κόμβος', () => {
  it('όνομα υλικού κερδίζει όταν αναγνωρίζεται (authored intent)', () => {
    // υλικό «Oak» (ξύλο) σε κόμβο «HBase» (μέταλλο) → κερδίζει το ξύλο.
    expect(resolveImportedMaterialPresetFor('Oak_Natural', 'HBase')?.key).toBe('wood');
  });

  it('πέφτει στο όνομα κόμβου όταν το υλικό είναι ανώνυμο/άγνωστο', () => {
    expect(resolveImportedMaterialPresetFor(null, 'HPellBk')?.key).toBe('fabric');
    expect(resolveImportedMaterialPresetFor('', 'HArmPads')?.key).toBe('leather');
    expect(resolveImportedMaterialPresetFor('XyzUnknown42', 'HBase')?.key).toBe('metal');
  });

  it('null και στα δύο → null (καμία μαντεψιά)', () => {
    expect(resolveImportedMaterialPresetFor(null, null)).toBeNull();
    expect(resolveImportedMaterialPresetFor('XyzUnknown42', 'AlsoUnknown')).toBeNull();
  });
});

describe('color helpers', () => {
  it('importedPresetHex → #rrggbb με padding', () => {
    const preset = resolveImportedMaterialPreset('HMI-Aeron-Leathe')!;
    expect(importedPresetHex(preset)).toBe('#2b2723');
  });

  it('importedPresetRgba αποσυνθέτει σωστά τα κανάλια + clamp alpha', () => {
    const preset = resolveImportedMaterialPreset('HMI-Aeron-Leathe')!; // 0x2b2723
    expect(importedPresetRgba(preset, 0.16)).toBe('rgba(43, 39, 35, 0.16)');
    expect(importedPresetRgba(preset, 5)).toBe('rgba(43, 39, 35, 1)'); // clamp πάνω
    expect(importedPresetRgba(preset, -1)).toBe('rgba(43, 39, 35, 0)'); // clamp κάτω
  });
});
