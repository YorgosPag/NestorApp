/**
 * @fileoverview **Αρχείο τοπογραφικού → ένας από ΤΡΕΙΣ δρόμους** — πίνακας, DXF, ή άρνηση με όνομα (ADR-920 Β4.7).
 * @related ./survey-file-kind (τα bytes αποφασίζουν) · ./topo-delimited-reader · ./topo-excel-reader · ./dxf-survey-points ·
 *   ./topo-mapping-edit (η πρώτη πρόταση στηλών) · hooks/listings/useTerrainSurveyImport
 * @module lib/terrain/survey-import/survey-file-read
 *
 *   CSV / TXT / XYZ …  ─┐
 *                       ├→ RawTable + πρόταση στηλών   (ο άνθρωπος επιβεβαιώνει ρόλους και μονάδα)
 *   XLSX               ─┘
 *   DXF (κειμένου)     ──→ σημεία σε ΜΟΝΑΔΕΣ ΣΧΕΔΙΟΥ + `$INSUNITS` (χωρίς αντιστοίχιση: το αρχείο λέει τι είναι X/Y/Z)
 *   XLS · DXF binary · ό,τι άλλο ──→ άρνηση με όνομα (η οθόνη λέει ΤΙ να κάνει ο άνθρωπος: «αποθήκευσε ως .xlsx»)
 *
 * 🔑 **Ελληνικά αρχεία κειμένου**: το Excel σε ελληνικά Windows αποθηκεύει CSV σε **windows-1253**, όχι UTF-8. Διαβάζουμε
 * αυστηρό UTF-8 και, αν δεν είναι έγκυρο, windows-1253 — αλλιώς οι ελληνικές επικεφαλίδες («Χ», «Υψόμετρο») γίνονται
 * σκουπίδια και η αναγνώριση στηλών αποτυγχάνει σιωπηλά. Το BOM του UTF-8 αφαιρείται από τον αποκωδικοποιητή.
 *
 * Καθαρό: δέχεται bytes, όχι `File` — ελέγχεται χωρίς browser.
 */

import { readDelimitedText } from './topo-delimited-reader';
import { readExcelToTable } from './topo-excel-reader';
import { scanDxfSurvey, type DxfSurveyScan } from './dxf-survey-points';
import { surveyFileKindOf, SURVEY_FILE_SNIFF_BYTES } from './survey-file-kind';
import { proposeColumnMapping } from './topo-mapping-edit';
import type { ColumnMapping, RawTable } from './topo-import-types';

/** Γιατί το αρχείο δεν διαβάστηκε — ένα όνομα ανά πράξη που οφείλει να προτείνει η οθόνη. */
export type SurveyFileRefusal = 'xls-legacy' | 'dxf-binary' | 'unsupported' | 'unreadable' | 'empty';

export type SurveyFileRead =
  | { readonly road: 'table'; readonly table: RawTable; readonly proposedMapping: ColumnMapping }
  | { readonly road: 'dxf'; readonly scan: DxfSurveyScan }
  | { readonly road: 'refused'; readonly refusal: SurveyFileRefusal };

/** Η κωδικοποίηση της ελληνικής εκδοχής των Windows — ό,τι γράφει το Excel στο «CSV (οριοθετημένο με ;)». */
const GREEK_WINDOWS_ENCODING = 'windows-1253';

/** Αυστηρό UTF-8 πρώτα (το BOM αφαιρείται), windows-1253 όταν τα bytes δεν είναι έγκυρο UTF-8. */
export function decodeSurveyText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder(GREEK_WINDOWS_ENCODING).decode(bytes);
  }
}

function tableRoad(table: RawTable): SurveyFileRead {
  if (table.rows.length === 0) return { road: 'refused', refusal: 'empty' };
  return { road: 'table', table, proposedMapping: proposeColumnMapping(table) };
}

function dxfRoad(bytes: Uint8Array): SurveyFileRead {
  const scan = scanDxfSurvey(decodeSurveyText(bytes));
  return scan.points.length === 0 ? { road: 'refused', refusal: 'empty' } : { road: 'dxf', scan };
}

/** Το ίδιο αντίγραφο των bytes για το `exceljs`, που θέλει `ArrayBuffer` και όχι όψη. */
function arrayBufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * **Διάβασε το αρχείο του ανθρώπου.** Ποτέ δεν πετά: ένα αρχείο που δεν διαβάζεται είναι έκβαση με όνομα
 * (`unreadable`), όχι εξαίρεση που η οθόνη θα έδειχνε ως «κάτι πήγε στραβά».
 */
export async function readSurveyFile(fileName: string, bytes: Uint8Array): Promise<SurveyFileRead> {
  const kind = surveyFileKindOf(fileName, bytes.subarray(0, SURVEY_FILE_SNIFF_BYTES));
  try {
    switch (kind) {
      case 'delimited':
        return tableRoad(readDelimitedText(decodeSurveyText(bytes)));
      case 'xlsx':
        return tableRoad(await readExcelToTable(arrayBufferOf(bytes)));
      case 'dxf':
        return dxfRoad(bytes);
      default:
        return { road: 'refused', refusal: kind };
    }
  } catch {
    return { road: 'refused', refusal: 'unreadable' };
  }
}
