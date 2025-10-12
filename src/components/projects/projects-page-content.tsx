'use client';

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useProjectsState } from '@/hooks/useProjectsState';
import { useFilteredProjects } from '@/hooks/useFilteredProjects';
import { useFirestoreProjects } from '@/hooks/useFirestoreProjects';
import { companies } from '@/components/building-management/mockData';

import { ProjectsHeader } from './ProjectsHeader';
import { ProjectsDashboard } from './ProjectsDashboard';
import { ProjectViewSwitch } from './ProjectViewSwitch';

export function ProjectsPageContent() {
  // Φόρτωση έργων από Firestore αντί για mock data
  const { projects: firestoreProjects, loading, error } = useFirestoreProjects();
  
  const {
    projects,
    selectedProject,
    setSelectedProject,
    viewMode,
    setViewMode,
    searchTerm,
    setSearchTerm,
    filterCompany,
    setFilterCompany,
    filterStatus,
    setFilterStatus,
    showDashboard,
    setShowDashboard,
  } = useProjectsState(firestoreProjects as Project[]);

  // Πάντα καλούμε όλα τα hooks πριν από τα conditional returns
  const { filtered, stats } = useFilteredProjects(projects, searchTerm, filterCompany, filterStatus);

  // Debug logging για να δούμε τη ροή των δεδομένων
  console.log('🔍 ProjectsPageContent Debug - UPDATED:');
  console.log('  - firestoreProjects:', firestoreProjects?.length || 0, firestoreProjects);
  console.log('  - projects from useProjectsState:', projects?.length || 0, projects);
  console.log('  - filtered projects:', filtered?.length || 0, filtered);
  console.log('  - selectedProject:', selectedProject?.name || 'null');
  console.log('  - searchTerm:', searchTerm);
  console.log('  - filterCompany:', filterCompany);
  console.log('  - filterStatus:', filterStatus);
  console.log('  - loading:', loading);
  console.log('  - error:', error);

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
            filterCompany={filterCompany}
            setFilterCompany={setFilterCompany}
            companies={companies}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
        />
        
        {showDashboard && <ProjectsDashboard stats={stats} />}

        <main className="flex-1 flex overflow-hidden p-4 gap-4">
          <ProjectViewSwitch
            viewMode={viewMode}
            projects={filtered}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
            companies={companies}
          />
        </main>
      </div>
    </TooltipProvider>
  );
}
