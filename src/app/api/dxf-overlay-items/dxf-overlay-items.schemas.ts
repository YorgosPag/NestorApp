/**
 * 🔷 DXF OVERLAY ITEMS API — Zod Schemas (ADR-289)
 *
 * Validation for create/upsert/update/delete flows on the
 * `dxf_overlay_levels/{levelId}/items/{overlayId}` subcollection.
 */

import { z } from 'zod';

const OverlayKindSchema = z.enum(['property', 'parking', 'storage', 'footprint']);

/** Polygon vertex: Firestore-compatible {x, y} objects. */
const PolygonVertexSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

/** Polygon array — minimum 3 vertices (any less cannot form a closed polygon). */
const PolygonSchema = z.array(PolygonVertexSchema).min(3).max(10_000);

/** Linked entity reference (property/parking/storage — zero or more fields). */
const LinkedEntitySchema = z
  .object({
    propertyId: z.string().max(128).optional(),
    parkingId: z.string().max(128).optional(),
    storageId: z.string().max(128).optional(),
  })
  .strict();

/** Style fields persisted with overlays (stroke/fill/lineWidth/opacity). */
const OverlayStyleSchema = z
  .object({
    stroke: z.string().max(64).optional(),
    fill: z.string().max(64).optional(),
    lineWidth: z.number().min(0).max(100).optional(),
    opacity: z.number().min(0).max(1).optional(),
  })
  .strict();

/**
 * POST /api/dxf-overlay-items — create a brand new overlay.
 * Server generates overlayId via enterprise-id.service.generateOverlayId().
 */
export const CreateDxfOverlayItemSchema = z.object({
  levelId: z.string().min(1).max(128),
  kind: OverlayKindSchema,
  polygon: PolygonSchema,
  status: z.string().max(64).optional(),
  label: z.string().max(256).optional(),
  linked: LinkedEntitySchema.optional(),
  style: OverlayStyleSchema.optional(),
});

export type CreateDxfOverlayItemInput = z.infer<typeof CreateDxfOverlayItemSchema>;

/**
 * PUT /api/dxf-overlay-items — upsert (undo/restore flow).
 * Client supplies the original overlayId + original createdAt timestamp.
 */
export const UpsertDxfOverlayItemSchema = z.object({
  levelId: z.string().min(1).max(128),
  overlayId: z.string().min(1).max(128),
  kind: OverlayKindSchema,
  polygon: PolygonSchema,
  status: z.string().max(64).optional(),
  label: z.string().max(256).optional(),
  linked: LinkedEntitySchema.optional(),
  style: OverlayStyleSchema.optional(),
  /** Original createdAt (ms epoch) — preserved on restore to keep chronology. */
  createdAtMs: z.number().int().min(0).optional(),
  /** Original createdBy — preserved on restore (fallback to ctx.uid if absent). */
  createdBy: z.string().max(128).optional(),
});

export type UpsertDxfOverlayItemInput = z.infer<typeof UpsertDxfOverlayItemSchema>;

/**
 * PATCH /api/dxf-overlay-items — partial update of an existing overlay.
 * Only listed fields are written; updatedAt is always bumped server-side.
 * `linked: null` explicitly clears the link (Firestore stores null).
 */
export const UpdateDxfOverlayItemSchema = z.object({
  levelId: z.string().min(1).max(128),
  overlayId: z.string().min(1).max(128),
  polygon: PolygonSchema.optional(),
  kind: OverlayKindSchema.optional(),
  status: z.union([z.string().max(64), z.null()]).optional(),
  label: z.string().max(256).optional(),
  linked: z.union([LinkedEntitySchema, z.null()]).optional(),
  style: OverlayStyleSchema.optional(),
});

export type UpdateDxfOverlayItemInput = z.infer<typeof UpdateDxfOverlayItemSchema>;
