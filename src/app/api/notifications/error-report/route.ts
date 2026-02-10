/**
 * =============================================================================
 * 🏢 ENTERPRISE: Direct Error Report to Admin Notification
 * =============================================================================
 *
 * Creates an in-app notification for the admin when a user reports an error.
 * This replaces the email-based flow with direct Firestore notification creation.
 *
 * 🎯 FLOW:
 * 1. User sees error in ErrorBoundary
 * 2. User clicks "Notify Admin"
 * 3. This endpoint creates notification directly in Firestore
 * 4. Admin sees notification in bell icon (real-time via onSnapshot)
 *
 * 🔒 SECURITY:
 * - Requires authenticated user
 * - Uses Admin SDK for server-side Firestore writes
 * - Rate limiting to prevent abuse
 *
 * @endpoint POST /api/notifications/error-report
 * @enterprise Direct Firestore Notification (no email dependency)
 * @created 2026-01-25
 * @adr ADR-017 - Enterprise ID Generation
 * @rateLimit STANDARD (60 req/min) - Error report submission
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { adminConfigService } from '@/services/adminConfigService';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { Severity } from '@/types/notification';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('NotificationsErrorReportRoute');

// =============================================================================
// TYPES (Protocol: ZERO any)
// =============================================================================

/**
 * Error report request body from ErrorBoundary
 */
interface ErrorReportRequest {
  errorId: string;
  message: string;
  stack?: string;
  componentStack?: string;
  component?: string;
  severity: 'critical' | 'error' | 'warning';
  timestamp: string;
  url: string;
  userAgent: string;
  retryCount: number;
}

/**
 * API response type
 */
interface ErrorReportResponse {
  success: boolean;
  notificationId?: string;
  error?: string;
}

// =============================================================================
// RATE LIMITING (In-memory - production should use Redis)
// =============================================================================

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 error reports per minute per user

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(userId);

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  limit.count++;
  return true;
}

// =============================================================================
// VALIDATION
// =============================================================================

function validateRequest(body: unknown): body is ErrorReportRequest {
  if (!body || typeof body !== 'object') return false;

  const req = body as Partial<ErrorReportRequest>;

  return !!(
    req.errorId &&
    typeof req.errorId === 'string' &&
    req.message &&
    typeof req.message === 'string' &&
    req.severity &&
    ['critical', 'error', 'warning'].includes(req.severity) &&
    req.timestamp &&
    typeof req.timestamp === 'string' &&
    req.url &&
    typeof req.url === 'string'
  );
}

// =============================================================================
// SEVERITY MAPPING
// =============================================================================

function mapSeverity(severity: 'critical' | 'error' | 'warning'): Severity {
  const severityMap: Record<'critical' | 'error' | 'warning', Severity> = {
    critical: 'critical',
    error: 'error',
    warning: 'warning',
  };
  return severityMap[severity];
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

/**
 * POST /api/notifications/error-report
 *
 * Creates a notification for the admin when a user reports an error.
 * Replaces email-based error reporting with direct Firestore writes.
 */
const basePOST = async (request: NextRequest) => {
  const handler = withAuth<ErrorReportResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleErrorReport(req, ctx);
    },
    {
      // Any authenticated user can report errors
      // No specific permissions required
    }
  );

  return handler(request);
};

export const POST = withStandardRateLimit(basePOST);

async function handleErrorReport(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<ErrorReportResponse>> {
  const startTime = Date.now();

  try {
    // Rate limiting check
    if (!checkRateLimit(ctx.uid)) {
      logger.warn('[ErrorReport] Rate limit exceeded', { userId: ctx.uid });
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();

    if (!validateRequest(body)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    logger.info('[ErrorReport] Processing error report', { userId: ctx.uid, errorId: body.errorId, severity: body.severity });

    // Get admin UID from enterprise config
    const adminUid = await adminConfigService.getAdminUid();

    logger.info('[ErrorReport] Admin UID resolution', { adminUid, currentUserId: ctx.uid, isSameUser: adminUid === ctx.uid });

    if (!adminUid) {
      logger.error('[ErrorReport] No admin UID configured');
      return NextResponse.json(
        { success: false, error: 'Admin not configured. Please contact support.' },
        { status: 500 }
      );
    }

    // Build notification document
    const notificationData = {
      tenantId: ctx.companyId || 'default',
      userId: adminUid,
      createdAt: FieldValue.serverTimestamp(),
      severity: mapSeverity(body.severity),
      title: `🚨 ${body.severity.toUpperCase()} Error Report - ${body.component || 'Application'}`,
      body: body.message.substring(0, 200),
      bodyRich: {
        type: 'markdown' as const,
        content: formatErrorReportMarkdown(body, ctx),
      },
      tags: ['error-report', 'user-submitted', body.errorId],
      source: {
        service: 'error-boundary',
        feature: 'error-reporting',
        env: (process.env.NODE_ENV === 'production' ? 'prod' : 'dev') as 'dev' | 'staging' | 'prod',
      },
      actions: body.url ? [
        {
          id: 'view-page',
          label: 'Προβολή Σελίδας',
          url: body.url,
        },
      ] : undefined,
      channel: 'inapp' as const,
      delivery: {
        state: 'delivered' as const,
        attempts: 1,
      },
      meta: {
        correlationId: body.errorId,
        requestId: `error-report-${Date.now()}`,
      },
      // Additional metadata for filtering/search
      reportedBy: {
        uid: ctx.uid,
        email: ctx.email || 'unknown',
      },
    };

    // Create notification in Firestore using Admin SDK
    const docRef = await getAdminFirestore()
      .collection(COLLECTIONS.NOTIFICATIONS)
      .add(notificationData);

    const duration = Date.now() - startTime;
    logger.info('[ErrorReport] Created notification', { notificationId: docRef.id, durationMs: duration });

    return NextResponse.json({
      success: true,
      notificationId: docRef.id,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('[ErrorReport] Failed', { durationMs: duration, error: errorMessage });

    return NextResponse.json(
      { success: false, error: 'Failed to create error report notification' },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format error report as Markdown for rich notification body
 */
function formatErrorReportMarkdown(
  report: ErrorReportRequest,
  ctx: AuthContext
): string {
  const sections = [
    '## 🚨 Error Report',
    '',
    `**Error ID:** \`${report.errorId}\``,
    `**Severity:** ${report.severity.toUpperCase()}`,
    `**Component:** ${report.component || 'Unknown'}`,
    `**Retry Count:** ${report.retryCount}`,
    '',
    '---',
    '',
    '### 📋 Error Details',
    '',
    `**Message:** ${report.message}`,
    '',
    '---',
    '',
    '### 🔍 Context',
    '',
    `**Reported By:** ${ctx.email || ctx.uid}`,
    `**Timestamp:** ${report.timestamp}`,
    `**URL:** ${report.url}`,
    `**User Agent:** ${report.userAgent.substring(0, 100)}...`,
  ];

  // Add stack trace if available
  if (report.stack) {
    sections.push(
      '',
      '---',
      '',
      '### 📚 Stack Trace',
      '',
      '```',
      report.stack.substring(0, 1000),
      '```'
    );
  }

  // Add component stack if available
  if (report.componentStack) {
    sections.push(
      '',
      '### 🧩 Component Stack',
      '',
      '```',
      report.componentStack.substring(0, 500),
      '```'
    );
  }

  return sections.join('\n');
}
