'use client';

/**
 * Adaptive Multi-Column Navigation Component
 * Desktop: Multi-column layout (Finder-style)
 * Mobile: Drill-down navigation with back stack
 */
import React, { useState } from 'react';
import { useNavigation } from '../core/NavigationContext';
import { NavigationButton } from './NavigationButton';
import { ChevronLeft, ChevronRight, MapPin, Home, Building, Users, Package, Car } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AdaptiveMultiColumnNavigationProps {
  className?: string;
}

export function AdaptiveMultiColumnNavigation({ className }: AdaptiveMultiColumnNavigationProps) {
  const router = useRouter();
  const {
    companies,
    selectedCompany,
    projects,
    selectedProject,
    selectedBuilding,
    selectedFloor,
    currentLevel,
    loading,
    error,
    selectCompany,
    selectProject,
    selectBuilding,
    selectFloor,
    navigateToLevel,
    navigateToExistingPages
  } = useNavigation();

  // Mobile navigation stack
  const [mobileLevel, setMobileLevel] = useState<'companies' | 'projects' | 'buildings' | 'floors' | 'units' | 'extras'>('companies');

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Navigation handlers
  const handleCompanySelect = (companyId: string) => {
    selectCompany(companyId);
    if (isMobile) setMobileLevel('projects');
  };

  const handleProjectSelect = (projectId: string) => {
    selectProject(projectId);
    if (isMobile) setMobileLevel('buildings');
  };

  const handleBuildingSelect = (buildingId: string) => {
    selectBuilding(buildingId);
    if (isMobile) setMobileLevel('floors');
  };

  const handleFloorSelect = (floorId: string) => {
    selectFloor(floorId);
    if (isMobile) setMobileLevel('units');
  };

  const handleNavigateToPage = (type: 'properties' | 'projects' | 'buildings' | 'floorplan') => {
    navigateToExistingPages(type);
  };

  // Mobile back navigation
  const handleMobileBack = () => {
    switch (mobileLevel) {
      case 'projects':
        setMobileLevel('companies');
        break;
      case 'buildings':
        setMobileLevel('projects');
        break;
      case 'floors':
        setMobileLevel('buildings');
        break;
      case 'units':
        setMobileLevel('floors');
        break;
      case 'extras':
        setMobileLevel('units');
        break;
    }
  };

  // Get current title for mobile
  const getMobileTitle = () => {
    switch (mobileLevel) {
      case 'companies': return 'Εταιρείες';
      case 'projects': return selectedCompany?.companyName || 'Έργα';
      case 'buildings': return selectedProject?.name || 'Κτίρια';
      case 'floors': return selectedBuilding?.name || 'Όροφοι';
      case 'units': return selectedFloor?.name || 'Μονάδες';
      case 'extras': return 'Παρκινγκ & Αποθήκες';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 dark:text-red-400 mb-4">Σφάλμα: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          Ξαναδοκιμή
        </button>
      </div>
    );
  }

  return (
    <div className={`${className || ''}`}>
      {/* Mobile Navigation */}
      <div className="md:hidden">
        {/* Mobile Header */}
        <div className="flex items-center justify-between mb-4">
          {mobileLevel !== 'companies' && (
            <button
              onClick={handleMobileBack}
              className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:text-blue-700"
            >
              <ChevronLeft className="h-4 w-4" />
              Πίσω
            </button>
          )}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground">
            {getMobileTitle()}
          </h3>
          <div className="w-16"></div> {/* Spacer */}
        </div>

        {/* Mobile Content */}
        <div className="space-y-2">
          {/* Companies */}
          {mobileLevel === 'companies' && (
            <>
              {companies.map(company => (
                <NavigationButton
                  key={company.id}
                  onClick={() => handleCompanySelect(company.id)}
                  icon="🏢"
                  title={company.companyName}
                  subtitle={company.industry}
                  extraInfo={company.vatNumber ? `ΑΦΜ: ${company.vatNumber}` : undefined}
                />
              ))}
            </>
          )}

          {/* Projects */}
          {mobileLevel === 'projects' && selectedCompany && (
            <>
              {projects.map(project => (
                <NavigationButton
                  key={project.id}
                  onClick={() => handleProjectSelect(project.id)}
                  icon="🏗️"
                  title={project.name}
                  subtitle={`${project.buildings.length} κτίρια`}
                />
              ))}
            </>
          )}

          {/* Buildings */}
          {mobileLevel === 'buildings' && selectedProject && (
            <>
              {selectedProject.buildings.map(building => (
                <NavigationButton
                  key={building.id}
                  onClick={() => handleBuildingSelect(building.id)}
                  icon="🏠"
                  title={building.name}
                  subtitle={`${building.floors.length} όροφοι`}
                />
              ))}
            </>
          )}

          {/* Floors */}
          {mobileLevel === 'floors' && selectedBuilding && (
            <>
              {selectedBuilding.floors.map(floor => (
                <NavigationButton
                  key={floor.id}
                  onClick={() => handleFloorSelect(floor.id)}
                  icon="🏠"
                  title={floor.name}
                  subtitle={`${floor.units.length} μονάδες`}
                />
              ))}
            </>
          )}

          {/* Units & Actions */}
          {mobileLevel === 'units' && selectedFloor && (
            <div className="space-y-3">
              <NavigationButton
                onClick={() => handleNavigateToPage('properties')}
                icon="🏡"
                title="Προβολή Μονάδων"
                subtitle={`${selectedFloor.units.length} μονάδες σε αυτόν τον όροφο`}
                variant="compact"
              />

              <NavigationButton
                onClick={() => handleNavigateToPage('floorplan')}
                icon="🗺️"
                title="Κάτοψη Ορόφου"
                subtitle="Προβολή της κάτοψης με όλες τις μονάδες"
                variant="compact"
              />

              {selectedProject && (
                <NavigationButton
                  onClick={() => handleNavigateToPage('projects')}
                  icon="🏗️"
                  title="Λεπτομέρειες Έργου"
                  subtitle={selectedProject.name}
                  variant="compact"
                />
              )}

              {selectedBuilding && (
                <NavigationButton
                  onClick={() => handleNavigateToPage('buildings')}
                  icon="🏠"
                  title="Λεπτομέρειες Κτιρίου"
                  subtitle={selectedBuilding.name}
                  variant="compact"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Multi-Column Navigation */}
      <div className="hidden md:block">
        <div className="flex gap-6 overflow-x-auto pb-4 min-w-full">

          {/* Column 1: Companies */}
          <div className="flex-shrink-0 w-80 bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <Building className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900 dark:text-foreground">Εταιρείες</h3>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {companies.map(company => (
                <NavigationButton
                  key={company.id}
                  onClick={() => handleCompanySelect(company.id)}
                  icon="🏢"
                  title={company.companyName}
                  subtitle={company.industry}
                  isSelected={selectedCompany?.id === company.id}
                  variant="compact"
                />
              ))}
            </div>
          </div>

          {/* Column 2: Projects */}
          {selectedCompany && (
            <div className="flex-shrink-0 w-80 bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Home className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-gray-900 dark:text-foreground">Έργα</h3>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {projects.map(project => (
                  <NavigationButton
                    key={project.id}
                    onClick={() => handleProjectSelect(project.id)}
                    icon="🏗️"
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
            <div className="flex-shrink-0 w-80 bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Building className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-gray-900 dark:text-foreground">Κτίρια</h3>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedProject.buildings.map(building => (
                  <NavigationButton
                    key={building.id}
                    onClick={() => handleBuildingSelect(building.id)}
                    icon="🏠"
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
            <div className="flex-shrink-0 w-80 bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900 dark:text-foreground">Όροφοι</h3>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedBuilding.floors.map(floor => (
                  <NavigationButton
                    key={floor.id}
                    onClick={() => handleFloorSelect(floor.id)}
                    icon="🏠"
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
            <div className="flex-shrink-0 w-80 bg-white dark:bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-gray-900 dark:text-foreground">Ενέργειες</h3>
              </div>
              <div className="space-y-2">
                <NavigationButton
                  onClick={() => handleNavigateToPage('properties')}
                  icon="🏡"
                  title="Προβολή Μονάδων"
                  subtitle={`${selectedFloor.units.length} μονάδες`}
                  variant="compact"
                />

                <NavigationButton
                  onClick={() => handleNavigateToPage('floorplan')}
                  icon="🗺️"
                  title="Κάτοψη Ορόφου"
                  subtitle="Διαδραστική προβολή"
                  variant="compact"
                />

                {selectedProject && (
                  <NavigationButton
                    onClick={() => handleNavigateToPage('projects')}
                    icon="🏗️"
                    title="Λεπτομέρειες Έργου"
                    subtitle={selectedProject.name}
                    variant="compact"
                  />
                )}

                {selectedBuilding && (
                  <NavigationButton
                    onClick={() => handleNavigateToPage('buildings')}
                    icon="🏠"
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
                    icon="🚗"
                    title="Θέσεις Στάθμευσης"
                    subtitle="Διαθέσιμες θέσεις"
                    variant="compact"
                  />

                  <NavigationButton
                    onClick={() => console.log('Storage units')}
                    icon="📦"
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
    </div>
  );
}

export default AdaptiveMultiColumnNavigation;