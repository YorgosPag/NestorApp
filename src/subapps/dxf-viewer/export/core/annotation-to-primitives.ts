/**
 * ADR-583 / ADR-608 — Annotation-symbol & scale-bar → neutral primitives (SSoT).
 *
 * `annotation-symbol` and `scale-bar` are **non-BIM** scene entities, so
 * `flattenSceneEntitiesForDxf` passes them through untouched — but the vector
 * emitter (and the DXF writer) have no `case` for them, so they were silently
 * dropped from the vector PDF *and* the `.dxf`. Big players (Revit / AutoCAD /
 * ArchiCAD) EXPLODE annotation symbols into vector geometry on export; this module
 * does exactly that, decomposing each symbol/bar into the SAME neutral `Entity[]`
 * the emitter already draws (line / lwpolyline / circle / arc / text / solid-fill
 * hatch). One decompose, two backends — the mirror of `bim-to-dxf-primitives`.
 *
 * Geometry is read from the EXISTING SSoT — the catalog glyph geometry
 * (`ANNOTATION_SYMBOL_CATALOG`, unit space) folded to model size via
 * `annotationSymbolModelSize`, and the scale-bar frame layout via
 * `buildScaleBarPrimitives` (the SAME primitives `ScaleBarRenderer` stamps). No
 * geometry is re-derived here (N.18 anti-clone).
 *
 * The unit→world / frame→world maps mirror the on-screen renderers exactly:
 *   symbol: `w = position + modelSize·R(rotation)·u`   (`AnnotationSymbolRenderer`)
 *   bar:    `w = position + s·axis + t·perp`           (`ScaleBarRenderer`)
 *
 * @see config/annotation-symbol-catalog.ts — the unit-space glyph catalog SSoT
 * @see bim/annotation-symbols/annotation-symbol-model-size.ts — annotative sizing
 * @see bim/scale-bar/scale-bar-primitives.ts — the scale-bar frame layout SSoT
 * @see export/core/neutral-primitive-factory.ts — the neutral entity builders
 * @see docs/centralized-systems/reference/adrs/ADR-608-vector-pdf-export.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type {
  AnnotationSymbolEntity,
} from '../../types/annotation-symbol';
import { isAnnotationSymbolEntity } from '../../types/annotation-symbol';
import { isScaleBarEntity, type ScaleBarEntity } from '../../types/scale-bar';
import { DEFAULT_ANNOTATION_SYMBOL_SIZE_MM } from '../../types/annotation-symbol';
import {
  getAnnotationSymbol,
  type AnnotationSymbolPrimitive,
  type AnnotationSymbolPoint,
} from '../../config/annotation-symbol-catalog';
import { annotationSymbolModelSize } from '../../bim/annotation-symbols/annotation-symbol-model-size';
import {
  buildScaleBarPrimitives,
  type ScaleBarFramePrimitive,
  type ScaleBarFramePoint,
} from '../../bim/scale-bar/scale-bar-primitives';
import {
  makeLine,
  makePolyline,
  makeCircle,
  makeArc,
  makeSolidFill,
  makeText,
  circlePolygon,
} from './neutral-primitive-factory';
import { svgGlyphToEntities } from './svg-glyph-to-entities';

const DEG_TO_RAD = Math.PI / 180;

/** Drawing-scale + scene-units context the annotative decomposition needs. */
export interface AnnotationDecomposeContext {
  readonly drawingScale: number;
  readonly sceneUnits: SceneUnits;
}

export type { VectorTextBaselineHint } from './neutral-primitive-factory';

/**
 * Replace every `annotation-symbol` / `scale-bar` in the list with its neutral
 * primitive expansion; pass all other entities through untouched. Runs AFTER
 * `flattenSceneEntitiesForDxf` in the vector-PDF / DXF pipelines.
 */
export function expandAnnotationsToPrimitives(
  entities: readonly Entity[],
  ctx: AnnotationDecomposeContext,
): Entity[] {
  const out: Entity[] = [];
  for (const entity of entities) {
    const decomposed = decomposeAnnotationEntity(entity, ctx);
    if (decomposed) out.push(...decomposed);
    else out.push(entity);
  }
  return out;
}

/**
 * Decompose a single annotation entity into neutral primitives, or return `null`
 * when `entity` is not an annotation (caller keeps the original).
 */
export function decomposeAnnotationEntity(
  entity: Entity,
  ctx: AnnotationDecomposeContext,
): Entity[] | null {
  if (isAnnotationSymbolEntity(entity)) return decomposeAnnotationSymbol(entity, ctx);
  if (isScaleBarEntity(entity)) return decomposeScaleBar(entity, ctx);
  return null;
}

// ─── Annotation symbol (catalog glyph, unit space → world) ─────────────────────

function decomposeAnnotationSymbol(
  entity: AnnotationSymbolEntity,
  ctx: AnnotationDecomposeContext,
): Entity[] {
  const def = getAnnotationSymbol(entity.symbolId);
  const modelSize = annotationSymbolModelSize(
    entity.sizeMm ?? DEFAULT_ANNOTATION_SYMBOL_SIZE_MM, ctx.drawingScale, ctx.sceneUnits,
  );
  const rotationDeg = entity.rotation ?? 0;
  const rot = rotationDeg * DEG_TO_RAD;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const { x: px, y: py } = entity.position;

  // Unit space (1.0 = paper height, +Y = authored north) → world (rotate + scale
  // about the insertion point). Mirror `AnnotationSymbolRenderer.drawGlyph`.
  const toWorld = (p: AnnotationSymbolPoint): Point2D => {
    const [ux, uy] = p;
    return {
      x: px + modelSize * (ux * cos - uy * sin),
      y: py + modelSize * (ux * sin + uy * cos),
    };
  };

  const idFor = idSequence(entity.id);
  const out: Entity[] = [];
  for (const prim of def.geometry) {
    out.push(...mapSymbolPrimitive(prim, entity, toWorld, modelSize, rotationDeg, idFor));
  }
  return out;
}

function mapSymbolPrimitive(
  prim: AnnotationSymbolPrimitive,
  source: Entity,
  toWorld: (p: AnnotationSymbolPoint) => Point2D,
  modelSize: number,
  rotationDeg: number,
  idFor: () => string,
): Entity[] {
  switch (prim.kind) {
    case 'line':
      return [makeLine(source, idFor(), toWorld(prim.from), toWorld(prim.to))];
    case 'polyline': {
      const verts = prim.points.map(toWorld);
      // Solid closed → fill (hatch) + a closed outline. The outline is same-colour
      // (invisible in PDF/DXF where the fill already covers it) but is essential for
      // backends without solid-fill support (Tekton `.tek` renders it as lines) —
      // uniform with the scale-bar filled cells (fill + outline).
      if (prim.closed && prim.solid) {
        return [makeSolidFill(source, idFor(), verts), makePolyline(source, idFor(), verts, true)];
      }
      return [makePolyline(source, idFor(), verts, prim.closed)];
    }
    case 'circle': {
      const center = toWorld(prim.center);
      const radius = prim.radius * modelSize;
      if (prim.solid) return [makeSolidFill(source, idFor(), circlePolygon(center, radius))];
      return [makeCircle(source, idFor(), center, radius)];
    }
    case 'arc':
      // World-CCW degrees rotate with the glyph (mirror `stampPrimitive` arc case).
      return [makeArc(
        source, idFor(), toWorld(prim.center), prim.radius * modelSize,
        prim.startAngle + rotationDeg, prim.endAngle + rotationDeg,
      )];
    case 'text':
      return [makeText(source, idFor(), {
        position: toWorld(prim.at),
        text: prim.value,
        height: prim.heightFrac * modelSize,
        alignment: mapAlign(prim.align),
        // Upright by default (readable) → 0°; otherwise the label spins with the glyph.
        rotationDeg: (prim.uprightOnRotate ?? true) ? 0 : rotationDeg,
        vBaseline: mapBaseline(prim.baseline),
      })];
    case 'svg':
      // ADR-608 — Bézier-based glyph → explode σε flat γεωμετρία (Revit/ArchiCAD πρακτική).
      return svgGlyphToEntities(prim, source, toWorld, modelSize, idFor);
    default: {
      const _exhaustive: never = prim;
      void _exhaustive;
      return [];
    }
  }
}

// ─── Scale bar (frame layout SSoT → world) ─────────────────────────────────────

function decomposeScaleBar(
  entity: ScaleBarEntity,
  ctx: AnnotationDecomposeContext,
): Entity[] {
  const primitives = buildScaleBarPrimitives(entity, ctx.drawingScale, ctx.sceneUnits);
  const cos = Math.cos(entity.angleRad);
  const sin = Math.sin(entity.angleRad);
  const { x: px, y: py } = entity.position;

  // Frame (s along axis, t perpendicular) → world. Mirror `ScaleBarRenderer.drawBar`.
  const frameToWorld = (fp: ScaleBarFramePoint): Point2D => ({
    x: px + fp.s * cos - fp.t * sin,
    y: py + fp.s * sin + fp.t * cos,
  });

  const idFor = idSequence(entity.id);
  const out: Entity[] = [];
  for (const prim of primitives) {
    out.push(...mapFramePrimitive(prim, entity, frameToWorld, idFor));
  }
  return out;
}

function mapFramePrimitive(
  prim: ScaleBarFramePrimitive,
  source: Entity,
  frameToWorld: (fp: ScaleBarFramePoint) => Point2D,
  idFor: () => string,
): Entity[] {
  switch (prim.kind) {
    case 'segment':
      return [makeLine(source, idFor(), frameToWorld(prim.a), frameToWorld(prim.b))];
    case 'cell': {
      const corners = prim.corners.map(frameToWorld);
      // Filled cell = fill (hatch) + outline (renderer strokes every cell); hollow = outline only.
      if (prim.filled) {
        return [makeSolidFill(source, idFor(), corners), makePolyline(source, idFor(), corners, true)];
      }
      return [makePolyline(source, idFor(), corners, true)];
    }
    case 'label':
      return [makeText(source, idFor(), {
        position: frameToWorld(prim.at),
        text: prim.text,
        height: prim.heightMm,
        alignment: prim.align,
        rotationDeg: 0, // numerals are screen-upright (mirror the renderer)
        vBaseline: 'middle',
      })];
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Monotonic id generator so every decomposed primitive gets a stable unique id. */
function idSequence(sourceId: string): () => string {
  let n = 0;
  return () => `${sourceId}__ann_${n++}`;
}

/** Canvas text-align → neutral horizontal alignment (renderer default = center). */
function mapAlign(align: CanvasTextAlign | undefined): 'left' | 'center' | 'right' {
  switch (align) {
    case 'left':
    case 'start':
      return 'left';
    case 'right':
    case 'end':
      return 'right';
    default:
      return 'center';
  }
}

/** Canvas text-baseline → emitter vertical baseline (renderer default = middle). */
function mapBaseline(
  baseline: CanvasTextBaseline | undefined,
): 'alphabetic' | 'top' | 'middle' | 'bottom' {
  switch (baseline) {
    case 'top':
    case 'hanging':
      return 'top';
    case 'bottom':
    case 'ideographic':
      return 'bottom';
    case 'alphabetic':
      return 'alphabetic';
    default:
      return 'middle';
  }
}
