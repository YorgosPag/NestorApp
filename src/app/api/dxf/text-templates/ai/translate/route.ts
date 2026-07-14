/**
 * ADR-651 Φάση Κ — `POST /api/dxf/text-templates/ai/translate`
 *
 * Άγνωστες ετικέτες πινακίδας → προτεινόμενες μεταφράσεις EL↔EN. Καλείται **μόνο** για ό,τι δεν
 * ξέρει το ντετερμινιστικό λεξικό, και το αποτέλεσμα **δεν γράφεται**: περνά από ρητή έγκριση
 * του χρήστη στον διάλογο μεταγλώττισης.
 *
 * Κέλυφος ασφαλείας (rate limit + auth) στο `_ai-route-helpers` (SSoT· μοτίβο Φάσης Δ).
 */
import { NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import { translateTitleBlockTerms } from '@/subapps/dxf-viewer/text-engine/title-block/ai/ai-title-block-translate';
import {
  aiTitleBlockRoutePOST,
  readJsonBody,
  readLocale,
  type AiTranslateBody,
} from '../_ai-route-helpers';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('AiTitleBlockTranslateRoute');

export const POST = aiTitleBlockRoutePOST(logger, async (req, ctx) => {
  const body = await readJsonBody<AiTranslateBody>(req);
  const terms = Array.isArray(body.terms)
    ? body.terms.filter((term): term is string => typeof term === 'string')
    : [];

  if (terms.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No terms to translate', code: 'EMPTY_TERMS' },
      { status: 400 },
    );
  }

  const translations = await translateTitleBlockTerms({
    userId: ctx.uid,
    terms,
    from: readLocale(body.from),
    to: readLocale(body.to),
  });

  return NextResponse.json({ success: true, translations });
});
