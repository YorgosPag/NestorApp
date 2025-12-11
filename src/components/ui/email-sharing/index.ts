// ============================================================================
// 📧 EMAIL SHARING MODULE INDEX - ENTERPRISE EXPORTS
// ============================================================================
//
// 🎯 PURPOSE: Central export point για όλα τα email sharing components
// 🔗 USED BY: External components που χρησιμοποιούν email sharing
// 🏢 STANDARDS: Enterprise module structure, clean imports
//
// ============================================================================

// Main Component
export { default as EmailShareForm } from './EmailShareForm';
export type { EmailShareFormProps } from './EmailShareForm';

// Sub-components
export { TemplateSelector, CompactTemplateSelector } from './components/TemplateSelector';
export { RecipientsList, CompactRecipientsList } from './components/RecipientsList';
export { MessagePreview, CompactMessagePreview } from './components/MessagePreview';
export {
  ValidationErrors,
  CompactValidationErrors,
  FieldValidationError,
  SuccessMessage
} from './components/ValidationErrors';

// Hooks
export {
  useEmailValidation,
  useEnterpriseEmailValidation,
  useContactEmailValidation,
  useBulkEmailValidation
} from './hooks/useEmailValidation';

export {
  useEmailForm,
  useContactEmailForm,
  useBulkEmailForm,
  usePropertyEmailForm
} from './hooks/useEmailForm';

// Types
export type {
  ShareData,
  EmailShareData,
  EmailFormConfig,
  TemplateSelectorProps,
  RecipientsListProps,
  MessagePreviewProps,
  ValidationErrorsProps,
  EmailValidationOptions,
  EmailFormState,
  EmailFormActions,
  EmailFormHookResult,
  EmailValidationResult,
  FormValidationState,
  EmailSubmissionEvent,
  FormStateChangeEvent,
  EmailAddress,
  EmailShareStats,
  SubmissionStatus
} from './types';

// Constants & Utilities
export {
  DEFAULT_EMAIL_CONFIG,
  EMAIL_REGEX,
  VALIDATION_MESSAGES,
  isValidEmail,
  isValidShareData,
  isValidEmailShareData
} from './types';

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

// Legacy hook export για backward compatibility
export { useEmailValidation as useEmailValidation } from './hooks/useEmailValidation';

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * 📦 All components bundle για easy importing
 */
export const EmailSharingComponents = {
  EmailShareForm,
  TemplateSelector,
  CompactTemplateSelector,
  RecipientsList,
  CompactRecipientsList,
  MessagePreview,
  CompactMessagePreview,
  ValidationErrors,
  CompactValidationErrors,
  FieldValidationError,
  SuccessMessage
};

/**
 * 🎣 All hooks bundle για easy importing
 */
export const EmailSharingHooks = {
  useEmailValidation,
  useEnterpriseEmailValidation,
  useContactEmailValidation,
  useBulkEmailValidation,
  useEmailForm,
  useContactEmailForm,
  useBulkEmailForm,
  usePropertyEmailForm
};