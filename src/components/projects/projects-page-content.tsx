'use client';

import React, { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useProjectsPageState } from '@/hooks/useProjectsPageState';
import { useFirestoreProjects } from '@/hooks/useFirestoreProjects';
import { getCompanies } from '@/components/building-management/building-services';
import { AdvancedFiltersPanel, projectFiltersConfig } from '@/components/core/AdvancedFilters';
import { ListContainer } from '@/core/containers';
import { useProjectsStats } from '@/hooks/useProjectsStats';
import { projectsConfig } from '@/components/core/CompactToolbar';

import { ProjectsHeader } from './ProjectsHeader';
import { UnifiedDashboard, type DashboardStat } from '@/core/dashboards/UnifiedDashboard';
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

export function ProjectsPageContent() {
  // Φόρτωση έργων από Firestore αντί για mock data
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
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Φόρτωση έργων από βάση δεδομένων...</p>
        </div>
      </div>
    );
  }

  // Εμφάνιση error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-red-600">
          <p>Σφάλμα φόρτωσης έργων: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Δοκιμή ξανά
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-background">
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
        />
        
        {showDashboard && <UnifiedDashboard stats={dashboardStats} columns={5} onCardClick={handleCardClick} />}

        {/* Advanced Filters Panel - Desktop */}
        <div className="hidden md:block">
          <AdvancedFiltersPanel
            config={projectFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>

        {/* Advanced Filters Panel - Mobile (conditional) */}
        {showFilters && (
          <div className="md:hidden">
            <AdvancedFiltersPanel
              config={projectFiltersConfig}
              filters={filters}
              onFiltersChange={setFilters}
              defaultOpen={true}
            />
          </div>
        )}


        <ListContainer>
          <ProjectViewSwitch
            projects={filteredProjects}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
            companies={companies}
          />
        </ListContainer>
      </div>
    </TooltipProvider>
  );
}
