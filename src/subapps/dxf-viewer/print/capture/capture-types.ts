/**
 * ADR-453 — Print/Export engine · capture adapter contract (SSoT).
 *
 * Both the 2D and 3D capture adapters return the SAME `CaptureResult`, which
 * the shared PDF assembler consumes. This common shape is what guarantees the
 * single output path (the SSoT convergence point).
 *
 * @module subapps/dxf-viewer/print/capture/capture-types
 */

export interface CaptureResult {
  /** PNG data URL of the rendered snapshot. */
  dataUrl: string;
  /** Physical width of the captured image in pixels. */
  widthPx: number;
  /** Physical height of the captured image in pixels. */
  heightPx: number;
  /**
   * The applied real-world denominator (e.g. 100 → 1:100) when the capture was
   * rendered in `drawing-scale` mode, else `null` (fit-to-page / 3D).
   */
  appliedScaleDenominator: number | null;
}
