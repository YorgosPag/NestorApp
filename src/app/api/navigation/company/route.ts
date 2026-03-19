/**
 * =============================================================================
 * NAVIGATION COMPANY MANAGEMENT - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * Single-company add/remove for the navigation UI.
 * Uses Admin SDK to bypass Firestore rules (navigation_companies: write = false).
 *
 * @method POST   - Add one company to navigation
 * @method DELETE - Remove one company from navigation
 *
 * @security withAuth + admin role check (super_admin | company_admin)
 * @permission projects:projects:view (same as bootstrap endpoint)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { generateNavigationId } from '@/services/enterprise-id.service';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('NavigationCompanyRoute');

export const dynamic = 'force-dynamic';

// ============================================================================
// POST - Add company to navigation
// ============================================================================

export async function POST(request: NextRequest) {
  const handler = withStandardRateLimit(withAuth<unknown>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleAddCompany(req, ctx);
    },
    { permissions: 'projects:projects:view' }
  ));

  return handler(request);
}

async function handleAddCompany(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  // Admin-only (same check as bootstrap)
  const isAdmin = ctx.globalRole === 'super_admin' || ctx.globalRole === 'company_admin';
  if (!isAdmin) {
    logger.warn('[NavCompany] Non-admin attempted add', { uid: ctx.uid, role: ctx.globalRole });
    return NextResponse.json({ success: false, error: 'Forbidden: admin role required' }, { status: 403 });
  }

  const body = await request.json() as { contactId?: string };
  const { contactId } = body;

  if (!contactId || typeof contactId !== 'string') {
    return NextResponse.json({ success: false, error: 'contactId is required (string)' }, { status: 400 });
  }

  const adminDb = getAdminFirestore();

  // Check for duplicates
  const existing = await adminDb
    .collection(COLLECTIONS.NAVIGATION)
    .where(FIELDS.CONTACT_ID, '==', contactId)
    .limit(1)
    .get();

  if (!existing.empty) {
    logger.info('[NavCompany] Company already in navigation', { contactId });
    return apiSuccess({ alreadyExists: true }, 'Company already in navigation');
  }

  // Add via Admin SDK (bypasses Firestore rules) — ADR-210: enterprise ID
  const navId = generateNavigationId();
  await adminDb.collection(COLLECTIONS.NAVIGATION).doc(navId).set({
    contactId,
    addedAt: new Date(),
    addedBy: ctx.uid
  });

  logger.info('[NavCompany] Company added to navigation', { contactId, docId: navId, by: ctx.email });

  return apiSuccess({ id: navId, contactId }, 'Company added to navigation');
}

// ============================================================================
// DELETE - Remove company from navigation
// ============================================================================

export async function DELETE(request: NextRequest) {
  const handler = withStandardRateLimit(withAuth<unknown>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleRemoveCompany(req, ctx);
    },
    { permissions: 'projects:projects:view' }
  ));

  return handler(request);
}

async function handleRemoveCompany(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const isAdmin = ctx.globalRole === 'super_admin' || ctx.globalRole === 'company_admin';
  if (!isAdmin) {
    logger.warn('[NavCompany] Non-admin attempted remove', { uid: ctx.uid, role: ctx.globalRole });
    return NextResponse.json({ success: false, error: 'Forbidden: admin role required' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const contactId = searchParams.get('contactId');

  if (!contactId) {
    return NextResponse.json({ success: false, error: 'contactId query param is required' }, { status: 400 });
  }

  const adminDb = getAdminFirestore();

  const snapshot = await adminDb
    .collection(COLLECTIONS.NAVIGATION)
    .where(FIELDS.CONTACT_ID, '==', contactId)
    .get();

  if (snapshot.empty) {
    return apiSuccess({ removed: false }, 'Company not found in navigation');
  }

  const batch = adminDb.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  logger.info('[NavCompany] Company removed from navigation', { contactId, docsRemoved: snapshot.size, by: ctx.email });

  return apiSuccess({ removed: true, count: snapshot.size }, 'Company removed from navigation');
}
