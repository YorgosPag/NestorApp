import { useMemo, useEffect, useRef } from 'react';
import type { Contact, CompanyContact, IndividualContact, ServiceContact } from '@/types/contacts';
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
      const existingContact = editContact as Contact;

      if (formData.type === 'company') {
        const vatNumber = (
          formData.vatNumber ||
          formData.afm ||
          formData.companyVatNumber ||
          (existingContact.type === 'company' ? existingContact.vatNumber : '')
        );

        const updatedContact: CompanyContact = {
          ...existingContact,
          type: 'company',
          companyName: formData.companyName,
          vatNumber,
          legalForm: formData.legalForm || undefined,
          taxOffice:
            formData.taxOffice ||
            (existingContact.type === 'company' ? existingContact.taxOffice : undefined),
          registrationNumber:
            formData.gemiNumber ||
            (existingContact.type === 'company' ? existingContact.registrationNumber : undefined),
          emails: existingContact.emails,
          phones: existingContact.phones
        };

        return updatedContact;
      }

      if (formData.type === 'service') {
        const updatedContact: ServiceContact = {
          ...existingContact,
          type: 'service',
          serviceName: formData.serviceName,
          serviceType: formData.serviceType,
          emails: existingContact.emails,
          phones: existingContact.phones
        };

        return updatedContact;
      }

      const updatedContact: IndividualContact = {
        ...existingContact,
        type: 'individual',
        firstName: formData.firstName,
        lastName: formData.lastName,
        vatNumber:
          formData.vatNumber ||
          formData.afm ||
          (existingContact.type === 'individual' ? existingContact.vatNumber : undefined),
        emails: existingContact.emails,
        phones: existingContact.phones
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
    formData.serviceType,
    formData.vatNumber,
    formData.companyVatNumber,
    formData.afm,
    formData.gemiNumber,
    formData.legalForm,
    formData.taxOffice,
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
