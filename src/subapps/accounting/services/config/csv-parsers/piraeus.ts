/**
 * @fileoverview Piraeus Bank CSV Parser Config
 * @see ADR-ACC-008 Bank Reconciliation
 */

import type { CSVParserConfig } from '../../../types/bank';

/**
 * Τράπεζα Πειραιώς — CSV Export Format
 *
 * Encoding: Windows-1253 (Greek)
 * Delimiter: Comma (,)
 * Date format: DD/MM/YYYY
 * Decimal: Period (.)
 * Columns: Ημ/νία Αξίας | Ημ/νία Εκτ. | Περιγραφή | Χρέωση | Πίστωση | Υπόλοιπο | Αντισ/νος
 */
export const PIRAEUS_PARSER_CONFIG: CSVParserConfig = {
  bankCode: 'PIRAEUS',
  bankName: 'Τράπεζα Πειραιώς',
  encoding: 'windows-1253',
  delimiter: ',',
  skipRows: 1,
  dateFormat: 'DD/MM/YYYY',
  decimalSeparator: '.',
  columnMapping: {
    valueDate: 0,
    transactionDate: 1,
    description: 2,
    amount: null,
    debitAmount: 3,
    creditAmount: 4,
    balance: 5,
    counterparty: 6,
    reference: null,
  },
};
