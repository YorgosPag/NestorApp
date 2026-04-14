
'use client';

import React, { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenOverlay } from '@/core/containers/FullscreenOverlay';
import { TimelineHeader } from './TimelineTabContent/TimelineHeader';
import { OverallProgressCard } from './TimelineTabContent/OverallProgressCard';
import { TimelineMilestones } from './TimelineTabContent/TimelineMilestones';
import { CriticalPathCard } from './TimelineTabContent/CriticalPathCard';
import { CompletionForecastCard } from './TimelineTabContent/CompletionForecastCard';
import { getStatusColor, getStatusText, getTypeIcon } from './TimelineTabContent/utils';
import { TimelineViewToggle } from './TimelineTabContent/TimelineViewToggle';
import type { TimelineView } from './TimelineTabContent/TimelineViewToggle';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Building } from '../BuildingsPageContent';
// ProgressCard moved here from GeneralTabContent (consistency refactor)
import { ProgressCard } from './GeneralTabContent/ProgressCard';
// 🏢 ENTERPRISE: Milestone Export — PDF & Excel (ADR-034)
import { Download, FileText, Maximize2, Table2 } from 'lucide-react';
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
// 🏢 ENTERPRISE: Building Milestones CRUD
import { useBuildingMilestones } from '@/hooks/useBuildingMilestones';
import { MilestoneDialog } from './TimelineTabContent/MilestoneDialog';
import type { Milestone } from './TimelineTabContent/MilestoneItem';
import type { BuildingMilestone } from '@/types/building/milestone';
import { Plus } from 'lucide-react';
import '@/lib/design-system';

// Lazy load GanttView (ADR-034) — only loaded when user switches to Gantt view
const LazyGanttView = lazy(() =>
  import('./TimelineTabContent/gantt/GanttView').then((mod) => ({
    default: mod.GanttView,
  }))
);

// Lazy load ScheduleDashboard (ADR-266) — only loaded when user switches to Dashboard view
const LazyScheduleDashboard = lazy(() =>
  import('./TimelineTabContent/dashboard').then((mod) => ({
    default: mod.ScheduleDashboardView,
  }))
);

interface TimelineTabContentProps {
  building: Building;
}

const TimelineTabContent = ({ building }: TimelineTabContentProps) => {
  // View toggle state (milestones = default, gantt = ADR-034)
  const [activeView, setActiveView] = useState<TimelineView>('milestones');

  // 🏢 ADR-241: Fullscreen for milestones view
  const fullscreen = useFullscreen();

  // i18n and semantic colors hooks
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  // 🏢 ENTERPRISE: Resolve company & project names for export headers
  const { companies, projects } = useNavigation();
  const { companyName, projectName } = useMemo(() => {
    const project = projects.find(p => p.id === building.projectId);
    const company = project?.linkedCompanyId
      ? companies.find(c => c.id === project.linkedCompanyId)
      : undefined;
    return {
      companyName: company?.companyName ?? (building.company as string | undefined),
      projectName: project?.name ?? (building.project as string | undefined),
    };
  }, [building.projectId, building.company, building.project, companies, projects]);

  // 🏢 ENTERPRISE: Building milestones from Firestore
  const {
    milestones: firestoreMilestones,
    loading: milestonesLoading,
    createMilestone: handleCreateMilestone,
    updateMilestone: handleUpdateMilestone,
    deleteMilestone: handleDeleteMilestone,
  } = useBuildingMilestones(building.id as string);

  // Convert BuildingMilestone[] to Milestone[] for existing components
  const milestones: Milestone[] = useMemo(() =>
    firestoreMilestones.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      date: m.date,
      status: m.status,
      progress: m.progress,
      type: m.type,
    })),
    [firestoreMilestones]
  );

  // 🏢 ENTERPRISE: Milestone dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<BuildingMilestone | undefined>();

  const handleOpenCreate = useCallback(() => {
    setEditingMilestone(undefined);
    setDialogOpen(true);
  }, []);

  const handleEditMilestone = useCallback((milestone: Milestone) => {
    const full = firestoreMilestones.find((m) => m.id === milestone.id);
    if (full) {
      setEditingMilestone(full);
      setDialogOpen(true);
    }
  }, [firestoreMilestones]);

  const handleDeleteMilestoneConfirm = useCallback(async (milestone: Milestone) => {
    if (typeof milestone.id === 'string') {
      await handleDeleteMilestone(milestone.id);
    }
  }, [handleDeleteMilestone]);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setEditingMilestone(undefined);
  }, []);

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

  // 🏢 ENTERPRISE: i18n labels for milestone export
  const exportLabels = useMemo(() => ({
    export: t('tabs.timeline.milestoneExport.export'),
    pdf: t('tabs.timeline.milestoneExport.pdf'),
    excel: t('tabs.timeline.milestoneExport.excel'),
    exporting: t('tabs.timeline.milestoneExport.exporting'),
  }), [t]);

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
    <section className={activeView === 'gantt' ? 'flex flex-1 flex-col min-h-0 gap-2' : 'space-y-2'}>
      {/* View Toggle: Milestones | Gantt (ADR-034) */}
      <TimelineViewToggle activeView={activeView} onViewChange={setActiveView} />

      {/* Construction Phase Progress — moved from Γενικά for consistency */}
      <ProgressCard progress={(building.progress as number) ?? 0} />

      {/* Milestones View (existing) */}
      {activeView === 'milestones' && (
        <>
          <div className="flex items-center justify-between">
            <TimelineHeader milestones={milestones} />
            <div className="flex items-center gap-2">
              <Button variant="default" size="sm" onClick={handleOpenCreate}>
                <Plus className={cn(iconSizes.sm, 'mr-1.5')} />
                {t('tabs.timeline.milestoneDialog.addButton')}
              </Button>
            {/* Fullscreen Toggle (ADR-241) */}
              <Button
                variant="outline"
                size="sm"
                onClick={fullscreen.enter}
                title={t('tabs.timeline.fullscreen')}
              >
                <Maximize2 className={cn(iconSizes.sm, 'mr-1.5')} />
                {t('tabs.timeline.fullscreen')}
              </Button>
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
          </div>
          <OverallProgressCard building={building} milestones={milestones} />
          {milestonesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <TimelineMilestones
              milestones={milestones}
              getStatusColor={wrappedGetStatusColor}
              getStatusText={wrappedGetStatusText}
              getTypeIcon={getTypeIcon}
              onEditMilestone={handleEditMilestone}
              onDeleteMilestone={handleDeleteMilestoneConfirm}
            />
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <CriticalPathCard buildingId={building.id as string} />
            <CompletionForecastCard milestones={milestones} />
          </div>
        </>
      )}

      {/* ─── Milestones Fullscreen (ADR-241 — FullscreenOverlay portal) ── */}
      {fullscreen.isFullscreen && (
        <FullscreenOverlay
          isFullscreen
          onToggle={fullscreen.toggle}
          headerContent={
            <span className="font-semibold">
              {building.name} — {t('tabs.timeline.header.title')}
            </span>
          }
          ariaLabel={t('tabs.timeline.header.title')}
        >
          <section className="flex-1 min-h-0 overflow-auto p-4 space-y-2">
            <OverallProgressCard building={building} milestones={milestones} />
            {milestonesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <TimelineMilestones
                milestones={milestones}
                getStatusColor={wrappedGetStatusColor}
                getStatusText={wrappedGetStatusText}
                getTypeIcon={getTypeIcon}
                onEditMilestone={handleEditMilestone}
                onDeleteMilestone={handleDeleteMilestoneConfirm}
              />
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <CriticalPathCard buildingId={building.id as string} />
              <CompletionForecastCard milestones={milestones} />
            </div>
          </section>
        </FullscreenOverlay>
      )}

      {/* Gantt View (ADR-034) — lazy loaded */}
      {activeView === 'gantt' && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          }
        >
          <LazyGanttView building={building} />
        </Suspense>
      )}

      {/* Schedule Dashboard (ADR-266) — lazy loaded */}
      {activeView === 'dashboard' && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          }
        >
          <LazyScheduleDashboard
            companyId={building.companyId as string}
            buildingId={building.id as string}
            buildingName={(building.name as string) ?? ''}
            milestones={firestoreMilestones}
            onViewChange={setActiveView}
          />
        </Suspense>
      )}
      {/* 🏢 ENTERPRISE: Milestone CRUD Dialog */}
      <MilestoneDialog
        open={dialogOpen}
        milestone={editingMilestone}
        onClose={handleDialogClose}
        onSave={handleCreateMilestone}
        onUpdate={handleUpdateMilestone}
        onDelete={handleDeleteMilestone}
      />
    </section>
  );
};

export default TimelineTabContent;
