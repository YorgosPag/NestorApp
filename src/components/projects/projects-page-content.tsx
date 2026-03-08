'use client';

import React, { useState, useMemo, useCallback, startTransition } from 'react';

import type { Project } from '@/types/project';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useProjectsPageState } from '@/hooks/useProjectsPageState';
import { useFirestoreProjects } from '@/hooks/useFirestoreProjects';
import { AdvancedFiltersPanel, projectFiltersConfig } from '@/components/core/AdvancedFilters';
import { ListContainer, PageContainer } from '@/core/containers';
import { useProjectsStats } from '@/hooks/useProjectsStats';
// 🏢 ENTERPRISE: Navigation context for breadcrumb sync
import { useNavigation } from '@/components/navigation/core/NavigationContext';

import { ProjectsHeader } from './ProjectsHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  Briefcase,
  TrendingUp,
  BarChart3,
  Calendar,
} from 'lucide-react';
// 🏢 ENTERPRISE: All icons from centralized NAVIGATION_ENTITIES
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { ProjectViewSwitch } from './ProjectViewSwitch';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Import from canonical location (not DXF Viewer)
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createProject, deleteProject } from '@/services/projects-client.service';
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ProjectsPageContent');

export function ProjectsPageContent() {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // Note: Deep-link tab is read from useProjectsPageState (same useSearchParams instance)

  // 🏢 ENTERPRISE: Navigation context for breadcrumb sync
  const { companies, syncBreadcrumb } = useNavigation();

  // Φόρτωση έργων από Firestore αντί για sample data
  const { projects: firestoreProjects, loading, error } = useFirestoreProjects();

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
  const [searchTerm, setSearchTerm] = useState('');

  // 🏢 ENTERPRISE: Inline project creation — creates project and opens in edit mode
  const [startInEditMode, setStartInEditMode] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const handleNewProject = useCallback(async () => {
    if (isCreatingProject) return;
    setIsCreatingProject(true);

    // Get first company as default (user's company)
    const defaultCompanyId = companies[0]?.id;
    if (!defaultCompanyId) {
      logger.error('No company available for project creation');
      setIsCreatingProject(false);
      return;
    }

    const result = await createProject({
      name: '',
      companyId: defaultCompanyId,
      company: companies[0]?.companyName || '',
      status: 'planning',
    });

    if (result.success && result.projectId) {
      logger.info('Project created inline', { projectId: result.projectId });
      // Set as selected and enable edit mode — empty fields, user fills them
      const newProject: Project = {
        id: result.projectId,
        name: '',
        title: '',
        description: '',
        status: 'planning',
        companyId: defaultCompanyId,
        company: companies[0]?.companyName || '',
        address: '',
        city: '',
        location: '',
        projectCode: '',
        progress: 0,
        totalValue: 0,
        totalArea: 0,
        lastUpdate: new Date().toISOString(),
      };
      setSelectedProject(newProject);
      setStartInEditMode(true);
    }
    setIsCreatingProject(false);
  }, [companies, setSelectedProject, isCreatingProject]);

  // 🏢 ENTERPRISE: Delete project — centralized DeleteConfirmDialog (not browser confirm)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteProject = React.useCallback((project: Project) => {
    setProjectToDelete(project);
  }, []);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    const result = await deleteProject(projectToDelete.id);
    if (result.success) {
      logger.info('Project deleted', { projectId: projectToDelete.id });
      // 🏢 ENTERPRISE: Real-time update — RealtimeService dispatches PROJECT_DELETED
      // from deleteProject(), useFirestoreProjects listens and removes from list
      setSelectedProject(null);
      setProjectToDelete(null);
    } else {
      logger.error('Failed to delete project', { error: result.error });
    }
    setIsDeleting(false);
  }, [projectToDelete, setSelectedProject]);

  // 🏢 ENTERPRISE: Memoized dashboard stats — avoids array recreation on every render (INP optimization)
  const dashboardStats = useMemo<DashboardStat[]>(() => [
    {
      title: t('page.dashboard.totalProjects'),
      value: projectsStats.totalProjects,
      icon: Briefcase,
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
      <PageContainer ariaLabel={t('page.loading')} className="items-center justify-center">
        <section className="text-center" role="status" aria-live="polite">
          <AnimatedSpinner size="large" className="mx-auto mb-4" />
          <p>{t('page.loadingMessage')}</p>
        </section>
      </PageContainer>
    );
  }

  // Εμφάνιση error state
  if (error) {
    return (
      <PageContainer ariaLabel={t('page.error.pageLabel')} className="items-center justify-center">
        <section className="text-center text-red-600" role="alert" aria-label={t('page.error.ariaLabel')}>
          <p>{t('page.error.title')} {error}</p>
          <button
            onClick={() => window.location.reload()}
            className={`mt-2 px-4 py-2 bg-primary text-primary-foreground rounded ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
          >
            {t('page.error.retry')}
          </button>
        </section>
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
            projectCount={projectsStats.totalProjects}
        />

        {showDashboard && (
          <section role="region" aria-label={t('page.dashboard.label')}>
            <UnifiedDashboard stats={dashboardStats} columns={5} onCardClick={handleCardClick} />
          </section>
        )}

        {/* Advanced Filters Panel - Desktop */}
        <aside className="hidden md:block" role="complementary" aria-label={t('page.filters.desktop')}>
          <AdvancedFiltersPanel
            config={projectFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {/* Advanced Filters Panel - Mobile (conditional) */}
        {showFilters && (
          <aside className="md:hidden" role="complementary" aria-label={t('page.filters.mobile')}>
            <AdvancedFiltersPanel
              config={projectFiltersConfig}
              filters={filters}
              onFiltersChange={setFilters}
              defaultOpen
            />
          </aside>
        )}


        <ListContainer>
          <ProjectViewSwitch
            projects={filteredProjects}
            selectedProject={selectedProject}
            onSelectProject={(project) => {
              setSelectedProject(project);
              setStartInEditMode(false);
            }}
            companies={companies}
            viewMode={viewMode}
            initialTab={tabFromUrl || undefined}
            onNewProject={handleNewProject}
            onDeleteProject={handleDeleteProject}
            startInEditMode={startInEditMode}
          />
        </ListContainer>

        {/* 🏢 ENTERPRISE: Centralized delete confirmation (ADR-003) */}
        <DeleteConfirmDialog
          open={!!projectToDelete}
          onOpenChange={(open) => { if (!open) setProjectToDelete(null); }}
          title={t('detailsHeader.actions.delete')}
          description={t('detailsHeader.actions.confirmDelete', { name: projectToDelete?.name ?? '' })}
          onConfirm={handleConfirmDelete}
          loading={isDeleting}
        />
      </PageContainer>
  );
}
