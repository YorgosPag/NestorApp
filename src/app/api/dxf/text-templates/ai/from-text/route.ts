/**
 * ADR-651 Φάση Δ — `POST /api/dxf/text-templates/ai/from-text`
 *
 * Φυσική-γλώσσα→Πινακίδα: «φτιάξε πινακίδα A2 άδειας δόμησης» → το μοντέλο (server-only)
 * παράγει ΤΕΕ-συμβατό δομημένο πρότυπο, το route επιστρέφει reconciled draft `TextTemplate`.
 *
 * Κέλυφος ασφαλείας (rate limit + auth) στο `_ai-route-helpers` (SSoT· μοτίβο Φάσης Β).
 */
import { NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import { generateTitleBlockFromText } from '@/subapps/dxf-viewer/text-engine/title-block/ai/ai-title-block-generator';
import {
  aiGenerationResponse,
  aiTitleBlockRoutePOST,
  readJsonBody,
  readLocale,
  type AiFromTextBody,
} from '../_ai-route-helpers';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('AiTitleBlockFromTextRoute');

/** Λογικό όριο μήκους περιγραφής (φραγή κακόβουλου prompt). */
const MAX_PROMPT_CHARS = 2_000;

export const POST = aiTitleBlockRoutePOST(logger, async (req, ctx) => {
  const body = await readJsonBody<AiFromTextBody>(req);
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return NextResponse.json(
      { success: false, error: 'Empty prompt', code: 'EMPTY_PROMPT' },
      { status: 400 },
    );
  }
  const ai = await generateTitleBlockFromText({
    userId: ctx.uid,
    prompt: prompt.slice(0, MAX_PROMPT_CHARS),
    locale: readLocale(body.locale),
  });
  return aiGenerationResponse(ai);
});
