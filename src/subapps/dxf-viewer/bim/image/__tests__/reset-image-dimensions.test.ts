/**
 * ADR-654 — Διαστάσεις εικόνας (pure geometry): «Επαναφορά Διαστάσεων» + «Κλείδωμα Αναλογιών».
 *
 * Κλειδώνει τη διαφορά των δύο ενεργειών:
 *   - Επαναφορά Διαστάσεων → ΑΠΟΛΥΤΟ αρχικό μέγεθος (intrinsic· fallback aspect-only για legacy).
 *   - Κλείδωμα Αναλογιών  → un-deform ΧΩΡΙΣ αλλαγή κλίμακας (κρατά τη μεγαλύτερη πλευρά).
 * Και στις δύο: σταθερό κέντρο, ανέγγιχτη περιστροφή, idempotent no-op.
 */

import {
  resetImageToOriginalSize,
  lockImageAspect,
  resolveResetToOriginalSize,
  resolveLockAspect,
  hasStoredIntrinsicSize,
} from '../reset-image-dimensions';
import { imageRectFrame } from '../image-grips';
import type { ImageEntity } from '../../../types/image';

const makeImage = (over: Partial<ImageEntity> = {}): ImageEntity => ({
  id: 'img_test',
  type: 'image',
  layerId: 'lyr_test',
  position: { x: 0, y: 0 },
  width: 40,
  height: 20,
  url: 'https://example.test/sprite.webp',
  ...over,
}) as ImageEntity;

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

/** Το κέντρο του κουτιού μιας εικόνας (rotation-aware) — ο invariant που πρέπει να μένει σταθερός. */
const centerOf = (e: ImageEntity) => imageRectFrame(e).center;

describe('resolveResetToOriginalSize — απόλυτο αρχικό μέγεθος', () => {
  it('intrinsic → επιστρέφει το αποθηκευμένο απόλυτο μέγεθος, αγνοεί το decoded', () => {
    const size = resolveResetToOriginalSize(
      makeImage({ width: 40, height: 20, intrinsicWidth: 30, intrinsicHeight: 20 }),
      { w: 999, h: 111 },
    );
    expect(size).toEqual({ width: 30, height: 20 });
  });

  it('legacy fallback: χωρίς intrinsic → aspect-only από decoded (κρατά μεγαλύτερη πλευρά)', () => {
    const size = resolveResetToOriginalSize(makeImage({ width: 40, height: 20 }), { w: 300, h: 200 });
    near(size!.width, 40);
    near(size!.height, 40 / 1.5);
  });

  it('null χωρίς intrinsic και χωρίς έγκυρο decoded', () => {
    expect(resolveResetToOriginalSize(makeImage(), null)).toBeNull();
    expect(resolveResetToOriginalSize(makeImage(), { w: 0, h: 200 })).toBeNull();
  });
});

describe('resolveLockAspect — un-deform κρατώντας την κλίμακα', () => {
  it('intrinsic → χρησιμοποιεί τον intrinsic λόγο, κρατά τη μεγαλύτερη πλευρά (ΟΧΙ απόλυτο μέγεθος)', () => {
    // intrinsic 30×20 (λόγος 1.5)· deformed 40×20 → κράτα 40, height = 40/1.5 (ΟΧΙ 20)
    const size = resolveLockAspect(
      makeImage({ width: 40, height: 20, intrinsicWidth: 30, intrinsicHeight: 20 }),
      null,
    );
    near(size!.width, 40);
    near(size!.height, 40 / 1.5);
  });

  it('χωρίς intrinsic → λόγος από decoded pixels, κρατά τη μεγαλύτερη πλευρά (height)', () => {
    const size = resolveLockAspect(makeImage({ width: 10, height: 50 }), { w: 300, h: 200 });
    near(size!.width, 75);
    near(size!.height, 50);
  });

  it('null όταν δεν προκύπτει λόγος (ούτε intrinsic ούτε decoded)', () => {
    expect(resolveLockAspect(makeImage(), null)).toBeNull();
  });
});

describe('hasStoredIntrinsicSize — decode-gate', () => {
  it('true μόνο με θετικά, πεπερασμένα intrinsic πεδία', () => {
    expect(hasStoredIntrinsicSize(makeImage({ intrinsicWidth: 30, intrinsicHeight: 20 }))).toBe(true);
    expect(hasStoredIntrinsicSize(makeImage())).toBe(false);
    expect(hasStoredIntrinsicSize(makeImage({ intrinsicWidth: 30 }))).toBe(false);
    expect(hasStoredIntrinsicSize(makeImage({ intrinsicWidth: NaN, intrinsicHeight: 20 }))).toBe(false);
  });
});

describe('resetImageToOriginalSize — patch με σταθερό κέντρο', () => {
  it('επαναφέρει απόλυτο μέγεθος, κέντρο σταθερό, χωρίς περιστροφή', () => {
    const entity = makeImage({ width: 40, height: 20, intrinsicWidth: 30, intrinsicHeight: 20 });
    const before = centerOf(entity);
    const patch = resetImageToOriginalSize(entity, null)!;
    expect(patch.width).toBe(30);
    expect(patch.height).toBe(20);
    const after = centerOf(makeImage({ ...patch }));
    near(after.x, before.x);
    near(after.y, before.y);
    // position = κέντρο − (w/2, h/2) = (20-15, 10-10) = (5, 0)
    near(patch.position.x, 5);
    near(patch.position.y, 0);
  });

  it('με περιστροφή: κέντρο & γωνία διατηρούνται', () => {
    const entity = makeImage({ width: 40, height: 20, intrinsicWidth: 30, intrinsicHeight: 20, rotation: 37 });
    const before = centerOf(entity);
    const patch = resetImageToOriginalSize(entity, null)!;
    const after = centerOf(makeImage({ ...patch, rotation: 37 }));
    near(after.x, before.x);
    near(after.y, before.y);
    expect(patch.width).toBe(30);
    expect(patch.height).toBe(20);
  });

  it('idempotent: ήδη στο αρχικό μέγεθος → null', () => {
    const entity = makeImage({ width: 30, height: 20, intrinsicWidth: 30, intrinsicHeight: 20 });
    expect(resetImageToOriginalSize(entity, null)).toBeNull();
  });
});

describe('lockImageAspect — patch που κάνει μόνο un-deform', () => {
  it('κρατά τη μεγαλύτερη πλευρά, διορθώνει τον λόγο, κέντρο σταθερό (ΟΧΙ επαναφορά μεγέθους)', () => {
    const entity = makeImage({ width: 40, height: 20, intrinsicWidth: 30, intrinsicHeight: 20 });
    const before = centerOf(entity);
    const patch = lockImageAspect(entity, null)!;
    near(patch.width, 40); // η μεγάλη πλευρά ΜΕΝΕΙ (η κλίμακα διατηρείται)
    near(patch.height, 40 / 1.5);
    const after = centerOf(makeImage({ ...patch }));
    near(after.x, before.x);
    near(after.y, before.y);
  });

  it('idempotent: ήδη σωστός λόγος → null', () => {
    const entity = makeImage({ width: 30, height: 20, intrinsicWidth: 30, intrinsicHeight: 20 });
    expect(lockImageAspect(entity, null)).toBeNull();
  });

  it('legacy: un-deform από decoded pixel-aspect, κέντρο σταθερό', () => {
    const entity = makeImage({ width: 40, height: 20 });
    const before = centerOf(entity);
    const patch = lockImageAspect(entity, { w: 300, h: 200 })!;
    near(patch.width, 40);
    near(patch.height, 40 / 1.5);
    const after = centerOf(makeImage({ ...patch }));
    near(after.x, before.x);
    near(after.y, before.y);
  });
});
