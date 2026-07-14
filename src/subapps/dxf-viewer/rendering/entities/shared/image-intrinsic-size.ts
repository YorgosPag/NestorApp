/**
 * SSoT — intrinsic pixel μέγεθος decoded εικόνας (HTMLImageElement / ImageBitmap / canvas).
 *
 * ΕΝΑ instanceof-ladder, κοινό για: image fill tiling (`hatch-image-paint`), duotone tint
 * (`hatch-image-tint`) ΚΑΙ standalone ImageEntity validity-guard (`ImageRenderer`, fill render).
 * Μηδέν sibling clone (N.18) — μία απάντηση στο «πόσα pixel έχει αυτή η εικόνα;».
 */
export function imageIntrinsicSize(img: CanvasImageSource): { w: number; h: number } {
  if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
    return { w: img.naturalWidth, h: img.naturalHeight };
  }
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
    return { w: img.width, h: img.height };
  }
  const sized = img as { width?: number; height?: number };
  return { w: sized.width ?? 0, h: sized.height ?? 0 };
}
