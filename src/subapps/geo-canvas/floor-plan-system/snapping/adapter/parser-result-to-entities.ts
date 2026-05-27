/**
 * ADR-378 Phase 4 — GeoJSON ParserResult → DXF Entity[] adapter.
 *
 * Maps geo-canvas GeoJSON FeatureCollection geometry (LineString / Polygon /
 * MultiLineString) → DXF Viewer Entity[] (LineEntity / PolylineEntity) so the
 * unified `getGlobalSnapEngine()` (ProSnapEngineV2) can index geo-canvas
 * geometry alongside DXF entities.
 *
 * Pattern mirrors `src/subapps/dxf-viewer/overlays/snap-adapter.ts`
 * (`regionsToSnapEntities`) — both convert non-DXF geometry to the single
 * Entity union so the one canonical snap engine has one input shape.
 *
 * Geo-canvas previously ran a parallel 6-mode `SnapEngine` over a private
 * `SnapPoint[]` array. Post-Phase 4 it shares the 26-engine ProSnapEngineV2
 * pipeline through this adapter (industry convention: Revit / AutoCAD /
 * ArchiCAD use 1 engine + N modes via registry).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-378-snap-system-master-architecture.md §3.1, §9 Phase 4
 */

import type { ParserResult } from '../../types';
import type { Entity } from '@/subapps/dxf-viewer/snapping/extended-types';
import type { Point2D } from '@/subapps/dxf-viewer/rendering/types/Types';

let _counter = 0;

function nextId(kind: string): string {
  return `geo-${kind}-${++_counter}`;
}

/**
 * Convert geo-canvas ParserResult → DXF Entity[].
 * Only LineString, Polygon, MultiLineString contribute snap-relevant geometry.
 * Other geometry types (Point, MultiPolygon, MultiPoint, GeometryCollection) are skipped.
 */
export function parserResultToEntities(result: ParserResult | null): Entity[] {
  if (!result?.geoJSON?.features) return [];

  const out: Entity[] = [];

  for (const feature of result.geoJSON.features) {
    const geom = feature.geometry;
    if (!geom) continue;

    try {
      switch (geom.type) {
        case 'LineString': {
          const entity = lineStringToEntity(geom.coordinates as number[][]);
          if (entity) out.push(entity);
          break;
        }
        case 'Polygon': {
          const ring = (geom.coordinates as number[][][])[0];
          const entity = polygonRingToEntity(ring);
          if (entity) out.push(entity);
          break;
        }
        case 'MultiLineString': {
          for (const coords of geom.coordinates as number[][][]) {
            const entity = lineStringToEntity(coords);
            if (entity) out.push(entity);
          }
          break;
        }
        default:
          break;
      }
    } catch (error) {
      console.warn(`[parser-result-to-entities] Skip ${geom.type}:`, error);
    }
  }

  return out;
}

function lineStringToEntity(coords: number[][] | undefined): Entity | null {
  if (!coords || coords.length < 2) return null;
  const vertices: Point2D[] = coords.map((c) => ({ x: c[0]!, y: c[1]! }));

  if (vertices.length === 2) {
    return {
      id: nextId('line'),
      name: '',
      type: 'line',
      layerId: 'geo',
      start: vertices[0]!,
      end: vertices[1]!,
      visible: true,
    } as Entity;
  }

  return {
    id: nextId('polyline'),
    name: '',
    type: 'polyline',
    layerId: 'geo',
    vertices,
    closed: false,
    visible: true,
  } as Entity;
}

function polygonRingToEntity(ring: number[][] | undefined): Entity | null {
  if (!ring || ring.length < 3) return null;
  const vertices: Point2D[] = ring.map((c) => ({ x: c[0]!, y: c[1]! }));
  return {
    id: nextId('polygon'),
    name: '',
    type: 'polyline',
    layerId: 'geo',
    vertices,
    closed: true,
    visible: true,
  } as Entity;
}

/** Test-only counter reset. Do NOT call from product code. */
export function __resetParserResultIdCounterForTests(): void {
  _counter = 0;
}
