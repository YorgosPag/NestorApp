'use client';

import React, { Component, ErrorInfo as ReactErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft, Bug, Copy, Check, Mail, Send, Globe, HelpCircle, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { errorTracker, type MetadataRecord } from '@/services/ErrorTracker';
import { notificationConfig } from '@/config/error-reporting';
import { componentSizes } from '@/styles/design-tokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography, type UseTypographyReturn } from '@/hooks/useTypography';
import { useSpacingTokens, type SpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { generateErrorId } from '@/services/enterprise-id.service';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
// 🏢 ENTERPRISE: Product Tour System (ADR-037) - Safe wrapper for graceful degradation
import { useTourSafe } from '@/components/ui/ProductTour';
import { ERROR_DIALOG_BUTTON_IDS, createErrorDialogTourConfig } from './errorDialogTour';

// ============================================================================
// 🏢 ENTERPRISE: Universal Email Compose Helper
// Supports: Gmail, Outlook, Yahoo, Apple Mail, and any desktop email client
// ============================================================================

export type EmailProvider = 'gmail' | 'outlook' | 'yahoo' | 'default';

export interface EmailComposeOptions {
  to: string;
  subject: string;
  body: string;
}

/**
 * Opens email compose window for the specified provider
 * @param provider - Email provider ('gmail' | 'outlook' | 'yahoo' | 'default')
 * @param options - Email options (to, subject, body)
 */
export function openEmailCompose(provider: EmailProvider, options: EmailComposeOptions): void {
  const { to, subject, body } = options;
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);

  let url: string;

  switch (provider) {
    case 'gmail':
      // Gmail compose URL
      url = `https://mail.google.com/mail/?view=cm&to=${to}&su=${encodedSubject}&body=${encodedBody}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      break;

    case 'outlook':
      // Outlook.com / Hotmail compose URL
      url = `https://outlook.live.com/mail/0/deeplink/compose?to=${to}&subject=${encodedSubject}&body=${encodedBody}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      break;

    case 'yahoo':
      // Yahoo Mail compose URL
      url = `https://compose.mail.yahoo.com/?to=${to}&subject=${encodedSubject}&body=${encodedBody}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      break;

    case 'default':
    default:
      // Default: mailto: link (works with Outlook desktop, Apple Mail, Thunderbird, etc.)
      // Use anchor element click for better browser compatibility
      url = `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
      const link = document.createElement('a');
      link.href = url;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      break;
  }

  console.log(`[Email] Opened ${provider} compose for:`, to);
}

/**
 * 🏢 ENTERPRISE: Email provider options with Lucide icons
 */
export interface EmailProviderConfig {
  id: EmailProvider;
  label: string;
  labelEl: string; // Greek label
  Icon: LucideIcon;
}

export const EMAIL_PROVIDERS: EmailProviderConfig[] = [
  { id: 'gmail', label: 'Gmail', labelEl: 'Gmail', Icon: Mail },
  { id: 'outlook', label: 'Outlook / Hotmail', labelEl: 'Outlook / Hotmail', Icon: Mail },
  { id: 'yahoo', label: 'Yahoo Mail', labelEl: 'Yahoo Mail', Icon: Mail },
  { id: 'default', label: 'Default Email App', labelEl: 'Εφαρμογή Email', Icon: Globe },
];

interface CustomErrorInfo {
  componentStack: string | null | undefined; // ✅ ENTERPRISE: Handle React's full nullable componentStack
  errorBoundary?: string;
  errorBoundaryStack?: string | null | undefined; // ✅ ENTERPRISE: Handle nullable stack
  digest?: string; // ✅ ENTERPRISE: Added missing React ErrorInfo property
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: CustomErrorInfo | null;
  retryCount: number;
  isReporting: boolean;
  reportSent: boolean;
  errorId: string | null;
  isSendingToAdmin: boolean;
  emailSent: boolean;
  copySuccess: boolean;
  showEmailOptions: boolean; // 🏢 ENTERPRISE: Show email provider selection
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: CustomErrorInfo, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: CustomErrorInfo, errorId: string) => void;
  enableRetry?: boolean;
  maxRetries?: number;
  enableReporting?: boolean;
  componentName?: string;
  showErrorDetails?: boolean;
  isolateError?: boolean; // Prevent error from bubbling up
  borderTokens?: ReturnType<typeof useBorderTokens>; // 🏢 ENTERPRISE: Border tokens injection
  colors?: ReturnType<typeof useSemanticColors>; // 🏢 ENTERPRISE: Semantic colors injection
  typography?: UseTypographyReturn; // 🏢 ENTERPRISE: Typography tokens injection
  spacingTokens?: SpacingTokens; // 🏢 ENTERPRISE: Spacing tokens injection
  t?: TFunction; // 🏢 ENTERPRISE: i18n translation function injection
}

// ============================================================================
// 🏢 ENTERPRISE: Tour Trigger Component for Error Dialog
// ============================================================================
// Function component that triggers the Product Tour when error UI is shown.
// This is needed because class components cannot use hooks directly.
// ============================================================================

function ErrorDialogTourTrigger() {
  const { startTour, shouldShowTour } = useTourSafe();

  React.useEffect(() => {
    const TOUR_PERSISTENCE_KEY = 'error-dialog-tour-v1';

    // Small delay to ensure DOM elements are rendered with their IDs
    const timer = setTimeout(() => {
      if (shouldShowTour('error-dialog-tour', TOUR_PERSISTENCE_KEY)) {
        const tourConfig = createErrorDialogTourConfig();
        startTour(tourConfig);
      }
    }, 800); // Wait for buttons to render with IDs

    return () => clearTimeout(timer);
  }, [shouldShowTour, startTour]);

  // This component doesn't render anything - it just triggers the tour
  return null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;
  private pendingEmailData: EmailComposeOptions | null = null; // 🏢 ENTERPRISE: Store email data for provider selection

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isReporting: false,
      reportSent: false,
      errorId: null,
      isSendingToAdmin: false,
      emailSent: false,
      copySuccess: false,
      showEmailOptions: false
    };
  }

  // 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = generateErrorId();
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ReactErrorInfo) {
    const { onError, componentName } = this.props;

    // ✅ ENTERPRISE: Convert ReactErrorInfo to CustomErrorInfo format
    const customErrorInfo: CustomErrorInfo = {
      componentStack: errorInfo.componentStack,
      errorBoundary: componentName || 'ErrorBoundary',
      errorBoundaryStack: errorInfo.componentStack,
      digest: errorInfo.digest || undefined // React 18+ error digest (handle null)
    };

    this.setState({ errorInfo: customErrorInfo });

    // **🚀 INTEGRATION WITH ERRORTRACKER SERVICE**
    // Capture error με το ErrorTracker service
    const trackerErrorId = errorTracker.captureError(
      error,
      'error',
      'system',
      {
        component: componentName || 'ErrorBoundary',
        action: 'React Component Error',
        metadata: {
          componentStack: errorInfo.componentStack,
          retryCount: this.state.retryCount,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
          url: window.location.href,
          userId: this.getUserId(),
          // ErrorBoundary specific context
          errorBoundaryComponent: componentName || 'Unknown',
          hasCustomFallback: !!this.props.fallback,
          enableRetry: this.props.enableRetry,
          maxRetries: this.props.maxRetries,
          isolateError: this.props.isolateError
        }
      }
    );

    // Enhanced error logging
    const enhancedError = {
      ...error,
      timestamp: new Date().toISOString(),
      component: componentName || 'Unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
      url: window.location.href,
      userId: this.getUserId(),
      errorInfo: customErrorInfo,
      trackerErrorId // Add ErrorTracker ID
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Component Stack:', customErrorInfo.componentStack);
      console.error('Error Stack:', error.stack);
      console.error('ErrorTracker ID:', trackerErrorId);
      console.groupEnd();
    }

    // Call custom error handler με ErrorTracker ID
    if (onError && this.state.errorId) {
      onError(error, customErrorInfo, trackerErrorId || this.state.errorId);
    }

    // Auto-retry after delay if enabled
    if (this.props.enableRetry && this.state.retryCount < (this.props.maxRetries || 3)) {
      this.scheduleRetry();
    }
  }

  private getUserId(): string | null {
    try {
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);
        return user.email || user.id || null;
      }
    } catch {
      // Ignore localStorage errors
    }
    return null;
  }

  private scheduleRetry = () => {
    // Progressive backoff: 1s, 2s, 4s
    const delay = Math.pow(2, this.state.retryCount) * 1000;
    
    this.retryTimeoutId = setTimeout(() => {
      this.retry();
    }, delay);
  };

  private retry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
      reportSent: false,
      emailSent: false,
      copySuccess: false
    }));
  };

  private reportError = async () => {
    const { error, errorInfo, errorId } = this.state;
    if (!error || !errorId) return;

    this.setState({ isReporting: true });

    try {
      // Simulate error reporting API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const errorReport = {
        errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        component: this.props.componentName,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
        url: window.location.href,
        userId: this.getUserId()
      };

      // In a real app, send to error reporting service
      console.log('Error report sent:', errorReport);
      
      this.setState({ reportSent: true });
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    } finally {
      this.setState({ isReporting: false });
    }
  };

  private copyErrorDetails = async () => {
    const { error, errorInfo, errorId } = this.state;
    if (!error) return;

    const errorDetails = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
      userId: this.getUserId(),
      component: this.props.componentName
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
      this.setState({ copySuccess: true });
      setTimeout(() => this.setState({ copySuccess: false }), 2000);
    } catch (error) {
      console.error('Failed to copy error details:', error);
    }
  };

  private sendToAdmin = async () => {
    const { error, errorInfo, errorId } = this.state;

    console.log('🔔 [sendToAdmin] Starting...', { hasError: !!error, errorId });

    if (!error || !errorId) {
      console.log('🔔 [sendToAdmin] Aborted - no error or errorId');
      return;
    }

    this.setState({ isSendingToAdmin: true });
    console.log('🔔 [sendToAdmin] State set to isSendingToAdmin: true');

    // Define errorDetails outside try block so it's accessible in catch
    const errorDetails = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
      userId: this.getUserId(),
      component: this.props.componentName || 'Unknown',
      severity: this.getErrorSeverity(error),
      retryCount: this.state.retryCount
    };

    try {
      // 🏢 ENTERPRISE: Direct Firestore notification (no email dependency)
      // This creates an in-app notification for the admin instantly
      const notificationPayload = {
        errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        component: this.props.componentName || 'Unknown',
        severity: this.getErrorSeverity(error),
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
        retryCount: this.state.retryCount
      };

      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      // Type definition for API response
      interface ErrorReportApiResponse {
        success: boolean;
        notificationId?: string;
        error?: string;
      }

      console.log('🔔 [sendToAdmin] Calling API...', { errorId, component: notificationPayload.component });

      const response = await apiClient.post('/api/notifications/error-report', notificationPayload) as ErrorReportApiResponse;

      console.log('🔔 [sendToAdmin] API response:', response);

      if (response.success) {
        this.setState({ emailSent: true });

        // Track successful admin notification
        errorTracker.captureUserError(
          'Error report sent to admin (direct notification)',
          'sendToAdmin',
          { errorId, notificationId: response.notificationId ?? 'unknown' }
        );

        console.log('✅ Error report sent successfully:', response.notificationId);
      } else {
        throw new Error(response.error ?? 'Failed to create notification');
      }

    } catch (sendError) {
      console.error('Failed to send error via direct notification, falling back to email:', sendError);

      // 🏢 ENTERPRISE FALLBACK: Show email provider options
      // If direct notification fails, allow user to send email manually
      try {
        const adminEmail = notificationConfig.channels.adminEmail;
        const subject = `🚨 ${this.getErrorSeverity(error).toUpperCase()} Error Report - ${this.props.componentName || 'Application'}`;
        const body = this.formatErrorForEmail(errorDetails);

        // Store email data for later use and show provider selection
        this.pendingEmailData = { to: adminEmail, subject, body };
        this.setState({ showEmailOptions: true, isSendingToAdmin: false });

        console.log('📧 Showing email provider options for:', adminEmail);
        return; // Exit early, user will select provider
      } catch (mailtoError) {
        console.error('Mailto fallback also failed:', mailtoError);

        // Track failed admin notification
        errorTracker.captureError(
          sendError instanceof Error ? sendError : new Error(String(sendError)),
          'error',
          'system',
          {
            component: 'ErrorBoundary',
            action: 'sendToAdmin',
            metadata: { originalErrorId: errorId }
          }
        );
      }
    } finally {
      this.setState({ isSendingToAdmin: false });
    }
  };

  // 🏢 ENTERPRISE: Handle email provider selection
  private handleEmailProviderSelect = (provider: EmailProvider) => {
    if (this.pendingEmailData) {
      openEmailCompose(provider, this.pendingEmailData);
      this.setState({ emailSent: true, showEmailOptions: false });
      this.pendingEmailData = null;
    }
  };

  private getErrorSeverity(error: Error): 'critical' | 'error' | 'warning' {
    const message = error.message.toLowerCase();

    // Critical errors
    if (message.includes('authentication') ||
        message.includes('authorization') ||
        message.includes('security') ||
        message.includes('payment') ||
        message.includes('data corruption')) {
      return 'critical';
    }

    // Regular errors
    if (message.includes('network') ||
        message.includes('api') ||
        message.includes('database')) {
      return 'error';
    }

    return 'warning';
  }

  private formatErrorForEmail(errorDetails: {
    errorId: string | null;
    message: string;
    stack?: string;
    componentStack?: string | null;
    timestamp: string;
    url: string;
    userAgent: string;
    userId: string | null;
    component?: string;
    severity: string;
    retryCount: number;
  }): string {
    return `
🚨 ERROR REPORT - GEO-ALERT SYSTEM

📋 ERROR DETAILS:
• Error ID: ${errorDetails.errorId}
• Message: ${errorDetails.message}
• Component: ${errorDetails.component}
• Severity: ${errorDetails.severity.toUpperCase()}
• Retry Count: ${errorDetails.retryCount}

⏰ OCCURRENCE:
• Timestamp: ${errorDetails.timestamp}
• URL: ${errorDetails.url}
• User ID: ${errorDetails.userId || 'Anonymous'}

🔧 TECHNICAL DETAILS:
• User Agent: ${errorDetails.userAgent}
• Component Stack:
${errorDetails.componentStack || 'Not available'}

📚 ERROR STACK:
${errorDetails.stack || 'Stack trace not available'}

---
Αυτό το email στάλθηκε αυτόματα από το GEO-ALERT Error Reporting System.
    `.trim();
  };

  private goHome = () => {
    window.location.href = '/';
  };

  private goBack = () => {
    window.history.back();
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    const {
      hasError,
      error,
      errorInfo,
      retryCount,
      isReporting,
      reportSent,
      isSendingToAdmin,
      emailSent,
      copySuccess
    } = this.state;
    const {
      children,
      fallback,
      enableRetry = true,
      maxRetries = 3,
      enableReporting = true,
      showErrorDetails = process.env.NODE_ENV === 'development',
      componentName,
      borderTokens,
      colors,
      typography,
      spacingTokens,
      t
    } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, errorInfo!, this.retry);
      }

      // Default error UI - Using centralized tokens
      const paddingMd = spacingTokens?.padding.md || 'p-4';
      const paddingXl = spacingTokens?.padding.xl || 'p-8';
      const paddingSm = spacingTokens?.padding.sm || 'p-2';
      const marginBottomLg = spacingTokens?.margin.bottom.lg || 'mb-6';
      const gapSm = spacingTokens?.gap.sm || 'gap-2';
      const radiusFull = borderTokens?.radiusClass.full || 'rounded-full';
      const radiusMd = borderTokens?.radiusClass.md || 'rounded-md';
      const headingLg = typography?.heading.lg || 'text-xl font-semibold';
      const bodySm = typography?.body.sm || 'text-sm';
      const bodyXs = typography?.body.xs || 'text-xs';
      const labelSm = typography?.label.sm || 'text-sm font-medium';

      return (
        <main className={`min-h-screen ${colors ? colors.bg.primary : 'bg-background'} flex items-center justify-center ${paddingMd}`}>
          {/* 🏢 ENTERPRISE: Product Tour Trigger (ADR-037) */}
          {/* This triggers the tour when error UI is shown */}
          <ErrorDialogTourTrigger />

          <article className="max-w-2xl w-full">
            <section className={`bg-card ${borderTokens ? borderTokens.quick.error : 'border'} ${paddingXl} shadow-lg ${radiusMd}`}>
              {/* Error Header */}
              <header className={`flex items-center ${gapSm} ${marginBottomLg}`}>
                <figure className={`${paddingSm} ${colors ? colors.bg.error : 'bg-red-50'} ${radiusFull}`}>
                  <AlertTriangle className={`${componentSizes.icon.xl} ${colors ? colors.text.error : 'text-red-600'}`} />
                </figure>
                <div>
                  <h1 className={`${headingLg} ${colors ? colors.text.error : 'text-red-600'}`}>
                    {t ? t('boundary.subtitle') : 'Something went wrong'}
                  </h1>
                  <p className={colors ? colors.text.error : 'text-red-600'}>
                    {componentName
                      ? (t ? t('boundary.subtitleWithComponent', { component: componentName }) : `Error in ${componentName}`)
                      : (t ? t('boundary.unexpectedError') : 'An unexpected error occurred')}
                  </p>
                </div>
              </header>

              {/* Error Message */}
              <section className={`${marginBottomLg} ${paddingMd} ${colors ? colors.bg.error : 'bg-red-50'} ${borderTokens ? borderTokens.quick.error : 'border'} ${radiusMd}`}>
                <p className={`${colors ? colors.text.error : 'text-red-600'} ${labelSm}`}>
                  {error.message}
                </p>
              </section>

              {/* Action Buttons */}
              <nav className={`flex flex-wrap ${gapSm} ${marginBottomLg}`}>
                {enableRetry && retryCount < maxRetries && (
                  <Button
                    id={ERROR_DIALOG_BUTTON_IDS.retry}
                    onClick={this.retry}
                    variant="default"
                    className={`flex items-center ${gapSm}`}
                  >
                    <RefreshCw className={componentSizes.icon.sm} />
                    <span>
                      {retryCount > 0
                        ? (t ? t('boundary.tryAgainCount', { current: retryCount + 1, max: maxRetries + 1 }) : `Try Again (${retryCount + 1}/${maxRetries + 1})`)
                        : (t ? t('boundary.tryAgain') : 'Try Again')}
                    </span>
                  </Button>
                )}

                <Button
                  id={ERROR_DIALOG_BUTTON_IDS.back}
                  onClick={this.goBack}
                  variant="outline"
                  className={`flex items-center ${gapSm}`}
                >
                  <ArrowLeft className={componentSizes.icon.sm} />
                  <span>{t ? t('boundary.back') : 'Back'}</span>
                </Button>

                <Button
                  id={ERROR_DIALOG_BUTTON_IDS.home}
                  onClick={this.goHome}
                  variant="outline"
                  className={`flex items-center ${gapSm}`}
                >
                  <Home className={componentSizes.icon.sm} />
                  <span>{t ? t('boundary.home') : 'Home'}</span>
                </Button>
              </nav>

              {/* Enterprise Error Reporting & Admin Notification */}
              {enableReporting && (
                <section className={spacingTokens?.spaceBetween.md || 'space-y-4'}>
                  {/* Copy & Admin Email Actions */}
                  <div className={`flex items-center justify-between ${paddingMd} bg-muted ${radiusMd} flex-wrap ${gapSm}`}>
                    <div className={`flex items-center ${gapSm}`}>
                      <Bug className={`${componentSizes.icon.md} text-muted-foreground`} />
                      <div>
                        <p className={labelSm}>{t ? t('boundary.errorActions') : 'Error Actions'}</p>
                        <p className={`${bodySm} text-muted-foreground`}>
                          {t ? t('boundary.errorActionsDesc') : 'Copy details or notify administrator'}
                        </p>
                      </div>
                    </div>
                    <div className={`flex flex-wrap ${gapSm}`}>
                      <Button
                        id={ERROR_DIALOG_BUTTON_IDS.copy}
                        onClick={this.copyErrorDetails}
                        disabled={copySuccess}
                        variant="outline"
                        size="sm"
                        className={`flex items-center ${gapSm}`}
                      >
                        {copySuccess ? (
                          <>
                            <Check className={`${componentSizes.icon.sm} ${colors ? colors.text.success : 'text-green-600'}`} />
                            <span>{t ? t('boundary.copied') : 'Copied!'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className={componentSizes.icon.sm} />
                            <span>{t ? t('boundary.copy') : 'Copy'}</span>
                          </>
                        )}
                      </Button>
                      <Button
                        id={ERROR_DIALOG_BUTTON_IDS.notify}
                        onClick={this.sendToAdmin}
                        disabled={isSendingToAdmin || emailSent || this.state.showEmailOptions}
                        variant={this.getErrorSeverity(error) === 'critical' ? 'destructive' : 'default'}
                        size="sm"
                        className={`flex items-center ${gapSm}`}
                      >
                        {isSendingToAdmin ? (
                          <>
                            <RefreshCw className={`${componentSizes.icon.sm} animate-spin`} />
                            <span>{t ? t('boundary.sending') : 'Sending...'}</span>
                          </>
                        ) : emailSent ? (
                          <>
                            <Check className={`${componentSizes.icon.sm} ${colors ? colors.text.success : 'text-green-600'}`} />
                            <span>{t ? t('boundary.sent') : 'Sent!'}</span>
                          </>
                        ) : (
                          <>
                            <Mail className={componentSizes.icon.sm} />
                            <span>{t ? t('boundary.notifyAdmin') : 'Notify Admin'}</span>
                          </>
                        )}
                      </Button>
                      <Button
                        id={ERROR_DIALOG_BUTTON_IDS.email}
                        onClick={() => this.setState({ showEmailOptions: true })}
                        disabled={this.state.showEmailOptions}
                        variant="outline"
                        size="sm"
                        className={`flex items-center ${gapSm}`}
                      >
                        <Mail className={componentSizes.icon.sm} />
                        <span>{t ? t('boundary.sendEmail') : 'Send Email'}</span>
                      </Button>
                    </div>
                  </div>

                  {/* 🏢 ENTERPRISE: Email Provider Selection - Centralized Styles */}
                  {this.state.showEmailOptions && (
                    <div className={`${paddingMd} bg-muted border ${borderTokens ? borderTokens.quick.default : 'border-border'} ${radiusMd}`}>
                      <p className={`${labelSm} ${colors ? colors.text.primary : 'text-foreground'} ${spacingTokens?.margin.bottom.sm || 'mb-2'} flex items-center ${gapSm}`}>
                        <Mail className={componentSizes.icon.sm} />
                        <span>{t ? t('boundary.selectEmailProvider') : 'Select your email provider:'}</span>
                      </p>
                      <div className={`grid grid-cols-2 ${gapSm}`}>
                        {EMAIL_PROVIDERS.map((provider) => {
                          const IconComponent = provider.Icon;
                          return (
                            <Button
                              key={provider.id}
                              onClick={() => this.handleEmailProviderSelect(provider.id)}
                              variant="outline"
                              size="sm"
                              className={`flex items-center justify-start ${gapSm}`}
                            >
                              <IconComponent className={componentSizes.icon.sm} />
                              <span>{provider.label}</span>
                            </Button>
                          );
                        })}
                      </div>
                      <p className={`${bodyXs} ${colors ? colors.text.muted : 'text-muted-foreground'} ${spacingTokens?.margin.top.sm || 'mt-2'}`}>
                        {t ? t('boundary.emailWillOpen') : 'A new tab will open with the email ready to send'}
                      </p>
                    </div>
                  )}

                  {/* Traditional Error Reporting */}
                  <div className={`flex items-center justify-between ${paddingMd} bg-muted/50 ${radiusMd} flex-wrap ${gapSm}`}>
                    <div className={`flex items-center ${gapSm}`}>
                      <Send className={`${componentSizes.icon.md} text-muted-foreground`} />
                      <div>
                        <p className={labelSm}>{t ? t('boundary.anonymousReport') : 'Anonymous Report'}</p>
                        <p className={`${bodySm} text-muted-foreground`}>
                          {t ? t('boundary.anonymousReportDesc') : 'Send an anonymous report to improve the system'}
                        </p>
                      </div>
                    </div>
                    <Button
                      id={ERROR_DIALOG_BUTTON_IDS.report}
                      onClick={this.reportError}
                      disabled={isReporting || reportSent}
                      variant="outline"
                      size="sm"
                    >
                      {isReporting ? (
                        <>
                          <RefreshCw className={`${componentSizes.icon.sm} ${spacingTokens?.margin.right.sm || 'mr-2'} animate-spin`} />
                          {t ? t('boundary.sending') : 'Sending...'}
                        </>
                      ) : reportSent ? (
                        <>
                          <Check className={`${componentSizes.icon.sm} ${spacingTokens?.margin.right.sm || 'mr-2'} ${colors ? colors.text.success : 'text-green-600'}`} />
                          {t ? t('boundary.sent') : 'Sent!'}
                        </>
                      ) : (
                        t ? t('boundary.reportError') : 'Report Error'
                      )}
                    </Button>
                  </div>
                </section>
              )}

              {/* Error Details (Development) */}
              {showErrorDetails && (
                <details className={spacingTokens?.margin.top.lg || 'mt-6'}>
                  <summary className={`cursor-pointer text-muted-foreground ${INTERACTIVE_PATTERNS.TEXT_HOVER} ${spacingTokens?.margin.bottom.sm || 'mb-2'}`}>
                    {t ? t('boundary.technicalDetails') : 'Technical Details'}
                  </summary>
                  <div className={spacingTokens?.spaceBetween.md || 'space-y-4'}>
                    <div>
                      <div className={`flex items-center justify-between ${spacingTokens?.margin.bottom.sm || 'mb-2'}`}>
                        <h4 className={labelSm}>{t ? t('boundary.errorStack') : 'Error Stack'}</h4>
                        <Button
                          onClick={this.copyErrorDetails}
                          variant="ghost"
                          size="sm"
                          disabled={copySuccess}
                        >
                          {copySuccess ? (
                            <Check className={`${componentSizes.icon.sm} ${colors ? colors.text.success : 'text-green-600'}`} />
                          ) : (
                            <Copy className={componentSizes.icon.sm} />
                          )}
                        </Button>
                      </div>
                      <pre className={`${bodyXs} bg-muted ${paddingSm} ${borderTokens?.radiusClass.default || 'rounded'} overflow-auto max-h-40`}>
                        {error.stack}
                      </pre>
                    </div>

                    {errorInfo?.componentStack && (
                      <div>
                        <h4 className={`${labelSm} ${spacingTokens?.margin.bottom.sm || 'mb-2'}`}>{t ? t('boundary.componentStack') : 'Component Stack'}</h4>
                        <pre className={`${bodyXs} bg-muted ${paddingSm} ${borderTokens?.radiusClass.default || 'rounded'} overflow-auto max-h-40`}>
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}

                    <div className={`${bodyXs} text-muted-foreground ${spacingTokens?.spaceBetween.xs || 'space-y-1'}`}>
                      <p><strong>{t ? t('boundary.errorId') : 'Error ID'}:</strong> {this.state.errorId}</p>
                      <p><strong>{t ? t('boundary.timestamp') : 'Timestamp'}:</strong> {new Date().toISOString()}</p>
                      <p><strong>{t ? t('boundary.url') : 'URL'}:</strong> {window.location.href}</p>
                    </div>
                  </div>
                </details>
              )}
            </section>
          </article>
        </main>
      );
    }

    return children;
  }
}

// HOC for easier error boundary wrapping
export function withErrorBoundary<T extends {}>(
  Component: React.ComponentType<T>,
  errorBoundaryProps?: Partial<ErrorBoundaryProps>
) {
  const WrappedComponent = (props: T) => (
    <ErrorBoundary 
      componentName={Component.displayName || Component.name}
      {...errorBoundaryProps}
    >
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Hook for manual error reporting με ErrorTracker integration
export function useErrorReporting() {
  return {
    reportError: (error: Error, context?: Record<string, unknown>) => {
      // **🚀 USE ERRORTRACKER SERVICE**
      const errorId = errorTracker.captureError(
        error,
        'error',
        'user',
        {
          component: 'Manual Error Report',
          action: 'useErrorReporting Hook',
          metadata: {
            ...context,
            manual: true,
            hookUsage: true
          }
        }
      );

      // Legacy error report για backward compatibility
      const errorReport = {
        errorId, // Include ErrorTracker ID
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR'
      };

      console.error('Manual error report:', errorReport);
      return errorId; // Return ErrorTracker ID για reference
    },

    // **🆕 NEW: Direct access to ErrorTracker methods**
    captureUserError: (message: string, action: string, metadata?: MetadataRecord) => {
      return errorTracker.captureUserError(message, action, metadata);
    },

    captureNetworkError: (url: string, status: number, statusText: string, method?: string) => {
      return errorTracker.captureNetworkError(url, status, statusText, method);
    },

    capturePerformanceIssue: (metric: string, value: number, threshold: number) => {
      return errorTracker.capturePerformanceIssue(metric, value, threshold);
    },

    // Get error statistics
    getErrorStats: () => errorTracker.getStats(),

    // Clear all errors
    clearErrors: () => errorTracker.clearErrors()
  };
}

// OLD specialized error boundaries removed - replaced with Enterprise versions below

// 🏢 ENTERPRISE: Wrapper component που inject τα design tokens (borders, colors, typography, spacing, i18n)
export function EnterpriseErrorBoundary(props: Omit<ErrorBoundaryProps, 'borderTokens' | 'colors' | 'typography' | 'spacingTokens' | 't'>) {
  const borderTokens = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacingTokens = useSpacingTokens();
  const { t } = useTranslation('errors');

  return <ErrorBoundary {...props} borderTokens={borderTokens} colors={colors} typography={typography} spacingTokens={spacingTokens} t={t} />;
}

// 🏢 ENTERPRISE: Enhanced specialized error boundaries
export function PageErrorBoundary({ children, componentName = 'Page', ...props }: Omit<ErrorBoundaryProps, 'borderTokens' | 'colors' | 'typography' | 'spacingTokens' | 't'>) {
  const borderTokens = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacingTokens = useSpacingTokens();
  const { t } = useTranslation('errors');

  return (
    <ErrorBoundary
      componentName={componentName}
      enableRetry
      maxRetries={2}
      enableReporting
      borderTokens={borderTokens}
      colors={colors}
      typography={typography}
      spacingTokens={spacingTokens}
      t={t}
      {...props}
    >
      {children}
    </ErrorBoundary>
  );
}

export function ComponentErrorBoundary({ children, ...props }: Omit<ErrorBoundaryProps, 'isolateError' | 'borderTokens' | 'colors' | 'typography' | 'spacingTokens' | 't'>) {
  const borderTokens = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacingTokens = useSpacingTokens();
  const { t } = useTranslation('errors');

  return (
    <ErrorBoundary
      isolateError
      enableRetry
      maxRetries={1}
      showErrorDetails={false}
      borderTokens={borderTokens}
      colors={colors}
      typography={typography}
      spacingTokens={spacingTokens}
      t={t}
      fallback={(error, _, retry) => (
        <div className={`${spacingTokens.padding.md} ${borderTokens.quick.error} ${colors.bg.error}`}>
          <div className={`flex items-center justify-between ${spacingTokens.gap.sm}`}>
            <div>
              <p className={`${typography.label.sm} ${colors.text.error}`}>{t('boundary.title')}</p>
              <p className={`${typography.body.sm} ${colors.text.error}`}>{error.message}</p>
            </div>
            <Button onClick={retry} variant="outline" size="sm">
              <RefreshCw className={componentSizes.icon.sm} />
            </Button>
          </div>
        </div>
      )}
      {...props}
    >
      {children}
    </ErrorBoundary>
  );
}

// ============================================================================
// 🏢 ENTERPRISE: Route Error Fallback for Next.js error.tsx files
// ============================================================================
// This component provides the SAME UI as ErrorBoundary but for Next.js App Router
// route-level error handling (error.tsx files).
//
// @pattern SAP/Salesforce/Microsoft - Single Source of Truth for Error UI
// @usage Import in any error.tsx file for consistent error experience
// ============================================================================

/**
 * Props for RouteErrorFallback component
 * Compatible with Next.js App Router error.tsx convention
 */
export interface RouteErrorFallbackProps {
  /** The error object from Next.js */
  error: Error & { digest?: string };
  /** Reset function to retry rendering */
  reset: () => void;
  /** Component/route name for context */
  componentName?: string;
  /** Enable error reporting features */
  enableReporting?: boolean;
  /** Show technical details (default: development only) */
  showErrorDetails?: boolean;
}

/**
 * 🏢 ENTERPRISE: Route Error Fallback Component
 *
 * Provides consistent error UI across all Next.js route error boundaries.
 * Features:
 * - Email provider selection (Gmail, Outlook, Yahoo, Default)
 * - Copy error details to clipboard
 * - Notify administrator (via API + email fallback)
 * - Anonymous error reporting
 * - Technical details (development mode)
 * - Notification bell integration
 *
 * @example
 * ```tsx
 * // src/app/files/error.tsx
 * import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';
 *
 * export default function FileManagerError({ error, reset }: ErrorProps) {
 *   return <RouteErrorFallback error={error} reset={reset} componentName="FileManager" />;
 * }
 * ```
 *
 * @enterprise SAP/Salesforce/Microsoft error handling standard
 */
export function RouteErrorFallback({
  error,
  reset,
  componentName = 'Route',
  enableReporting = true,
  showErrorDetails = process.env.NODE_ENV === 'development',
}: RouteErrorFallbackProps) {
  // === Hooks - 🏢 ENTERPRISE: Centralized Design Tokens + i18n ===
  const borderTokens = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacingTokens = useSpacingTokens();
  const { t } = useTranslation('errors');
  const { reportError } = useErrorReporting();
  // 🏢 ENTERPRISE: Use safe tour hook - graceful degradation if TourProvider not available
  const { startTour, shouldShowTour } = useTourSafe();

  // 🏢 ENTERPRISE: Start tour handler
  const handleStartTour = React.useCallback(() => {
    const tourConfig = createErrorDialogTourConfig();
    startTour(tourConfig);
  }, [startTour]);

  // === State ===
  const [errorId] = React.useState(() => generateErrorId());
  const [isReporting, setIsReporting] = React.useState(false);
  const [reportSent, setReportSent] = React.useState(false);
  const [isSendingToAdmin, setIsSendingToAdmin] = React.useState(false);
  const [emailSent, setEmailSent] = React.useState(false);
  const [copySuccess, setCopySuccess] = React.useState(false);
  const [showEmailOptions, setShowEmailOptions] = React.useState(false);
  const [pendingEmailData, setPendingEmailData] = React.useState<EmailComposeOptions | null>(null);

  // === Effects ===
  React.useEffect(() => {
    // Log error to enterprise error reporting service
    reportError(error, {
      component: componentName,
      action: 'Route Error Boundary',
      digest: error.digest,
      url: typeof window !== 'undefined' ? window.location.href : ''
    });

    console.error(`🚨 Route Error in ${componentName}:`, error);
  }, [error, componentName, reportError]);

  // 🏢 ENTERPRISE: Auto-start tour when error dialog appears (ADR-037)
  // Tour starts automatically unless user has dismissed it before
  React.useEffect(() => {
    const TOUR_PERSISTENCE_KEY = 'error-dialog-tour-v1';

    // Small delay to ensure DOM elements are rendered with their IDs
    const timer = setTimeout(() => {
      if (shouldShowTour('error-dialog-tour', TOUR_PERSISTENCE_KEY)) {
        const tourConfig = createErrorDialogTourConfig();
        startTour(tourConfig);
      }
    }, 800); // Wait for buttons to render with IDs

    return () => clearTimeout(timer);
  }, [shouldShowTour, startTour]);

  // === Helper Functions ===
  const getUserId = (): string | null => {
    try {
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);
        return user.email || user.id || null;
      }
    } catch {
      // Ignore localStorage errors
    }
    return null;
  };

  const getErrorSeverity = (err: Error): 'critical' | 'error' | 'warning' => {
    const message = err.message.toLowerCase();

    if (message.includes('authentication') ||
        message.includes('authorization') ||
        message.includes('security') ||
        message.includes('payment') ||
        message.includes('data corruption')) {
      return 'critical';
    }

    if (message.includes('network') ||
        message.includes('api') ||
        message.includes('database')) {
      return 'error';
    }

    return 'warning';
  };

  const formatErrorForEmail = (errorDetails: {
    errorId: string;
    message: string;
    stack?: string;
    timestamp: string;
    url: string;
    userAgent: string;
    userId: string | null;
    component: string;
    severity: string;
    digest?: string;
  }): string => {
    return `
🚨 ERROR REPORT - NESTOR PLATFORM
=====================================

📋 ERROR DETAILS:
• Error ID: ${errorDetails.errorId}
• Message: ${errorDetails.message}
• Component: ${errorDetails.component}
• Severity: ${errorDetails.severity.toUpperCase()}
${errorDetails.digest ? `• Digest: ${errorDetails.digest}` : ''}

⏰ OCCURRENCE:
• Timestamp: ${errorDetails.timestamp}
• URL: ${errorDetails.url}
• User ID: ${errorDetails.userId || 'Anonymous'}

🔧 TECHNICAL DETAILS:
• User Agent: ${errorDetails.userAgent}

📚 ERROR STACK:
${errorDetails.stack || 'Stack trace not available'}

---
Αυτό το email στάλθηκε αυτόματα από το Nestor Error Reporting System.
    `.trim();
  };

  // === Action Handlers ===
  const handleCopyDetails = async () => {
    const errorDetails = {
      errorId,
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'SSR',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
      userId: getUserId(),
      component: componentName,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (copyError) {
      console.error('Failed to copy error details:', copyError);
    }
  };

  const handleSendToAdmin = async () => {
    setIsSendingToAdmin(true);

    const errorDetails = {
      errorId,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'SSR',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
      userId: getUserId(),
      component: componentName,
      severity: getErrorSeverity(error),
      digest: error.digest,
    };

    try {
      // 🏢 ENTERPRISE: Direct Firestore notification via API
      interface ErrorReportApiResponse {
        success: boolean;
        notificationId?: string;
        error?: string;
      }

      const notificationPayload = {
        errorId,
        message: error.message,
        stack: error.stack,
        component: componentName,
        severity: getErrorSeverity(error),
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : 'SSR',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
        digest: error.digest,
      };

      const response = await apiClient.post('/api/notifications/error-report', notificationPayload) as ErrorReportApiResponse;

      if (response.success) {
        setEmailSent(true);
        errorTracker.captureUserError(
          'Error report sent to admin (route error)',
          'sendToAdmin',
          { errorId, notificationId: response.notificationId ?? 'unknown' }
        );
        console.log('✅ Error report sent successfully:', response.notificationId);
      } else {
        throw new Error(response.error ?? 'Failed to create notification');
      }

    } catch (sendError) {
      console.error('Failed to send error via API, falling back to email:', sendError);

      // 🏢 ENTERPRISE FALLBACK: Show email provider options
      const adminEmail = notificationConfig.channels.adminEmail;
      const subject = `🚨 ${getErrorSeverity(error).toUpperCase()} Route Error - ${componentName}`;
      const body = formatErrorForEmail(errorDetails);

      setPendingEmailData({ to: adminEmail, subject, body });
      setShowEmailOptions(true);
    } finally {
      setIsSendingToAdmin(false);
    }
  };

  const handleEmailProviderSelect = (provider: EmailProvider) => {
    if (pendingEmailData) {
      openEmailCompose(provider, pendingEmailData);
      setEmailSent(true);
      setShowEmailOptions(false);
      setPendingEmailData(null);
    }
  };

  /**
   * 🏢 ENTERPRISE: Show email provider options directly (user choice)
   * Allows user to manually select email provider without API fallback
   */
  const handleShowEmailOptions = () => {
    const errorDetails = {
      errorId,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'SSR',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
      userId: getUserId(),
      component: componentName,
      severity: getErrorSeverity(error),
      digest: error.digest,
    };

    const adminEmail = notificationConfig.channels.adminEmail;
    const subject = `🚨 ${getErrorSeverity(error).toUpperCase()} Route Error - ${componentName}`;
    const body = formatErrorForEmail(errorDetails);

    setPendingEmailData({ to: adminEmail, subject, body });
    setShowEmailOptions(true);
  };

  const handleReportError = async () => {
    setIsReporting(true);

    try {
      // Simulate error reporting API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      const errorReport = {
        errorId,
        message: error.message,
        stack: error.stack,
        component: componentName,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
        url: typeof window !== 'undefined' ? window.location.href : 'SSR',
        userId: getUserId(),
      };

      console.log('Error report sent:', errorReport);
      setReportSent(true);
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    } finally {
      setIsReporting(false);
    }
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleGoBack = () => {
    window.history.back();
  };

  // === Render - 🏢 ENTERPRISE: Using Centralized Design Tokens ===
  return (
    <main className={`min-h-screen ${colors.bg.primary} flex items-center justify-center ${spacingTokens.padding.md}`}>
      <article className="max-w-2xl w-full">
        <section className={`bg-card ${borderTokens.quick.error} ${spacingTokens.padding.xl} shadow-lg ${borderTokens.radiusClass.lg}`}>
          {/* Error Header */}
          <header className={`flex items-center ${spacingTokens.gap.sm} ${spacingTokens.margin.bottom.lg}`}>
            <figure className={`${spacingTokens.padding.sm} ${colors.bg.error} ${borderTokens.radiusClass.full}`}>
              <AlertTriangle className={`${componentSizes.icon.xl} ${colors.text.error}`} />
            </figure>
            <div>
              <h1 className={`${typography.heading.lg} ${colors.text.error}`}>
                {t('boundary.title')}
              </h1>
              <p className={colors.text.error}>
                {componentName
                  ? t('boundary.subtitleWithComponent', { component: componentName })
                  : t('boundary.unexpectedError')}
              </p>
            </div>
          </header>

          {/* Error Message */}
          <section className={`${spacingTokens.margin.bottom.lg} ${spacingTokens.padding.md} ${colors.bg.error} ${borderTokens.quick.error} ${borderTokens.radiusClass.md}`}>
            <p className={`${colors.text.error} ${typography.label.sm}`}>
              {error.message}
            </p>
          </section>

          {/* Action Buttons */}
          <nav className={`flex flex-wrap ${spacingTokens.gap.sm} ${spacingTokens.margin.bottom.lg}`}>
            <Button
              id={ERROR_DIALOG_BUTTON_IDS.retry}
              onClick={reset}
              variant="default"
              className={`flex items-center ${spacingTokens.gap.sm}`}
            >
              <RefreshCw className={componentSizes.icon.sm} />
              <span>{t('boundary.tryAgain')}</span>
            </Button>

            <Button
              id={ERROR_DIALOG_BUTTON_IDS.back}
              onClick={handleGoBack}
              variant="outline"
              className={`flex items-center ${spacingTokens.gap.sm}`}
            >
              <ArrowLeft className={componentSizes.icon.sm} />
              <span>{t('boundary.back')}</span>
            </Button>

            <Button
              id={ERROR_DIALOG_BUTTON_IDS.home}
              onClick={handleGoHome}
              variant="outline"
              className={`flex items-center ${spacingTokens.gap.sm}`}
            >
              <Home className={componentSizes.icon.sm} />
              <span>{t('boundary.home')}</span>
            </Button>

            {/* 🏢 ENTERPRISE: Help Tour Button (ADR-037) - Shows tour again */}
            <Button
              id={ERROR_DIALOG_BUTTON_IDS.helpButton}
              onClick={handleStartTour}
              variant="ghost"
              className={`flex items-center ${spacingTokens.gap.sm}`}
              title={t('boundary.guide')}
            >
              <HelpCircle className={componentSizes.icon.sm} />
              <span>{t('boundary.guide')}</span>
            </Button>
          </nav>

          {/* Enterprise Error Reporting & Admin Notification */}
          {enableReporting && (
            <section className={spacingTokens.spaceBetween.md}>
              {/* Copy & Admin Email Actions */}
              <div className={`flex items-center justify-between ${spacingTokens.padding.md} bg-muted ${borderTokens.radiusClass.md}`}>
                <div className={`flex items-center ${spacingTokens.gap.sm}`}>
                  <Bug className={`${componentSizes.icon.md} text-muted-foreground`} />
                  <div>
                    <p className={typography.label.sm}>{t('boundary.errorActions')}</p>
                    <p className={`${typography.body.sm} text-muted-foreground`}>
                      {t('boundary.errorActionsDesc')}
                    </p>
                  </div>
                </div>
                <div className={`flex flex-wrap ${spacingTokens.gap.sm}`}>
                  <Button
                    id={ERROR_DIALOG_BUTTON_IDS.copy}
                    onClick={handleCopyDetails}
                    disabled={copySuccess}
                    variant="outline"
                    size="sm"
                    className={`flex items-center ${spacingTokens.gap.sm}`}
                  >
                    {copySuccess ? (
                      <>
                        <Check className={`${componentSizes.icon.sm} ${colors.text.success}`} />
                        <span>{t('boundary.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className={componentSizes.icon.sm} />
                        <span>{t('boundary.copy')}</span>
                      </>
                    )}
                  </Button>
                  <Button
                    id={ERROR_DIALOG_BUTTON_IDS.notify}
                    onClick={handleSendToAdmin}
                    disabled={isSendingToAdmin || emailSent}
                    variant={getErrorSeverity(error) === 'critical' ? 'destructive' : 'default'}
                    size="sm"
                    className={`flex items-center ${spacingTokens.gap.sm}`}
                  >
                    {isSendingToAdmin ? (
                      <>
                        <RefreshCw className={`${componentSizes.icon.sm} animate-spin`} />
                        <span>{t('boundary.sending')}</span>
                      </>
                    ) : emailSent ? (
                      <>
                        <Check className={`${componentSizes.icon.sm} ${colors.text.success}`} />
                        <span>{t('boundary.sent')}</span>
                      </>
                    ) : (
                      <>
                        <Send className={componentSizes.icon.sm} />
                        <span>{t('boundary.notifyAdmin')}</span>
                      </>
                    )}
                  </Button>
                  {/* 🏢 ENTERPRISE: Direct Email Button - Always visible */}
                  <Button
                    id={ERROR_DIALOG_BUTTON_IDS.email}
                    onClick={handleShowEmailOptions}
                    disabled={showEmailOptions || emailSent}
                    variant="outline"
                    size="sm"
                    className={`flex items-center ${spacingTokens.gap.sm}`}
                  >
                    <Mail className={componentSizes.icon.sm} />
                    <span>{t('boundary.sendEmail')}</span>
                  </Button>
                </div>
              </div>

              {/* 🏢 ENTERPRISE: Email Provider Selection - User Choice */}
              {showEmailOptions && (
                <div className={`${spacingTokens.padding.md} bg-muted border ${borderTokens.quick.default} ${borderTokens.radiusClass.md}`}>
                  <p className={`${typography.label.sm} ${colors.text.primary} ${spacingTokens.margin.bottom.sm} flex items-center ${spacingTokens.gap.sm}`}>
                    <Mail className={componentSizes.icon.sm} />
                    <span>{t('boundary.selectEmailProvider')}</span>
                  </p>
                  <div className={`grid grid-cols-2 ${spacingTokens.gap.sm}`}>
                    {EMAIL_PROVIDERS.map((provider) => {
                      const IconComponent = provider.Icon;
                      return (
                        <Button
                          key={provider.id}
                          onClick={() => handleEmailProviderSelect(provider.id)}
                          variant="outline"
                          size="sm"
                          className={`flex items-center justify-start ${spacingTokens.gap.sm}`}
                        >
                          <IconComponent className={componentSizes.icon.sm} />
                          <span>{provider.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                  <p className={`${typography.body.xs} ${colors.text.muted} ${spacingTokens.margin.top.sm}`}>
                    {t('boundary.emailWillOpen')}
                  </p>
                </div>
              )}

              {/* Anonymous Error Reporting */}
              <div className={`flex items-center justify-between ${spacingTokens.padding.md} bg-muted/50 ${borderTokens.radiusClass.md}`}>
                <div className={`flex items-center ${spacingTokens.gap.sm}`}>
                  <Send className={`${componentSizes.icon.md} text-muted-foreground`} />
                  <div>
                    <p className={typography.label.sm}>{t('boundary.anonymousReport')}</p>
                    <p className={`${typography.body.sm} text-muted-foreground`}>
                      {t('boundary.anonymousReportDesc')}
                    </p>
                  </div>
                </div>
                <Button
                  id={ERROR_DIALOG_BUTTON_IDS.report}
                  onClick={handleReportError}
                  disabled={isReporting || reportSent}
                  variant="outline"
                  size="sm"
                >
                  {isReporting ? (
                    <>
                      <RefreshCw className={`${componentSizes.icon.sm} ${spacingTokens.margin.right.sm} animate-spin`} />
                      {t('boundary.sending')}
                    </>
                  ) : reportSent ? (
                    <>
                      <Check className={`${componentSizes.icon.sm} ${spacingTokens.margin.right.sm} ${colors.text.success}`} />
                      {t('boundary.sent')}
                    </>
                  ) : (
                    t('boundary.reportError')
                  )}
                </Button>
              </div>
            </section>
          )}

          {/* Error Details (Development) */}
          {showErrorDetails && (
            <details className={spacingTokens.margin.top.lg}>
              <summary className={`cursor-pointer text-muted-foreground ${INTERACTIVE_PATTERNS.TEXT_HOVER} ${spacingTokens.margin.bottom.sm}`}>
                {t('boundary.technicalDetails')}
              </summary>
              <div className={spacingTokens.spaceBetween.md}>
                <div>
                  <div className={`flex items-center justify-between ${spacingTokens.margin.bottom.sm}`}>
                    <h4 className={typography.label.sm}>{t('boundary.errorStack')}</h4>
                    <Button
                      onClick={handleCopyDetails}
                      variant="ghost"
                      size="sm"
                      disabled={copySuccess}
                    >
                      {copySuccess ? (
                        <Check className={`${componentSizes.icon.sm} ${colors.text.success}`} />
                      ) : (
                        <Copy className={componentSizes.icon.sm} />
                      )}
                    </Button>
                  </div>
                  <pre className={`${typography.body.xs} bg-muted ${spacingTokens.padding.sm} ${borderTokens.radiusClass.default} overflow-auto max-h-40`}>
                    {error.stack}
                  </pre>
                </div>

                <div className={`${typography.body.xs} text-muted-foreground ${spacingTokens.spaceBetween.xs}`}>
                  <p><strong>{t('boundary.errorId')}:</strong> {errorId}</p>
                  {error.digest && <p><strong>{t('boundary.digest')}:</strong> {error.digest}</p>}
                  <p><strong>{t('boundary.timestamp')}:</strong> {new Date().toISOString()}</p>
                  <p><strong>{t('boundary.url')}:</strong> {typeof window !== 'undefined' ? window.location.href : 'SSR'}</p>
                </div>
              </div>
            </details>
          )}

          {/* Admin Email Info */}
          <footer className={`${spacingTokens.margin.top.lg} ${spacingTokens.padding.top.md} border-t text-center ${typography.body.xs} text-muted-foreground`}>
            <p>{t('boundary.adminEmail')}: {notificationConfig.channels.adminEmail}</p>
          </footer>
        </section>
      </article>
    </main>
  );
}

// ============================================================================
// 🏢 ENTERPRISE: ErrorBoundary with Tour Support
// ============================================================================
// This component provides CENTRALIZED tour integration for class-based ErrorBoundary
// It wraps the class component and provides a fallback with tour functionality
// ============================================================================

/**
 * Props for the fallback component used by EnterpriseErrorBoundaryWithTour
 */
interface ErrorFallbackWithTourProps {
  error: Error;
  errorInfo: CustomErrorInfo;
  retry: () => void;
  componentName?: string;
}

/**
 * 🏢 ENTERPRISE: Fallback component with Tour support
 * This provides the same UI as RouteErrorFallback but compatible with ErrorBoundary fallback prop
 */
function ErrorFallbackWithTour({ error, retry, componentName = 'Component' }: ErrorFallbackWithTourProps) {
  // Wrap the error to match RouteErrorFallback props
  const wrappedError = Object.assign(error, { digest: undefined }) as Error & { digest?: string };

  return (
    <RouteErrorFallback
      error={wrappedError}
      reset={retry}
      componentName={componentName}
      enableReporting
      showErrorDetails={process.env.NODE_ENV === 'development'}
    />
  );
}

/**
 * 🏢 ENTERPRISE: ErrorBoundary with Tour Support
 *
 * This is the RECOMMENDED ErrorBoundary for use throughout the application.
 * It provides:
 * - All features of EnterpriseErrorBoundary (design tokens, i18n)
 * - Product Tour integration (ADR-037)
 * - Consistent error UI across the entire application
 *
 * @example
 * ```tsx
 * // In DxfViewerApp.tsx or any component
 * <EnterpriseErrorBoundaryWithTour componentName="DxfViewer">
 *   <MyComponent />
 * </EnterpriseErrorBoundaryWithTour>
 * ```
 *
 * @enterprise SAP/Microsoft/Salesforce - Centralized Error Handling with Guided Recovery
 */
export function EnterpriseErrorBoundaryWithTour({
  children,
  componentName = 'Component',
  enableRetry = true,
  maxRetries = 2,
  enableReporting = true,
  showErrorDetails = process.env.NODE_ENV === 'development',
  onError,
}: Omit<ErrorBoundaryProps, 'borderTokens' | 'colors' | 'typography' | 'spacingTokens' | 't' | 'fallback'>) {
  const borderTokens = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacingTokens = useSpacingTokens();
  const { t } = useTranslation('errors');

  // 🏢 ENTERPRISE: Custom fallback with tour support
  const fallbackWithTour = React.useCallback(
    (error: Error, errorInfo: CustomErrorInfo, retry: () => void) => (
      <ErrorFallbackWithTour
        error={error}
        errorInfo={errorInfo}
        retry={retry}
        componentName={componentName}
      />
    ),
    [componentName]
  );

  return (
    <ErrorBoundary
      componentName={componentName}
      enableRetry={enableRetry}
      maxRetries={maxRetries}
      enableReporting={enableReporting}
      showErrorDetails={showErrorDetails}
      onError={onError}
      fallback={fallbackWithTour}
      borderTokens={borderTokens}
      colors={colors}
      typography={typography}
      spacingTokens={spacingTokens}
      t={t}
    >
      {children}
    </ErrorBoundary>
  );
}

// Export both raw class και enterprise wrapper
export default EnterpriseErrorBoundary;
