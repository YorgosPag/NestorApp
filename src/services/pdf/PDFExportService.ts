"use client";

import type { ObligationDocument } from '@/types/obligations';
import { generateTableOfContents } from '@/types/obligations';
import { formatDate } from '@/lib/intl-utils';
import type { PDFExportOptions, IPDFDoc, Margins } from './contracts';
import { JSPDFLoader } from './loader/JSPDFLoader';
import { CoverRenderer } from './renderers/CoverRenderer';
import { TOCRenderer } from './renderers/TOCRenderer';
import { ContentRenderer } from './renderers/ContentRenderer';
import { HeaderFooterRenderer } from './renderers/HeaderFooterRenderer';

export class PDFExportService {
  private currentPage: number = 1;
  private totalPages: number = 0;
  private margins: Margins;
  private options: PDFExportOptions;

  constructor(options: PDFExportOptions = {}) {
    this.options = options;
    this.margins = {
      top: 25, right: 20, bottom: 25, left: 20,
      ...(options.margins || {}),
    };
  }

  async exportDocument(document: ObligationDocument): Promise<Uint8Array> {
    const loader = new JSPDFLoader();
    const doc = await loader.initialize();

    const pageHeight = doc.pageSize.height;

    let currentY = this.margins.top;

    // 1. Render Cover Page
    const coverRenderer = new CoverRenderer();
    currentY = coverRenderer.render(doc, currentY, this.margins, doc.pageSize.width - this.margins.left - this.margins.right, doc.pageSize.width, pageHeight, document, formatDate);
    this.addNewPage(doc);
    currentY = this.margins.top;

    // 2. Render Table of Contents
    const toc = generateTableOfContents(document);
    if (this.options.includeTableOfContents !== false) {
      const tocRenderer = new TOCRenderer();
      const tocAddNewPage = () => { currentY = this.addNewPage(doc); };
      tocRenderer.render(doc, currentY, this.margins, doc.pageSize.width - this.margins.left - this.margins.right, doc.pageSize.width, toc, tocAddNewPage);
      currentY = this.addNewPage(doc);
    }

    // 3. Render Content
    const contentRenderer = new ContentRenderer();
    const contentAddNewPage = () => { currentY = this.addNewPage(doc); return currentY; };
    contentRenderer.render(doc, currentY, this.margins, doc.pageSize.width - this.margins.left - this.margins.right, doc.pageSize.width, pageHeight, document, { addNewPage: contentAddNewPage });

    // 4. Add Headers and Footers
    if (this.options.includePageNumbers !== false) {
      const headerFooterRenderer = new HeaderFooterRenderer();
      this.totalPages = doc.getNumberOfPages();
      for (let i = 2; i <= this.totalPages; i++) {
        doc.setPage(i);
        headerFooterRenderer.addHeader(doc, this.margins, doc.pageSize.width - this.margins.left - this.margins.right, doc.pageSize.width, document, this.options);
        headerFooterRenderer.addFooter(doc, this.margins, doc.pageSize.width - this.margins.left - this.margins.right, doc.pageSize.width, i, this.totalPages, document, this.options);
      }
    }

    return new Uint8Array(doc.output('arraybuffer'));
  }

  private addNewPage(doc: IPDFDoc): number {
    doc.addPage();
    this.currentPage++;
    return this.margins.top;
  }
}
