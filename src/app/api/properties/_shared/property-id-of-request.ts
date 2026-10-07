/**
 * Το id του ακινήτου για διαδρομές που το διαβάζουν από το URL (`withAuth` χωρίς `segmentData`).
 * Ρίχνει πριν από κάθε άλλη δουλειά: 403 χωρίς χώρο, 400 χωρίς id.
 *
 * ⚠️ **Δεν** καλεί τον φρουρό μισθωτή — ο καλών τον καλεί ο ίδιος, με τη δική του πρόθεση
 *    (το CHECK 3.100 διαβάζει το `intent` στο `route.ts`).
 *
 * @module api/properties/_shared/property-id-of-request
 */

import 'server-only';

import type { NextRequest } from 'next/server';
import type { AuthContext } from '@/lib/auth';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { extractNestedIdFromUrl } from '@/lib/api/route-helpers';

export function propertyIdOfRequest(request: NextRequest, ctx: AuthContext): string {
  if (!ctx.companyId) throw new ApiError(403, 'Missing company context');

  const propertyId = extractNestedIdFromUrl(request.url, 'properties');
  if (!propertyId) throw new ApiError(400, 'Property ID is required');

  return propertyId;
}
