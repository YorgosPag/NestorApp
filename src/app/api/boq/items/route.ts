import 'server-only';

import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import type { BOQItem } from '@/types/boq/boq';

async function handleGet(req: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const projectId = request.nextUrl.searchParams.get('projectId');
      if (!projectId) {
        return NextResponse.json({ success: false, error: 'projectId required' }, { status: 400 });
      }

      try {
        const items = await safeFirestoreOperation(async (db) => {
          const snap = await db
            .collection(COLLECTIONS.BOQ_ITEMS)
            .where('companyId', '==', ctx.companyId)
            .where('projectId', '==', projectId)
            .get();

          return snap.docs.map((d) => {
            const data = d.data() as BOQItem;
            return {
              id: d.id,
              title: data.title,
              categoryCode: data.categoryCode,
              estimatedQuantity: data.estimatedQuantity ?? null,
              unit: data.unit,
              description: data.description ?? null,
            };
          });
        }, [] as Array<Pick<BOQItem, 'id' | 'title' | 'categoryCode' | 'estimatedQuantity' | 'unit' | 'description'>>);

        return NextResponse.json({ success: true, data: items });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: getErrorMessage(error) },
          { status: 500 },
        );
      }
    },
  );
  return handler(req);
}

export const GET = withStandardRateLimit(handleGet);
