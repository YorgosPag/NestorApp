/**
 * ADR-453 — Print/Export engine · capture adapter contract (SSoT).
 *
 * Both the 2D and 3D capture adapters return the SAME `CaptureResult`, which
 * the shared PDF assembler consumes. This common shape is what guarantees the
 * single output path (the SSoT convergence point).
 *
 * ADR-608 — the result is a discriminated union on `kind`:
 *   - `raster` — a rendered PNG snapshot (offscreen canvas / WebGL). The legacy
 *     path; still the only option for 3D and the raster fallback for 2D.
 *   - `vector` — a `draw(pdf, area)` closure that emits native jsPDF primitives
 *     (lines/text/fills) directly into the printable area, so AutoCAD PDF Import
 *     yields real entities instead of one flattened image.
 *
 * @module subapps/dxf-viewer/print/capture/capture-types
 */

import type { jsPDF } from 'jspdf';
import type { PrintableAreaMm } from '../config/paper-types';
import type { PrintFidelityNote } from '../print-fidelity';

/** Fields shared by every capture flavour. */
interface CaptureBase {
  /**
   * The applied real-world denominator (e.g. 100 → 1:100) when the capture was
   * rendered in `drawing-scale` mode, else `null` (fit-to-page / 3D).
   */
  appliedScaleDenominator: number | null;
  /**
   * ADR-667 Φ1 — ό,τι **έχασε** αυτό το capture έναντι της οθόνης (π.χ. γέμισμα εικόνας που
   * υποβαθμίστηκε σε συμπαγές χρώμα). Ο `runPrint` τα εκπέμπει → ο χρήστης τα βλέπει.
   *
   * ⚠️ Πρέπει να είναι **resolved τη στιγμή που επιστρέφει το capture**: το `runPrint` το
   * διαβάζει ΑΦΟΥ γυρίσει το `captureSource` και ΠΡΙΝ τρέξει το `draw` closure. Ό,τι
   * υπολογίζεται μέσα στο `draw` δεν μπορεί ποτέ να αναφερθεί. Απόν/κενό ⇒ πιστό.
   */
  fidelity?: readonly PrintFidelityNote[];
}

/** Rendered PNG snapshot (offscreen 2D canvas or 3D WebGL). */
export interface RasterCaptureResult extends CaptureBase {
  kind: 'raster';
  /** PNG data URL of the rendered snapshot. */
  dataUrl: string;
  /** Physical width of the captured image in pixels. */
  widthPx: number;
  /** Physical height of the captured image in pixels. */
  heightPx: number;
}

/**
 * Vector capture (ADR-608) — a pure closure the assembler invokes with the final
 * printable area (mm). It emits native jsPDF primitives; no image is rasterised.
 */
export interface VectorCaptureResult extends CaptureBase {
  kind: 'vector';
  /** Emit the drawing into `pdf`, mapped into the placed printable rectangle. */
  draw: (pdf: jsPDF, area: PrintableAreaMm) => void;
}

export type CaptureResult = RasterCaptureResult | VectorCaptureResult;
