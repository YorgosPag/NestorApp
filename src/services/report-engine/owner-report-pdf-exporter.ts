/**
 * Owner Report PDF Exporter — Simplified PDF for building owners
 *
 * Generates a 1-2 page portrait A4 PDF with plain-language construction status.
 * No SPI/CPI/EVM jargon — just progress, milestones, phases, expected completion.
 *
 * @module services/report-engine/owner-report-pdf-exporter
 * @see ADR-266 Phase B (§5.7 — Owner Report PDF)
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateShort } from '@/lib/intl-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface OwnerReportPhaseRow {
  name: string;
  code: string;
  progress: number;
  status: string;
  plannedEnd: string;
}

export interface OwnerReportMilestoneRow {
  title: string;
  date: string;
  status: string;
  progress: number;
}

export interface OwnerReportPdfConfig {
  buildingName: string;
  reportDate: Date;
  overallProgress: number;
  expectedProgress: number;
  expectedCompletionDate: string;
  daysRemaining: number;
  phases: OwnerReportPhaseRow[];
  milestones: OwnerReportMilestoneRow[];
  companyName?: string;
  filename: string;
  /** Translated labels for status values */
  statusLabels: Record<string, string>;
  /** Translated section headers */
  labels: OwnerReportLabels;
}

export interface OwnerReportLabels {
  title: string;
  overallProgress: string;
  expectedCompletion: string;
  daysRemaining: string;
  milestonesTitle: string;
  phasesTitle: string;
  colTitle: string;
  colDate: string;
  colStatus: string;
  colProgress: string;
  colPhase: string;
  colPlannedEnd: string;
  colCode: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MARGIN = 16;
const BLUE: [number, number, number] = [59, 130, 246];
const SLATE_800: [number, number, number] = [30, 41, 59];
const SLATE_500: [number, number, number] = [71, 85, 105];
const GREEN: [number, number, number] = [34, 197, 94];
const AMBER: [number, number, number] = [245, 158, 11];
const RED: [number, number, number] = [239, 68, 68];

// Greek font registration — SSOT: src/services/pdf/greek-font-loader.ts
import { registerGreekFont } from '@/services/pdf/greek-font-loader';

// ============================================================================
// HELPERS
// ============================================================================

function statusColor(status: string): [number, number, number] {
  if (status === 'completed') return GREEN;
  if (status === 'delayed') return RED;
  if (status === 'blocked') return RED;
  if (status === 'inProgress') return BLUE;
  return SLATE_500;
}

function drawProgressBar(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  progress: number,
): void {
  // Background track
  pdf.setFillColor(226, 232, 240); // slate-200
  pdf.roundedRect(x, y, width, height, 3, 3, 'F');

  // Filled portion
  const fillWidth = Math.max(0, Math.min(width, (progress / 100) * width));
  if (fillWidth > 0) {
    const color = progress >= 80 ? GREEN : progress >= 50 ? AMBER : BLUE;
    pdf.setFillColor(...color);
    pdf.roundedRect(x, y, fillWidth, height, 3, 3, 'F');
  }
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function exportOwnerReportToPdf(config: OwnerReportPdfConfig): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await registerGreekFont(pdf);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN * 2;
  let y = 20;

  // ── Header ──────────────────────────────────────────────────────────
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(...SLATE_800);
  pdf.text(config.buildingName, MARGIN, y);

  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...SLATE_500);
  pdf.text(
    formatDateShort(config.reportDate),
    pageWidth - MARGIN,
    y,
    { align: 'right' },
  );

  if (config.companyName) {
    y += 7;
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(...SLATE_500);
    pdf.text(config.companyName, MARGIN, y);
  }

  // Blue separator
  y += 5;
  pdf.setDrawColor(...BLUE);
  pdf.setLineWidth(0.8);
  pdf.line(MARGIN, y, pageWidth - MARGIN, y);

  // ── Overall Progress Section ────────────────────────────────────────
  y += 14;
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(...SLATE_800);
  pdf.text(config.labels.overallProgress, MARGIN, y);

  // Large progress percentage
  y += 12;
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(36);
  pdf.setTextColor(...BLUE);
  pdf.text(`${config.overallProgress}%`, MARGIN, y);

  // Progress bar
  y += 6;
  drawProgressBar(pdf, MARGIN, y, contentWidth, 8, config.overallProgress);

  // Expected progress label
  y += 14;
  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...SLATE_500);
  pdf.text(
    `${config.labels.expectedCompletion}: ${formatDateShort(config.expectedCompletionDate)}`,
    MARGIN,
    y,
  );
  pdf.text(
    `${config.labels.daysRemaining}: ${config.daysRemaining}`,
    pageWidth - MARGIN,
    y,
    { align: 'right' },
  );

  // ── Milestones Table ────────────────────────────────────────────────
  if (config.milestones.length > 0) {
    y += 14;
    pdf.setFont('Roboto', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(...SLATE_800);
    pdf.text(config.labels.milestonesTitle, MARGIN, y);
    y += 4;

    autoTable(pdf, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      styles: { font: 'Roboto', fontSize: 9, cellPadding: 3 },
      headStyles: {
        fillColor: BLUE,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      head: [[
        config.labels.colTitle,
        config.labels.colDate,
        config.labels.colStatus,
        config.labels.colProgress,
      ]],
      body: config.milestones.map(m => [
        m.title,
        formatDateShort(m.date),
        config.statusLabels[m.status] ?? m.status,
        `${m.progress}%`,
      ]),
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const status = config.milestones[data.row.index]?.status ?? '';
          data.cell.styles.textColor = statusColor(status);
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    y = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;
  }

  // ── Phases Summary Table ────────────────────────────────────────────
  if (config.phases.length > 0) {
    // Check if we need a new page
    if (y > 230) {
      pdf.addPage();
      y = 20;
    }

    y += 10;
    pdf.setFont('Roboto', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(...SLATE_800);
    pdf.text(config.labels.phasesTitle, MARGIN, y);
    y += 4;

    autoTable(pdf, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      styles: { font: 'Roboto', fontSize: 9, cellPadding: 3 },
      headStyles: {
        fillColor: BLUE,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      head: [[
        config.labels.colCode,
        config.labels.colPhase,
        config.labels.colPlannedEnd,
        config.labels.colStatus,
        config.labels.colProgress,
      ]],
      body: config.phases.map(p => [
        p.code,
        p.name,
        formatDateShort(p.plannedEnd),
        config.statusLabels[p.status] ?? p.status,
        `${p.progress}%`,
      ]),
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const status = config.phases[data.row.index]?.status ?? '';
          data.cell.styles.textColor = statusColor(status);
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
  }

  // ── Footer ──────────────────────────────────────────────────────────
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    const pageH = pdf.internal.pageSize.getHeight();
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...SLATE_500);
    pdf.text(
      `${config.buildingName} — ${config.labels.title}`,
      MARGIN,
      pageH - 8,
    );
    pdf.text(
      `${i} / ${totalPages}`,
      pageWidth - MARGIN,
      pageH - 8,
      { align: 'right' },
    );
  }

  // ── Download ────────────────────────────────────────────────────────
  pdf.save(config.filename);
}
