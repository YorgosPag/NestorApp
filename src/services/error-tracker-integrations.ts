/**
 * 🚨 ERROR TRACKER — INTEGRATIONS & UTILITIES
 *
 * External service integrations, admin notifications, persistence,
 * email formatting, and helper utilities for the ErrorTracker class.
 *
 * @module services/error-tracker-integrations
 * @see ErrorTracker.ts (main class)
 */

'use client';

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { safeGetItem, safeSetItem, safeRemoveItem, STORAGE_KEYS } from '@/lib/storage';
import { safeJsonParse } from '@/lib/json-utils';

import type { ErrorReport, ErrorContext, ErrorTrackerConfig } from './error-tracker-types';

// ============================================================================
// PERSISTENCE
// ============================================================================

export function persistErrors(errorQueue: ErrorReport[], maxStored: number): void {
  const errorsToStore = errorQueue.slice(-maxStored);
  safeSetItem(STORAGE_KEYS.ERROR_LOG, errorsToStore);
}

export function loadPersistedErrors(): ErrorReport[] {
  try {
    return safeGetItem<ErrorReport[]>(STORAGE_KEYS.ERROR_LOG, []);
  } catch {
    return [];
  }
}

export function clearPersistedErrors(): void {
  safeRemoveItem(STORAGE_KEYS.ERROR_LOG);
}

// ============================================================================
// USER CONTEXT EXTRACTION
// ============================================================================

export function getCurrentUserId(): string | undefined {
  const userObj = safeGetItem<{ id?: string; email?: string } | null>(STORAGE_KEYS.USER, null);
  if (userObj) {
    return userObj.id || userObj.email;
  }

  const sessionUser = sessionStorage.getItem('currentUser');
  if (sessionUser) {
    const user = safeJsonParse<{ id?: string; email?: string }>(sessionUser, {});
    const userId = user.id || user.email;
    if (userId) return userId;
  }

  return undefined;
}

export function getCurrentUserType(): 'citizen' | 'professional' | 'technical' | undefined {
  const userObj = safeGetItem<{ userType?: 'citizen' | 'professional' | 'technical' } | null>(STORAGE_KEYS.USER, null);
  return userObj?.userType;
}

// ============================================================================
// EXTERNAL SERVICES
// ============================================================================

export function sendToCustomEndpoint(endpoint: string, error: ErrorReport): void {
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(error)
  }).catch(() => {
    // Silent fail
  });
}

export function sendToExternalServices(config: ErrorTrackerConfig, error: ErrorReport): void {
  if (config.customEndpoint) {
    sendToCustomEndpoint(config.customEndpoint, error);
  }
}

// ============================================================================
// ADMIN NOTIFICATION
// ============================================================================

export async function sendToAdminAsync(errorReport: ErrorReport): Promise<void> {
  const notificationPayload = {
    errorId: errorReport.id,
    message: errorReport.message,
    stack: errorReport.stack,
    componentStack: undefined,
    component: errorReport.context.component || 'Application',
    severity: errorReport.severity as 'critical' | 'error' | 'warning',
    timestamp: new Date(errorReport.lastSeen).toISOString(),
    url: errorReport.context.url || (typeof window !== 'undefined' ? window.location.href : 'unknown'),
    userAgent: errorReport.context.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR'),
    retryCount: errorReport.count - 1
  };

  await apiClient.post(API_ROUTES.NOTIFICATIONS.ERROR_REPORT, notificationPayload);
}

// ============================================================================
// EMAIL FORMATTING
// ============================================================================

export function formatErrorForAdminEmail(errorReport: ErrorReport): string {
  const { context } = errorReport;

  return `
🚨 AUTOMATIC ERROR REPORT - GEO-ALERT SYSTEM

📋 ERROR SUMMARY:
• Error ID: ${errorReport.id}
• Severity: ${errorReport.severity.toUpperCase()}
• Category: ${errorReport.category}
• Message: ${errorReport.message}
• Count: ${errorReport.count} occurrence(s)

⏰ TIMING:
• First Seen: ${new Date(errorReport.firstSeen).toLocaleString('el-GR')}
• Last Seen: ${new Date(errorReport.lastSeen).toLocaleString('el-GR')}

👤 USER CONTEXT:
• User ID: ${context.userId || 'Anonymous'}
• User Type: ${context.userType || 'Unknown'}
• Session: ${context.sessionId}

🌐 LOCATION:
• URL: ${context.url}
• Route: ${context.route}
• Component: ${context.component || 'Unknown'}
• Action: ${context.action || 'N/A'}

🔧 TECHNICAL:
• User Agent: ${context.userAgent}
• Build Version: ${context.buildVersion || 'Unknown'}

📚 STACK TRACE:
${errorReport.stack || 'Stack trace not available'}

${context.metadata ? `\n📊 ADDITIONAL METADATA:\n${JSON.stringify(context.metadata, null, 2)}` : ''}

---
⚡ Αυτό το email στάλθηκε αυτόματα από το ErrorTracker service
🕒 Timestamp: ${new Date().toLocaleString('el-GR')}
  `.trim();
}

// ============================================================================
// ENCODING & FINGERPRINT UTILITIES
// ============================================================================

/** Safe base64 encoding with UTF-8 support */
export function safeBase64Encode(input: string): string {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(input, 'utf8').toString('base64');
    }

    const encoder = new TextEncoder();
    const bytes = encoder.encode(input);
    let binary = '';
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  } catch {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

export function generateFingerprint(message: string, _stack?: string, context?: Partial<ErrorContext>): string {
  const key = `${message}_${context?.component}_${context?.action}`;
  return safeBase64Encode(key).substr(0, 16);
}

/** Safe JSON stringify with circular reference handling */
export function safeStringify(obj: unknown): string {
  try {
    if (obj === null || obj === undefined) return String(obj);
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj);
    }

    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value: unknown) => {
      if (key === '_map' || key === '_controls' || key === 'map' || key === 'target') {
        return '[Circular Reference]';
      }

      if (value !== null && typeof value === 'object') {
        if (seen.has(value as object)) {
          return '[Circular Reference]';
        }
        seen.add(value as object);
      }
      return value;
    });
  } catch {
    const objWithConstructor = obj as { constructor?: { name?: string } };
    return `[Object: ${objWithConstructor?.constructor?.name || 'Unknown'}]`;
  }
}
