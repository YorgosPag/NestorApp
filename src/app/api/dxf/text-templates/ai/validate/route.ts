/**
 * ADR-651 Φάση Δ (§8 #5) — `POST /api/dxf/text-templates/ai/validate`
 *
 * AI **semantic** compliance: επεκτείνει τον rule-based έλεγχο της Φάσης Ε με σημασιολογικά
 * ευρήματα (προειδοποίηση, ΠΟΤΕ φραγή — Απόφαση #4).
 *
 * Το scope εταιρείας/έργου/χρήστη χτίζεται **server-side** (`buildPlaceholderScope`, tenant-safe,
 * companyId από claims) — ίδια αρχιτεκτονική με τη Φάση Β/ΣΤ (server owns Firestore facts,
 * client owns drawing facts όπως η κλίμακα). Graceful: αποτυχία AI ⇒ `warnings: []`.
 */
import { NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import { buildPlaceholderScope } from '@/subapps/dxf-viewer/text-engine/templates/resolver/scope-builder';
import type { PlaceholderScope } from '@/subapps/dxf-viewer/text-engine/templates/resolver/scope.types';
import type { DxfTextNode } from '@/subapps/dxf-viewer/text-engine/types/text-ast.types';
import { buildDraftTitleBlockTemplate } from '@/subapps/dxf-viewer/text-engine/title-block/ai/ai-title-block-reconcile';
import { aiValidateTitleBlock } from '@/subapps/dxf-viewer/text-engine/title-block/ai/ai-title-block-compliance';
import {
  aiTitleBlockRoutePOST,
  optionalString,
  readJsonBody,
  readLocale,
  type AiValidateBody,
} from '../_ai-route-helpers';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('AiTitleBlockValidateRoute');

/** Ελάχιστος έλεγχος σχήματος (φυλάει τον resolver από κακοσχηματισμένο body). */
function isTextNodeLike(value: unknown): value is DxfTextNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { paragraphs?: unknown }).paragraphs)
  );
}

export const POST = aiTitleBlockRoutePOST(logger, async (req, ctx) => {
  const body = await readJsonBody<AiValidateBody>(req);
  if (!isTextNodeLike(body.content)) {
    return NextResponse.json(
      { success: false, error: 'Invalid content', code: 'INVALID_CONTENT' },
      { status: 400 },
    );
  }
  const locale = readLocale(body.locale);
  const sources = await buildPlaceholderScope({
    companyId: ctx.companyId,
    userId: ctx.uid,
    projectId: optionalString(body.projectId),
    checkerUserId: optionalString(body.checkerUserId),
  });
  const scope: PlaceholderScope = {
    ...sources,
    drawing: {
      scale: optionalString(body.drawing?.scale),
      title: optionalString(body.drawing?.title),
      sheetNumber: optionalString(body.drawing?.sheetNumber),
    },
    formatting: { locale },
  };
  const warnings = await aiValidateTitleBlock({
    userId: ctx.uid,
    template: buildDraftTitleBlockTemplate(body.content, locale),
    scope,
    locale,
    withStampBox: body.withStampBox === true,
    stampImageUrl: optionalString(body.stampImageUrl),
  });
  return NextResponse.json({ success: true, warnings });
});
