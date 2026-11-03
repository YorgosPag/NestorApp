/**
 * @fileoverview **POST /api/catalog/supplier-showcase** — η ρητή πράξη «Δημοσίευση βιτρίνας» του προμηθευτή.
 * @related ADR-923 §5.13 Δ6 · server/catalog/supplier-showcase.server.ts
 *
 * ⚠️ Ο οργανισμός έρχεται από το `ctx.companyId`, ποτέ από το σώμα. Χωρίς σώμα: η πράξη δεν έχει παραμέτρους.
 * 🔒 `ADMINISTRATIVE_ROLES`: η δημόσια εμφάνιση του οργανισμού.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth, type AuthContext, type PermissionCache } from '@/lib/auth';
import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { publishSupplierShowcase, type SupplierShowcasePublication } from '@/server/catalog/supplier-showcase.server';

const logger = createModuleLogger('api/catalog/supplier-showcase');

type Body = SupplierShowcasePublication | { readonly error: 'NO_ORGANIZATION' | 'UNAVAILABLE' };

async function handler(_request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<Body>> {
  const companyId = ctx.companyId?.trim() ?? '';
  if (companyId === '') return NextResponse.json({ error: 'NO_ORGANIZATION' }, { status: 403 });
  try {
    const outcome = await publishSupplierShowcase(getAdminFirestore(), companyId, ctx.uid);
    return NextResponse.json(outcome, { status: outcome.kind === 'refused' ? 409 : 200 });
  } catch (error) {
    logger.error('Η βιτρίνα δεν δημοσιεύτηκε', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
  }
}

export const POST = withSensitiveRateLimit(withAuth<Body>(handler, { requiredGlobalRoles: ADMINISTRATIVE_ROLES }));
