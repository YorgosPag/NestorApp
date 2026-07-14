/**
 * ADR-654 M6 — τοποθέτηση entourage (άνθρωποι/οχήματα): οι δύο μετατροπές, κλειδωμένες με tests.
 *
 * 1. mm → scene units (η σκηνή μπορεί σε mm/cm/m — $INSUNITS)
 * 2. κλικ = ΚΕΝΤΡΟ → `ImageEntity.position` = ΚΑΤΩ-ΑΡΙΣΤΕΡΗ γωνία (σύμβαση DXF INSERT)
 *
 * Επαληθεύει ότι το ΚΟΙΝΟ factory (`createEntouragePlacer`) δουλεύει σωστά και για τις δύο
 * οικογένειες μέσω των module singletons — μία μηχανή, δύο instances (N.18).
 */

import {
  peoplePlanPlacer,
  vehiclesPlanPlacer,
  PEOPLE_PLAN_LAYER_ID,
  VEHICLES_PLAN_LAYER_ID,
} from '../entourage-placers';

// ppl-obj-001-1: category 'person' (650mm), aspect 0.4973 (<1 → μεγάλη πλευρά = ύψος)
const PERSON = 'ppl-obj-001-1';
// veh-obj-010-1: category 'car' (4500mm), aspect 1.9156 (>1 → μεγάλη πλευρά = πλάτος)
const CAR = 'veh-obj-010-1';
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
