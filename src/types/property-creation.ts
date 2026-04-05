/**
 * =============================================================================
 * ENTERPRISE: Property Creation — Shared Types (SSoT)
 * =============================================================================
 *
 * Minimal form shape required for discriminated hierarchy validation
 * (ADR-284). Used by all 4 Property creation paths:
 *   1. AddPropertyDialog (modal) — `usePropertyForm`
 *   2. PropertyFieldsBlock (inline __new__ template) — via shared hook
 *   3. PropertyInlineCreateForm (Building tab) — via shared hook
 *   4. DXF viewer polygon draw (`usePolygonHandlers`) — context-implicit
 *
 * **Single Source of Truth**: The validation/types layer is the SSoT, NOT
 * the UI layer. Each path may have its own UX pattern (modal / inline edit
 * / per-building / DXF-driven), but they all validate through the same
 * shared primitives.
 *
 * @module types/property-creation
 * @enterprise ADR-284 §9.3 (Gap Discovery), Batch 7 (SSoT Consolidation)
 */

import type { PropertyType, PropertyLevel } from './property';

/**
 * Minimum form shape required for hierarchy-discriminated validation.
 *
 * Consumers extend this with path-specific fields (floor number, area, code,
 * description, etc.) — the shared validator only inspects these 6 fields.
 */
export interface PropertyCreationFormFields {
  name: string;
  type: PropertyType | '';
  /** ADR-284: Required for BOTH families (Family A + Family B). */
  projectId: string;
  /** ADR-284: Required for Family A only; MUST be empty for Family B. */
  buildingId: string;
  /** ADR-284: Required for Family A only (or use `levels[]` for multi-level). */
  floorId: string;
  /** ADR-236: Alternative to single `floorId` for multi-level in-building units. */
  levels?: PropertyLevel[];
}

/**
 * Validation result — pure data, no side effects.
 *
 * Consumers use `isValid` for silent Save-button disabled state, and
 * `errors` (i18n keys) for inline error messages.
 */
export interface PropertyCreationValidationResult {
  /** Field-level validation errors as i18n keys (caller translates). */
  errors: Partial<Record<keyof PropertyCreationFormFields, string>>;
  /** `true` when all hierarchy rules pass — safe to enable Save. */
  isValid: boolean;
}
