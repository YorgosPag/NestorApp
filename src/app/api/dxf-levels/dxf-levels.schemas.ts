import { z } from 'zod';
import { ThermalEnvelopeSpecSchema } from '@/subapps/dxf-viewer/bim/types/thermal-envelope.schemas';

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

// ⚠️ SSoT CONTRACT (incident 2026-06-13 — infinite PATCH loop): this nested
// schema is a `z.object` and Zod STRIPS any key it does not declare. Every field
// the client persists in `BimRenderSettings` MUST appear here, or it is silently
// dropped server-side. The `settingsVersion` strip in particular caused a runaway
// loop: client writes v2 → server strips it → `loadForLevel` migration sees an
// un-versioned doc → re-heals (writes v2) → server strips → … (~800ms/write,
// `_v` climbed past 42k). When ANY new ADR adds a `BimRenderSettings` field, add
// it BOTH to `bim-render-settings-types.ts` AND here. Keep this list in sync with
// `BimRenderSettings` (config/bim-render-settings-types.ts).
const BimRenderSettingsSchema = z.object({
  // ADR-445 — persisted schema version. CRITICAL: omitting this re-arms the
  // migration heal on every load → infinite PATCH loop (see contract note above).
  settingsVersion: z.number().int().optional(),
  drawingScale: z.number().int().min(1).max(10000),
  viewRange: z.object({
    topMm: z.number().optional(),
    cutPlaneMm: z.number().optional(),
    bottomMm: z.number().optional(),
    viewDepthMm: z.number().optional(),
    floorAdjustedRangeMm: z.number().optional(),
  }).optional(),
  objectStyles: z.record(ObjectStyleSchema).optional(),
  // ADR-405 §4 — per-discipline visibility (Revit "View Discipline").
  disciplineVisibility: z.record(z.boolean()).optional(),
  // ADR-408 Φ7 — colour-by-system master toggle.
  colorBySystem: z.boolean().optional(),
  // ADR-446 — per-view Visual Style preset (the FACES × EDGES SSoT).
  visualStyle: z.enum([
    'wireframe', 'hidden-line', 'shaded', 'shaded-edges',
    'consistent', 'consistent-edges', 'realistic', 'realistic-edges',
  ]).optional(),
  // ADR-413/446 — LEGACY realistic-materials bit (retained for migration).
  realisticMaterials: z.boolean().optional(),
  // ADR-422 L1 — analytical heat-load overlay master toggle.
  showHeatLoad: z.boolean().optional(),
  // ADR-449 Slice 5 — structural finish-skin master toggle «Σοβατισμένη όψη».
  showFinishSkin: z.boolean().optional(),
  // ADR-452 — cut-plane (Revit View Range) hide-gate master toggle.
  cutPlaneActive: z.boolean().optional(),
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
  /** ADR-396 P7: per-floor ETICS thermal envelope spec (preset + display driver). */
  thermalEnvelopeSpec: ThermalEnvelopeSpecSchema.nullable().optional(),
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
