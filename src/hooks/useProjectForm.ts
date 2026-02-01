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
import { createProject, updateProjectClient } from '@/services/projects-client.service';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  Project,
  ProjectStatus,
  ProjectType,
  ProjectPriority,
  ProjectRiskLevel,
  ProjectComplexity
} from '@/types/project';

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
  /** 🏢 ENTERPRISE: Project to edit (null for new project) - ADR-087 */
  editProject?: Project | null;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useProjectForm({ onProjectAdded, onOpenChange, editProject }: UseProjectFormProps) {
  const { t } = useTranslation('projects');

  const [formData, setFormData] = useState<ProjectFormData>(INITIAL_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectFormData, string>>>({});

  // 🏢 ENTERPRISE: Edit mode detection (ADR-087)
  const isEditMode = !!editProject;

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
      // 🏢 ENTERPRISE: Use update for edit mode, create for new (ADR-087)
      if (isEditMode && editProject?.id) {
        const result = await updateProjectClient(editProject.id, {
          name: formData.name,
          title: formData.title || formData.name,
          status: formData.status,
          address: formData.address,
          city: formData.city,
          description: formData.description,
        });

        if (result.success) {
          toast.success(t('messages.updated'));
          setFormData(INITIAL_FORM_DATA);
          onProjectAdded?.();
          onOpenChange(false);
        } else {
          toast.error(result.error || t('dialog.messages.error'));
        }
      } else {
        // Create new project
        const result = await createProject({
          name: formData.name,
          title: formData.title || formData.name,
          status: formData.status,
          companyId: formData.companyId,
          company: formData.company,
          address: formData.address,
          city: formData.city,
          description: formData.description,
        });

        if (result.success) {
          toast.success(t('dialog.messages.success'));
          setFormData(INITIAL_FORM_DATA);
          onProjectAdded?.();
          onOpenChange(false);
        } else {
          toast.error(result.error || t('dialog.messages.error'));
        }
      }
    } catch {
      toast.error(t('dialog.messages.error'));
    } finally {
      setLoading(false);
    }
  }, [formData, validate, t, onProjectAdded, onOpenChange, isEditMode, editProject]);

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

export default useProjectForm;
