/**
 * @module services/report-engine/builder-excel-number-format
 * @enterprise ADR-268 Phase 3 — Excel number-format SSoT
 *
 * Ο **ένας** χάρτης «τύπος πεδίου → μορφή κελιού ExcelJS».
 *
 * Ζούσε byte-ταυτόσημος σε `builder-excel-exporter.ts` **και** `builder-excel-analysis.ts`
 * (το δεύτερο είχε προκύψει ως SRP split του πρώτου, και πήρε μαζί του αντίγραφο). Το
 * CHECK 3.28 (jscpd, N.18) το χαρακτήρισε clone· κεντρικοποιήθηκε κατά τον N.0.2 (Boy
 * Scout) στο πέρασμα του ADR-739 §25.
 *
 * Γιατί έχει σημασία και δεν είναι καλλωπισμός: το φύλλο «Ανάλυση» δείχνει **αθροίσματα**
 * των στηλών του φύλλου «Δεδομένα». Αν οι δύο μορφές αποκλίνανε, το ίδιο νούμερο θα
 * εμφανιζόταν με άλλη μορφή στα δύο φύλλα του **ίδιου** βιβλίου — και ο αναγνώστης θα
 * υπέθετε ότι είναι άλλο μέγεθος.
 */

import type { FieldDefinition } from '@/config/report-builder/report-builder-types';

/**
 * Η μορφή κελιού ExcelJS για ένα πεδίο, ή `undefined` για ελεύθερο κείμενο.
 *
 * Το `field.format` νικά το `field.type` μόνο στο ότι ελέγχονται μαζί: το πρώτο είναι
 * ρητή επιλογή του συντάκτη της αναφοράς, το δεύτερο ο φυσικός τύπος του πεδίου.
 */
export function getExcelFormat(field: FieldDefinition): string | undefined {
  if (field.type === 'currency' || field.format === 'currency') return '€#,##0.00';
  if (field.type === 'percentage' || field.format === 'percentage') return '0.0"%"';
  if (field.type === 'number' || field.format === 'number') return '#,##0';
  if (field.type === 'date' || field.format === 'date') return 'DD/MM/YYYY';
  return undefined;
}
