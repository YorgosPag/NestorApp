/**
 * ADR-650 Milestone 1 — topography subsystem barrel.
 *
 * Pipeline: TopoPointStore (raw SSoT) → generateContours (CDT → marching → chain) →
 * buildContourEntities → completeEntity. See ADR-650 §12.1.
 */

export * from './topo-types';
export * from './contour-config';
export * from './topo-local-origin';
export * from './TopoPointStore';
export { buildTin } from './tin-builder';
export { generateLevels, generateContourSegments } from './marching-triangles';
export { chainContours } from './contour-chainer';
export { generateContours, type ContourResult } from './contour-generator';
export {
  buildContourEntities, formatElevationLabel, type ContourLayerIds,
} from './topo-to-entities';
export { ensureContourLayers } from './ensure-contour-layers';
export { parseTopoPoints, type ParseTopoResult } from './parse-topo-points';
// NOTE: `useTopoContours` (React hook) is deliberately NOT re-exported here — this barrel
// stays React-free so the pure geometry can be imported anywhere (incl. server) without
// pulling React in (mirror του formatting-barrel React-leak gotcha). Import the hook directly.
