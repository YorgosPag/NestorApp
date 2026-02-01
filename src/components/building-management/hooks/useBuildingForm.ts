'use client';

/**
 * =============================================================================
 * ENTERPRISE: useBuildingForm Hook
 * =============================================================================
 *
 * Form state management hook for AddBuildingDialog.
 * Follows useProjectForm pattern for consistency.
 *
 * Features:
 * - Type-safe form data management
 * - Validation with i18n error messages
 * - Integration with createBuilding service
 * - Toast notifications for feedback
 *
 * @enterprise Fortune 500-grade form handling
 * @created 2026-02-01
 */

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { createBuilding } from '../building-services';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  BuildingType,
  BuildingPriority,
  EnergyClass,
} from '@/types/building/contracts';

// =============================================================================
// TYPES
// =============================================================================

export type BuildingStatus = 'planning' | 'construction' | 'completed' | 'active';
export type BuildingCategory = 'residential' | 'commercial' | 'industrial' | 'mixed';

export interface BuildingFormData {
  // Tab 1: Basic Info
  name: string;
  projectId: string;
  status: BuildingStatus;
  category: BuildingCategory | '';
  description: string;
  // Tab 2: Details
  address: string;
  city: string;
  totalArea: number | '';
  builtArea: number | '';
  floors: number | '';
  units: number | '';
  totalValue: number | '';
  startDate: string;
  completionDate: string;
  // Tab 3: Features
  hasParking: boolean;
  hasElevator: boolean;
  hasGarden: boolean;
  hasPool: boolean;
  accessibility: boolean;
  energyClass: EnergyClass | '';
  type: BuildingType | '';
  priority: BuildingPriority | '';
}

const INITIAL_FORM_DATA: BuildingFormData = {
  // Tab 1: Basic Info
  name: '',
  projectId: '',
  status: 'planning',
  category: '',
  description: '',
  // Tab 2: Details
  address: '',
  city: '',
  totalArea: '',
  builtArea: '',
  floors: '',
  units: '',
  totalValue: '',
  startDate: '',
  completionDate: '',
  // Tab 3: Features
  hasParking: false,
  hasElevator: false,
  hasGarden: false,
  hasPool: false,
  accessibility: false,
  energyClass: '',
  type: '',
  priority: '',
};

interface UseBuildingFormProps {
  onBuildingAdded?: () => void;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName?: string;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useBuildingForm({
  onBuildingAdded,
  onOpenChange,
  companyId,
  companyName,
}: UseBuildingFormProps) {
  const { t } = useTranslation('building');

  const [formData, setFormData] = useState<BuildingFormData>(INITIAL_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof BuildingFormData, string>>>({});

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof BuildingFormData, string>> = {};

    // Required: name
    if (!formData.name.trim()) {
      newErrors.name = t('validation.nameRequired');
    }

    // Required: address
    if (!formData.address.trim()) {
      newErrors.address = t('dialog.validation.addressRequired');
    }

    // Validate area if provided
    if (formData.totalArea !== '' && formData.totalArea <= 0) {
      newErrors.totalArea = t('validation.areaPositive');
    }

    // Validate builtArea doesn't exceed totalArea
    if (
      formData.builtArea !== '' &&
      formData.totalArea !== '' &&
      formData.builtArea > formData.totalArea
    ) {
      newErrors.builtArea = t('validation.builtAreaExceeds');
    }

    // Validate floors if provided
    if (formData.floors !== '' && formData.floors < 1) {
      newErrors.floors = t('validation.floorsMinimum');
    }

    // Validate units if provided
    if (formData.units !== '' && formData.units < 1) {
      newErrors.units = t('validation.unitsMinimum');
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
        const result = await createBuilding({
          name: formData.name,
          description: formData.description || undefined,
          address: formData.address,
          city: formData.city || undefined,
          totalArea: formData.totalArea !== '' ? formData.totalArea : undefined,
          builtArea: formData.builtArea !== '' ? formData.builtArea : undefined,
          floors: formData.floors !== '' ? formData.floors : undefined,
          units: formData.units !== '' ? formData.units : undefined,
          totalValue: formData.totalValue !== '' ? formData.totalValue : undefined,
          startDate: formData.startDate || undefined,
          completionDate: formData.completionDate || undefined,
          status: formData.status,
          projectId: formData.projectId || null,
          companyId: companyId,
          company: companyName,
        });

        if (result.success) {
          toast.success(t('dialog.messages.success'));
          setFormData(INITIAL_FORM_DATA);
          onBuildingAdded?.();
          onOpenChange(false);
        } else {
          toast.error(result.error || t('dialog.messages.error'));
        }
      } catch {
        toast.error(t('dialog.messages.error'));
      } finally {
        setLoading(false);
      }
    },
    [formData, validate, t, onBuildingAdded, onOpenChange, companyId, companyName]
  );

  // ==========================================================================
  // CHANGE HANDLERS
  // ==========================================================================

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      // Clear error on change
      if (errors[name as keyof BuildingFormData]) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    },
    [errors]
  );

  const handleSelectChange = useCallback(
    (name: keyof BuildingFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    },
    [errors]
  );

  const handleCheckboxChange = useCallback(
    (name: keyof BuildingFormData, checked: boolean) => {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    },
    []
  );

  const handleNumberChange = useCallback(
    (name: keyof BuildingFormData, value: string) => {
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
    setFormData,
    loading,
    errors,
    handleSubmit,
    handleChange,
    handleSelectChange,
    handleCheckboxChange,
    handleNumberChange,
    resetForm,
  };
}

export default useBuildingForm;
