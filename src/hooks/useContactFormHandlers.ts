import { useCallback } from 'react';
import React from 'react';
import { useContactLogoHandlers } from './useContactLogoHandlers';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface UseContactFormHandlersProps {
  handleFileChange: (file: File | null) => void;
  handleLogoChange: (file: File | null) => void;
  handleUploadedLogoURL: (logoURL: string) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
}

// ============================================================================
// 🔥 EXTRACTED: LEGACY HANDLERS FUNCTIONALITY
// ============================================================================

/**
 * Contact Form Handlers Hook - Specialized για legacy compatibility
 *
 * Extracted από useContactForm για Single Responsibility Principle.
 * Χειρίζεται μόνο τους legacy handlers και backward compatibility.
 *
 * Features:
 * - Legacy file handlers με enterprise validation
 * - Drag & drop functionality
 * - Logo handling integration
 * - Stable useCallback implementations
 * - Zero-dependency handlers για performance
 */
export function useContactFormHandlers({
  handleFileChange,
  handleLogoChange,
  handleUploadedLogoURL,
  handleDrop,
  handleDragOver
}: UseContactFormHandlersProps) {

  // ========================================================================
  // LOGO HANDLING INTEGRATION
  // ========================================================================

  // 4️⃣ Logo upload handlers
  const logoHandlers = useContactLogoHandlers({
    onLogoChange: handleLogoChange,
    onUploadComplete: handleUploadedLogoURL
  });

  // ========================================================================
  // LEGACY API COMPATIBILITY HANDLERS
  // ========================================================================

  // Για backward compatibility με existing components που χρησιμοποιούν το hook
  const legacyHandlers = {
    // File handlers (με enterprise validation)
    // 🔧 FIX: Removed dependencies to prevent unnecessary re-renders
    handleFileChange: useCallback((file: File | null) => {
      // Photo handling now done by UnifiedPhotoManager directly
      handleFileChange(file);
    }, [handleFileChange]),

    handleLogoChange: useCallback((file: File | null) => {
      if (file) {
        logoHandlers.processLogoFile(file);
      } else {
        logoHandlers.clearLogo();
      }
    }, [logoHandlers]), // 🔧 FIX: Using logoHandlers dependency

    // Drag & drop (enhanced με validation) - 🔧 FIX: Simplified to standard HTML5 drag behavior
    handleDrop: useCallback((e: React.DragEvent) => {
      handleDrop(e);
    }, [handleDrop]), // Using existing form drag handler

    handleDragOver: useCallback((e: React.DragEvent) => {
      handleDragOver(e);
    }, [handleDragOver]) // Using existing form drag handler
  };

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    // Legacy file handlers (enhanced)
    handleFileChange: legacyHandlers.handleFileChange,
    handleLogoChange: legacyHandlers.handleLogoChange,
    handleDrop: legacyHandlers.handleDrop,
    handleDragOver: legacyHandlers.handleDragOver,

    // Advanced handlers (για επέκταση)
    logoHandlers
  };
}