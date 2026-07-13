/**
 * ADR-650 M7 — ο ΦΑΚΕΛΟΣ: οι ίδιοι πίνακες ως αρχεία υποβολής, σε ένα ZIP.
 *
 * Ο Έλληνας μηχανικός δεν παραδίδει «ένα DXF» — παραδίδει φάκελο (§10: ZIP = DXF + PDF). Εδώ
 * συναρμολογείται, ΧΩΡΙΣ καμία νέα εξάρτηση, από πράγματα που ήδη υπάρχουν:
 *   - CSV  → `scheduleToCsv` (RFC-4180 + UTF-8 BOM, ώστε το Excel να δείχνει σωστά τα ελληνικά)
 *   - PDF  → `tablesToPdfBlob` (jsPDF + ελληνική γραμματοσειρά — ένα έγγραφο, όλοι οι πίνακες)
 *   - XLSX → `tablesToXlsxBlob` (exceljs — ένα φύλλο ανά πίνακα)
 *   - DXF  → το υπάρχον export pipeline (ADR-648), περασμένο από τον καλούντα ως Blob
 *   - ZIP  → `createStoredZip` (δικός μας zero-dependency writer, ADR-505 §D)
 *
 * ⚠️ Η **ψηφιακή υπογραφή** του PDF (§10: eIDAS cert → portal ΤΕΕ) ΔΕΝ γίνεται εδώ και δεν
 * προσποιούμαστε ότι γίνεται: υπογράφει ο μηχανικός με το δικό του πιστοποιητικό, εκτός εφαρμογής.
 */

import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import type { ExportableTableSection } from '../../../bim/schedule/types';
import {
  scheduleToCsv,
  tablesToPdfBlob,
  tablesToXlsxBlob,
  type HeaderTranslator,
} from '../../../bim/schedule/exporters';
import { blobToUint8, createStoredZip, type ZipFile } from '../../../export/core/zip-pack';

/** Ό,τι δεν είναι έγκυρο σε όνομα αρχείου Windows/ZIP. Τα ελληνικά μένουν (UTF-8 flag στο ZIP). */
function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '_').trim();
}

export interface SurveyFolderInput {
  readonly sections: readonly ExportableTableSection[];
  readonly translateHeader: HeaderTranslator;
  /** Βάση ονόματος του ZIP και τίτλος του PDF (π.χ. το όνομα του έργου). */
  readonly projectName: string;
  /** Ήδη μεταφρασμένο υπότιτλο υποσέλιδου του PDF (π.χ. «Τοπογραφικό διάγραμμα»). */
  readonly documentLabel: string;
  /** Το σχέδιο ως DXF (ADR-648 pipeline). `null` ⇒ ο φάκελος βγαίνει χωρίς σχέδιο. */
  readonly drawing: Blob | null;
}

/** Τα αρχεία του φακέλου, με σταθερή σειρά/αρίθμηση ώστε ο φάκελος να διαβάζεται πάντα ίδια. */
async function buildFiles(input: SurveyFolderInput): Promise<ZipFile[]> {
  const { sections, translateHeader, projectName, documentLabel } = input;
  const encoder = new TextEncoder();
  const files: ZipFile[] = [];

  sections.forEach((section, i) => {
    const index = String(i + 1).padStart(2, '0');
    const csv = scheduleToCsv(
      section.table,
      { filename: section.title, title: section.title },
      translateHeader,
    );
    files.push({
      name: `${index}_${safeFileName(section.title)}.csv`,
      data: encoder.encode(csv),
    });
  });

  const pdf = await tablesToPdfBlob(
    sections,
    { filename: projectName, title: projectName, footerLabel: documentLabel },
    translateHeader,
  );
  files.push({ name: `${safeFileName(projectName)}.pdf`, data: await blobToUint8(pdf) });

  const xlsx = await tablesToXlsxBlob(sections, translateHeader);
  files.push({ name: `${safeFileName(projectName)}.xlsx`, data: await blobToUint8(xlsx) });

  if (input.drawing) {
    files.push({
      name: `${safeFileName(projectName)}.dxf`,
      data: await blobToUint8(input.drawing),
    });
  }

  return files;
}

/** Το ZIP ως Blob — καθαρό, testable, χωρίς DOM. */
export async function buildSurveyFolderZip(input: SurveyFolderInput): Promise<Blob> {
  return createStoredZip(await buildFiles(input));
}

/** Χτίζει τον φάκελο και τον κατεβάζει μέσω του download SSoT. Επιστρέφει το όνομα του αρχείου. */
export async function downloadSurveyFolder(input: SurveyFolderInput): Promise<string> {
  const blob = await buildSurveyFolderZip(input);
  const filename = `${safeFileName(input.projectName)}.zip`;
  triggerExportDownload({ blob, filename });
  return filename;
}
