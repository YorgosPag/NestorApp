'use client';

// ============================================================================
// 🏢 ENTERPRISE: Error Boundary Wrapper Components
// ============================================================================
// Design-token-injecting wrappers around the core ErrorBoundary class.
// useDesignTokens eliminates repeated 5-hook calls across wrappers.
// @pattern Google — DRY wrapper composition
// ============================================================================

import React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { componentSizes } from '@/styles/design-tokens';
import { ErrorBoundary } from './ErrorBoundaryClass';
import { translateErrorMessage } from './error-message-translator';
import type { ErrorBoundaryProps, DesignTokenProps } from './types';

// ── Shared hook: eliminates 4x repeated 5-hook pattern ───────────────────

function useDesignTokens(): DesignTokenProps {
  const borderTokens = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacingTokens = useSpacingTokens();
  const { t } = useTranslation('errors');
  return { borderTokens, colors, typography, spacingTokens, t };
}

type WrapperProps = Omit<ErrorBoundaryProps, 'borderTokens' | 'colors' | 'typography' | 'spacingTokens' | 't'>;

// ── EnterpriseErrorBoundary ──────────────────────────────────────────────

export function EnterpriseErrorBoundary(props: WrapperProps) {
  const tokens = useDesignTokens();
  return <ErrorBoundary {...props} {...tokens} />;
}

// ── PageErrorBoundary ────────────────────────────────────────────────────

export function PageErrorBoundary({
  children,
  componentName = 'Page',
  ...props
}: WrapperProps) {
  const tokens = useDesignTokens();
  return (
    <ErrorBoundary
      componentName={componentName}
      enableRetry
      maxRetries={2}
      enableReporting
      {...tokens}
      {...props}
    >
      {children}
    </ErrorBoundary>
  );
}

// ── ComponentErrorBoundary ───────────────────────────────────────────────

export function ComponentErrorBoundary({
  children,
  ...props
}: Omit<WrapperProps, 'isolateError'>) {
  const tokens = useDesignTokens();
  return (
    <ErrorBoundary
      isolateError
      enableRetry
      maxRetries={1}
      showErrorDetails={false}
      {...tokens}
      fallback={(error, _, retry) => (
        <div className={`${tokens.spacingTokens.padding.md} ${tokens.borderTokens.quick.error} ${tokens.colors.bg.error}`}>
          <div className={`flex items-center justify-between ${tokens.spacingTokens.gap.sm}`}>
            <div>
              <p className={`${tokens.typography.label.sm} ${tokens.colors.text.error}`}>
                {tokens.t('boundary.title')}
              </p>
              <p className={`${tokens.typography.body.sm} ${tokens.colors.text.error}`}>
                {translateErrorMessage(error, tokens.t)}
              </p>
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
