// ============================================================================
// 📧 EMAIL SHARING MODULE INDEX - ENTERPRISE EXPORTS
// ============================================================================
//
// 🎯 PURPOSE: Central export point για όλα τα email sharing components
// 🔗 USED BY: External components που χρησιμοποιούν email sharing
// 🏢 STANDARDS: Enterprise module structure, clean imports
//
// ============================================================================

// ============================================================================
// INTERNAL IMPORTS (for convenience objects below)
// ============================================================================

// 🏢 ENTERPRISE: Import as local variables for use in convenience objects
import _EmailShareForm from './EmailShareForm';
import {
  TemplateSelector as _TemplateSelector,
  CompactTemplateSelector as _CompactTemplateSelector
} from './components/TemplateSelector';
import {
  RecipientsList as _RecipientsList,
  CompactRecipientsList as _CompactRecipientsList
} from './components/RecipientsList';
import {
  MessagePreview as _MessagePreview,
  CompactMessagePreview as _CompactMessagePreview
} from './components/MessagePreview';
import {
  ValidationErrors as _ValidationErrors,
  CompactValidationErrors as _CompactValidationErrors,
  FieldValidationError as _FieldValidationError,
  SuccessMessage as _SuccessMessage
} from './components/ValidationErrors';
import {
  useEmailValidation as _useEmailValidation,
  useEnterpriseEmailValidation as _useEnterpriseEmailValidation,
  useContactEmailValidation as _useContactEmailValidation,
  useBulkEmailValidation as _useBulkEmailValidation
} from './hooks/useEmailValidation';
import {
  useEmailForm as _useEmailForm,
  useContactEmailForm as _useContactEmailForm,
  useBulkEmailForm as _useBulkEmailForm,
  usePropertyEmailForm as _usePropertyEmailForm
} from './hooks/useEmailForm';

// ============================================================================
// PUBLIC EXPORTS
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
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * 📦 All components bundle για easy importing
 */
export const EmailSharingComponents = {
  EmailShareForm: _EmailShareForm,
  TemplateSelector: _TemplateSelector,
  CompactTemplateSelector: _CompactTemplateSelector,
  RecipientsList: _RecipientsList,
  CompactRecipientsList: _CompactRecipientsList,
  MessagePreview: _MessagePreview,
  CompactMessagePreview: _CompactMessagePreview,
  ValidationErrors: _ValidationErrors,
  CompactValidationErrors: _CompactValidationErrors,
  FieldValidationError: _FieldValidationError,
  SuccessMessage: _SuccessMessage
};

/**
 * 🎣 All hooks bundle για easy importing
 */
export const EmailSharingHooks = {
  useEmailValidation: _useEmailValidation,
  useEnterpriseEmailValidation: _useEnterpriseEmailValidation,
  useContactEmailValidation: _useContactEmailValidation,
  useBulkEmailValidation: _useBulkEmailValidation,
  useEmailForm: _useEmailForm,
  useContactEmailForm: _useContactEmailForm,
  useBulkEmailForm: _useBulkEmailForm,
  usePropertyEmailForm: _usePropertyEmailForm
};
