'use client';

// ============================================================================
// 🏢 ENTERPRISE: ErrorBoundary Class Component
// ============================================================================
// React class component for catching render errors (componentDidCatch).
// Slim lifecycle + Bridge pattern to delegate rendering to ErrorFallbackUI.
// @pattern Google — Class for lifecycle, hooks via bridge, zero duplication
// ============================================================================

import React, { Component, type ErrorInfo as ReactErrorInfo } from 'react';
import i18next from 'i18next';
import { getStatusColor } from '@/lib/design-system';
import { errorTracker } from '@/services/ErrorTracker';
import { generateErrorId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { useErrorActions } from './useErrorActions';
import { ErrorFallbackUI } from './ErrorFallbackUI';
import { ErrorDialogTourTrigger } from './tour-wrappers';
import type {
  CustomErrorInfo,
  ErrorBoundaryProps,
  ErrorBoundaryState,
  DesignTokenProps,
} from './types';

const logger = createModuleLogger('ErrorBoundary');

// ── Bridge Component: Allows hooks inside class render ───────────────────────

function ErrorBoundaryFallbackBridge(props: {
  error: Error;
  errorId: string;
  errorInfo: CustomErrorInfo | null;
  componentName: string;
  tokens: DesignTokenProps;
  enableRetry: boolean;
  maxRetries: number;
  enableReporting: boolean;
  showErrorDetails: boolean;
  retryCount: number;
  onRetry: () => void;
}) {
  const {
    error, errorId, errorInfo, componentName,
    tokens, enableRetry, maxRetries, enableReporting,
    showErrorDetails, retryCount, onRetry,
  } = props;

  const actions = useErrorActions({
    error,
    errorId,
    componentName,
    componentStack: errorInfo?.componentStack,
    retryCount,
  });

  return (
    <ErrorFallbackUI
      error={error}
      errorId={errorId}
      errorInfo={errorInfo}
      componentName={componentName}
      enableRetry={enableRetry}
      enableReporting={enableReporting}
      showErrorDetails={showErrorDetails}
      retryCount={retryCount}
      maxRetries={maxRetries}
      onRetry={onRetry}
      actionState={actions}
      actionHandlers={actions}
      tokens={tokens}
      showTourTrigger={<ErrorDialogTourTrigger />}
    />
  );
}

// ── ErrorBoundary Class ──────────────────────────────────────────────────────

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, errorId: generateErrorId() };
  }

  componentDidCatch(error: Error, errorInfo: ReactErrorInfo) {
    const { onError, componentName } = this.props;

    const customErrorInfo: CustomErrorInfo = {
      componentStack: errorInfo.componentStack,
      errorBoundary: componentName || 'ErrorBoundary',
      errorBoundaryStack: errorInfo.componentStack,
      digest: errorInfo.digest || undefined,
    };

    this.setState({ errorInfo: customErrorInfo });

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
          errorBoundaryComponent: componentName || 'Unknown',
          hasCustomFallback: !!this.props.fallback,
          enableRetry: this.props.enableRetry,
          maxRetries: this.props.maxRetries,
          isolateError: this.props.isolateError,
        },
      }
    );

    if (process.env.NODE_ENV === 'development') {
      logger.error('Error Boundary Caught Error', {
        message: error.message,
        componentStack: customErrorInfo.componentStack,
        errorStack: error.stack,
        trackerErrorId,
      });
    }

    if (onError && this.state.errorId) {
      onError(error, customErrorInfo, trackerErrorId || this.state.errorId);
    }

    if (this.props.enableRetry && this.state.retryCount < (this.props.maxRetries || 3)) {
      this.scheduleRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private scheduleRetry = () => {
    const delay = Math.pow(2, this.state.retryCount) * 1000;
    this.retryTimeoutId = setTimeout(() => this.retry(), delay);
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
    }));
  };

  render() {
    const {
      hasError, error, errorInfo, retryCount, errorId,
    } = this.state;
    const {
      children, fallback,
      enableRetry = true, maxRetries = 3,
      enableReporting = true,
      showErrorDetails = process.env.NODE_ENV === 'development',
      componentName = 'Unknown',
      borderTokens, colors, typography, spacingTokens, t,
    } = this.props;

    if (hasError && error && errorId) {
      if (fallback) {
        return fallback(error, errorInfo!, this.retry);
      }

      if (borderTokens && colors && typography && spacingTokens && t) {
        return (
          <ErrorBoundaryFallbackBridge
            error={error}
            errorId={errorId}
            errorInfo={errorInfo}
            componentName={componentName}
            tokens={{ borderTokens, colors, typography, spacingTokens, t }}
            enableRetry={enableRetry}
            maxRetries={maxRetries}
            enableReporting={enableReporting}
            showErrorDetails={showErrorDetails}
            retryCount={retryCount}
            onRetry={this.retry}
          />
        );
      }

      // Emergency fallback — tokens not injected, no hook-based TFunction available.
      // Uses i18next global instance directly (class component pattern).
      const tFallback = i18next.t.bind(i18next);
      const borderColor = getStatusColor('error', 'border');
      const textColor = getStatusColor('error', 'text');
      return (
        <main className="min-h-screen bg-background flex items-center justify-center p-4">
          <article className={`max-w-md w-full bg-card border ${borderColor} p-8 rounded-lg shadow-lg`}>
            <h1 className={`text-xl font-semibold ${textColor} mb-4`}>{tFallback('errors:boundary.title')}</h1>
            <p className={`text-sm ${textColor} mb-4`}>{tFallback('errors:generic.unknown')}</p>
            <button
              onClick={this.retry}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              {tFallback('errors:actions.tryAgain')}
            </button>
          </article>
        </main>
      );
    }

    return children;
  }
}

export { ErrorBoundary };

// ── HOC ──────────────────────────────────────────────────────────────────────

export function withErrorBoundary<T extends Record<string, unknown>>(
  WrappedComponent: React.ComponentType<T>,
  errorBoundaryProps?: Partial<ErrorBoundaryProps>
) {
  const WithErrorBoundary = (props: T) => (
    <ErrorBoundary
      componentName={WrappedComponent.displayName || WrappedComponent.name}
      {...errorBoundaryProps}
    >
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  return WithErrorBoundary;
}
