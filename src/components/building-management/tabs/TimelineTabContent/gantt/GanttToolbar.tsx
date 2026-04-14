/**
 * GanttToolbar — Toolbar and export dropdown for GanttView (ADR-034)
 *
 * Extracted from GanttView.tsx for SRP compliance (Google file-size standards).
 * Contains the action toolbar (New Phase, New Task, Export, Fullscreen) and
 * the export dropdown menu with PDF/PNG/SVG/Excel options.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md
 */

import '@/lib/design-system';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Plus,
  FolderPlus,
  Download,
  FileText,
  ImageIcon,
  FileImage,
  Table2,
  Maximize2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  exportGanttToPDF,
  exportGanttAsImage,
  exportGanttToExcel,
} from '@/services/gantt-export';
import type { GanttExportFormat } from '@/services/gantt-export';
import type { TaskGroup } from 'react-modern-gantt';

// ─── Export Dropdown ──────────────────────────────────────────────────────

interface GanttExportDropdownProps {
  ganttChartRef: React.RefObject<HTMLDivElement | null>;
  buildingName: string;
  taskGroups: TaskGroup[];
}

export function GanttExportDropdown({
  ganttChartRef,
  buildingName,
  taskGroups,
}: GanttExportDropdownProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const spacingTokens = useSpacingTokens();
  const iconSizes = useIconSizes();
  const [isExporting, setIsExporting] = useState(false);

  const exportLabels = useMemo(() => ({
    export: t('tabs.timeline.gantt.export.export'),
    pdf: t('tabs.timeline.gantt.export.pdf'),
    png: t('tabs.timeline.gantt.export.png'),
    svg: t('tabs.timeline.gantt.export.svg'),
    excel: t('tabs.timeline.gantt.export.excel'),
  }), [t]);

  const handleExport = useCallback(async (format: GanttExportFormat) => {
    if (!ganttChartRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const baseName = `Gantt_${buildingName || 'Chart'}_${timestamp}`;
      const ext = format === 'excel' ? 'xlsx' : format;

      switch (format) {
        case 'pdf':
          await exportGanttToPDF({
            format,
            filename: `${baseName}.pdf`,
            buildingName,
            taskGroups,
            chartElement: ganttChartRef.current,
          });
          break;
        case 'png':
        case 'svg':
          await exportGanttAsImage(ganttChartRef.current, format, `${baseName}.${ext}`);
          break;
        case 'excel':
          await exportGanttToExcel({
            format,
            filename: `${baseName}.xlsx`,
            buildingName,
            taskGroups,
            chartElement: ganttChartRef.current,
          });
          break;
      }
    } finally {
      setIsExporting(false);
    }
  }, [buildingName, taskGroups, isExporting, ganttChartRef]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          <Download className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
          {isExporting
            ? t('tabs.timeline.gantt.export.exporting')
            : exportLabels.export}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className={cn(iconSizes.xs, spacingTokens.margin.right.sm)} />
          {exportLabels.pdf}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('png')}>
          <ImageIcon className={cn(iconSizes.xs, spacingTokens.margin.right.sm)} />
          {exportLabels.png}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('svg')}>
          <FileImage className={cn(iconSizes.xs, spacingTokens.margin.right.sm)} />
          {exportLabels.svg}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          <Table2 className={cn(iconSizes.xs, spacingTokens.margin.right.sm)} />
          {exportLabels.excel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Action Toolbar ───────────────────────────────────────────────────────

interface GanttActionToolbarProps {
  phases: { id: string }[];
  isEmpty: boolean;
  ganttChartRef: React.RefObject<HTMLDivElement | null>;
  buildingName: string;
  taskGroups: TaskGroup[];
  openCreatePhaseDialog: () => void;
  openCreateTaskDialog: (phaseId: string) => void;
  onEnterFullscreen: () => void;
  /** Additional CSS class for the toolbar nav */
  className?: string;
}

export function GanttActionToolbar({
  phases,
  isEmpty,
  ganttChartRef,
  buildingName,
  taskGroups,
  openCreatePhaseDialog,
  openCreateTaskDialog,
  onEnterFullscreen,
  className,
}: GanttActionToolbarProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const spacingTokens = useSpacingTokens();
  const iconSizes = useIconSizes();

  return (
    <nav
      className={cn('shrink-0 flex items-center', spacingTokens.gap.sm, className)}
      aria-label={t('tabs.timeline.gantt.actionsAriaLabel')}
    >
      <Button variant="default" size="sm" onClick={openCreatePhaseDialog}>
        <FolderPlus className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
        {t('tabs.timeline.gantt.actions.newPhase')}
      </Button>
      {phases.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openCreateTaskDialog(phases[0].id)}
        >
          <Plus className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
          {t('tabs.timeline.gantt.actions.newTask')}
        </Button>
      )}

      {!isEmpty && (
        <GanttExportDropdown
          ganttChartRef={ganttChartRef}
          buildingName={buildingName}
          taskGroups={taskGroups}
        />
      )}

      {!isEmpty && (
        <Button
          variant="outline"
          size="sm"
          onClick={onEnterFullscreen}
          title={t('tabs.timeline.fullscreen')}
        >
          <Maximize2 className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
          {t('tabs.timeline.fullscreen')}
        </Button>
      )}
    </nav>
  );
}
