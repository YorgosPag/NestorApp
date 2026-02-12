import type { ObligationDocument, TableOfContentsItem } from '@/types/obligations';

export interface PDFExportOptions {
  includeTableOfContents?: boolean;
  includePageNumbers?: boolean;
  includeLogo?: boolean;
  logoUrl?: string;
  watermark?: string;
  headerText?: string;
  footerText?: string;
  margins?: { top: number; right: number; bottom: number; left: number };
}

export interface PDFSection {
  id: string;
  title: string;
  content: string;
  level: number;
  pageNumber?: number;
}

export interface IPDFDoc {
  getNumberOfPages(): number;
  setPage(n: number): void;
  addPage(): void;
  setFillColor(r: number, g: number, b: number): void;
  setDrawColor(r: number, g: number, b: number): void;
  setLineWidth(w: number): void;
  rect(x: number, y: number, w: number, h: number, style?: 'F' | 'S' | 'DF'): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  setTextColor(r: number, g: number, b: number): void;
  setFont(font: string, style: 'normal' | 'bold'): void;
  setFontSize(size: number): void;
  text(text: string, x: number, y: number, opts?: { align?: 'left' | 'center' | 'right' }): void;
  splitTextToSize(text: string, width: number): string[];
  getTextWidth(text: string): number;
  output(type: 'arraybuffer'): ArrayBuffer;
  readonly pageSize: { width: number; height: number };
}

export interface IPDFLoader {
  initialize(): Promise<IPDFDoc>;
}

export type Margins = { top: number; right: number; bottom: number; left: number };

export interface ITextRenderer {
  addText(args: { doc: IPDFDoc; text: string; y: number; align?: 'left' | 'center' | 'right'; fontSize?: number; bold?: boolean; color?: [number, number, number]; margins: Margins; pageWidth: number }): number;
  addWrappedText(args: { doc: IPDFDoc; text: string; y: number; fontSize?: number; bold?: boolean; maxWidth: number; margins: Margins; onPageBreak: () => number; lineStep?: number }): number;
}

export interface IHeaderFooterRenderer {
  addHeader(doc: IPDFDoc, margins: Margins, contentWidth: number, pageWidth: number, document: ObligationDocument, options?: PDFExportOptions): void;
  addFooter(doc: IPDFDoc, margins: Margins, contentWidth: number, pageWidth: number, pageNum: number, totalPages: number, document: ObligationDocument, options?: PDFExportOptions): void;
}

export interface ICoverRenderer {
  render(doc: IPDFDoc, yStart: number, margins: Margins, contentWidth: number, pageWidth: number, pageHeight: number, document: ObligationDocument, formatDate: (d: Date) => string): number;
}

export interface ITOCRenderer {
  render(doc: IPDFDoc, yStart: number, margins: Margins, contentWidth: number, pageWidth: number, toc: TableOfContentsItem[], addNewPage: () => void): void;
}

export interface IContentRenderer {
  render(doc: IPDFDoc, yStart: number, margins: Margins, contentWidth: number, pageWidth: number, pageHeight: number, document: ObligationDocument, helpers: {
    addNewPage: () => number;
  }): number;
}
