/**
 * ADR-654 — image grips (entourage / furniture-plan sprite): θέσεις λαβών + drag transforms.
 *
 * Κλειδώνει τη συμπεριφορά που έλειπε και έκανε την εικόνα «δεύτερης κατηγορίας» στον καμβά:
 * λαβές που ΥΠΑΡΧΟΥΝ (registry), τη ΜΕΤΑΚΙΝΟΥΝ, την ΠΕΡΙΣΤΡΕΦΟΥΝ και την ΚΛΙΜΑΚΩΝΟΥΝ — και
 * μάλιστα rotation-aware, με την αντίθετη γωνία σταθερή (wall/block parity).
 */

import {
  getImageGrips,
  applyImageGripDrag,
  imageRectFrame,
  IMAGE_MOVE_KIND,
  IMAGE_ROTATION_KIND,
} from '../image-grips';
import type { ImageEntity } from '../../../types/image';

const makeImage = (over: Partial<ImageEntity> = {}): ImageEntity => ({
  id: 'img_test',
  type: 'image',
  layerId: 'lyr_test',
  position: { x: 10, y: 20 },
  width: 100,
  height: 50,
  url: 'https://example.test/sprite.webp',
  ...over,
}) as ImageEntity;

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('imageRectFrame — corner-anchored → centre-anchored', () => {
  it('κέντρο = position + (w/2, h/2) χωρίς περιστροφή', () => {
    const frame = imageRectFrame(makeImage());
    near(frame.center.x, 60);
    near(frame.center.y, 45);
    near(frame.halfWidth, 50);
    near(frame.halfLength, 25);
    expect(frame.rotationDeg).toBe(0);
  });

  it('στις 90° το κέντρο περιστρέφεται ΓΥΡΩ ΑΠΟ το position (σύμβαση DXF INSERT)', () => {
    const frame = imageRectFrame(makeImage({ position: { x: 0, y: 0 }, rotation: 90 }));
    near(frame.center.x, -25);
    near(frame.center.y, 50);
  });
});

describe('getImageGrips', () => {
  it('6 λαβές: MOVE (κέντρο) + ROTATION (μέσο πάνω ακμής) + 4 γωνιακές', () => {
    const grips = getImageGrips(makeImage());
    expect(grips.map((g) => g.gripKind?.kind)).toEqual([
      'image-move', 'image-rotation',
      'image-corner-ne', 'image-corner-nw', 'image-corner-sw', 'image-corner-se',
    ]);
    // MOVE = κέντρο, movesEntity· ROTATION = μέσο πάνω ακμής (x=κέντρο, y=πάνω).
    near(grips[0].position.x, 60);
    near(grips[0].position.y, 45);
    expect(grips[0].movesEntity).toBe(true);
    near(grips[1].position.x, 60);
    near(grips[1].position.y, 70);
    // Γωνιακές = οι πραγματικές γωνίες του ορθογωνίου (NE, NW, SW, SE).
    expect(grips.slice(2).map((g) => [g.position.x, g.position.y])).toEqual([
      [110, 70], [10, 70], [10, 20], [110, 20],
    ]);
    expect(grips.every((g) => g.entityId === 'img_test')).toBe(true);
  });

  it('όλες οι λαβές είναι tagged με `on: "image"` (αλλιώς δεν δρομολογούνται στο commit)', () => {
    expect(getImageGrips(makeImage()).every((g) => g.gripKind?.on === 'image')).toBe(true);
  });
});

describe('applyImageGripDrag', () => {
  it('move → μεταφέρει το position (και μόνο αυτό)', () => {
    const e = makeImage();
    const patch = applyImageGripDrag(IMAGE_MOVE_KIND, e, e.position, { x: 5, y: -7 });
    expect(patch).toEqual({ position: { x: 15, y: 13 } });
  });

  it('rotation (χωρίς επιλεγμένο κέντρο) → γράφει ΜΟΝΟ rotation, σε ΜΟΙΡΕΣ', () => {
    const e = makeImage({ position: { x: 0, y: 0 }, width: 100, height: 100 });
    // Λαβή στο (100, 0) → drag στο (0, 100): swept +90° γύρω από το position.
    const patch = applyImageGripDrag(IMAGE_ROTATION_KIND, e, { x: 100, y: 0 }, { x: -100, y: 100 });
    expect(patch.position).toBeUndefined();
    near(patch.rotation as number, 90);
  });

  it('rotation με hot-grip pivot → η εικόνα κάνει orbit (position ΚΑΙ rotation)', () => {
    const e = makeImage({ position: { x: 10, y: 0 }, rotation: 0 });
    const pivot = { x: 0, y: 0 };
    const anchor = { x: 10, y: 0 };
    // Ο κέρσορας πάει στο (0,10) → swept +90° γύρω από το pivot.
    const patch = applyImageGripDrag(IMAGE_ROTATION_KIND, e, anchor, { x: -10, y: 10 }, { pivot, anchor });
    near(patch.rotation as number, 90);
    near(patch.position!.x, 0);
    near(patch.position!.y, 10);
  });

  it('corner (NE) → resize με την ΑΝΤΙΘΕΤΗ (SW) γωνία σταθερή', () => {
    const e = makeImage(); // BL (10,20), 100×50 → NE (110,70), SW (10,20)
    const patch = applyImageGripDrag('image-corner-ne', e, { x: 110, y: 70 }, { x: 20, y: 10 });
    near(patch.width as number, 120);
    near(patch.height as number, 60);
    // Η SW γωνία (= το position) ΔΕΝ κουνήθηκε.
    near(patch.position!.x, 10);
    near(patch.position!.y, 20);
  });

  it('corner (SW) → το position ακολουθεί τον κέρσορα, η NE μένει καρφωμένη', () => {
    const e = makeImage();
    const patch = applyImageGripDrag('image-corner-sw', e, { x: 10, y: 20 }, { x: 10, y: 10 });
    near(patch.width as number, 90);
    near(patch.height as number, 40);
    near(patch.position!.x, 20);
    near(patch.position!.y, 30);
    // NE = position + (w,h) → αμετάβλητη (110, 70).
    near(patch.position!.x + (patch.width as number), 110);
    near(patch.position!.y + (patch.height as number), 70);
  });

  it('corner σε ΠΕΡΙΣΤΡΑΜΜΕΝΗ εικόνα → το resize γίνεται στους ΤΟΠΙΚΟΥΣ άξονες (rotation αμετάβλητη)', () => {
    const e = makeImage({ position: { x: 0, y: 0 }, width: 100, height: 50, rotation: 90 });
    // Στις 90° ο τοπικός +X δείχνει world +Y: drag κατά +10 στο world Y → +10 πλάτος.
    const patch = applyImageGripDrag('image-corner-ne', e, { x: -50, y: 100 }, { x: 0, y: 10 });
    near(patch.width as number, 110);
    near(patch.height as number, 50);
    expect((patch as { rotation?: number }).rotation).toBeUndefined();
  });
});
