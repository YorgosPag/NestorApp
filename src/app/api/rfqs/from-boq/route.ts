import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createRfqFromBoqItems } from '@/subapps/procurement/services/rfq-service';
import { z } from 'zod';

const BodySchema = z.object({
  boqItemIds: z.array(z.string().min(1)).min(1).max(30),
});

async function handler(req: NextRequest) {
  return withAuth(req, async (ctx) => {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const dto = await createRfqFromBoqItems(ctx, parsed.data.boqItemIds);
    return NextResponse.json({ data: dto });
  });
}

export const POST = withStandardRateLimit(handler);
