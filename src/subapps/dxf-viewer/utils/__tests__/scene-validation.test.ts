/**
 * ADR-635 Φ C.23 — Το `validateScene` επέστρεφε **ένα `boolean` για τρεις αιτίες**, και ο χρήστης
 * έβλεπε «check the file format» — λάθος συμβουλή στις δύο από τις τρεις. Η εισαγωγή του
 * `47_ergasia.dxf` απέτυχε στις 2026-07-29 και **καμία** πληροφορία δεν επέζησε της αποτυχίας.
 *
 * Αυτά τα tests κλειδώνουν ΔΥΟ πράγματα:
 *   1. **Διαγνωσιμότητα** — ποια συνθήκη, ποια οντότητα, ποιο πεδίο.
 *   2. **Παρίτητα σημασιολογίας** — ό,τι περνούσε με τον παλιό boolean έλεγχο, περνά ακόμα.
 *      (Το `Infinity` ΓΙΝΕΤΑΙ δεκτό — ο παλιός έλεγχος ρωτούσε `isNaN`, όχι `isFinite`.)
 */
import {
  validateSceneModel,
  describeSceneValidationFailure,
  type SceneValidationFailure,
} from '../scene-validation';
import type { SceneModel } from '../../types/scene';

type LooseEntity = Record<string, unknown>;

const scene = (entities: LooseEntity[], bounds?: Partial<SceneModel['bounds']>): SceneModel =>
  ({
    entities,
    layersById: { lyr_1: { id: 'lyr_1', name: '0' } },
    bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 }, ...bounds },
    units: 'mm',
  }) as unknown as SceneModel;

const ok = (over: LooseEntity = {}): LooseEntity => ({ id: 'ent_1', type: 'line', layerId: 'lyr_1', ...over });

/** Η αιτία μιας αποτυχίας — αποτυγχάνει ρητά αν η σκηνή κριθεί έγκυρη. */
const failureOf = (model: SceneModel): SceneValidationFailure => {
  const result = validateSceneModel(model);
  if (result.valid) throw new Error('Περίμενα άκυρη σκηνή, αλλά η επικύρωση πέρασε');
  return result.failure;
};

describe('validateSceneModel — έγκυρες σκηνές (παρίτητα με τον παλιό boolean)', () => {
  it('πλήρης σκηνή με σωστά αποδοσμένες οντότητες → valid', () => {
    expect(validateSceneModel(scene([ok(), ok({ id: 'ent_2' })]))).toEqual({ valid: true });
  });

  it('κενή σκηνή (μηδέν οντότητες) → valid, όπως και πριν', () => {
    expect(validateSceneModel(scene([])).valid).toBe(true);
  });

  it('bounds ±Infinity (κενό bbox) → ΕΓΚΥΡΟ: ο παλιός έλεγχος ρωτούσε isNaN, όχι isFinite', () => {
    const infinite = scene([], { min: { x: Infinity, y: Infinity }, max: { x: -Infinity, y: -Infinity } });
    expect(validateSceneModel(infinite).valid).toBe(true);
  });
});

describe('validateSceneModel — #1 δομή', () => {
  it('ονομάζει ΟΛΑ τα πεδία που λείπουν, όχι μόνο το πρώτο', () => {
    const broken = { units: 'mm' } as unknown as SceneModel;
    const failure = failureOf(broken);
    expect(failure).toEqual({ code: 'missing-structure', missing: ['entities', 'layersById', 'bounds'] });
    expect(describeSceneValidationFailure(failure)).toContain('entities, layersById, bounds');
  });

  it('η δομή προηγείται των υπολοίπων ελέγχων (δείχνει τη ΡΙΖΑ, όχι επακόλουθο)', () => {
    const noBounds = { entities: [ok()], layersById: {} } as unknown as SceneModel;
    expect(failureOf(noBounds).code).toBe('missing-structure');
  });
});

describe('validateSceneModel — #2 bounds NaN', () => {
  it('απαριθμεί ΠΟΙΑ πεδία του bbox είναι NaN', () => {
    const failure = failureOf(scene([ok()], { min: { x: NaN, y: 0 }, max: { x: 10, y: NaN } }));
    if (failure.code !== 'non-finite-bounds') throw new Error('λάθος κλάδος');
    expect(failure.fields).toEqual(['min.x', 'max.y']);
    expect(failure.entityCount).toBe(1);
  });

  it('undefined συντεταγμένη bbox = άκυρη (ταυτόσημο με το global isNaN του παλιού κώδικα)', () => {
    const failure = failureOf(scene([ok()], { min: { x: undefined as unknown as number, y: 0 } }));
    expect(failure.code).toBe('non-finite-bounds');
  });

  it('ΕΝΤΟΠΙΖΕΙ την πρώτη μη-πεπερασμένη συντεταγμένη μέσα σε φωλιασμένη οντότητα', () => {
    const dirty = ok({ id: 'ent_bad', type: 'polyline', points: [{ x: 1, y: 2 }, { x: 3, y: NaN }] });
    const failure = failureOf(scene([ok(), dirty], { max: { x: NaN, y: NaN } }));
    if (failure.code !== 'non-finite-bounds') throw new Error('λάθος κλάδος');
    expect(failure.firstOffender).toMatchObject({ index: 1, id: 'ent_bad', type: 'polyline', path: 'points[1].y' });
    expect(describeSceneValidationFailure(failure)).toContain('points[1].y');
  });

  it('όταν ΚΑΜΙΑ οντότητα δεν φταίει, το λέει ρητά — το NaN γεννήθηκε στον υπολογισμό bbox', () => {
    const failure = failureOf(scene([ok()], { min: { x: NaN, y: 0 } }));
    if (failure.code !== 'non-finite-bounds') throw new Error('λάθος κλάδος');
    expect(failure.firstOffender).toBeUndefined();
    expect(describeSceneValidationFailure(failure)).toContain('bounds computation itself');
  });
});

describe('validateSceneModel — #3 οντότητα χωρίς ταυτότητα', () => {
  it('δείχνει index/id/type + ΠΟΙΑ πεδία λείπουν', () => {
    const failure = failureOf(scene([ok(), ok({ id: 'ent_2', layerId: undefined })]));
    if (failure.code !== 'unattributed-entity') throw new Error('λάθος κλάδος');
    expect(failure.first).toEqual({ index: 1, id: 'ent_2', type: 'line', missing: ['layerId'] });
    expect(failure.affectedCount).toBe(1);
  });

  it('μετρά ΟΛΕΣ τις πληγείσες ανά τύπο — δείχνει αν φταίει ΕΝΑ pipeline (π.χ. IMAGE×10)', () => {
    const entities = [
      ok(),
      ...Array.from({ length: 10 }, (_, i) => ok({ id: `img_${i}`, type: 'image', layerId: '' })),
      ok({ id: 'txt_1', type: 'text', layerId: undefined }),
    ];
    const failure = failureOf(scene(entities));
    if (failure.code !== 'unattributed-entity') throw new Error('λάθος κλάδος');
    expect(failure.affectedCount).toBe(11);
    expect(failure.affectedByType).toEqual({ image: 10, text: 1 });
    expect(describeSceneValidationFailure(failure)).toContain('image×10');
  });

  it('οντότητα χωρίς type μετριέται ως UNKNOWN αντί να χαθεί', () => {
    const failure = failureOf(scene([ok({ type: undefined })]));
    if (failure.code !== 'unattributed-entity') throw new Error('λάθος κλάδος');
    expect(failure.affectedByType).toEqual({ UNKNOWN: 1 });
    expect(failure.first.missing).toEqual(['type']);
  });
});

describe('describeSceneValidationFailure — τεχνική, μη-μεταφρασμένη γραμμή', () => {
  it('κάθε κλάδος παράγει μη-κενή περιγραφή (καμία σιωπηλή αποτυχία)', () => {
    const cases: SceneValidationFailure[] = [
      { code: 'missing-structure', missing: ['bounds'] },
      { code: 'non-finite-bounds', fields: ['min.x'], entityCount: 3 },
      {
        code: 'unattributed-entity',
        first: { index: 0, id: 'e', type: 'line', missing: ['layerId'] },
        affectedCount: 1,
        affectedByType: { line: 1 },
      },
    ];
    for (const failure of cases) {
      expect(describeSceneValidationFailure(failure).length).toBeGreaterThan(10);
    }
  });
});
