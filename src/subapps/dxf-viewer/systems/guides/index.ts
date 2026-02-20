/**
 * @module systems/guides
 * @description Construction Guide System — barrel exports
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-02-19
 */

// Types
export type { Guide, GuideRenderStyle, GridAxis, ConstructionPoint } from './guide-types';
export { GUIDE_COLORS, DEFAULT_GUIDE_STYLE, GHOST_GUIDE_STYLE, GUIDE_LIMITS, CONSTRUCTION_POINT_LIMITS } from './guide-types';
export { isDiagonalGuide, pointToSegmentDistance, projectPointOnSegment } from './guide-types';

// Store
export { GuideStore, getGlobalGuideStore } from './guide-store';
export { ConstructionPointStore, getGlobalConstructionPointStore } from './construction-point-store';

// Commands
export { CreateGuideCommand, DeleteGuideCommand, CreateParallelGuideCommand, CreateDiagonalGuideCommand } from './guide-commands';
export { AddConstructionPointCommand, AddConstructionPointBatchCommand, DeleteConstructionPointCommand } from './construction-point-commands';

// Renderer
export { GuideRenderer } from './guide-renderer';
