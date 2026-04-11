// ============================================================================
// USE RELATIONSHIP FORM HOOK
// ============================================================================
//
// 🪝 Custom hook for managing relationship form state and operations
// Extracted from ContactRelationshipManager for better separation of concerns
//
// ============================================================================

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  ContactRelationship,
  RelationshipType,
  ProfessionalContactInfo
} from '@/types/contacts/relationships';
import type { ContactType, PhoneInfo, EmailInfo } from '@/types/contacts';
import { ContactRelationshipService } from '@/services/contact-relationships/ContactRelationshipService';
import { ContactsService } from '@/services/contacts.service';
import { RelationshipValidationService } from '@/services/contact-relationships/core/RelationshipValidationService';
import {
  createRelationshipWithPolicy,
  updateRelationshipWithPolicy,
} from '@/services/contact-relationships/relationship-mutation-gateway';
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
  relationshipType: '',
  position: '',
  department: '',
  startDate: '',
  endDate: '',
  notes: '',
  contactInfo: {
    businessPhone: '',
    businessEmail: ''
  },
  phones: [],
  emails: []
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

  const { t } = useTranslation('contacts');
  const [formData, setFormData] = useState<RelationshipFormData>(createInitialFormData());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // 🛡️ Ref-based lock to prevent double submission (survives re-renders)
  const isSubmittingRef = useRef(false);

  // ============================================================================
  // VALIDATION
  // ============================================================================

  /**
   * 🔍 Validate form data before submission using centralized validation service
   * 🌐 i18n: All validation messages converted to i18n keys - 2026-01-18
   */
  const validateFormData = async (): Promise<string | null> => {
    if (!contactId || contactId === 'new-contact') {
      return 'relationships.form.validation.contactRequired';
    }

    if (!formData.targetContactId) {
      return 'relationships.form.validation.contactRequired';
    }

    if (!formData.relationshipType) {
      return 'relationships.form.validation.relationshipTypeRequired';
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

      // Cast to RelationshipType for validation (custom types skip business rule checks)
      const relType = formData.relationshipType as RelationshipType;

      if (isEmploymentRelation) {
        // Employee = target contact, Company = source contact (current contact being viewed)
        RelationshipValidationService.validateBusinessRules(
          targetType,
          sourceType,
          relType
        );
      } else {
        // For non-employment relationships, use normal order
        RelationshipValidationService.validateBusinessRules(
          sourceType,
          targetType,
          relType
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
          relType,
          editingId ?? undefined // Exclude current relationship if editing
        );

        logger.info('DUPLICATE VALIDATION: No duplicates found');
      } catch (duplicateError) {
        // 🔧 FIX: Duplicate is a business rule violation, not a system error → warn level
        const dupMessage = duplicateError instanceof Error ? duplicateError.message : String(duplicateError);
        logger.warn('DUPLICATE VALIDATION: Duplicate relationship detected', { data: { message: dupMessage } });

        if (duplicateError instanceof Error) {
          return duplicateError.message;
        }

        return 'relationships.validation.duplicateRelationship';
      }

    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      logger.warn('CENTRALIZED VALIDATION: Business rule violation', { data: { message: errMessage } });

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

    // 🛡️ DOUBLE-SUBMIT GUARD: Prevent concurrent saves
    if (isSubmittingRef.current) {
      logger.warn('SUBMIT BLOCKED: Already submitting — ignoring duplicate call');
      return;
    }
    isSubmittingRef.current = true;

    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      // Validate form data
      const validationError = await validateFormData();
      if (validationError) {
        setError(t(validationError, { defaultValue: validationError }));
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

      // Build contactInfo from centralized phones/emails arrays (backward compat)
      const primaryPhone = formData.phones?.find(p => p.isPrimary) || formData.phones?.[0];
      const primaryEmail = formData.emails?.find(e => e.isPrimary) || formData.emails?.[0];
      const builtContactInfo: Partial<ProfessionalContactInfo> = {
        ...formData.contactInfo,
        businessPhone: primaryPhone
          ? `${primaryPhone.countryCode || '+30'} ${primaryPhone.number}`.trim()
          : formData.contactInfo?.businessPhone ?? undefined,
        businessEmail: primaryEmail?.email || (formData.contactInfo?.businessEmail ?? undefined)
      };

      const hasContactInfo = builtContactInfo.businessPhone || builtContactInfo.businessEmail;

      const relationshipData: Partial<ContactRelationship> = {
        sourceContactId: isEmploymentRelation ? formData.targetContactId : contactId,
        targetContactId: isEmploymentRelation ? contactId : formData.targetContactId,
        relationshipType: formData.relationshipType as RelationshipType,
        position: formData.position || null,
        department: formData.department || null,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        notes: formData.notes || null,
        contactInfo: hasContactInfo
          ? builtContactInfo as ProfessionalContactInfo
          : null
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
        await updateRelationshipWithPolicy({
          relationshipId: editingId,
          updates: relationshipData,
        });
      } else {
        await createRelationshipWithPolicy({
          data: relationshipData,
        });
      }

      // Reset form state
      resetForm();

      // Show success message
      const successText = editingId
        ? t('relationships.status.updateSuccess', { defaultValue: t('relationships.manager.addRelationship') })
        : t('relationships.status.createSuccess', { defaultValue: t('relationships.manager.addRelationship') });

      setSuccessMessage(successText);
      logger.info('SUCCESS:', { data: successText });

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
        const successText = editingId
          ? t('relationships.status.updateSuccess', { defaultValue: t('relationships.manager.addRelationship') })
          : t('relationships.status.createSuccess', { defaultValue: t('relationships.manager.addRelationship') });

        setSuccessMessage(successText);
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
      // 🔧 FIX: Show the ACTUAL error message, not a generic one
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('SAVE FAILED — actual error:', { error: errorMessage });

      if (errorMessage.includes('already exists')) {
        setError(t('relationships.errors.alreadyExists', { defaultValue: errorMessage }));
      } else if (errorMessage.includes('not found')) {
        setError(t('relationships.errors.contactsNotFound', { defaultValue: errorMessage }));
      } else {
        // Show actual error for debugging — not generic "σφάλμα φόρμας"
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  }, [contactId, formData, editingId, validateFormData, onSuccess, t]);

  /**
   * ✏️ Start editing an existing relationship
   */
  const handleEdit = useCallback((relationship: ContactRelationship) => {
    logger.info('Editing relationship:', { data: relationship.id });

    setEditingId(relationship.id!);

    // Build phones array from existing contactInfo for backward compatibility
    const existingPhones: PhoneInfo[] = [];
    if (relationship.contactInfo?.businessPhone) {
      existingPhones.push({
        number: relationship.contactInfo.businessPhone,
        type: 'work',
        isPrimary: true,
        label: '',
        countryCode: '+30'
      });
    }

    // Build emails array from existing contactInfo
    const existingEmails: EmailInfo[] = [];
    if (relationship.contactInfo?.businessEmail) {
      existingEmails.push({
        email: relationship.contactInfo.businessEmail,
        type: 'work',
        isPrimary: true,
        label: ''
      });
    }

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
        businessEmail: relationship.contactInfo?.businessEmail || ''
      },
      phones: existingPhones,
      emails: existingEmails
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
