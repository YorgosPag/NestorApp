import { z } from 'zod';

// ── Reusable BIM render-settings sub-schemas (ADR-375 + ADR-377) ─────────────
// Centralised here because they are the SSoT for the API payload contract;
// missing nested fields cause silent strip (incident 2026-05-27 v2.13 — V/G
// colors stored client-side were dropped server-side and snapshot listener
// delivered stale documents, wiping the local store after the quiet window
// expired).

const PenIndexSchema = z.number().int().min(1).max(16);

const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color (e.g. #ff47ff)');

const BIM_LINE_PATTERN_BUILTINS = [
  'solid',
  'dashed', 'dashed2', 'dashedX2',
  'dotted', 'dotted2', 'dottedX2',
  'center', 'center2', 'centerX2',
  'hidden', 'hidden2', 'hiddenX2',
  'dashdot', 'dashdot2', 'dashdotX2',
  'divide', 'divide2', 'divideX2',
  'phantom', 'phantom2', 'phantomX2',
  'border', 'border2', 'borderX2',
  'double', 'dot', 'zigzag',
] as const;

const LinePatternSchema = z.union([
  z.enum(BIM_LINE_PATTERN_BUILTINS),
  z.string().regex(/^custom_[a-zA-Z0-9_-]+$/, 'Custom pattern key must match /^custom_[a-zA-Z0-9_-]+$/'),
]);

// ADR-377 SubcategoryStyle — parent ObjectStyle fallback when fields absent.
const SubcategoryStyleSchema = z.object({
  cutPen: PenIndexSchema.optional(),
  projectionPen: PenIndexSchema.optional(),
  linePattern: LinePatternSchema.optional(),
  cutColor: HexColorSchema.nullable().optional(),
  projectionColor: HexColorSchema.nullable().optional(),
});

// ADR-375 Phase C.4 V/G + ADR-377 subcategories — full ObjectStyle contract.
const ObjectStyleSchema = z.object({
  projectionPen: PenIndexSchema,
  cutPen: PenIndexSchema,
  visible: z.boolean().optional(),
  projectionColor: HexColorSchema.nullable().optional(),
  cutColor: HexColorSchema.nullable().optional(),
  projectionPattern: LinePatternSchema.optional(),
  cutPattern: LinePatternSchema.optional(),
  subcategories: z.record(SubcategoryStyleSchema).optional(),
});

const BimRenderSettingsSchema = z.object({
  drawingScale: z.number().int().min(1).max(10000),
  viewRange: z.object({
    topMm: z.number().optional(),
    cutPlaneMm: z.number().optional(),
    bottomMm: z.number().optional(),
    viewDepthMm: z.number().optional(),
    floorAdjustedRangeMm: z.number().optional(),
  }).optional(),
  objectStyles: z.record(ObjectStyleSchema).optional(),
});

// ── Public schemas ───────────────────────────────────────────────────────────

export const CreateDxfLevelSchema = z.object({
  name: z.string().min(1).max(200),
  order: z.number().int().min(0).max(9999),
  isDefault: z.boolean().optional(),
  visible: z.boolean().optional(),
  floorId: z.string().min(1).max(128).optional(),
  sceneFileId: z.string().min(1).max(128).optional(),
  sceneFileName: z.string().max(300).optional(),
});

export const UpdateDxfLevelSchema = z.object({
  levelId: z.string().min(1).max(128),
  name: z.string().min(1).max(200).optional(),
  order: z.number().int().min(0).max(9999).optional(),
  isDefault: z.boolean().optional(),
  visible: z.boolean().optional(),
  floorId: z.string().min(1).max(128).nullable().optional(),
  buildingId: z.string().min(1).max(128).nullable().optional(),
  sceneFileId: z.string().min(1).max(128).nullable().optional(),
  sceneFileName: z.string().max(300).nullable().optional(),
  /** ADR-309 Phase 3: Context-aware floorplan type */
  floorplanType: z.enum(['project', 'building', 'floor', 'unit']).nullable().optional(),
  /** ADR-309 Phase 3: Human-readable entity label */
  entityLabel: z.string().max(300).nullable().optional(),
  /** ADR-309 Phase 3: Project ID */
  projectId: z.string().min(1).max(128).nullable().optional(),
  /** ADR-375 Phase B.2 + C.4 + ADR-377: per-view BIM render settings (Revit ViewPlan equivalent). */
  bimRenderSettings: BimRenderSettingsSchema.nullable().optional(),
  /** ADR-375 Phase B.3: FK → dxf_viewer_view_templates. Null = detached. */
  appliedViewTemplateId: z.string().min(1).max(128).nullable().optional(),
  _v: z.number().int().optional(),
}).passthrough();

// ── Test-only exports (allow targeted unit tests of sub-schemas) ─────────────

export const __testing__ = {
  PenIndexSchema,
  HexColorSchema,
  LinePatternSchema,
  SubcategoryStyleSchema,
  ObjectStyleSchema,
  BimRenderSettingsSchema,
};
