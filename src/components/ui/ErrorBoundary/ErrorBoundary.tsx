// ============================================================================
// 🏢 ENTERPRISE: ErrorBoundary — Barrel Re-export File
// ============================================================================
// All 70+ consumer files import from this path. This barrel ensures backward
// compatibility while the actual implementations live in SRP-compliant modules.
// @pattern Google — Barrel exports for clean public API
// ============================================================================

// Types
export type {
  EmailProvider,
  EmailComposeOptions,
  EmailProviderConfig,
  CustomErrorInfo,
  ErrorBoundaryProps,
  ErrorBoundaryState,
  RouteErrorFallbackProps,
  ErrorActionState,
  ErrorActionHandlers,
  DesignTokenProps,
  ErrorFallbackUIProps,
} from './types';

// Email Utilities
export { openEmailCompose, EMAIL_PROVIDERS } from './email-compose';

// Error Helpers
export { getUserId, getErrorSeverity, formatErrorForEmail, goHome, goBack } from './error-helpers';

// Error Message Translator
export { translateErrorMessage, getErrorTranslationKey } from './error-message-translator';

// Hooks
export { useErrorActions } from './useErrorActions';
export { useErrorReporting } from './useErrorReporting';

// Core Components
export { ErrorBoundary, withErrorBoundary } from './ErrorBoundaryClass';
export { ErrorFallbackUI } from './ErrorFallbackUI';
export { RouteErrorFallback } from './RouteErrorFallback';

// Enterprise Wrappers
export {
  EnterpriseErrorBoundary,
  PageErrorBoundary,
  ComponentErrorBoundary,
} from './enterprise-wrappers';

// Tour Wrappers
export {
  ErrorDialogTourTrigger,
  EnterpriseErrorBoundaryWithTour,
} from './tour-wrappers';

// Default export — backward compatible
export { EnterpriseErrorBoundary as default } from './enterprise-wrappers';
