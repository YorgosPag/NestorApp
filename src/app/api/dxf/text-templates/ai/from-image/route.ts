/**
 * ADR-651 Φάση Δ — `POST /api/dxf/text-templates/ai/from-image`
 *
 * Εικόνα→Πινακίδα: δέχεται ένα base64 data-URI στιγμιότυπο/φωτό υπάρχουσας πινακίδας, το δίνει
 * στο vision μοντέλο (server-only), και επιστρέφει ένα **reconciled draft `TextTemplate`** —
 * ΟΧΙ raster (Απόφαση #5: «ίδια διάταξη, αλλά καθαρή»). Η εικόνα ΔΕΝ αποθηκεύεται (throwaway).
 *
 * Κέλυφος ασφαλείας (rate limit + auth) στο `_ai-route-helpers` (SSoT· μοτίβο Φάσης Β).
 */
import { NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import { generateTitleBlockFromImage } from '@/subapps/dxf-viewer/text-engine/title-block/ai/ai-title-block-generator';
import {
  aiGenerationResponse,
  aiTitleBlockRoutePOST,
  readJsonBody,
  readLocale,
  type AiFromImageBody,
} from '../_ai-route-helpers';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('AiTitleBlockFromImageRoute');

/** ~5MB εικόνα ⇒ ~6.8MB base64· κόβουμε πάνω από 7M χαρακτήρες (φραγή κακόβουλου body). */
const MAX_DATA_URI_CHARS = 7_000_000;

export const POST = aiTitleBlockRoutePOST(logger, async (req, ctx) => {
  const body = await readJsonBody<AiFromImageBody>(req);
  const imageDataUrl = body.imageDataUrl;
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    return NextResponse.json(
      { success: false, error: 'Invalid image', code: 'INVALID_IMAGE' },
      { status: 400 },
    );
  }
  if (imageDataUrl.length > MAX_DATA_URI_CHARS) {
    return NextResponse.json(
      { success: false, error: 'Image too large', code: 'IMAGE_TOO_LARGE' },
      { status: 413 },
    );
  }
  const ai = await generateTitleBlockFromImage({
    userId: ctx.uid,
    imageDataUrl,
    locale: readLocale(body.locale),
  });
  return aiGenerationResponse(ai);
});
