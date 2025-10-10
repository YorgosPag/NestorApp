'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * GEO-CANVAS ERROR BOUNDARY
 * Enterprise-class error handling για το Geo-Alert system
 *
 * Features:
 * - Robust error catching και display
 * - Development-friendly error details
 * - Production-safe error messages
 * - Recovery mechanisms
 */
export class GeoCanvasErrorBoundary extends Component<Props, State> {
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

      return (
        <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">
          <div className="max-w-2xl mx-auto p-8">
            {/* Error Header */}
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-3xl font-bold text-red-400 mb-2">
                Geo-Canvas System Error
              </h1>
              <p className="text-gray-400">
                Κάτι πήγε στραβά με το Geo-Alert σύστημα
              </p>
            </div>

            {/* Error Details */}
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-yellow-400">
                Error Details
              </h2>

              {this.state.error && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-300 mb-2">
                    Error Message:
                  </div>
                  <div className="bg-red-900/20 border border-red-600 rounded p-3 text-red-300 font-mono text-sm">
                    {this.state.error.message}
                  </div>
                </div>
              )}

              {isDevelopment && this.state.error?.stack && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-300 mb-2">
                    Stack Trace:
                  </div>
                  <div className="bg-gray-900 border border-gray-600 rounded p-3 text-gray-300 font-mono text-xs overflow-x-auto max-h-40">
                    <pre>{this.state.error.stack}</pre>
                  </div>
                </div>
              )}

              {isDevelopment && this.state.errorInfo && (
                <div>
                  <div className="text-sm font-medium text-gray-300 mb-2">
                    Component Stack:
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
                Recovery Options
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={this.handleRetry}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  🔄 Try Again
                </button>

                <button
                  onClick={this.handleReload}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  🔃 Reload Page
                </button>
              </div>

              <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
                <h3 className="font-semibold text-blue-400 mb-2">
                  Troubleshooting Tips:
                </h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Check browser console για additional errors</li>
                  <li>• Ensure MapLibre GL JS dependencies are loaded</li>
                  <li>• Verify coordinate transformation data</li>
                  <li>• Check spatial database connectivity (Phase 4+)</li>
                </ul>
              </div>

              {isDevelopment && (
                <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-400 mb-2">
                    Development Mode:
                  </h3>
                  <p className="text-sm text-gray-300">
                    Additional debugging information is available above.
                    Check the browser console για detailed logs και stack traces.
                  </p>
                </div>
              )}
            </div>

            {/* System Status */}
            <div className="mt-8 pt-6 border-t border-gray-700">
              <div className="text-center text-sm text-gray-400">
                <p>Geo-Canvas System v1.0.0 (Phase 1)</p>
                <p>Enterprise Geo-Alert Platform</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GeoCanvasErrorBoundary;