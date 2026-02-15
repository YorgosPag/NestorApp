'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: useProjectForm Hook
 * =============================================================================
 *
 * Form state management hook for AddProjectDialog.
 * Follows TabbedAddNewContactDialog pattern for consistency.
 *
 * Features:
 * - Type-safe form data management
 * - Validation with i18n error messages
 * - Integration with createProject/updateProject services
 * - Toast notifications for feedback
 * - Edit mode support (ADR-087)
 *
 * @enterprise Fortune 500-grade form handling
 * @created 2026-02-01
 */

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { createProject } from '@/services/projects-client.service';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  ProjectStatus,
  ProjectType,
  ProjectPriority,
  ProjectRiskLevel,
  ProjectComplexity
} from '@/types/project';
import type { ProjectAddress } from '@/types/project/addresses';
import {
  createProjectAddress,
  extractLegacyFields,
} from '@/types/project/address-helpers';

// =============================================================================
// TYPES
// =============================================================================

export interface ProjectFormData {
  // Βασικά πεδία
  name: string;
  title: string;
  status: ProjectStatus;
  companyId: string;
  company: string;
  address: string;
  city: string;
  description: string;
  // 🏢 ENTERPRISE: Multi-address support (ADR-167)
  addresses: ProjectAddress[];
  // Λεπτομέρειες
  location: string;
  client: string;
  type: ProjectType | '';
  priority: ProjectPriority | '';
  riskLevel: ProjectRiskLevel | '';
  complexity: ProjectComplexity | '';
  budget: number | '';
  totalValue: number | '';
  totalArea: number | '';
  duration: number | '';
  startDate: string;
  completionDate: string;
  // Χαρακτηριστικά (booleans)
  hasPermits: boolean;
  hasFinancing: boolean;
  isEcological: boolean;
  hasSubcontractors: boolean;
  isActive: boolean;
  hasIssues: boolean;
}

const INITIAL_FORM_DATA: ProjectFormData = {
  name: '',
  title: '',
  status: 'planning',
  companyId: '',
  company: '',
  address: '',
  city: '',
  description: '',
  addresses: [],
  location: '',
  client: '',
  type: '',
  priority: '',
  riskLevel: '',
  complexity: '',
  budget: '',
  totalValue: '',
  totalArea: '',
  duration: '',
  startDate: '',
  completionDate: '',
  hasPermits: false,
  hasFinancing: false,
  isEcological: false,
  hasSubcontractors: false,
  isActive: true,
  hasIssues: false,
};

interface UseProjectFormProps {
  onProjectAdded?: () => void;
  onOpenChange: (open: boolean) => void;
}

// =============================================================================
// HOOK IMPLEMENTATION (CREATE-ONLY — edit moved to inline GeneralProjectTab)
// =============================================================================

export function useProjectForm({ onProjectAdded, onOpenChange }: UseProjectFormProps) {
  const { t } = useTranslation('projects');

  const [formData, setFormData] = useState<ProjectFormData>(INITIAL_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectFormData, string>>>({});

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof ProjectFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('dialog.validation.nameRequired');
    }
    if (!formData.companyId) {
      newErrors.companyId = t('dialog.validation.companyRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, t]);

  // ==========================================================================
  // SUBMIT HANDLER
  // ==========================================================================

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      // 🏢 ENTERPRISE: CREATE-ONLY — edit moved to inline GeneralProjectTab
      const result = await createProject({
        name: formData.name,
        title: formData.title || formData.name,
        status: formData.status,
        companyId: formData.companyId,
        company: formData.company,
        address: formData.address,
        city: formData.city,
        description: formData.description,
        // 🏢 ENTERPRISE: Include addresses if any (ADR-167)
        ...(formData.addresses.length > 0 && { addresses: formData.addresses }),
      });

      if (result.success) {
        toast.success(t('dialog.messages.success'));
        setFormData(INITIAL_FORM_DATA);
        onProjectAdded?.();
        onOpenChange(false);
      } else {
        toast.error(result.error || t('dialog.messages.error'));
      }
    } catch {
      toast.error(t('dialog.messages.error'));
    } finally {
      setLoading(false);
    }
  }, [formData, validate, t, onProjectAdded, onOpenChange]);

  // ==========================================================================
  // CHANGE HANDLERS
  // ==========================================================================

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error on change
    if (errors[name as keyof ProjectFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const handleSelectChange = useCallback((name: keyof ProjectFormData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const handleCheckboxChange = useCallback((name: keyof ProjectFormData, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  }, []);

  const handleNumberChange = useCallback((name: keyof ProjectFormData, value: string) => {
    const numValue = value === '' ? '' : Number(value);
    setFormData(prev => ({ ...prev, [name]: numValue }));
  }, []);

  // ==========================================================================
  // ADDRESS HANDLERS (ADR-167)
  // ==========================================================================

  /**
   * Add new address to project
   * Auto-sync legacy fields from primary address
   */
  const handleAddAddress = useCallback((addressData: Partial<ProjectAddress>) => {
    setFormData(prev => {
      const newAddress = createProjectAddress({
        ...addressData,
        street: addressData.street || '',
        city: addressData.city || '',
        isPrimary: prev.addresses.length === 0, // First address = primary
      });
      const newAddresses = [...prev.addresses, newAddress];
      const legacy = extractLegacyFields(newAddresses);

      return {
        ...prev,
        addresses: newAddresses,
        address: legacy.address,
        city: legacy.city,
      };
    });
  }, []);

  /**
   * Set address as primary
   * Auto-sync legacy fields
   */
  const handleSetPrimary = useCallback((index: number) => {
    setFormData(prev => {
      const newAddresses = prev.addresses.map((addr, i) => ({
        ...addr,
        isPrimary: i === index,
      }));
      const legacy = extractLegacyFields(newAddresses);

      return {
        ...prev,
        addresses: newAddresses,
        address: legacy.address,
        city: legacy.city,
      };
    });
  }, []);

  /**
   * Remove address from project
   * Auto-assign new primary if needed
   */
  const handleRemoveAddress = useCallback((index: number) => {
    setFormData(prev => {
      const newAddresses = prev.addresses.filter((_, i) => i !== index);

      // If removed address was primary and there are remaining addresses,
      // make the first one primary
      if (newAddresses.length > 0 && prev.addresses[index]?.isPrimary) {
        newAddresses[0].isPrimary = true;
      }

      const legacy = extractLegacyFields(newAddresses);

      return {
        ...prev,
        addresses: newAddresses,
        address: legacy.address,
        city: legacy.city,
      };
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
    setFormData,
    loading,
    errors,
    handleSubmit,
    handleChange,
    handleSelectChange,
    handleCheckboxChange,
    handleNumberChange,
    resetForm,
    // 🏢 ENTERPRISE: Address handlers (ADR-167)
    handleAddAddress,
    handleSetPrimary,
    handleRemoveAddress,
  };
}

export default useProjectForm;
