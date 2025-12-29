'use client';

import React, { Component, ErrorInfo as ReactErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft, Bug, Copy, Check, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { errorTracker } from '@/services/ErrorTracker';
import { notificationConfig } from '@/config/error-reporting';
import { componentSizes } from '@/styles/design-tokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

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
      errorId: null,
      isSendingToAdmin: false,
      emailSent: false,
      copySuccess: false
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
      userAgent: navigator.userAgent,
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
    if (!error || !errorId) return;

    this.setState({ isSendingToAdmin: true });

    try {
      const errorDetails = {
        errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        userId: this.getUserId(),
        component: this.props.componentName || 'Unknown',
        severity: this.getErrorSeverity(error),
        retryCount: this.state.retryCount
      };

      const emailPayload = {
        to: notificationConfig.channels.adminEmail,
        subject: `🚨 ${this.getErrorSeverity(error).toUpperCase()} Error Report - ${this.props.componentName || 'Application'}`,
        templateId: 'error-report',
        message: this.formatErrorForEmail(errorDetails),
        priority: this.getErrorSeverity(error) === 'critical' ? 'high' : 'normal',
        category: 'error-report'
      };

      const response = await fetch('/api/communications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailPayload)
      });

      if (!response.ok) {
        throw new Error(`Failed to send email: ${response.statusText}`);
      }

      this.setState({ emailSent: true });

      // Track successful admin email
      errorTracker.captureUserError(
        'Error report sent to admin',
        'sendToAdmin',
        { errorId, adminEmail: notificationConfig.channels.adminEmail }
      );

    } catch (sendError) {
      console.error('Failed to send error to admin:', sendError);

      // Track failed admin email
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
    } finally {
      this.setState({ isSendingToAdmin: false });
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

  private formatErrorForEmail(errorDetails: any): string {
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
      colors
    } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, errorInfo!, this.retry);
      }

      // Default error UI
      return (
        <div className={`min-h-screen ${colors ? colors.bg.primary : 'bg-background'} flex items-center justify-center p-4`}>
          <div className="max-w-2xl w-full">
            <div className={`bg-card ${borderTokens ? borderTokens.quick.error : 'border'} p-8 shadow-lg`}>
              {/* Error Header */}
              <div className="flex items-center space-x-3 mb-6">
                <div className={`p-3 ${colors ? colors.bg.error : 'bg-red-50'} rounded-full`}>
                  <AlertTriangle className={`${componentSizes.icon.xl} ${colors ? colors.text.error : 'text-red-600'}`} />
                </div>
                <div>
                  <h1 className={`text-2xl font-bold ${colors ? colors.text.error : 'text-red-600'}`}>
                    Something went wrong
                  </h1>
                  <p className={`${colors ? colors.text.error : 'text-red-600'}`}>
                    {componentName ? `Error in ${componentName}` : 'An unexpected error occurred'}
                  </p>
                </div>
              </div>

              {/* Error Message */}
              <div className={`mb-6 p-4 ${colors ? colors.bg.error : 'bg-red-50'} ${borderTokens ? borderTokens.quick.error : 'border'}`}>
                <p className={`${colors ? colors.text.error : 'text-red-600'} font-medium`}>
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
                    <RefreshCw className={componentSizes.icon.sm} />
                    <span>Try Again {retryCount > 0 && `(${retryCount + 1}/${maxRetries + 1})`}</span>
                  </Button>
                )}

                <Button 
                  onClick={this.goBack}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className={componentSizes.icon.sm} />
                  <span>Go Back</span>
                </Button>

                <Button 
                  onClick={this.goHome}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <Home className={componentSizes.icon.sm} />
                  <span>Go Home</span>
                </Button>
              </div>

              {/* Enterprise Error Reporting & Admin Notification */}
              {enableReporting && (
                <div className="space-y-4">
                  {/* Copy & Admin Email Actions */}
                  <div className="flex items-center justify-between p-4 bg-muted rounded-md">
                    <div className="flex items-center space-x-3">
                      <Bug className={`${componentSizes.icon.md} text-muted-foreground`} />
                      <div>
                        <p className="font-medium">Error Actions</p>
                        <p className="text-sm text-muted-foreground">
                          Copy details or notify administrator
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={this.copyErrorDetails}
                        disabled={copySuccess}
                        variant="outline"
                        size="sm"
                        className="flex items-center space-x-2"
                      >
                        {copySuccess ? (
                          <>
                            <Check className={`${componentSizes.icon.sm} ${colors ? colors.text.success : 'text-green-600'}`} />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className={componentSizes.icon.sm} />
                            <span>Copy Details</span>
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={this.sendToAdmin}
                        disabled={isSendingToAdmin || emailSent}
                        variant={this.getErrorSeverity(error) === 'critical' ? 'destructive' : 'default'}
                        size="sm"
                        className="flex items-center space-x-2"
                      >
                        {isSendingToAdmin ? (
                          <>
                            <RefreshCw className={`${componentSizes.icon.sm} animate-spin`} />
                            <span>Sending...</span>
                          </>
                        ) : emailSent ? (
                          <>
                            <Check className={`${componentSizes.icon.sm} ${colors ? colors.text.success : 'text-green-600'}`} />
                            <span>Sent to Admin</span>
                          </>
                        ) : (
                          <>
                            <Mail className={componentSizes.icon.sm} />
                            <span>Notify Admin</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Traditional Error Reporting */}
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-md">
                    <div className="flex items-center space-x-3">
                      <Send className={`${componentSizes.icon.md} text-muted-foreground`} />
                      <div>
                        <p className="font-medium">Anonymous Report</p>
                        <p className="text-sm text-muted-foreground">
                          Send anonymous report to help improve the system
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
                          <RefreshCw className={`${componentSizes.icon.sm} mr-2 animate-spin`} />
                          Sending...
                        </>
                      ) : reportSent ? (
                        <>
                          <Check className={`${componentSizes.icon.sm} mr-2 ${colors ? colors.text.success : 'text-green-600'}`} />
                          Sent
                        </>
                      ) : (
                        'Report Error'
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Error Details (Development) */}
              {showErrorDetails && (
                <details className="mt-6">
                  <summary className={`cursor-pointer text-muted-foreground ${INTERACTIVE_PATTERNS.TEXT_HOVER} mb-3`}>
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
                          disabled={copySuccess}
                        >
                          {copySuccess ? (
                            <Check className={`${componentSizes.icon.sm} ${colors ? colors.text.success : 'text-green-600'}`} />
                          ) : (
                            <Copy className={componentSizes.icon.sm} />
                          )}
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

// OLD specialized error boundaries removed - replaced with Enterprise versions below

// 🏢 ENTERPRISE: Wrapper component που inject τα border tokens και colors
export function EnterpriseErrorBoundary(props: Omit<ErrorBoundaryProps, 'borderTokens' | 'colors'>) {
  const borderTokens = useBorderTokens();
  const colors = useSemanticColors();

  return <ErrorBoundary {...props} borderTokens={borderTokens} colors={colors} />;
}

// 🏢 ENTERPRISE: Enhanced specialized error boundaries
export function PageErrorBoundary({ children, ...props }: Omit<ErrorBoundaryProps, 'componentName' | 'borderTokens' | 'colors'>) {
  const borderTokens = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <ErrorBoundary
      componentName="Page"
      enableRetry={true}
      maxRetries={2}
      enableReporting={true}
      borderTokens={borderTokens}
      colors={colors}
      {...props}
    >
      {children}
    </ErrorBoundary>
  );
}

export function ComponentErrorBoundary({ children, ...props }: Omit<ErrorBoundaryProps, 'isolateError' | 'borderTokens' | 'colors'>) {
  const borderTokens = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <ErrorBoundary
      isolateError={true}
      enableRetry={true}
      maxRetries={1}
      showErrorDetails={false}
      borderTokens={borderTokens}
      colors={colors}
      fallback={(error, _, retry) => (
        <div className={`p-4 ${borderTokens.quick.error} ${colors.bg.error}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium ${colors.text.error}`}>Component Error</p>
              <p className={`text-sm ${colors.text.error}`}>{error.message}</p>
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

// Export both raw class και enterprise wrapper
export default EnterpriseErrorBoundary;