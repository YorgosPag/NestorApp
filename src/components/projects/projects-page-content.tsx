'use client';

import React, { useState, useMemo, useCallback, startTransition } from 'react';

import type { Project } from '@/types/project';
import { useProjectsPageState } from '@/hooks/useProjectsPageState';
import { useFirestoreProjects } from '@/hooks/useFirestoreProjects';
import { AdvancedFiltersPanel, projectFiltersConfig, type FilterPanelConfig } from '@/components/core/AdvancedFilters';
import { ListContainer, PageContainer } from '@/core/containers';
import { useProjectsStats } from '@/hooks/useProjectsStats';
// 🏢 ENTERPRISE: Navigation context for breadcrumb sync
import { useNavigation } from '@/components/navigation/core/NavigationContext';

import { ProjectsHeader } from './ProjectsHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  LogIn,
} from 'lucide-react';
// 🏢 ENTERPRISE: All icons from centralized NAVIGATION_ENTITIES
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { ProjectViewSwitch } from './ProjectViewSwitch';
// 🏢 ENTERPRISE: Centralized page states (ADR-229)
import { PageLoadingState, PageErrorState } from '@/core/states';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { deleteProject } from '@/services/projects-client.service';
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useDeletionGuard } from '@/hooks/useDeletionGuard';
import { useProjectsTrashState } from '@/hooks/useProjectsTrashState';
import { TrashActionsBar } from '@/components/shared/trash/TrashActionsBar';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

const logger = createModuleLogger('ProjectsPageContent');

export function ProjectsPageContent() {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika', 'trash']);

  // Note: Deep-link tab is read from useProjectsPageState (same useSearchParams instance)

  // 🏢 ENTERPRISE: Navigation context for breadcrumb sync
  const { companies, syncBreadcrumb } = useNavigation();

  // Φόρτωση έργων από Firestore αντί για sample data
  const { projects: firestoreProjects, loading, error, refetch: refetchProjects } = useFirestoreProjects();

  const {
    selectedProject,
    setSelectedProject,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredProjects,
    filters,
    setFilters,
    tabFromUrl,
  } = useProjectsPageState(firestoreProjects || []);

  const projectsStats = useProjectsStats(filteredProjects || []);

  // 🏢 ENTERPRISE: Sync selectedProject with NavigationContext for breadcrumb display
  React.useEffect(() => {
    if (selectedProject && companies.length > 0) {
      // Find the company this project belongs to
      const company = companies.find(c => c.id === selectedProject.companyId);
      if (company) {
        // Use atomic sync with names - enterprise pattern
        syncBreadcrumb({
          company: { id: company.id, name: company.companyName },
          project: { id: selectedProject.id, name: selectedProject.name },
          currentLevel: 'projects'
        });
      }
    }
  }, [selectedProject?.id, companies.length, syncBreadcrumb]);

  // 🔥 NEW: Dashboard card filtering state
  const [activeCardFilter, setActiveCardFilter] = React.useState<string | null>(null);

  // Mobile-only states
  const [showFilters, setShowFilters] = useState(false);
  const [_searchTerm, _setSearchTerm] = useState('');

  // 🏢 ENTERPRISE: "Fill then Create" pattern (Salesforce/Procore/SAP)
  // No API call on "New" — open empty form, create on Save
  const TEMP_PROJECT_ID = '__new__';
  const [startInEditMode, setStartInEditMode] = useState(false);
  const isCreateMode = selectedProject?.id === TEMP_PROJECT_ID;

  const handleNewProject = useCallback(() => {
    const tempProject: Project = {
      id: TEMP_PROJECT_ID,
      name: '',
      title: '',
      description: '',
      // 🏢 Google-level create mode: no silent default. Widened to allow '',
      // which surfaces as the "Επιλέξτε κατάσταση..." placeholder in the
      // form's <Select> and is blocked by handleSave's pre-flight validation.
      status: '' as unknown as Project['status'],
      companyId: '',
      company: '',
      address: '',
      city: '',
      location: '',
      projectCode: '',
      progress: 0,
      totalValue: 0,
      totalArea: 0,
      lastUpdate: new Date().toISOString(),
    };
    setSelectedProject(tempProject);
    setStartInEditMode(true);
    logger.info('New project form opened (Fill then Create)');
  }, [companies, setSelectedProject]);

  // 🏢 ENTERPRISE: After successful creation, replace temp project with real one
  const handleProjectCreated = useCallback((realProjectId: string) => {
    if (selectedProject && selectedProject.id === TEMP_PROJECT_ID) {
      setSelectedProject({ ...selectedProject, id: realProjectId });
      setStartInEditMode(false);
    }
  }, [selectedProject, setSelectedProject]);

  // 🏢 ENTERPRISE: Cancel create mode — deselect project
  const handleCancelCreate = useCallback(() => {
    if (isCreateMode) {
      setSelectedProject(null);
    }
  }, [isCreateMode, setSelectedProject]);

  // 🏢 ADR-300 §Addendum: Status pill in draft mode writes straight to the
  // page-level draft store. The new status flows back down into
  // `GeneralProjectTab`'s local form state via the standard props sync
  // effect, so the subsequent Save picks up the selection.
  const handleDraftStatusChange = useCallback((next: Project['status']) => {
    setSelectedProject(prev => (prev ? { ...prev, status: next } : prev));
  }, [setSelectedProject]);

  // 🛡️ ADR-226 Phase 3: Deletion Guard — replaces cascade preview
  const { checking: checkingDeletion, checkBeforeDelete, BlockedDialog } = useDeletionGuard('project');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 🗑️ ADR-308: Trash view state
  const {
    showTrash,
    trashCount,
    trashedProjects,
    loadingTrash,
    showPermanentDeleteDialog,
    pendingPermanentDeleteIds,
    handleToggleTrash,
    handleRestoreProjects,
    handlePermanentDeleteProjects,
    handleConfirmPermanentDelete,
    handleCancelPermanentDelete,
  } = useProjectsTrashState({ forceDataRefresh: refetchProjects });

  const handleDeleteProject = React.useCallback(async (project: Project) => {
    const allowed = await checkBeforeDelete(project.id);
    if (allowed) {
      setProjectToDelete(project);
    }
  }, [checkBeforeDelete]);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    const result = await deleteProject(projectToDelete.id);
    if (result.success) {
      logger.info('Project deleted', { projectId: projectToDelete.id });
      setSelectedProject(null);
    } else {
      logger.error('Failed to delete project', { error: result.error });
    }
    // Always close dialog — on error user can retry; project may have dependency guard re-fire
    setProjectToDelete(null);
    setIsDeleting(false);
  }, [projectToDelete, setSelectedProject]);

  // 🏢 ENTERPRISE: Dynamic filter config — populate company/location/client options from real Firestore data
  const dynamicProjectConfig = useMemo<FilterPanelConfig>(() => {
    const projects = firestoreProjects ?? [];
    const companyValues = [...new Set(projects.map(p => p.company).filter(Boolean))].sort();
    const cityValues = [...new Set(projects.map(p => p.city).filter(Boolean))].sort();

    return {
      ...projectFiltersConfig,
      rows: projectFiltersConfig.rows.map(row => {
        if (row.id !== 'project-details') return row;
        return {
          ...row,
          fields: row.fields.map(field => {
            if (field.id === 'company' && field.options) {
              return {
                ...field,
                options: [
                  field.options[0], // "All Companies"
                  ...companyValues.map(c => ({ value: c, label: c }))
                ]
              };
            }
            if (field.id === 'location' && field.options) {
              return {
                ...field,
                options: [
                  field.options[0], // "All Locations"
                  ...cityValues.map(c => ({ value: c, label: c }))
                ]
              };
            }
            return field;
          })
        };
      })
    };
  }, [firestoreProjects]);

  // 🏢 ENTERPRISE: Memoized dashboard stats — avoids array recreation on every render (INP optimization)
  const dashboardStats = useMemo<DashboardStat[]>(() => [
    {
      title: t('page.dashboard.totalProjects'),
      value: projectsStats.totalProjects,
      icon: NAVIGATION_ENTITIES.project.icon,
      color: "blue"
    },
    {
      title: t('page.dashboard.activeProjects'),
      value: projectsStats.activeProjects,
      icon: TrendingUp,
      color: "green"
    },
    {
      title: t('page.dashboard.totalValue'),
      value: `€${(projectsStats.totalValue / 1000000).toFixed(1)}M`,
      icon: BarChart3,
      color: "purple"
    },
    {
      title: t('page.dashboard.totalArea'),
      value: `${(projectsStats.totalArea / 1000).toFixed(1)}K m²`,
      icon: NAVIGATION_ENTITIES.area.icon,
      color: "orange"
    },
    {
      title: t('page.dashboard.averageProgress'),
      value: `${projectsStats.averageProgress}%`,
      icon: Calendar,
      color: "cyan"
    }
  ], [t, projectsStats]);

  // 🏢 ENTERPRISE: Memoized card click handler (INP optimization)
  const handleCardClick = useCallback((stat: DashboardStat, _index: number) => {
    const cardTitle = stat.title;
    const totalProjectsTitle = t('page.dashboard.totalProjects');
    const activeProjectsTitle = t('page.dashboard.activeProjects');

    // Use startTransition — filtering is non-urgent, don't block UI
    startTransition(() => {
      // Toggle filter: αν κλικάρουμε την ίδια κάρτα, αφαιρούμε το φίλτρο
      if (activeCardFilter === cardTitle) {
        setActiveCardFilter(null);
        setFilters({ ...filters, status: [] });
      } else {
        setActiveCardFilter(cardTitle);

        switch (cardTitle) {
          case totalProjectsTitle:
            setFilters({ ...filters, status: [] });
            break;
          case activeProjectsTitle:
            setFilters({ ...filters, status: ['in_progress'] });
            break;
          default:
            setActiveCardFilter(null);
            break;
        }

        setSelectedProject(null);
      }
    });
  }, [t, activeCardFilter, filters, setFilters, setSelectedProject]);

  // Εμφάνιση loading state
  if (loading) {
    return (
      <PageContainer ariaLabel={t('page.loading')}>
        <PageLoadingState icon={NAVIGATION_ENTITIES.project.icon} message={t('page.loadingMessage')} layout="contained" />
      </PageContainer>
    );
  }

  // Εμφάνιση error state — i18n translated error codes
  if (error) {
    const isAuthError = error === 'AUTH_REQUIRED' || error === 'AUTH_FAILED';

    if (isAuthError) {
      return (
        <PageContainer ariaLabel={t('page.error.pageLabel')}>
          <section className="flex flex-1 items-center justify-center" role="alert">
            <div className="text-center">
              <LogIn className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                {error === 'AUTH_REQUIRED'
                  ? t('page.error.authRequired')
                  : t('page.error.authFailed')}
              </p>
              <p className="text-muted-foreground mb-6">
                {t('page.error.authRequiredAction')}
              </p>
              <Button asChild>
                <Link href="/login">{t('page.error.loginButton')}</Link>
              </Button>
            </div>
          </section>
        </PageContainer>
      );
    }

    const errorMessages: Record<string, string> = {
      SERVER_ERROR: t('page.error.serverError'),
      NETWORK_ERROR: t('page.error.networkError'),
      UNKNOWN_ERROR: t('page.error.unknownError'),
    };

    return (
      <PageContainer ariaLabel={t('page.error.pageLabel')}>
        <PageErrorState
          title={t('page.error.title')}
          message={errorMessages[error] ?? t('page.error.unknownError')}
          onRetry={() => window.location.reload()}
          retryLabel={t('page.error.retry')}
          layout="contained"
        />
      </PageContainer>
    );
  }
  
  return (
      <PageContainer ariaLabel={t('page.pageLabel')}>
        <ProjectsHeader
            viewMode={viewMode}
            setViewMode={setViewMode}
            showDashboard={showDashboard}
            setShowDashboard={setShowDashboard}
            onNewProject={handleNewProject}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            showTrash={showTrash}
            onToggleTrash={handleToggleTrash}
        />

        {showDashboard && (
          <section role="region" aria-label={t('page.dashboard.label')}>
            <UnifiedDashboard stats={dashboardStats} columns={5} onCardClick={handleCardClick} />
          </section>
        )}

        {/* Advanced Filters Panel - Desktop */}
        <aside className="hidden md:block" role="complementary" aria-label={t('page.filters.desktop')}>
          <AdvancedFiltersPanel
            config={dynamicProjectConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {/* Advanced Filters Panel - Mobile (conditional) */}
        {showFilters && (
          <aside className="md:hidden" role="complementary" aria-label={t('page.filters.mobile')}>
            <AdvancedFiltersPanel
              config={dynamicProjectConfig}
              filters={filters}
              onFiltersChange={setFilters}
              defaultOpen
            />
          </aside>
        )}


        <ListContainer>
          {/* 🗑️ ADR-308: Trash actions bar — shown only in trash view */}
          {showTrash && !loadingTrash && (
            <TrashActionsBar
              selectedIds={selectedProject ? [selectedProject.id] : []}
              onBack={handleToggleTrash}
              onRestore={handleRestoreProjects}
              onPermanentDelete={handlePermanentDeleteProjects}
              trashCount={trashCount}
            />
          )}

          <ProjectViewSwitch
            projects={showTrash ? trashedProjects : filteredProjects}
            selectedProject={selectedProject}
            onSelectProject={(project) => {
              setSelectedProject(project);
              setStartInEditMode(false);
            }}
            companies={companies}
            viewMode={viewMode}
            initialTab={tabFromUrl || undefined}
            onNewProject={showTrash ? undefined : handleNewProject}
            onDeleteProject={showTrash ? undefined : handleDeleteProject}
            startInEditMode={showTrash ? false : startInEditMode}
            isCreateMode={showTrash ? false : isCreateMode}
            onProjectCreated={showTrash ? undefined : handleProjectCreated}
            onCancelCreate={showTrash ? undefined : handleCancelCreate}
            onDraftStatusChange={showTrash ? undefined : handleDraftStatusChange}
          />
        </ListContainer>

        {/* 🛡️ ADR-226 Phase 3: Deletion Guard — blocked dialog */}
        {BlockedDialog}

        {/* 🏢 ENTERPRISE: Soft-delete confirmation (move to trash) */}
        <DeleteConfirmDialog
          open={!!projectToDelete}
          onOpenChange={(open) => { if (!open) setProjectToDelete(null); }}
          title={t('moveToTrash', { ns: 'trash' })}
          description={t('softDeleteDialog.description', { ns: 'trash' })}
          onConfirm={handleConfirmDelete}
          loading={isDeleting}
          disabled={checkingDeletion}
        />

        {/* 🗑️ ADR-308: Permanent delete confirmation */}
        <DeleteConfirmDialog
          open={showPermanentDeleteDialog}
          onOpenChange={(open) => { if (!open) handleCancelPermanentDelete(); }}
          title={t('permanentDeleteDialog.title', { ns: 'trash' })}
          description={t('permanentDeleteDialog.body', { ns: 'trash' })}
          onConfirm={handleConfirmPermanentDelete}
          loading={false}
          disabled={pendingPermanentDeleteIds.length === 0}
        />
      </PageContainer>
  );
}
