// ============================================================================
// FORM RESET HOOK - ENTERPRISE MODULE
// ============================================================================
//
// 🔄 Form reset logic with proper memory cleanup
// Handles complete form state reset and blob URL cleanup
// Part of modular Enterprise contact form hooks architecture
//
// ============================================================================

import { useCallback } from 'react';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { initialFormData } from '@/types/ContactFormTypes';
import { useMemoryCleanup } from '../files/useMemoryCleanup';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useFormReset');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UseFormResetReturn {
  // Reset functionality
  resetForm: (
    formData: ContactFormData,
    setFormData: (data: ContactFormData) => void
  ) => void;
}

// ============================================================================
// FORM RESET HOOK
// ============================================================================

/**
 * Form reset management hook
 *
 * Provides complete form reset functionality with proper cleanup.
 * Ensures all blob URLs are revoked to prevent memory leaks.
 *
 * Features:
 * - Complete form state reset
 * - Memory cleanup for blob URLs
 * - Proper cleanup before reset
 * - Return to initial state
 */
export function useFormReset(): UseFormResetReturn {
  const { revokeAllBlobUrls } = useMemoryCleanup();

  // ========================================================================
  // RESET FUNCTIONALITY
  // ========================================================================

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback((
    formData: ContactFormData,
    setFormData: (data: ContactFormData) => void
  ) => {
    logger.info('Starting form reset with cleanup');

    // 🧹 CLEANUP: Revoke any blob URLs before reset
    revokeAllBlobUrls(formData);

    logger.info('Memory cleanup completed, resetting to initial state');
    setFormData(initialFormData);

    logger.info('Form reset completed successfully');
  }, [revokeAllBlobUrls]);

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    resetForm
  };
}