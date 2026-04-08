/**
 * =============================================================================
 * CONTACT SEARCH FOR SHARING — ALL CONTACT TYPES
 * =============================================================================
 *
 * Tenant-scoped contact search returning emails and phones for sharing UI.
 * Returns individuals, companies, and services matching the search term.
 *
 * @route GET /api/contacts/search-for-share?q=term
 * @security Admin SDK + withAuth + Tenant Isolation
 * @enterprise Phase 1 — Contact Email Sharing
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SearchForShareRoute');

// ============================================================================
// TYPES
// ============================================================================

interface ShareableEmail {
  email: string;
  type: string;
  isPrimary: boolean;
}

interface ShareablePhone {
  number: string;
  type: string;
  isPrimary: boolean;
}

interface ShareableContact {
  id: string;
  name: string;
  type: 'individual' | 'company' | 'service';
  emails: ShareableEmail[];
  phones: ShareablePhone[];
}

interface SearchForShareResponse {
  contacts: ShareableContact[];
  count: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function extractDisplayName(data: FirebaseFirestore.DocumentData): string {
  if (data.type === 'company') {
    return String(data.companyName ?? data.tradeName ?? '');
  }
  if (data.type === 'service') {
    return String(data.serviceName ?? data.companyName ?? '');
  }
  const first = String(data.firstName ?? '');
  const last = String(data.lastName ?? '');
  return `${first} ${last}`.trim();
}

function extractEmails(data: FirebaseFirestore.DocumentData): ShareableEmail[] {
  const emails = data.emails;
  if (!Array.isArray(emails)) return [];
  return emails
    .filter((e: Record<string, unknown>) => typeof e?.email === 'string' && e.email.length > 0)
    .map((e: Record<string, unknown>) => ({
      email: String(e.email),
      type: String(e.type ?? 'other'),
      isPrimary: Boolean(e.isPrimary),
    }));
}

function extractPhones(data: FirebaseFirestore.DocumentData): ShareablePhone[] {
  const phones = data.phones;
  if (!Array.isArray(phones)) return [];
  return phones
    .filter((p: Record<string, unknown>) => typeof p?.number === 'string' && p.number.length > 0)
    .map((p: Record<string, unknown>) => ({
      number: String(p.number),
      type: String(p.type ?? 'other'),
      isPrimary: Boolean(p.isPrimary),
    }));
}

function matchesSearch(data: FirebaseFirestore.DocumentData, term: string): boolean {
  const fields = [
    data.firstName, data.lastName, data.companyName,
    data.tradeName, data.serviceName, data.displayName,
  ];
  for (const field of fields) {
    if (typeof field === 'string' && field.toLowerCase().includes(term)) {
      return true;
    }
  }
  // Also match by email
  const emails = data.emails;
  if (Array.isArray(emails)) {
    for (const e of emails) {
      if (typeof e?.email === 'string' && e.email.toLowerCase().includes(term)) {
        return true;
      }
    }
  }
  return false;
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<SearchForShareResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const { searchParams } = new URL(request.url);
      const searchTerm = (searchParams.get('q') ?? '').trim().toLowerCase();

      if (searchTerm.length < 2) {
        throw new ApiError(400, 'Search term must be at least 2 characters', 'VALIDATION_ERROR');
      }

      const db = getAdminFirestore();
      if (!db) {
        throw new ApiError(503, 'Database connection not available', 'DB_UNAVAILABLE');
      }

      // Tenant-scoped query — all contact types
      const snapshot = await db
        .collection(COLLECTIONS.CONTACTS)
        .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
        .get();

      const results: ShareableContact[] = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (!data) continue;

        if (!matchesSearch(data, searchTerm)) continue;

        const name = extractDisplayName(data);
        if (!name) continue;

        results.push({
          id: doc.id,
          name,
          type: (data.type ?? 'individual') as ShareableContact['type'],
          emails: extractEmails(data),
          phones: extractPhones(data),
        });

        // Limit results for performance
        if (results.length >= 20) break;
      }

      logger.info('Contact search for share', {
        term: searchTerm,
        found: results.length,
        tenant: ctx.companyId,
      });

      return apiSuccess<SearchForShareResponse>({
        contacts: results,
        count: results.length,
      });
    },
    { permissions: 'crm:contacts:view' }
  )
);
