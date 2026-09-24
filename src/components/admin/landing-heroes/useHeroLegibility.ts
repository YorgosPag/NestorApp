'use client';

/**
 * @fileoverview **Μέτρηση αναγνωσιμότητας στον browser** — ο καμβάς ζωγραφίζει το κάδρο όπως θα το κόψει
 *   ο ήρωας, ο καθαρός κριτής αποφασίζει (ADR-881 §4.5).
 * @related lib/landing/hero-legibility · hero-frames
 * @module components/admin/landing-heroes/useHeroLegibility
 *
 * 🔑 **Μικρός καμβάς επίτηδες** (≤ 240 px πλάτος): η κρίση αφορά περιοχές κάτω από λέξεις, όχι pixel —
 *    η σμίκρυνση κρατά τη φωτεινότητα και κάνει τη μέτρηση στιγμιαία για 8 κάδρα.
 * ⚠️ **Εικόνα ιστορικού από το δημόσιο ράφι**: αν ο κάδος δεν στέλνει CORS, ο καμβάς «μολύνεται» και το
 *    `getImageData` πετά ⇒ `null` = «δεν μετρήθηκε», **ποτέ** ψεύτικο «περνά». Τα πρόχειρα (τοπικά
 *    αρχεία, object URL) μετριούνται πάντα.
 */

import { useEffect, useState } from 'react';

import {
  coverSourceRect,
  judgeHeroLegibility,
  type HeroLegibility,
  type HeroScrimTheme,
} from '@/lib/landing/hero-legibility';
import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';

import type { HeroFrame } from './hero-frames';

const SAMPLE_WIDTH = 240;

/** Φορτώνει την εικόνα **μία** φορά ανά URL — `null` μέχρι να είναι έτοιμη ή αν αποτύχει. */
export function useLoadedImage(src: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    setImage(null);
    if (src === null) return undefined;
    let alive = true;
    const element = new Image();
    element.crossOrigin = 'anonymous';
    element.onload = () => alive && setImage(element);
    element.src = src;
    return () => {
      alive = false;
    };
  }, [src]);

  return image;
}

/** **Ένα κάδρο, ένα θέμα** → κρίση, ή `null` αν ο καμβάς δεν επιτρέπει ανάγνωση. */
export function measureHeroLegibility(
  image: HTMLImageElement,
  frame: HeroFrame,
  focalPoint: PhotoFocalPoint,
  theme: HeroScrimTheme,
): HeroLegibility | null {
  const width = SAMPLE_WIDTH;
  const height = Math.max(1, Math.round((SAMPLE_WIDTH * frame.height) / frame.width));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) return null;

  const rect = coverSourceRect(
    { width: image.naturalWidth, height: image.naturalHeight },
    { width: frame.width, height: frame.height },
    focalPoint,
  );
  context.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, width, height);
  try {
    return judgeHeroLegibility(context.getImageData(0, 0, width, height).data, width, height, theme, frame.textZone);
  } catch {
    return null;
  }
}
