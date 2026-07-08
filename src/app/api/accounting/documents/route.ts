/**
 * =============================================================================
 * GET + POST /api/accounting/documents — List & Create Expense Documents
 * =============================================================================
 *
 * GET:  List expense documents by fiscalYear + optional status filter
 * POST: Create document + trigger AI analysis
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/documents
 * @enterprise ADR-ACC-005 AI Document Processing
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { createModuleLogger } from '@/lib/telemetry';
import { defineRoute, ok, created, badRequest } from '@/lib/api/define-route';
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
import { getErrorMessage } from '@/lib/error-utils';
import { resolveYearInRange } from '../_shared/fiscal-year-param';

const logger = createModuleLogger('AccountingDocumentsRoute');

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

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list documents',
  handler: async ({ req, auth }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const { searchParams } = new URL(req.url);

    const fiscalYear = resolveYearInRange(req, 'fiscalYear', 'fiscalYear');

    const statusParam = searchParams.get('status');
    const status = statusParam && VALID_STATUSES.includes(statusParam as DocumentProcessingStatus)
      ? (statusParam as DocumentProcessingStatus)
      : undefined;

    const documents = await repository.listExpenseDocuments(fiscalYear, status);

    return ok(documents);
  },
});

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

export const POST = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to create document',
  handler: async ({ req, auth }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const documentAnalyzer: IDocumentAnalyzer = createOpenAIDocumentAnalyzer() ?? new DocumentAnalyzerStub();
    const body = (await req.json()) as CreateDocumentBody;

    // Validation
    if (!body.fileUrl || !body.fileName || !body.mimeType) {
      badRequest('fileUrl, fileName, and mimeType are required');
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
      suggestedPOId: null,
      poMatchConfidence: null,
    };

    const { id } = await repository.createExpenseDocument(docData);

    // Trigger AI analysis (non-blocking — update status when done)
    processDocumentAsync(id, body.fileUrl, body.mimeType, repository, documentAnalyzer)
      .catch(async (err) => {
        logger.error('[documents/route] AI processing failed', { id, error: getErrorMessage(err) });
        // A7: Prevent zombie — mark document as error status
        try {
          await repository.updateExpenseDocument(id, {
            status: 'review',
            notes: `AI processing failed: ${getErrorMessage(err)}`,
            updatedAt: isoNow(),
          });
        } catch (statusErr) {
          logger.error('[documents/route] Failed to set error status', { id, error: getErrorMessage(statusErr) });
        }
      });

    return created({ documentId: id, status: 'processing' });
  },
});

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
    logger.error('[documents/route] processDocumentAsync error', { documentId, error });

    // Mark as review with low confidence so user can manually process
    await repository.updateExpenseDocument(documentId, {
      status: 'review',
      updatedAt: isoNow(),
    });
  }
}
