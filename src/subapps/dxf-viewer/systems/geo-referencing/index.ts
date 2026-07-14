/**
 * ADR-650 M10 — geo-referencing public surface (Revit Shared Coordinates for DXF↔terrain).
 *
 * @see ./geo-transform.ts        — pure rigid transform (local↔world, mm)
 * @see ./geo-reference-schema.ts — Project (ADR-369 metres) ↔ runtime GeoReference (mm)
 * @see ./geo-auto-align.ts       — robust-center translation first guess
 */

export type { GeoReference } from './geo-transform';
export {
  IDENTITY_GEO_REFERENCE,
  isIdentityGeoReference,
  localToWorld,
  worldToLocal,
  fromOnePointPair,
  fromTwoPointPairs,
  pointPairScaleRatio,
} from './geo-transform';

export type { ProjectGeoReferenceFields, GeoReferencePatch } from './geo-reference-schema';
export {
  geoReferenceFromProject,
  geoReferenceToProjectPatch,
  isProjectGeoReferenced,
} from './geo-reference-schema';

export type { AutoAlignResult } from './geo-auto-align';
export { autoAlignByRobustCenters } from './geo-auto-align';
