'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useProjectsPageState } from '@/hooks/useProjectsPageState';
import { useFirestoreProjects } from '@/hooks/useFirestoreProjects';
import { companies } from '@/components/building-management/mockData';
import { AdvancedFiltersPanel, projectFiltersConfig } from '@/components/core/AdvancedFilters';
import { useProjectsStats } from '@/hooks/useProjectsStats';

import { ProjectsHeader } from './ProjectsHeader';
import { UnifiedDashboard, type DashboardStat } from '@/core/dashboards/UnifiedDashboard';
import {
  Briefcase,
  TrendingUp,
  BarChart3,
  Ruler,
  Calendar,
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
        />
        
        {showDashboard && <UnifiedDashboard stats={dashboardStats} columns={5} />}

        {/* Advanced Filters Panel */}
        <AdvancedFiltersPanel
          config={projectFiltersConfig}
          filters={filters}
          onFiltersChange={setFilters}
        />

        <main className="flex-1 flex overflow-x-auto overflow-y-hidden p-4 gap-4">
          <ProjectViewSwitch
            projects={filteredProjects}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
            companies={companies}
          />
        </main>
      </div>
    </TooltipProvider>
  );
}
