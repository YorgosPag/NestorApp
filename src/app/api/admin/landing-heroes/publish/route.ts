/**
 * =============================================================================
 * ΕΙΚΟΝΕΣ ΗΡΩΑ — ΔΗΜΟΣΙΕΥΣΗ / ΕΠΑΝΑΦΟΡΑ (ADR-881 §4.2)
 * =============================================================================
 * `POST { page, revisionId }` ⇒ η έκδοση γίνεται ζωντανή για τη σελίδα.
 * `POST { page, revisionId: null }` ⇒ επιστροφή στην ενσωματωμένη εικόνα.
 * Επαναφορά = δημοσίευση παλιότερης έκδοσης — **τίποτα δεν σβήνεται** (Shopify/Webflow).
 *
 * ✅ Φυσικά ιδεμποτική: ίδιο σώμα δύο φορές ⇒ ίδιος δείκτης. Το `withAuth` κρατά ούτως ή άλλως
 *    το σύνορο ιδεμποτίας (ADR-872) — η απάντηση αναπαράγεται, δεν ξαναεκτελείται.
 *
 * 🔒 SECURITY: `super_admin` + `platform_landing_heroes:heroes:publish` + withSensitiveRateLimit.
 * @module api/admin/landing-heroes/publish
 */

import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { BYPASS_ROLES } from '@/lib/auth/roles';
import { readJsonBody } from '@/lib/api/json-body';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { publishLandingHeroBodySchema } from '@/lib/landing/landing-hero-api';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { publishLandingHero } from '@/services/landing-hero/landing-hero-publication';

async function publish(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const parsed = await readJsonBody(request, publishLandingHeroBodySchema);
  if ('rejected' in parsed) return parsed.rejected;

  const result = await publishLandingHero(getAdminFirestore(), ctx, parsed.data.page, parsed.data.revisionId);
  if (result.outcome === 'invalid-target') return NextResponse.json({ error: 'invalid-target' }, { status: 409 });
  return NextResponse.json({ previous: result.previous });
}

export const POST = withSensitiveRateLimit(
  withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => publish(request, ctx),
    { requiredGlobalRoles: BYPASS_ROLES, permissions: 'platform_landing_heroes:heroes:publish' },
  ),
);
