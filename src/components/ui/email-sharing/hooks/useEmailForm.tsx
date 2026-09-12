// ============================================================================
// 📋 EMAIL FORM HOOK - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ STATE MANAGEMENT
// ============================================================================
//
// 🎯 PURPOSE: Centralized email form state και business logic
// 🔗 USED BY: EmailShareForm, EmailComposer, ContactEmailer
// 🏢 STANDARDS: Enterprise state management, performance optimized
//
// ============================================================================

'use client';

import { useState, useCallback, useMemo } from 'react';

// Types & Services
import type {
  EmailFormState,
  EmailFormActions,
  EmailFormHookResult,
  EmailFormConfig,
  EmailShareData
} from '../types';
import type { EmailTemplateType } from '@/types/email-templates';
import { DEFAULT_EMAIL_CONFIG, isValidEmail } from '../types';
import { PRODUCT_NAME } from '@/constants/product-identity';

// Hooks
import { useEmailValidation } from './useEmailValidation';

// ============================================================================
// EMAIL FORM HOOK
// ============================================================================

/**
 * 📋 useEmailForm Hook
 *
 * Enterprise email form state management με centralized logic
 *
 * Features:
 * - Centralized form state management
 * - Built-in validation integration
 * - Performance optimized με useCallback/useMemo
 * - Type-safe actions και computed values
 * - Configurable validation rules
 */
export function useEmailForm(
  config: EmailFormConfig = {},
  initialState?: Partial<EmailFormState>
) {
  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const finalConfig = useMemo(() => ({
    ...DEFAULT_EMAIL_CONFIG,
    ...config
  }), [config]);

  // ============================================================================
  // STATE
  // ============================================================================

  const [state, setState] = useState<EmailFormState>(() => ({
    recipients: [''],
    personalMessage: '',
    selectedTemplate: finalConfig.defaultTemplate,
    validationError: null,
    ...initialState
  }));

  // ============================================================================
  // VALIDATION HOOK
  // ============================================================================

  const { validateEmails, getValidEmailsCount, getValidationSummary } = useEmailValidation({
    maxRecipients: finalConfig.maxRecipients,
    allowDuplicates: false
  });

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const computed = useMemo(() => {
    const validEmailCount = getValidEmailsCount(state.recipients);
    const messageLength = state.personalMessage.length;
    const remainingChars = finalConfig.maxMessageLength - messageLength;
    const validationSummary = getValidationSummary(state.recipients);

    // Form validation
    let isFormValid = true;
    const formErrors: string[] = [];

    // Email validation
    if (validEmailCount === 0) {
      isFormValid = false;
      formErrors.push('Απαιτείται τουλάχιστον ένα έγκυρο email');
    }

    // Message length validation
    if (messageLength > finalConfig.maxMessageLength) {
      isFormValid = false;
      formErrors.push(`Το μήνυμα υπερβαίνει το όριο των ${finalConfig.maxMessageLength} χαρακτήρων`);
    }

    // Custom validation
    if (finalConfig.validateRecipients) {
      const validEmails = state.recipients.filter(email =>
        email.trim() && isValidEmail(email)
      );
      const customError = finalConfig.validateRecipients(validEmails);
      if (customError) {
        isFormValid = false;
        formErrors.push(customError);
      }
    }

    return {
      validEmailCount,
      messageLength,
      remainingChars,
      isFormValid,
      formErrors,
      validationSummary,
      canAddRecipient: state.recipients.length < finalConfig.maxRecipients,
      hasValidEmails: validEmailCount > 0,
      isOverMessageLimit: messageLength > finalConfig.maxMessageLength
    };
  }, [
    state.recipients,
    state.personalMessage,
    finalConfig.maxRecipients,
    finalConfig.maxMessageLength,
    finalConfig.validateRecipients,
    getValidEmailsCount,
    getValidationSummary
  ]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const actions: EmailFormActions = useMemo(() => ({
    /**
     * ➕ Add new email recipient
     */
    addRecipient: () => {
      if (computed.canAddRecipient) {
        setState(prev => ({
          ...prev,
          recipients: [...prev.recipients, ''],
          validationError: null
        }));
      }
    },

    /**
     * ❌ Remove email recipient
     */
    removeRecipient: (index: number) => {
      if (state.recipients.length > 1) {
        setState(prev => ({
          ...prev,
          recipients: prev.recipients.filter((_, i) => i !== index),
          validationError: null
        }));
      }
    },

    /**
     * ✏️ Update email recipient
     */
    updateRecipient: (index: number, value: string) => {
      setState(prev => {
        const newRecipients = [...prev.recipients];
        newRecipients[index] = value;
        return {
          ...prev,
          recipients: newRecipients,
          validationError: null
        };
      });
    },

    /**
     * 💬 Set personal message
     */
    setPersonalMessage: (message: string) => {
      if (message.length <= finalConfig.maxMessageLength) {
        setState(prev => ({
          ...prev,
          personalMessage: message
        }));
      }
    },

    /**
     * 🎨 Set selected template
     */
    setSelectedTemplate: (template: EmailTemplateType) => {
      setState(prev => ({
        ...prev,
        selectedTemplate: template
      }));
    },

    /**
     * ❌ Set validation error
     */
    setValidationError: (error: string | null) => {
      setState(prev => ({
        ...prev,
        validationError: error
      }));
    },

    /**
     * 🔄 Reset form to initial state
     */
    resetForm: () => {
      setState({
        recipients: [''],
        personalMessage: '',
        selectedTemplate: finalConfig.defaultTemplate,
        validationError: null,
        ...initialState
      });
    },

    /**
     * ✅ Check if form is valid
     */
    isFormValid: () => computed.isFormValid,

    /**
     * 📧 Get valid emails only
     */
    getValidEmails: () => {
      return state.recipients.filter(email =>
        email.trim() && isValidEmail(email)
      );
    }
  }), [
    state.recipients,
    finalConfig.maxMessageLength,
    finalConfig.defaultTemplate,
    computed.canAddRecipient,
    computed.isFormValid,
    initialState
  ]);

  // ============================================================================
  // ADVANCED ACTIONS
  // ============================================================================

  /**
   * 🎯 Validate form and return detailed result
   */
  const validateForm = useCallback(() => {
    const validEmails = actions.getValidEmails();
    const validationResult = validateEmails(validEmails);

    if (!validationResult.isValid) {
      actions.setValidationError(validationResult.error || 'Σφάλμα επικύρωσης');
      return false;
    }

    if (computed.formErrors.length > 0) {
      actions.setValidationError(computed.formErrors[0]);
      return false;
    }

    actions.setValidationError(null);
    return true;
  }, [actions, validateEmails, computed.formErrors]);

  /**
   * 📤 Prepare email data for submission
   */
  const prepareEmailData = useCallback((shareData: {
    title: string;
    text?: string;
    url: string;
  }): EmailShareData | null => {
    if (!validateForm()) {
      return null;
    }

    return {
      recipients: actions.getValidEmails(),
      personalMessage: state.personalMessage.trim() || undefined,
      templateType: state.selectedTemplate,
      propertyTitle: shareData.title,
      propertyDescription: shareData.text,
      propertyUrl: shareData.url,
      // 🔑 Εφεδρεία = η **πλατφόρμα** (ADR-857 Φ7). Το `senderName` είναι **δεδομένα
      //    ενοίκου** (κλάση Γ) και μένει· άλλαξε μόνο η τιμή για όταν **δεν υπάρχει
      //    ένοικος να ονομάσεις** — έλεγε «Nestor Construct», εταιρεία ανύπαρκτη.
      senderName: process.env.NEXT_PUBLIC_COMPANY_NAME || PRODUCT_NAME
    };
  }, [validateForm, actions, state.personalMessage, state.selectedTemplate]);

  /**
   * 📋 Bulk update recipients
   */
  const bulkUpdateRecipients = useCallback((emails: string[]) => {
    const limitedEmails = emails.slice(0, finalConfig.maxRecipients);
    setState(prev => ({
      ...prev,
      recipients: limitedEmails.length > 0 ? limitedEmails : [''],
      validationError: null
    }));
  }, [finalConfig.maxRecipients]);

  /**
   * 🧹 Clean empty recipients
   */
  const cleanEmptyRecipients = useCallback(() => {
    const cleanedRecipients = state.recipients.filter(email => email.trim());
    setState(prev => ({
      ...prev,
      recipients: cleanedRecipients.length > 0 ? cleanedRecipients : ['']
    }));
  }, [state.recipients]);

  // ============================================================================
  // RETURN API
  // ============================================================================

  const result: EmailFormHookResult = {
    state,
    actions,
    computed: {
      validEmailCount: computed.validEmailCount,
      messageLength: computed.messageLength,
      remainingChars: computed.remainingChars,
      isFormValid: computed.isFormValid
    }
  };

  return {
    ...result,

    // Extended computed values
    computedExtended: computed,

    // Advanced actions
    validateForm,
    prepareEmailData,
    bulkUpdateRecipients,
    cleanEmptyRecipients,

    // Configuration
    config: finalConfig,

    // Validation utilities
    validation: {
      validateEmails,
      getValidationSummary
    }
  };
}

// ============================================================================
// SPECIALIZED HOOKS
// ============================================================================

/**
 * 📧 Contact email form hook
 */
export function useContactEmailForm(initialContact?: { email?: string }) {
  return useEmailForm(
    {
      maxRecipients: 1,
      maxMessageLength: 300,
      showTemplateSelector: false,
      defaultTemplate: 'residential' as EmailTemplateType
    },
    {
      recipients: [initialContact?.email || '']
    }
  );
}

/**
 * 📤 Bulk email form hook
 */
export function useBulkEmailForm() {
  return useEmailForm({
    maxRecipients: 50,
    maxMessageLength: 1000,
    showTemplateSelector: true,
    defaultTemplate: 'commercial' as EmailTemplateType
  });
}

/**
 * 🏠 Property sharing email form hook
 */
export function usePropertyEmailForm() {
  return useEmailForm({
    maxRecipients: 5,
    maxMessageLength: 500,
    showTemplateSelector: true,
    defaultTemplate: 'residential' as EmailTemplateType
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export default useEmailForm;