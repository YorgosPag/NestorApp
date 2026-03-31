'use client';

// ============================================================================
// 🏢 ENTERPRISE: RouteErrorFallback — Next.js Route Error Handler
// ============================================================================
// Thin wrapper: design token hooks + useErrorActions + ErrorFallbackUI.
// Used by 60+ error.tsx files across the app for consistent error UI.
// @pattern Google — Composition over duplication
// ============================================================================

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { generateErrorId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { useTourSafe } from '@/components/ui/ProductTour';
import { createErrorDialogTourConfig } from './errorDialogTour';
import { useErrorActions } from './useErrorActions';
import { useErrorReporting } from './useErrorReporting';
import { ErrorFallbackUI } from './ErrorFallbackUI';
import type { RouteErrorFallbackProps } from './types';

const logger = createModuleLogger('RouteErrorFallback');

export function RouteErrorFallback({
  error,
  reset,
  componentName = 'Route',
  enableReporting = true,
  showErrorDetails = process.env.NODE_ENV === 'development',
}: RouteErrorFallbackProps) {
  // ── Design Tokens ────────────────────────────────────────────────────────
  const borderTokens = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacingTokens = useSpacingTokens();
  const { t } = useTranslation('errors');

  // ── Error State ──────────────────────────────────────────────────────────
  const [errorId] = React.useState(() => generateErrorId());
  const { reportError } = useErrorReporting();
  const { startTour, shouldShowTour } = useTourSafe();

  // ── Shared Actions (via hook — zero duplication) ─────────────────────────
  const actions = useErrorActions({
    error,
    errorId,
    componentName,
    digest: error.digest,
  });

  // ── Effects ──────────────────────────────────────────────────────────────
  React.useEffect(() => {
    reportError(error, {
      component: componentName,
      action: 'Route Error Boundary',
      digest: error.digest,
      url: typeof window !== 'undefined' ? window.location.href : '',
    });
    logger.error('Route Error', { componentName, message: error.message });
  }, [error, componentName, reportError]);

  React.useEffect(() => {
    const TOUR_PERSISTENCE_KEY = 'error-dialog-tour-v1';
    const timer = setTimeout(() => {
      if (shouldShowTour('error-dialog-tour', TOUR_PERSISTENCE_KEY)) {
        startTour(createErrorDialogTourConfig());
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [shouldShowTour, startTour]);

  const handleStartTour = React.useCallback(() => {
    startTour(createErrorDialogTourConfig());
  }, [startTour]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <ErrorFallbackUI
      error={error}
      errorId={errorId}
      componentName={componentName}
      enableRetry
      enableReporting={enableReporting}
      showErrorDetails={showErrorDetails}
      onRetry={reset}
      actionState={actions}
      actionHandlers={actions}
      tokens={{ borderTokens, colors, typography, spacingTokens, t }}
      showTourButton
      onStartTour={handleStartTour}
      digest={error.digest}
    />
  );
}
