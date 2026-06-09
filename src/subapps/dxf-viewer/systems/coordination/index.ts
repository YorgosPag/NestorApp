/**
 * ADR-435 — Coordination / Clash Detection public surface (Slice 0).
 *
 * One broad-phase + narrow-phase engine over the EXISTING geometry caches — zero
 * new geometry. Mirror of the `systems/mep-design/` auto-design framework, one
 * layer up (Coordination stage, ADR-423 §10).
 */

export type {
  Vec3, Aabb3, ClashCapsule, ClashEntityKind, ClashType, ClashSeverity,
  ClashEntity, Clash, ClashRule, ClashReport,
} from './clash-types';
export { aabbOverlap, aabbOverlapVolumeM3, aabbCenter, aabbMaxExtent, aabbFromPoints } from './aabb';
export { entityWorldAABB } from './entity-world-aabb';
export { broadPhasePairs } from './broad-phase';
export type { BroadPhaseResult } from './broad-phase';
export { closestDistanceBetweenSegments, segmentAabbHit } from './clash-narrow-phase';
export { shouldSkipPair, sharesSystem } from './clash-pair-filter';
export { DEFAULT_CLEARANCE_RULES, isStructural, hardSeverity, maxClearanceM } from './clash-rules';
export { detectClashes } from './detect-clashes';
export type { DetectClashesInput } from './detect-clashes';
