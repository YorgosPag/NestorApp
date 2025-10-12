'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft, Bug, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorTracker } from '@/services/ErrorTracker';

interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
  errorBoundaryStack?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  isReporting: boolean;
  reportSent: boolean;
  errorId: string | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
  enableRetry?: boolean;
  maxRetries?: number;
  enableReporting?: boolean;
  componentName?: string;
  showErrorDetails?: boolean;
  isolateError?: boolean; // Prevent error from bubbling up
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isReporting: false,
      reportSent: false,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, componentName } = this.props;

    this.setState({ errorInfo });

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
          userAgent: navigator.userAgent,
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
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(),
      errorInfo,
      trackerErrorId // Add ErrorTracker ID
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
      console.error('Error Stack:', error.stack);
      console.error('ErrorTracker ID:', trackerErrorId);
      console.groupEnd();
    }

    // Call custom error handler με ErrorTracker ID
    if (onError && this.state.errorId) {
      onError(error, errorInfo, trackerErrorId || this.state.errorId);
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
      reportSent: false
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
        userAgent: navigator.userAgent,
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

  private copyErrorDetails = () => {
    const { error, errorInfo, errorId } = this.state;
    if (!error) return;

    const errorDetails = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
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
    const { hasError, error, errorInfo, retryCount, isReporting, reportSent } = this.state;
    const { 
      children, 
      fallback, 
      enableRetry = true, 
      maxRetries = 3,
      enableReporting = true,
      showErrorDetails = process.env.NODE_ENV === 'development',
      componentName 
    } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, errorInfo!, this.retry);
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <div className="bg-card border border-red-200 dark:border-red-800 rounded-lg p-8 shadow-lg">
              {/* Error Header */}
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                  <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-red-900 dark:text-red-100">
                    Something went wrong
                  </h1>
                  <p className="text-red-700 dark:text-red-300">
                    {componentName ? `Error in ${componentName}` : 'An unexpected error occurred'}
                  </p>
                </div>
              </div>

              {/* Error Message */}
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-red-800 dark:text-red-200 font-medium">
                  {error.message}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 mb-6">
                {enableRetry && retryCount < maxRetries && (
                  <Button 
                    onClick={this.retry}
                    variant="default"
                    className="flex items-center space-x-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Try Again {retryCount > 0 && `(${retryCount + 1}/${maxRetries + 1})`}</span>
                  </Button>
                )}

                <Button 
                  onClick={this.goBack}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Go Back</span>
                </Button>

                <Button 
                  onClick={this.goHome}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <Home className="h-4 w-4" />
                  <span>Go Home</span>
                </Button>
              </div>

              {/* Error Reporting */}
              {enableReporting && (
                <div className="flex items-center justify-between p-4 bg-muted rounded-md mb-6">
                  <div className="flex items-center space-x-3">
                    <Bug className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Help us improve</p>
                      <p className="text-sm text-muted-foreground">
                        Report this error to help us fix the issue
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={this.reportError}
                    disabled={isReporting || reportSent}
                    variant="outline"
                    size="sm"
                  >
                    {isReporting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : reportSent ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-600" />
                        Sent
                      </>
                    ) : (
                      'Report Error'
                    )}
                  </Button>
                </div>
              )}

              {/* Error Details (Development) */}
              {showErrorDetails && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground mb-3">
                    Technical Details
                  </summary>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Error Stack</h4>
                        <Button
                          onClick={this.copyErrorDetails}
                          variant="ghost"
                          size="sm"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                        {error.stack}
                      </pre>
                    </div>
                    
                    {errorInfo?.componentStack && (
                      <div>
                        <h4 className="font-medium mb-2">Component Stack</h4>
                        <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><strong>Error ID:</strong> {this.state.errorId}</p>
                      <p><strong>Timestamp:</strong> {new Date().toISOString()}</p>
                      <p><strong>URL:</strong> {window.location.href}</p>
                    </div>
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
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
    reportError: (error: Error, context?: Record<string, any>) => {
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
        userAgent: navigator.userAgent
      };

      console.error('Manual error report:', errorReport);
      return errorId; // Return ErrorTracker ID για reference
    },

    // **🆕 NEW: Direct access to ErrorTracker methods**
    captureUserError: (message: string, action: string, metadata?: any) => {
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

// Specialized error boundaries for different contexts
export function PageErrorBoundary({ children, ...props }: Omit<ErrorBoundaryProps, 'componentName'>) {
  return (
    <ErrorBoundary 
      componentName="Page"
      enableRetry={true}
      maxRetries={2}
      enableReporting={true}
      {...props}
    >
      {children}
    </ErrorBoundary>
  );
}

export function ComponentErrorBoundary({ children, ...props }: Omit<ErrorBoundaryProps, 'isolateError'>) {
  return (
    <ErrorBoundary 
      isolateError={true}
      enableRetry={true}
      maxRetries={1}
      showErrorDetails={false}
      fallback={(error, _, retry) => (
        <div className="p-4 border border-red-200 dark:border-red-800 rounded-md bg-red-50 dark:bg-red-950/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-red-900 dark:text-red-100">Component Error</p>
              <p className="text-sm text-red-700 dark:text-red-300">{error.message}</p>
            </div>
            <Button onClick={retry} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
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

export default ErrorBoundary;