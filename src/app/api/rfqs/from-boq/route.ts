import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createRfqFromBoqItems } from '@/subapps/procurement/services/rfq-service';
import { z } from 'zod';
import { RFQ_FROM_BOQ_MAX_ITEMS } from '@/subapps/procurement/types/rfq';

const BodySchema = z.object({
  boqItemIds: z.array(z.string().min(1)).min(1).max(RFQ_FROM_BOQ_MAX_ITEMS),
});

const innerHandler = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const dto = await createRfqFromBoqItems(ctx, parsed.data.boqItemIds);
    return NextResponse.json({ data: dto });
  },
);

export const POST = withStandardRateLimit(innerHandler);
