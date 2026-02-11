// -----------------------------------------------------------------------------
// Obligations Barrel - PDF Export Helpers & Utilities
// -----------------------------------------------------------------------------
import type { ObligationDocument as _Doc } from '@/types/obligations';
import { exportObligationToPDF as _exportToPDF, downloadPDF as _downloadPDF } from '@/services/pdf-export.service';
import { generateFileName as _genName, getContentSummary as _getSummary, validateObligation as _validate } from '@/lib/obligations-utils';
import { DefaultObligationConfig } from './config';

/** Επιλογές εξαγωγής PDF */
export interface PDFExportOptions {
  includeTableOfContents?: boolean;
  includePageNumbers?: boolean;
  includeLogo?: boolean;
  logoUrl?: string;
  watermark?: string;
  headerText?: string;
  footerText?: string;
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  quality?: 'standard' | 'high';
  fonts?: {
    heading?: string;
    body?: string;
    mono?: string;
  };
  colors?: {
    primary?: { r: number; g: number; b: number };
    secondary?: { r: number; g: number; b: number };
    text?: { r: number; g: number; b: number };
    gray?: { r: number; g: number; b: number };
  };
}

/** Συγχώνευση custom επιλογών με τα defaults με ασφαλή τρόπο */
export const mergePdfOptions = (options?: PDFExportOptions): PDFExportOptions => {
  return {
    ...DefaultObligationConfig.pdfExport,
    ...options,
    margins: { ...DefaultObligationConfig.pdfExport.margins, ...(options?.margins ?? {}) },
    fonts: { ...DefaultObligationConfig.pdfExport.fonts, ...(options?.fonts ?? {}) },
    colors: { ...DefaultObligationConfig.pdfExport.colors, ...(options?.colors ?? {}) },
  };
};

/** Επιστρέφει ασφαλές Object URL για blob και το καθαρίζει μετά από λίγο */
const openBlobInNewTab = (blob: Blob, revokeAfterMs = 1000) => {
  const url = URL.createObjectURL(blob);
  window.open(url);
  setTimeout(() => URL.revokeObjectURL(url), revokeAfterMs);
};

export const PDFHelpers = {
  /** Γρήγορη εξαγωγή PDF με τα default options */
  quickExport: async (document: _Doc) => {
    const pdfData = await _exportToPDF(document, mergePdfOptions());
    const filename = _genName(document.title || 'obligation', 'pdf');
    _downloadPDF(pdfData, filename);
  },

  /** Εξαγωγή PDF με custom options (γίνεται merge με defaults) */
  customExport: async (document: _Doc, options: PDFExportOptions) => {
    const pdfData = await _exportToPDF(document, mergePdfOptions(options));
    const filename = _genName(document.title || 'obligation', 'pdf');
    _downloadPDF(pdfData, filename);
  },

  /** Προεπισκόπηση PDF σε νέο tab */
  preview: async (document: _Doc, options?: PDFExportOptions) => {
    const pdfData = await _exportToPDF(document, mergePdfOptions(options));
    openBlobInNewTab(new Blob([pdfData as BlobPart], { type: 'application/pdf' }));
  },

  /** Άμεση εκτύπωση PDF */
  print: async (document: _Doc, options?: PDFExportOptions) => {
    const pdfData = await _exportToPDF(document, mergePdfOptions(options));
    const url = URL.createObjectURL(new Blob([pdfData as BlobPart], { type: 'application/pdf' }));
    const printWindow = window.open(url);
    if (printWindow) {
      printWindow.addEventListener('load', () => printWindow.print());
    }
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export const PDFValidationHelpers = {
  /** Ελέγχει αν το έγγραφο περνάει το validation των υποχρεωτικών πεδίων/δομής */
  isReadyForExport: (document: _Doc): boolean => {
    const validation = _validate(document);
    return validation.isValid;
  },

  /** Αναφορά ετοιμότητας για εξαγωγή PDF (errors, warnings, summary) */
  getExportReadiness: (document: _Doc) => {
    const validation = _validate(document);
    const warnings: string[] = [...validation.warnings];

    if (document.sections.length === 0) {
      warnings.push('Το έγγραφο δεν έχει ενότητες');
    }
    if (!document.projectDetails?.location) {
      warnings.push('Δεν έχει οριστεί τοποθεσία έργου');
    }

    const summary = _getSummary(document);
    const minCount = DefaultObligationConfig.validation.minWordCount ?? 100;
    if (summary.totalWords < minCount) {
      warnings.push(`Το έγγραφο είναι σύντομο (< ${minCount} λέξεις)`);
    }

    return { isReady: validation.isValid, errors: validation.errors, warnings, summary };
  },
};
