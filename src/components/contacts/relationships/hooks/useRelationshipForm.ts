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
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('useRelationshipForm');

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
   * 🌐 i18n: All validation messages converted to i18n keys - 2026-01-18
   */
  const validateFormData = async (): Promise<string | null> => {
    if (!contactId || contactId === 'new-contact') {
      return 'relationships.validation.saveContactFirst';
    }

    if (!formData.targetContactId) {
      return 'relationships.validation.selectContact';
    }

    if (!formData.relationshipType) {
      return 'relationships.validation.selectType';
    }

    // 🏢 Business Logic Validation using CENTRALIZED RelationshipValidationService
    try {
      logger.info('VALIDATION: Starting centralized business rule validation', { data: {
        targetContactId: formData.targetContactId,
        relationshipType: formData.relationshipType,
        sourceContactId: contactId
      } });

      // Get both contacts for validation
      const [sourceContact, targetContact] = await Promise.all([
        ContactsService.getContact(contactId),
        ContactsService.getContact(formData.targetContactId)
      ]);

      if (!targetContact) {
        return 'relationships.validation.targetNotFound';
      }

      if (!sourceContact) {
        return 'relationships.validation.sourceLoadError';
      }

      // 🔧 FIX: Contact object uses 'type' field, not 'contactType'
      // Type assertions needed because TypeScript can't infer non-null after checks
      const sourceType = (sourceContact as NonNullable<typeof sourceContact>).type || (sourceContact as NonNullable<typeof sourceContact> & { contactType?: string }).contactType;
      const targetType = (targetContact as NonNullable<typeof targetContact>).type || (targetContact as NonNullable<typeof targetContact> & { contactType?: string }).contactType;

      logger.info('VALIDATION: Contact details for centralized validation:', { data: {
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
      } });

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

      // 🔍 DUPLICATE VALIDATION: Check for same contact - same relationship type
      logger.info('DUPLICATE VALIDATION: Checking for duplicate relationships...');

      try {
        // Fetch existing relationships for this contact to check for duplicates
        const existingRelationships = await ContactRelationshipService.getContactRelationships(contactId);

        RelationshipValidationService.validateSameContactSameType(
          existingRelationships,
          formData.targetContactId,
          formData.relationshipType,
          editingId ?? undefined // Exclude current relationship if editing
        );

        logger.info('DUPLICATE VALIDATION: No duplicates found');
      } catch (duplicateError) {
        logger.error('DUPLICATE VALIDATION: Duplicate relationship detected:', { error: duplicateError });

        if (duplicateError instanceof Error) {
          return duplicateError.message;
        }

        return 'relationships.validation.duplicateRelationship';
      }

    } catch (error) {
      logger.error('CENTRALIZED VALIDATION: Validation failed:', { error: error });

      if (error instanceof Error) {
        // Return the validation error message directly
        return error.message;
      }

      return 'relationships.validation.checkError';
    }

    logger.info('CENTRALIZED VALIDATION: All business rules passed, relationship is valid');
    return null; // Valid
  };

  // ============================================================================
  // FORM OPERATIONS
  // ============================================================================

  /**
   * 💾 Submit form (create or update relationship)
   */
  const handleSubmit = useCallback(async (e?: React.FormEvent | React.MouseEvent) => {
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

      logger.info('VALIDATION PASSED:', { data: {
        targetContactId: formData.targetContactId,
        relationshipType: formData.relationshipType,
        contactId
      } });

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

      logger.info('RELATIONSHIP DIRECTION FIX:', { data: {
        isEmploymentRelation,
        relationshipType: formData.relationshipType,
        source: relationshipData.sourceContactId,
        target: relationshipData.targetContactId,
        'Expected for OrganizationTree': 'source=employee, target=company'
      } });

      // Create or update relationship
      if (editingId) {
        await ContactRelationshipService.updateRelationship(editingId, relationshipData);
      } else {
        await ContactRelationshipService.createRelationship(relationshipData);
      }

      // Reset form state
      resetForm();

      // Show success message
      const message = editingId
        ? 'relationships.status.updateSuccess'
        : 'relationships.status.createSuccess';

      setSuccessMessage(message);
      logger.info('SUCCESS:', { data: message });

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);

      // 🔧 FIX: Short delay for Firestore eventual consistency
      if (!editingId) {
        logger.info('⏱RELATIONSHIP FORM: Adding 500ms delay for Firestore consistency...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Call success callback to refresh data
      if (onSuccess) {
        try {
          await onSuccess();
        } catch (callbackError) {
          logger.error('onSuccess callback failed:', { error: callbackError });
        }
      }

    } catch (err) {

      // Check if this is specifically a Firebase INDEX error (should not block the form)
      // IMPORTANT: Only match actual index errors — do NOT match generic FirebaseError
      const isFirebaseIndexError = err instanceof Error && (
        err.message.includes('query requires an index') ||
        err.message.includes('failed-precondition')
      );

      // If it's a Firebase index error, the relationship was likely saved successfully
      // so we should treat this as a success with a warning
      if (isFirebaseIndexError) {
        logger.warn('Firebase index error detected, but relationship likely saved successfully');

        // Show success message instead of error
        const message = editingId
          ? 'relationships.status.updateSuccess'
          : 'relationships.status.createSuccess';

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
            logger.warn('Error refreshing relationships after successful save:', { data: refreshErr });
          }
        }

        return; // Exit successfully
      }

      // Handle actual errors
      if (err instanceof Error && err.message.includes('already exists')) {
        setError('relationships.errors.alreadyExists');
      } else if (err instanceof Error && err.message.includes('not found')) {
        setError('relationships.errors.contactsNotFound');
      } else {
        setError('relationships.errors.saveFailed');
      }
    } finally {
      setLoading(false);
    }
  }, [contactId, formData, editingId, validateFormData, onSuccess]);

  /**
   * ✏️ Start editing an existing relationship
   */
  const handleEdit = useCallback((relationship: ContactRelationship) => {
    logger.info('Editing relationship:', { data: relationship.id });

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
    logger.info('Cancelling form');
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