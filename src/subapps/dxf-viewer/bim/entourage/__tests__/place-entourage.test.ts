/**
 * ADR-654 M6/M7 — τοποθέτηση entourage (άνθρωποι/οχήματα/φυτά/έπιπλα): οι δύο μετατροπές,
 * κλειδωμένες με tests.
 *
 * 1. mm → scene units (η σκηνή μπορεί σε mm/cm/m — $INSUNITS)
 * 2. κλικ = ΚΕΝΤΡΟ → `ImageEntity.position` = ΚΑΤΩ-ΑΡΙΣΤΕΡΗ γωνία (σύμβαση DXF INSERT)
 *
 * Επαληθεύει ότι το ΚΟΙΝΟ factory (`createEntouragePlacer`) δουλεύει σωστά για ΟΛΕΣ τις
 * οικογένειες μέσω των module singletons — μία μηχανή, N instances (N.18). Τα furniture cases
 * (Φάση Γ) κλειδώνουν το «μεγάλη πλευρά, ΟΧΙ πλάτος» + layer FURNITURE-2D (μηδέν regression).
 */

import {
  peoplePlanPlacer,
  vehiclesPlanPlacer,
  plantsPlanPlacer,
  furniturePlanPlacer,
  PEOPLE_PLAN_LAYER_ID,
  VEHICLES_PLAN_LAYER_ID,
  PLANTS_PLAN_LAYER_ID,
  FURNITURE_PLAN_LAYER_ID,
} from '../entourage-placers';

// ppl-obj-001-1: category 'person' (650mm), aspect 0.4973 (<1 → μεγάλη πλευρά = ύψος)
const PERSON = 'ppl-obj-001-1';
// veh-obj-010-1: category 'car' (4500mm), aspect 1.9156 (>1 → μεγάλη πλευρά = πλάτος)
const CAR = 'veh-obj-010-1';
// pl-obj-001-1: category 'tree' (6000mm), aspect 0.9987 (~τετράγωνο)
const TREE = 'pl-obj-001-1';
// furn-obj-001-1: category 'sofa3' (2100mm), aspect 2.4363 (>1 → landscape, μεγάλη πλευρά = πλάτος)
const SOFA3 = 'furn-obj-001-1';
// furn-obj-001-2: category 'sofa2' (1500mm), aspect 0.571 (<1 → portrait· ο διθέσιος ΔΕΝ γίνεται τέρας)
const SOFA2_PORTRAIT = 'furn-obj-001-2';
const URL = 'https://example.test/sprite.webp';

describe('peoplePlanPlacer.resolveSceneSize — μεγάλη πλευρά = ύψος (aspect < 1)', () => {
  it('σκηνή σε mm: ύψος 650, πλάτος 650×aspect', () => {
    const size = peoplePlanPlacer.resolveSceneSize(PERSON, 'mm')!;
    expect(size.height).toBeCloseTo(650, 0);
    expect(size.width).toBeCloseTo(650 * 0.4973, 1);
  });

  it('σκηνή σε ΜΕΤΡΑ: ο άνθρωπος είναι 0.65 μονάδες ύψος, ΟΧΙ 650', () => {
    const size = peoplePlanPlacer.resolveSceneSize(PERSON, 'm')!;
    expect(size.height).toBeCloseTo(0.65, 3);
  });

  it('άγνωστο id → null', () => {
    expect(peoplePlanPlacer.resolveSceneSize('ppl-άγνωστο', 'mm')).toBeNull();
  });
});

describe('vehiclesPlanPlacer.resolveSceneSize — μεγάλη πλευρά = πλάτος (aspect > 1)', () => {
  it('σκηνή σε mm: αυτοκίνητο πλάτος 4500, ύψος 4500/aspect', () => {
    const size = vehiclesPlanPlacer.resolveSceneSize(CAR, 'mm')!;
    expect(size.width).toBeCloseTo(4500, 0);
    expect(size.height).toBeCloseTo(4500 / 1.9156, 0);
  });
});

describe('plantsPlanPlacer.resolveSceneSize — μεγάλη πλευρά = μήκος κατηγορίας (tree 6000mm)', () => {
  it('σκηνή σε mm: μεγάλη πλευρά 6000', () => {
    const size = plantsPlanPlacer.resolveSceneSize(TREE, 'mm')!;
    expect(Math.max(size.width, size.height)).toBeCloseTo(6000, 0);
  });

  it('τα φυτά προσγειώνονται στο δικό τους layer', () => {
    const entity = plantsPlanPlacer.buildEntity({ position: { x: 0, y: 0 }, itemId: TREE, url: URL })!;
    expect(entity.layerId).toBe(PLANTS_PLAN_LAYER_ID);
  });
});

describe('furniturePlanPlacer.resolveSceneSize — «μεγάλη πλευρά», ΟΧΙ «πλάτος» (Φάση Γ)', () => {
  it('LANDSCAPE (aspect > 1): το μήκος πάει στο ΠΛΑΤΟΣ — sofa3 2100 × 2100/aspect', () => {
    const size = furniturePlanPlacer.resolveSceneSize(SOFA3, 'mm')!;
    expect(size.width).toBeCloseTo(2100, 0);
    expect(size.height).toBeCloseTo(2100 / 2.4363, 0);
    expect(size.width).toBeGreaterThan(size.height);
  });

  it('PORTRAIT (aspect < 1): το μήκος πάει στο ΥΨΟΣ — ο διθέσιος 1500 ΔΕΝ γίνεται 2.6m βαθύς', () => {
    const size = furniturePlanPlacer.resolveSceneSize(SOFA2_PORTRAIT, 'mm')!;
    expect(size.height).toBeCloseTo(1500, 0);
    expect(size.width).toBeCloseTo(1500 * 0.571, 0);
    expect(size.width).toBeLessThan(1000); // ρεαλιστικό βάθος καναπέ
  });

  it('σκηνή σε ΜΕΤΡΑ: ο καναπές είναι 2.1 μονάδες, ΟΧΙ 2100', () => {
    expect(furniturePlanPlacer.resolveSceneSize(SOFA3, 'm')!.width).toBeCloseTo(2.1, 3);
  });

  it('τα έπιπλα προσγειώνονται στο δικό τους layer (FURNITURE-2D — ανοιγοκλείνει με ένα κλικ)', () => {
    const entity = furniturePlanPlacer.buildEntity({ position: { x: 0, y: 0 }, itemId: SOFA3, url: URL })!;
    expect(entity.layerId).toBe(FURNITURE_PLAN_LAYER_ID);
  });

  it('άγνωστο id → null', () => {
    expect(furniturePlanPlacer.resolveSceneSize('furn-άγνωστο', 'mm')).toBeNull();
  });
});

describe('buildEntity — κλικ στο κέντρο, per-family layer', () => {
  it('το κλικ γίνεται ΚΕΝΤΡΟ: position = κλικ − (w/2, h/2)', () => {
    const entity = peoplePlanPlacer.buildEntity({
      position: { x: 1000, y: 500 },
      itemId: PERSON,
      url: URL,
      sceneUnits: 'mm',
    })!;
    expect(entity.type).toBe('image');
    expect(entity.position.x + entity.width / 2).toBeCloseTo(1000, 6);
    expect(entity.position.y + entity.height / 2).toBeCloseTo(500, 6);
    expect(entity.layerId).toBe(PEOPLE_PLAN_LAYER_ID);
  });

  it('τα οχήματα προσγειώνονται στο δικό τους layer', () => {
    const entity = vehiclesPlanPlacer.buildEntity({ position: { x: 0, y: 0 }, itemId: CAR, url: URL })!;
    expect(entity.layerId).toBe(VEHICLES_PLAN_LAYER_ID);
  });

  it('κρατά url + rotation, default rotation 0', () => {
    const rotated = peoplePlanPlacer.buildEntity({ position: { x: 0, y: 0 }, itemId: PERSON, url: URL, rotation: 90 })!;
    expect(rotated.url).toBe(URL);
    expect(rotated.rotation).toBe(90);
    const plain = peoplePlanPlacer.buildEntity({ position: { x: 0, y: 0 }, itemId: PERSON, url: URL })!;
    expect(plain.rotation).toBe(0);
  });

  it('κάθε τοποθέτηση παίρνει ΦΡΕΣΚΟ id', () => {
    const params = { position: { x: 0, y: 0 }, itemId: PERSON, url: URL };
    expect(peoplePlanPlacer.buildEntity(params)!.id).not.toBe(peoplePlanPlacer.buildEntity(params)!.id);
  });

  it('άγνωστο id → null (ΠΟΤΕ entity μηδενικού μεγέθους)', () => {
    expect(peoplePlanPlacer.buildEntity({ position: { x: 0, y: 0 }, itemId: 'ppl-άγνωστο', url: URL })).toBeNull();
  });
});

describe('buildGhost — ίδιο transform με το commit, σταθερό id ανά layer', () => {
  it('ο ghost έχει ΑΚΡΙΒΩΣ τη γεωμετρία του commit (μηδέν jump)', () => {
    const params = { position: { x: 250, y: -75 }, itemId: CAR, url: URL, rotation: 30 };
    const ghost = vehiclesPlanPlacer.buildGhost(params)!;
    const committed = vehiclesPlanPlacer.buildEntity(params)!;
    expect(ghost.position).toEqual(committed.position);
    expect(ghost.width).toBeCloseTo(committed.width, 6);
    expect(ghost.height).toBeCloseTo(committed.height, 6);
    expect(ghost.rotation).toBe(committed.rotation);
  });

  it('ο ghost έχει σταθερό, layer-scoped id — δεν μπαίνει ποτέ στη σκηνή', () => {
    const params = { position: { x: 0, y: 0 }, itemId: PERSON, url: URL };
    expect(peoplePlanPlacer.buildGhost(params)!.id).toBe(`${PEOPLE_PLAN_LAYER_ID}-ghost`);
    expect(peoplePlanPlacer.buildGhost(params)!.id).toBe(peoplePlanPlacer.buildGhost(params)!.id);
  });
});
