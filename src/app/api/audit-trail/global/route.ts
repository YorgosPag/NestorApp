/**
 * GET /api/audit-trail/global
 *
 * Company-wide audit trail across all entity types — the **historical tail** behind the live window of
 * `useGlobalAuditTrail` (Google Workspace Admin Console "Audit log").
 *
 * Query params:
 *   - `entityType` · `action` · `performedBy` (free text: uid or name) · `fromDate` / `toDate` (`YYYY-MM-DD`, inclusive)
 *   - `limit`      — 1..100, default 20
 *   - `startAfter` — anchor: id of the last entry the client holds (the oldest of the live window, or `nextCursor`)
 *
 * 🔴 Ως 2026-10-30 (pending «Δρομέας keyset»):
 *   - `.limit(500)` **χωρίς `orderBy`** ⇒ σε εταιρεία με >500 εγγραφές, 500 **τυχαίες** (σειρά id) — όχι οι νεότερες·
 *   - σελιδοποίηση με `offset`, ενώ ο πελάτης έστελνε **id** ⇒ `parseInt` = NaN ⇒ κενή σελίδα + `hasMore: false` ⇒
 *     η ουρά δεν φαινόταν ποτέ·
 *   - φίλτρα διαφορετικά από του ζωντανού παραθύρου.
 *
 * Τώρα: `companyId == ctx.companyId` + `orderBy(timestamp ↓)` (δείκτης `(companyId, timestamp↓)` υπάρχει ήδη) ·
 * άγκυρα `startAfter(snapshot)` (ο Firestore βάζει σιωπηρά `__name__` ⇒ ισοπαλίες σωστές) · σάρωση σε παρτίδες με τον
 * ΙΔΙΟ κριτή φίλτρων με τον πελάτη (`lib/audit/global-audit-filter`) ως `limit` γραμμές ή `SCAN_CAP` έγγραφα — ο
 * δρομέας δείχνει την τελευταία **σαρωμένη** εγγραφή, άρα καμία δεν χάνεται. Τα φίλτρα μένουν στη μνήμη (ελεύθερο
 * κείμενο στο `performedBy` δεν γίνεται ερώτημα Firestore)· κανένας νέος δείκτης.
 *
 * Tenant isolation is automatic via `ctx.companyId` — no admin can read
 * another company's audit trail.
 *
 * @module api/audit-trail/global
 * @permission super_admin | company_admin (enforced via withAuth)
 * @rateLimit STANDARD (60 req/min)
 * @enterprise ADR-195 — Entity Audit Trail (Phase 7: Global Admin View)
 */

import { NextRequest } from 'next/server';
import type { CollectionReference, Query } from 'firebase-admin/firestore';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import {
  ApiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '@/lib/api/ApiErrorHandler';
import { AUDIT_ENTITY_TYPES } from '@/config/audit-entity-collection-map';
import { entityAuditEntriesFromData } from '@/lib/audit/audit-entry-from-document';
import { globalAuditFilterPredicate, type GlobalAuditFilters } from '@/lib/audit/global-audit-filter';
import { InvalidPageTokenError } from '@/lib/admin-keyset-page';
import {
  optionalQueryDay,
  optionalQueryText,
  readQueryLimit,
  type QueryLimitBounds,
} from '@/lib/api/query-params';
import { dedupDualWrite } from '@/services/audit/dedup-dual-write';
import type {
  AuditAction,
  AuditEntityType,
  EntityAuditEntry,
  EntityAuditResponse,
} from '@/types/audit-trail';

// ============================================================================
// VALIDATION
// ============================================================================

const VALID_ACTIONS: ReadonlySet<string> = new Set<AuditAction>([
  'created',
  'updated',
  'deleted',
  'soft_deleted',
  'restored',
  'status_changed',
  'linked',
  'unlinked',
  'professional_assigned',
  'professional_removed',
  'email_sent',
  'invoice_created',
  'document_added',
  'document_removed',
]);

const PAGE_LIMIT: QueryLimitBounds = { defaultLimit: 20, maxLimit: 100 };

/** Έγγραφα ανά ανάγνωση της σάρωσης. */
const SCAN_BATCH = 100;

/**
 * Ανώτατο έγγραφα ανά αίτημα. Με στενό φίλτρο η σελίδα μπορεί να βγει **μικρότερη** από `limit` (ακόμη και κενή) με
 * `hasMore: true` — ο δρομέας δείχνει πού σταμάτησε η σάρωση, άρα το «Περισσότερα» συνεχίζει χωρίς κενά.
 */
const SCAN_CAP = 1000;

function readFilters(searchParams: URLSearchParams): GlobalAuditFilters {
  // 🧹 ADR-864 Φ1β — ήταν χειρόγραφο σύνολο **9** τύπων ⇒ το φίλτρο «τοίχος» ή «αγγελία»
  //    γύριζε 400. Πλέον **προβολή** του μητρώου (ADR-852 §4.9).
  const entityType = optionalQueryText(searchParams, 'entityType');
  if (entityType && !AUDIT_ENTITY_TYPES.has(entityType)) {
    throw new ApiError(400, 'Invalid entity type');
  }

  const performedBy = optionalQueryText(searchParams, 'performedBy');
  if (performedBy && performedBy.length > 128) {
    throw new ApiError(400, 'performedBy too long');
  }

  const action = optionalQueryText(searchParams, 'action');
  if (action && !VALID_ACTIONS.has(action)) {
    throw new ApiError(400, `Invalid action. Valid: ${[...VALID_ACTIONS].join(', ')}`);
  }

  const fromDate = optionalQueryDay(searchParams, 'fromDate');
  const toDate = optionalQueryDay(searchParams, 'toDate');
  if (fromDate && toDate && fromDate > toDate) {
    throw new ApiError(400, 'fromDate must be <= toDate');
  }

  return {
    entityType: entityType as AuditEntityType | undefined,
    action: action as AuditAction | undefined,
    performedBy,
    fromDate,
    toDate,
  };
}

// ============================================================================
// SCAN
// ============================================================================

/**
 * Η άγκυρα πρέπει να είναι εγγραφή **αυτής** της εταιρείας — αλλιώς 400 (ποτέ «πρώτη σελίδα» σιωπηλά, ποτέ θέση
 * σε ξένη σειρά).
 */
async function startAfterAnchor(
  base: Query,
  collectionRef: CollectionReference,
  anchorId: string,
  companyId: string,
): Promise<Query> {
  const anchor = await collectionRef.doc(anchorId).get();
  // Χωρίς `timestamp` η εγγραφή δεν ανήκει στη σειρά (`orderBy` την αποκλείει) — και το `startAfter` θα έσκαγε 500.
  if (!anchor.exists || anchor.get(FIELDS.COMPANY_ID) !== companyId || anchor.get('timestamp') == null) {
    throw new ApiError(400, 'Invalid page cursor for this query', InvalidPageTokenError.code);
  }
  return base.startAfter(anchor);
}

interface ScanResult {
  readonly entries: EntityAuditEntry[];
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

/**
 * Σάρωση από την άγκυρα προς τα παλαιότερα ως `limit + 1` ταιριαστές γραμμές (το `hasMore` **μετριέται**) ή `SCAN_CAP`
 * έγγραφα. Δρομέας = το id της τελευταίας **καταναλωμένης** εγγραφής (της τελευταίας που επιστράφηκε, ή της
 * τελευταίας που σαρώθηκε αν η σάρωση σταμάτησε στο όριο).
 */
async function scanTail(start: Query, limit: number, filters: GlobalAuditFilters): Promise<ScanResult> {
  const matches = globalAuditFilterPredicate(filters);
  const entries: EntityAuditEntry[] = [];
  let query = start;
  let scanned = 0;
  let lastConsumed: string | null = null;

  while (scanned < SCAN_CAP) {
    const docs = (await query.limit(SCAN_BATCH).get()).docs;
    scanned += docs.length;
    const batch = entityAuditEntriesFromData(docs.map((doc) => ({ id: doc.id, data: doc.data() })));
    // Διπλοεγγραφές service+cdc: ο ΙΔΙΟΣ κανόνας με το ζωντανό παράθυρο, ανά παρτίδα.
    const survivors = new Set(dedupDualWrite(batch).map((entry) => entry.id));
    const byId = new Map(batch.map((entry) => [entry.id, entry]));

    for (const doc of docs) {
      const entry = byId.get(doc.id);
      if (entry && survivors.has(doc.id) && matches(entry)) {
        if (entries.length === limit) {
          // Η (limit+1)-οστή ταιριαστή: υπάρχει επόμενη σελίδα· ΔΕΝ καταναλώνεται.
          return { entries, hasMore: true, nextCursor: lastConsumed };
        }
        entries.push(entry);
      }
      lastConsumed = doc.id;
    }

    const last = docs[docs.length - 1];
    if (docs.length < SCAN_BATCH || last === undefined) {
      return { entries, hasMore: false, nextCursor: null };
    }
    query = query.startAfter(last);
  }

  // Όριο σάρωσης: συνέχεια από την τελευταία σαρωμένη — η επόμενη κλήση σαρώνει τα επόμενα.
  return { entries, hasMore: true, nextCursor: lastConsumed };
}

// ============================================================================
// GET — Paginated Global Audit Trail
// ============================================================================

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<EntityAuditResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const db = requireAdminFirestore();
      const url = new URL(request.url);

      // Οι αρνήσεις του πελάτη κρίνονται ΠΡΙΝ από τη βάση.
      const filters = readFilters(url.searchParams);
      const limit = readQueryLimit(url.searchParams, PAGE_LIMIT);
      const anchorId = optionalQueryText(url.searchParams, 'startAfter');

      const collectionRef = db.collection(COLLECTIONS.ENTITY_AUDIT_TRAIL);
      const base = collectionRef
        .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
        .orderBy('timestamp', 'desc');
      const start = anchorId ? await startAfterAnchor(base, collectionRef, anchorId, ctx.companyId) : base;

      const { entries, hasMore, nextCursor } = await scanTail(start, limit, filters);

      const response: EntityAuditResponse = {
        entries,
        hasMore,
        ...(hasMore && nextCursor ? { nextCursor } : {}),
      };

      return apiSuccess(response, 'Global audit trail retrieved');
    },
    { requiredGlobalRoles: ['super_admin', 'company_admin'] },
  ),
);
