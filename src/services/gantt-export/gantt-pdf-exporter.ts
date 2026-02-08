/**
 * Gantt PDF Exporter (ADR-034)
 *
 * Generates a landscape A4 PDF with:
 * 1. Header — building name + export date
 * 2. Chart image — captured PNG embedded in PDF
 * 3. Data table — phase/task details via jspdf-autotable
 *
 * Uses existing jspdf + jspdf-autotable (already installed).
 * Embeds Roboto font (pre-computed base64) for Greek character support.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { GanttExportOptions } from './types';
import { captureGanttAsDataUrl, flattenTaskGroupsToRows } from './gantt-export-utils';

// ─── Font Registration ────────────────────────────────────────────────────

/**
 * Registers Roboto font with jsPDF for Greek character support.
 * Uses lazy dynamic import to load the ~687KB base64 data only when needed.
 * The default Helvetica font only supports Latin characters.
 */
async function registerGreekFont(pdf: jsPDF): Promise<void> {
  const { ROBOTO_REGULAR_BASE64 } = await import('./roboto-font-data');
  pdf.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
  // "Identity-H" encoding is CRITICAL for Unicode/Greek support
  // Without it, jsPDF defaults to WinAnsiEncoding (Latin-only)
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal', undefined, 'Identity-H');
  // Register same TTF as 'bold' — autoTable uses fontStyle:'bold' for header cells.
  // Without this, header cells fall back to Helvetica (no Identity-H) → garbled Greek.
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'bold', undefined, 'Identity-H');
  pdf.setFont('Roboto', 'normal');
}

// ─── PDF Export ───────────────────────────────────────────────────────────

/**
 * Exports the Gantt chart as a PDF document.
 * Page 1: Chart screenshot (landscape A4).
 * Page 2+: Data table with all phases and tasks.
 */
export async function exportGanttToPDF(options: GanttExportOptions): Promise<void> {
  const { chartElement, taskGroups, buildingName, filename } = options;

  // 1. Capture chart as PNG data URL
  const chartDataUrl = await captureGanttAsDataUrl(chartElement, 'png');

  // 2. Create PDF — landscape A4
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // 3. Register Roboto font for Greek character support
  await registerGreekFont(pdf);

  const pageWidth = pdf.internal.pageSize.getWidth();

  // 4. Header
  pdf.setFontSize(16);
  pdf.text(buildingName, 14, 15);
  pdf.setFontSize(10);
  pdf.text(
    new Date().toLocaleDateString('el-GR'),
    pageWidth - 14,
    15,
    { align: 'right' },
  );

  // 5. Chart image — fitted to page width, max height 120mm
  const img = new Image();
  img.src = chartDataUrl;
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
  });
  const imgRatio = img.height / img.width;
  const imgWidth = pageWidth - 28; // 14mm margin each side
  const imgHeight = Math.min(imgWidth * imgRatio, 120);
  pdf.addImage(chartDataUrl, 'PNG', 14, 22, imgWidth, imgHeight);

  // 6. Data table on next page
  pdf.addPage();
  pdf.setFont('Roboto', 'normal');
  const rows = flattenTaskGroupsToRows(taskGroups);
  autoTable(pdf, {
    head: [['Φάση', 'Εργασία', 'Έναρξη', 'Λήξη', 'Διάρκεια', 'Πρόοδος']],
    body: rows.map((r) => [
      r.phaseName,
      r.taskName,
      r.startDate,
      r.endDate,
      `${r.duration}d`,
      `${r.progress}%`,
    ]),
    startY: 15,
    styles: { fontSize: 9, font: 'Roboto' },
    headStyles: { fillColor: [59, 130, 246] },
    // Force Roboto on every cell (including headers) — autoTable v5
    // does not always inherit styles.font for header cells
    didParseCell: (data) => {
      data.cell.styles.font = 'Roboto';
    },
  });

  // 7. Trigger browser download
  pdf.save(filename);
}
