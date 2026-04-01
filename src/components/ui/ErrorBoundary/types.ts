// ============================================================================
// 🏢 ENTERPRISE: ErrorBoundary Types — Single Source of Truth
// ============================================================================
// All shared interfaces and types for the ErrorBoundary module.
// @pattern Google SRP — Types separated from implementation
// ============================================================================

import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import type { useBorderTokens } from '@/hooks/useBorderTokens';
import type { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { UseTypographyReturn } from '@/hooks/useTypography';
import type { SpacingTokens } from '@/hooks/useSpacingTokens';
import type { LucideIcon } from 'lucide-react';

// ── Email Types ──────────────────────────────────────────────────────────────

export type EmailProvider = 'gmail' | 'outlook' | 'yahoo' | 'default';

export interface EmailComposeOptions {
  to: string;
  subject: string;
  body: string;
}

export interface EmailProviderConfig {
  id: EmailProvider;
  label: string;
  labelEl: string;
  Icon: LucideIcon;
}

// ── Design Token Types ───────────────────────────────────────────────────────

export interface DesignTokenProps {
  borderTokens: ReturnType<typeof useBorderTokens>;
  colors: ReturnType<typeof useSemanticColors>;
  typography: UseTypographyReturn;
  spacingTokens: SpacingTokens;
  t: TFunction;
}

// ── Error Boundary Types ─────────────────────────────────────────────────────

export interface CustomErrorInfo {
  componentStack: string | null | undefined;
  errorBoundary?: string;
  errorBoundaryStack?: string | null | undefined;
  digest?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: CustomErrorInfo | null;
  retryCount: number;
  errorId: string | null;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: CustomErrorInfo, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: CustomErrorInfo, errorId: string) => void;
  enableRetry?: boolean;
  maxRetries?: number;
  enableReporting?: boolean;
  componentName?: string;
  showErrorDetails?: boolean;
  isolateError?: boolean;
  borderTokens?: DesignTokenProps['borderTokens'];
  colors?: DesignTokenProps['colors'];
  typography?: DesignTokenProps['typography'];
  spacingTokens?: DesignTokenProps['spacingTokens'];
  t?: TFunction;
}

// ── Route Error Fallback Types ───────────────────────────────────────────────

export interface RouteErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  componentName?: string;
  enableReporting?: boolean;
  showErrorDetails?: boolean;
}

// ── Error Action Types ───────────────────────────────────────────────────────

export interface ErrorActionState {
  isReporting: boolean;
  reportSent: boolean;
  isSendingToAdmin: boolean;
  emailSent: boolean;
  copySuccess: boolean;
  showEmailOptions: boolean;
  pendingEmailData: EmailComposeOptions | null;
}

export interface ErrorActionHandlers {
  handleCopyDetails: () => Promise<void>;
  handleSendToAdmin: () => Promise<void>;
  handleReportError: () => Promise<void>;
  handleEmailProviderSelect: (provider: EmailProvider) => void;
  handleShowEmailOptions: () => void;
  handleGoHome: () => void;
  handleGoBack: () => void;
}

// ── ErrorFallbackUI Types ────────────────────────────────────────────────────

export interface ErrorFallbackUIProps {
  error: Error;
  errorId: string;
  errorInfo?: CustomErrorInfo | null;
  componentName?: string;
  enableRetry?: boolean;
  enableReporting?: boolean;
  showErrorDetails?: boolean;
  retryCount?: number;
  maxRetries?: number;
  onRetry: () => void;
  actionState: ErrorActionState;
  actionHandlers: ErrorActionHandlers;
  tokens: DesignTokenProps;
  showTourTrigger?: ReactNode;
  showTourButton?: boolean;
  onStartTour?: () => void;
  digest?: string;
}
