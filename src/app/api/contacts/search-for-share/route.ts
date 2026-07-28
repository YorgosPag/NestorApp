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
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import {
  extractContactDisplayName,
  extractContactEmails,
  type ContactEmailEntry,
} from '@/server/lib/contact-doc-fields';

const logger = createModuleLogger('SearchForShareRoute');

// ============================================================================
// TYPES
// ============================================================================

// Το σχήμα του email στην απάντηση ΕΙΝΑΙ αυτό που διαβάζει το SSoT — ψευδώνυμο,
// όχι δεύτερη δήλωση: δύο ταυτόσημα interfaces αποκλίνουν στην πρώτη προσθήκη πεδίου.
type ShareableEmail = ContactEmailEntry;

interface ShareablePhone {
  number: string;
  type: string;
  isPrimary: boolean;
}

interface ShareableContact {
  id: string;
  name: string;
  type: 'individual' | 'company' | 'service';
  emails: readonly ShareableEmail[];
  phones: ShareablePhone[];
}

interface SearchForShareResponse {
  contacts: ShareableContact[];
  count: number;
}

// ============================================================================
// HELPERS
// ============================================================================

// `ShareableEmail` ΕΙΝΑΙ ήδη το σχήμα που επιστρέφει το SSoT — καμία χαρτογράφηση,
// μόνο αναμετάδοση (η σάρωση/φιλτράρισμα ζει στο contact-doc-fields).
function extractEmails(data: FirebaseFirestore.DocumentData): readonly ShareableEmail[] {
  return extractContactEmails(data);
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

/** Strip Greek tonos/diacritics for accent-insensitive search */
function normalizeGreek(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchesSearch(data: FirebaseFirestore.DocumentData, term: string): boolean {
  const normalizedTerm = normalizeGreek(term);
  const fields = [
    data.firstName, data.lastName, data.companyName,
    data.tradeName, data.serviceName, data.displayName,
  ];
  for (const field of fields) {
    if (typeof field === 'string' && normalizeGreek(field).includes(normalizedTerm)) {
      return true;
    }
  }
  // Also match by email
  const emails = data.emails;
  if (Array.isArray(emails)) {
    for (const e of emails) {
      if (typeof e?.email === 'string' && normalizeGreek(e.email).includes(normalizedTerm)) {
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
      const searchTerm = normalizeGreek((searchParams.get('q') ?? '').trim());

      if (searchTerm.length < 2) {
        throw new ApiError(400, 'Search term must be at least 2 characters', 'VALIDATION_ERROR');
      }

      const db = requireAdminFirestore();

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

        const name = extractContactDisplayName(data);
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
