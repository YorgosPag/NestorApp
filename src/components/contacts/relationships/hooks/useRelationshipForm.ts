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
import { ContactRelationshipService } from '@/services/contact-relationships.service';
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
   * 🔍 Validate form data before submission
   */
  const validateFormData = useCallback((): string | null => {
    if (!contactId || contactId === 'new-contact') {
      return 'Αποθηκεύστε πρώτα την επαφή για να προσθέσετε σχέσεις';
    }

    if (!formData.targetContactId) {
      return 'Παρακαλώ επιλέξτε μια επαφή';
    }

    if (!formData.relationshipType) {
      return 'Παρακαλώ επιλέξτε τύπο σχέσης';
    }

    return null; // Valid
  }, [contactId, formData.targetContactId, formData.relationshipType]);

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
      const validationError = validateFormData();
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
      const relationshipData: Partial<ContactRelationship> = {
        sourceContactId: contactId,
        targetContactId: formData.targetContactId,
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

      // Call success callback to refresh data
      if (onSuccess) {
        await onSuccess();
      }

    } catch (err) {
      console.error('❌ Form submission error:', err);

      // Handle specific error messages
      if (err instanceof Error && err.message.includes('already exists')) {
        setError('Αυτή η σχέση υπάρχει ήδη. Παρακαλώ επιλέξτε διαφορετικό τύπο σχέσης ή επαφή.');
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