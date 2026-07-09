/**
 * ADR-583 — Annotation Symbol entity (Βιβλιοθήκη Συμβόλων Σχεδίασης).
 *
 * A lightweight, **non-BIM** drawing annotation (paper decoration) — a North
 * arrow, graphic scale bar, or section/elevation mark — placed on the 2D canvas.
 * Modelled on `CenterMarkEntity` (ADR-362): plain `extends BaseEntity`, no IFC
 * export, no 3D mesh, no isolate-by-BimCategory, no dedicated Firestore
 * collection. It rides the generic scene `Entity[]` array + `.scene.json`
 * snapshot exactly like center-mark / dimension / text. → deliberately NOT added
 * to `isBimEntityType`.
 *
 * Sizing is **annotative** (D2): `sizeMm` is a *paper*-space height that the
 * renderer folds through `utils/annotation-scale.ts` → `paperHeightToModel`, so
 * the symbol keeps a constant printed size at any drawing scale (1:N), matching
 * AutoCAD annotative blocks. The concrete glyph geometry lives in the catalog
 * SSoT (`config/annotation-symbol-catalog.ts`), referenced by `symbolId`.
 *
 * @see types/center-mark.ts — the lightweight-annotation template
 * @see config/annotation-symbol-catalog.ts — the glyph catalog SSoT
 * @see utils/annotation-scale.ts — `paperHeightToModel` annotative sizing SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import type { Point2D } from '../rendering/types/Types';
import type { BaseEntity } from './entities';

/**
 * Family of annotation symbol. Extensible. Point-glyph kinds (placed with a single
 * click) are wired via `config/annotation-kind-registry.ts`.
 *
 * NOTE (ADR-583 Φ2.5, 2026-07-09): `'scale-bar'` was RESERVED here in Φ0/Φ1 as a
 * future *linear* kind of this family, but Giorgio's Φ2 decision built it as a
 * fully separate, dedicated scene-entity type instead — `type: 'scale-bar'`
 * (sibling of `dimension` / `center-mark`), NOT `type: 'annotation-symbol'` with
 * `kind: 'scale-bar'`. Reason: a scale bar has a dynamic real-world `length` +
 * a length-resize grip (see `types/scale-bar.ts`), which does not fit this
 * family's fixed-ratio move+rotation-only glyph model (D5 below). The literal
 * was NEVER wired into `config/annotation-symbol-catalog.ts` or
 * `config/annotation-kind-registry.ts` (confirmed dead), so it is deliberately
 * removed here — do NOT re-add `'scale-bar'` to this union; a real scale bar
 * already exists at `types/scale-bar.ts` / `ScaleBarEntity`.
 */
export type AnnotationSymbolKind =
  | 'north-arrow'
  | 'section-mark'
  | 'grid-bubble'
  | 'elevation-mark'
  | 'detail-callout'
  | 'revision-tag';

export interface AnnotationSymbolEntity extends BaseEntity {
  type: 'annotation-symbol';

  /** Insertion / anchor point (world coordinates). */
  position: Point2D;
  /** Symbol family (drives catalog filtering + default behaviour). */
  kind: AnnotationSymbolKind;
  /**
   * Catalog definition id (`config/annotation-symbol-catalog.ts`), e.g.
   * `'northArrowSimple'`. A stable code-shipped string — NOT an enterprise id.
   */
  symbolId: string;
  /**
   * Nominal glyph height in **paper millimetres** (annotative). Folded through
   * `paperHeightToModel(sizeMm, drawingScale, units)` at render time.
   */
  sizeMm: number;
  /**
   * Rotation in degrees (0 = glyph's authored orientation; for a north arrow the
   * authored orientation points to +Y / up). Manual in v1 — no auto True-North.
   */
  rotation?: number;
}

/** Default paper height (mm) for a freshly placed annotation symbol. */
export const DEFAULT_ANNOTATION_SYMBOL_SIZE_MM = 15;

// ──────────────────────────────────────────────────────────────────────────────
// Type guard
// ──────────────────────────────────────────────────────────────────────────────

export const isAnnotationSymbolEntity = (
  e: { type: string },
): e is AnnotationSymbolEntity => e.type === 'annotation-symbol';
