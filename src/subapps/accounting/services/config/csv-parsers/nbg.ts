/**
 * @fileoverview NBG (Εθνική Τράπεζα) CSV Parser Config
 * @see ADR-ACC-008 Bank Reconciliation
 */

import type { CSVParserConfig } from '../../../types/bank';

/**
 * Εθνική Τράπεζα της Ελλάδος — CSV Export Format
 *
 * Encoding: Windows-1253 (Greek)
 * Delimiter: Tab (\t)
 * Date format: DD/MM/YYYY
 * Decimal: Comma (,)
 * Columns: Ημ/νία Αξίας | Ημ/νία Κίνησης | Αιτιολογία | Χρέωση | Πίστωση | Υπόλοιπο
 */
export const NBG_PARSER_CONFIG: CSVParserConfig = {
  bankCode: 'NBG',
  bankName: 'Εθνική Τράπεζα',
  encoding: 'windows-1253',
  delimiter: '\t',
  skipRows: 1,
  dateFormat: 'DD/MM/YYYY',
  decimalSeparator: ',',
  columnMapping: {
    valueDate: 0,
    transactionDate: 1,
    description: 2,
    amount: null,
    debitAmount: 3,
    creditAmount: 4,
    balance: 5,
    counterparty: null,
    reference: null,
  },
};
