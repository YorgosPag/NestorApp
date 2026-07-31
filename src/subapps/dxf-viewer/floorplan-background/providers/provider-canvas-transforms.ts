/**
 * Οι δύο μετασχηματισμοί καμβά που εφαρμόζει **κάθε** πάροχος υποβάθρου πριν ζωγραφίσει.
 *
 * 🔴 **Γιατί υπάρχει (CHECK 3.28, 2026-07-31).** Ήταν γραμμένοι δύο φορές — ταυτόσημοι
 * `_applyScreenTransform` και `_applyCadTransform` στον `ImageProvider` και στον
 * `PdfPageProvider` (243 tokens). Δεν είναι καλλωπισμός: ο μετασχηματισμός CAD ορίζει **πού
 * κάθεται η αρχή του κόσμου** για το υπόβαθρο. Δύο αντίγραφα σημαίνουν ότι μια διόρθωση
 * άγκυρας θα γινόταν στο ένα και θα ξεχνιόταν στο άλλο — και η απόκλιση θα φαινόταν ως
 * «η εικόνα δεν κουμπώνει με το σχέδιο» **μόνο σε έναν από τους δύο τύπους αρχείου**.
 *
 * @module subapps/dxf-viewer/floorplan-background/providers/provider-canvas-transforms
 * @see ADR-741 — «πού είναι η περιοχή σχεδίασης» (η άγκυρα του CAD μετασχηματισμού)
 * @see ADR-732 — floorplan painter
 */

import type { ProviderRenderParams } from './types';

/** Μοίρες → ακτίνια: ο χρήστης δίνει μοίρες, ο καμβάς θέλει ακτίνια. */
const DEG_TO_RAD = Math.PI / 180;

/**
 * Ο μετασχηματισμός **χρήστη** — κοινός στους δύο τρόπους: θέση/περιστροφή/κλίμακα του
 * υποβάθρου, πάνω από τον world→canvas μετασχηματισμό της σκηνής.
 */
function applyUserTransform(
  ctx: CanvasRenderingContext2D,
  params: ProviderRenderParams,
): void {
  const { transform, worldToCanvas } = params;
  ctx.translate(worldToCanvas.offsetX, worldToCanvas.offsetY);
  ctx.scale(worldToCanvas.scale, worldToCanvas.scale);
  ctx.translate(transform.translateX, transform.translateY);
  ctx.rotate(transform.rotation * DEG_TO_RAD);
  ctx.scale(transform.scaleX, transform.scaleY);
}

/** Οθονικός τρόπος: Y προς τα κάτω, καμία άγκυρα — ο καμβάς όπως είναι. */
export function applyScreenTransform(
  ctx: CanvasRenderingContext2D,
  params: ProviderRenderParams,
): void {
  applyUserTransform(ctx, params);
}

/**
 * Τρόπος CAD: Y προς τα **πάνω**, με αρχή στην **κάτω-αριστερή γωνία της περιοχής
 * σχεδίασης**.
 *
 * ⚠️ Η άγκυρα είναι `(leftRulerWidth, viewport.height − bottomRulerHeight)` — **ΟΧΙ**
 * «margins.top». Το δεύτερο μέγεθος ήταν πάντα το ύψος του **κάτω** χάρακα με λάθος όνομα·
 * το υποσύστημα το είχε αντιγράψει από τον πυρήνα του DXF μαζί με το λάθος (ADR-741 §2).
 *
 * Το τελικό `scale(1, −1)` επαναφέρει την εικόνα όρθια μέσα στον Y-flipped κόσμο.
 */
export function applyCadTransform(
  ctx: CanvasRenderingContext2D,
  params: ProviderRenderParams,
): void {
  const { viewport, cad } = params;
  if (!cad) return;

  ctx.translate(cad.chrome.leftRulerWidth, viewport.height - cad.chrome.bottomRulerHeight);
  ctx.scale(1, -1); // Y-flip → world Y-up
  applyUserTransform(ctx, params);
  ctx.scale(1, -1); // restore upright image after Y-flipped world
}
