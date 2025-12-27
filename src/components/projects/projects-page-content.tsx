'use client';

import React, { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useProjectsPageState } from '@/hooks/useProjectsPageState';
import { useFirestoreProjects } from '@/hooks/useFirestoreProjects';
import { getCompanies } from '@/components/building-management/building-services';
import { AdvancedFiltersPanel, projectFiltersConfig } from '@/components/core/AdvancedFilters';
import { ListContainer } from '@/core/containers';
import { useProjectsStats } from '@/hooks/useProjectsStats';
import { projectsConfig } from '@/components/core/CompactToolbar';

import { ProjectsHeader } from './ProjectsHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  Briefcase,
  TrendingUp,
  BarChart3,
  Ruler,
  Calendar,
  Building2,
  Plus,
  Edit,
  Trash2,
  Archive,
} from 'lucide-react';
import { ProjectViewSwitch } from './ProjectViewSwitch';
import { useIconSizes } from '@/hooks/useIconSizes';
import { AnimatedSpinner } from '@/subapps/dxf-viewer/components/modal/ModalLoadingStates';

export function ProjectsPageContent() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
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

  // 🔥 NEW: Dashboard card filtering state
  const [activeCardFilter, setActiveCardFilter] = React.useState<string | null>(null);

  // Mobile-only states
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Transform stats to UnifiedDashboard format
  const dashboardStats: DashboardStat[] = [
    {
      title: "Σύνολο Έργων",
      value: projectsStats.totalProjects,
      icon: Briefcase,
      color: "blue"
    },
    {
      title: "Ενεργά Έργα",
      value: projectsStats.activeProjects,
      icon: TrendingUp,
      color: "green"
    },
    {
      title: "Συνολική Αξία",
      value: `€${(projectsStats.totalValue / 1000000).toFixed(1)}M`,
      icon: BarChart3,
      color: "purple"
    },
    {
      title: "Συνολική Επιφάνεια",
      value: `${(projectsStats.totalArea / 1000).toFixed(1)}K m²`,
      icon: Ruler,
      color: "orange"
    },
    {
      title: "Μέση Πρόοδος",
      value: `${projectsStats.averageProgress}%`,
      icon: Calendar,
      color: "cyan"
    }
  ];

  // 🔥 NEW: Handle dashboard card clicks για filtering
  const handleCardClick = (stat: DashboardStat, index: number) => {
    const cardTitle = stat.title;

    // Toggle filter: αν κλικάρουμε την ίδια κάρτα, αφαιρούμε το φίλτρο
    if (activeCardFilter === cardTitle) {
      setActiveCardFilter(null);
      // Reset filters to show all projects
      setFilters({ ...filters, status: [] });
    } else {
      setActiveCardFilter(cardTitle);

      // Apply filter based on card type
      switch (cardTitle) {
        case 'Σύνολο Έργων':
          // Show all projects - reset filters
          setFilters({ ...filters, status: [] });
          break;
        case 'Ενεργά Έργα':
          // Filter only active projects (in_progress)
          setFilters({ ...filters, status: ['in_progress'] });
          break;
        // Note: Other cards (Συνολική Αξία, Συνολική Επιφάνεια, Μέση Πρόοδος)
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
      <main className="h-full flex items-center justify-center" role="main" aria-label="Φόρτωση Έργων">
        <section className="text-center" role="status" aria-live="polite">
          <AnimatedSpinner size="large" className="mx-auto mb-4" />
          <p>Φόρτωση έργων από βάση δεδομένων...</p>
        </section>
      </main>
    );
  }

  // Εμφάνιση error state
  if (error) {
    return (
      <main className="h-full flex items-center justify-center" role="main" aria-label="Σφάλμα Έργων">
        <section className="text-center text-red-600" role="alert" aria-label="Σφάλμα Φόρτωσης">
          <p>Σφάλμα φόρτωσης έργων: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className={`mt-2 px-4 py-2 bg-primary text-primary-foreground rounded ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
          >
            Δοκιμή ξανά
          </button>
        </section>
      </main>
    );
  }
  
  return (
    <TooltipProvider>
      <main className={`h-full flex flex-col ${colors.bg.primary}`} role="main" aria-label="Διαχείριση Έργων">
        <ProjectsHeader
            viewMode={viewMode}
            setViewMode={setViewMode}
            showDashboard={showDashboard}
            setShowDashboard={setShowDashboard}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onNewProject={() => console.log('Add new project')}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            projectCount={projectsStats.totalProjects} // 🏢 Enterprise count display
        />

        {showDashboard && (
          <section role="region" aria-label="Στατιστικά Έργων">
            <UnifiedDashboard stats={dashboardStats} columns={5} onCardClick={handleCardClick} />
          </section>
        )}

        {/* Advanced Filters Panel - Desktop */}
        <aside className="hidden md:block" role="complementary" aria-label="Φίλτρα Έργων">
          <AdvancedFiltersPanel
            config={projectFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {/* Advanced Filters Panel - Mobile (conditional) */}
        {showFilters && (
          <aside className="md:hidden" role="complementary" aria-label="Φίλτρα Έργων Mobile">
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
          />
        </ListContainer>
      </main>
    </TooltipProvider>
  );
}
