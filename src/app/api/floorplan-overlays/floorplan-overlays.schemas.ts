/**
 * 🔷 FLOORPLAN OVERLAYS API — Zod Schemas (ADR-340 Phase 9)
 *
 * Validation for the multi-kind discriminated-union `floorplan_overlays`
 * collection. Geometry shape varies by `geometry.type`; role↔geometry
 * consistency is enforced at the handler layer (and Firestore rules).
 */

import { z } from 'zod';

// ─── Primitives ───────────────────────────────────────────────────────────────

const Point2DSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

// ─── Geometry discriminated union ─────────────────────────────────────────────

const PolygonGeometrySchema = z.object({
  type: z.literal('polygon'),
  vertices: z.array(Point2DSchema).min(2).max(10_000),
  closed: z.boolean().optional(),
});

const LineGeometrySchema = z.object({
  type: z.literal('line'),
  start: Point2DSchema,
  end: Point2DSchema,
});

const CircleGeometrySchema = z.object({
  type: z.literal('circle'),
  center: Point2DSchema,
  radius: z.number().positive().finite(),
});

const ArcGeometrySchema = z.object({
  type: z.literal('arc'),
  center: Point2DSchema,
  radius: z.number().positive().finite(),
  startAngle: z.number().finite(),
  endAngle: z.number().finite(),
  counterclockwise: z.boolean().optional(),
});

const DimensionGeometrySchema = z.object({
  type: z.literal('dimension'),
  from: Point2DSchema,
  to: Point2DSchema,
  offset: z.number().finite().optional(),
  value: z.string().max(64).optional(),
  unit: z.enum(['m', 'cm', 'mm']).optional(),
});

const MeasurementGeometrySchema = z.object({
  type: z.literal('measurement'),
  points: z.array(Point2DSchema).min(2).max(1024),
  mode: z.enum(['distance', 'area', 'angle']),
  value: z.number().finite(),
  unit: z.string().min(1).max(32),
});

const TextGeometrySchema = z.object({
  type: z.literal('text'),
  position: Point2DSchema,
  text: z.string().min(1).max(1024),
  fontSize: z.number().positive().finite().optional(),
  rotation: z.number().finite().optional(),
});

export const OverlayGeometrySchema = z.discriminatedUnion('type', [
  PolygonGeometrySchema,
  LineGeometrySchema,
  CircleGeometrySchema,
  ArcGeometrySchema,
  DimensionGeometrySchema,
  MeasurementGeometrySchema,
  TextGeometrySchema,
]);

export type OverlayGeometryInput = z.infer<typeof OverlayGeometrySchema>;

// ─── Role + linked + style + scale ────────────────────────────────────────────

export const OverlayRoleSchema = z.enum([
  'property',
  'parking',
  'storage',
  'footprint',
  'annotation',
  'auxiliary',
]);

const OverlayLinkedSchema = z
  .object({
    propertyId: z.string().min(1).max(128).optional(),
    parkingId: z.string().min(1).max(128).optional(),
    storageId: z.string().min(1).max(128).optional(),
  })
  .strict();

const OverlayStyleSchema = z
  .object({
    stroke: z.string().max(64).optional(),
    fill: z.string().max(64).optional(),
    strokeWidth: z.number().min(0).max(100).optional(),
    opacity: z.number().min(0).max(1).optional(),
    dashed: z.boolean().optional(),
  })
  .strict();

export const BackgroundScaleSchema = z.object({
  unitsPerMeter: z.number().positive().finite(),
  sourceUnit: z.enum(['mm', 'cm', 'm', 'pixel']),
});

// ─── CRUD payload schemas ─────────────────────────────────────────────────────

/**
 * POST /api/floorplan-overlays — create a new overlay.
 * Server generates id via `generateOverlayId()` and stamps companyId/createdBy/timestamps.
 */
export const CreateFloorplanOverlaySchema = z.object({
  backgroundId: z.string().min(1).max(128),
  floorId: z.string().min(1).max(128),
  geometry: OverlayGeometrySchema,
  role: OverlayRoleSchema,
  linked: OverlayLinkedSchema.optional(),
  label: z.string().max(256).optional(),
  style: OverlayStyleSchema.optional(),
  layer: z.string().max(64).optional(),
});

export type CreateFloorplanOverlayInput = z.infer<typeof CreateFloorplanOverlaySchema>;

/**
 * PUT /api/floorplan-overlays — upsert (undo/restore flow).
 * Client supplies the original overlayId + original createdAtMs + createdBy.
 */
export const UpsertFloorplanOverlaySchema = z.object({
  overlayId: z.string().min(1).max(128),
  backgroundId: z.string().min(1).max(128),
  floorId: z.string().min(1).max(128),
  geometry: OverlayGeometrySchema,
  role: OverlayRoleSchema,
  linked: OverlayLinkedSchema.optional(),
  label: z.string().max(256).optional(),
  style: OverlayStyleSchema.optional(),
  layer: z.string().max(64).optional(),
  createdAtMs: z.number().int().min(0).optional(),
  createdBy: z.string().max(128).optional(),
});

export type UpsertFloorplanOverlayInput = z.infer<typeof UpsertFloorplanOverlaySchema>;

/**
 * PATCH /api/floorplan-overlays — partial update.
 * Immutable fields (id, companyId, backgroundId, floorId) cannot be patched.
 * `linked: null` explicitly clears the link.
 */
export const UpdateFloorplanOverlaySchema = z.object({
  overlayId: z.string().min(1).max(128),
  geometry: OverlayGeometrySchema.optional(),
  role: OverlayRoleSchema.optional(),
  linked: z.union([OverlayLinkedSchema, z.null()]).optional(),
  label: z.union([z.string().max(256), z.null()]).optional(),
  style: z.union([OverlayStyleSchema, z.null()]).optional(),
  layer: z.union([z.string().max(64), z.null()]).optional(),
});

export type UpdateFloorplanOverlayInput = z.infer<typeof UpdateFloorplanOverlaySchema>;
