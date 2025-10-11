'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';

interface Props {
  children: ReactNode;
  translations?: {
    title: string;
    subtitle: string;
    errorDetails: string;
    errorMessage: string;
    stackTrace: string;
    componentStack: string;
    recoveryOptions: string;
    tryAgain: string;
    reloadPage: string;
    troubleshooting: string;
    troubleshootingTips: {
      tip1: string;
      tip2: string;
      tip3: string;
      tip4: string;
    };
    developmentMode: string;
    developmentInfo: string;
    systemVersion: string;
    platformName: string;
  };
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * GEO-CANVAS ERROR BOUNDARY - INNER CLASS COMPONENT
 * Enterprise-class error handling για το Geo-Alert system
 *
 * Features:
 * - Robust error catching και display
 * - Development-friendly error details
 * - Production-safe error messages
 * - Recovery mechanisms
 * - i18n support through props
 */
class GeoCanvasErrorBoundaryInner extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error για debugging
    console.error('GeoCanvas Error Boundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // TODO Phase 7: Send to error reporting service
    // if (FEATURE_FLAGS.ENABLE_ERROR_REPORTING) {
    //   errorReportingService.captureException(error, {
    //     context: 'GeoCanvasErrorBoundary',
    //     errorInfo,
    //   });
    // }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const t = this.props.translations || {
        title: 'Geo-Canvas System Error',
        subtitle: 'Something went wrong with the Geo-Alert system',
        errorDetails: 'Error Details',
        errorMessage: 'Error Message:',
        stackTrace: 'Stack Trace:',
        componentStack: 'Component Stack:',
        recoveryOptions: 'Recovery Options',
        tryAgain: '🔄 Try Again',
        reloadPage: '🔃 Reload Page',
        troubleshooting: 'Troubleshooting Tips:',
        troubleshootingTips: {
          tip1: '• Check browser console for additional errors',
          tip2: '• Ensure MapLibre GL JS dependencies are loaded',
          tip3: '• Verify coordinate transformation data',
          tip4: '• Check spatial database connectivity (Phase 4+)',
        },
        developmentMode: 'Development Mode:',
        developmentInfo: 'Additional debugging information is available above. Check the browser console for detailed logs and stack traces.',
        systemVersion: 'Geo-Canvas System v1.0.0 (Phase 1)',
        platformName: 'Enterprise Geo-Alert Platform',
      };

      return (
        <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">
          <div className="max-w-2xl mx-auto p-8">
            {/* Error Header */}
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-3xl font-bold text-red-400 mb-2">
                {t.title}
              </h1>
              <p className="text-gray-400">
                {t.subtitle}
              </p>
            </div>

            {/* Error Details */}
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-yellow-400">
                {t.errorDetails}
              </h2>

              {this.state.error && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-300 mb-2">
                    {t.errorMessage}
                  </div>
                  <div className="bg-red-900/20 border border-red-600 rounded p-3 text-red-300 font-mono text-sm">
                    {this.state.error.message}
                  </div>
                </div>
              )}

              {isDevelopment && this.state.error?.stack && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-300 mb-2">
                    {t.stackTrace}
                  </div>
                  <div className="bg-gray-900 border border-gray-600 rounded p-3 text-gray-300 font-mono text-xs overflow-x-auto max-h-40">
                    <pre>{this.state.error.stack}</pre>
                  </div>
                </div>
              )}

              {isDevelopment && this.state.errorInfo && (
                <div>
                  <div className="text-sm font-medium text-gray-300 mb-2">
                    {t.componentStack}
                  </div>
                  <div className="bg-gray-900 border border-gray-600 rounded p-3 text-gray-300 font-mono text-xs overflow-x-auto max-h-40">
                    <pre>{this.state.errorInfo.componentStack}</pre>
                  </div>
                </div>
              )}
            </div>

            {/* Recovery Actions */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-blue-400">
                {t.recoveryOptions}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={this.handleRetry}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  {t.tryAgain}
                </button>

                <button
                  onClick={this.handleReload}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  {t.reloadPage}
                </button>
              </div>

              <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
                <h3 className="font-semibold text-blue-400 mb-2">
                  {t.troubleshooting}
                </h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>{t.troubleshootingTips.tip1}</li>
                  <li>{t.troubleshootingTips.tip2}</li>
                  <li>{t.troubleshootingTips.tip3}</li>
                  <li>{t.troubleshootingTips.tip4}</li>
                </ul>
              </div>

              {isDevelopment && (
                <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-400 mb-2">
                    {t.developmentMode}
                  </h3>
                  <p className="text-sm text-gray-300">
                    {t.developmentInfo}
                  </p>
                </div>
              )}
            </div>

            {/* System Status */}
            <div className="mt-8 pt-6 border-t border-gray-700">
              <div className="text-center text-sm text-gray-400">
                <p>{t.systemVersion}</p>
                <p>{t.platformName}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * GEO-CANVAS ERROR BOUNDARY - WRAPPER WITH i18n
 * Functional wrapper component που παρέχει translations στο class component
 */
export function GeoCanvasErrorBoundary({ children }: { children: ReactNode }) {
  const { t, isLoading } = useTranslationLazy('geo-canvas');

  // Get the translations or use defaults while loading
  const translations = isLoading ? undefined : {
    title: t('errorBoundary.title'),
    subtitle: t('errorBoundary.subtitle'),
    errorDetails: t('errorBoundary.errorDetails'),
    errorMessage: t('errorBoundary.errorMessage'),
    stackTrace: t('errorBoundary.stackTrace'),
    componentStack: t('errorBoundary.componentStack'),
    recoveryOptions: t('errorBoundary.recoveryOptions'),
    tryAgain: t('errorBoundary.tryAgain'),
    reloadPage: t('errorBoundary.reloadPage'),
    troubleshooting: t('errorBoundary.troubleshooting'),
    troubleshootingTips: {
      tip1: t('errorBoundary.troubleshootingTips.tip1'),
      tip2: t('errorBoundary.troubleshootingTips.tip2'),
      tip3: t('errorBoundary.troubleshootingTips.tip3'),
      tip4: t('errorBoundary.troubleshootingTips.tip4'),
    },
    developmentMode: t('errorBoundary.developmentMode'),
    developmentInfo: t('errorBoundary.developmentInfo'),
    systemVersion: t('errorBoundary.systemVersion'),
    platformName: t('errorBoundary.platformName'),
  };

  return (
    <GeoCanvasErrorBoundaryInner translations={translations}>
      {children}
    </GeoCanvasErrorBoundaryInner>
  );
}

export default GeoCanvasErrorBoundary;