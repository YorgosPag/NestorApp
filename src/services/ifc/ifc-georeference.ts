/**
 * IFC4 geo-referencing — `IfcProjectedCRS` + `IfcMapConversion` (ADR-937 §3.1, ADR-369).
 *
 * `TrueNorth` alone says only which way North is. A real CAD/BIM exchange (Revit,
 * ArchiCAD — buildingSMART "LoGeoRef 50") also says WHERE the project sits: the
 * map coordinates of the local origin, the rotation of the local X axis in the map,
 * and the map CRS. Without it, every importer drops the model at map (0,0).
 *
 * Every number comes from the ONE reading of the Project fields
 * (`lib/geo/project-geo-frame`), shared with the DXF viewer transform:
 *   - Eastings / Northings  = ΕΓΣΑ'87 metres of the local origin (`basePoint.x/y`)
 *   - OrthogonalHeight      = `surveyPoint.z + basePoint.z` (ADR-369 geodetic chain)
 *   - XAxisAbscissa/Ordinate = local +X in the map, `(cos r, sin r)`
 *   - Scale                 = 1 (IFC length unit = METRE = map unit)
 *
 * Not geo-referenced (no planar `basePoint.x/y`) ⇒ nothing is written: claiming a
 * position at (0,0) would be a lie, not a default.
 *
 * IFC4 attribute order (verified against the IFC4 EXPRESS):
 *   IfcProjectedCRS(Name, Description, GeodeticDatum, VerticalDatum, MapProjection, MapZone, MapUnit)
 *   IfcMapConversion(SourceCRS, TargetCRS, Eastings, Northings, OrthogonalHeight,
 *                    XAxisAbscissa, XAxisOrdinate, Scale)
 */

import { GREEK_GRID_CRS } from '@/lib/geo/greek-grid';
import {
  projectGeoFrame,
  projectOriginHeightM,
  projectXAxisInWorld,
  type ProjectGeoFrameFields,
} from '@/lib/geo/project-geo-frame';

import { IfcGraph, lbl, real, ref } from './ifc-entity-graph';
import { appendSIUnit } from './ifc-units';

/** IFC length unit (METRE) ÷ map unit (METRE). */
const IFC_TO_MAP_SCALE = 1;

/** Ids written by {@link appendIfcMapConversion}. */
export interface IfcGeoReferenceIds {
  readonly projectedCrsID: number;
  readonly mapConversionID: number;
}

/**
 * Appends `IfcProjectedCRS` (ΕΓΣΑ'87, EPSG:2100) and the `IfcMapConversion` from the
 * model context to it. Returns `null` — and writes nothing — when the project is not
 * geo-referenced.
 */
export function appendIfcMapConversion(
  graph: IfcGraph,
  contextID: number,
  fields: ProjectGeoFrameFields,
): IfcGeoReferenceIds | null {
  const frame = projectGeoFrame(fields);
  if (!frame) return null;

  const metre = appendSIUnit(graph, 'LENGTHUNIT', null, 'METRE');
  const projectedCrsID = graph.add('IFCPROJECTEDCRS', [
    lbl(GREEK_GRID_CRS.name),
    lbl(GREEK_GRID_CRS.description),
    lbl(GREEK_GRID_CRS.geodeticDatum),
    null, // VerticalDatum — not declared on the project; not invented here
    lbl(GREEK_GRID_CRS.mapProjection),
    null, // MapZone — EPSG:2100 has a single zone
    ref(metre),
  ]);

  const [xAxisAbscissa, xAxisOrdinate] = projectXAxisInWorld(frame.northRotationDeg);
  const mapConversionID = graph.add('IFCMAPCONVERSION', [
    ref(contextID),
    ref(projectedCrsID),
    real(frame.eastingM),
    real(frame.northingM),
    real(projectOriginHeightM(fields)),
    real(xAxisAbscissa),
    real(xAxisOrdinate),
    real(IFC_TO_MAP_SCALE),
  ]);

  return { projectedCrsID, mapConversionID };
}
