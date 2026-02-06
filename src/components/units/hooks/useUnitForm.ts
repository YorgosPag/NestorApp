'use client';

/**
 * =============================================================================
 * ENTERPRISE: useUnitForm Hook
 * =============================================================================
 *
 * Form state management hook for AddUnitDialog.
 * Follows useBuildingForm pattern for consistency.
 *
 * Features:
 * - Type-safe form data management
 * - Validation with i18n error messages
 * - Integration with createUnit service (server-side API, ADR-078)
 * - Toast notifications for feedback
 * - RealtimeService auto-dispatches UnitCreated event via createUnit()
 *
 * @enterprise Fortune 500-grade form handling
 * @created 2026-02-06
 * @see ADR-034
 */

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { createUnit } from '@/services/units.service';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { UnitType, OperationalStatus } from '@/types/unit';

// =============================================================================
// TYPES
// =============================================================================

export interface UnitFormData {
  // Tab 1: Basic Info
  name: string;
  code: string;
  type: UnitType | '';
  buildingId: string;
  floor: number | '';
  operationalStatus: OperationalStatus;
  // Tab 2: Details
  area: number | '';
  bedrooms: number | '';
  bathrooms: number | '';
  description: string;
}

const INITIAL_FORM_DATA: UnitFormData = {
  // Tab 1: Basic Info
  name: '',
  code: '',
  type: '',
  buildingId: '',
  floor: '',
  operationalStatus: 'draft',
  // Tab 2: Details
  area: '',
  bedrooms: '',
  bathrooms: '',
  description: '',
};

interface UseUnitFormProps {
  onUnitAdded?: () => void;
  onOpenChange: (open: boolean) => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useUnitForm({
  onUnitAdded,
  onOpenChange,
}: UseUnitFormProps) {
  const { t } = useTranslation('units');

  const [formData, setFormData] = useState<UnitFormData>(INITIAL_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof UnitFormData, string>>>({});

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof UnitFormData, string>> = {};

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
        const unitData: Record<string, unknown> = {
          name: formData.name,
          type: formData.type || 'apartment',
          buildingId: formData.buildingId,
          building: '',
          floor: formData.floor !== '' ? formData.floor : 0,
          floorId: '',
          project: '',
          status: 'for-sale',
          operationalStatus: formData.operationalStatus,
          vertices: [],
        };

        // Conditionally add optional fields (Firestore rejects undefined)
        if (formData.code) unitData.code = formData.code;
        if (formData.area !== '') unitData.area = formData.area;
        if (formData.description) unitData.description = formData.description;

        // Build layout only with populated fields
        const layout: Record<string, number> = {};
        if (formData.bedrooms !== '') layout.bedrooms = formData.bedrooms;
        if (formData.bathrooms !== '') layout.bathrooms = formData.bathrooms;
        if (Object.keys(layout).length > 0) unitData.layout = layout;

        const result = await createUnit(unitData);

        if (result.success) {
          toast.success(t('dialog.addUnit.messages.success'));
          setFormData(INITIAL_FORM_DATA);
          onUnitAdded?.();
          onOpenChange(false);
        } else {
          toast.error(result.error || t('dialog.addUnit.messages.error'));
        }
      } catch {
        toast.error(t('dialog.addUnit.messages.error'));
      } finally {
        setLoading(false);
      }
    },
    [formData, validate, t, onUnitAdded, onOpenChange]
  );

  // ==========================================================================
  // CHANGE HANDLERS
  // ==========================================================================

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      // Clear error on change
      if (errors[name as keyof UnitFormData]) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    },
    [errors]
  );

  const handleSelectChange = useCallback(
    (name: keyof UnitFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    },
    [errors]
  );

  const handleNumberChange = useCallback(
    (name: keyof UnitFormData, value: string) => {
      const numValue = value === '' ? '' : Number(value);
      setFormData((prev) => ({ ...prev, [name]: numValue }));
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    },
    [errors]
  );

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
    resetForm,
  };
}

export default useUnitForm;
