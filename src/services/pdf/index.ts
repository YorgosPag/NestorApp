"use client";

import type { ObligationDocument } from "@/types/obligations";
import { PDFExportService } from "./PDFExportService";
import type { PDFExportOptions } from './contracts';

export { PDFExportService } from "./PDFExportService";
export { downloadPDF } from "./utils/download";

/**
 * Creates an instance of the PDFExportService and exports the document.
 * This is the primary entry point for generating a PDF from an obligation document.
 * @param document The obligation document to export.
 * @param options Optional configuration for the PDF export.
 * @returns A promise that resolves with the PDF data as a Uint8Array.
 */
export const exportObligationToPDF = async (
  document: ObligationDocument,
  options: PDFExportOptions = {}
): Promise<Uint8Array> => {
  const pdfService = new PDFExportService(options);
  return await pdfService.exportDocument(document);
};
