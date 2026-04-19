// ============================================================================
// 🏢 EMAIL SHARING TYPES - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΕΣ ΤΥΠΟΙ
// ============================================================================
//
// 🎯 PURPOSE: Shared TypeScript types για όλα τα email sharing components
// 🔗 USED BY: EmailShareForm, TemplateSelector, RecipientsList, hooks
// 🏢 STANDARDS: Enterprise type safety, proper documentation
//
// ============================================================================

import type { EmailTemplateType } from '@/types/email-templates';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * 📊 Share data object που περνάει από άλλες components
 */
export interface ShareData {
  title: string;
  text?: string;
  url: string;
  photoUrl?: string;
  isPhoto?: boolean;
  galleryPhotos?: string[];
  /**
   * Property doc id — populated only when the shared entity is a property
   * showcase. Forwarded to `/api/communications/share-to-channel` so the
   * route can load the full snapshot and append a text digest after the
   * photo dispatch (ADR-312 Phase 9.18).
   */
  propertyId?: string;
}

/**
 * 📧 Email data που στέλνεται για sharing
 */
export interface EmailShareData {
  recipients: string[];
  personalMessage?: string;
  templateType: EmailTemplateType;
  propertyTitle: string;
  propertyDescription?: string;
  propertyUrl: string;
  photoUrl?: string;
  photoUrls?: string[];
  isPhoto?: boolean;
  senderName?: string;
  /** CRM contact ID when recipient was selected from contacts */
  sourceContactId?: string;
  /** CRM contact display name for audit trail */
  sourceContactName?: string;
}

/**
 * ⚙️ Configuration options για email form
 */
export interface EmailFormConfig {
  /** Maximum message length */
  maxMessageLength?: number;
  /** Maximum recipients allowed */
  maxRecipients?: number;
  /** Default template to select */
  defaultTemplate?: EmailTemplateType;
  /** Show template selector */
  showTemplateSelector?: boolean;
  /** Custom validation function */
  validateRecipients?: (emails: string[]) => string | null;
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

/**
 * 🎨 TemplateSelector component props
 */
export interface TemplateSelectorProps {
  /** Currently selected template */
  selectedTemplate: EmailTemplateType;
  /** Callback when template changes */
  onTemplateChange: (template: EmailTemplateType) => void;
  /** Whether component is disabled */
  disabled?: boolean;
  /** Show selector or not */
  show?: boolean;
}

/**
 * 👥 RecipientsList component props
 */
export interface RecipientsListProps {
  /** Array of email recipients */
  recipients: string[];
  /** Callback when recipients change */
  onRecipientsChange: (recipients: string[]) => void;
  /** Maximum number of recipients */
  maxRecipients?: number;
  /** Whether component is disabled */
  disabled?: boolean;
  /** Custom validation function */
  validateEmails?: (emails: string[]) => string | null;
  /** Show validation errors */
  showValidation?: boolean;
}

/**
 * 📝 MessagePreview component props
 */
export interface MessagePreviewProps {
  /** Personal message text */
  message: string;
  /** Current template being used */
  templateName?: string;
  /** Whether to show the preview */
  show?: boolean;
}

/**
 * ❌ ValidationErrors component props
 */
export interface ValidationErrorsProps {
  /** Validation error message */
  error?: string | null;
  /** Backend error message */
  backendError?: string | null;
  /** Whether component is visible */
  show?: boolean;
}

// ============================================================================
// HOOK TYPES
// ============================================================================

/**
 * 🔍 Email validation hook options
 */
export interface EmailValidationOptions {
  maxRecipients?: number;
  allowDuplicates?: boolean;
  domainWhitelist?: string[];
  domainBlacklist?: string[];
}

/**
 * 📋 Email form state
 */
export interface EmailFormState {
  recipients: string[];
  personalMessage: string;
  selectedTemplate: EmailTemplateType;
  validationError: string | null;
}

/**
 * 🎛️ Email form actions
 */
export interface EmailFormActions {
  addRecipient: () => void;
  removeRecipient: (index: number) => void;
  updateRecipient: (index: number, value: string) => void;
  setPersonalMessage: (message: string) => void;
  setSelectedTemplate: (template: EmailTemplateType) => void;
  setValidationError: (error: string | null) => void;
  resetForm: () => void;
  isFormValid: () => boolean;
  getValidEmails: () => string[];
}

/**
 * 📱 Complete email form hook result
 */
export interface EmailFormHookResult {
  state: EmailFormState;
  actions: EmailFormActions;
  computed: {
    validEmailCount: number;
    messageLength: number;
    remainingChars: number;
    isFormValid: boolean;
  };
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * ✅ Email validation result
 */
export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  validEmails?: string[];
}

/**
 * 🔒 Form validation state
 */
export interface FormValidationState {
  isValid: boolean;
  errors: {
    recipients?: string;
    message?: string;
    template?: string;
    custom?: string;
  };
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * 📤 Email submission event data
 */
export interface EmailSubmissionEvent {
  emailData: EmailShareData;
  timestamp: Date;
  source: string;
}

/**
 * 🔄 Form state change event
 */
export interface FormStateChangeEvent {
  field: keyof EmailFormState;
  oldValue: unknown;
  newValue: unknown;
  isValid: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * 🔧 Email address utility type
 */
export type EmailAddress = string;

/**
 * 📊 Email statistics
 */
export interface EmailShareStats {
  totalRecipients: number;
  validRecipients: number;
  invalidRecipients: number;
  messageLength: number;
  templateType: EmailTemplateType;
}

/**
 * 🎯 Form submission status
 */
export type SubmissionStatus = 'idle' | 'validating' | 'submitting' | 'success' | 'error';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * 📏 Default configuration values
 */
export const DEFAULT_EMAIL_CONFIG: Required<EmailFormConfig> = {
  maxMessageLength: 500,
  maxRecipients: 5,
  defaultTemplate: 'residential' as EmailTemplateType,
  showTemplateSelector: true,
  validateRecipients: () => null
};

/**
 * 📧 Email validation regex
 * ✅ ADR-209 Phase 8: Re-exported from canonical location
 */
export { EMAIL_REGEX, isValidEmail } from '@/lib/validation/email-validation';

/**
 * 🚫 Common validation error messages
 */
export const VALIDATION_MESSAGES = {
  REQUIRED_EMAIL: 'Παρακαλώ εισάγετε τουλάχιστον ένα έγκυρο email',
  INVALID_EMAIL: 'Μη έγκυρη διεύθυνση email',
  MAX_RECIPIENTS: 'Υπέρβαση μέγιστου αριθμού παραληπτών',
  DUPLICATE_EMAILS: 'Βρέθηκαν διπλότυπα emails',
  MAX_MESSAGE_LENGTH: 'Το μήνυμα υπερβαίνει το μέγιστο μήκος χαρακτήρων',
  BLOCKED_DOMAIN: 'Μη επιτρεπτό domain email',
  NETWORK_ERROR: 'Σφάλμα δικτύου. Παρακαλώ δοκιμάστε ξανά.'
} as const;

// ============================================================================
// TYPE GUARDS
// ============================================================================

// isValidEmail re-exported above from @/lib/validation/email-validation

/**
 * 🔍 Type guard για έγκυρο ShareData
 */
export function isValidShareData(data: unknown): data is ShareData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'title' in data &&
    'url' in data &&
    typeof (data as ShareData).title === 'string' &&
    typeof (data as ShareData).url === 'string'
  );
}

/**
 * 🔍 Type guard για έγκυρο EmailShareData
 */
export function isValidEmailShareData(data: unknown): data is EmailShareData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'recipients' in data &&
    'templateType' in data &&
    'propertyTitle' in data &&
    'propertyUrl' in data &&
    Array.isArray((data as EmailShareData).recipients) &&
    typeof (data as EmailShareData).templateType === 'string' &&
    typeof (data as EmailShareData).propertyTitle === 'string' &&
    typeof (data as EmailShareData).propertyUrl === 'string'
  );
}