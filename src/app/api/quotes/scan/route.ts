/**
 * POST /api/quotes/scan — Upload quote file (image/PDF) → AI scan → draft quote.
 *
 * Flow:
 *   1. Auth + rate limit (sensitive)
 *   2. Parse multipart formData (file + projectId + vendorContactId + trade [+rfqId,buildingId])
 *   3. Validate file type/size (image ≤10MB, pdf ≤10MB per ADR-327 Q25)
 *   4. Create draft Quote (source: 'scan')
 *   5. Upload file to Storage → companies/{companyId}/quotes/{quoteId}/scan-{fileId}.{ext}
 *   6. Attach to quote
 *   7. Fire-and-forget: classify + extract + applyExtractedData
 *   8. Return 202 { quoteId, status: 'processing' }
 *
 * Client polls GET /api/quotes/{id} until extractedData is populated, then
 * shows ExtractedDataReviewPanel for human review (Q6 default = always review).
 *
 * @see ADR-327 §6 — AI Extraction Strategy (Phase 2)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { uploadPublicFile } from '@/services/storage-admin/public-upload.service';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { generateFileId } from '@/services/enterprise-id.service';
import { buildStoragePath } from '@/services/upload/utils/storage-path';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';
import type { TradeCode } from '@/subapps/procurement/types/trade';
import { createQuote } from '@/subapps/procurement/services/quote-service';
import { createOpenAIQuoteAnalyzer } from '@/subapps/procurement/services/external/openai-quote-analyzer';
import { QuoteAnalyzerStub } from '@/subapps/procurement/services/external/quote-analyzer.stub';
import type { IQuoteAnalyzer } from '@/subapps/procurement/types/quote-analyzer';
import type { Quote, QuoteAttachment } from '@/subapps/procurement/types/quote';
import { processScanAsync } from './process';
import { writeQuoteFileRecord } from './quote-file-record-writer';
import admin from 'firebase-admin';

const logger = createModuleLogger('QUOTES_SCAN_API');

// Required for after() with OpenAI vision: rasterize (~30s) + OpenAI call (~90s) = ~120s total
// Vercel Hobby hard cap = 60s → production needs Pro plan for PDF scans
export const maxDuration = 180;

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB (Q25)
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'application/pdf',
]);

// ============================================================================
// HELPERS
// ============================================================================

function inferExtension(mimeType: string, fallbackName: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic') return 'heic';
  if (mimeType === 'application/pdf') return 'pdf';
  const m = fallbackName.match(/\.([a-zA-Z0-9]+)$/);
  return m?.[1]?.toLowerCase() ?? 'bin';
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

interface ScanFormFields {
  file: File;
  projectId: string;
  vendorContactId: string;
  trade: TradeCode;
  rfqId: string | null;
  buildingId: string | null;
}

function readFormFields(formData: FormData): ScanFormFields | { error: NextResponse } {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: jsonError('file is required (multipart field "file")', 400) };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: jsonError(`File exceeds maximum size of ${MAX_FILE_BYTES / 1024 / 1024}MB`, 413) };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: jsonError(`Unsupported MIME type: ${file.type}`, 415) };
  }

  const projectId = (formData.get('projectId') ?? '').toString().trim();
  const vendorContactId = (formData.get('vendorContactId') ?? '').toString().trim();
  const trade = (formData.get('trade') ?? '').toString().trim();
  const rfqId = (formData.get('rfqId') ?? '').toString().trim() || null;
  const buildingId = (formData.get('buildingId') ?? '').toString().trim() || null;

  if (!projectId) return { error: jsonError('projectId is required', 400) };
  if (!vendorContactId) return { error: jsonError('vendorContactId is required', 400) };
  if (!trade || !(TRADE_CODES as readonly string[]).includes(trade)) {
    return { error: jsonError(`trade is required and must be one of ${TRADE_CODES.length} valid codes`, 400) };
  }

  return {
    file,
    projectId,
    vendorContactId,
    trade: trade as TradeCode,
    rfqId,
    buildingId,
  };
}

async function uploadAndAttach(
  ctx: AuthContext,
  quote: Quote,
  file: File
): Promise<QuoteAttachment> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileId = generateFileId();
  const ext = inferExtension(file.type, file.name);
  const { path: storagePath } = buildStoragePath({
    companyId: ctx.companyId,
    entityType: ENTITY_TYPES.QUOTE,
    entityId: quote.id,
    domain: FILE_DOMAINS.SALES,
    category: FILE_CATEGORIES.DOCUMENTS,
    fileId,
    ext,
  });

  const { url: fileUrl } = await uploadPublicFile({
    storagePath,
    buffer,
    contentType: file.type,
    cacheControl: 'public, max-age=86400',
  });

  // ADR-327 §Phase G — write canonical FileRecord so quote scans appear in
  // the SSoT file system (useEntityFiles / EntityFilesManager / preview).
  await writeQuoteFileRecord({
    fileId,
    quoteId: quote.id,
    projectId: quote.projectId,
    companyId: ctx.companyId,
    createdBy: ctx.uid,
    uploaderName: null,
    storagePath,
    downloadUrl: fileUrl,
    originalFilename: file.name,
    ext,
    contentType: file.type,
    sizeBytes: file.size,
    quoteDisplayNumber: quote.displayNumber ?? null,
  });

  const attachment: QuoteAttachment = {
    id: fileId,
    fileUrl,
    storagePath,
    fileType: file.type === 'application/pdf' ? 'pdf' : 'image',
    mimeType: file.type,
    sizeBytes: file.size,
    uploadedAt: admin.firestore.Timestamp.now(),
    uploadedBy: ctx.uid,
  };

  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.QUOTES).doc(quote.id).update(
      sanitizeForFirestore({ attachments: admin.firestore.FieldValue.arrayUnion(attachment) }),
    );
  });

  return attachment;
}

// ============================================================================
// HANDLER
// ============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth<unknown>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const formData = await req.formData();
        const fields = readFormFields(formData);
        if ('error' in fields) return fields.error;

        const { file, projectId, vendorContactId, trade, rfqId, buildingId } = fields;

        let quote: Quote;
        try {
          quote = await createQuote(ctx, {
            projectId,
            vendorContactId,
            trade,
            source: 'scan',
            rfqId,
            buildingId,
          });
        } catch (err) {
          const message = getErrorMessage(err, 'Failed to create draft quote');
          logger.error('createQuote failed', { error: message });
          return jsonError(message, 400);
        }

        let attachment: QuoteAttachment;
        try {
          attachment = await uploadAndAttach(ctx, quote, file);
        } catch (err) {
          const message = getErrorMessage(err, 'Failed to upload scan file');
          logger.error('uploadAndAttach failed', { quoteId: quote.id, error: message });
          return jsonError(message, 500);
        }

        const analyzer: IQuoteAnalyzer =
          createOpenAIQuoteAnalyzer() ?? new QuoteAnalyzerStub();

        // Capture bytes now — avoids GCS re-download inside after() where bucket
        // resolution can be inconsistent across request boundaries.
        const fileBuffer = Buffer.from(await file.arrayBuffer());

        // Fire-and-forget AI processing — uses Next.js 15 `after()` so it survives
        // beyond response flush on Vercel serverless.
        after(async () => {
          await processScanAsync(ctx, quote.id, attachment.fileUrl, attachment.mimeType, analyzer, fileBuffer);
        });

        logger.info('Quote scan accepted', {
          quoteId: quote.id,
          companyId: ctx.companyId,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
        });

        return NextResponse.json(
          {
            success: true,
            data: {
              quoteId: quote.id,
              displayNumber: quote.displayNumber,
              status: 'processing',
              attachment: {
                id: attachment.id,
                fileUrl: attachment.fileUrl,
                mimeType: attachment.mimeType,
              },
            },
          },
          { status: 202 },
        );
      } catch (error) {
        const message = getErrorMessage(error, 'Quote scan failed');
        logger.error('Quote scan error', { error: message });
        return jsonError(message, 500);
      }
    },
  );
  return handler(request);
}

export const POST = withSensitiveRateLimit(handlePost);
