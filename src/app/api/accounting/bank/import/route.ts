/**
 * =============================================================================
 * POST /api/accounting/bank/import — CSV Bank Import
 * =============================================================================
 *
 * Accepts a CSV file (multipart/form-data) and imports bank transactions.
 *
 * FormData fields:
 *   - file:      CSV file (required)
 *   - accountId: Bank account ID (required)
 *
 * Returns: { batch: ImportBatch }
 *
 * CSV format (auto-detected delimiter: comma or semicolon):
 *   Row 1 = headers (skipped)
 *   Columns: Date | Description | Debit | Credit | Balance (flexible mapping)
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/bank/import
 * @enterprise ADR-ACC-008 Bank Reconciliation
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type {
  BankTransaction,
  ImportBatch,
  TransactionDirection,
} from '@/subapps/accounting/types';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum file size: 5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Maximum rows per import */
const MAX_ROWS = 5000;

/** Supported file extensions */
const SUPPORTED_EXTENSIONS = ['.csv', '.txt'];

// =============================================================================
// CSV PARSING HELPERS
// =============================================================================

/** Detect delimiter from the first line */
function detectDelimiter(headerLine: string): string {
  const semicolonCount = (headerLine.match(/;/g) ?? []).length;
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const tabCount = (headerLine.match(/\t/g) ?? []).length;

  if (tabCount > semicolonCount && tabCount > commaCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

/** Parse a date string in common Greek bank formats */
function parseCSVDate(raw: string): string | null {
  const trimmed = raw.trim().replace(/"/g, '');
  if (!trimmed) return null;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}`;
  }

  // YYYY-MM-DD (already ISO)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;

  return null;
}

/** Parse a numeric string (handles Greek decimal: 1.234,56 or 1,234.56) */
function parseCSVAmount(raw: string): number | null {
  const trimmed = raw.trim().replace(/"/g, '').replace(/\s/g, '');
  if (!trimmed || trimmed === '-') return null;

  // Greek format: 1.234,56 → remove dots, replace comma with dot
  if (trimmed.includes(',') && trimmed.indexOf(',') > trimmed.lastIndexOf('.')) {
    const normalized = trimmed.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return Number.isNaN(num) ? null : num;
  }

  // Standard format: 1,234.56 → remove commas
  const normalized = trimmed.replace(/,/g, '');
  const num = parseFloat(normalized);
  return Number.isNaN(num) ? null : num;
}

/**
 * Auto-detect column indices from header names.
 * Returns mapping: { date, description, debit, credit, amount, balance, counterparty, reference }
 */
function detectColumnMapping(headers: string[]): {
  dateIdx: number;
  descIdx: number;
  debitIdx: number | null;
  creditIdx: number | null;
  amountIdx: number | null;
  balanceIdx: number | null;
  counterpartyIdx: number | null;
  referenceIdx: number | null;
} {
  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/"/g, ''));

  const datePatterns = ['\u03b7\u03bc\u03b5\u03c1\u03bf\u03bc\u03b7\u03bd\u03af\u03b1', 'date', '\u03b7\u03bc/\u03bd\u03af\u03b1', 'value date', 'valuedate', '\u03b7\u03bc.\u03b1\u03be\u03af\u03b1\u03c2'];
  const descPatterns = ['\u03c0\u03b5\u03c1\u03b9\u03b3\u03c1\u03b1\u03c6\u03ae', 'description', '\u03b1\u03b9\u03c4\u03b9\u03bf\u03bb\u03bf\u03b3\u03af\u03b1', 'details', 'narrative'];
  const debitPatterns = ['\u03c7\u03c1\u03ad\u03c9\u03c3\u03b7', 'debit', 'withdrawal', '\u03c7\u03c1\u03b5\u03c9\u03c3\u03b7'];
  const creditPatterns = ['\u03c0\u03af\u03c3\u03c4\u03c9\u03c3\u03b7', 'credit', 'deposit', '\u03c0\u03b9\u03c3\u03c4\u03c9\u03c3\u03b7'];
  const amountPatterns = ['\u03c0\u03bf\u03c3\u03cc', 'amount', '\u03c0\u03bf\u03c3\u03bf'];
  const balancePatterns = ['\u03c5\u03c0\u03cc\u03bb\u03bf\u03b9\u03c0\u03bf', 'balance', '\u03c5\u03c0\u03bf\u03bb\u03bf\u03b9\u03c0\u03bf'];
  const counterpartyPatterns = ['\u03b4\u03b9\u03ba\u03b1\u03b9\u03bf\u03cd\u03c7\u03bf\u03c2', 'counterparty', 'beneficiary', '\u03b1\u03bd\u03c4\u03b9\u03c3\u03c5\u03bc\u03b2\u03b1\u03bb\u03bb\u03cc\u03bc\u03b5\u03bd\u03bf\u03c2'];
  const refPatterns = ['\u03b1\u03c1\u03b9\u03b8\u03bc\u03cc\u03c2', 'reference', 'ref', '\u03b1\u03c1\u03b9\u03b8\u03bc\u03bf\u03c2 \u03c3\u03c5\u03bd\u03b1\u03bb\u03bb\u03b1\u03b3\u03ae\u03c2'];

  const findIdx = (patterns: string[]): number | null => {
    for (const pattern of patterns) {
      const idx = normalized.findIndex((h) => h.includes(pattern));
      if (idx !== -1) return idx;
    }
    return null;
  };

  return {
    dateIdx: findIdx(datePatterns) ?? 0,
    descIdx: findIdx(descPatterns) ?? 1,
    debitIdx: findIdx(debitPatterns),
    creditIdx: findIdx(creditPatterns),
    amountIdx: findIdx(amountPatterns),
    balanceIdx: findIdx(balancePatterns),
    counterpartyIdx: findIdx(counterpartyPatterns),
    referenceIdx: findIdx(refPatterns),
  };
}

// =============================================================================
// POST — Import Bank CSV
// =============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();

        // 1. Parse FormData
        const formData = await req.formData();
        const file = formData.get('file');
        const accountId = formData.get('accountId');

        if (!file || !(file instanceof File)) {
          return NextResponse.json(
            { error: 'file is required (CSV)' },
            { status: 400 }
          );
        }

        if (!accountId || typeof accountId !== 'string') {
          return NextResponse.json(
            { error: 'accountId is required' },
            { status: 400 }
          );
        }

        // 2. Validate file
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
            { status: 400 }
          );
        }

        const fileName = file.name.toLowerCase();
        const hasValidExtension = SUPPORTED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
        if (!hasValidExtension) {
          return NextResponse.json(
            { error: 'Unsupported file type. Please upload a .csv file' },
            { status: 400 }
          );
        }

        // 3. Read and parse CSV
        const csvText = await file.text();
        const lines = csvText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (lines.length < 2) {
          return NextResponse.json(
            { error: 'CSV file must have at least a header row and one data row' },
            { status: 400 }
          );
        }

        const headerLine = lines[0];
        if (!headerLine) {
          return NextResponse.json(
            { error: 'CSV file is empty' },
            { status: 400 }
          );
        }

        const delimiter = detectDelimiter(headerLine);
        const headers = headerLine.split(delimiter);
        const columnMap = detectColumnMapping(headers);

        const dataLines = lines.slice(1, MAX_ROWS + 1);
        const totalRows = dataLines.length;

        // 4. Parse rows into transaction data
        const now = new Date().toISOString();
        const errors: string[] = [];
        let importedCount = 0;
        let skippedCount = 0;

        // Create import batch first to get batchId
        const batchData: Omit<ImportBatch, 'batchId'> = {
          accountId,
          fileName: file.name,
          status: 'processing',
          totalRows,
          importedCount: 0,
          skippedCount: 0,
          errors: [],
          importedAt: now,
        };

        const { id: batchId } = await repository.createImportBatch(batchData);

        // 5. Process each row
        for (let i = 0; i < dataLines.length; i++) {
          const line = dataLines[i];
          if (!line) {
            skippedCount++;
            continue;
          }

          const columns = line.split(delimiter);
          const rowNum = i + 2; // +2 because line 1 is header

          // Parse date
          const dateRaw = columns[columnMap.dateIdx] ?? '';
          const valueDate = parseCSVDate(dateRaw);
          if (!valueDate) {
            errors.push(`Row ${rowNum}: Invalid date "${dateRaw}"`);
            skippedCount++;
            continue;
          }

          // Parse description
          const description = (columns[columnMap.descIdx] ?? '').trim().replace(/"/g, '');
          if (!description) {
            errors.push(`Row ${rowNum}: Missing description`);
            skippedCount++;
            continue;
          }

          // Parse amount and direction
          let amount: number | null = null;
          let direction: TransactionDirection = 'credit';

          if (columnMap.debitIdx !== null && columnMap.creditIdx !== null) {
            // Separate debit/credit columns
            const debitVal = parseCSVAmount(columns[columnMap.debitIdx] ?? '');
            const creditVal = parseCSVAmount(columns[columnMap.creditIdx] ?? '');

            if (debitVal && debitVal > 0) {
              amount = debitVal;
              direction = 'debit';
            } else if (creditVal && creditVal > 0) {
              amount = creditVal;
              direction = 'credit';
            }
          } else if (columnMap.amountIdx !== null) {
            // Single amount column (negative = debit, positive = credit)
            const rawAmount = parseCSVAmount(columns[columnMap.amountIdx] ?? '');
            if (rawAmount !== null) {
              amount = Math.abs(rawAmount);
              direction = rawAmount < 0 ? 'debit' : 'credit';
            }
          }

          if (!amount || amount <= 0) {
            errors.push(`Row ${rowNum}: Invalid amount`);
            skippedCount++;
            continue;
          }

          // Parse optional fields
          const balanceAfter = columnMap.balanceIdx !== null
            ? parseCSVAmount(columns[columnMap.balanceIdx] ?? '')
            : null;

          const counterparty = columnMap.counterpartyIdx !== null
            ? (columns[columnMap.counterpartyIdx] ?? '').trim().replace(/"/g, '') || null
            : null;

          const paymentReference = columnMap.referenceIdx !== null
            ? (columns[columnMap.referenceIdx] ?? '').trim().replace(/"/g, '') || null
            : null;

          // 6. Create bank transaction
          const transactionData: Omit<BankTransaction, 'transactionId' | 'createdAt' | 'updatedAt'> = {
            accountId,
            valueDate,
            transactionDate: valueDate,
            direction,
            amount,
            currency: 'EUR',
            balanceAfter: balanceAfter ?? null,
            bankDescription: description,
            counterparty,
            paymentReference,
            matchStatus: 'unmatched',
            matchedEntityId: null,
            matchedEntityType: null,
            matchConfidence: null,
            importBatchId: batchId,
            notes: null,
          };

          try {
            await repository.createBankTransaction(transactionData);
            importedCount++;
          } catch (txError) {
            const txMsg = txError instanceof Error ? txError.message : 'Unknown error';
            errors.push(`Row ${rowNum}: ${txMsg}`);
            skippedCount++;
          }
        }

        // 7. Update batch with final counts
        const finalStatus = errors.length > 0 && importedCount === 0 ? 'failed' : 'completed';

        const completedBatch: ImportBatch = {
          batchId,
          accountId,
          fileName: file.name,
          status: finalStatus,
          totalRows,
          importedCount,
          skippedCount,
          errors: errors.slice(0, 50), // Cap error messages
          importedAt: now,
        };

        // Persist final batch status
        await repository.createImportBatch({
          ...completedBatch,
        });

        return NextResponse.json({ batch: completedBatch });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to import bank transactions';
        return NextResponse.json(
          { error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
