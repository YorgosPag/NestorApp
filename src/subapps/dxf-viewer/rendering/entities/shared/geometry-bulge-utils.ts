/**
 * GEOMETRY BULGE UTILITIES — re-export of the SSoT `@/lib/geometry/polyline-bulge` (ADR-510 Φ3a · ADR-920 Β6.11 Ζ1).
 *
 * The bulge↔arc math moved to `src/lib/geometry/` so the owner's plot-outline import (outside the subapp, CHECK 3.62)
 * reads arcs with the SAME formula the renderer, the DXF writer and the measurements use. This path stays so the
 * subapp's callers keep their import unchanged.
 */

export {
  BULGE_STRAIGHT_EPS,
  bulgeToArc,
  bulgeToPolyline,
  bulgeApexPoint,
  bulgeFromApexPoint,
  bulgeSegmentExtremes,
  expandPolyline,
  hasAnyBulge,
  isStraightSegment,
  type BulgeArc,
} from '@/lib/geometry/polyline-bulge';
