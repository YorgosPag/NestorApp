/**
 * =============================================================================
 * GET + POST /api/accounting/documents — List & Create Expense Documents
 * =============================================================================
 *
 * GET:  List expense documents by fiscalYear + optional status filter
 * POST: Create document + trigger AI analysis
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/documents
 * @enterprise ADR-ACC-005 AI Document Processing
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { isoNow } from '@/subapps/accounting/services/repository/firestore-helpers';
import type { IDocumentAnalyzer } from '@/subapps/accounting/types/interfaces';
import { createOpenAIDocumentAnalyzer } from '@/subapps/accounting/services/external/openai-document-analyzer';
import { DocumentAnalyzerStub } from '@/subapps/accounting/services/external/document-analyzer.stub';
import type {
  DocumentProcessingStatus,
  DocumentType,
  ReceivedExpenseDocument,
} from '@/subapps/accounting/types';

// =============================================================================
// VALID CONSTANTS
// =============================================================================

const VALID_STATUSES: DocumentProcessingStatus[] = ['processing', 'review', 'confirmed', 'rejected'];
const VALID_DOCUMENT_TYPES: DocumentType[] = [
  'purchase_invoice', 'receipt', 'utility_bill', 'telecom_bill',
  'fuel_receipt', 'bank_statement', 'other',
];

// =============================================================================
// GET — List Expense Documents
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const { searchParams } = new URL(req.url);

        const fiscalYearParam = searchParams.get('fiscalYear');
        const fiscalYear = fiscalYearParam
          ? parseInt(fiscalYearParam, 10)
          : new Date().getFullYear();

        if (Number.isNaN(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
          return NextResponse.json(
            { success: false, error: 'fiscalYear must be a valid year (2000-2100)' },
            { status: 400 }
          );
        }

        const statusParam = searchParams.get('status');
        const status = statusParam && VALID_STATUSES.includes(statusParam as DocumentProcessingStatus)
          ? (statusParam as DocumentProcessingStatus)
          : undefined;

        const documents = await repository.listExpenseDocuments(fiscalYear, status);

        return NextResponse.json({ success: true, data: documents });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list documents';
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);

// =============================================================================
// POST — Create Document + Trigger AI Analysis
// =============================================================================

interface CreateDocumentBody {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fiscalYear: number;
  documentType?: DocumentType;
  notes?: string;
}

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const documentAnalyzer: IDocumentAnalyzer = createOpenAIDocumentAnalyzer() ?? new DocumentAnalyzerStub();
        const body = (await req.json()) as CreateDocumentBody;

        // Validation
        if (!body.fileUrl || !body.fileName || !body.mimeType) {
          return NextResponse.json(
            { success: false, error: 'fileUrl, fileName, and mimeType are required' },
            { status: 400 }
          );
        }

        const fiscalYear = body.fiscalYear ?? new Date().getFullYear();
        const documentType: DocumentType = body.documentType && VALID_DOCUMENT_TYPES.includes(body.documentType)
          ? body.documentType
          : 'other';

        // Create document in Firestore with status "processing"
        const docData: Omit<ReceivedExpenseDocument, 'documentId' | 'createdAt' | 'updatedAt'> = {
          type: documentType,
          status: 'processing',
          fileUrl: body.fileUrl,
          fileName: body.fileName,
          mimeType: body.mimeType,
          fileSize: body.fileSize ?? 0,
          extractedData: {
            issuerName: null,
            issuerVatNumber: null,
            issuerAddress: null,
            documentNumber: null,
            issueDate: null,
            netAmount: null,
            vatAmount: null,
            grossAmount: null,
            vatRate: null,
            lineItems: [],
            paymentMethod: null,
            overallConfidence: 0,
          },
          confirmedCategory: null,
          confirmedNetAmount: null,
          confirmedVatAmount: null,
          confirmedDate: null,
          confirmedIssuerName: null,
          journalEntryId: null,
          notes: body.notes ?? null,
          fiscalYear,
        };

        const { id } = await repository.createExpenseDocument(docData);

        // Trigger AI analysis (non-blocking — update status when done)
        processDocumentAsync(id, body.fileUrl, body.mimeType, repository, documentAnalyzer)
          .catch((err) => {
            console.error(`[documents/route] AI processing failed for ${id}:`, err);
          });

        return NextResponse.json(
          { success: true, data: { documentId: id, status: 'processing' } },
          { status: 201 }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create document';
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);

// =============================================================================
// AI PROCESSING (async, non-blocking)
// =============================================================================

async function processDocumentAsync(
  documentId: string,
  fileUrl: string,
  mimeType: string,
  repository: ReturnType<typeof createAccountingServices>['repository'],
  documentAnalyzer: IDocumentAnalyzer
): Promise<void> {
  try {
    // Step 1: Classify document
    const classification = await documentAnalyzer.classifyDocument(fileUrl, mimeType);

    // Step 2: Extract data
    const extractedData = await documentAnalyzer.extractData(fileUrl, classification.documentType);

    // Step 3: Update document with results
    await repository.updateExpenseDocument(documentId, {
      type: classification.documentType,
      status: 'review',
      extractedData,
      updatedAt: isoNow(),
    });
  } catch (error) {
    console.error(`[documents/route] processDocumentAsync error for ${documentId}:`, error);

    // Mark as review with low confidence so user can manually process
    await repository.updateExpenseDocument(documentId, {
      status: 'review',
      updatedAt: isoNow(),
    });
  }
}
