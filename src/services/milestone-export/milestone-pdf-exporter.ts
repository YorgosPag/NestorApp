/**
 * Milestone PDF Exporter (ADR-034)
 *
 * Enterprise-grade PDF report based on Procore / Primavera P6 standards:
 * 1. Report Header — title, building name, report date
 * 2. Summary Statistics — 4 colored boxes (completed, in-progress, pending, avg progress)
 * 3. Overall Progress Bar — visual progress indicator
 * 4. Milestone Summary Table — autoTable with color-coded status cells
 * 5. Detailed Milestone Cards — per-milestone: title, date, status, progress bar, description
 * 6. Footer — page number, timestamp, branding
 *
 * Uses Roboto font (pre-computed base64) for Greek character support.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { MilestoneExportOptions, MilestoneExportRow } from './types';
import type { Milestone } from '@/components/building-management/tabs/TimelineTabContent/MilestoneItem';

// ─── Constants ───────────────────────────────────────────────────────────

const MARGIN = 14;
const PRIMARY_COLOR: [number, number, number] = [59, 130, 246];

/** Status → RGB color mapping (matches design-tokens.ts semantic colors) */
const STATUS_COLORS: Record<string, [number, number, number]> = {
  'completed':   [34, 197, 94],    // green-500
  'in-progress': [59, 130, 246],   // blue-500
  'pending':     [148, 163, 184],  // slate-400
  'delayed':     [239, 68, 68],    // red-500
};

/** Status → light background RGB for table cells */
const STATUS_BG_COLORS: Record<string, [number, number, number]> = {
  'completed':   [220, 252, 231],  // green-100
  'in-progress': [219, 234, 254],  // blue-100
  'pending':     [241, 245, 249],  // slate-100
  'delayed':     [254, 226, 226],  // red-100
};

/** Status → text for PDF (Greek) */
const STATUS_TEXT: Record<string, string> = {
  'completed':   'Ολοκληρώθηκε',
  'in-progress': 'Σε Εξέλιξη',
  'pending':     'Εκκρεμεί',
  'delayed':     'Καθυστέρηση',
};

// ─── Font Registration ───────────────────────────────────────────────────

async function registerGreekFont(pdf: jsPDF): Promise<void> {
  const { ROBOTO_REGULAR_BASE64 } = await import('../gantt-export/roboto-font-data');
  pdf.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal', undefined, 'Identity-H');
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'bold', undefined, 'Identity-H');
  pdf.setFont('Roboto', 'normal');
}

// ─── Helper: Calculate Stats ─────────────────────────────────────────────

interface MilestoneStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  delayed: number;
  avgProgress: number;
}

function calculateStats(milestones: Milestone[]): MilestoneStats {
  const total = milestones.length;
  const completed = milestones.filter(m => m.status === 'completed').length;
  const inProgress = milestones.filter(m => m.status === 'in-progress').length;
  const delayed = milestones.filter(m => m.status === 'delayed').length;
  const pending = total - completed - inProgress - delayed;
  const avgProgress = total > 0
    ? Math.round(milestones.reduce((sum, m) => sum + (m.progress ?? 0), 0) / total)
    : 0;

  return { total, completed, inProgress, pending, delayed, avgProgress };
}

// ─── Helper: Prepare Export Rows ─────────────────────────────────────────

function prepareMilestoneRows(milestones: Milestone[]): MilestoneExportRow[] {
  return milestones.map((m, i) => ({
    index: i + 1,
    title: m.title,
    description: m.description ?? '',
    date: new Date(m.date).toLocaleDateString('el-GR'),
    status: STATUS_TEXT[m.status] ?? m.status,
    statusRaw: m.status,
    progress: m.progress ?? 0,
    type: m.type,
  }));
}

// ─── Draw Functions ──────────────────────────────────────────────────────

function drawReportHeader(
  pdf: jsPDF,
  buildingName: string,
  pageWidth: number,
  companyName?: string,
  projectName?: string,
): number {
  let y = 20;

  // Report title
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(30, 41, 59); // slate-800
  pdf.text('ΑΝΑΦΟΡΑ ΟΡΟΣΗΜΩΝ ΚΑΤΑΣΚΕΥΗΣ', MARGIN, y);

  // Report date (right-aligned, same line as title)
  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(71, 85, 105);
  pdf.text(
    `Ημ. Αναφοράς: ${new Date().toLocaleDateString('el-GR')}`,
    pageWidth - MARGIN,
    y,
    { align: 'right' },
  );

  // Company name
  if (companyName) {
    y += 8;
    pdf.setFont('Roboto', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(30, 41, 59); // slate-800
    pdf.text(`Εταιρεία: ${companyName}`, MARGIN, y);
  }

  // Project name
  if (projectName) {
    y += 7;
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(71, 85, 105); // slate-500
    pdf.text(`Έργο: ${projectName}`, MARGIN, y);
  }

  // Building name
  y += 7;
  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(71, 85, 105); // slate-500
  pdf.text(`Κτίριο: ${buildingName}`, MARGIN, y);

  // Separator line
  y += 5;
  pdf.setDrawColor(...PRIMARY_COLOR);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, y, pageWidth - MARGIN, y);

  return y + 6;
}

function drawSummaryBoxes(
  pdf: jsPDF,
  stats: MilestoneStats,
  y: number,
  pageWidth: number,
): number {
  const boxData: Array<{ value: string; label: string; color: [number, number, number] }> = [
    { value: `${stats.completed}`, label: 'Ολοκληρωμένα', color: [34, 197, 94] },
    { value: `${stats.inProgress}`, label: 'Σε Εξέλιξη', color: [59, 130, 246] },
    { value: `${stats.pending}`, label: 'Εκκρεμή', color: [148, 163, 184] },
    { value: `${stats.avgProgress}%`, label: 'Μέση Πρόοδος', color: [59, 130, 246] },
  ];

  const contentWidth = pageWidth - 2 * MARGIN;
  const boxWidth = (contentWidth - 3 * 6) / 4; // 6mm gap between boxes
  const boxHeight = 22;

  boxData.forEach((box, i) => {
    const x = MARGIN + i * (boxWidth + 6);

    // Box background (light tint)
    pdf.setFillColor(box.color[0], box.color[1], box.color[2]);
    pdf.setGState(pdf.GState({ opacity: 0.1 }));
    pdf.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'F');
    pdf.setGState(pdf.GState({ opacity: 1 }));

    // Box border
    pdf.setDrawColor(box.color[0], box.color[1], box.color[2]);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'S');

    // Value (large number)
    pdf.setFont('Roboto', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(box.color[0], box.color[1], box.color[2]);
    pdf.text(box.value, x + boxWidth / 2, y + 10, { align: 'center' });

    // Label (below)
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text(box.label, x + boxWidth / 2, y + 17, { align: 'center' });
  });

  return y + boxHeight + 6;
}

function drawOverallProgressBar(
  pdf: jsPDF,
  progress: number,
  y: number,
  pageWidth: number,
): number {
  const contentWidth = pageWidth - 2 * MARGIN;
  const barHeight = 6;
  const labelY = y + 3;

  // Label
  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text('Συνολική Πρόοδος', MARGIN, labelY);

  // Percentage (right-aligned)
  pdf.setFont('Roboto', 'bold');
  pdf.setTextColor(30, 41, 59);
  pdf.text(`${progress}%`, pageWidth - MARGIN, labelY, { align: 'right' });

  // Track (gray background)
  const barY = y + 6;
  pdf.setFillColor(226, 232, 240); // slate-200
  pdf.roundedRect(MARGIN, barY, contentWidth, barHeight, 2, 2, 'F');

  // Fill (blue)
  const fillWidth = (contentWidth * Math.min(progress, 100)) / 100;
  if (fillWidth > 0) {
    pdf.setFillColor(...PRIMARY_COLOR);
    pdf.roundedRect(MARGIN, barY, fillWidth, barHeight, 2, 2, 'F');
  }

  return barY + barHeight + 8;
}

function drawMilestoneTable(
  pdf: jsPDF,
  rows: MilestoneExportRow[],
  y: number,
): number {
  // Section title
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(30, 41, 59);
  pdf.text('ΠΙΝΑΚΑΣ ΟΡΟΣΗΜΩΝ', MARGIN, y);
  y += 4;

  autoTable(pdf, {
    head: [['#', 'Ορόσημο', 'Ημερομηνία', 'Κατάσταση', 'Πρόοδος']],
    body: rows.map((r) => [
      `${r.index}`,
      r.title,
      r.date,
      r.status,
      `${r.progress}%`,
    ]),
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 9, font: 'Roboto', cellPadding: 3 },
    headStyles: { fillColor: PRIMARY_COLOR, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 28 },
      3: { cellWidth: 30 },
      4: { cellWidth: 22, halign: 'center' },
    },
    didParseCell: (data) => {
      data.cell.styles.font = 'Roboto';

      // Color-code status cells in body rows
      if (data.section === 'body' && data.column.index === 3) {
        const rowIndex = data.row.index;
        const statusRaw = rows[rowIndex]?.statusRaw ?? 'pending';
        const bgColor = STATUS_BG_COLORS[statusRaw] ?? STATUS_BG_COLORS['pending'];
        const textColor = STATUS_COLORS[statusRaw] ?? STATUS_COLORS['pending'];
        data.cell.styles.fillColor = bgColor;
        data.cell.styles.textColor = textColor;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Get the final Y position after autoTable
  const finalY = (pdf as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 50;
  return finalY + 8;
}

function drawMilestoneDetails(
  pdf: jsPDF,
  milestones: Milestone[],
  rows: MilestoneExportRow[],
  startY: number,
  pageWidth: number,
  pageHeight: number,
): void {
  const contentWidth = pageWidth - 2 * MARGIN;
  let y = startY;

  // Section title
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(30, 41, 59);
  pdf.text('ΛΕΠΤΟΜΕΡΕΙΕΣ ΟΡΟΣΗΜΩΝ', MARGIN, y);
  y += 6;

  for (let i = 0; i < milestones.length; i++) {
    const milestone = milestones[i];
    const row = rows[i];
    const cardHeight = milestone.description ? 36 : 28;

    // Check if we need a new page
    if (y + cardHeight > pageHeight - 25) {
      pdf.addPage();
      pdf.setFont('Roboto', 'normal');
      y = 20;
    }

    const statusColor = STATUS_COLORS[milestone.status] ?? STATUS_COLORS['pending'];

    // Status indicator dot
    pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    pdf.circle(MARGIN + 3, y + 2, 2, 'F');

    // Title
    pdf.setFont('Roboto', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(30, 41, 59);
    pdf.text(row.title, MARGIN + 9, y + 3);

    // Date & Status (right)
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`${row.date}  |  ${row.status}`, pageWidth - MARGIN, y + 3, { align: 'right' });

    y += 8;

    // Progress bar (mini)
    const barWidth = contentWidth - 40;
    const barHeight = 4;
    const progress = milestone.progress ?? 0;

    // Track
    pdf.setFillColor(226, 232, 240);
    pdf.roundedRect(MARGIN + 9, y, barWidth, barHeight, 1, 1, 'F');

    // Fill
    const fillWidth = (barWidth * Math.min(progress, 100)) / 100;
    if (fillWidth > 0) {
      pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      pdf.roundedRect(MARGIN + 9, y, fillWidth, barHeight, 1, 1, 'F');
    }

    // Progress percentage
    pdf.setFont('Roboto', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    pdf.text(`${progress}%`, MARGIN + 9 + barWidth + 3, y + 3);

    y += 7;

    // Description (if available)
    if (milestone.description) {
      pdf.setFont('Roboto', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139); // slate-500
      const descLines = pdf.splitTextToSize(milestone.description, contentWidth - 12);
      pdf.text(descLines, MARGIN + 9, y + 2);
      y += descLines.length * 4 + 2;
    }

    // Separator line (light)
    y += 2;
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN + 9, y, pageWidth - MARGIN, y);
    y += 5;
  }
}

function addPageFooters(pdf: jsPDF, pageWidth: number, pageHeight: number): void {
  const totalPages = pdf.getNumberOfPages();
  const timestamp = new Date().toLocaleString('el-GR');

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(148, 163, 184); // slate-400

    // Left: page number
    pdf.text(`Σελίδα ${i}/${totalPages}`, MARGIN, pageHeight - 8);

    // Center: branding
    pdf.text('Nestor App', pageWidth / 2, pageHeight - 8, { align: 'center' });

    // Right: timestamp
    pdf.text(timestamp, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });

    // Separator line above footer
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, pageHeight - 12, pageWidth - MARGIN, pageHeight - 12);
  }
}

// ─── Main Export Function ────────────────────────────────────────────────

export async function exportMilestonesToPDF(options: MilestoneExportOptions): Promise<void> {
  const { milestones, buildingName, buildingProgress, filename, companyName, projectName } = options;

  // Create PDF — Portrait A4
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  await registerGreekFont(pdf);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Prepare data
  const stats = calculateStats(milestones);
  const rows = prepareMilestoneRows(milestones);

  // Draw sections
  let y = drawReportHeader(pdf, buildingName, pageWidth, companyName, projectName);
  y = drawSummaryBoxes(pdf, stats, y, pageWidth);
  y = drawOverallProgressBar(pdf, buildingProgress, y, pageWidth);
  y = drawMilestoneTable(pdf, rows, y);
  drawMilestoneDetails(pdf, milestones, rows, y, pageWidth, pageHeight);

  // Footers on all pages
  addPageFooters(pdf, pageWidth, pageHeight);

  // Download
  pdf.save(filename);
}
