/**
 * ============================================================================
 * DXF ASCII ENTITY DISPATCH — per-entity → native DXF emitter switchboard
 * ============================================================================
 *
 * The single `writeEntity` dispatcher for the client-side DXF writer
 * (`dxf-ascii-writer`), split out for file-size SRP (N.7.1) alongside the
 * HATCH / TEXT / MLINE / INSERT / DIMENSION-block writers.
 *
 * Maps one native-DXF `Entity` (after BIM→primitive decomposition) to its
 * low-level emitter(s), honouring both compatibility modes:
 *   • 'polyline' (AutoCAD): native ARC / POLYLINE / HATCH / DIMENSION / INSERT,
 *     with R2018 subclass context (`r2018`) folded in on the professional path.
 *   • 'lines' (Τέκτονας/FESPA, `explode`): geometry tessellated to LINE/TEXT.
 *
 * The writer injects `pair` (the handle-aware sink), `emitLine` (into `emitHatch`)
 * and the shared registries — zero re-implemented geometry.
 *
 * ADR-505 §A / ADR-636 Φ2.4.
 */

import type { Entity, HatchEntity, LeaderEntity, BlockEntity } from '../../types/entities';
import type { DimensionEntity } from '../../types/dimension';
import { DxfDocumentVersion } from '../../text-engine/types/text-toolbar.types';
import { rectangleEntityVertices } from '../../rendering/entities/shared/geometry-utils';
import { emitDimensionEntity } from '../../utils/dxf-dimension-writer';
import { emitHatch, type Pair } from './dxf-ascii-hatch-writer';
import {
  emitText, emitMText, alignFromTextEntity, textStyleName, readTextEntityFamily,
} from './dxf-ascii-text-writer';
import {
  emit3DFace,
  emitQuadFill,
  emitLine,
  emitCircle,
  emitPoint,
  emitArc,
  emitPath,
  emitLeader,
  emitEntityStyle,
  arcPoints,
  type EntityR2018,
  type EntityStyleCodes,
} from './dxf-ascii-primitive-emitters';
import { emitInsert } from './dxf-ascii-insert-writer';

// ADR-636 Φ2.4 (D.6) — single-header entities whose STYLE codes (6/48/370) are appended
// AFTER the emitter (valid: the pairs bind to the entity until the next `0`). POLYLINE /
// rectangle carry their STYLE in the emitPath header instead (before VERTEX/SEQEND);
// HATCH / DIMENSION own their style path (DIMSTYLE) — excluded.
const STYLE_APPEND_TYPES: ReadonlySet<Entity['type']> = new Set([
  'line', 'circle', 'arc', 'text', 'mtext', 'point',
]);

// ADR-636 Φ2.4 (D.3) — origin-primitive marker → native DXF entity name (round-trip of the
// `dxf-quad-fill-converter` import). Inverse of the `idPrefix` the import stamps.
const QUAD_ENTITY_NAME: Readonly<Record<'solid' | 'trace' | '3dface', 'SOLID' | 'TRACE' | '3DFACE'>> = {
  solid: 'SOLID', trace: 'TRACE', '3dface': '3DFACE',
};

/**
 * Emit ONE entity into `pair`. `professional` toggles the R2018 subclass/handle context; `owner`
 * is the top-level entity's owner (330 → *Model_Space). `nextDimBlock` hands out the sequential
 * `*Dn` index for anonymous dimension blocks (shared counter across the file / block members).
 */
export function writeEntity(
  e: Entity, layer: string, aci: number, s: number, mmScale: number, explode: boolean, pair: Pair,
  nextDimBlock: () => number, dimStyleNameById: Record<string, string>, version: DxfDocumentVersion,
  professional: boolean, owner?: string,
): void {
  // ADR-644 (#9e/#9f) — the R2018 entity context (subclass markers + common block before geometry,
  // plus the owner 330 → *Model_Space for top-level entities). Present only on the professional
  // AutoCAD path; the entity satisfies `EntityStyleCodes` structurally (all fields on BaseEntity).
  const r2018: EntityR2018 | undefined = professional ? { owner, style: e as EntityStyleCodes } : undefined;
  switch (e.type) {
    case 'line': {
      // ADR-505 (rebar 3D export) — προαιρετικό Z ανά άκρο (mm → output unit με mmScale,
      // ΟΧΙ coord scale· ίδια σύμβαση με το extrusion thickness). Absent → 2Δ (body αμετάβλητο).
      const za = (e as { dxfStartZMm?: number }).dxfStartZMm;
      const zb = (e as { dxfEndZMm?: number }).dxfEndZMm;
      emitLine(e.start, e.end, layer, aci, s, pair,
        za != null ? za * mmScale : undefined,
        zb != null ? zb * mmScale : undefined, r2018);
      break;
    }
    case 'circle':
      emitCircle(e.center, e.radius, layer, aci, s, pair, r2018);
      break;
    case 'arc':
      if (explode) emitPath(arcPoints(e.center, e.radius, e.startAngle, e.endAngle), false, layer, aci, s, true, pair);
      else emitArc(e.center, e.radius, e.startAngle, e.endAngle, layer, aci, s, pair, r2018);
      break;
    case 'text':
      // ADR-636 Φ2.3 — single-line TEXT with H/V justification (72/73/11/21) on the AutoCAD path.
      // Tekton (`explode`) keeps the bare, alignment-less, unrotated TEXT (byte-identical legacy).
      emitText(
        e.position, e.text ?? '', e.height ?? e.fontSize, layer, aci, s, pair,
        explode ? 0 : (e.rotation ?? 0), explode ? undefined : alignFromTextEntity(e),
        // ADR-636 Φ2.4 (D.5) — real group 7 (AutoCAD path); Tekton `explode` → emitText default STANDARD.
        explode ? undefined : textStyleName(readTextEntityFamily(e)), r2018,
      );
      break;
    case 'mtext':
      // ADR-636 Φ2.3 — real MTEXT (\P line breaks, 71 attachment) on the AutoCAD path; Tekton's
      // minimal parser reads only TEXT, so `explode` keeps the historic single-line TEXT fallback.
      if (explode) emitText(e.position, e.text ?? '', e.height ?? e.fontSize, layer, aci, s, pair);
      else emitMText(e, layer, aci, s, pair, version, r2018);
      break;
    case 'rectangle':
    case 'rect':
      // SSoT `rectangleEntityVertices`: χειρίζεται ΚΑΙ corner1/corner2 (drawn rects — x/y/w/h undefined)
      // ΚΑΙ x/y/w/h, ΚΑΙ το `rotation` (pivot=corner1). Πριν: raw rectVertices(e.x,...) → NaN για drawn +
      // αγνοούσε rotation.
      // ADR-636 Φ2.4 (D.6) — STYLE codes (6/48/370) travel in the POLYLINE header (AutoCAD mode
      // only; Tekton `explode` stays bare). Reverse of the import extractors.
      emitPath(rectangleEntityVertices(e), true, layer, aci, s, explode, pair, 0, explode ? undefined : e, r2018);
      break;
    case 'polyline':
    case 'lwpolyline': {
      // Pseudo-3D extrusion (AutoCAD polyline mode only — Tekton stays 2D).
      // Thickness is in mm → scale with mmScale, NOT the coordinate scale.
      const thicknessMm = (e as { dxfThicknessMm?: number }).dxfThicknessMm ?? 0;
      const thickness = explode ? 0 : thicknessMm * mmScale;
      // ADR-636 Φ2.4 (D.6) — STYLE codes in the POLYLINE header (AutoCAD mode only).
      emitPath(e.vertices, e.closed ?? false, layer, aci, s, explode, pair, thickness, explode ? undefined : e, r2018);
      break;
    }
    case 'hatch': {
      // ADR-636 Φ2.4 (D.3) — imported SOLID/TRACE/3DFACE round-trip to their NATIVE entity (not a
      // downgraded HATCH), preserving the source primitive identity (Revit/AutoCAD fidelity). The
      // `emitQuadFill` un-bowties the draw-order boundary back to the DXF corner slots (inverse of
      // `parseQuadVertices`). AutoCAD path only — Tekton `explode` keeps the exploded-LINE fallback
      // (its minimal parser doesn't read SOLID). Genuine HATCH (no `dxfSourceType`) is unaffected.
      const src = (e as HatchEntity).dxfSourceType;
      const quad = (e as HatchEntity).boundaryPaths?.[0];
      if (!explode && src && quad && (quad.length === 3 || quad.length === 4)) {
        emitQuadFill(QUAD_ENTITY_NAME[src], quad, layer, aci, s, pair, r2018);
        break;
      }
      // ADR-505 §C (SOLID fill / poché) — «βαμμένη επιφάνεια» = προ-υπολογισμένα 3D
      // faces (πλευρές + καπάκια, βλ. solid-fill-geometry) → ένα `3DFACE` ανά face.
      // x/y με coordinate scale· z (mm) με mmScale (ίδια σύμβαση με rebar/thickness).
      const faces = (e as {
        dxfFaces?: ReadonlyArray<ReadonlyArray<{ x: number; y: number; zMm: number }>>;
      }).dxfFaces;
      if (faces) {
        for (const f of faces) emit3DFace(f, layer, aci, s, mmScale, pair, r2018);
        break;
      }
      // ADR-507 Φ1a — χωρίς προ-υπολογισμένα 3D faces → πραγματική γραμμοσκίαση:
      // polyline mode → native `HATCH` entity (boundary loops + pattern meta)·
      // lines mode (Τέκτονας) → exploded LINEs (boundary + user-defined γραμμές).
      // (Το HATCH εκπέμπει ήδη το πλήρες `AcDbEntity`+`AcDbHatch` subclass — R2018-έτοιμο.)
      emitHatch(e as HatchEntity, layer, aci, s, explode, pair, emitLine);
      break;
    }
    case 'dimension': {
      // ADR-362 Round 24 — native DIMENSION entity (all 11 variants) via the group-code SSoT.
      // Emits its own AcDbEntity+AcDbDimension subclass chain (R2018-ready). Layer/colour by the
      // dimension header (code 8); ACI is left to the style.
      const dim = e as unknown as DimensionEntity;
      const styleName = dimStyleNameById[dim.styleId] ?? dim.styleId ?? 'Standard';
      emitDimensionEntity(pair, { entity: dim, styleName, layerName: layer }, nextDimBlock(), s);
      break;
    }
    case 'point':
      // ADR-636 Φ2.4 (D.1) — POINT round-trips the C.1 import. The glyph ($PDMODE/$PDSIZE) is a
      // drawing-wide HEADER sysvar (emitted once above), not a per-POINT field — the entity is
      // just its position (10/20/30) + layer + colour, mirroring emitCircle.
      emitPoint(e.position, layer, aci, s, pair, r2018);
      break;
    case 'leader': {
      // ADR-636 Φ2.4 (D.2) — native LEADER round-trips the ADR-635 Batch 2-B import. Ordered
      // 10/20 vertices (arrow tip = vertices[0]) + 71 arrowhead flag; the import re-reads them via
      // `convertLeader`. STYLE codes (6/48/370) are excluded — `convertLeader` reads only 62, so
      // 'leader' is deliberately NOT in STYLE_APPEND_TYPES (its r2018 block omits the style codes).
      const lead = e as unknown as LeaderEntity;
      emitLeader(lead.vertices, lead.arrowHead?.type !== 'none', layer, aci, s, pair,
        professional ? { style: undefined } : undefined);
      break;
    }
    case 'block': {
      // ADR-640 M2 — a first-class block instance → native INSERT reference (name + placement
      // transform). The named BLOCK definition (its local members) is emitted once in the BLOCKS
      // section above, deduplicated by `block.name` (many instances share one definition).
      emitInsert(pair, e as BlockEntity, layer, aci, s, r2018);
      break;
    }
    // spline/xline/ray + group/array (container flatten TBD) → skipped.
    default:
      break;
  }
  // ADR-636 Φ2.4 (D.6) — append the common STYLE codes (6/48/370) for single-header entities, in
  // BARE AutoCAD mode only. On the professional path the codes are folded INTO the AcDbEntity block
  // (before the geometry subclass, per R2018) by the emitter's `r2018` context, so skip here.
  if (!explode && !professional && STYLE_APPEND_TYPES.has(e.type)) emitEntityStyle(pair, e);
}
