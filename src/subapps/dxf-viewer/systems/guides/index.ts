/**
 * @module systems/guides
 * @description Construction Guide System — barrel exports
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-02-19
 */

// Types
export type { Guide, GuideGroup, GuideRenderStyle, GridAxis, ConstructionPoint } from './guide-types';
export { GUIDE_COLORS, GUIDE_COLOR_PALETTE, DEFAULT_GUIDE_STYLE, GHOST_GUIDE_STYLE, SELECTED_GUIDE_STYLE, TEMPORARY_GUIDE_STYLE, GUIDE_LIMITS, CONSTRUCTION_POINT_LIMITS } from './guide-types';
export { isDiagonalGuide, pointToSegmentDistance, projectPointOnSegment } from './guide-types';

// Store
export { GuideStore, getGlobalGuideStore } from './guide-store';
export { ConstructionPointStore, getGlobalConstructionPointStore } from './construction-point-store';

// Commands
export { CreateGuideCommand, DeleteGuideCommand, CreateParallelGuideCommand, CreateDiagonalGuideCommand, GuideFromEntityCommand, BatchDeleteGuidesCommand, CopyGuidePatternCommand, GuideOffsetFromEntityCommand, CreateGridFromPresetCommand, BatchGuideFromEntitiesCommand } from './guide-commands';
export type { EntityGuideParams } from './guide-commands';
export { AddConstructionPointCommand, AddConstructionPointBatchCommand, DeleteConstructionPointCommand } from './construction-point-commands';

// Presets (B23)
export { STRUCTURAL_PRESETS, getPresetById, parseCustomSpacings } from './guide-presets';
export type { GuideGridPreset } from './guide-presets';

// Renderer
export { GuideRenderer } from './guide-renderer';
