'use client';

// ============================================================================
// 🏢 ENTERPRISE: Tour Integration Wrappers for ErrorBoundary
// ============================================================================
// Product Tour (ADR-037) integration for error dialogs.
// @pattern Google — Feature composition via wrappers
// ============================================================================

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTourSafe } from '@/components/ui/ProductTour';
import { createErrorDialogTourConfig } from './errorDialogTour';
import { ErrorBoundary } from './ErrorBoundaryClass';
import { RouteErrorFallback } from './RouteErrorFallback';
import type { CustomErrorInfo, ErrorBoundaryProps } from './types';

// ── ErrorDialogTourTrigger ───────────────────────────────────────────────
// Function component that triggers the Product Tour when error UI is shown.
// Needed because class components cannot use hooks directly.

export function ErrorDialogTourTrigger() {
  const { startTour, shouldShowTour } = useTourSafe();

  React.useEffect(() => {
    const TOUR_PERSISTENCE_KEY = 'error-dialog-tour-v1';
    const timer = setTimeout(() => {
      if (shouldShowTour('error-dialog-tour', TOUR_PERSISTENCE_KEY)) {
        startTour(createErrorDialogTourConfig());
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [shouldShowTour, startTour]);

  return null;
}

// ── ErrorFallbackWithTour ────────────────────────────────────────────────

interface ErrorFallbackWithTourProps {
  error: Error;
  errorInfo: CustomErrorInfo;
  retry: () => void;
  componentName?: string;
}

function ErrorFallbackWithTour({ error, retry, componentName = 'Component' }: ErrorFallbackWithTourProps) {
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

// ── EnterpriseErrorBoundaryWithTour ──────────────────────────────────────

type TourWrapperProps = Omit<
  ErrorBoundaryProps,
  'borderTokens' | 'colors' | 'typography' | 'spacingTokens' | 't' | 'fallback'
>;

export function EnterpriseErrorBoundaryWithTour({
  children,
  componentName = 'Component',
  enableRetry = true,
  maxRetries = 2,
  enableReporting = true,
  showErrorDetails = process.env.NODE_ENV === 'development',
  onError,
}: TourWrapperProps) {
  const borderTokens = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacingTokens = useSpacingTokens();
  const { t } = useTranslation('errors');

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
