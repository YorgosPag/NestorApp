"use client";

import { triggerExportDownload } from '@/lib/exports/trigger-export-download';

/**
 * Triggers a browser download for the given PDF data.
 * Thin wrapper around the canonical triggerExportDownload helper.
 *
 * @param pdfData The PDF content as a Uint8Array.
 * @param filename The desired filename for the downloaded file.
 */
export const downloadPDF = (pdfData: Uint8Array, filename: string) => {
  const blob = new Blob([pdfData], { type: 'application/pdf' });
  triggerExportDownload({ blob, filename });
};
