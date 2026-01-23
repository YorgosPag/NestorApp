'use client';

import React, { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useProjectsPageState } from '@/hooks/useProjectsPageState';
import { useFirestoreProjects } from '@/hooks/useFirestoreProjects';
import { getCompanies } from '@/components/building-management/building-services';
import { AdvancedFiltersPanel, projectFiltersConfig } from '@/components/core/AdvancedFilters';
import { ListContainer, PageContainer } from '@/core/containers';
import { useProjectsStats } from '@/hooks/useProjectsStats';
import { projectsConfig } from '@/components/core/CompactToolbar';
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

export function ProjectsPageContent() {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

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

  // Transform stats to UnifiedDashboard format
  const dashboardStats: DashboardStat[] = [
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
  ];

  // 🔥 NEW: Handle dashboard card clicks για filtering
  const handleCardClick = (stat: DashboardStat, index: number) => {
    const cardTitle = stat.title;
    const totalProjectsTitle = t('page.dashboard.totalProjects');
    const activeProjectsTitle = t('page.dashboard.activeProjects');

    // Toggle filter: αν κλικάρουμε την ίδια κάρτα, αφαιρούμε το φίλτρο
    if (activeCardFilter === cardTitle) {
      setActiveCardFilter(null);
      // Reset filters to show all projects
      setFilters({ ...filters, status: [] });
    } else {
      setActiveCardFilter(cardTitle);

      // Apply filter based on card type
      switch (cardTitle) {
        case totalProjectsTitle:
          // Show all projects - reset filters
          setFilters({ ...filters, status: [] });
          break;
        case activeProjectsTitle:
          // Filter only active projects (in_progress)
          setFilters({ ...filters, status: ['in_progress'] });
          break;
        // Note: Other cards (Total Value, Total Area, Average Progress)
        // are informational and don't apply specific filters
        default:
          // For other stats, just clear active filter without changing data
          setActiveCardFilter(null);
          break;
      }

      // Clear selected project when filtering changes
      setSelectedProject(null);
    }
  };

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
    <TooltipProvider>
      <PageContainer ariaLabel={t('page.pageLabel')}>
        <ProjectsHeader
            viewMode={viewMode}
            setViewMode={setViewMode}
            showDashboard={showDashboard}
            setShowDashboard={setShowDashboard}
            onNewProject={() => console.log('Add new project')}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            projectCount={projectsStats.totalProjects} // 🏢 Enterprise count display
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
              defaultOpen={true}
            />
          </aside>
        )}


        <ListContainer>
          <ProjectViewSwitch
            projects={filteredProjects}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
            companies={companies}
            // 🏢 ENTERPRISE: Pass viewMode for grid/list switching (PR: Projects Grid View)
            viewMode={viewMode}
          />
        </ListContainer>
      </PageContainer>
    </TooltipProvider>
  );
}
