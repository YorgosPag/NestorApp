/**
 * GET + POST + PATCH + DELETE /api/settings/boq-subcategories
 *
 * System-level catalog for BOQ Level-2 sub-categories.
 * No companyId — global catalog seeded by scripts/seed-boq-subcategories.ts.
 *
 * @see ADR-337 §4.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateBoqCategoryId } from '@/services/enterprise-id.service';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BOQSubcategoriesRoute');

// =============================================================================
// GET — list all sub-categories (ordered by parentCode + sortOrder)
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
      }
      try {
        const snap = await adminDb
          .collection(COLLECTIONS.BOQ_SYSTEM_SUBCATEGORIES)
          .orderBy('parentCode')
          .orderBy('sortOrder')
          .get();
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return NextResponse.json({ success: true, items });
      } catch (error) {
        logger.error('GET boq-subcategories failed', { error: getErrorMessage(error) });
        return NextResponse.json({ success: false, error: 'Failed to read' }, { status: 500 });
      }
    }
  );
  return handler(request);
}

// =============================================================================
// POST — create new sub-category
// =============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
      }
      try {
        const body = (await req.json()) as Record<string, unknown>;
        const { parentCode, code, nameEL, nameEN, sortOrder } = body;

        if (typeof parentCode !== 'string' || typeof code !== 'string' ||
            typeof nameEL !== 'string' || typeof nameEN !== 'string') {
          return NextResponse.json(
            { success: false, error: 'parentCode, code, nameEL, nameEN are required strings' },
            { status: 400 }
          );
        }

        const id = generateBoqCategoryId();
        const now = nowISO();
        const doc = {
          id, code, parentCode, nameEL, nameEN,
          sortOrder: typeof sortOrder === 'number' ? sortOrder : 999,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };

        await adminDb.collection(COLLECTIONS.BOQ_SYSTEM_SUBCATEGORIES).doc(id).set(doc);
        return NextResponse.json({ success: true, item: doc }, { status: 201 });
      } catch (error) {
        logger.error('POST boq-subcategories failed', { error: getErrorMessage(error) });
        return NextResponse.json({ success: false, error: 'Failed to create' }, { status: 500 });
      }
    }
  );
  return handler(request);
}

// =============================================================================
// PATCH — update nameEL / nameEN / sortOrder / isActive
// =============================================================================

async function handlePatch(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
      }
      try {
        const body = (await req.json()) as Record<string, unknown>;
        const { id, ...fields } = body;

        if (typeof id !== 'string') {
          return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
        }

        const update: Record<string, unknown> = { updatedAt: nowISO() };
        if (typeof fields.nameEL === 'string') update.nameEL = fields.nameEL;
        if (typeof fields.nameEN === 'string') update.nameEN = fields.nameEN;
        if (typeof fields.sortOrder === 'number') update.sortOrder = fields.sortOrder;
        if (typeof fields.isActive === 'boolean') update.isActive = fields.isActive;

        await adminDb.collection(COLLECTIONS.BOQ_SYSTEM_SUBCATEGORIES).doc(id).update(update);
        return NextResponse.json({ success: true });
      } catch (error) {
        logger.error('PATCH boq-subcategories failed', { error: getErrorMessage(error) });
        return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 });
      }
    }
  );
  return handler(request);
}

// =============================================================================
// DELETE — hard delete by ?id=
// =============================================================================

async function handleDelete(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
      }
      try {
        const id = req.nextUrl.searchParams.get('id');
        if (!id) {
          return NextResponse.json({ success: false, error: 'id query param required' }, { status: 400 });
        }
        await adminDb.collection(COLLECTIONS.BOQ_SYSTEM_SUBCATEGORIES).doc(id).delete();
        return NextResponse.json({ success: true });
      } catch (error) {
        logger.error('DELETE boq-subcategories failed', { error: getErrorMessage(error) });
        return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
      }
    }
  );
  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
export const POST = withStandardRateLimit(handlePost);
export const PATCH = withStandardRateLimit(handlePatch);
export const DELETE = withStandardRateLimit(handleDelete);
