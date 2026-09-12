/**
 * @module services/report-engine/builder-pdf-exporter
 * @enterprise ADR-268 Phase 3 — Report Builder PDF Export
 *
 * Transforms builder state → branded A4 PDF with SAP Crystal banded layout.
 * REUSES: report-pdf-exporter.ts (drawReportHeader, drawKPICards, drawChartImage)
 * REUSES: greek-font-loader.ts (registerGreekFont)
 *
 * @see ADR-268 §11 Phase 3, SPEC-003-export.md, QA.md Q55-Q68
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { productQualified } from '@/constants/product-identity';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import { formatDateShort } from '@/lib/intl-utils';
import type { BuilderExportParams } from './builder-export-types';
import { buildFiltersText, buildExportFilename, getFieldDefs } from './builder-export-types';
import { drawWatermark, drawTableOfContents, addBookmarks, addFooters } from './builder-pdf-extras';
import {
  MARGIN,
  PRIMARY,
  SLATE_200,
  SLATE_400,
  SLATE_500,
  SLATE_800,
  drawReportHeading,
  forceRobotoCell,
  yAfterTable,
} from './report-pdf-chrome';
import type {
  GroupedRow,
  FieldDefinition,
} from '@/config/report-builder/report-builder-types';

// ============================================================================
// CONSTANTS
// ============================================================================
// ⚠️ Το περιθώριο και η παλέτα ΔΕΝ ζουν πια εδώ: αυτό το μπλοκ έγραφε «match
//    report-pdf-exporter.ts palette» — δηλαδή ομολογούσε ότι είναι αντίγραφο και ζητούσε
//    από άνθρωπο να συντηρεί τη συμφωνία. Τώρα είναι ΕΝΑ, στο `report-pdf-chrome`.
//    Εδώ μένουν μόνο όσα είναι όντως **δικά** αυτού του εξαγωγέα.

const NAVY: [number, number, number] = [30, 58, 95];
const GROUP_HEADER_BG: [number, number, number] = [241, 245, 249]; // slate-100
const GROUP_FOOTER_BG: [number, number, number] = [248, 250, 252]; // slate-50
const MIN_ORPHAN_ROWS = 3;

// ============================================================================
// HEADER + KPIs + CHART (reuse existing patterns)
// ============================================================================

function drawHeader(
  pdf: jsPDF,
  params: BuilderExportParams,
  pageWidth: number,
): number {
  let y = 20;

  drawReportHeading(pdf, params.domainDefinition.labelKey, y, pageWidth);

  // Filters line
  const filtersText = buildFiltersText(params.filters, params.domainDefinition);
  y += 7;
  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...SLATE_500);
  pdf.text(`Φίλτρα: ${filtersText}`, MARGIN, y);

  // Separator
  y += 5;
  pdf.setDrawColor(...PRIMARY);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, y, pageWidth - MARGIN, y);

  return y + 6;
}

function drawKPIBar(
  pdf: jsPDF,
  params: BuilderExportParams,
  y: number,
  pageWidth: number,
): number {
  if (!params.groupingResult) return y;

  const totals = params.grandTotals;
  const keys = Object.keys(totals).slice(0, 4);
  if (keys.length === 0) return y;

  const contentWidth = pageWidth - 2 * MARGIN;
  const gap = 5;
  const boxWidth = (contentWidth - (keys.length - 1) * gap) / keys.length;
  const boxHeight = 20;

  keys.forEach((key, i) => {
    const x = MARGIN + i * (boxWidth + gap);
    const label = key.replace(':', ': ');
    const value = totals[key].toLocaleString('el-GR');

    // Box
    pdf.setFillColor(...PRIMARY);
    pdf.setGState(pdf.GState({ opacity: 0.08 }));
    pdf.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'F');
    pdf.setGState(pdf.GState({ opacity: 1 }));
    pdf.setDrawColor(...PRIMARY);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'S');

    // Value
    pdf.setFont('Roboto', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(...PRIMARY);
    pdf.text(value, x + boxWidth / 2, y + 9, { align: 'center' });

    // Label
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE_500);
    pdf.text(label, x + boxWidth / 2, y + 16, { align: 'center' });
  });

  return y + boxHeight + 6;
}

function drawChart(
  pdf: jsPDF,
  params: BuilderExportParams,
  y: number,
  pageWidth: number,
  pageHeight: number,
): number {
  if (!params.chartImageDataUrl) return y;

  const contentWidth = pageWidth - 2 * MARGIN;
  const imgHeight = 80;

  if (y + imgHeight + 12 > pageHeight - 25) {
    pdf.addPage();
    pdf.setFont('Roboto', 'normal');
    y = 20;
  }

  try {
    pdf.addImage(params.chartImageDataUrl, 'PNG', MARGIN, y, contentWidth, imgHeight);
  } catch {
    pdf.setFillColor(...SLATE_200);
    pdf.roundedRect(MARGIN, y, contentWidth, imgHeight, 2, 2, 'F');
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...SLATE_400);
    pdf.text('Γράφημα μη διαθέσιμο', MARGIN + contentWidth / 2, y + imgHeight / 2, {
      align: 'center',
    });
  }

  return y + imgHeight + 8;
}

// ============================================================================
// TABLE RENDERING
// ============================================================================

function formatCellValue(
  value: unknown,
  field: FieldDefinition,
  refs: Record<string, Record<string, string>>,
): string {
  if (value === null || value === undefined) return '-';

  if (field.refDomain) {
    const refMap = refs[field.refDomain];
    return refMap?.[String(value)] ?? String(value);
  }

  if (field.type === 'currency' && typeof value === 'number') {
    return `€${value.toLocaleString('el-GR')}`;
  }
  if (field.type === 'percentage' && typeof value === 'number') {
    return `${value.toFixed(1)}%`;
  }
  if (field.type === 'date' && typeof value === 'string') {
    return formatDateShort(value);
  }
  if (field.type === 'boolean') {
    return value ? 'Ναι' : 'Όχι';
  }

  return String(value);
}

function drawFlatTable(
  pdf: jsPDF,
  params: BuilderExportParams,
  y: number,
  pageHeight: number,
): number {
  const fields = getFieldDefs(params);
  const headers = fields.map((f) => f.labelKey);
  const rows = params.results.rows.map((row) =>
    fields.map((f) => formatCellValue(row[f.key], f, params.results.resolvedRefs)),
  );

  if (y + 30 > pageHeight - 25) {
    pdf.addPage();
    pdf.setFont('Roboto', 'normal');
    y = 20;
  }

  autoTable(pdf, {
    head: [headers],
    body: rows,
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 8, font: 'Roboto', cellPadding: 2.5 },
    headStyles: { fillColor: NAVY, fontStyle: 'bold' },
    showHead: 'everyPage',
    didParseCell: forceRobotoCell,
  });

  return yAfterTable(pdf, y, 50) + 8;
}

/**
 * Πόσο **στενεύει** και πόσο **ξεθωριάζει** ένας πίνακας λεπτομερειών ανά επίπεδο φωλιάς.
 *
 * 🧹 Οι δύο κλήσεις (L1 · L2) ήταν **δίδυμα 19 γραμμών** (CHECK 3.28, 2026-09-12) και η
 * **μόνη** τους διαφορά ήταν αυτές οι τέσσερις τιμές. Ό,τι έμενε ίδιο — κεφαλίδες από τα
 * πεδία, μορφοποίηση κελιών, `showHead`, `rowPageBreak`, η Roboto — ήταν ίδιο **επειδή
 * πρέπει**, όχι κατά τύχη.
 */
interface DetailTableStyle {
  /** Επιπλέον εσοχή (mm) από το αριστερό περιθώριο — η φωλιά **φαίνεται**. */
  readonly indent: number;
  readonly fontSize: number;
  readonly cellPadding: number;
  readonly headFill: [number, number, number];
}

/** Γράψε τις γραμμές λεπτομέρειας ενός ομίλου και επίστρεψε το νέο `y`. */
function drawDetailRows(
  pdf: jsPDF,
  rows: readonly Record<string, unknown>[],
  fields: readonly FieldDefinition[],
  params: BuilderExportParams,
  y: number,
  style: DetailTableStyle,
): number {
  autoTable(pdf, {
    head: [fields.map((f) => f.labelKey)],
    body: rows.map((row) =>
      fields.map((f) => formatCellValue(row[f.key], f, params.results.resolvedRefs)),
    ),
    startY: y,
    margin: { left: MARGIN + style.indent, right: MARGIN },
    styles: { fontSize: style.fontSize, font: 'Roboto', cellPadding: style.cellPadding },
    headStyles: { fillColor: style.headFill, fontStyle: 'bold', fontSize: style.fontSize },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    didParseCell: forceRobotoCell,
  });

  return yAfterTable(pdf, y, 20);
}

function drawGroupedTable(
  pdf: jsPDF,
  params: BuilderExportParams,
  y: number,
  pageWidth: number,
  pageHeight: number,
): { y: number; pageMap: Map<string, number> } {
  const fields = getFieldDefs(params);
  const groups = params.filteredGroups ?? params.groupingResult?.groups ?? [];
  const pageMap = new Map<string, number>();
  const contentWidth = pageWidth - 2 * MARGIN;

  for (const group of groups) {
    // Orphan/widow: ensure group header + min rows fit
    const estimatedGroupHeight = 10 + Math.min(group.children.length, MIN_ORPHAN_ROWS) * 7;
    if (y + estimatedGroupHeight > pageHeight - 25) {
      pdf.addPage();
      pdf.setFont('Roboto', 'normal');
      y = 20;
    }

    // Track page for TOC/bookmarks
    pageMap.set(group.groupKey, pdf.getNumberOfPages());

    // Group Header Band
    pdf.setFillColor(...GROUP_HEADER_BG);
    pdf.rect(MARGIN, y, contentWidth, 8, 'F');
    pdf.setFont('Roboto', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...NAVY);
    pdf.text(`${group.groupKey} (${group.rowCount})`, MARGIN + 3, y + 5.5);
    y += 10;

    // Detail rows via autoTable
    const detailRows = group.children.filter(
      (c): c is Record<string, unknown> => !('groupKey' in c),
    );
    const nestedGroups = group.children.filter(
      (c): c is GroupedRow => 'groupKey' in c,
    );

    if (detailRows.length > 0) {
      y = drawDetailRows(pdf, detailRows, fields, params, y, {
        indent: 0,
        fontSize: 7.5,
        cellPadding: 2,
        headFill: PRIMARY,
      });
    }

    // Nested L2 groups
    for (const nested of nestedGroups) {
      if (y + 15 > pageHeight - 25) {
        pdf.addPage();
        pdf.setFont('Roboto', 'normal');
        y = 20;
      }

      // L2 header (indented)
      pdf.setFillColor(...GROUP_FOOTER_BG);
      pdf.rect(MARGIN + 4, y, contentWidth - 4, 7, 'F');
      pdf.setFont('Roboto', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...SLATE_800);
      pdf.text(`${nested.groupKey} (${nested.rowCount})`, MARGIN + 7, y + 5);
      y += 8;

      const nestedDetails = nested.children.filter(
        (c): c is Record<string, unknown> => !('groupKey' in c),
      );
      if (nestedDetails.length > 0) {
        y = drawDetailRows(pdf, nestedDetails, fields, params, y, {
          indent: 4,
          fontSize: 7,
          cellPadding: 1.5,
          headFill: SLATE_500,
        });
      }
    }

    // Group Footer Band (aggregates)
    const aggEntries = Object.entries(group.aggregates);
    if (aggEntries.length > 0) {
      y += 1;
      pdf.setFillColor(...GROUP_FOOTER_BG);
      pdf.rect(MARGIN, y, contentWidth, 7, 'F');
      pdf.setFont('Roboto', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...SLATE_800);
      const aggText = aggEntries
        .map(([k, v]) => `${k.replace(':', ': ')}: ${v.toLocaleString('el-GR')}`)
        .join('  |  ');
      pdf.text(aggText, MARGIN + 3, y + 5);
      y += 10;
    }
  }

  // Grand Total row
  const grandTotals = params.grandTotals;
  if (Object.keys(grandTotals).length > 0) {
    if (y + 12 > pageHeight - 25) {
      pdf.addPage();
      pdf.setFont('Roboto', 'normal');
      y = 20;
    }

    pdf.setFillColor(...NAVY);
    pdf.rect(MARGIN, y, contentWidth, 9, 'F');
    pdf.setFont('Roboto', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    const totalText = Object.entries(grandTotals)
      .map(([k, v]) => `${k.replace(':', ': ')}: ${v.toLocaleString('el-GR')}`)
      .join('  |  ');
    pdf.text(`ΓΕΝΙΚΟ ΣΥΝΟΛΟ: ${totalText}`, MARGIN + 3, y + 6.5);
    y += 14;
  }

  return { y, pageMap };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function exportBuilderToPdf(params: BuilderExportParams): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await registerGreekFont(pdf);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // 1. Header + Filters
  let y = drawHeader(pdf, params, pageWidth);

  // 2. KPI Bar
  y = drawKPIBar(pdf, params, y, pageWidth);

  // 3. Chart image
  y = drawChart(pdf, params, y, pageWidth, pageHeight);

  // 4. Table (flat or grouped)
  let pageMap: Map<string, number> | null = null;
  const hasGrouping = params.groupingResult && params.filteredGroups && params.filteredGroups.length > 0;

  if (hasGrouping) {
    const result = drawGroupedTable(pdf, params, y, pageWidth, pageHeight);
    y = result.y;
    pageMap = result.pageMap;
  } else {
    y = drawFlatTable(pdf, params, y, pageHeight);
  }

  // 5. TOC + Bookmarks (conditional: grouping AND >2 pages)
  const domainTitle = params.domainDefinition.labelKey;
  if (pageMap && pageMap.size > 0 && pdf.getNumberOfPages() > 2) {
    drawTableOfContents(pdf, pageMap, pageWidth);
    addBookmarks(pdf, pageMap, domainTitle);
  }

  // 6. Document metadata
  pdf.setProperties({
    title: `${domainTitle} Report`,
    author: params.userName,
    subject: buildFiltersText(params.filters, params.domainDefinition),
    keywords: `${params.domain}, report, nestor`,
    creator: productQualified('Report Builder'),
  });

  // 7. Watermark (after all content)
  drawWatermark(pdf, params.watermark, params.userName, pageWidth, pageHeight);

  // 8. Footers (after TOC insertion to get correct page count)
  addFooters(pdf, pageWidth, pageHeight);

  // 9. Download
  const filename = buildExportFilename(params.domain, 'pdf');
  pdf.save(filename);
}
