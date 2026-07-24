/**
 * material-catalog-defs — pure SSoT extraction tests (ADR-413 §2D).
 *
 * Guards the prefix resolver + flat-colour hex used by both the 3D material
 * catalog and the 2D swatch UI, so the extraction from MaterialCatalog3D stays
 * behaviour-identical.
 */

import {
  MATERIAL_DEFS,
  DEFAULT_MATERIAL_KEY,
  resolveMaterialKey,
  resolveMaterialKeyOrNull,
  catalogFlatColorOrNull,
  getMaterialFlatColorHex,
} from '../material-catalog-defs';
import { textureSlugForKey } from '../bim-texture-registry';

describe('resolveMaterialKey', () => {
  it('returns an exact key unchanged', () => {
    expect(resolveMaterialKey('mat-concrete')).toBe('mat-concrete');
    expect(resolveMaterialKey('elem-slab')).toBe('elem-slab');
  });

  it('resolves a suffixed DNA materialId by prefix (Revit type variant)', () => {
    expect(resolveMaterialKey('mat-concrete-c25')).toBe('mat-concrete');
    expect(resolveMaterialKey('mat-brick-masonry')).toBe('mat-brick');
    expect(resolveMaterialKey('mat-plaster-int')).toBe('mat-plaster');
    expect(resolveMaterialKey('mat-stone-masonry')).toBe('mat-stone');
  });

  it('falls back to the default key for an unmapped id', () => {
    expect(resolveMaterialKey('mat-marble')).toBe(DEFAULT_MATERIAL_KEY);
    expect(resolveMaterialKey('totally-unknown')).toBe(DEFAULT_MATERIAL_KEY);
  });
});

describe('getMaterialFlatColorHex', () => {
  it('formats the resolved key colour as #rrggbb', () => {
    expect(getMaterialFlatColorHex('mat-concrete')).toBe('#b0b0b0');
    expect(getMaterialFlatColorHex('mat-wood')).toBe('#8b5e3c');
  });

  it('zero-pads colours below 0x100000', () => {
    // elem-mep-manifold = 0x0891b2 → must not collapse to '#891b2'.
    expect(getMaterialFlatColorHex('elem-mep-manifold')).toBe('#0891b2');
  });

  it('uses the prefix-resolved colour for suffixed ids', () => {
    expect(getMaterialFlatColorHex('mat-concrete-c30')).toBe('#b0b0b0');
  });

  it('falls back to the default-key colour for unmapped ids', () => {
    expect(getMaterialFlatColorHex('mat-marble')).toBe(getMaterialFlatColorHex(DEFAULT_MATERIAL_KEY));
  });
});

describe('MATERIAL_DEFS', () => {
  it('contains the default key', () => {
    expect(MATERIAL_DEFS[DEFAULT_MATERIAL_KEY]).toBeDefined();
  });

  // ADR-445 — foundation kinds (pad/strip/tie-beam) carry DISTINCT sienna faces
  // (3D consistency with the 2D `FOUNDATION_KIND_STROKE` palette). Read the raw
  // defs: `getMaterialFlatColorHex`/`resolveMaterialKey` prefix-collapse a DNA
  // suffix (`-strip`) onto `elem-foundation`, but the 3D element-material path
  // (`getElementMaterial3D` → exact key) keeps them distinct — see
  // foundation-to-three.test.ts.
  it('defines distinct per-kind foundation face colours', () => {
    const pad = MATERIAL_DEFS['elem-foundation-pad']?.color;
    const strip = MATERIAL_DEFS['elem-foundation-strip']?.color;
    const tie = MATERIAL_DEFS['elem-foundation-tie-beam']?.color;
    expect([pad, strip, tie]).toEqual([0x8a5a3c, 0x2f7d6a, 0xb5651d]);
    expect(new Set([pad, strip, tie]).size).toBe(3);
  });
});

/**
 * ADR-693 Α1 — ο ρητός διαχωρισμός «άγνωστο» vs «σκυρόδεμα». Ο `resolveMaterialKey` ΔΙΑΤΗΡΕΙ το
 * fallback του (τοίχοι/πλάκες/DNA layers βασίζονται σιωπηλά πάνω του)· το `…OrNull` είναι η νέα,
 * ειλικρινής απάντηση για τα μονοπάτια όπου το σκυρόδεμα είναι λάθος (swatch, thumbnail, ghost).
 */
describe('resolveMaterialKeyOrNull (ADR-693 Α1)', () => {
  it('συμφωνεί με τον resolveMaterialKey σε ΚΑΘΕ γνωστό id', () => {
    for (const key of Object.keys(MATERIAL_DEFS)) {
      expect(resolveMaterialKeyOrNull(key)).toBe(resolveMaterialKey(key));
    }
    expect(resolveMaterialKeyOrNull('mat-concrete-c25')).toBe('mat-concrete');
  });

  it('επιστρέφει null — ΟΧΙ σκυρόδεμα — για id εκτός καταλόγου', () => {
    expect(resolveMaterialKeyOrNull('mat-marble')).toBeNull();
    expect(resolveMaterialKeyOrNull('bmat_01HQ')).toBeNull();
    expect(resolveMaterialKeyOrNull('paint-red')).toBeNull();
    expect(resolveMaterialKeyOrNull('totally-unknown')).toBeNull();
  });

  it('ο resolveMaterialKey μένει ΑΝΕΠΑΦΟΣ (καμία παλινδρόμηση στους 8 καλούντες)', () => {
    expect(resolveMaterialKey('mat-marble')).toBe(DEFAULT_MATERIAL_KEY);
    expect(resolveMaterialKey('totally-unknown')).toBe(DEFAULT_MATERIAL_KEY);
  });

  it('catalogFlatColorOrNull διαβάζει τον ΙΔΙΟ matcher (N.18 — ένας βρόχος)', () => {
    expect(catalogFlatColorOrNull('mat-wood')).toBe('#8b5e3c');
    expect(catalogFlatColorOrNull('bmat_01HQ')).toBeNull();
    expect(catalogFlatColorOrNull('paint-red')).toBeNull();
  });
});

/**
 * ADR-693 Α3 — το εισαγόμενο πλέγμα (ADR-683) δεν είχε ΚΑΝΕΝΑ def, οπότε έπεφτε στο
 * `DEFAULT_MATERIAL_KEY` → σκυρόδεμα → **φωτογραφία σκυροδέματος** πάνω σε ξένο μοντέλο.
 */
describe('elem-imported-mesh (ADR-693 Α3)', () => {
  it('έχει ρητό ουδέτερο def — δεν πέφτει στο σκυρόδεμα', () => {
    expect(resolveMaterialKeyOrNull('elem-imported-mesh')).toBe('elem-imported-mesh');
    expect(resolveMaterialKey('elem-imported-mesh')).not.toBe(DEFAULT_MATERIAL_KEY);
  });

  it('ΔΕΝ έχει texture slug — ένα ξένο μοντέλο δεν ντύνεται ποτέ με υφή καταλόγου', () => {
    expect(textureSlugForKey('elem-imported-mesh')).toBeNull();
  });

  it('δεν σπάει τη σειρά του prefix match (κανένα κλειδί δεν το σκιάζει)', () => {
    const keys = Object.keys(MATERIAL_DEFS);
    const shadowing = keys.filter((k) => k !== 'elem-imported-mesh' && 'elem-imported-mesh'.startsWith(k));
    expect(shadowing).toEqual([]);
  });
});
