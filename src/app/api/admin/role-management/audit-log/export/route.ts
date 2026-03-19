/**
 * =============================================================================
 * GET /api/admin/role-management/audit-log/export — Export Audit Logs
 * =============================================================================
 *
 * Exports audit log entries as CSV or JSON.
 * Super admin only — heavy operation with rate limiting.
 *
 * Auth: withAuth (super_admin only)
 * Rate: withHeavyRateLimit
 *
 * @module api/admin/role-management/audit-log/export
 * @enterprise ADR-244 Phase B — Audit Export
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('RoleManagement:AuditExport');

const AUDIT_COLLECTION = 'audit_logs';
const MAX_EXPORT_ROWS = 1000;

// =============================================================================
// TYPES
// =============================================================================

interface RawAuditDoc {
  action: string;
  actorId: string;
  targetId: string;
  targetType: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  timestamp: FirebaseFirestore.Timestamp;
  metadata: Record<string, unknown>;
}

// =============================================================================
// CSV GENERATION
// =============================================================================

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function generateCsv(rows: RawAuditDoc[], docIds: string[]): string {
  const headers = ['ID', 'Timestamp', 'Action', 'Actor ID', 'Target ID', 'Target Type', 'Previous Value', 'New Value', 'Reason'];
  const lines = [headers.map(escapeCsvField).join(',')];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const timestamp = row.timestamp?.toDate?.()?.toISOString() ?? '';
    const reason = (row.metadata?.reason as string) ?? '';
    const prev = row.previousValue ? JSON.stringify(row.previousValue) : '';
    const next = row.newValue ? JSON.stringify(row.newValue) : '';

    lines.push([
      escapeCsvField(docIds[i]),
      escapeCsvField(timestamp),
      escapeCsvField(row.action),
      escapeCsvField(row.actorId),
      escapeCsvField(row.targetId),
      escapeCsvField(row.targetType),
      escapeCsvField(prev),
      escapeCsvField(next),
      escapeCsvField(reason),
    ].join(','));
  }

  return lines.join('\n');
}

// =============================================================================
// GET — Export Audit Logs (CSV or JSON)
// =============================================================================

export const GET = withHeavyRateLimit(
  withAuth(
    async (
      request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const db = getAdminFirestore();
        const { searchParams } = new URL(request.url);

        const format = searchParams.get('format') === 'csv' ? 'csv' : 'json';
        const dateFrom = searchParams.get('dateFrom') ?? null;
        const dateTo = searchParams.get('dateTo') ?? null;

        // Build query
        const auditRef = db
          .collection(COLLECTIONS.COMPANIES)
          .doc(ctx.companyId)
          .collection(AUDIT_COLLECTION);

        let query: FirebaseFirestore.Query = auditRef.orderBy('timestamp', 'desc');

        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          if (!isNaN(fromDate.getTime())) {
            query = query.where('timestamp', '>=', fromDate);
          }
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          if (!isNaN(toDate.getTime())) {
            toDate.setDate(toDate.getDate() + 1);
            query = query.where('timestamp', '<=', toDate);
          }
        }

        const snapshot = await query.limit(MAX_EXPORT_ROWS).get();
        const rows = snapshot.docs.map((doc) => doc.data() as RawAuditDoc);
        const docIds = snapshot.docs.map((doc) => doc.id);

        const now = new Date().toISOString().slice(0, 10);
        const filename = `audit-log-${now}`;

        if (format === 'csv') {
          const csv = generateCsv(rows, docIds);
          return new NextResponse(csv, {
            status: 200,
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="${filename}.csv"`,
            },
          });
        }

        // JSON format
        const jsonEntries = rows.map((row, i) => ({
          id: docIds[i],
          action: row.action,
          actorId: row.actorId,
          targetId: row.targetId,
          targetType: row.targetType,
          previousValue: row.previousValue ?? null,
          newValue: row.newValue ?? null,
          timestamp: row.timestamp?.toDate?.()?.toISOString() ?? null,
          metadata: row.metadata ?? {},
        }));

        const jsonContent = JSON.stringify({ exportDate: new Date().toISOString(), entries: jsonEntries }, null, 2);
        return new NextResponse(jsonContent, {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}.json"`,
          },
        });
      } catch (error) {
        logger.error('[AuditExport] Failed to export audit logs:', { error });
        return NextResponse.json(
          { success: false, error: getErrorMessage(error) },
          { status: 500 }
        );
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  )
);
