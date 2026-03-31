// ============================================================================
// 🏢 ENTERPRISE: Error Helper Functions — Single Source of Truth
// ============================================================================
// Pure utility functions shared by ErrorBoundary class and RouteErrorFallback.
// Previously duplicated across both components — now unified.
// @pattern Google SRP — Pure functions, zero side effects, zero duplication
// ============================================================================

import { safeGetItem } from '@/lib/storage';

/**
 * Retrieves current user ID from localStorage (email or ID)
 */
export function getUserId(): string | null {
  const user = safeGetItem<{ email?: string; id?: string } | null>('currentUser', null);
  return user?.email || user?.id || null;
}

/**
 * Determines error severity based on error message content
 */
export function getErrorSeverity(error: Error): 'critical' | 'error' | 'warning' {
  const message = error.message.toLowerCase();

  if (
    message.includes('authentication') ||
    message.includes('authorization') ||
    message.includes('security') ||
    message.includes('payment') ||
    message.includes('data corruption')
  ) {
    return 'critical';
  }

  if (
    message.includes('network') ||
    message.includes('api') ||
    message.includes('database')
  ) {
    return 'error';
  }

  return 'warning';
}

/**
 * Formats error details into a human-readable email body
 */
export function formatErrorForEmail(errorDetails: {
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
  retryCount?: number;
  digest?: string;
}): string {
  return `
🚨 ERROR REPORT - NESTOR PLATFORM
=====================================

📋 ERROR DETAILS:
• Error ID: ${errorDetails.errorId}
• Message: ${errorDetails.message}
• Component: ${errorDetails.component}
• Severity: ${errorDetails.severity.toUpperCase()}
${errorDetails.digest ? `• Digest: ${errorDetails.digest}` : ''}
${errorDetails.retryCount != null ? `• Retry Count: ${errorDetails.retryCount}` : ''}

⏰ OCCURRENCE:
• Timestamp: ${errorDetails.timestamp}
• URL: ${errorDetails.url}
• User ID: ${errorDetails.userId || 'Anonymous'}

🔧 TECHNICAL DETAILS:
• User Agent: ${errorDetails.userAgent}
${errorDetails.componentStack ? `• Component Stack:\n${errorDetails.componentStack}` : ''}

📚 ERROR STACK:
${errorDetails.stack || 'Stack trace not available'}

---
Αυτό το email στάλθηκε αυτόματα από το Nestor Error Reporting System.
  `.trim();
}

/**
 * Navigate to home page
 */
export function goHome(): void {
  window.location.href = '/';
}

/**
 * Navigate back in browser history
 */
export function goBack(): void {
  window.history.back();
}
