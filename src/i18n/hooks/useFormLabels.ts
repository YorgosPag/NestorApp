"use client";

/**
 * @fileoverview Enterprise Form Labels Hook
 * @description Provides type-safe translation for form field labels and help texts
 * @author Claude (Anthropic AI)
 * @date 2025-01-18
 * @version 1.0.0 - ENTERPRISE i18n ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - SAP/Salesforce Pattern
 *
 * 🏢 ENTERPRISE PATTERN:
 * - Configuration files contain i18n keys (not hardcoded strings)
 * - This hook translates keys at runtime based on current language
 * - Type safety maintained throughout the chain
 * - Follows SAP, Salesforce, Microsoft Dynamics i18n patterns
 */

import { useMemo, useCallback } from 'react';
import { useTranslation } from './useTranslation';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Label record type - maps field keys to i18n translation keys
 */
export type LabelRecord = Record<string, string>;

/**
 * Translated labels record - same structure but with translated values
 */
export type TranslatedLabels<T extends LabelRecord> = {
  readonly [K in keyof T]: string;
};

/**
 * Hook return type
 */
export interface UseFormLabelsReturn {
  /**
   * Translate a single label key
   * @param key - i18n key (e.g., 'company.companyName')
   * @param defaultValue - Fallback value if translation not found
   */
  translateLabel: (key: string, defaultValue?: string) => string;

  /**
   * Translate all labels in a record
   * @param labels - Record of field keys to i18n keys
   * @returns Record with same keys but translated values
   */
  translateLabels: <T extends LabelRecord>(labels: T) => TranslatedLabels<T>;

  /**
   * Get company field label
   * @param fieldKey - Field key from MODAL_SELECT_COMPANY_FIELD_LABELS
   */
  getCompanyLabel: (fieldKey: string) => string;

  /**
   * Get service field label
   * @param fieldKey - Field key from MODAL_SELECT_SERVICE_FIELD_LABELS
   */
  getServiceLabel: (fieldKey: string) => string;

  /**
   * Get help text for a field
   * @param fieldKey - Field key for help text
   */
  getHelpText: (fieldKey: string) => string;

  /**
   * Get section title
   * @param sectionKey - Section key (e.g., 'basicInfoGemi')
   */
  getSectionTitle: (sectionKey: string) => string;

  /**
   * Get section description
   * @param sectionKey - Section key
   */
  getSectionDescription: (sectionKey: string) => string;

  /**
   * Get filter label
   * @param filterKey - Filter key (e.g., 'search', 'type')
   */
  getFilterLabel: (filterKey: string) => string;

  /**
   * Get placeholder text
   * @param placeholderKey - Placeholder key (e.g., 'units', 'contacts')
   */
  getPlaceholder: (placeholderKey: string) => string;

  /**
   * Get GEMI status label
   * @param statusKey - Status key (e.g., 'active', 'inactive')
   */
  getGemiStatus: (statusKey: string) => string;

  /**
   * Get validation message
   * @param validationKey - Validation key (e.g., 'required', 'invalidEmail')
   * @param params - Optional interpolation params
   */
  getValidationMessage: (validationKey: string, params?: Record<string, string | number>) => string;

  /**
   * Check if namespace is ready
   */
  isReady: boolean;

  /**
   * Current language
   */
  currentLanguage: string;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Enterprise Form Labels Hook
 *
 * Provides type-safe translation for form field labels and help texts.
 * Uses the 'forms' namespace from i18n configuration.
 *
 * @example
 * ```tsx
 * const { getCompanyLabel, getHelpText, translateLabels } = useFormLabels();
 *
 * // Single label
 * const label = getCompanyLabel('companyName'); // "Company Name" or "Επωνυμία Εταιρείας"
 *
 * // Help text
 * const help = getHelpText('companyName'); // "The official company name"
 *
 * // Bulk translation
 * const labels = translateLabels({
 *   name: 'company.companyName',
 *   vat: 'company.vatNumber',
 * });
 * // { name: "Company Name", vat: "VAT Number" }
 * ```
 */
export function useFormLabels(): UseFormLabelsReturn {
  const { t, isNamespaceReady, currentLanguage } = useTranslation('forms');

  /**
   * Translate a single label key
   */
  const translateLabel = useCallback((key: string, defaultValue?: string): string => {
    const result = t(key, { defaultValue: defaultValue ?? key });
    return result;
  }, [t]);

  /**
   * Translate all labels in a record
   */
  const translateLabels = useCallback(<T extends LabelRecord>(labels: T): TranslatedLabels<T> => {
    const translated: Partial<TranslatedLabels<T>> = {};

    for (const [fieldKey, i18nKey] of Object.entries(labels)) {
      translated[fieldKey as keyof T] = translateLabel(i18nKey);
    }

    return translated as TranslatedLabels<T>;
  }, [translateLabel]);

  /**
   * Get company field label
   */
  const getCompanyLabel = useCallback((fieldKey: string): string => {
    return translateLabel(`company.${fieldKey}`);
  }, [translateLabel]);

  /**
   * Get service field label
   */
  const getServiceLabel = useCallback((fieldKey: string): string => {
    return translateLabel(`service.${fieldKey}`);
  }, [translateLabel]);

  /**
   * Get help text for a field
   */
  const getHelpText = useCallback((fieldKey: string): string => {
    return translateLabel(`helpTexts.${fieldKey}`);
  }, [translateLabel]);

  /**
   * Get section title
   */
  const getSectionTitle = useCallback((sectionKey: string): string => {
    return translateLabel(`sections.${sectionKey}`);
  }, [translateLabel]);

  /**
   * Get section description
   */
  const getSectionDescription = useCallback((sectionKey: string): string => {
    return translateLabel(`sectionDescriptions.${sectionKey}`);
  }, [translateLabel]);

  /**
   * Get filter label
   */
  const getFilterLabel = useCallback((filterKey: string): string => {
    return translateLabel(`filters.${filterKey}`);
  }, [translateLabel]);

  /**
   * Get placeholder text
   */
  const getPlaceholder = useCallback((placeholderKey: string): string => {
    return translateLabel(`searchPlaceholders.${placeholderKey}`);
  }, [translateLabel]);

  /**
   * Get GEMI status label
   */
  const getGemiStatus = useCallback((statusKey: string): string => {
    return translateLabel(`gemiStatuses.${statusKey}`);
  }, [translateLabel]);

  /**
   * Get validation message with interpolation support
   */
  const getValidationMessage = useCallback((validationKey: string, params?: Record<string, string | number>): string => {
    if (params) {
      return t(`validation.${validationKey}`, params);
    }
    return translateLabel(`validation.${validationKey}`);
  }, [t, translateLabel]);

  return useMemo(() => ({
    translateLabel,
    translateLabels,
    getCompanyLabel,
    getServiceLabel,
    getHelpText,
    getSectionTitle,
    getSectionDescription,
    getFilterLabel,
    getPlaceholder,
    getGemiStatus,
    getValidationMessage,
    isReady: isNamespaceReady,
    currentLanguage,
  }), [
    translateLabel,
    translateLabels,
    getCompanyLabel,
    getServiceLabel,
    getHelpText,
    getSectionTitle,
    getSectionDescription,
    getFilterLabel,
    getPlaceholder,
    getGemiStatus,
    getValidationMessage,
    isNamespaceReady,
    currentLanguage,
  ]);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert snake_case field key to camelCase i18n key
 * @param snakeCase - Field key in snake_case (e.g., 'company_name')
 * @returns camelCase key (e.g., 'companyName')
 */
export function snakeToCamelCase(snakeCase: string): string {
  return snakeCase.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Convert camelCase i18n key to snake_case field key
 * @param camelCase - Key in camelCase (e.g., 'companyName')
 * @returns snake_case key (e.g., 'company_name')
 */
export function camelToSnakeCase(camelCase: string): string {
  return camelCase.replace(/([A-Z])/g, '_$1').toLowerCase();
}

export default useFormLabels;
