import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { BOQItem } from '@/types/boq/boq';

async function handler(req: NextRequest) {
  return withAuth(req, async (ctx) => {
    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    return safeFirestoreOperation(async (db) => {
      const snap = await db
        .collection(COLLECTIONS.BOQ_ITEMS)
        .where('companyId', '==', ctx.companyId)
        .where('projectId', '==', projectId)
        .get();

      const items: Array<Pick<BOQItem, 'id' | 'title' | 'categoryCode' | 'estimatedQuantity' | 'unit' | 'description'>> =
        snap.docs.map((d) => {
          const data = d.data() as BOQItem;
          return {
            id: d.id,
            title: data.title,
            categoryCode: data.categoryCode,
            estimatedQuantity: data.estimatedQuantity,
            unit: data.unit,
            description: data.description ?? null,
          };
        });

      return NextResponse.json({ data: items });
    });
  });
}

export const GET = withStandardRateLimit(handler);
