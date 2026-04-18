// ============================================================================
// 🏢 ENTERPRISE: useErrorActions Hook — Unified Error Action State
// ============================================================================
// Eliminates duplication between ErrorBoundary class and RouteErrorFallback.
// Single source of truth for: copy, sendToAdmin, report, email, navigation.
// @pattern Google — Custom hook for shared stateful logic
// ============================================================================

import { useState, useCallback } from 'react';
import { copyToClipboard } from '@/lib/share-utils';
import { errorTracker } from '@/services/ErrorTracker';
import { notificationConfig } from '@/config/error-reporting';
import { createModuleLogger } from '@/lib/telemetry';
import { openEmailCompose } from './email-compose';
import { getUserId, getErrorSeverity, formatErrorForEmail, goHome, goBack } from './error-helpers';
import type { EmailProvider, EmailComposeOptions, ErrorActionState, ErrorActionHandlers } from './types';
import { reportErrorNotificationWithPolicy } from '@/services/notification/notification-mutation-gateway';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('useErrorActions');

interface UseErrorActionsParams {
  error: Error;
  errorId: string;
  componentName: string;
  digest?: string;
  componentStack?: string | null;
  retryCount?: number;
}

export function useErrorActions(params: UseErrorActionsParams): ErrorActionState & ErrorActionHandlers {
  const { error, errorId, componentName, digest, componentStack, retryCount } = params;

  const [isReporting, setIsReporting] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [isSendingToAdmin, setIsSendingToAdmin] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showEmailOptions, setShowEmailOptions] = useState(false);
  const [pendingEmailData, setPendingEmailData] = useState<EmailComposeOptions | null>(null);

  const buildErrorDetails = useCallback(() => ({
    errorId,
    message: error.message,
    stack: error.stack,
    componentStack: componentStack ?? undefined,
    timestamp: nowISO(),
    url: typeof window !== 'undefined' ? window.location.href : 'SSR',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
    userId: getUserId(),
    component: componentName,
    severity: getErrorSeverity(error),
    digest,
    retryCount,
  }), [error, errorId, componentName, digest, componentStack, retryCount]);

  const handleCopyDetails = useCallback(async () => {
    const details = buildErrorDetails();
    try {
      const success = await copyToClipboard(JSON.stringify(details, null, 2));
      if (success) {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    } catch (copyError) {
      logger.error('Failed to copy error details', { error: copyError });
    }
  }, [buildErrorDetails]);

  const handleSendToAdmin = useCallback(async () => {
    setIsSendingToAdmin(true);

    const details = buildErrorDetails();

    try {
      const notificationPayload = {
        errorId,
        message: error.message,
        stack: error.stack,
        componentStack: componentStack ?? undefined,
        component: componentName,
        severity: getErrorSeverity(error),
        timestamp: nowISO(),
        url: typeof window !== 'undefined' ? window.location.href : 'SSR',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
        digest,
        retryCount,
      };

      const response = await reportErrorNotificationWithPolicy(
        notificationPayload
      );

      if (response.success) {
        setEmailSent(true);
        errorTracker.captureUserError(
          'Error report sent to admin',
          'sendToAdmin',
          { errorId, notificationId: response.notificationId ?? 'unknown' }
        );
        logger.info('Error report sent successfully', { notificationId: response.notificationId });
      } else {
        throw new Error(response.error ?? 'Failed to create notification');
      }
    } catch (sendError) {
      logger.error('Failed to send error via API, falling back to email', { error: sendError });

      const adminEmail = notificationConfig.channels.adminEmail;
      const subject = `🚨 ${getErrorSeverity(error).toUpperCase()} Error - ${componentName}`;
      const body = formatErrorForEmail(details);

      setPendingEmailData({ to: adminEmail, subject, body });
      setShowEmailOptions(true);
    } finally {
      setIsSendingToAdmin(false);
    }
  }, [error, errorId, componentName, digest, componentStack, retryCount, buildErrorDetails]);

  const handleReportError = useCallback(async () => {
    setIsReporting(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      logger.info('Error report sent', { errorId });
      setReportSent(true);
    } catch (reportingError) {
      logger.error('Failed to report error', { error: reportingError });
    } finally {
      setIsReporting(false);
    }
  }, [errorId]);

  const handleEmailProviderSelect = useCallback((provider: EmailProvider) => {
    if (pendingEmailData) {
      openEmailCompose(provider, pendingEmailData);
      setEmailSent(true);
      setShowEmailOptions(false);
      setPendingEmailData(null);
    }
  }, [pendingEmailData]);

  const handleShowEmailOptions = useCallback(() => {
    const details = buildErrorDetails();
    const adminEmail = notificationConfig.channels.adminEmail;
    const subject = `🚨 ${getErrorSeverity(error).toUpperCase()} Error - ${componentName}`;
    const body = formatErrorForEmail(details);

    setPendingEmailData({ to: adminEmail, subject, body });
    setShowEmailOptions(true);
  }, [error, componentName, buildErrorDetails]);

  const handleGoHome = useCallback(() => goHome(), []);
  const handleGoBack = useCallback(() => goBack(), []);

  return {
    // State
    isReporting,
    reportSent,
    isSendingToAdmin,
    emailSent,
    copySuccess,
    showEmailOptions,
    pendingEmailData,
    // Handlers
    handleCopyDetails,
    handleSendToAdmin,
    handleReportError,
    handleEmailProviderSelect,
    handleShowEmailOptions,
    handleGoHome,
    handleGoBack,
  };
}
