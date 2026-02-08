
'use client';

import React, { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { TimelineHeader } from './TimelineTabContent/TimelineHeader';
import { OverallProgressCard } from './TimelineTabContent/OverallProgressCard';
import { TimelineMilestones } from './TimelineTabContent/TimelineMilestones';
import { CriticalPathCard } from './TimelineTabContent/CriticalPathCard';
import { CompletionForecastCard } from './TimelineTabContent/CompletionForecastCard';
import { getStatusColor, getStatusText, getTypeIcon, getMilestones } from './TimelineTabContent/utils';
import { TimelineViewToggle } from './TimelineTabContent/TimelineViewToggle';
import type { TimelineView } from './TimelineTabContent/TimelineViewToggle';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Building } from '../BuildingsPageContent';
// 🏢 ENTERPRISE: Milestone Export — PDF & Excel (ADR-034)
import { Download, FileText, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
import { exportMilestonesToPDF, exportMilestonesToExcel } from '@/services/milestone-export';
import type { MilestoneExportFormat } from '@/services/milestone-export';
// 🏢 ENTERPRISE: NavigationContext for company/project name lookup
import { useNavigation } from '@/components/navigation/core/NavigationContext';

// Lazy load GanttView (ADR-034) — only loaded when user switches to Gantt view
const LazyGanttView = lazy(() =>
  import('./TimelineTabContent/gantt/GanttView').then((mod) => ({
    default: mod.GanttView,
  }))
);

interface TimelineTabContentProps {
  building: Building;
}

const TimelineTabContent = ({ building }: TimelineTabContentProps) => {
  // View toggle state (milestones = default, gantt = ADR-034)
  const [activeView, setActiveView] = useState<TimelineView>('milestones');

  // i18n and semantic colors hooks
  const { t, i18n } = useTranslation('building');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  // 🏢 ENTERPRISE: Resolve company & project names for export headers
  const { companies, projects } = useNavigation();
  const { companyName, projectName } = useMemo(() => {
    const project = projects.find(p => p.id === building.projectId);
    const company = project?.companyId
      ? companies.find(c => c.id === project.companyId)
      : undefined;
    return {
      companyName: company?.companyName ?? (building.company as string | undefined),
      projectName: project?.name ?? (building.project as string | undefined),
    };
  }, [building.projectId, building.company, building.project, companies, projects]);

  // Get i18n-enabled milestones
  const milestones = getMilestones(t);

  // 🏢 ENTERPRISE: Milestone export state
  const [isExporting, setIsExporting] = useState(false);

  // Wrapper functions for component compatibility
  const wrappedGetStatusColor = useCallback(
    (status: string) => getStatusColor(status, colors),
    [colors]
  );

  const wrappedGetStatusText = useCallback(
    (status: string) => getStatusText(status, t),
    [t]
  );

  // 🏢 ENTERPRISE: Safe i18n labels with fallback pattern
  const exportLabels = useMemo(() => {
    const isGreek = i18n.language === 'el';
    const safeLabel = (key: string, el: string, en: string): string => {
      const result = t(`tabs.timeline.milestoneExport.${key}`);
      return result.includes('.') ? (isGreek ? el : en) : result;
    };
    return {
      export: safeLabel('export', 'Εξαγωγή', 'Export'),
      pdf: safeLabel('pdf', 'PDF (Αναφορά)', 'PDF (Report)'),
      excel: safeLabel('excel', 'Excel (Δεδομένα)', 'Excel (Data)'),
      exporting: safeLabel('exporting', 'Εξαγωγή...', 'Exporting...'),
    };
  }, [t, i18n.language]);

  // 🏢 ENTERPRISE: Milestone export handler
  const handleMilestoneExport = useCallback(async (format: MilestoneExportFormat) => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const buildingName = (building.name as string) ?? '';
      const baseName = `Milestones_${buildingName}_${timestamp}`;
      const ext = format === 'excel' ? 'xlsx' : format;

      const options = {
        format,
        filename: `${baseName}.${ext}`,
        buildingName,
        buildingProgress: (building.progress as number) ?? 0,
        milestones,
        companyName,
        projectName,
      };

      if (format === 'pdf') {
        await exportMilestonesToPDF(options);
      } else {
        await exportMilestonesToExcel(options);
      }
    } finally {
      setIsExporting(false);
    }
  }, [building.name, building.progress, milestones, isExporting, companyName, projectName]);

  return (
    <section className="space-y-6">
      {/* View Toggle: Milestones | Gantt (ADR-034) */}
      <TimelineViewToggle activeView={activeView} onViewChange={setActiveView} />

      {/* Milestones View (existing) */}
      {activeView === 'milestones' && (
        <>
          <div className="flex items-center justify-between">
            <TimelineHeader milestones={milestones} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isExporting}>
                  <Download className={cn(iconSizes.sm, 'mr-1.5')} />
                  {isExporting ? exportLabels.exporting : exportLabels.export}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleMilestoneExport('pdf')}>
                  <FileText className={cn(iconSizes.sm, 'mr-2')} />
                  {exportLabels.pdf}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleMilestoneExport('excel')}>
                  <Table2 className={cn(iconSizes.sm, 'mr-2')} />
                  {exportLabels.excel}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <OverallProgressCard building={building} milestones={milestones} />
          <TimelineMilestones
            milestones={milestones}
            getStatusColor={wrappedGetStatusColor}
            getStatusText={wrappedGetStatusText}
            getTypeIcon={getTypeIcon}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CriticalPathCard />
            <CompletionForecastCard milestones={milestones} />
          </div>
        </>
      )}

      {/* Gantt View (ADR-034) — lazy loaded */}
      {activeView === 'gantt' && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          }
        >
          <LazyGanttView building={building} />
        </Suspense>
      )}
    </section>
  );
};

export default TimelineTabContent;
