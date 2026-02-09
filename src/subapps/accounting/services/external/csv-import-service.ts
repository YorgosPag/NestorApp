/**
 * @fileoverview CSV Import Service — Bank Statement CSV Parsing & Import
 * @description Parsing + batch import of bank transactions via per-bank CSV configs
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-008 Bank Reconciliation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { ICSVImportService, IAccountingRepository } from '../../types/interfaces';
import type {
  BankTransaction,
  CSVParserConfig,
  ImportBatch,
} from '../../types/bank';
import { getSupportedBanks, getParserConfig } from '../config/csv-parsers';
import { isoNow } from '../repository/firestore-helpers';

// ============================================================================
// CSV IMPORT SERVICE IMPLEMENTATION
// ============================================================================

/**
 * CSV Import Service — Εισαγωγή τραπεζικών CSV
 *
 * Implements ICSVImportService interface.
 * Strategy pattern: each bank has its own parser config.
 */
export class CSVImportService implements ICSVImportService {
  constructor(private readonly repository: IAccountingRepository) {}

  /**
   * Λήψη υποστηριζόμενων τραπεζών
   */
  getSupportedBanks(): CSVParserConfig[] {
    return getSupportedBanks();
  }

  /**
   * Parsing CSV αρχείου σε τραπεζικές κινήσεις
   *
   * @param fileContent - Περιεχόμενο CSV (string, ήδη decoded)
   * @param bankCode - Κωδικός τράπεζας (π.χ. 'NBG')
   * @returns Parsed transactions (χωρίς IDs — θα προστεθούν κατά import)
   */
  async parseCSV(
    fileContent: string,
    bankCode: string
  ): Promise<
    Array<
      Omit<
        BankTransaction,
        | 'transactionId'
        | 'matchStatus'
        | 'matchedEntityId'
        | 'matchedEntityType'
        | 'matchConfidence'
        | 'importBatchId'
        | 'notes'
        | 'createdAt'
        | 'updatedAt'
      >
    >
  > {
    const config = getParserConfig(bankCode);
    if (!config) {
      throw new Error(`[CSVImportService] Unsupported bank code: ${bankCode}`);
    }

    const lines = fileContent.split('\n').filter((line) => line.trim().length > 0);

    // Skip header rows
    const dataLines = lines.slice(config.skipRows);

    const transactions: Array<
      Omit<
        BankTransaction,
        | 'transactionId'
        | 'matchStatus'
        | 'matchedEntityId'
        | 'matchedEntityType'
        | 'matchConfidence'
        | 'importBatchId'
        | 'notes'
        | 'createdAt'
        | 'updatedAt'
      >
    > = [];

    for (const line of dataLines) {
      const columns = splitCSVLine(line, config.delimiter);
      if (columns.length < 3) continue; // Skip malformed rows

      const parsed = parseSingleRow(columns, config);
      if (parsed) {
        transactions.push(parsed);
      }
    }

    return transactions;
  }

  /**
   * Εισαγωγή parsed κινήσεων στη βάση
   *
   * @param transactions - Parsed κινήσεις
   * @param accountId - ID τραπεζικού λογαριασμού
   * @returns ImportBatch metadata
   */
  async importTransactions(
    transactions: Array<Omit<BankTransaction, 'transactionId' | 'createdAt' | 'updatedAt'>>,
    accountId: string
  ): Promise<ImportBatch> {
    const now = isoNow();
    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Create batch record first
    const { id: batchId } = await this.repository.createImportBatch({
      accountId,
      fileName: `import_${now}`,
      status: 'processing',
      totalRows: transactions.length,
      importedCount: 0,
      skippedCount: 0,
      errors: [],
      importedAt: now,
    });

    // Import each transaction
    for (let i = 0; i < transactions.length; i++) {
      try {
        const txn = transactions[i];
        if (!txn) continue;

        await this.repository.createBankTransaction({
          ...txn,
          accountId,
          importBatchId: batchId,
          matchStatus: 'unmatched',
          matchedEntityId: null,
          matchedEntityType: null,
          matchConfidence: null,
          notes: null,
        });
        importedCount++;
      } catch (err) {
        skippedCount++;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Row ${i + 1}: ${errorMessage}`);
      }
    }

    const batch: ImportBatch = {
      batchId,
      accountId,
      fileName: `import_${now}`,
      status: errors.length === transactions.length ? 'failed' : 'completed',
      totalRows: transactions.length,
      importedCount,
      skippedCount,
      errors,
      importedAt: now,
    };

    return batch;
  }
}

// ============================================================================
// PARSING HELPERS
// ============================================================================

/**
 * Split CSV line respecting quoted fields
 */
function splitCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

/**
 * Parse a single CSV row into a partial BankTransaction
 */
function parseSingleRow(
  columns: string[],
  config: CSVParserConfig
): Omit<
  BankTransaction,
  | 'transactionId'
  | 'matchStatus'
  | 'matchedEntityId'
  | 'matchedEntityType'
  | 'matchConfidence'
  | 'importBatchId'
  | 'notes'
  | 'createdAt'
  | 'updatedAt'
> | null {
  try {
    const mapping = config.columnMapping;

    // Parse dates
    const valueDateRaw = columns[mapping.valueDate];
    if (!valueDateRaw) return null;
    const valueDate = parseDate(valueDateRaw, config.dateFormat);

    const transactionDate =
      mapping.transactionDate !== null && columns[mapping.transactionDate]
        ? parseDate(columns[mapping.transactionDate], config.dateFormat)
        : valueDate;

    // Parse amount
    let amount: number;
    let direction: 'credit' | 'debit';

    if (mapping.amount !== null && columns[mapping.amount]) {
      const rawAmount = parseDecimal(columns[mapping.amount], config.decimalSeparator);
      amount = Math.abs(rawAmount);
      direction = rawAmount >= 0 ? 'credit' : 'debit';
    } else {
      const debit =
        mapping.debitAmount !== null && columns[mapping.debitAmount]
          ? parseDecimal(columns[mapping.debitAmount], config.decimalSeparator)
          : 0;
      const credit =
        mapping.creditAmount !== null && columns[mapping.creditAmount]
          ? parseDecimal(columns[mapping.creditAmount], config.decimalSeparator)
          : 0;

      if (credit > 0) {
        amount = credit;
        direction = 'credit';
      } else {
        amount = Math.abs(debit);
        direction = 'debit';
      }
    }

    if (amount === 0) return null;

    // Parse other fields
    const description = columns[mapping.description] ?? '';
    const balance =
      mapping.balance !== null && columns[mapping.balance]
        ? parseDecimal(columns[mapping.balance], config.decimalSeparator)
        : null;
    const counterparty =
      mapping.counterparty !== null && columns[mapping.counterparty]
        ? columns[mapping.counterparty] || null
        : null;
    const paymentReference =
      mapping.reference !== null && columns[mapping.reference]
        ? columns[mapping.reference] || null
        : null;

    return {
      accountId: '', // Set by caller
      valueDate,
      transactionDate,
      direction,
      amount,
      currency: 'EUR',
      balanceAfter: balance,
      bankDescription: description,
      counterparty,
      paymentReference,
    };
  } catch {
    return null;
  }
}

/**
 * Parse date string to ISO 8601 (YYYY-MM-DD)
 */
function parseDate(dateStr: string, format: string): string {
  const cleaned = dateStr.trim();

  if (format === 'DD/MM/YYYY') {
    const parts = cleaned.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]?.padStart(2, '0')}-${parts[0]?.padStart(2, '0')}`;
    }
  }

  if (format === 'YYYY-MM-DD') {
    return cleaned;
  }

  // Fallback: try to parse as-is
  return cleaned;
}

/**
 * Parse decimal number with configurable separator
 */
function parseDecimal(value: string, decimalSeparator: string): number {
  const cleaned = value
    .trim()
    .replace(/[^\d,.\-]/g, '');

  let normalized: string;
  if (decimalSeparator === ',') {
    // Remove thousand separators (.) and replace decimal (,) with (.)
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Remove thousand separators (,)
    normalized = cleaned.replace(/,/g, '');
  }

  const result = parseFloat(normalized);
  return isNaN(result) ? 0 : result;
}
