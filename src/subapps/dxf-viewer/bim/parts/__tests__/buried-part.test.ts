/**
 * ADR-715 — η ταυτότητα του «Τμήματος» (κοντόστυλο) και τα δύο κριτήρια που αποφασίζουν
 * **αν κάτι επιμετράται**.
 *
 * Δεν είναι κοσμητικά tests: το `isBuriedWaterproofingMaterial` δρομολογεί το swatch (Part-level
 * SSoT ↔ cosmetic per-face) και το `resolveBuriedPaintDivergence` είναι η μόνη οδός με την οποία
 * ο μηχανικός μαθαίνει ότι βλέπει άλλο υλικό από αυτό που χρεώνεται. Λάθος εδώ = **σφάλμα τιμής**.
 *
 * @see ../buried-part.ts
 */

import {
  BURIED_PART_ID_SUFFIX,
  buriedPartId,
  parseBuriedPartId,
  isSameBuriedPart,
  buriedFaceTargets,
  resolveBuriedPaintDivergence,
  isBuriedWaterproofingMaterial,
} from '../buried-part';
import {
  DEFAULT_BURIED_WATERPROOFING_MATERIAL,
  WATERPROOF_MEMBRANE_MATERIAL,
  BURIED_WATERPROOFING_MATERIALS,
} from '../../finishes/buried-waterproofing';
import {
  buildDefaultColumnParams,
  buildColumnEntity,
} from '../../../hooks/drawing/column-completion';
import type { ColumnEntity } from '../../types/column-types';
import type { FaceAppearanceMap } from '../../types/face-appearance-types';

/** Πραγματική κολώνα (όχι synthetic literal) με προαιρετικά override params/appearance. */
function column(overrides?: {
  readonly appearance?: FaceAppearanceMap;
  readonly waterproofingMaterialId?: string;
  readonly waterproofingEnabled?: boolean;
}): ColumnEntity {
  const res = buildColumnEntity(buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), '0');
  if (!res.ok) throw new Error('column fixture invalid');
  const entity = res.entity;
  return {
    ...entity,
    faceAppearance: overrides?.appearance,
    params: {
      ...entity.params,
      buriedWaterproofing:
        overrides?.waterproofingMaterialId !== undefined || overrides?.waterproofingEnabled !== undefined
          ? { materialId: overrides.waterproofingMaterialId, enabled: overrides.waterproofingEnabled }
          : undefined,
    },
  };
}

describe('ADR-715 — παράγωγο id Τμήματος', () => {
  it('είναι ντετερμινιστικό και round-trip-άρει στο host id', () => {
    expect(buriedPartId('col_123')).toBe(`col_123${BURIED_PART_ID_SUFFIX}`);
    expect(parseBuriedPartId(buriedPartId('col_123'))).toBe('col_123');
  });

  it('σκέτο column id ΔΕΝ περνά για part id (καμία σιωπηλή σύγχυση ταυτοτήτων)', () => {
    expect(parseBuriedPartId('col_123')).toBeNull();
  });

  it('το suffix μόνο του δεν είναι έγκυρο part id (κενό host)', () => {
    expect(parseBuriedPartId(BURIED_PART_ID_SUFFIX)).toBeNull();
  });

  it('η ισότητα refs είναι δομική (equality guard για leaves)', () => {
    expect(isSameBuriedPart({ columnId: 'a' }, { columnId: 'a' })).toBe(true);
    expect(isSameBuriedPart({ columnId: 'a' }, { columnId: 'b' })).toBe(false);
    expect(isSameBuriedPart(null, null)).toBe(true);
    expect(isSameBuriedPart({ columnId: 'a' }, null)).toBe(false);
  });
});

describe('ADR-715 — στόχοι highlight: ΟΛΟ το κοντόστυλο, όχι μία παρειά', () => {
  const MESH_KEYS = ['bottom', 'top', 'side:0', 'side:1', 'buried:0', 'buried:1'];

  it('κρατά ΜΟΝΟ τις θαμμένες όψεις, ζευγαρωμένες με το host id', () => {
    expect(buriedFaceTargets('col_1', MESH_KEYS)).toEqual([
      { bimId: 'col_1', faceKey: 'buried:0' },
      { bimId: 'col_1', faceKey: 'buried:1' },
    ]);
  });

  it('mesh χωρίς θαμμένη ζώνη → κανένας στόχος (κολώνα ορόφου: μηδέν overlay)', () => {
    expect(buriedFaceTargets('col_1', ['bottom', 'top', 'side:0'])).toEqual([]);
  });

  it('απόν `faceKeyByMaterialIndex` (legacy single-material mesh) → κανένας στόχος, χωρίς crash', () => {
    expect(buriedFaceTargets('col_1', undefined)).toEqual([]);
  });

  it('κενό host id → κανένας στόχος (ανώνυμο overlay δεν καθαρίζεται ποτέ)', () => {
    expect(buriedFaceTargets('', MESH_KEYS)).toEqual([]);
  });

  it('ΔΕΝ μπερδεύει το `side:` με το `buried:` (ο διαχωρισμός είναι το κλειδί, ADR-713 §3.1)', () => {
    const targets = buriedFaceTargets('col_1', MESH_KEYS);
    expect(targets.every((tgt) => tgt.faceKey.startsWith('buried:'))).toBe(true);
  });
});

describe('ADR-715 §3.1 — Η ΑΠΟΚΛΙΣΗ ΠΟΥ ΚΟΣΤΙΖΕΙ ΧΡΗΜΑΤΑ', () => {
  it('καμία βαφή → καμία απόκλιση', () => {
    expect(resolveBuriedPaintDivergence(column())).toEqual([]);
  });

  it('per-face υλικό ΙΔΙΟ με το Part-level → καμία απόκλιση (συμφωνούν, τίποτα να δηλωθεί)', () => {
    const entity = column({
      appearance: { 'buried:0': { materialId: DEFAULT_BURIED_WATERPROOFING_MATERIAL } },
    });
    expect(resolveBuriedPaintDivergence(entity)).toEqual([]);
  });

  it('ΤΟ ΚΡΙΣΙΜΟ: per-face υλικό ΔΙΑΦΟΡΕΤΙΚΟ → η όψη δηλώνεται ως αποκλίνουσα', () => {
    // Ο μηχανικός βλέπει μεμβράνη· η επιμέτρηση χρεώνει ασφαλτική επάλειψη (το default).
    const entity = column({ appearance: { 'buried:0': { materialId: WATERPROOF_MEMBRANE_MATERIAL } } });
    expect(resolveBuriedPaintDivergence(entity)).toEqual(['buried:0']);
  });

  it('σκέτο χρώμα (colorHex χωρίς materialId) μετράει ΚΑΙ ΑΥΤΟ ως απόκλιση', () => {
    // Ad-hoc χρώμα δεν λύνεται σε άρθρο ΑΤΟΕ → δεν επιμετρείται ΠΟΤΕ, άρα είναι απόκλιση.
    const entity = column({ appearance: { 'buried:1': { colorHex: '#123456' } } });
    expect(resolveBuriedPaintDivergence(entity)).toEqual(['buried:1']);
  });

  it('κενό `{}` (το «ρητά άβαφη» σήμα του ADR-713 §3.4) ΔΕΝ είναι απόκλιση', () => {
    // Είναι ο μηχανισμός που εμποδίζει την πτώση στο base `'*'` (το τούβλο) — δεν εκφράζει υλικό.
    const entity = column({ appearance: { 'buried:0': {} } });
    expect(resolveBuriedPaintDivergence(entity)).toEqual([]);
  });

  it('βαφή σε ΕΚΤΕΘΕΙΜΕΝΗ όψη (`side:i`) ή στο base δεν αγγίζει τη θαμμένη ζώνη', () => {
    const entity = column({
      appearance: { 'side:0': { materialId: 'mat-brick' }, '*': { materialId: 'mat-brick' } },
    });
    expect(resolveBuriedPaintDivergence(entity)).toEqual([]);
  });

  it('συγκρίνει με το ΡΗΤΟ Part-level υλικό, όχι με το default', () => {
    const entity = column({
      waterproofingMaterialId: WATERPROOF_MEMBRANE_MATERIAL,
      appearance: { 'buried:0': { materialId: WATERPROOF_MEMBRANE_MATERIAL } },
    });
    expect(resolveBuriedPaintDivergence(entity)).toEqual([]);
  });

  it('πολλές αποκλίνουσες όψεις επιστρέφονται όλες (το πλήθος είναι το μήνυμα στο UI)', () => {
    const entity = column({
      appearance: {
        'buried:0': { materialId: WATERPROOF_MEMBRANE_MATERIAL },
        'buried:1': { materialId: 'mat-brick' },
        'buried:2': {},
      },
    });
    expect(resolveBuriedPaintDivergence(entity)).toEqual(['buried:0', 'buried:1']);
  });
});

describe('ADR-715 — η δρομολόγηση του swatch κρίνεται στην ΤΑΥΤΟΤΗΤΑ του υλικού', () => {
  it('ΚΑΘΕ υλικό του καταλόγου αναγνωρίζεται (αλλιώς νέο υλικό δεν θα επιμετρείτο)', () => {
    for (const id of BURIED_WATERPROOFING_MATERIALS) {
      expect(isBuriedWaterproofingMaterial(id)).toBe(true);
    }
    expect(BURIED_WATERPROOFING_MATERIALS.length).toBe(8);
  });

  it('υλικό εκτός καταλόγου → cosmetic (τούβλο στη θαμμένη ζώνη είναι εμφάνιση, όχι εργασία)', () => {
    expect(isBuriedWaterproofingMaterial('mat-brick')).toBe(false);
    expect(isBuriedWaterproofingMaterial('mat-plaster-ext')).toBe(false);
  });

  it('απόν materialId (σκέτο χρώμα / clear) → cosmetic', () => {
    expect(isBuriedWaterproofingMaterial(undefined)).toBe(false);
  });
});
