/**
 * @fileoverview Alpha Bank CSV Parser Config
 * @see ADR-ACC-008 Bank Reconciliation
 */

import type { CSVParserConfig } from '../../../types/bank';

/**
 * Alpha Bank — CSV Export Format
 *
 * Encoding: UTF-8
 * Delimiter: Semicolon (;)
 * Date format: DD/MM/YYYY
 * Decimal: Comma (,)
 * Columns: Ημ/νία | Αιτιολογία | Χρέωση | Πίστωση | Υπόλοιπο | Αντ/νος | Αναφορά
 */
export const ALPHA_PARSER_CONFIG: CSVParserConfig = {
  bankCode: 'ALPHA',
  bankName: 'Alpha Bank',
  encoding: 'utf-8',
  delimiter: ';',
  skipRows: 1,
  dateFormat: 'DD/MM/YYYY',
  decimalSeparator: ',',
  columnMapping: {
    valueDate: 0,
    transactionDate: null,
    description: 1,
    amount: null,
    debitAmount: 2,
    creditAmount: 3,
    balance: 4,
    counterparty: 5,
    reference: 6,
  },
};
