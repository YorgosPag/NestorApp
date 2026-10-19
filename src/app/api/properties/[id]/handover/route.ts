/**
 * @fileoverview **«ΤΙ ΘΑ ΠΑΡΑΔΟΘΕΙ ΣΤΟΥΣ ΑΓΟΡΑΣΤΕΣ;»** — η πόρτα της προεπισκόπησης παράδοσης (ADR-916 §5.1).
 * @related services/property-handover/property-handover-preview.server (η απάντηση) ·
 *   lib/property-handover/handover-disposition (η ΜΙΑ κρίση)
 * @module app/api/properties/[id]/handover/route
 *
 * 🔑 **Γιατί ρωτά τον διακομιστή**: η κρίση διαβάζει τον κατάλογο ειδών εγγράφου **και** τα αρχεία των
 * παρακολουθημάτων — ένας κριτής, ο ίδιος που θα χρησιμοποιήσει η μηχανή παράδοσης (Φ-Γ). Αν το υπολόγιζε ο
 * browser, η προεπισκόπηση και η παράδοση θα μπορούσαν να διαφωνήσουν.
 *
 * ⚠️ **Μόνο ανάγνωση** (`intent: 'read'`) — καμία γραφή, ούτε στο ακίνητο ούτε στις παραδόσεις.
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { propertyIdOfRequest } from '@/app/api/properties/_shared/property-id-of-request';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { previewPropertyHandover } from '@/services/property-handover/property-handover-preview.server';
import type { PropertyHandoverPreview } from '@/types/property-handover';

export const dynamic = 'force-dynamic';

async function handleGet(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<ApiSuccessResponse<PropertyHandoverPreview>>> {
  const propertyId = propertyIdOfRequest(request, ctx);
  await requirePropertyInTenantScope({ ctx, propertyId, path: request.nextUrl.pathname, intent: 'read' });

  const preview = await previewPropertyHandover(getAdminFirestore(), ctx.companyId, propertyId);
  if (!preview) throw new ApiError(404, 'PROPERTY_NOT_FOUND');
  return apiSuccess<PropertyHandoverPreview>(preview);
}

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<PropertyHandoverPreview>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handleGet(request, ctx),
    { permissions: 'properties:properties:view' },
  ),
);
