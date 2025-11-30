'use client';

/**
 * Desktop Multi-Column Navigation Component
 * Finder-style multi-column layout for desktop navigation
 */

import React, { useState } from 'react';
import { NavigationButton } from './NavigationButton';
import { NavigationCardToolbar } from './NavigationCardToolbar';
import { Building, Home, Construction, Users, MapPin, Map, Car, Package, Layers, Factory } from 'lucide-react';
import { useNavigation } from '../core/NavigationContext';

interface DesktopMultiColumnProps {
  onCompanySelect: (companyId: string) => void;
  onProjectSelect: (projectId: string) => void;
  onBuildingSelect: (buildingId: string) => void;
  onFloorSelect: (floorId: string) => void;
  onNavigateToPage: (type: 'properties' | 'projects' | 'buildings' | 'floorplan') => void;
  onAddCompanyClick: () => void;
  navigationCompanyIds: string[];
}

export function DesktopMultiColumn({
  onCompanySelect,
  onProjectSelect,
  onBuildingSelect,
  onFloorSelect,
  onNavigateToPage,
  onAddCompanyClick,
  navigationCompanyIds
}: DesktopMultiColumnProps) {
  const {
    companies,
    projects,
    selectedCompany,
    selectedProject,
    selectedBuilding,
    selectedFloor,
    projectsLoading
  } = useNavigation();

  // Toolbar states for each column
  const [companiesSearch, setCompaniesSearch] = useState('');
  const [companiesFilters, setCompaniesFilters] = useState<string[]>([]);
  const [projectsSearch, setProjectsSearch] = useState('');
  const [projectsFilters, setProjectsFilters] = useState<string[]>([]);
  const [buildingsSearch, setBuildingsSearch] = useState('');
  const [buildingsFilters, setBuildingsFilters] = useState<string[]>([]);
  const [floorsSearch, setFloorsSearch] = useState('');
  const [floorsFilters, setFloorsFilters] = useState<string[]>([]);

  // Helper function to filter data based on search and filters
  const filterData = <T extends { companyName?: string; name?: string; industry?: string }>(
    data: T[],
    searchTerm: string,
    activeFilters: string[]
  ): T[] => {
    return data.filter(item => {
      // Search filter
      const searchMatch = !searchTerm ||
        (item.companyName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.name?.toLowerCase().includes(searchTerm.toLowerCase()));

      // Active filters - simplified for now
      const filterMatch = activeFilters.length === 0 || true; // TODO: implement proper filtering

      return searchMatch && filterMatch;
    });
  };

  return (
    <div className="hidden md:block">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">

        {/* Column 1: Companies */}
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Building className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-foreground">Εταιρείες</h3>
          </div>

          {/* Companies Toolbar */}
          <NavigationCardToolbar
            level="companies"
            searchTerm={companiesSearch}
            onSearchChange={setCompaniesSearch}
            activeFilters={companiesFilters}
            onFiltersChange={setCompaniesFilters}
            onNewItem={onAddCompanyClick}
            onEditItem={() => console.log('Edit company')}
            onDeleteItem={() => console.log('Delete company')}
            onRefresh={() => console.log('Refresh companies')}
            onExport={() => console.log('Export companies')}
            onImport={() => console.log('Import companies')}
            onSettings={() => console.log('Companies settings')}
            onReports={() => console.log('Companies reports')}
            onShare={() => console.log('Share companies')}
            onHelp={() => console.log('Companies help')}
          />

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filterData(companies, companiesSearch, companiesFilters).map(company => {
              // Ελέγχουμε αν η εταιρεία έχει έργα
              const companyProjects = projects.filter(p => p.companyId === company.id);
              const hasProjects = companyProjects.length > 0;

              // Ελέγχουμε αν είναι navigation company (προστέθηκε χειροκίνητα)
              const isNavigationCompany = navigationCompanyIds.includes(company.id);

              // Διαφοροποίηση ανάλογα με το αν έχει έργα ή είναι navigation company
              let subtitle = company.industry || 'Εταιρεία';
              let extraInfo: string | undefined = undefined;

              if (!hasProjects) {
                subtitle = isNavigationCompany
                  ? 'Προσθέστε έργα για αυτή την εταιρεία'
                  : 'Εταιρεία χωρίς έργα';
                extraInfo = company.vatNumber ? `ΑΦΜ: ${company.vatNumber}` : undefined;
              }

              return (
                <NavigationButton
                  key={company.id}
                  onClick={() => onCompanySelect(company.id)}
                  icon={Factory}
                  title={company.companyName}
                  subtitle={subtitle}
                  extraInfo={extraInfo}
                  isSelected={selectedCompany?.id === company.id}
                  variant="compact"
                  badgeStatus={!projectsLoading && !hasProjects ? 'no_projects' : undefined}
                  badgeText={!projectsLoading && !hasProjects ? 'Χωρίς έργα' : undefined}
                />
              );
            })}
          </div>
        </div>

        {/* Column 2: Projects */}
        {selectedCompany && (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Home className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">Έργα</h3>
            </div>

            {/* Projects Toolbar */}
            <NavigationCardToolbar
              level="projects"
              searchTerm={projectsSearch}
              onSearchChange={setProjectsSearch}
              activeFilters={projectsFilters}
              onFiltersChange={setProjectsFilters}
              onNewItem={() => console.log('New project')}
              onEditItem={() => console.log('Edit project')}
              onDeleteItem={() => console.log('Delete project')}
              onRefresh={() => console.log('Refresh projects')}
              onExport={() => console.log('Export projects')}
              onSettings={() => console.log('Projects settings')}
              onReports={() => console.log('Projects reports')}
              onShare={() => console.log('Share projects')}
              onHelp={() => console.log('Projects help')}
            />

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filterData(projects.filter(project => project.companyId === selectedCompany?.id), projectsSearch, projectsFilters).map(project => (
                <NavigationButton
                  key={project.id}
                  onClick={() => onProjectSelect(project.id)}
                  icon={Construction}
                  title={project.name}
                  subtitle={`${project.buildings.length} κτίρια`}
                  isSelected={selectedProject?.id === project.id}
                  variant="compact"
                />
              ))}
            </div>
          </div>
        )}

        {/* Column 3: Buildings */}
        {selectedProject && (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Building className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">Κτίρια</h3>
            </div>

            {/* Buildings Toolbar */}
            <NavigationCardToolbar
              level="buildings"
              searchTerm={buildingsSearch}
              onSearchChange={setBuildingsSearch}
              activeFilters={buildingsFilters}
              onFiltersChange={setBuildingsFilters}
              onNewItem={() => console.log('New building')}
              onEditItem={() => console.log('Edit building')}
              onDeleteItem={() => console.log('Delete building')}
              onRefresh={() => console.log('Refresh buildings')}
              onExport={() => console.log('Export buildings')}
              onSettings={() => console.log('Buildings settings')}
              onReports={() => console.log('Buildings reports')}
              onHelp={() => console.log('Buildings help')}
            />

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filterData(selectedProject.buildings, buildingsSearch, buildingsFilters).map(building => (
                <NavigationButton
                  key={building.id}
                  onClick={() => onBuildingSelect(building.id)}
                  icon={Building}
                  title={building.name}
                  subtitle={`${building.floors.length} όροφοι`}
                  isSelected={selectedBuilding?.id === building.id}
                  variant="compact"
                />
              ))}
            </div>
          </div>
        )}

        {/* Column 4: Floors */}
        {selectedBuilding && (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-orange-600" />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">Όροφοι</h3>
            </div>

            {/* Floors Toolbar */}
            <NavigationCardToolbar
              level="floors"
              searchTerm={floorsSearch}
              onSearchChange={setFloorsSearch}
              activeFilters={floorsFilters}
              onFiltersChange={setFloorsFilters}
              onNewItem={() => console.log('New floor')}
              onEditItem={() => console.log('Edit floor')}
              onDeleteItem={() => console.log('Delete floor')}
              onRefresh={() => console.log('Refresh floors')}
              onExport={() => console.log('Export floors')}
              onSettings={() => console.log('Floors settings')}
              onReports={() => console.log('Floors reports')}
              onHelp={() => console.log('Floors help')}
            />

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filterData(selectedBuilding.floors, floorsSearch, floorsFilters).map(floor => (
                <NavigationButton
                  key={floor.id}
                  onClick={() => onFloorSelect(floor.id)}
                  icon={Layers}
                  title={floor.name}
                  subtitle={`${floor.units.length} μονάδες`}
                  isSelected={selectedFloor?.id === floor.id}
                  variant="compact"
                />
              ))}
            </div>
          </div>
        )}

        {/* Column 5: Actions & Extras */}
        {selectedFloor && (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">Ενέργειες</h3>
            </div>
            <div className="space-y-2">
              <NavigationButton
                onClick={() => onNavigateToPage('properties')}
                icon={Home}
                title="Προβολή Μονάδων"
                subtitle={`${selectedFloor.units.length} μονάδες`}
                variant="compact"
              />

              <NavigationButton
                onClick={() => onNavigateToPage('floorplan')}
                icon={Map}
                title="Κάτοψη Ορόφου"
                subtitle="Διαδραστική προβολή"
                variant="compact"
              />

              {selectedProject && (
                <NavigationButton
                  onClick={() => onNavigateToPage('projects')}
                  icon={Construction}
                  title="Λεπτομέρειες Έργου"
                  subtitle={selectedProject.name}
                  variant="compact"
                />
              )}

              {selectedBuilding && (
                <NavigationButton
                  onClick={() => onNavigateToPage('buildings')}
                  icon={Building}
                  title="Λεπτομέρειες Κτιρίου"
                  subtitle={selectedBuilding.name}
                  variant="compact"
                />
              )}

              {/* Parking & Storage */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs font-medium text-gray-500 dark:text-muted-foreground mb-2 uppercase tracking-wide">
                  Παρκινγκ & Αποθήκες
                </div>
                <NavigationButton
                  onClick={() => console.log('Parking spots')}
                  icon={Car}
                  title="Θέσεις Στάθμευσης"
                  subtitle="Διαθέσιμες θέσεις"
                  variant="compact"
                />

                <NavigationButton
                  onClick={() => console.log('Storage units')}
                  icon={Package}
                  title="Αποθήκες"
                  subtitle="Αποθηκευτικοί χώροι"
                  variant="compact"
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default DesktopMultiColumn;