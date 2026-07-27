/**
 * ADR-650 M10 — geo-referencing public surface (Revit Shared Coordinates for DXF↔terrain).
 *
 * @see ./geo-transform.ts        — pure rigid transform (local↔world, mm)
 * @see ./geo-reference-schema.ts — Project (ADR-369 metres) ↔ runtime GeoReference (mm)
 * @see ./geo-auto-align.ts       — robust-center translation first guess
 */

export type { GeoReference, WorldToDisplayProjector } from './geo-transform';
export {
  IDENTITY_GEO_REFERENCE,
  isIdentityGeoReference,
  localToWorld,
  worldToLocal,
  makeWorldToDisplayProjector,
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

// ADR-650 §M10e — automatic drawing↔survey matching. `autoMatchToSurvey` is the ONLY entry
// point a consumer needs; the stages below it are exported for tests and diagnostics.
export type { GeoMatchMethod, GeoMatchResult, AutoMatchInput } from './geo-auto-match';
export { autoMatchToSurvey } from './geo-auto-match';
export type { GeoMatchScore, PointSetIndex } from './geo-point-index';
export { buildPointSetIndex, countExplainedPoints, scoreGeoReference } from './geo-point-index';
export type { PointPair, SimilaritySolution } from './geo-similarity-solve';
export { solveRigid2D } from './geo-similarity-solve';
export type { LocalCandidatePoint, CandidateKind } from './geo-ref-candidate-points';
export { collectCandidatePoints } from './geo-ref-candidate-points';
export type { PointNumberMatch } from './geo-point-number-match';
export { matchByPointNumber } from './geo-point-number-match';

export {
  getGeoReference,
  setGeoReference,
  subscribeGeoReference,
  getActiveWorldToDisplayProjector,
} from './geo-reference-store';
export { loadProjectGeoReference, persistProjectGeoReference, clearProjectGeoReference } from './geo-reference-persistence';
