import { useMemo, useEffect, useRef } from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface UseContactLivePreviewProps {
  formData: ContactFormData;
  editContact?: Contact | null;
  isModalOpen?: boolean;
  onLiveChange?: (updatedContact: Contact) => void;
}

// ============================================================================
// 🔥 EXTRACTED: LIVE PREVIEW FUNCTIONALITY
// ============================================================================

/**
 * Live Preview Hook - Specialized για real-time contact preview
 *
 * Extracted από useContactForm για Single Responsibility Principle.
 * Χειρίζεται μόνο τη live preview λειτουργικότητα.
 *
 * Features:
 * - Real-time contact data mapping
 * - Optimized memoization to prevent infinite loops
 * - Debounced updates for performance
 * - Stale closure protection with useRef
 */
export function useContactLivePreview({
  formData,
  editContact,
  isModalOpen,
  onLiveChange
}: UseContactLivePreviewProps) {

  // ========================================================================
  // LIVE PREVIEW STATE MANAGEMENT
  // ========================================================================

  // 🔧 FIX: Create a ref to track if we should enable live preview
  const shouldEnableLivePreview = Boolean(onLiveChange && editContact && isModalOpen);

  const livePreviewContact = useMemo(() => {
    if (!shouldEnableLivePreview) {
      return null;
    }

    try {
      // Create a temporary contact with updated data
      const updatedContact: Contact = {
        ...editContact!,
        // Map form data back to contact properties
        type: formData.type,
        firstName: formData.firstName,
        lastName: formData.lastName,
        companyName: formData.companyName,
        serviceName: formData.serviceName,

        // 🏢 ΓΕΜΗ & Company Information
        vatNumber: formData.vatNumber || formData.afm || editContact?.vatNumber || '',
        gemiNumber: formData.gemiNumber,
        legalForm: formData.legalForm || undefined,
        gemiStatus: formData.gemiStatus,
        distintiveTitle: formData.distintiveTitle,
        kadCode: formData.kadCode,
        activityDescription: formData.activityDescription,
        activityType: formData.activityType,
        chamber: formData.chamber,

        // 💰 Capital & Financial
        capital: formData.capital,
        currency: formData.currency,
        extrabalanceCapital: formData.extrabalanceCapital,

        // 📧 Contact Information - Keep existing structure
        emails: editContact!.emails,
        phones: editContact!.phones,

        // Other fields that should be updated live...
      };

      return updatedContact;
    } catch (error) {
      console.error('❌ LIVE PREVIEW: Failed to create live contact:', error);
      return null;
    }
  }, [
    // 🎯 Only track form fields and essential flags
    shouldEnableLivePreview,
    formData.type,
    formData.firstName,
    formData.lastName,
    formData.companyName,
    formData.serviceName,
    formData.vatNumber,
    formData.gemiNumber,
    formData.legalForm,
    formData.gemiStatus,
    formData.distintiveTitle,
    formData.kadCode,
    formData.activityDescription,
    formData.activityType,
    formData.chamber,
    formData.capital,
    formData.currency,
    formData.extrabalanceCapital,
    editContact?.id // Track only ID to prevent deep comparison
  ]);

  // 🔧 FIX: Use ref to store onLiveChange to prevent it from changing dependencies
  const onLiveChangeRef = useRef(onLiveChange);
  onLiveChangeRef.current = onLiveChange;

  // ========================================================================
  // DEBOUNCED LIVE PREVIEW UPDATES
  // ========================================================================

  /**
   * Call onLiveChange when livePreviewContact changes (with debounce to prevent excessive calls)
   */
  useEffect(() => {
    if (!livePreviewContact || !onLiveChangeRef.current) {
      return;
    }

    // Debounce the onLiveChange call to prevent excessive updates
    const timeoutId = setTimeout(() => {
      onLiveChangeRef.current!(livePreviewContact);
    }, 100); // 100ms debounce for stability

    return () => {
      clearTimeout(timeoutId);
    };
  }, [livePreviewContact]); // 🎯 Only depend on livePreviewContact, not onLiveChange

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    shouldEnableLivePreview,
    livePreviewContact
  };
}
