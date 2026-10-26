/**
 * ADR-920 Β4.7 / Β4.9 — ένα ΠΡΑΓΜΑΤΙΚΟ τοπογραφικό για τα tests του hook εισαγωγής και του πάνελ που τον φιλοξενεί:
 * ελληνικό CSV (`;`, δεκαδικό κόμμα, ελληνικές επικεφαλίδες), σε μεγέθη ΕΓΣΑ'87 — ώστε η μονάδα να προτείνεται από το
 * πλέγμα, όχι από μαντεψιά. Κοινό αρχείο, όχι δύο αντίγραφα (CHECK 3.28).
 */

import type { SurveyFileInput } from '../useTerrainSurveyImport';

export const SURVEY_CSV_HEADER = 'ΑΑ;Χ;Ψ;Υψόμετρο';

export const SURVEY_CSV_ROWS = [
  '1;450000,000;4200000,000;100,000',
  '2;450030,000;4200000,000;101,000',
  '3;450030,000;4200020,000;102,500',
  '4;450000,000;4200020,000;101,500',
  '5;450015,000;4200010,000;101,200',
] as const;

export const SURVEY_CSV = [SURVEY_CSV_HEADER, ...SURVEY_CSV_ROWS].join('\n');

/** Αρχείο του browser χωρίς πραγματικό `File` (το jsdom δεν έχει `arrayBuffer`)· `gate` καθυστερεί την ανάγνωση. */
export function surveyFileOf(name: string, content: string | Uint8Array, gate?: Promise<void>): SurveyFileInput {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  return {
    name,
    arrayBuffer: async () => {
      await gate;
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    },
  };
}
