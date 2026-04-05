/**
 * =============================================================================
 * ENTERPRISE: usePropertyCreateValidation — SSoT Hierarchy Validation Hook
 * =============================================================================
 *
 * **Single Source of Truth** for discriminated Property creation validation
 * (ADR-284 §2.3). Client-side mirror of server-side policy in
 * `src/services/property/property-creation-policy.ts`.
 *
 * Used by all 4 creation paths via shared validation:
 *   - Path #1: `usePropertyForm` (AddPropertyDialog modal)
 *   - Path #2: `PropertyFieldsBlock` (inline __new__ template στο /properties)
 *   - Path #3: `PropertyInlineCreateForm` (Building tab)
 *   - Path #4: `usePolygonHandlers` (DXF viewer)
 *
 * Family A (in-building): `apartment`, `studio`, `shop`, etc.
 *   → requires `projectId` + `buildingId` + (`floorId` OR `levels[].length >= 2`)
 *
 * Family B (standalone): `detached_house`, `villa`
 *   → requires `projectId` only
 *   → `buildingId`, `floorId`, `levels[]` MUST be empty
 *
 * @module hooks/properties/usePropertyCreateValidation
 * @enterprise ADR-284 §2.3 (discriminator logic), §9.3 (Gap Discovery), Batch 7
 */

import { useMemo } from 'react';
import type { PropertyType } from '@/types/property';
import type {
  PropertyCreationFormFields,
  PropertyCreationValidationResult,
} from '@/types/property-creation';

// =============================================================================
// DISCRIMINATOR (SSoT — mirrors server-side STANDALONE_UNIT_TYPES)
// =============================================================================

/**
 * ADR-284 — Standalone unit types (Family B).
 *
 * These units attach directly to a Project without Building/Floor. Mirror of
 * server-side `STANDALONE_UNIT_TYPES` in `property-creation-policy.ts`.
 */
export const STANDALONE_UNIT_TYPES: readonly PropertyType[] = [
  'detached_house',
  'villa',
];

/**
 * Discriminator function — determines whether a type is Family B (standalone).
 * Returns `false` for empty string (undecided state).
 */
export function isStandaloneUnitType(type: PropertyType | ''): boolean {
  return type !== '' && STANDALONE_UNIT_TYPES.includes(type);
}

// =============================================================================
// PURE VALIDATOR (no React dependencies)
// =============================================================================

/**
 * Pure validation — no side effects, no React, no i18n.
 *
 * Returns i18n keys that the caller translates (separation of concerns).
 * Call this from non-React contexts (e.g., DXF polygon handlers) where
 * hook rules don't apply.
 *
 * @param formData — minimal form shape
 * @returns errors (i18n keys) + isValid flag
 */
export function validatePropertyCreationFields(
  formData: PropertyCreationFormFields,
): PropertyCreationValidationResult {
  const errors: PropertyCreationValidationResult['errors'] = {};

  // Required: name
  if (!formData.name.trim()) {
    errors.name = 'dialog.addUnit.validation.nameRequired';
  }

  // Required: type (discriminator between Family A and Family B)
  if (!formData.type) {
    errors.type = 'dialog.addUnit.validation.typeRequired';
  }

  // Required: projectId (both families — ADR-284 §2.3)
  if (!formData.projectId) {
    errors.projectId = 'dialog.addUnit.validation.projectRequired';
  }

  const standalone = isStandaloneUnitType(formData.type);
  const levelsCount = formData.levels?.length ?? 0;

  if (!standalone && formData.type) {
    // Family A: In-building — buildingId + floor scope required
    if (!formData.buildingId) {
      errors.buildingId = 'dialog.addUnit.validation.buildingRequired';
    }
    // Floor scope: accept either single floorId OR multi-level selection (ADR-236)
    const hasFloorScope = !!formData.floorId || levelsCount > 0;
    if (!hasFloorScope) {
      errors.floorId = 'dialog.addUnit.validation.floorRequired';
    }
  } else if (standalone) {
    // Family B: Standalone — buildingId + floorId + levels[] MUST be empty
    if (formData.buildingId || formData.floorId || levelsCount > 0) {
      errors.type = 'dialog.addUnit.validation.standaloneNoBuilding';
    }
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

// =============================================================================
// REACT HOOK (memoized wrapper)
// =============================================================================

/**
 * React hook wrapper — memoizes validation result for use in UI components.
 * For non-React contexts use `validatePropertyCreationFields()` directly.
 *
 * @example
 * const { errors, isValid } = usePropertyCreateValidation(formData);
 * // errors.buildingId === 'dialog.addUnit.validation.buildingRequired'
 * // const translated = t(errors.buildingId);
 */
export function usePropertyCreateValidation(
  formData: PropertyCreationFormFields,
): PropertyCreationValidationResult {
  return useMemo(
    () => validatePropertyCreationFields(formData),
    [
      formData.name,
      formData.type,
      formData.projectId,
      formData.buildingId,
      formData.floorId,
      formData.levels,
    ],
  );
}
