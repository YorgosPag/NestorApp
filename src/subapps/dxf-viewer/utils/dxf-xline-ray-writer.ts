/**
 * DXF XLINE + RAY Entity Writer — ADR-359 Phase 9.
 *
 * Emits a DXF `ENTITIES` section containing XLINE and RAY entities as
 * alternating code/value string[]. Output can be fed back to
 * `convertXLine` / `convertRay` for roundtrip integrity tests.
 *
 * NOT a production DXF exporter — production export flows through the
 * ezdxf Python microservice (`types/dxf-export.types.ts`). Purpose:
 * guarantee the in-app data model survives a tokenised DXF ENTITIES
 * roundtrip at the XLINE/RAY level (lossless save → load).
 *
 * DXF spec (ADR-359 §3.5 + §5.4):
 *   0       XLINE | RAY
 *   5       handle (index-based, test-stable)
 *   100     AcDbEntity
 *   8       layer name
 *   62      color ACI (omitted if ByLayer)
 *   100     AcDbXline | AcDbRay
 *   10/20/30  basePoint (z = 0 for 2D)
 *   11/21/31  unitDirection (re-normalised at export — ADR-359 §5.4)
 *
 * @see dxf-entity-converters.ts — convertXLine / convertRay (parser side)
 * @see dxf-export.types.ts — EzdxfXLine / EzdxfRay (production microservice)
 */

import type { XLineEntity, RayEntity } from '../types/entities';

// ──────────────────────────────────────────────────────────────────────────────
// Emit helper
// ──────────────────────────────────────────────────────────────────────────────

function emit(out: string[], code: string, value: string): void {
  out.push(code, value);
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal entity emitter
// ──────────────────────────────────────────────────────────────────────────────

function emitAuxEntity(
  out: string[],
  entity: XLineEntity | RayEntity,
  handle: number,
): void {
  const isXLine = entity.type === 'xline';

  // Direction re-normalised at export (safety — ADR-359 §5.4 I/O boundary)
  const { x: dx, y: dy } = entity.direction;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ndx = len > 1e-10 ? dx / len : 1;
  const ndy = len > 1e-10 ? dy / len : 0;

  emit(out, '0', isXLine ? 'XLINE' : 'RAY');
  emit(out, '5', handle.toString());
  emit(out, '100', 'AcDbEntity');
  emit(out, '8', entity.layerId);

  // Style codes omitted when ByLayer (DXF convention — ADR-359 §5.4)
  if (entity.colorMode === 'Concrete' && entity.colorAci !== undefined) {
    emit(out, '62', entity.colorAci.toString());
  }

  emit(out, '100', isXLine ? 'AcDbXline' : 'AcDbRay');
  emit(out, '10', entity.basePoint.x.toString());
  emit(out, '20', entity.basePoint.y.toString());
  emit(out, '30', '0');
  emit(out, '11', ndx.toString());
  emit(out, '21', ndy.toString());
  emit(out, '31', '0');
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Emit a tokenised DXF `ENTITIES` section containing XLINE + RAY entities.
 * Output shape: alternating code/value lines (index 2i = code, 2i+1 = value).
 *
 * @param entities XLineEntity or RayEntity instances to serialise.
 * @returns string[] of alternating group-code / value pairs.
 */
export function writeXLineRayEntities(
  entities: ReadonlyArray<XLineEntity | RayEntity>,
): string[] {
  const out: string[] = [];

  emit(out, '0', 'SECTION');
  emit(out, '2', 'ENTITIES');

  entities.forEach((entity, i) => emitAuxEntity(out, entity, i));

  emit(out, '0', 'ENDSEC');
  return out;
}
