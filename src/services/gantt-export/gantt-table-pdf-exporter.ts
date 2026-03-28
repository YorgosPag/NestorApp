/**
 * Gantt Table PDF Exporter — Server-side table PDF without DOM
 *
 * Generates a landscape A4 PDF with phases (section headers) and tasks (indented rows).
 * No DOM element required — accepts raw ConstructionPhase[] + ConstructionTask[].
 *
 * @module services/gantt-export/gantt-table-pdf-exporter
 * @see ADR-266 Phase B (§5.6 — Gantt Snapshot Card, §5.7 — Export)
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateShort } from '@/lib/intl-utils';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';

// ============================================================================
// TYPES
// ============================================================================

export interface GanttTablePdfConfig {
  buildingName: string;
  phases: ConstructionPhase[];
  tasks: ConstructionTask[];
  filename: string;
  /** Translated status labels: { delayed: "Delayed", ... } */
  statusLabels: Record<string, string>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MARGIN = 12;
const BLUE: [number, number, number] = [59, 130, 246];
const SLATE_800: [number, number, number] = [30, 41, 59];
const SLATE_500: [number, number, number] = [71, 85, 105];
const GREEN: [number, number, number] = [34, 197, 94];
const AMBER: [number, number, number] = [245, 158, 11];
const RED: [number, number, number] = [239, 68, 68];
const PHASE_BG: [number, number, number] = [239, 246, 255]; // blue-50

// ============================================================================
// FONT + HELPERS
// ============================================================================

// Greek font registration — SSOT: src/services/pdf/greek-font-loader.ts
import { registerGreekFont } from '@/services/pdf/greek-font-loader';

function statusColor(status: string): [number, number, number] {
  if (status === 'completed') return GREEN;
  if (status === 'delayed') return RED;
  if (status === 'blocked') return RED;
  if (status === 'inProgress') return AMBER;
  return SLATE_500;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function exportGanttTableToPdf(config: GanttTablePdfConfig): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await registerGreekFont(pdf);

  const pageWidth = pdf.internal.pageSize.getWidth();

  // ── Header ──────────────────────────────────────────────────────────
  let y = 16;
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(...SLATE_800);
  pdf.text(`Gantt — ${config.buildingName}`, MARGIN, y);

  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...SLATE_500);
  pdf.text(formatDateShort(new Date()), pageWidth - MARGIN, y, { align: 'right' });

  // Blue separator
  y += 4;
  pdf.setDrawColor(...BLUE);
  pdf.setLineWidth(0.6);
  pdf.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 4;

  // ── Build table rows ────────────────────────────────────────────────
  const tasksByPhase = new Map<string, ConstructionTask[]>();
  for (const t of config.tasks) {
    const list = tasksByPhase.get(t.phaseId) ?? [];
    list.push(t);
    tasksByPhase.set(t.phaseId, list);
  }

  interface RowMeta { isPhase: boolean; status: string }
  const body: string[][] = [];
  const rowMeta: RowMeta[] = [];

  const sortedPhases = [...config.phases].sort((a, b) => a.order - b.order);

  for (const phase of sortedPhases) {
    // Phase header row
    body.push([
      `${phase.code}  ${phase.name}`,
      '',
      formatDateShort(phase.plannedStartDate),
      formatDateShort(phase.plannedEndDate),
      phase.actualStartDate ? formatDateShort(phase.actualStartDate) : '—',
      phase.actualEndDate ? formatDateShort(phase.actualEndDate) : '—',
      `${phase.progress}%`,
      config.statusLabels[phase.status] ?? phase.status,
    ]);
    rowMeta.push({ isPhase: true, status: phase.status });

    // Task rows (indented)
    const phaseTasks = (tasksByPhase.get(phase.id) ?? [])
      .sort((a, b) => a.order - b.order);

    for (const task of phaseTasks) {
      body.push([
        `    ${task.code}  ${task.name}`,
        task.dependencies?.join(', ') ?? '',
        formatDateShort(task.plannedStartDate),
        formatDateShort(task.plannedEndDate),
        task.actualStartDate ? formatDateShort(task.actualStartDate) : '—',
        task.actualEndDate ? formatDateShort(task.actualEndDate) : '—',
        `${task.progress}%`,
        config.statusLabels[task.status] ?? task.status,
      ]);
      rowMeta.push({ isPhase: false, status: task.status });
    }
  }

  // ── Render table ────────────────────────────────────────────────────
  autoTable(pdf, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    styles: { font: 'Roboto', fontSize: 8, cellPadding: 2.5 },
    headStyles: {
      fillColor: BLUE,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    head: [[
      'Phase / Task',
      'Deps',
      'Planned Start',
      'Planned End',
      'Actual Start',
      'Actual End',
      'Progress',
      'Status',
    ]],
    body,
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 25 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'center', cellWidth: 22 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const meta = rowMeta[data.row.index];
      if (!meta) return;

      // Phase rows: bold + blue-50 background
      if (meta.isPhase) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = PHASE_BG;
      }

      // Status column: color-coded text
      if (data.column.index === 7) {
        data.cell.styles.textColor = statusColor(meta.status);
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // ── Page footers ────────────────────────────────────────────────────
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    const pageH = pdf.internal.pageSize.getHeight();
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE_500);
    pdf.text(
      `Gantt Table — ${config.buildingName}`,
      MARGIN,
      pageH - 6,
    );
    pdf.text(
      `${i} / ${totalPages}`,
      pageWidth - MARGIN,
      pageH - 6,
      { align: 'right' },
    );
  }

  // ── Download ────────────────────────────────────────────────────────
  pdf.save(config.filename);
}
