/**
 * @fileoverview **ΤΟ ΣΗΜΕΙΟ ΕΣΤΙΑΣΗΣ — ανάγνωση, προτεραιότητα, κεντράρισμα** (ADR-880).
 * @related lib/listings/photo-focal-point
 *
 * Τρεις ερωτήσεις: *«διαβάζεται σκουπίδι ως απουσία;»* · *«υπερισχύει ο άνθρωπος;»* ·
 * *«κάθεται το θέμα στο ΚΕΝΤΡΟ του πλαισίου, και σφηνώνει στην άκρη;»*.
 */

import {
  CENTER_FOCAL_POINT,
  coverObjectPosition,
  readDeclaredFocalPoints,
  readPhotoFocalPoint,
  resolvePhotoFocalPoint,
  sameFocalPoint,
} from '@/lib/listings/photo-focal-point';

const CARD = { w: 3, h: 2 } as const;

describe('readPhotoFocalPoint — σκουπίδι ⇒ απουσία, ποτέ κέντρο', () => {
  it('έγκυρο σημείο περνά αυτούσιο', () => {
    expect(readPhotoFocalPoint({ x: 0.2, y: 0.9 })).toEqual({ x: 0.2, y: 0.9 });
  });

  it.each([
    undefined,
    null,
    'x',
    [],
    { x: 0.5 },
    { x: -0.1, y: 0.5 },
    { x: 0.5, y: 1.01 },
    { x: Number.NaN, y: 0.5 },
    { x: 0.5, y: 0.5, extra: 1 },
  ])('%p ⇒ null', (value) => {
    expect(readPhotoFocalPoint(value)).toBeNull();
  });
});

describe('readDeclaredFocalPoints — άκυρη γραμμή δεν ακυρώνει τις άλλες', () => {
  it('κρατά τις έγκυρες, πετά τις άκυρες', () => {
    const map = readDeclaredFocalPoints({ a: { x: 0.1, y: 0.2 }, b: { x: 3, y: 0 }, '': { x: 0, y: 0 } });
    expect([...map.entries()]).toEqual([['a', { x: 0.1, y: 0.2 }]]);
  });

  it.each([undefined, null, 'x', [{ x: 0, y: 0 }]])('%p ⇒ κενό', (value) => {
    expect(readDeclaredFocalPoints(value).size).toBe(0);
  });
});

describe('resolvePhotoFocalPoint — ο άνθρωπος υπερισχύει (Cloudinary)', () => {
  const human = { x: 0.1, y: 0.1 };
  const auto = { x: 0.9, y: 0.9 };

  it('δήλωση ⇒ δήλωση, ακόμη και με αυτόματο', () => {
    expect(resolvePhotoFocalPoint(human, auto)).toBe(human);
  });
  it('χωρίς δήλωση ⇒ αυτόματο', () => {
    expect(resolvePhotoFocalPoint(null, auto)).toBe(auto);
  });
  it('τίποτα ⇒ null (κέντρο στην απόδοση)', () => {
    expect(resolvePhotoFocalPoint(null, null)).toBeNull();
  });
  it('ισότητα', () => {
    expect(sameFocalPoint(human, { ...human })).toBe(true);
    expect(sameFocalPoint(human, null)).toBe(false);
    expect(sameFocalPoint(null, null)).toBe(true);
  });
});

describe('coverObjectPosition — κεντράρισμα με σφήνωση', () => {
  it('κάθετη 2:3 σε κάρτα 3:2: υπερχειλίζει μόνο το ύψος', () => {
    const at = coverObjectPosition({ width: 1000, height: 1500 }, CARD, { x: 0.9, y: 0.5 });
    expect(at).toEqual({ x: 50, y: 50 });
  });

  it('το σημείο καταλήγει στο ΚΕΝΤΡΟ του πλαισίου (όχι απλώς ορατό)', () => {
    const image = { width: 1000, height: 1500 };
    const point = { x: 0.5, y: 0.4 };
    const { y } = coverObjectPosition(image, CARD, point);
    // Πλάτος πλαισίου = 1 ⇒ ύψος εικόνας 1.5, ύψος πλαισίου 2/3.
    const scaled = 1.5;
    const box = 2 / 3;
    const offset = (y / 100) * (scaled - box);
    expect(point.y * scaled - offset).toBeCloseTo(box / 2, 10);
  });

  it('σφηνώνει στην κορυφή και στον πάτο — ποτέ εκτός εικόνας', () => {
    expect(coverObjectPosition({ width: 1000, height: 1500 }, CARD, { x: 0.5, y: 0 }).y).toBe(0);
    expect(coverObjectPosition({ width: 1000, height: 1500 }, CARD, { x: 0.5, y: 1 }).y).toBe(100);
  });

  it('πανοραμική σε κάρτα: υπερχειλίζει μόνο το πλάτος', () => {
    const at = coverObjectPosition({ width: 3000, height: 1000 }, CARD, { x: 0.75, y: 0.1 });
    expect(at.y).toBe(50);
    expect(at.x).toBeGreaterThan(50);
    expect(at.x).toBeLessThanOrEqual(100);
  });

  it('το κέντρο μένει κέντρο', () => {
    expect(coverObjectPosition({ width: 1000, height: 1500 }, CARD, CENTER_FOCAL_POINT)).toEqual({ x: 50, y: 50 });
  });

  it('ίδια αναλογία ή εκφυλισμένες διαστάσεις ⇒ 50/50', () => {
    expect(coverObjectPosition({ width: 300, height: 200 }, CARD, { x: 0, y: 0 })).toEqual({ x: 50, y: 50 });
    expect(coverObjectPosition({ width: 0, height: 200 }, CARD, { x: 0, y: 0 })).toEqual({ x: 50, y: 50 });
    expect(coverObjectPosition({ width: 300, height: 0 }, CARD, { x: 0, y: 0 })).toEqual({ x: 50, y: 50 });
  });
});
