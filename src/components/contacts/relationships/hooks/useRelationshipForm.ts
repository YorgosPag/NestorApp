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
import { useAuth } from '@/auth/hooks/useAuth';
import type {
  ContactRelationship,
  RelationshipType
} from '@/types/contacts/relationships';
import type { ContactType } from '@/types/contacts';
import { ContactRelationshipService } from '@/services/contact-relationships/ContactRelationshipService';
import { ContactsService } from '@/services/contacts.service';
import { RelationshipValidationService } from '@/services/contact-relationships/core/RelationshipValidationService';
import {
  encodeOrientedRole,
  isRelationshipType,
  orientedRoleOf,
  otherContactIdOf,
} from '@/types/contacts/relationships/core/relationship-orientation';
import {
  describeValidationError,
  orientFormRole,
  translateValidationMessage,
  type ValidationMessage,
} from './relationship-form-orientation';
import {
  createRelationshipWithPolicy,
  updateRelationshipWithPolicy,
} from '@/services/contact-relationships/relationship-mutation-gateway';
import type {
  RelationshipFormData,
  UseRelationshipFormReturn
} from '../types/relationship-manager.types';
import {
  compactChannels,
  projectContactInfo,
  relationshipCalendarDay,
  relationshipEmailsOf,
  relationshipPhonesOf,
} from '@/services/contact-relationships/core/relationship-field-codec';
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
  emails: [],
  isWorkplace: false
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
  const { user } = useAuth();
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
  const validateFormData = async (): Promise<ValidationMessage | null> => {
    if (!contactId || contactId === 'new-contact') {
      return { key: 'relationships.form.validation.contactRequired' };
    }

    if (!formData.targetContactId) {
      return { key: 'relationships.form.validation.contactRequired' };
    }

    if (!formData.relationshipType) {
      return { key: 'relationships.form.validation.relationshipTypeRequired' };
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
        return { key: 'relationships.validation.targetNotFound' };
      }

      if (!sourceContact) {
        return { key: 'relationships.validation.sourceLoadError' };
      }

      // `sourceContact` = the card's contact, `targetContact` = the picked one.
      const sourceType = sourceContact.type;
      const targetType = targetContact.type;

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

      // ADR-372 §Β2: orient FIRST (the card the user started from is irrelevant),
      // then validate the STORED direction against the crossing matrix.
      const oriented = orientFormRole(formData.relationshipType, contactId, formData.targetContactId);
      const sourceIsCurrent = oriented.sourceContactId === contactId;
      RelationshipValidationService.validateBusinessRules(
        sourceIsCurrent ? sourceType : targetType,
        sourceIsCurrent ? targetType : sourceType,
        oriented.relationshipType
      );

      // 🔍 DUPLICATE VALIDATION: Check for same contact - same relationship type
      logger.info('DUPLICATE VALIDATION: Checking for duplicate relationships...');

      try {
        // Fetch existing relationships for this contact to check for duplicates
        const existingRelationships = await ContactRelationshipService.getContactRelationships(contactId);

        RelationshipValidationService.validateSameContactSameType(
          existingRelationships,
          oriented,
          editingId ?? undefined // Exclude current relationship if editing
        );

        logger.info('DUPLICATE VALIDATION: No duplicates found');
      } catch (duplicateError) {
        // 🔧 FIX: Duplicate is a business rule violation, not a system error → warn level
        const dupMessage = duplicateError instanceof Error ? duplicateError.message : String(duplicateError);
        logger.warn('DUPLICATE VALIDATION: Duplicate relationship detected', { data: { message: dupMessage } });

        return describeValidationError(duplicateError, 'relationships.form.validation.duplicateRelationship');
      }

    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      logger.warn('CENTRALIZED VALIDATION: Business rule violation', { data: { message: errMessage } });

      return describeValidationError(error, 'relationships.validation.checkError');
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
        setError(translateValidationMessage(validationError, t));
        return;
      }

      logger.info('VALIDATION PASSED:', { data: {
        targetContactId: formData.targetContactId,
        relationshipType: formData.relationshipType,
        contactId
      } });

      // ADR-372 §Β2: ONE orientation path for every type — no hand-written swap list.
      const oriented = orientFormRole(formData.relationshipType, contactId, formData.targetContactId);

      // ADR-372 §8.6: structured channels are the truth; `contactInfo` is their PROJECTION
      // (a removed phone is removed — the old fallback kept the stale string alive).
      const { phones, emails } = compactChannels(formData.phones ?? [], formData.emails ?? []);

      const relationshipData: Partial<ContactRelationship> = {
        sourceContactId: oriented.sourceContactId,
        targetContactId: oriented.targetContactId,
        relationshipType: oriented.relationshipType as RelationshipType,
        position: formData.position || null,
        department: formData.department || null,
        startDate: relationshipCalendarDay(formData.startDate),
        endDate: relationshipCalendarDay(formData.endDate),
        notes: formData.notes || null,
        isWorkplace: formData.isWorkplace ?? null,
        phones,
        emails,
        contactInfo: projectContactInfo(formData.contactInfo, phones, emails)
      };


      // Create or update relationship
      if (editingId) {
        await updateRelationshipWithPolicy({
          relationshipId: editingId,
          updates: relationshipData,
          actorId: user?.uid,
        });
      } else {
        await createRelationshipWithPolicy({
          data: relationshipData,
          actorId: user?.uid,
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

    // ADR-372 §8.6: read through the codec — structured channels first, a legacy
    // display string parsed back into its parts (never re-prefixed on save).
    const existingPhones = relationshipPhonesOf(relationship);
    const existingEmails = relationshipEmailsOf(relationship);

    setFormData({
      // ADR-372 §Β2: «the other contact» and the oriented role are derived from the
      // viewer's side — the stored target may be the current contact itself.
      targetContactId: otherContactIdOf(relationship, contactId),
      relationshipType: isRelationshipType(relationship.relationshipType)
        ? encodeOrientedRole(orientedRoleOf(relationship, contactId))
        : relationship.relationshipType,
      position: relationship.position || '',
      department: relationship.department || '',
      // A legacy instant is shown as the day it named — never silently wiped on save.
      startDate: relationshipCalendarDay(relationship.startDate) ?? '',
      endDate: relationshipCalendarDay(relationship.endDate) ?? '',
      notes: relationship.notes || '',
      // Every stored field rides along (fax, office…) — the projection only rewrites the two it owns.
      contactInfo: { ...relationship.contactInfo },
      phones: existingPhones,
      emails: existingEmails,
      isWorkplace: relationship.isWorkplace === true
    });

    setError(null);
    setSuccessMessage(null);
  }, [contactId]);

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
