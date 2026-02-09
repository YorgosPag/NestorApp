/**
 * @fileoverview Eurobank CSV Parser Config
 * @see ADR-ACC-008 Bank Reconciliation
 */

import type { CSVParserConfig } from '../../../types/bank';

/**
 * Eurobank — CSV Export Format
 *
 * Encoding: UTF-8
 * Delimiter: Semicolon (;)
 * Date format: DD/MM/YYYY
 * Decimal: Comma (,)
 * Columns: Ημ/νία | Αιτιολογία | Ποσό | Υπόλοιπο
 */
export const EUROBANK_PARSER_CONFIG: CSVParserConfig = {
  bankCode: 'EUROBANK',
  bankName: 'Eurobank',
  encoding: 'utf-8',
  delimiter: ';',
  skipRows: 1,
  dateFormat: 'DD/MM/YYYY',
  decimalSeparator: ',',
  columnMapping: {
    valueDate: 0,
    transactionDate: null,
    description: 1,
    amount: 2,
    debitAmount: null,
    creditAmount: null,
    balance: 3,
    counterparty: null,
    reference: null,
  },
};
