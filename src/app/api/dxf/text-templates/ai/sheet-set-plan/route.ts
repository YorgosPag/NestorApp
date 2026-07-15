/**
 * ADR-651 Φάση Μ — `POST /api/dxf/text-templates/ai/sheet-set-plan`
 *
 * Φυσική-γλώσσα→Σετ φύλλων (§8 #4): «σετ αδείας — όλοι οι όροφοι εκτός υπογείου» → το μοντέλο
 * (server-only) διαλέγει ποιοι **υπάρχοντες** όροφοι μπαίνουν στο σετ· το route τα **reconcile**-άρει
 * (πετά άγνωστα ids, ντετερμινιστικά defaults αρίθμησης) και επιστρέφει έγκυρο `SheetSetPlan`.
 *
 * Κέλυφος ασφαλείας (rate limit + auth) στο `_ai-route-helpers` (SSoT· ίδιο μοτίβο με `from-text`).
 * Το reconcile τρέχει εδώ (server) όπως στη Φάση Δ, ώστε ο client να λαμβάνει **έτοιμο** σχέδιο.
 */
import { NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import { generateSheetSetPlan } from '@/subapps/dxf-viewer/text-engine/title-block/ai/ai-sheet-set-generator';
import { reconcileSheetSetPlan } from '@/subapps/dxf-viewer/text-engine/title-block/ai/ai-sheet-set-reconcile';
import { sheetNumberPrefixForLocale } from '@/subapps/dxf-viewer/text-engine/title-block/sheet-numbering';
import {
  aiTitleBlockRoutePOST,
  readJsonBody,
  readLocale,
  type AiSheetSetPlanBody,
} from '../_ai-route-helpers';
import { MAX_INTENT_CHARS, readSheetSetPlanLevels } from './sheet-set-plan-body';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('AiSheetSetPlanRoute');

export const POST = aiTitleBlockRoutePOST(logger, async (req, ctx) => {
  const body = await readJsonBody<AiSheetSetPlanBody>(req);
  const intent = typeof body.intent === 'string' ? body.intent.trim() : '';
  if (!intent) {
    return NextResponse.json(
      { success: false, error: 'Empty intent', code: 'EMPTY_INTENT' },
      { status: 400 },
    );
  }
  const levels = readSheetSetPlanLevels(body.levels);
  if (levels.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No levels supplied', code: 'NO_LEVELS' },
      { status: 400 },
    );
  }
  const locale = readLocale(body.locale);
  const ai = await generateSheetSetPlan({
    userId: ctx.uid,
    intent: intent.slice(0, MAX_INTENT_CHARS),
    levels,
    locale,
  });
  if (!ai) {
    return NextResponse.json(
      { success: false, error: 'AI returned no plan', code: 'AI_NO_RESULT' },
      { status: 422 },
    );
  }
  const plan = reconcileSheetSetPlan(ai, levels, sheetNumberPrefixForLocale(locale));
  return NextResponse.json({ success: true, plan });
});
