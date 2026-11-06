/**
 * @fileoverview **`PlanRaster` → PNG** (ADR-929 Φ5.3β): η μία κωδικοποίηση της εικόνας που στέλνεται για ανάγνωση.
 * @module lib/geometry/raster/plan-raster-png
 *
 * 🔑 **`OffscreenCanvas`**: δουλεύει **και** μέσα σε Web Worker **και** στον κύριο νήμα, άρα το δίχτυ του RPC τρέχει τον
 *   ίδιο κώδικα. PNG = χωρίς απώλειες: τα γράμματα μιας ετικέτας («0.80 / 2.20») δεν θολώνουν, και ό,τι ασπρίστηκε μένει
 *   καθαρό λευκό.
 * ⚠️ **ΔΕΝ είναι το `floorplan-background/providers/image-compression.ts`**: εκείνο απαντά «χωράει το αρχείο που ανεβαίνει;»
 *   (ImageBitmap → JPEG με απώλειες). Άλλη ερώτηση, άλλη πηγή, άλλη μορφή.
 */

import type { PlanRaster } from './plan-raster';

export const PLAN_RASTER_PNG_MIME = 'image/png';

/** @throws όταν το περιβάλλον δεν έχει `OffscreenCanvas` ή 2D context (ρητή αποτυχία, ποτέ κενό Blob). */
export async function encodePlanRasterPng(raster: PlanRaster): Promise<Blob> {
  if (typeof OffscreenCanvas === 'undefined') throw new Error('encodePlanRasterPng: OffscreenCanvas unavailable');
  const canvas = new OffscreenCanvas(raster.width, raster.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('encodePlanRasterPng: 2D context unavailable');
  const rgba = raster.rgba instanceof Uint8ClampedArray
    ? raster.rgba
    : new Uint8ClampedArray(raster.rgba.buffer, raster.rgba.byteOffset, raster.rgba.byteLength);
  ctx.putImageData(new ImageData(rgba, raster.width, raster.height), 0, 0);
  return canvas.convertToBlob({ type: PLAN_RASTER_PNG_MIME });
}
