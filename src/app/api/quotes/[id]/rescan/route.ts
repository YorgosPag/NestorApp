/**
 * POST /api/quotes/[id]/rescan — «Επανάληψη» εξαγωγής AI για προσφορά σάρωσης που απέτυχε ή κόλλησε.
 *
 * ADR-327 §6.10 (Rossum: `failed_import` → νέα εισαγωγή). Σειρά:
 *   1. φθηνός έλεγχος (κριτής `resolveQuoteIntakeView`) — μη κατεβάσεις bytes για προσφορά που δεν δικαιούται
 *   2. τα bytes του πρωτοτύπου μέσα από την αλυσίδα κηδεμονίας αρχείων (`loadOwnedFileBytes`: μισθωτής → ορατότητα
 *      δοχείου → κάδος της εγγραφής, ADR-862 · ADR-895) — ποτέ `fetch(url)`
 *   3. **η αυθεντική απόφαση**: συναλλαγή compare-and-set (`markQuoteExtractionPending`) — δύο κλικ, μία προσπάθεια
 *   4. `after()` → ο ΙΔΙΟΣ επεξεργαστής με την πρώτη σάρωση, με τον νέο αριθμό προσπάθειας (fencing)
 *
 * Απαντήσεις: 202 `{ quoteId, attempt }` · 404 · 409 `{ code }` (`in_progress` · `not_retryable` · `no_document`) ·
 * 503 (το αρχείο δεν διαβάστηκε — ξαναδοκίμασε). Ιδεμποτία ανά `Idempotency-Key`: το σύνορο `withAuth` (CHECK 3.92).
 *
 * Auth: withAuth | Rate: sensitive (ίδια βαθμίδα με τη σάρωση — κοστίζει κλήση AI)
 */

import 'server-only';

import { NextRequest, NextResponse, after } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { getQuote } from '@/subapps/procurement/services/quote-service';
import { markQuoteExtractionPending } from '@/subapps/procurement/services/quote-extraction-lifecycle';
import { resolveQuoteIntakeView } from '@/subapps/procurement/utils/quote-intake-view';
import type { Quote, QuoteAttachment } from '@/subapps/procurement/types/quote';
import { loadOwnedFileBytes } from '@/app/api/files/_shared/owned-file-bytes';
import { OWNED_FILE_VIEW_ACTION } from '@/app/api/files/_shared/owned-file-insight-route';
import { processScanAsync, resolveQuoteAnalyzer } from '../../scan/process';

const logger = createModuleLogger('QUOTE_RESCAN_API');

type RescanRefusal = 'in_progress' | 'not_retryable' | 'no_document';

function refuse(code: RescanRefusal): NextResponse {
  return NextResponse.json({ success: false, error: code, code }, { status: 409 });
}

/** Το έγγραφο που σαρώθηκε: το **τελευταίο** συνημμένο (η σάρωση επισυνάπτει ένα, η επανάληψη δεν προσθέτει). */
function scannedDocument(quote: Quote): QuoteAttachment | null {
  return quote.attachments.at(-1) ?? null;
}

async function handleRescan(ctx: AuthContext, quoteId: string): Promise<NextResponse> {
  const quote = await getQuote(ctx.companyId, quoteId);
  if (!quote) return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });

  const view = resolveQuoteIntakeView(quote, Date.now());
  if (view.kind === 'extracting') return refuse('in_progress');
  if (view.kind !== 'failed' && view.kind !== 'stalled') return refuse('not_retryable');

  const document = scannedDocument(quote);
  if (!document) return refuse('no_document');

  const bytes = await loadOwnedFileBytes({
    fileId: document.id,
    caller: { custody: 'company', ctx },
    action: 'quote-rescan',
    capability: OWNED_FILE_VIEW_ACTION,
  });
  if (bytes.outcome === 'refused') return refuse('no_document');
  if (bytes.outcome === 'unavailable') {
    return NextResponse.json({ success: false, error: 'file_unavailable' }, { status: 503 });
  }

  const started = await markQuoteExtractionPending(ctx, quoteId);
  if (started.outcome !== 'started') return refuse(started.outcome);

  const analyzer = resolveQuoteAnalyzer();
  after(async () => {
    await processScanAsync(ctx, {
      quoteId,
      fileUrl: document.fileUrl,
      mimeType: document.mimeType,
      fileBuffer: bytes.buffer,
      attempt: started.attempt,
    }, analyzer);
  });

  logger.info('Quote rescan accepted', { quoteId, attempt: started.attempt, companyId: ctx.companyId });
  return NextResponse.json({ success: true, data: { quoteId, attempt: started.attempt } }, { status: 202 });
}

async function handlePost(
  request: NextRequest,
  context?: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: quoteId } = await context!.params;
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        return await handleRescan(ctx, quoteId);
      } catch (error) {
        logger.error('Quote rescan error', { quoteId, error: getErrorMessage(error) });
        return NextResponse.json({ success: false, error: 'rescan_failed' }, { status: 500 });
      }
    },
  );
  return handler(request, context);
}

export const maxDuration = 180;

export const POST = withSensitiveRateLimit(handlePost);
