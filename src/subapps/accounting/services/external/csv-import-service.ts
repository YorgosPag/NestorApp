/**
 * @fileoverview CSV Import Service — Bank Statement CSV Parsing & Import
 * @description Single Source of Truth for CSV parsing (bank-specific + auto-detect)
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 2.0.0
 * @see DECISIONS-PHASE-2.md Q4 — Wire up CSVImportService (SSoT)
 * @see ADR-ACC-008 Bank Reconciliation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { ICSVImportService, IAccountingRepository } from '../../types/interfaces';
import type {
  BankTransaction,
  CSVParserConfig,
  ImportBatch,
  TransactionDirection,
} from '../../types/bank';
import { getSupportedBanks, getParserConfig } from '../config/csv-parsers';
import { isoNow } from '../repository/firestore-helpers';

// ============================================================================
// PARSED TRANSACTION TYPE (fields NOT set by CSV parser)
// ============================================================================

type ParsedTransaction = Omit<
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
>;

// ============================================================================
// CSV IMPORT SERVICE
// ============================================================================

export class CSVImportService implements ICSVImportService {
  constructor(private readonly repository: IAccountingRepository) {}

  getSupportedBanks(): CSVParserConfig[] {
    return getSupportedBanks();
  }

  /**
   * Parse CSV — supports bank-specific configs OR auto-detect mode
   *
   * @param fileContent - CSV text content
   * @param bankCode - Bank code (e.g. 'NBG') or 'auto' for auto-detection
   */
  async parseCSV(
    fileContent: string,
    bankCode: string
  ): Promise<ParsedTransaction[]> {
    if (bankCode === 'auto') {
      return this.autoDetectParse(fileContent);
    }
    return this.bankSpecificParse(fileContent, bankCode);
  }

  /**
   * Import parsed transactions into Firestore
   */
  async importTransactions(
    transactions: Array<Omit<BankTransaction, 'transactionId' | 'createdAt' | 'updatedAt'>>,
    accountId: string
  ): Promise<ImportBatch> {
    const now = isoNow();
    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

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

    return {
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
  }

  // ── Bank-Specific Parsing ────────────────────────────────────────────────

  private bankSpecificParse(fileContent: string, bankCode: string): ParsedTransaction[] {
    const config = getParserConfig(bankCode);
    if (!config) {
      throw new Error(`[CSVImportService] Unsupported bank code: ${bankCode}`);
    }

    const lines = fileContent.split('\n').filter((line) => line.trim().length > 0);
    const dataLines = lines.slice(config.skipRows);
    const transactions: ParsedTransaction[] = [];

    for (const line of dataLines) {
      const columns = splitCSVLine(line, config.delimiter);
      if (columns.length < 3) continue;
      const parsed = parseBankRow(columns, config);
      if (parsed) transactions.push(parsed);
    }

    return transactions;
  }

  // ── Auto-Detect Parsing (Greek bank CSV) ─────────────────────────────────

  private autoDetectParse(fileContent: string): ParsedTransaction[] {
    const lines = fileContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) return [];

    const headerLine = lines[0]!;
    const delimiter = detectDelimiter(headerLine);
    const headers = headerLine.split(delimiter);
    const columnMap = detectColumnMapping(headers);
    const dataLines = lines.slice(1);
    const transactions: ParsedTransaction[] = [];

    for (const line of dataLines) {
      const columns = line.split(delimiter);
      const parsed = parseAutoDetectedRow(columns, columnMap);
      if (parsed) transactions.push(parsed);
    }

    return transactions;
  }
}

// ============================================================================
// BANK-SPECIFIC PARSING HELPERS
// ============================================================================

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

function parseBankRow(
  columns: string[],
  config: CSVParserConfig
): ParsedTransaction | null {
  try {
    const mapping = config.columnMapping;
    const valueDateRaw = columns[mapping.valueDate];
    if (!valueDateRaw) return null;
    const valueDate = parseBankDate(valueDateRaw, config.dateFormat);

    const transactionDate =
      mapping.transactionDate !== null && columns[mapping.transactionDate]
        ? parseBankDate(columns[mapping.transactionDate], config.dateFormat)
        : valueDate;

    let amount: number;
    let direction: TransactionDirection;

    if (mapping.amount !== null && columns[mapping.amount]) {
      const rawAmount = parseBankDecimal(columns[mapping.amount], config.decimalSeparator);
      amount = Math.abs(rawAmount);
      direction = rawAmount >= 0 ? 'credit' : 'debit';
    } else {
      const debit = mapping.debitAmount !== null && columns[mapping.debitAmount]
        ? parseBankDecimal(columns[mapping.debitAmount], config.decimalSeparator) : 0;
      const credit = mapping.creditAmount !== null && columns[mapping.creditAmount]
        ? parseBankDecimal(columns[mapping.creditAmount], config.decimalSeparator) : 0;

      if (credit > 0) {
        amount = credit;
        direction = 'credit';
      } else {
        amount = Math.abs(debit);
        direction = 'debit';
      }
    }

    if (amount === 0) return null;

    return {
      accountId: '',
      valueDate,
      transactionDate,
      direction,
      amount,
      currency: 'EUR',
      balanceAfter: mapping.balance !== null && columns[mapping.balance]
        ? parseBankDecimal(columns[mapping.balance], config.decimalSeparator) : null,
      bankDescription: columns[mapping.description] ?? '',
      counterparty: mapping.counterparty !== null && columns[mapping.counterparty]
        ? columns[mapping.counterparty] || null : null,
      paymentReference: mapping.reference !== null && columns[mapping.reference]
        ? columns[mapping.reference] || null : null,
    };
  } catch {
    return null;
  }
}

function parseBankDate(dateStr: string, format: string): string {
  const cleaned = dateStr.trim();
  if (format === 'DD/MM/YYYY') {
    const parts = cleaned.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]?.padStart(2, '0')}-${parts[0]?.padStart(2, '0')}`;
    }
  }
  if (format === 'YYYY-MM-DD') return cleaned;
  return cleaned;
}

function parseBankDecimal(value: string, decimalSeparator: string): number {
  const cleaned = value.trim().replace(/[^\d,.-]/g, '');
  let normalized: string;
  if (decimalSeparator === ',') {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = cleaned.replace(/,/g, '');
  }
  const result = parseFloat(normalized);
  return isNaN(result) ? 0 : result;
}

// ============================================================================
// AUTO-DETECT PARSING HELPERS
// ============================================================================

interface AutoColumnMap {
  dateIdx: number;
  descIdx: number;
  debitIdx: number | null;
  creditIdx: number | null;
  amountIdx: number | null;
  balanceIdx: number | null;
  counterpartyIdx: number | null;
  referenceIdx: number | null;
}

function detectDelimiter(headerLine: string): string {
  const semicolonCount = (headerLine.match(/;/g) ?? []).length;
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const tabCount = (headerLine.match(/\t/g) ?? []).length;

  if (tabCount > semicolonCount && tabCount > commaCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

function detectColumnMapping(headers: string[]): AutoColumnMap {
  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/"/g, ''));

  const datePatterns = ['ημερομηνία', 'date', 'ημ/νία', 'value date', 'valuedate', 'ημ.αξίας'];
  const descPatterns = ['περιγραφή', 'description', 'αιτιολογία', 'details', 'narrative'];
  const debitPatterns = ['χρέωση', 'debit', 'withdrawal', 'χρεωση'];
  const creditPatterns = ['πίστωση', 'credit', 'deposit', 'πιστωση'];
  const amountPatterns = ['ποσό', 'amount', 'ποσο'];
  const balancePatterns = ['υπόλοιπο', 'balance', 'υπολοιπο'];
  const counterpartyPatterns = ['δικαιούχος', 'counterparty', 'beneficiary', 'αντισυμβαλλόμενος'];
  const refPatterns = ['αριθμός', 'reference', 'ref', 'αριθμος συναλλαγής'];

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

function parseAutoDetectedRow(
  columns: string[],
  columnMap: AutoColumnMap
): ParsedTransaction | null {
  const dateRaw = columns[columnMap.dateIdx] ?? '';
  const valueDate = parseAutoDate(dateRaw);
  if (!valueDate) return null;

  const description = (columns[columnMap.descIdx] ?? '').trim().replace(/"/g, '');
  if (!description) return null;

  let amount: number | null = null;
  let direction: TransactionDirection = 'credit';

  if (columnMap.debitIdx !== null && columnMap.creditIdx !== null) {
    const debitVal = parseAutoAmount(columns[columnMap.debitIdx] ?? '');
    const creditVal = parseAutoAmount(columns[columnMap.creditIdx] ?? '');

    if (debitVal && debitVal > 0) {
      amount = debitVal;
      direction = 'debit';
    } else if (creditVal && creditVal > 0) {
      amount = creditVal;
      direction = 'credit';
    }
  } else if (columnMap.amountIdx !== null) {
    const rawAmount = parseAutoAmount(columns[columnMap.amountIdx] ?? '');
    if (rawAmount !== null) {
      amount = Math.abs(rawAmount);
      direction = rawAmount < 0 ? 'debit' : 'credit';
    }
  }

  if (!amount || amount <= 0) return null;

  return {
    accountId: '',
    valueDate,
    transactionDate: valueDate,
    direction,
    amount,
    currency: 'EUR',
    balanceAfter: columnMap.balanceIdx !== null
      ? parseAutoAmount(columns[columnMap.balanceIdx] ?? '') : null,
    bankDescription: description,
    counterparty: columnMap.counterpartyIdx !== null
      ? (columns[columnMap.counterpartyIdx] ?? '').trim().replace(/"/g, '') || null : null,
    paymentReference: columnMap.referenceIdx !== null
      ? (columns[columnMap.referenceIdx] ?? '').trim().replace(/"/g, '') || null : null,
  };
}

function parseAutoDate(raw: string): string | null {
  const trimmed = raw.trim().replace(/"/g, '');
  if (!trimmed) return null;

  const dmyMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}`;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;

  return null;
}

function parseAutoAmount(raw: string): number | null {
  const trimmed = raw.trim().replace(/"/g, '').replace(/\s/g, '');
  if (!trimmed || trimmed === '-') return null;

  if (trimmed.includes(',') && trimmed.indexOf(',') > trimmed.lastIndexOf('.')) {
    const normalized = trimmed.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return Number.isNaN(num) ? null : num;
  }

  const normalized = trimmed.replace(/,/g, '');
  const num = parseFloat(normalized);
  return Number.isNaN(num) ? null : num;
}
