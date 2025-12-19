// -----------------------------------------------------------------------------
// Obligations Barrel - Configurations & Themes
// -----------------------------------------------------------------------------

import type { PDFExportOptions } from './pdf';

/** Default (εύχρηστα) options για PDF export */
export const DefaultPdfExportOptions: Required<Omit<PDFExportOptions, 'logoUrl' | 'watermark' | 'headerText' | 'footerText'>> = {
  includeTableOfContents: true,
  includePageNumbers: true,
  includeLogo: false,
  margins: { top: 25, right: 20, bottom: 25, left: 20 },
  quality: 'standard',
  fonts: {
    heading: 'helvetica-bold',
    body: 'helvetica',
    mono: 'courier',
  },
  colors: {
    primary: { r: 139, g: 0, b: 0 }, // Red
    secondary: { r: 0, g: 100, b: 0 }, // Green
    text: { r: 0, g: 0, b: 0 }, // Black
    gray: { r: 128, g: 128, b: 128 },
  },
};

// ========== Default UI Configurations ==========
export const DefaultObligationConfig = {
  editor: {
    minHeight: 200,
    maxHeight: 600,
    showStats: true,
    autoSave: true,
    autoSaveInterval: 30_000, // 30s
  },
  preview: {
    zoom: 100,
    showTableOfContents: true,
    enableScrollSync: true,
    viewMode: 'preview' as const,
  },
  structure: {
    enableDragDrop: true,
    autoNumbering: true,
    expandByDefault: false,
    maxDepth: 3, // Section -> Article -> Paragraph
  },
  validation: {
    validateOnChange: true,
    showInlineErrors: true,
    requiredFields: ['title', 'projectName', 'contractorCompany'],
    minWordCount: 100,
  },
  pdfExport: DefaultPdfExportOptions,
};

// ========== Themes ==========
export const ObligationThemes = {
  default: {
    colors: {
      primary: 'blue',
      section: 'blue',
      article: 'green',
      paragraph: 'gray',
    },
    fonts: {
      heading: 'font-bold',
      body: 'font-normal',
      mono: 'font-mono',
    },
    pdf: {
      headerColor: { r: 59, g: 130, b: 246 },
      sectionColor: { r: 59, g: 130, b: 246 },
    },
  },
  construction: {
    colors: {
      primary: 'orange',
      section: 'orange',
      article: 'yellow',
      paragraph: 'gray',
    },
    fonts: {
      heading: 'font-bold',
      body: 'font-normal',
      mono: 'font-mono',
    },
    pdf: {
      headerColor: { r: 249, g: 115, b: 22 },
      sectionColor: { r: 249, g: 115, b: 22 },
    },
  },
  legal: {
    colors: {
      primary: 'red',
      section: 'red',
      article: 'blue',
      paragraph: 'gray',
    },
    fonts: {
      heading: 'font-bold',
      body: 'font-normal',
      mono: 'font-mono',
    },
    pdf: {
      headerColor: { r: 139, g: 0, b: 0 },
      sectionColor: { r: 139, g: 0, b: 0 },
    },
  },
};
