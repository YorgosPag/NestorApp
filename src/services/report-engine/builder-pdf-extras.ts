/**
 * @module services/report-engine/builder-pdf-extras
 * @enterprise ADR-268 Phase 3 — PDF TOC, Bookmarks, Watermark
 *
 * Extracted from builder-pdf-exporter.ts for Google SRP (<500 lines).
 */

import jsPDF from 'jspdf';
import type { WatermarkMode } from './builder-export-types';

// ============================================================================
// CONSTANTS
// ============================================================================

const MARGIN = 14;
const SLATE_800: [number, number, number] = [30, 41, 59];
const SLATE_400: [number, number, number] = [148, 163, 184];
const SLATE_200: [number, number, number] = [226, 232, 240];

// ============================================================================
// WATERMARK
// ============================================================================

export function drawWatermark(
  pdf: jsPDF,
  mode: WatermarkMode,
  userName: string,
  pageWidth: number,
  pageHeight: number,
): void {
  if (mode === 'none') return;

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setGState(pdf.GState({ opacity: 0.15 }));
    pdf.setFont('Roboto', 'bold');
    pdf.setFontSize(48);
    pdf.setTextColor(200, 200, 200);

    const cx = pageWidth / 2;
    const cy = pageHeight / 2;

    pdf.text('ΕΜΠΙΣΤΕΥΤΙΚΟ', cx, cy, {
      align: 'center',
      angle: 45,
    });

    if (mode === 'confidential-user') {
      pdf.setFontSize(14);
      pdf.text(
        `${userName} — ${new Date().toLocaleString('el-GR')}`,
        cx,
        cy + 20,
        { align: 'center', angle: 45 },
      );
    }

    pdf.setGState(pdf.GState({ opacity: 1 }));
  }
}

// ============================================================================
// TABLE OF CONTENTS
// ============================================================================

export function drawTableOfContents(
  pdf: jsPDF,
  pageMap: Map<string, number>,
  pageWidth: number,
): void {
  pdf.insertPage(2);
  pdf.setPage(2);

  let y = 25;
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(...SLATE_800);
  pdf.text('Πίνακας Περιεχομένων', MARGIN, y);
  y += 10;

  pdf.setDrawColor(...SLATE_200);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 6;

  const contentWidth = pageWidth - 2 * MARGIN;

  for (const [groupKey, pageNum] of pageMap) {
    const adjustedPage = pageNum + 1;
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...SLATE_800);
    pdf.text(groupKey, MARGIN, y);

    pdf.setTextColor(...SLATE_400);
    const pageStr = String(adjustedPage);
    pdf.text(pageStr, MARGIN + contentWidth, y, { align: 'right' });

    const labelWidth = pdf.getTextWidth(groupKey);
    const pageNumWidth = pdf.getTextWidth(pageStr);
    const dotStart = MARGIN + labelWidth + 4;
    const dotEnd = MARGIN + contentWidth - pageNumWidth - 4;
    if (dotEnd > dotStart) {
      pdf.setFontSize(8);
      const dots = '.'.repeat(Math.floor((dotEnd - dotStart) / 2));
      pdf.text(dots, dotStart, y);
    }

    y += 7;
  }
}

// ============================================================================
// BOOKMARKS
// ============================================================================

export function addBookmarks(
  pdf: jsPDF,
  pageMap: Map<string, number>,
  title: string,
): void {
  const root = pdf.outline.add(null, title, { pageNumber: 1 });

  for (const [groupKey, pageNum] of pageMap) {
    pdf.outline.add(root, groupKey, { pageNumber: pageNum + 1 });
  }
}

// ============================================================================
// PAGE FOOTERS
// ============================================================================

export function addFooters(
  pdf: jsPDF,
  pageWidth: number,
  pageHeight: number,
): void {
  const totalPages = pdf.getNumberOfPages();
  const timestamp = new Date().toLocaleString('el-GR');

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE_400);

    pdf.text(`Σελίδα ${i}/${totalPages}`, MARGIN, pageHeight - 8);
    pdf.text('Nestor Report Builder', pageWidth / 2, pageHeight - 8, { align: 'center' });
    pdf.text(timestamp, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });

    pdf.setDrawColor(...SLATE_200);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, pageHeight - 12, pageWidth - MARGIN, pageHeight - 12);
  }
}
