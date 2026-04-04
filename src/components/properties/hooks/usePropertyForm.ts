'use client';

/**
 * =============================================================================
 * ENTERPRISE: usePropertyForm Hook
 * =============================================================================
 *
 * Form state management hook for AddPropertyDialog.
 * Follows useBuildingForm pattern for consistency.
 *
 * Features:
 * - Type-safe form data management
 * - Validation with i18n error messages
 * - Integration with createUnit service (server-side API, ADR-078)
 * - Toast notifications for feedback
 * - RealtimeService auto-dispatches UnitCreated event via createProperty()
 *
 * @enterprise Fortune 500-grade form handling
 * @created 2026-02-06
 * @see ADR-034
 */

import { useState, useCallback, useMemo } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { createPropertyWithPolicy } from '@/services/property/property-mutation-gateway';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PropertyType, PropertyLevel, OperationalStatus, CommercialStatus } from '@/types/property';
import { deriveMultiLevelFields } from '@/services/multi-level.service';
import { translatePropertyMutationError } from '@/services/property/property-mutation-feedback';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * ADR-284 — Standalone unit types (Family B).
 * These units attach directly to a Project without Building/Floor.
 * Mirror of server-side `STANDALONE_UNIT_TYPES` in property-creation-policy.ts.
 */
export const STANDALONE_UNIT_TYPES: readonly PropertyType[] = ['detached_house', 'villa'];

export function isStandaloneUnitType(type: PropertyType | ''): boolean {
  return type !== '' && STANDALONE_UNIT_TYPES.includes(type);
}

// =============================================================================
// TYPES
// =============================================================================

export interface PropertyFormData {
  // Tab 1: Basic Info
  name: string;
  code: string;
  type: PropertyType | '';
  // ADR-284: Project scope (required for both families)
  projectId: string;
  buildingId: string;
  floorId: string;
  floor: number | '';
  operationalStatus: OperationalStatus;
  commercialStatus: CommercialStatus;
  // ADR-236: Multi-level floors
  levels: PropertyLevel[];
  // Tab 2: Details
  area: number | '';
  bedrooms: number | '';
  bathrooms: number | '';
  description: string;
}

const INITIAL_FORM_DATA: PropertyFormData = {
  // Tab 1: Basic Info
  name: '',
  code: '',
  type: '',
  // ADR-284: Project scope
  projectId: '',
  buildingId: '',
  floorId: '',
  floor: '',
  operationalStatus: 'draft',
  commercialStatus: 'unavailable',
  // ADR-236: Multi-level floors
  levels: [],
  // Tab 2: Details
  area: '',
  bedrooms: '',
  bathrooms: '',
  description: '',
};

interface UsePropertyFormProps {
  onPropertyAdded?: () => void;
  onOpenChange: (open: boolean) => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function usePropertyForm({
  onPropertyAdded,
  onOpenChange,
}: UsePropertyFormProps) {
  const { t } = useTranslation('properties');
  const { success, error } = useNotifications();

  const [formData, setFormData] = useState<PropertyFormData>(INITIAL_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof PropertyFormData, string>>>({});

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  // ADR-284: Discriminated validation — Family A (in-building) vs Family B (standalone)
  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof PropertyFormData, string>> = {};

    // Required: name
    if (!formData.name.trim()) {
      newErrors.name = t('dialog.addUnit.validation.nameRequired');
    }

    // Required: type (discriminator between Family A and Family B)
    if (!formData.type) {
      newErrors.type = t('dialog.addUnit.validation.typeRequired');
    }

    // Required: projectId (both families — ADR-284)
    if (!formData.projectId) {
      newErrors.projectId = t('dialog.addUnit.validation.projectRequired');
    }

    const isStandalone = isStandaloneUnitType(formData.type);

    if (!isStandalone && formData.type) {
      // Family A: In-building — buildingId + floor scope required
      if (!formData.buildingId) {
        newErrors.buildingId = t('dialog.addUnit.validation.buildingRequired');
      }
      // Floor scope: accept either single floorId OR multi-level selection
      const hasFloorScope = !!formData.floorId || formData.levels.length > 0;
      if (!hasFloorScope) {
        newErrors.floorId = t('dialog.addUnit.validation.floorRequired');
      }
    } else if (isStandalone) {
      // Family B: Standalone — buildingId + floorId MUST be empty
      if (formData.buildingId || formData.floorId || formData.levels.length > 0) {
        newErrors.type = t('dialog.addUnit.validation.standaloneNoBuilding');
      }
    }

    // Validate area if provided
    if (formData.area !== '' && formData.area <= 0) {
      newErrors.area = t('dialog.addUnit.validation.areaPositive');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, t]);

  // ==========================================================================
  // DERIVED: isValid (silent check — no side effects, for Save button disabled)
  // ==========================================================================

  const isValid = useMemo((): boolean => {
    if (!formData.name.trim()) return false;
    if (!formData.type) return false;
    if (!formData.projectId) return false;

    const isStandalone = isStandaloneUnitType(formData.type);

    if (!isStandalone) {
      if (!formData.buildingId) return false;
      const hasFloorScope = !!formData.floorId || formData.levels.length > 0;
      if (!hasFloorScope) return false;
    } else {
      if (formData.buildingId || formData.floorId || formData.levels.length > 0) return false;
    }

    if (formData.area !== '' && formData.area <= 0) return false;

    return true;
  }, [formData]);

  // ==========================================================================
  // SUBMIT HANDLER
  // ==========================================================================

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validate()) return;

      setLoading(true);
      try {
        // Build the unit data matching Property type for addUnit()
        // ENTERPRISE: Firestore does NOT accept undefined values — only include fields with real values

        // ADR-236: If multi-level, derive floor/floorId from primary level
        const hasMultiLevel = formData.levels.length >= 2;
        let resolvedFloor = formData.floor !== '' ? formData.floor : 0;
        let resolvedFloorId = formData.floorId || '';

        if (hasMultiLevel) {
          const derived = deriveMultiLevelFields(formData.levels);
          resolvedFloor = derived.floor;
          resolvedFloorId = derived.floorId;
        }

        const isStandalone = isStandaloneUnitType(formData.type);

        const propertyData: Record<string, unknown> = {
          name: formData.name,
          type: formData.type || 'apartment',
          // ADR-284: Family A sends building/floor; Family B omits them
          buildingId: isStandalone ? '' : formData.buildingId,
          building: '',
          floor: isStandalone ? 0 : resolvedFloor,
          floorId: isStandalone ? '' : resolvedFloorId,
          // ADR-284: projectId always sent (server auto-fills for Family A if empty)
          projectId: formData.projectId,
          project: '',
          commercialStatus: formData.commercialStatus,
          operationalStatus: formData.operationalStatus,
          vertices: [],
        };

        // ADR-236: Include multi-level fields
        if (hasMultiLevel) {
          propertyData.isMultiLevel = true;
          propertyData.levels = formData.levels;
        }

        // Conditionally add optional fields (Firestore rejects undefined)
        if (formData.code) propertyData.code = formData.code;
        if (formData.area !== '') propertyData.area = formData.area;
        if (formData.description) propertyData.description = formData.description;

        // Build layout only with populated fields
        const layout: Record<string, number> = {};
        if (formData.bedrooms !== '') layout.bedrooms = formData.bedrooms;
        if (formData.bathrooms !== '') layout.bathrooms = formData.bathrooms;
        if (Object.keys(layout).length > 0) propertyData.layout = layout;

        const result = await createPropertyWithPolicy({ propertyData });

        if (result.success) {
          success(t('dialog.addUnit.messages.success'));
          setFormData(INITIAL_FORM_DATA);
          onPropertyAdded?.();
          onOpenChange(false);
        } else {
          error(result.error || t('dialog.addUnit.messages.error'));
        }
      } catch (caughtError) {
        error(translatePropertyMutationError(
          caughtError,
          t,
          'dialog.addUnit.messages.error',
          'Failed to create property.',
        ));
      } finally {
        setLoading(false);
      }
    },
    [formData, validate, t, onPropertyAdded, onOpenChange]
  );

  // ==========================================================================
  // CHANGE HANDLERS
  // ==========================================================================

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      // Clear error on change
      if (errors[name as keyof PropertyFormData]) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    },
    [errors]
  );

  const handleSelectChange = useCallback(
    (name: keyof PropertyFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    },
    [errors]
  );

  const handleNumberChange = useCallback(
    (name: keyof PropertyFormData, value: string) => {
      const numValue = value === '' ? '' : Number(value);
      setFormData((prev) => ({ ...prev, [name]: numValue }));
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    },
    [errors]
  );

  // ADR-236: Update levels (multi-level floors)
  const handleLevelsChange = useCallback((levels: PropertyLevel[]) => {
    setFormData((prev) => {
      if (levels.length >= 2) {
        const derived = deriveMultiLevelFields(levels);
        return { ...prev, levels, floor: derived.floor, floorId: derived.floorId };
      }
      return { ...prev, levels };
    });
  }, []);

  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_DATA);
    setErrors({});
  }, []);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    formData,
    loading,
    errors,
    isValid,
    handleSubmit,
    handleChange,
    handleSelectChange,
    handleNumberChange,
    handleLevelsChange,
    resetForm,
  };
}

export default usePropertyForm;
