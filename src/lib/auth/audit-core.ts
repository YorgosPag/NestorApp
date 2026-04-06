/**
 * @fileoverview Audit Logging — Core Functions
 * @version 1.0.0
 *
 * Core audit logging to Firestore: logAuditEvent, logWebhookEvent,
 * extractRequestMetadata, and internal helpers.
 *
 * Extracted from audit.ts for SRP compliance (ADR-065 Phase 4).
 *
 * Firestore Path: /companies/{companyId}/audit_logs/{autoId}
 *
 * @see docs/rfc/authorization-rbac.md
 */

import 'server-only';

import { getAdminFirestore, isFirebaseAdminAvailable, FieldValue } from '@/lib/firebaseAdmin';
import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateAuditId } from '@/services/enterprise-id.service';
import { validateCompanyExists, ensureCompanyDocument } from '@/services/company-document.service';

import type {
  AuthContext,
  AuditAction,
  AuditTargetType,
  AuditLogEntry,
  AuditChangeValue,
  AuditMetadata,
} from './types';
import { createModuleLogger, sentryCaptureMessage } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
const logger = createModuleLogger('audit');

// =============================================================================
// CONSTANTS
// =============================================================================

const AUDIT_COLLECTION = 'audit_logs';

// =============================================================================
// FIRESTORE DATA SANITIZATION
// =============================================================================

/**
 * Remove undefined values from object (Firestore compatibility).
 * Firestore throws error on undefined values. Recursively removes undefined
 * while preserving null values (which are valid).
 */
function removeUndefinedValues<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const cleaned = removeUndefinedValues(value as Record<string, unknown>);
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
    } else {
      result[key] = value;
    }
  }

  return result as Partial<T>;
}

// =============================================================================
// FIRESTORE ACCESS
// =============================================================================

/**
 * Get Firestore instance for audit logging (ADR-077: Centralized via @/lib/firebaseAdmin).
 */
function getDb(): Firestore | null {
  if (!isFirebaseAdminAvailable()) {
    return null;
  }
  return getAdminFirestore();
}

// =============================================================================
// CORE AUDIT LOGGING
// =============================================================================

/**
 * Log an audit event to Firestore.
 *
 * Events are written to: /companies/{companyId}/audit_logs/{autoId}
 *
 * @param ctx - Authenticated context (provides companyId and actorId)
 * @param action - Audit action type
 * @param targetId - Target entity ID
 * @param targetType - Target entity type
 * @param options - Additional audit options
 */
export async function logAuditEvent(
  ctx: AuthContext,
  action: AuditAction,
  targetId: string,
  targetType: AuditTargetType,
  options: {
    previousValue?: AuditChangeValue | null;
    newValue?: AuditChangeValue | null;
    metadata?: Partial<AuditMetadata>;
  } = {}
): Promise<void> {
  const db = getDb();
  if (!db) {
    logger.info('[AUDIT] Firestore not available, logging to console:', {
      companyId: ctx.companyId,
      action,
      actorId: ctx.uid,
      targetId,
      targetType,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // ADR-259D: Capture access denials in Sentry for security monitoring
  if (action === 'access_denied') {
    sentryCaptureMessage('Tenant isolation: access denied', 'warning', {
      tags: { component: 'tenant-isolation', targetType },
      extra: { actorId: ctx.uid, companyId: ctx.companyId, targetId, reason: options.metadata?.reason, path: options.metadata?.path },
    });
  }

  const rawEntry = {
    companyId: ctx.companyId,
    action,
    actorId: ctx.uid,
    targetId,
    targetType,
    previousValue: options.previousValue ?? null,
    newValue: options.newValue ?? null,
    timestamp: FieldValue.serverTimestamp(),
    metadata: removeUndefinedValues({
      ipAddress: options.metadata?.ipAddress,
      userAgent: options.metadata?.userAgent,
      path: options.metadata?.path,
      reason: options.metadata?.reason,
    }),
  };

  const entry = removeUndefinedValues(rawEntry) as Omit<AuditLogEntry, 'timestamp'> & { timestamp: FieldValue };

  if (!entry.metadata || Object.keys(entry.metadata).length === 0) {
    entry.metadata = {};
  }

  try {
    const companyExists = await validateCompanyExists(ctx.companyId);
    if (!companyExists) {
      logger.warn('[AUDIT] Company document not found — materializing to preserve audit trail', {
        companyId: ctx.companyId,
        action,
        actorId: ctx.uid,
      });
      try {
        await ensureCompanyDocument(ctx.companyId, undefined, ctx.uid);
      } catch (materializeError) {
        logger.error('[AUDIT] Failed to materialize company document — audit event lost', {
          companyId: ctx.companyId,
          error: getErrorMessage(materializeError),
        });
        return;
      }
    }

    const auditId = generateAuditId();
    await db
      .collection(COLLECTIONS.COMPANIES)
      .doc(ctx.companyId)
      .collection(AUDIT_COLLECTION)
      .doc(auditId)
      .set(entry);
  } catch (error) {
    logger.error('[AUDIT] Failed to write audit log:', { error });
    logger.info('[AUDIT] Fallback entry:', { entry: JSON.stringify(entry) });
  }
}

// =============================================================================
// REQUEST METADATA EXTRACTION
// =============================================================================

/**
 * Extract audit metadata from a request.
 */
export function extractRequestMetadata(request: {
  headers: { get: (name: string) => string | null };
  url?: string;
}): AuditMetadata {
  return {
    ipAddress: request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    path: request.url ? new URL(request.url).pathname : undefined,
  };
}

// =============================================================================
// WEBHOOK AUDIT LOGGING (Public Webhooks - No AuthContext)
// =============================================================================

/**
 * Log a webhook event from an external service.
 * Designed for public webhooks (Mailgun, Telegram, etc.) without AuthContext.
 */
export async function logWebhookEvent(
  webhookSource: string,
  webhookId: string,
  details: Record<string, unknown>,
  request: { headers: { get: (name: string) => string | null }; url?: string }
): Promise<void> {
  const db = getDb();
  if (!db) {
    logger.info('[AUDIT] [WEBHOOK] Firestore not available, logging to console:', {
      source: webhookSource,
      webhookId,
      timestamp: new Date().toISOString(),
      details,
    });
    return;
  }

  const metadata = extractRequestMetadata(request);

  const rawEntry = {
    companyId: 'system',
    action: 'webhook_received' as const,
    actorId: `webhook:${webhookSource}`,
    targetId: webhookId,
    targetType: 'webhook' as const,
    previousValue: null,
    newValue: {
      type: 'webhook' as const,
      value: {
        source: webhookSource,
        ...details,
      },
    },
    timestamp: FieldValue.serverTimestamp(),
    metadata: removeUndefinedValues({
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      path: metadata.path,
      reason: `Webhook event received from ${webhookSource}`,
    }),
  };

  const entry = removeUndefinedValues(rawEntry) as Omit<AuditLogEntry, 'timestamp'> & { timestamp: FieldValue };

  if (!entry.metadata || Object.keys(entry.metadata).length === 0) {
    entry.metadata = { reason: `Webhook event received from ${webhookSource}` };
  }

  try {
    const systemAuditId = generateAuditId();
    await db
      .collection(COLLECTIONS.SYSTEM_AUDIT_LOGS)
      .doc(systemAuditId)
      .set(entry);
  } catch (error) {
    logger.error('[AUDIT] [WEBHOOK] Failed to write webhook audit log:', { error });
    logger.info('[AUDIT] [WEBHOOK] Fallback entry:', { entry: JSON.stringify(entry) });
  }
}
