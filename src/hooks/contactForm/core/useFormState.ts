// ============================================================================
// FORM STATE CORE HOOK - ENTERPRISE MODULE
// ============================================================================
//
// 🏗️ Basic form state management and field handlers
// Handles primitive form fields, select changes, and nested object updates
// Part of modular Enterprise contact form hooks architecture
//
// ============================================================================

import { useState, useCallback } from 'react';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { initialFormData } from '@/types/ContactFormTypes';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UseFormStateReturn {
  // State
  formData: ContactFormData;
  setFormData: (data: ContactFormData) => void;

  // Field handlers
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleNestedChange: (path: string, value: any) => void;
}

// ============================================================================
// CORE FORM STATE HOOK
// ============================================================================

/**
 * Core form state management hook
 *
 * Handles basic form field state and primitive operations.
 * Focused on simple state management without complex file operations.
 *
 * Features:
 * - Basic form field management
 * - Type-safe field handlers
 * - Nested object field updates
 * - Service name/serviceName field synchronization
 */
export function useFormState(): UseFormStateReturn {
  // ========================================================================
  // STATE
  // ========================================================================

  const [formData, setFormData] = useState<ContactFormData>(initialFormData);

  // ========================================================================
  // FIELD HANDLERS
  // ========================================================================

  /**
   * Handle input/textarea changes
   */
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    setFormData(prev => {
      const newFormData = { ...prev, [name]: value };

      // 🔧 FIX: Service contact serviceName/name field synchronization
      // Το service-config χρησιμοποιεί 'name' ενώ η βάση δεδομένων αποθηκεύει 'serviceName'
      // Συγχρονίζουμε και τα δύο πεδία για compatibility
      if (name === 'serviceName' && prev.type === 'service') {
        newFormData.name = value; // Sync serviceName → name για service-config
      } else if (name === 'name' && prev.type === 'service') {
        newFormData.serviceName = value; // Sync name → serviceName για database
      }

      return newFormData;
    });
  }, []);

  /**
   * Handle select field changes
   */
  const handleSelectChange = useCallback((name: string, value: string) => {
    if (name === 'isBranch') {
      setFormData(prev => ({ ...prev, [name]: value === 'true' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  }, []);

  /**
   * Handle nested object field changes (π.χ. serviceAddress.street)
   */
  const handleNestedChange = useCallback((path: string, value: any) => {
    const keys = path.split('.');
    setFormData(prev => {
      const newFormData = { ...prev };
      let current: any = newFormData;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;

      return newFormData;
    });
  }, []);

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    formData,
    setFormData,
    handleChange,
    handleSelectChange,
    handleNestedChange
  };
}