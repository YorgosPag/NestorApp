import { z } from 'zod';

/**
 * 📐 DXF DIMENSION STYLES — ENTERPRISE ZOD SCHEMAS (ADR-362 Phase F4)
 *
 * Mirrors `dxf-levels.schemas.ts`. The `style` object carries the ~60 DimStyle
 * variables (ISO 129 / ASME Y14.5 superset — see `types/dimension.ts`). We do
 * NOT re-enumerate them here: `.passthrough()` keeps every declared + undeclared
 * key (the client is the SSoT for the DimStyle shape, and the collection is
 * write-guarded by Firestore rules + tenant isolation, not by field allowlist).
 * `undefined` optional fields never reach the wire (JSON.stringify drops them),
 * so Firestore never sees an `undefined` value.
 */

/** The DimStyle payload for a custom style — passthrough of the ~60 fields. */
const DimStylePayloadSchema = z.object({}).passthrough();

export const CreateDimStyleSchema = z.object({
  name: z.string().min(1).max(200),
  /** When true the newly created doc immediately becomes the company default. */
  isDefault: z.boolean().optional(),
  /**
   * Thin built-in-reference marker. Normal create = custom style (false/absent).
   * Built-in defaults are pinned via the set-default action, not create.
   */
  isBuiltInRef: z.boolean().optional(),
  /** For a built-in-ref doc: the built-in template slug (e.g. `dimstyle_iso_129`). */
  id: z.string().min(1).max(128).optional(),
  /** Full DimStyle payload (custom styles). Omitted for thin built-in-ref docs. */
  style: DimStylePayloadSchema.optional(),
}).passthrough();

export const UpdateDimStyleSchema = z.object({
  styleId: z.string().min(1).max(128),
  name: z.string().min(1).max(200).optional(),
  isDefault: z.boolean().optional(),
  /** Full DimStyle payload replacement (edit of a custom style). */
  style: DimStylePayloadSchema.optional(),
  _v: z.number().int().optional(),
}).passthrough();

/**
 * Set-default action payload (transfers the `isDefault` pointer). Distinguished
 * from a general update by the `action: 'set-default'` discriminator.
 *   - custom target → `styleId` is the custom doc id, `isBuiltInRef` absent/false.
 *   - built-in target → `styleId` is the built-in template slug, `isBuiltInRef` true.
 */
export const SetDefaultDimStyleSchema = z.object({
  action: z.literal('set-default'),
  styleId: z.string().min(1).max(128),
  isBuiltInRef: z.boolean().optional(),
  /** Display name for a freshly-created thin built-in-ref doc (rules require `name`). */
  name: z.string().min(1).max(200).optional(),
});
