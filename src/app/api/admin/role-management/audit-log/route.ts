/**
 * =============================================================================
 * GET /api/admin/role-management/audit-log — Query Audit Logs
 * =============================================================================
 *
 * Returns paginated audit log entries for the company.
 * Supports cursor-based pagination and filters (date range, actor, target, action).
 *
 * Auth: withAuth (super_admin, company_admin)
 * Rate: withSensitiveRateLimit
 *
 * 🔑 Σελίδα με δρομέα keyset — SSoT `lib/admin-keyset-page` (2026-10-30, pending «Δρομέας keyset»). Ως τότε ο
 *    δρομέας ήταν το id της τελευταίας γραμμής και ξαναδιαβαζόταν με `doc(cursor).get()`: γραμμή που σβήστηκε στο
 *    μεταξύ (το ιστορικό έχει TTL — `expiresAt`) ⇒ **πρώτη σελίδα σιωπηλά**· ισοπαλία `timestamp` στο όριο σελίδας ⇒
 *    γραμμές χάνονταν ή διπλασιάζονταν. Επίσης `limit=abc` ⇒ `NaN` ⇒ 500, και άκυρη ημερομηνία ⇒ φίλτρο αγνοούνταν.
 *    Τώρα: άκυρη παράμετρος / ξένος δρομέας ⇒ 400 με κωδικό· οι συνδυασμοί φίλτρων που φτάνουν στον Firestore
 *    είναι οι ίδιοι με πριν.
 *
 * @module api/admin/role-management/audit-log
 * @enterprise ADR-244 Phase B — Audit Log
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache, AuditAction } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import {
  InvalidPageTokenError,
  decodeKeysetCursor,
  readKeysetPage,
  type KeysetOrder,
  type KeysetScope,
} from '@/lib/admin-keyset-page';
import {
  InvalidQueryParamError,
  optionalQueryDay,
  optionalQueryText,
  readQueryLimit,
  type QueryLimitBounds,
} from '@/lib/api/query-params';

const logger = createModuleLogger('RoleManagement:AuditLog');

// SSoT: Subcollection name from centralized config
import { SUBCOLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';

const AUDIT_COLLECTION = SUBCOLLECTIONS.COMPANY_AUDIT_LOGS;
const PAGE_LIMIT: QueryLimitBounds = { defaultLimit: 50, maxLimit: 100 };

/** Νεότερα πρώτα· το `timestamp` είναι `serverTimestamp()` (`lib/auth/audit-core.ts`). */
const AUDIT_LOG_ORDER: KeysetOrder = { field: 'timestamp', direction: 'desc', kind: 'timestamp' };

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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

/** Τα φίλτρα του αιτήματος, επικυρωμένα. Ό,τι λείπει ⇒ δεν φιλτράρει. */
interface AuditLogFilters {
  readonly action?: string;
  readonly actorId?: string;
  readonly targetId?: string;
  /** `YYYY-MM-DD` — από την αρχή της ημέρας (UTC). */
  readonly dateFrom?: string;
  /** `YYYY-MM-DD` — ως το τέλος της ημέρας (UTC). */
  readonly dateTo?: string;
}

// =============================================================================
// REQUEST PARSING
// =============================================================================

function readFilters(searchParams: URLSearchParams): AuditLogFilters {
  const action = optionalQueryText(searchParams, 'action');
  const filters: AuditLogFilters = {
    action: action === 'all' ? undefined : action,
    actorId: optionalQueryText(searchParams, 'actorId'),
    targetId: optionalQueryText(searchParams, 'targetId'),
    dateFrom: optionalQueryDay(searchParams, 'dateFrom'),
    dateTo: optionalQueryDay(searchParams, 'dateTo'),
  };
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    throw new InvalidQueryParamError('dateFrom must be <= dateTo');
  }
  return filters;
}

/** Τα φίλτρα με τιμή — η εμβέλεια στην οποία δένεται ο δρομέας (άλλα φίλτρα ⇒ ο δρομέας απορρίπτεται). */
function scopeOf(filters: AuditLogFilters): KeysetScope {
  return Object.fromEntries(
    Object.entries(filters).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

/** Το φιλτραρισμένο ερώτημα — χωρίς ταξινόμηση/όριο (τα βάζει το `readKeysetPage`). */
function buildAuditLogQuery(
  auditRef: FirebaseFirestore.CollectionReference,
  filters: AuditLogFilters,
): FirebaseFirestore.Query {
  let query: FirebaseFirestore.Query = auditRef;
  if (filters.action) query = query.where('action', '==', filters.action);
  if (filters.actorId) query = query.where('actorId', '==', filters.actorId);
  if (filters.targetId) query = query.where('targetId', '==', filters.targetId);
  if (filters.dateFrom) query = query.where('timestamp', '>=', new Date(`${filters.dateFrom}T00:00:00.000Z`));
  if (filters.dateTo) {
    // Ως την ΑΡΧΗ της επόμενης ημέρας, αποκλειστικά (ήταν `<=` ⇒ χωρούσε και η 00:00:00 της επόμενης).
    const nextDay = new Date(Date.parse(`${filters.dateTo}T00:00:00.000Z`) + ONE_DAY_MS);
    query = query.where('timestamp', '<', nextDay);
  }
  return query;
}

// =============================================================================
// GET — Query Audit Logs (Paginated + Filtered)
// =============================================================================

export const GET = withSensitiveRateLimit(
  withAuth(
    async (
      request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const db = getAdminFirestore();
        const { searchParams } = new URL(request.url);

        // Οι αρνήσεις του πελάτη (φίλτρα / μέγεθος / δρομέας) κρίνονται ΠΡΙΝ από τη βάση.
        const filters = readFilters(searchParams);
        const pageSize = readQueryLimit(searchParams, PAGE_LIMIT);
        const scope = scopeOf(filters);
        const after = decodeKeysetCursor(optionalQueryText(searchParams, 'cursor') ?? null, AUDIT_LOG_ORDER, scope);

        const auditRef = db
          .collection(COLLECTIONS.COMPANIES)
          .doc(ctx.companyId)
          .collection(AUDIT_COLLECTION);

        const page = await readKeysetPage({
          base: buildAuditLogQuery(auditRef, filters),
          order: AUDIT_LOG_ORDER,
          scope,
          pageSize,
          after,
          map: (data, id) => ({ ...(data as RawAuditDoc), id }),
        });
        const docs = page.items;

        // Collect unique user IDs for display name enrichment
        const userIds = new Set<string>();
        for (const data of docs) {
          if (data.actorId) userIds.add(data.actorId);
          if (data.targetId && data.targetType === 'user') userIds.add(data.targetId);
        }

        // Batch-fetch user display names
        const userDisplayNames = new Map<string, string | null>();
        const userIdArray = Array.from(userIds);
        if (userIdArray.length > 0) {
          // Firestore IN query limit is 30, batch if needed
          const batches: string[][] = [];
          for (let i = 0; i < userIdArray.length; i += 30) {
            batches.push(userIdArray.slice(i, i + 30));
          }
          for (const batch of batches) {
            const usersSnap = await db
              .collection(COLLECTIONS.USERS)
              .where('__name__', 'in', batch)
              .select('displayName', 'email')
              .get();
            for (const userDoc of usersSnap.docs) {
              const userData = userDoc.data();
              userDisplayNames.set(
                userDoc.id,
                (userData.displayName as string) || (userData.email as string) || null
              );
            }
          }
        }

        // Map to frontend entries
        const entries = docs.map((data) => ({
          id: data.id,
          action: data.action as AuditAction,
          actorId: data.actorId,
          actorDisplayName: userDisplayNames.get(data.actorId) ?? null,
          targetId: data.targetId,
          targetDisplayName: data.targetType === 'user'
            ? (userDisplayNames.get(data.targetId) ?? null)
            : null,
          targetType: data.targetType,
          previousValue: data.previousValue ?? null,
          newValue: data.newValue ?? null,
          timestamp: data.timestamp?.toDate?.()?.toISOString() ?? nowISO(),
          metadata: data.metadata ?? {},
        }));

        return NextResponse.json({
          success: true,
          data: {
            entries,
            total: entries.length,
            nextCursor: page.nextCursor,
          },
        });
      } catch (error) {
        if (error instanceof InvalidQueryParamError) {
          return NextResponse.json(
            { success: false, error: error.message, code: InvalidQueryParamError.code },
            { status: 400 },
          );
        }
        if (error instanceof InvalidPageTokenError) {
          return NextResponse.json(
            { success: false, error: error.message, code: InvalidPageTokenError.code },
            { status: 400 },
          );
        }
        logger.error('[AuditLog] Failed to fetch audit logs:', { error });
        return NextResponse.json(
          { success: false, error: getErrorMessage(error) },
          { status: 500 }
        );
      }
    },
    { requiredGlobalRoles: ['super_admin', 'company_admin'] }
  )
);
