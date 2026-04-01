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

import { useState, useCallback } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { createProperty } from '@/services/properties.service';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PropertyType, PropertyLevel, OperationalStatus, CommercialStatus } from '@/types/property';
import { deriveMultiLevelFields } from '@/services/multi-level.service';

// =============================================================================
// TYPES
// =============================================================================

export interface PropertyFormData {
  // Tab 1: Basic Info
  name: string;
  code: string;
  type: PropertyType | '';
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

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof PropertyFormData, string>> = {};

    // Required: name
    if (!formData.name.trim()) {
      newErrors.name = t('dialog.addUnit.validation.nameRequired');
    }

    // Required: buildingId
    if (!formData.buildingId) {
      newErrors.buildingId = t('dialog.addUnit.validation.buildingRequired');
    }

    // Validate area if provided
    if (formData.area !== '' && formData.area <= 0) {
      newErrors.area = t('dialog.addUnit.validation.areaPositive');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, t]);

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

        const propertyData: Record<string, unknown> = {
          name: formData.name,
          type: formData.type || 'apartment',
          buildingId: formData.buildingId,
          building: '',
          floor: resolvedFloor,
          floorId: resolvedFloorId,
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

        const result = await createProperty(propertyData);

        if (result.success) {
          success(t('dialog.addUnit.messages.success'));
          setFormData(INITIAL_FORM_DATA);
          onPropertyAdded?.();
          onOpenChange(false);
        } else {
          error(result.error || t('dialog.addUnit.messages.error'));
        }
      } catch {
        error(t('dialog.addUnit.messages.error'));
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
    handleSubmit,
    handleChange,
    handleSelectChange,
    handleNumberChange,
    handleLevelsChange,
    resetForm,
  };
}

export default usePropertyForm;
