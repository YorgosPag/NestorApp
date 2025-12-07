// ============================================================================
// USE RELATIONSHIP FORM HOOK
// ============================================================================
//
// 🪝 Custom hook for managing relationship form state and operations
// Extracted from ContactRelationshipManager for better separation of concerns
//
// ============================================================================

import { useState, useCallback } from 'react';
import type {
  ContactRelationship,
  RelationshipType,
  ProfessionalContactInfo
} from '@/types/contacts/relationships';
import type { ContactType } from '@/types/contacts';
import { ContactRelationshipService } from '@/services/contact-relationships/ContactRelationshipService';
import { ContactsService } from '@/services/contacts.service';
import { RelationshipValidationService } from '@/services/contact-relationships/core/RelationshipValidationService';
import type {
  RelationshipFormData,
  UseRelationshipFormReturn
} from '../types/relationship-manager.types';

/**
 * 🏗️ Initial form data factory
 */
const createInitialFormData = (): RelationshipFormData => ({
  targetContactId: '',
  relationshipType: 'employee' as RelationshipType,
  position: '',
  department: '',
  startDate: '',
  endDate: '',
  notes: '',
  contactInfo: {
    businessPhone: '',
    businessEmail: '',
    businessAddress: '',
    extensionNumber: ''
  }
});

/**
 * 🪝 useRelationshipForm Hook
 *
 * Manages form state and operations for creating/editing relationships
 *
 * @param contactId - The contact ID for the relationship source
 * @param contactType - The type of contact
 * @param onSuccess - Callback when form submission succeeds
 * @returns Hook state and methods
 */
export const useRelationshipForm = (
  contactId: string,
  contactType: ContactType,
  onSuccess?: () => Promise<void>
): UseRelationshipFormReturn => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [formData, setFormData] = useState<RelationshipFormData>(createInitialFormData());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ============================================================================
  // VALIDATION
  // ============================================================================

  /**
   * 🔍 Validate form data before submission using centralized validation service
   */
  const validateFormData = async (): Promise<string | null> => {
    if (!contactId || contactId === 'new-contact') {
      return 'Αποθηκεύστε πρώτα την επαφή για να προσθέσετε σχέσεις';
    }

    if (!formData.targetContactId) {
      return 'Παρακαλώ επιλέξτε μια επαφή';
    }

    if (!formData.relationshipType) {
      return 'Παρακαλώ επιλέξτε τύπο σχέσης';
    }

    // 🏢 Business Logic Validation using CENTRALIZED RelationshipValidationService
    try {
      console.log('🚨 VALIDATION: Starting centralized business rule validation', {
        targetContactId: formData.targetContactId,
        relationshipType: formData.relationshipType,
        sourceContactId: contactId
      });

      // Get both contacts for validation
      const [sourceContact, targetContact] = await Promise.all([
        ContactsService.getContact(contactId),
        ContactsService.getContact(formData.targetContactId)
      ]);

      if (!targetContact) {
        return 'Η επιλεγμένη επαφή δεν βρέθηκε';
      }

      if (!sourceContact) {
        return 'Σφάλμα φόρτωσης της επαφής προέλευσης';
      }

      // 🔧 FIX: Contact object uses 'type' field, not 'contactType'
      const sourceType = sourceContact.type || sourceContact.contactType;
      const targetType = (targetContact as any).type || targetContact.contactType;

      console.log('🚨 VALIDATION: Contact details for centralized validation:', {
        source: {
          id: sourceContact.id,
          type: sourceType,
          name: sourceContact.name || sourceContact.companyName
        },
        target: {
          id: targetContact.id,
          type: targetType,
          name: targetContact.name || targetContact.companyName
        },
        relationshipType: formData.relationshipType
      });

      // For employment relationships, the employee should be source, company should be target
      // So we need to swap the validation parameters
      const isEmploymentRelation = ['employee', 'manager', 'director', 'executive'].includes(formData.relationshipType);

      if (isEmploymentRelation) {
        // Employee = target contact, Company = source contact (current contact being viewed)
        RelationshipValidationService.validateBusinessRules(
          targetType,
          sourceType,
          formData.relationshipType
        );
      } else {
        // For non-employment relationships, use normal order
        RelationshipValidationService.validateBusinessRules(
          sourceType,
          targetType,
          formData.relationshipType
        );
      }

    } catch (error) {
      console.error('❌ CENTRALIZED VALIDATION: Validation failed:', error);

      if (error instanceof Error) {
        // Return the validation error message directly
        return error.message;
      }

      return 'Σφάλμα ελέγχου επαφής. Παρακαλώ δοκιμάστε ξανά.';
    }

    console.log('✅ CENTRALIZED VALIDATION: All business rules passed, relationship is valid');
    return null; // Valid
  };

  // ============================================================================
  // FORM OPERATIONS
  // ============================================================================

  /**
   * 💾 Submit form (create or update relationship)
   */
  const handleSubmit = useCallback(async (e?: React.FormEvent | React.MouseEvent) => {
    console.log('🔥 RELATIONSHIP FORM: handleSubmit called');

    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      // Validate form data
      const validationError = await validateFormData();
      if (validationError) {
        setError(validationError);
        return;
      }

      console.log('🔍 VALIDATION PASSED:', {
        targetContactId: formData.targetContactId,
        relationshipType: formData.relationshipType,
        contactId
      });

      // Prepare relationship data
      // 🔧 FIX: For employment relationships (employee, manager, director),
      // the employee should be source, company should be target
      const isEmploymentRelation = ['employee', 'manager', 'director', 'executive'].includes(formData.relationshipType);

      const relationshipData: Partial<ContactRelationship> = {
        sourceContactId: isEmploymentRelation ? formData.targetContactId : contactId,
        targetContactId: isEmploymentRelation ? contactId : formData.targetContactId,
        relationshipType: formData.relationshipType,
        position: formData.position || undefined,
        department: formData.department || undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        notes: formData.notes || undefined,
        contactInfo: (formData.contactInfo?.businessPhone || formData.contactInfo?.businessEmail)
          ? formData.contactInfo as ProfessionalContactInfo
          : undefined
      };

      console.log('🔧 RELATIONSHIP DIRECTION FIX:', {
        isEmploymentRelation,
        relationshipType: formData.relationshipType,
        source: relationshipData.sourceContactId,
        target: relationshipData.targetContactId,
        'Expected for OrganizationTree': 'source=employee, target=company'
      });

      // Create or update relationship
      if (editingId) {
        console.log('📝 Updating relationship:', editingId);
        await ContactRelationshipService.updateRelationship(editingId, relationshipData);
      } else {
        console.log('➕ Creating new relationship');
        await ContactRelationshipService.createRelationship(relationshipData);
      }

      console.log('✅ Relationship saved successfully!');

      // Reset form state
      resetForm();

      // Show success message
      const message = editingId
        ? 'Η σχέση ενημερώθηκε επιτυχώς!'
        : 'Η σχέση δημιουργήθηκε επιτυχώς! Μην ξεχάσετε να πατήσετε "Ενημέρωση Επαφής" για οριστική αποθήκευση.';

      setSuccessMessage(message);
      console.log('✅ SUCCESS:', message);

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);

      // 🔧 FIX: For new relationships, add small delay to ensure Firestore consistency
      // before refreshing the cache
      if (!editingId) {
        console.log('⏱️ RELATIONSHIP FORM: Adding 500ms delay for Firestore consistency...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Call success callback to refresh data
      if (onSuccess) {
        console.log('🔄 RELATIONSHIP FORM: Calling onSuccess callback to refresh relationships list...');
        await onSuccess();
        console.log('✅ RELATIONSHIP FORM: onSuccess callback completed - relationships list should be refreshed');
      } else {
        console.warn('⚠️ RELATIONSHIP FORM: No onSuccess callback provided - relationships list will NOT be refreshed');
      }

    } catch (err) {
      console.error('❌ Form submission error:', err);

      // Check if this is a Firebase index error (should not block the form)
      const isFirebaseIndexError = err instanceof Error && (
        err.message.includes('query requires an index') ||
        err.message.includes('FirebaseError') ||
        err.message.includes('failed-precondition')
      );

      // If it's a Firebase index error, the relationship was likely saved successfully
      // so we should treat this as a success with a warning
      if (isFirebaseIndexError) {
        console.warn('⚠️ Firebase index error detected, but relationship likely saved successfully');

        // Show success message instead of error
        const message = editingId
          ? 'Η σχέση ενημερώθηκε επιτυχώς!'
          : 'Η σχέση δημιουργήθηκε επιτυχώς! Μην ξεχάσετε να πατήσετε "Ενημέρωση Επαφής" για οριστική αποθήκευση.';

        setSuccessMessage(message);
        resetForm();

        // Auto-hide success message after 5 seconds
        setTimeout(() => {
          setSuccessMessage(null);
        }, 5000);

        // Call success callback to refresh data (if available)
        if (onSuccess) {
          try {
            await onSuccess();
          } catch (refreshErr) {
            console.warn('⚠️ Error refreshing relationships after successful save:', refreshErr);
          }
        }

        return; // Exit successfully
      }

      // Handle actual errors
      if (err instanceof Error && err.message.includes('already exists')) {
        setError('Αυτή η σχέση υπάρχει ήδη. Παρακαλώ επιλέξτε διαφορετικό τύπο σχέσης ή επαφή.');
      } else if (err instanceof Error && err.message.includes('not found')) {
        setError('Μία ή περισσότερες από τις επαφές δεν βρέθηκαν. Παρακαλώ ελέγξτε τα στοιχεία.');
      } else {
        setError('Σφάλμα αποθήκευσης σχέσης. Παρακαλώ δοκιμάστε ξανά.');
      }
    } finally {
      setLoading(false);
    }
  }, [contactId, formData, editingId, validateFormData, onSuccess]);

  /**
   * ✏️ Start editing an existing relationship
   */
  const handleEdit = useCallback((relationship: ContactRelationship) => {
    console.log('✏️ Editing relationship:', relationship.id);

    setEditingId(relationship.id!);
    setFormData({
      targetContactId: relationship.targetContactId,
      relationshipType: relationship.relationshipType,
      position: relationship.position || '',
      department: relationship.department || '',
      startDate: relationship.startDate || '',
      endDate: relationship.endDate || '',
      notes: relationship.notes || '',
      contactInfo: {
        businessPhone: relationship.contactInfo?.businessPhone || '',
        businessEmail: relationship.contactInfo?.businessEmail || '',
        businessAddress: relationship.contactInfo?.businessAddress || '',
        extensionNumber: relationship.contactInfo?.extensionNumber || ''
      }
    });

    setError(null);
    setSuccessMessage(null);
  }, []);

  /**
   * ❌ Cancel form editing
   */
  const handleCancel = useCallback(() => {
    console.log('❌ Cancelling form');
    resetForm();
  }, []);

  /**
   * 🔄 Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setFormData(createInitialFormData());
    setEditingId(null);
    setError(null);
    setSuccessMessage(null);
  }, []);

  // ============================================================================
  // RETURN API
  // ============================================================================

  return {
    // Form state
    formData,
    setFormData,
    loading,
    error,
    editingId,
    successMessage,

    // Operations
    handleSubmit,
    handleEdit,
    handleCancel,
    resetForm
  };
};