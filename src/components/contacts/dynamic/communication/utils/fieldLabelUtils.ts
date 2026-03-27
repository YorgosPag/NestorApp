// ============================================================================
// 🏷️ ENTERPRISE FIELD LABEL UTILITIES - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ FIELD HELPERS
// ============================================================================
//
// 📍 EXTRACTED FROM: UniversalCommunicationManager.tsx
// 🎯 PURPOSE: Centralized field label και input type generation για consistent UI
// 🔗 USED BY: Communication renderers, form components, validation systems
//
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

import type { CommunicationType } from '../types';

/**
 * 🎯 Field Label Configuration
 *
 * Configuration για field labels ανά communication type
 */
export interface FieldLabelConfig {
  primary: string;
  secondary?: string;
  inputType: string;
  placeholder: string;
}

/**
 * 📝 Field Type Mappings
 *
 * Mapping communication types προς field configurations
 */
export type FieldLabelMapping = Record<CommunicationType, FieldLabelConfig>;

// ============================================================================
// ENTERPRISE FIELD LABEL CONFIGURATIONS
// ============================================================================

/**
 * 🏢 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ FIELD LABEL MAPPINGS
 *
 * Single source of truth για όλα τα field labels και input types
 */
export const FIELD_LABEL_MAPPINGS: FieldLabelMapping = {
  phone: {
    primary: 'Αριθμός Τηλεφώνου',
    secondary: 'Κωδικός Χώρας',
    inputType: 'tel',
    placeholder: '2310 123456'
  },
  email: {
    primary: 'Διεύθυνση E-mail',
    inputType: 'email',
    placeholder: 'john@example.com'
  },
  website: {
    primary: 'URL',
    inputType: 'url',
    placeholder: 'https://example.com'
  },
  social: {
    primary: 'Username',
    secondary: 'Πλατφόρμα',
    inputType: 'text',
    placeholder: 'john-doe'
  },
  identity: {
    primary: 'Αριθμός Ταυτότητας',
    inputType: 'text',
    placeholder: 'AB123456'
  },
  professional: {
    primary: 'Επαγγελματικός Κωδικός',
    inputType: 'text',
    placeholder: 'ΑΜ123456'
  },
  address: {
    primary: 'Διεύθυνση',
    inputType: 'text',
    placeholder: 'Οδός 123, Αθήνα'
  }
} as const;

/**
 * 🎯 INPUT TYPE FALLBACKS
 *
 * Fallback input types για unknown communication types
 */
export const INPUT_TYPE_FALLBACK = 'text';
export const LABEL_FALLBACK = 'Τιμή';

// ============================================================================
// ENTERPRISE UTILITY FUNCTIONS
// ============================================================================

/**
 * 🏷️ Get Primary Field Label
 *
 * Enterprise function για primary field label generation
 *
 * @param communicationType - The communication type
 * @returns Localized primary field label
 *
 * @example
 * ```typescript
 * getPrimaryFieldLabel('phone')  // Returns: 'Αριθμός Τηλεφώνου'
 * getPrimaryFieldLabel('email')  // Returns: 'Διεύθυνση E-mail'
 * getPrimaryFieldLabel('social') // Returns: 'Username'
 * ```
 */
export function getPrimaryFieldLabel(communicationType: CommunicationType): string {
  const config = FIELD_LABEL_MAPPINGS[communicationType];
  return config?.primary || LABEL_FALLBACK;
}

/**
 * 🏷️ Get Secondary Field Label
 *
 * Enterprise function για secondary field label generation
 *
 * @param communicationType - The communication type
 * @returns Localized secondary field label ή empty string αν δεν υπάρχει
 *
 * @example
 * ```typescript
 * getSecondaryFieldLabel('phone')  // Returns: 'Κωδικός Χώρας'
 * getSecondaryFieldLabel('social') // Returns: 'Πλατφόρμα'
 * getSecondaryFieldLabel('email')  // Returns: ''
 * ```
 */
export function getSecondaryFieldLabel(communicationType: CommunicationType): string {
  const config = FIELD_LABEL_MAPPINGS[communicationType];
  return config?.secondary || '';
}

/**
 * 🔤 Get Input Type
 *
 * Enterprise function για HTML input type determination
 *
 * @param communicationType - The communication type
 * @returns HTML input type για proper field rendering και validation
 *
 * @example
 * ```typescript
 * getInputType('email')   // Returns: 'email'
 * getInputType('website') // Returns: 'url'
 * getInputType('phone')   // Returns: 'tel'
 * getInputType('social')  // Returns: 'text'
 * ```
 */
export function getInputType(communicationType: CommunicationType): string {
  const config = FIELD_LABEL_MAPPINGS[communicationType];
  return config?.inputType || INPUT_TYPE_FALLBACK;
}

/**
 * 📝 Get Field Placeholder
 *
 * Enterprise function για field placeholder text
 *
 * @param communicationType - The communication type
 * @returns Localized placeholder text για better UX
 *
 * @example
 * ```typescript
 * getFieldPlaceholder('phone')  // Returns: '2310 123456'
 * getFieldPlaceholder('email')  // Returns: 'john@example.com'
 * ```
 */
export function getFieldPlaceholder(communicationType: CommunicationType): string {
  const config = FIELD_LABEL_MAPPINGS[communicationType];
  return config?.placeholder || '';
}

/**
 * 🔍 Has Secondary Field
 *
 * Check αν ο communication type έχει secondary field
 *
 * @param communicationType - The communication type
 * @returns Boolean indicating αν υπάρχει secondary field
 */
export function hasSecondaryField(communicationType: CommunicationType): boolean {
  const config = FIELD_LABEL_MAPPINGS[communicationType];
  return Boolean(config?.secondary);
}

/**
 * 📋 Get Complete Field Config
 *
 * Enterprise function για complete field configuration
 *
 * @param communicationType - The communication type
 * @returns Complete field configuration object
 */
export function getFieldLabelConfig(communicationType: CommunicationType): FieldLabelConfig | null {
  return FIELD_LABEL_MAPPINGS[communicationType] || null;
}

/**
 * 🎯 Get All Supported Communication Types
 *
 * Returns list των supported communication types
 */
export function getSupportedCommunicationTypes(): CommunicationType[] {
  return Object.keys(FIELD_LABEL_MAPPINGS) as CommunicationType[];
}

/**
 * ✅ Validate Communication Type
 *
 * Enterprise validation για communication type
 *
 * @param type - The type to validate
 * @returns Boolean indicating αν είναι valid communication type
 */
export function isValidCommunicationType(type: string): type is CommunicationType {
  return type in FIELD_LABEL_MAPPINGS;
}

// ============================================================================
// LOCALIZATION HELPERS (Future Enhancement)
// ============================================================================

/**
 * 🌐 Field Label Localization Interface
 *
 * Interface για μελλοντική localization support
 * Θα επιτρέπει easy translation των labels σε διαφορετικές γλώσσες
 */
export interface LocalizedFieldLabels {
  primary: Record<string, string>;
  secondary: Record<string, string>;
  placeholders: Record<string, string>;
}

/**
 * 🔄 Get Localized Field Labels (Future)
 *
 * Placeholder function για μελλοντική localization support
 * Προς το παρόν returns τα ελληνικά labels
 */
export function getLocalizedFieldLabels(_locale: string = 'el'): LocalizedFieldLabels {
  // TODO: Implement proper localization when needed
  // For now, return Greek labels as default
  return {
    primary: Object.fromEntries(
      Object.entries(FIELD_LABEL_MAPPINGS).map(([key, config]) => [key, config.primary])
    ),
    secondary: Object.fromEntries(
      Object.entries(FIELD_LABEL_MAPPINGS)
        .filter(([_, config]) => config.secondary)
        .map(([key, config]) => [key, config.secondary!])
    ),
    placeholders: Object.fromEntries(
      Object.entries(FIELD_LABEL_MAPPINGS).map(([key, config]) => [key, config.placeholder])
    )
  };
}