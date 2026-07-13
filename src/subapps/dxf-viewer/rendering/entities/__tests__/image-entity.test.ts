/**
 * ADR-651 Φάση Ε — `ImageEntity` (standalone raster εικόνα).
 *
 * Το `ImageRenderer.drawImage` απαιτεί canvas context (καλύπτεται από τα integration render
 * tests)· εδώ κλειδώνουμε τα **καθαρά** κομμάτια του νέου τύπου, που πρέπει να δουλεύουν ώστε
 * η σφραγίδα να επιλέγεται/μετακινείται/κλιμακώνεται σωστά και ως block member: type guard,
 * bounds (rotation-aware), hit-test (fill), scale, rotate, move.
 */

import { isImageEntity, type ImageEntity, type Entity } from '../../../types/entities';
import { resolveEntityBounds } from '../../hitTesting/entity-bounds-ssot';
import { performDetailedHitTest } from '../../hitTesting/hit-test-entity-tests';
import { scaleEntity } from '../../../systems/scale/scale-entity-transform';
import { rotateEntity } from '../../../utils/rotation-math';
import { calculateMovedGeometry } from '../../../core/commands/entity-commands/move-entity-geometry';

function image(overrides: Partial<ImageEntity> = {}): ImageEntity {
  return {
    id: 'img-1',
    type: 'image',
    layerId: '0',
    position: { x: 10, y: 20 },
    width: 40,
    height: 30,
    url: 'https://firebasestorage.example/stamp.png',
    ...overrides,
  };
}

describe('ADR-651 Φάση Ε — ImageEntity type guard', () => {
  it('αναγνωρίζει το image, απορρίπτει άλλους τύπους', () => {
    expect(isImageEntity(image())).toBe(true);
    expect(isImageEntity({ type: 'line' } as unknown as Entity)).toBe(false);
  });
});

describe('ADR-651 Φάση Ε — ImageEntity bounds', () => {
  it('χωρίς περιστροφή: AABB = το ορθογώνιο [position, position+size]', () => {
    const b = resolveEntityBounds(image());
    expect(b).toMatchObject({ minX: 10, minY: 20, maxX: 50, maxY: 50 });
  });

  it('με περιστροφή 90°: το AABB μεγαλώνει (rotation-aware, marquee-selectable)', () => {
    const b = resolveEntityBounds(image({ rotation: 90 }));
    // Περιστροφή γύρω από το position ⇒ το bbox αλλάζει σχήμα (δεν μένει 40×30).
    expect(b).not.toBeNull();
    const width = b!.maxX - b!.minX;
    const height = b!.maxY - b!.minY;
    expect(width).toBeCloseTo(30, 6);
    expect(height).toBeCloseTo(40, 6);
  });
});

describe('ADR-651 Φάση Ε — ImageEntity hit-test (fill)', () => {
  it('κλικ μέσα στην εικόνα την επιλέγει, έξω όχι', () => {
    const e = image();
    expect(performDetailedHitTest(e, { x: 30, y: 35 }, 1)).not.toBeNull();
    expect(performDetailedHitTest(e, { x: 100, y: 100 }, 1)).toBeNull();
  });
});

describe('ADR-651 Φάση Ε — ImageEntity transforms (block member + standalone)', () => {
  it('scale: position + width/height κλιμακώνονται (world units, όχι annotative)', () => {
    const scaled = scaleEntity(image(), { x: 0, y: 0 }, 2, 3) as Partial<ImageEntity>;
    expect(scaled.width).toBeCloseTo(80, 6);
    expect(scaled.height).toBeCloseTo(90, 6);
    expect(scaled.position).toMatchObject({ x: 20, y: 60 });
  });

  it('rotate: το position περιστρέφεται γύρω από το pivot + συσσωρεύεται η γωνία', () => {
    const rotated = rotateEntity(image({ position: { x: 1, y: 0 } }), { x: 0, y: 0 }, 90) as ImageEntity;
    expect(rotated.position.x).toBeCloseTo(0, 6);
    expect(rotated.position.y).toBeCloseTo(1, 6);
    expect(rotated.rotation).toBeCloseTo(90, 6);
  });

  it('move: το position μετατοπίζεται άκαμπτα, width/height/rotation αμετάβλητα', () => {
    const moved = calculateMovedGeometry(image({ rotation: 45 }), { x: 5, y: -5 }) as Partial<ImageEntity>;
    expect(moved.position).toMatchObject({ x: 15, y: 15 });
    expect(moved.width).toBeUndefined();
    expect(moved.height).toBeUndefined();
  });
});
