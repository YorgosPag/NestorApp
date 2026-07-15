/**
 * ADR-651 Φάση Δ — κοινά helpers των AI routes της πινακίδας (SSoT, N.18).
 *
 * Και τα τρία routes (`from-image` / `from-text` / `validate`) μοιράζονται το **ίδιο** κέλυφος
 * ασφαλείας (μοτίβο Φάσης Β): `withStandardRateLimit` + `withAuth` (companyId/userId από claims)
 * + try/catch → `errorResponse`. Ζει εδώ μία φορά ώστε τα routes να κρατούν ΜΟΝΟ τη δική τους
 * λογική — κανένα δίδυμο boilerplate.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import type { createModuleLogger } from '@/lib/telemetry';
import type { AiTitleBlock } from '@/subapps/dxf-viewer/text-engine/title-block/ai/ai-title-block-schema';
import { toAiTitleBlockResult } from '@/subapps/dxf-viewer/text-engine/title-block/ai/ai-title-block-reconcile';
import { errorResponse } from '../_helpers';

type RouteLogger = ReturnType<typeof createModuleLogger>;

// ── Wire bodies (untrusted) — ζουν εδώ ώστε τα routes να μη δηλώνουν δίδυμα σχήματα ──────────

export interface AiFromImageBody {
  readonly imageDataUrl?: unknown;
  readonly locale?: unknown;
}

export interface AiFromTextBody {
  readonly prompt?: unknown;
  readonly locale?: unknown;
}

/** ADR-651 Φάση Κ — οι ετικέτες που δεν ήξερε το λεξικό, μαζί με την κατεύθυνση μετάφρασης. */
export interface AiTranslateBody {
  readonly terms?: unknown;
  readonly from?: unknown;
  readonly to?: unknown;
}

/** ADR-651 Φάση Μ — η πρόθεση + οι υπάρχοντες όροφοι για το AI σετ φύλλων (§8 #4). */
export interface AiSheetSetPlanBody {
  readonly intent?: unknown;
  readonly levels?: unknown;
  readonly locale?: unknown;
}

export interface AiValidateBody {
  readonly content?: unknown;
  readonly locale?: unknown;
  readonly withStampBox?: unknown;
  readonly stampImageUrl?: unknown;
  readonly projectId?: unknown;
  readonly checkerUserId?: unknown;
  readonly drawing?: {
    readonly scale?: unknown;
    readonly title?: unknown;
    readonly sheetNumber?: unknown;
  };
}

/** Ανάγνωση JSON body χωρίς throw (κακοσχηματισμένο ⇒ κενό αντικείμενο). */
export async function readJsonBody<T>(req: NextRequest): Promise<T> {
  return (await req.json().catch(() => ({}))) as T;
}

/** Untrusted locale → `'el' | 'en'` (ελληνικά default). */
export function readLocale(value: unknown): 'el' | 'en' {
  return value === 'en' ? 'en' : 'el';
}

/** Body strings είναι untrusted — μόνο μη-κενά strings περνούν. */
export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Κοινό κέλυφος: rate limit + auth (`dxf:files:view`) + try/catch. Το `run` επιστρέφει το
 * `NextResponse` της συγκεκριμένης ροής· κάθε exception γίνεται `errorResponse` με log.
 */
export function aiTitleBlockRoutePOST(
  logger: RouteLogger,
  run: (req: NextRequest, ctx: AuthContext) => Promise<NextResponse>,
) {
  return (request: NextRequest): Promise<NextResponse> => {
    const handler = withStandardRateLimit(
      withAuth<unknown>(
        async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
          try {
            return await run(req, ctx);
          } catch (err) {
            logger.warn('AI title-block route failed', { uid: ctx.uid, err });
            return errorResponse(err);
          }
        },
        { permissions: 'dxf:files:view' },
      ),
    );
    return handler(request);
  };
}

/** Η κοινή απόκριση των generation routes: `null` ⇒ 422 (graceful)· αλλιώς reconciled result. */
export function aiGenerationResponse(ai: AiTitleBlock | null): NextResponse {
  if (!ai) {
    return NextResponse.json(
      { success: false, error: 'AI returned no result', code: 'AI_NO_RESULT' },
      { status: 422 },
    );
  }
  return NextResponse.json({ success: true, result: toAiTitleBlockResult(ai) });
}
