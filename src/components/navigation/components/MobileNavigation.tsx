'use client';

/**
 * Mobile Navigation Component
 * Drill-down navigation interface for mobile devices
 */

import React from 'react';
import { NavigationButton } from './NavigationButton';
import { ChevronLeft, Factory, Construction, Building, Layers, Home, Map, Car, Package } from 'lucide-react';
import { useNavigation } from '../core/NavigationContext';
import { HOVER_TEXT_EFFECTS } from '../../ui/effects';

interface MobileNavigationProps {
  mobileLevel: 'companies' | 'projects' | 'buildings' | 'floors' | 'units' | 'actions' | 'extras';
  onBack: () => void;
  getTitle: () => string;
  onCompanySelect: (companyId: string) => void;
  onProjectSelect: (projectId: string) => void;
  onBuildingSelect: (buildingId: string) => void;
  onFloorSelect: (floorId: string) => void;
  onUnitSelect?: (unitId: string) => void;
  onNavigateToPage: (type: 'properties' | 'projects' | 'buildings' | 'floorplan') => void;
  navigationCompanyIds: string[];
}

export function MobileNavigation({
  mobileLevel,
  onBack,
  getTitle,
  onCompanySelect,
  onProjectSelect,
  onBuildingSelect,
  onFloorSelect,
  onUnitSelect,
  onNavigateToPage,
  navigationCompanyIds
}: MobileNavigationProps) {
  const {
    companies,
    projects,
    selectedCompany,
    selectedProject,
    selectedBuilding,
    selectedFloor,
    projectsLoading,
    // 🏢 ENTERPRISE: Real-time building functions
    getBuildingCount,
    getBuildingsForProject
  } = useNavigation();

  return (
    <div className="md:hidden">
      {/* Mobile Header */}
      <div className="flex items-center justify-between mb-4">
        {mobileLevel !== 'companies' && (
          <button
            onClick={onBack}
            className={`flex items-center gap-2 px-3 py-2 text-blue-600 ${HOVER_TEXT_EFFECTS.BLUE}`}
          >
            <ChevronLeft className="h-4 w-4" />
            Πίσω
          </button>
        )}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground">
          {getTitle()}
        </h3>
        <div className="w-16"></div> {/* Spacer */}
      </div>

      {/* Mobile Content */}
      <div className="space-y-2">
        {/* Companies */}
        {mobileLevel === 'companies' && (
          <>
            {companies.map(company => {
              // Ελέγχουμε αν η εταιρεία έχει έργα
              const companyProjects = projects.filter(p => p.companyId === company.id);
              const hasProjects = companyProjects.length > 0;

              // Ελέγχουμε αν είναι navigation company (προστέθηκε χειροκίνητα)
              const isNavigationCompany = navigationCompanyIds.includes(company.id);

              // Διαφοροποίηση ανάλογα με το αν έχει έργα ή είναι navigation company
              let subtitle = company.industry || 'Εταιρεία';
              let extraInfo = company.vatNumber ? `ΑΦΜ: ${company.vatNumber}` : undefined;

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
                  badgeStatus={!projectsLoading && !hasProjects ? 'no_projects' : undefined}
                  badgeText={!projectsLoading && !hasProjects ? 'Χωρίς έργα' : undefined}
                />
              );
            })}
          </>
        )}

        {/* Projects - 🏢 ENTERPRISE: Using real-time building counts */}
        {mobileLevel === 'projects' && selectedCompany && (
          <>
            {projects.filter(project => project.companyId === selectedCompany.id).map(project => {
              // 🏢 ENTERPRISE: Real-time building count
              const buildingCount = getBuildingCount(project.id);
              const hasBuildings = buildingCount > 0;

              return (
                <NavigationButton
                  key={project.id}
                  onClick={() => onProjectSelect(project.id)}
                  icon={Construction}
                  title={project.name}
                  subtitle={`${buildingCount} κτίρια`}
                  badgeStatus={!hasBuildings ? 'no_projects' : undefined}
                  badgeText={!hasBuildings ? 'Χωρίς κτίρια' : undefined}
                />
              );
            })}
          </>
        )}

        {/* Buildings - 🏢 ENTERPRISE: Using real-time data */}
        {mobileLevel === 'buildings' && selectedProject && (
          <>
            {getBuildingsForProject(selectedProject.id).map(building => {
              // 🏢 ENTERPRISE: floors is a number from real-time
              const floorsCount = typeof building.floors === 'number' ? building.floors : 0;
              const hasFloors = floorsCount > 0;

              return (
                <NavigationButton
                  key={building.id}
                  onClick={() => onBuildingSelect(building.id)}
                  icon={Building}
                  title={building.name}
                  subtitle={`${floorsCount} όροφοι`}
                  badgeStatus={!hasFloors ? 'no_projects' : undefined}
                  badgeText={!hasFloors ? 'Χωρίς ορόφους' : undefined}
                />
              );
            })}
          </>
        )}

        {/* Floors */}
        {mobileLevel === 'floors' && selectedBuilding && (
          <>
            {selectedBuilding.floors.map(floor => {
              // Ελέγχουμε αν ο όροφος έχει μονάδες
              const hasUnits = floor.units.length > 0;

              return (
                <NavigationButton
                  key={floor.id}
                  onClick={() => onFloorSelect(floor.id)}
                  icon={Layers}
                  title={floor.name}
                  subtitle={`${floor.units.length} μονάδες`}
                  badgeStatus={!hasUnits ? 'no_projects' : undefined}
                  badgeText={!hasUnits ? 'Χωρίς μονάδες' : undefined}
                />
              );
            })}
          </>
        )}

        {/* Units */}
        {mobileLevel === 'units' && selectedFloor && (
          <>
            {selectedFloor.units.map(unit => (
              <NavigationButton
                key={unit.id}
                onClick={() => onUnitSelect?.(unit.id)}
                icon={Home}
                title={unit.name}
                subtitle={unit.type || 'Μονάδα'}
              />
            ))}
          </>
        )}

        {/* Actions */}
        {mobileLevel === 'actions' && selectedFloor && (
          <div className="space-y-3">
            <NavigationButton
              onClick={() => onNavigateToPage('properties')}
              icon={Home}
              title="Προβολή Μονάδων"
              subtitle={`${selectedFloor.units.length} μονάδες σε αυτόν τον όροφο`}
              variant="compact"
            />

            <NavigationButton
              onClick={() => onNavigateToPage('floorplan')}
              icon={Map}
              title="Κάτοψη Ορόφου"
              subtitle="Προβολή της κάτοψης με όλες τις μονάδες"
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
          </div>
        )}
      </div>
    </div>
  );
}

export default MobileNavigation;