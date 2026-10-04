/**
 * @fileoverview **Οι διαστάσεις του θεατή** (ADR-899 §3.7).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Δ1: ο προσανατολισμός αγνοείται (κάθετη λήψη κινητού ⇒ «οριζόντια»), ή στρέφει και τα 2–4 (κατοπτρισμοί, όχι στροφές).
 * - Δ2: ο φρουρός δέχεται 0 / κλάσμα / NaN / string ⇒ επινοημένη διάσταση.
 * - Δ3: το custom metadata διαβάζεται χαλαρά (`'0640'`, `'1e3'`) ή δεν κάνει κύκλο γραφή→ανάγνωση.
 * - Δ4: ο κατάλογος raster τύπων διαφωνεί με την κλίμακα προεπισκοπήσεων.
 * - Δ5 (§9 θέμα 5β): η στραμμένη δεν ξαναχωρά · το 180° μετριέται ως τέταρτο · μικρή εικόνα φουσκώνει στη στροφή.
 */

import {
  fitScaleForRotation,
  IMAGE_DIMENSIONS_METADATA_KEYS,
  imageDimensionsFromMetadata,
  imageDimensionsOf,
  imageDimensionsToMetadata,
  isPortraitDimensions,
  isRasterImageContentType,
  orientedDimensions,
} from '../image-dimensions';
import { isPreviewableContentType } from '@/lib/files/file-preview-ladder';

describe('image-dimensions', () => {
  it('🔴 Δ1 μόνο οι προσανατολισμοί 5–8 ανταλλάσσουν πλάτος/ύψος', () => {
    for (const orientation of [undefined, null, 1, 2, 3, 4, 0, 9, '6']) {
      expect(orientedDimensions(4000, 3000, orientation)).toEqual({ width: 4000, height: 3000 });
    }
    for (const orientation of [5, 6, 7, 8]) {
      expect(orientedDimensions(4000, 3000, orientation)).toEqual({ width: 3000, height: 4000 });
    }
    expect(isPortraitDimensions(orientedDimensions(4000, 3000, 6)!)).toBe(true);
    expect(isPortraitDimensions({ width: 800, height: 800 })).toBe(false);
  });

  it('🔴 Δ2 καμία επινοημένη διάσταση', () => {
    for (const [w, h] of [[0, 10], [10, 0], [-1, 10], [1.5, 10], [Number.NaN, 10], ['10', 10], [10, undefined], [70_000, 10]]) {
      expect(orientedDimensions(w, h)).toBeNull();
    }
    expect(imageDimensionsOf({ width: 1200, height: 1600 })).toEqual({ width: 1200, height: 1600 });
    for (const value of [null, undefined, 'x', 42, {}, { width: 1200 }, { width: '1200', height: '1600' }]) {
      expect(imageDimensionsOf(value)).toBeNull();
    }
  });

  it('🔴 Δ3 custom metadata: κύκλος γραφή→ανάγνωση · αυστηρή κανονική μορφή', () => {
    const written = imageDimensionsToMetadata({ width: 1013, height: 1800 });
    expect(written).toEqual({ [IMAGE_DIMENSIONS_METADATA_KEYS.width]: '1013', [IMAGE_DIMENSIONS_METADATA_KEYS.height]: '1800' });
    expect(imageDimensionsFromMetadata({ ...written, firebaseStorageDownloadTokens: 't' })).toEqual({ width: 1013, height: 1800 });
    for (const raw of ['0640', '1e3', '640.0', ' 640', '', '0']) {
      expect(imageDimensionsFromMetadata({ imageWidth: raw, imageHeight: '480' })).toBeNull();
    }
    expect(imageDimensionsFromMetadata(undefined)).toBeNull();
    expect(imageDimensionsFromMetadata({ imageWidth: 640, imageHeight: 480 })).toBeNull();
  });

  it('🔴 Δ4 ό,τι μετριέται προεπισκοπείται (ένας κατάλογος)', () => {
    for (const type of ['image/jpeg', 'image/png', 'Image/WEBP; q=1', 'image/avif', 'image/tiff', 'image/svg+xml', 'image/gif', 'image/heic', 'application/pdf', null]) {
      expect(isRasterImageContentType(type)).toBe(isPreviewableContentType(type));
    }
    expect(isRasterImageContentType('image/svg+xml')).toBe(false);
  });

  it('🔴 Δ5 στροφή 90° ⇒ η εικόνα ξαναχωρά (μετρημένα Σ1–Σ3 του ADR-899 §9 θέμα 5α)', () => {
    const modal = { width: 1872, height: 704 };
    // Σ1: οριζόντια 939×704 → 704×939 έκοβε 25% ⇒ ×0,75 = 528×704.
    expect(fitScaleForRotation(modal, { width: 4000, height: 3000 }, 90)).toBeCloseTo(0.75);
    // Σ2: πάνελ 907×349, 465×349 → 349×465 έκοβε 18%.
    expect(fitScaleForRotation({ width: 907, height: 349 }, { width: 4000, height: 3000 }, 270)).toBeCloseTo(0.75);
    // Σ3: κάθετη 528×704 → 704×528 άφηνε 33% άδειο ⇒ ×1,333 = 939×704.
    expect(fitScaleForRotation(modal, { width: 3000, height: 4000 }, 90)).toBeCloseTo(4 / 3);
    expect(fitScaleForRotation(modal, { width: 3000, height: 4000 }, -90)).toBeCloseTo(4 / 3);
  });

  it('🔴 Δ5 άρτιο τέταρτο = 1 · μικρή εικόνα δεν φουσκώνει · άκυρο κουτί = 1', () => {
    const modal = { width: 1872, height: 704 };
    for (const angle of [0, 180, 360, -180]) expect(fitScaleForRotation(modal, { width: 4000, height: 3000 }, angle)).toBe(1);
    // 300×400 χωρά ολόκληρη και όρθια και πλαγιαστή: τα pixel της είναι το φράγμα.
    expect(fitScaleForRotation(modal, { width: 300, height: 400 }, 90)).toBe(1);
    // 600×800 σε ύψος 704: όρθια 528×704 (φραγμένη από το κουτί), πλαγιαστή 800×600 χωρά ⇒ ως τα pixel της, όχι ως το κουτί.
    expect(fitScaleForRotation(modal, { width: 600, height: 800 }, 90)).toBeCloseTo(800 / 704);
    expect(fitScaleForRotation({ width: 0, height: 0 }, { width: 4000, height: 3000 }, 90)).toBe(1);
  });
});
