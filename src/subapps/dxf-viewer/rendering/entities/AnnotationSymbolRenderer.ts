/**
 * ADR-583 — Annotation Symbol renderer (Βιβλιοθήκη Συμβόλων Σχεδίασης).
 *
 * Renders a lightweight, non-BIM drawing annotation (North arrow first) from the
 * unit-space glyph catalog (`config/annotation-symbol-catalog.ts`). Mirrors the
 * dimension arrowhead stamper (`dim-arrowhead-renderer.ts`): a uniform
 * translate → rotate → scale mapping stamps each catalog primitive — no
 * per-symbol special-case code.
 *
 * Sizing is **annotative** (D2): the paper `sizeMm` is folded through the shared
 * `annotationSymbolModelSize` SSoT (→ `paperHeightToModel`) at the live drawing
 * scale, so the glyph keeps a constant printed size at any 1:N and zooms with the
 * rest of the drawing — exactly like dimension text/arrows. The unit→screen
 * mapping is done per-point through `worldToScreen` (which owns the canvas
 * Y-flip), so `rotation` is a plain world-CCW angle and fills/circles stay
 * correct without juggling a mirrored canvas transform.
 *
 * Phase styling (normal / hover glow / selected) + grip hooks come from
 * `renderWithPhases`; the glyph reuses the phase-resolved stroke colour for its
 * solid fills so hover/selection tint the whole symbol uniformly.
 *
 * @see rendering/entities/dimension/dim-arrowhead-renderer.ts — the stamping template
 * @see bim/annotation-symbols/annotation-symbol-model-size.ts — annotative sizing SSoT
 * @see config/annotation-symbol-catalog.ts — the unit-space glyph catalog SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, Point2D, GripInfo, RenderOptions } from '../types/Types';
import type { Entity, AnnotationSymbolEntity } from '../../types/entities';
import { isAnnotationSymbolEntity, DEFAULT_ANNOTATION_SYMBOL_SIZE_MM } from '../../types/entities';
import {
  getAnnotationSymbol,
  type AnnotationSymbolPoint,
} from '../../config/annotation-symbol-catalog';
import { annotationSymbolModelSize } from '../../bim/annotation-symbols/annotation-symbol-model-size';
import { getAnnotationSymbolGrips } from '../../bim/annotation-symbols/annotation-symbol-grips';
import { gripGlyphShape } from '../../bim/grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import { toRenderGripInfo } from './shared/grip-utils';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import type { SceneUnits } from '../../utils/scene-units';
// ADR-642 Φ3 — the unit-space primitive stamper is now a shared SSoT (ONE painter for
// annotation symbols AND complex-linetype symbols). This renderer keeps only the
// annotative unit→world→screen mapping + phase styling; the per-primitive drawing lives
// in `stampSymbolPrimitive` (extracted verbatim; N.18 anti-clone, Boy-Scout).
import { stampSymbolPrimitive } from './shared/symbol-primitive-stamp';

const DEG_TO_RAD = Math.PI / 180;

export class AnnotationSymbolRenderer extends BaseEntityRenderer {
  /**
   * ADR-583 — active scene unit system, injected per-frame by the composite
   * (mirror `DimensionRenderer.setSceneUnits`). Drives the paper-mm → model-unit
   * fold so a north arrow keeps its printed size in cm/m scenes too. Defaults to
   * `'mm'` (canonical-mm geometry) for partial test setups.
   */
  private _sceneUnits: SceneUnits = 'mm';

  setSceneUnits(units: SceneUnits): void {
    this._sceneUnits = units;
  }

  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isAnnotationSymbolEntity(entity as Entity)) return;
    const e = entity as unknown as AnnotationSymbolEntity;
    this.renderWithPhases(entity, options, () => this.drawGlyph(e));
  }

  /** Stamp the catalog glyph at the entity's position/rotation/annotative size. */
  private drawGlyph(entity: AnnotationSymbolEntity): void {
    const def = getAnnotationSymbol(entity.symbolId);
    const drawingScale = useDrawingScaleStore.getState().drawingScale;
    const modelSize = annotationSymbolModelSize(
      entity.sizeMm ?? DEFAULT_ANNOTATION_SYMBOL_SIZE_MM,
      drawingScale,
      this._sceneUnits,
    );
    const rot = (entity.rotation ?? 0) * DEG_TO_RAD;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const { x: px, y: py } = entity.position;

    // Unit space (1.0 = nominal paper height, +Y = authored north) → world (rotate
    // + scale about the insertion point) → screen (worldToScreen owns the Y-flip).
    const toScreen = (p: AnnotationSymbolPoint): Point2D => {
      const [ux, uy] = p;
      const wx = px + modelSize * (ux * cos - uy * sin);
      const wy = py + modelSize * (ux * sin + uy * cos);
      return this.worldToScreen({ x: wx, y: wy });
    };

    // Solid fills reuse the phase-resolved stroke colour so hover/selection tints
    // the whole symbol uniformly (setupStyle already set strokeStyle for the phase).
    this.ctx.fillStyle = this.ctx.strokeStyle;

    // Unit → screen linear factor (circle/arc radius, text cap height): model size ×
    // the view's uniform world→screen scale.
    const radiusScale = modelSize * this.transform.scale;
    for (const prim of def.geometry) {
      stampSymbolPrimitive(this.ctx, prim, { toScreen, radiusScale, rot });
    }
  }

  /**
   * ADR-583 Φ2c — paint the move cross + rotation handle, via the SHARED
   * `getAnnotationSymbolGrips` SSoT (the SAME `computeDxfEntityGrips` case
   * 'annotation-symbol' consumes for interaction) → render ≡ interaction. The centre
   * → 4-arrow MOVE glyph, the handle → curved ROTATION glyph via `gripGlyphShape`
   * (mirror `ArcRenderer`). NO resize (D5).
   */
  getGrips(entity: EntityModel): GripInfo[] {
    if (!isAnnotationSymbolEntity(entity as Entity)) return [];
    const e = entity as unknown as AnnotationSymbolEntity;
    return getAnnotationSymbolGrips(e.id, e.position, e.sizeMm, e.rotation).map((g) =>
      toRenderGripInfo(g, gripGlyphShape(gripKindOf(g, 'annotation-symbol'))),
    );
  }

  /**
   * Precise pick: distance from the insertion point within the annotative glyph
   * radius (broad-phase already filtered by `entity-bounds`). Mirrors the
   * point-based renderers' centre-distance test.
   */
  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isAnnotationSymbolEntity(entity as Entity)) return false;
    const e = entity as unknown as AnnotationSymbolEntity;
    const drawingScale = useDrawingScaleStore.getState().drawingScale;
    const modelSize = annotationSymbolModelSize(
      e.sizeMm ?? DEFAULT_ANNOTATION_SYMBOL_SIZE_MM,
      drawingScale,
      this._sceneUnits,
    );
    const dx = point.x - e.position.x;
    const dy = point.y - e.position.y;
    // Half the nominal height is the glyph reach; tolerance is world-space here.
    return Math.hypot(dx, dy) <= modelSize / 2 + tolerance;
  }
}
