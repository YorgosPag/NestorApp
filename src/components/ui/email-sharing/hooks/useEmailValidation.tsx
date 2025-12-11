// ============================================================================
// 🔍 EMAIL VALIDATION HOOK - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ
// ============================================================================
//
// 🎯 PURPOSE: Reusable email validation logic με enterprise features
// 🔗 USED BY: EmailShareForm, ContactForms, EmailComponents
// 🏢 STANDARDS: Enterprise validation patterns, type safety
//
// ============================================================================

'use client';

import { useMemo, useCallback } from 'react';

// Types
import type {
  EmailValidationOptions,
  EmailValidationResult
} from '../types';
import {
  isValidEmail,
  VALIDATION_MESSAGES
} from '../types';

// ============================================================================
// EMAIL VALIDATION HOOK
// ============================================================================

/**
 * 🔍 useEmailValidation Hook
 *
 * Enterprise email validation με advanced features
 *
 * Features:
 * - Advanced email validation rules
 * - Domain whitelist/blacklist support
 * - Duplicate detection
 * - Custom validation messages
 * - Performance optimized
 */
export function useEmailValidation(options: EmailValidationOptions = {}) {
  // ============================================================================
  // CONFIGURATION με DEFAULTS
  // ============================================================================

  const config = useMemo(() => ({
    maxRecipients: 5,
    allowDuplicates: false,
    domainWhitelist: undefined,
    domainBlacklist: undefined,
    ...options
  }), [options]);

  // ============================================================================
  // CORE VALIDATION FUNCTIONS
  // ============================================================================

  /**
   * ✅ Validate single email address
   */
  const validateSingleEmail = useCallback((email: string): EmailValidationResult => {
    const trimmedEmail = email.trim();

    // Empty check
    if (!trimmedEmail) {
      return {
        isValid: false,
        error: 'Email δεν μπορεί να είναι κενό'
      };
    }

    // Format validation
    if (!isValidEmail(trimmedEmail)) {
      return {
        isValid: false,
        error: VALIDATION_MESSAGES.INVALID_EMAIL
      };
    }

    // Domain validation
    const domainError = validateEmailDomain(trimmedEmail);
    if (domainError) {
      return {
        isValid: false,
        error: domainError
      };
    }

    return {
      isValid: true,
      validEmails: [trimmedEmail]
    };
  }, [config.domainWhitelist, config.domainBlacklist]);

  /**
   * 📧 Validate array of emails
   */
  const validateEmails = useCallback((emails: string[]): EmailValidationResult => {
    const trimmedEmails = emails
      .map(email => email.trim())
      .filter(email => email.length > 0);

    // Empty array check
    if (trimmedEmails.length === 0) {
      return {
        isValid: false,
        error: VALIDATION_MESSAGES.REQUIRED_EMAIL
      };
    }

    // Max recipients check
    if (config.maxRecipients && trimmedEmails.length > config.maxRecipients) {
      return {
        isValid: false,
        error: `${VALIDATION_MESSAGES.MAX_RECIPIENTS}: ${config.maxRecipients}`
      };
    }

    // Duplicates check
    if (!config.allowDuplicates) {
      const unique = [...new Set(trimmedEmails)];
      if (unique.length !== trimmedEmails.length) {
        return {
          isValid: false,
          error: VALIDATION_MESSAGES.DUPLICATE_EMAILS
        };
      }
    }

    // Individual email validation
    const invalidEmails: string[] = [];
    const validEmails: string[] = [];

    for (const email of trimmedEmails) {
      const result = validateSingleEmail(email);
      if (result.isValid) {
        validEmails.push(email);
      } else {
        invalidEmails.push(email);
      }
    }

    // Return result
    if (invalidEmails.length > 0) {
      return {
        isValid: false,
        error: `Μη έγκυρα emails: ${invalidEmails.join(', ')}`,
        validEmails
      };
    }

    return {
      isValid: true,
      validEmails
    };
  }, [config, validateSingleEmail]);

  /**
   * 🌐 Validate email domain
   */
  const validateEmailDomain = useCallback((email: string): string | null => {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return VALIDATION_MESSAGES.INVALID_EMAIL;

    // Whitelist check
    if (config.domainWhitelist && config.domainWhitelist.length > 0) {
      if (!config.domainWhitelist.includes(domain)) {
        return `Επιτρεπόμενα domains: ${config.domainWhitelist.join(', ')}`;
      }
    }

    // Blacklist check
    if (config.domainBlacklist && config.domainBlacklist.length > 0) {
      if (config.domainBlacklist.includes(domain)) {
        return VALIDATION_MESSAGES.BLOCKED_DOMAIN;
      }
    }

    return null;
  }, [config.domainWhitelist, config.domainBlacklist]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * 🔢 Get valid emails count
   */
  const getValidEmailsCount = useCallback((emails: string[]): number => {
    return emails.filter(email => isValidEmail(email.trim())).length;
  }, []);

  /**
   * 📊 Get validation summary
   */
  const getValidationSummary = useCallback((emails: string[]) => {
    const trimmedEmails = emails.map(email => email.trim()).filter(Boolean);
    const validEmails = trimmedEmails.filter(isValidEmail);
    const invalidEmails = trimmedEmails.filter(email => !isValidEmail(email));

    return {
      total: trimmedEmails.length,
      valid: validEmails.length,
      invalid: invalidEmails.length,
      validEmails,
      invalidEmails,
      hasErrors: invalidEmails.length > 0,
      isComplete: validEmails.length > 0 && invalidEmails.length === 0
    };
  }, []);

  /**
   * 🧹 Clean and format emails
   */
  const cleanEmails = useCallback((emails: string[]): string[] => {
    return emails
      .map(email => email.trim().toLowerCase())
      .filter((email, index, self) => {
        // Remove empty strings
        if (!email) return false;

        // Remove duplicates if not allowed
        if (!config.allowDuplicates) {
          return self.indexOf(email) === index;
        }

        return true;
      });
  }, [config.allowDuplicates]);

  // ============================================================================
  // ADVANCED VALIDATION
  // ============================================================================

  /**
   * 🎯 Batch validate με detailed results
   */
  const batchValidate = useCallback((emailsArray: string[][]): {
    results: EmailValidationResult[];
    overallValid: boolean;
    totalValid: number;
    totalInvalid: number;
  } => {
    const results = emailsArray.map(validateEmails);
    const overallValid = results.every(result => result.isValid);
    const totalValid = results.reduce((sum, result) =>
      sum + (result.validEmails?.length || 0), 0
    );
    const totalInvalid = results.filter(result => !result.isValid).length;

    return {
      results,
      overallValid,
      totalValid,
      totalInvalid
    };
  }, [validateEmails]);

  /**
   * ⚡ Real-time validation για form inputs
   */
  const createRealTimeValidator = useCallback((
    debounceMs: number = 300
  ) => {
    let timeoutId: NodeJS.Timeout;

    return (emails: string[], callback: (result: EmailValidationResult) => void) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const result = validateEmails(emails);
        callback(result);
      }, debounceMs);
    };
  }, [validateEmails]);

  // ============================================================================
  // RETURN API
  // ============================================================================

  return {
    // Core validation
    validateSingleEmail,
    validateEmails,
    validateEmailDomain,

    // Utilities
    getValidEmailsCount,
    getValidationSummary,
    cleanEmails,

    // Advanced
    batchValidate,
    createRealTimeValidator,

    // Configuration
    config,

    // Computed helpers
    isValidEmail,
    messages: VALIDATION_MESSAGES
  };
}

// ============================================================================
// SPECIALIZED HOOKS
// ============================================================================

/**
 * 🏢 Enterprise email validation με company-specific rules
 */
export function useEnterpriseEmailValidation(companyDomains?: string[]) {
  return useEmailValidation({
    maxRecipients: 10,
    allowDuplicates: false,
    domainWhitelist: companyDomains,
    domainBlacklist: ['tempmail.com', '10minutemail.com', 'guerrillamail.com']
  });
}

/**
 * 📧 Contact form email validation
 */
export function useContactEmailValidation() {
  return useEmailValidation({
    maxRecipients: 3,
    allowDuplicates: false
  });
}

/**
 * 📤 Bulk email validation για marketing
 */
export function useBulkEmailValidation() {
  return useEmailValidation({
    maxRecipients: 50,
    allowDuplicates: false,
    domainBlacklist: ['tempmail.com', '10minutemail.com', 'guerrillamail.com', 'mailinator.com']
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export default useEmailValidation;