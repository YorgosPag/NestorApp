/**
 * ADR-654 — τοποθέτηση επίπλου κάτοψης: οι δύο μετατροπές.
 *
 * 1. mm → scene units (η σκηνή μπορεί να είναι σε mm/cm/m — ADR-462/$INSUNITS)
 * 2. κλικ = ΚΕΝΤΡΟ → `ImageEntity.position` = ΚΑΤΩ-ΑΡΙΣΤΕΡΗ γωνία (σύμβαση DXF INSERT)
 *
 * Και οι δύο είναι σιωπηλές: ένα λάθος εδώ δεν σκάει — απλά βάζει τον καναπέ 1000×
 * μεγάλο ή μετατοπισμένο κατά μισό καναπέ. Γι' αυτό κλειδώνονται με tests.
 */

import {
  buildFurniturePlanEntity,
  buildGhostFurniturePlanEntity,
  resolveFurniturePlanSceneSize,
  FURNITURE_PLAN_LAYER_ID,
} from '../place-furniture-plan';

const SOFA3 = 'furn-obj-001-1'; // aspect 2.4363 → 2100mm × ~862mm
const URL = 'https://example.test/furn-obj-001-1.webp';

describe('resolveFurniturePlanSceneSize — mm → scene units', () => {
  it('σκηνή σε mm: 1:1', () => {
    const size = resolveFurniturePlanSceneSize(SOFA3, 'mm')!;
    expect(size.width).toBeCloseTo(2100, 0);
  });

  it('σκηνή σε ΜΕΤΡΑ: ο καναπές είναι 2.1 μονάδες, ΟΧΙ 2100', () => {
    const size = resolveFurniturePlanSceneSize(SOFA3, 'm')!;
    expect(size.width).toBeCloseTo(2.1, 3);
    expect(size.height).toBeCloseTo(2.1 / 2.4363, 3);
  });

  it('σκηνή σε εκατοστά: 210', () => {
    expect(resolveFurniturePlanSceneSize(SOFA3, 'cm')!.width).toBeCloseTo(210, 1);
  });

  it('άγνωστο id → null', () => {
    expect(resolveFurniturePlanSceneSize('furn-άγνωστο', 'mm')).toBeNull();
  });
});

describe('buildFurniturePlanEntity — κλικ στο κέντρο', () => {
  it('το κλικ γίνεται ΚΕΝΤΡΟ: position = κλικ − (w/2, h/2)', () => {
    const entity = buildFurniturePlanEntity({
      position: { x: 1000, y: 500 },
      furnitureId: SOFA3,
      url: URL,
      sceneUnits: 'mm',
    })!;

    expect(entity.type).toBe('image');
    expect(entity.position.x).toBeCloseTo(1000 - entity.width / 2, 6);
    expect(entity.position.y).toBeCloseTo(500 - entity.height / 2, 6);

    // Το κέντρο του τοποθετημένου ορθογωνίου ξαναδίνει ΑΚΡΙΒΩΣ το σημείο του κλικ.
    expect(entity.position.x + entity.width / 2).toBeCloseTo(1000, 6);
    expect(entity.position.y + entity.height / 2).toBeCloseTo(500, 6);
  });

  it('προσγειώνεται στο layer του entourage (ανοιγοκλείνει με ένα κλικ)', () => {
    const entity = buildFurniturePlanEntity({
      position: { x: 0, y: 0 },
      furnitureId: SOFA3,
      url: URL,
    })!;
    expect(entity.layerId).toBe(FURNITURE_PLAN_LAYER_ID);
  });

  it('κρατά url + rotation, default rotation 0', () => {
    const rotated = buildFurniturePlanEntity({
      position: { x: 0, y: 0 },
      furnitureId: SOFA3,
      url: URL,
      rotation: 90,
    })!;
    expect(rotated.url).toBe(URL);
    expect(rotated.rotation).toBe(90);

    const plain = buildFurniturePlanEntity({ position: { x: 0, y: 0 }, furnitureId: SOFA3, url: URL })!;
    expect(plain.rotation).toBe(0);
  });

  it('κάθε τοποθέτηση παίρνει ΦΡΕΣΚΟ id (ανεξάρτητα instances)', () => {
    const params = { position: { x: 0, y: 0 }, furnitureId: SOFA3, url: URL };
    expect(buildFurniturePlanEntity(params)!.id).not.toBe(buildFurniturePlanEntity(params)!.id);
  });

  it('άγνωστο id → null (ΠΟΤΕ entity μηδενικού μεγέθους)', () => {
    expect(
      buildFurniturePlanEntity({ position: { x: 0, y: 0 }, furnitureId: 'furn-άγνωστο', url: URL }),
    ).toBeNull();
  });
});

describe('buildGhostFurniturePlanEntity — ίδιο transform με το commit', () => {
  it('ο ghost έχει ΑΚΡΙΒΩΣ τη γεωμετρία του commit (μηδέν jump στην τοποθέτηση)', () => {
    const params = { position: { x: 250, y: -75 }, furnitureId: SOFA3, url: URL, rotation: 30 };
    const ghost = buildGhostFurniturePlanEntity(params)!;
    const committed = buildFurniturePlanEntity(params)!;

    expect(ghost.position).toEqual(committed.position);
    expect(ghost.width).toBeCloseTo(committed.width, 6);
    expect(ghost.height).toBeCloseTo(committed.height, 6);
    expect(ghost.rotation).toBe(committed.rotation);
  });

  it('ο ghost έχει σταθερό id — δεν μπαίνει ποτέ στη σκηνή', () => {
    const params = { position: { x: 0, y: 0 }, furnitureId: SOFA3, url: URL };
    expect(buildGhostFurniturePlanEntity(params)!.id).toBe(
      buildGhostFurniturePlanEntity(params)!.id,
    );
  });
});
