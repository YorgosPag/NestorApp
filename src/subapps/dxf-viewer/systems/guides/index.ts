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

// Commands (split into semantic modules under commands/)
export {
  CreateGuideCommand, CreateParallelGuideCommand, CreateDiagonalGuideCommand, CreateGridFromPresetCommand,
  DeleteGuideCommand, BatchDeleteGuidesCommand,
  MoveGuideCommand,
  RotateGuideCommand, RotateAllGuidesCommand, RotateGuideGroupCommand,
  ScaleAllGuidesCommand, EqualizeGuidesCommand,
  MirrorGuidesCommand, PolarArrayGuidesCommand, CopyGuidePatternCommand,
  GuideFromEntityCommand, GuideOffsetFromEntityCommand, BatchGuideFromEntitiesCommand,
} from './commands';
export type { EntityGuideParams } from './commands';
export { AddConstructionPointCommand, AddConstructionPointBatchCommand, DeleteConstructionPointCommand } from './construction-point-commands';

// Presets (B23 + B72 + B95 + B98 + B101)
export { STRUCTURAL_PRESETS, getPresetById, parseCustomSpacings, generateLetterLabels, generateNumberLabels } from './guide-presets';
export type { GuideGridPreset } from './guide-presets';

// Renderer
export { GuideRenderer } from './guide-renderer';

// Analysis (B58 + B89)
export { detectAnomalies, computeAnalytics, suggestFixes } from './guide-analysis';
export type { GuideAnomaly, GuideAnomalyType, GuideAnalytics } from './guide-analysis';

// Advanced Geometry (B77 + B78 + B80)
export { generateAdaptiveSpacing, solveGridConstraints, generateFractalSubdivisions } from './guide-advanced-geometry';
export type { DensityProfile, GridConstraints } from './guide-advanced-geometry';

// Compliance (B93 + B95 + B98 + B101)
export { checkBuildingCode, checkSeismicCompliance, SEISMIC_PRESETS, ISO_19650_TEMPLATES, DIN_VOB_TEMPLATES } from './guide-compliance';
export type { ComplianceResult, ComplianceCheck, SeismicZone, BuildingCodeType } from './guide-compliance';

// Sustainability (B72 + B74 + B75 + B100)
export { ECO_PRESETS, estimateMaterial, estimateCarbon, checkGreenDeal } from './guide-sustainability';
export type { MaterialEstimate, CarbonEstimate, SustainabilityCheck, SustainabilityFinding } from './guide-sustainability';

// NLP (B60)
export { parseGridCommand } from './guide-nlp';
export type { NLPGridResult } from './guide-nlp';

// IFC Export (B88 + B96)
export { exportGuidesToIFC, buildIFCGridData, computeQuantityTakeoff } from './guide-ifc-exporter';
export type { IFCGridData, QuantityTakeoff } from './guide-ifc-exporter';
