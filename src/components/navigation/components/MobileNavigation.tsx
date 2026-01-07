'use client';

/**
 * Mobile Navigation Component
 * Drill-down navigation interface for mobile devices
 *
 * 🏢 ENTERPRISE ARCHITECTURE (Επιλογή Α):
 * Floors αφαιρέθηκαν από navigation - Units συνδέονται απευθείας με Buildings
 *
 * @see navigation-entities.ts - Single Source of Truth για icons/colors
 */

import React, { useMemo } from 'react';
import { NavigationButton } from './NavigationButton';
import { ChevronLeft } from 'lucide-react';
// 🏢 ENTERPRISE: Icons/Colors από centralized config - ZERO hardcoded values
import { NAVIGATION_ENTITIES } from '../config';
import { useNavigation } from '../core/NavigationContext';
import { HOVER_TEXT_EFFECTS } from '../../ui/effects';
// 🏢 ENTERPRISE: Centralized labels - ZERO HARDCODED VALUES
import { getPriorityLabels } from '@/subapps/dxf-viewer/config/modal-select/core/labels/status';
import { getNavigationFilterCategories } from '@/subapps/dxf-viewer/config/modal-select/core/labels/navigation';

interface MobileNavigationProps {
  /** 🏢 ENTERPRISE: 'floors' αφαιρέθηκε από navigation levels (Επιλογή Α) */
  mobileLevel: 'companies' | 'projects' | 'buildings' | 'units' | 'actions' | 'extras';
  onBack: () => void;
  getTitle: () => string;
  onCompanySelect: (companyId: string) => void;
  onProjectSelect: (projectId: string) => void;
  onBuildingSelect: (buildingId: string) => void;
  /** @deprecated 🏢 ENTERPRISE: Floors αφαιρέθηκαν από navigation (Επιλογή Α) */
  onFloorSelect?: (floorId: string) => void;
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
  // 🏢 ENTERPRISE: onFloorSelect deprecated - Floors δεν είναι navigation level
  onFloorSelect: _onFloorSelect,
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
    selectedUnit,  // 🏢 ENTERPRISE: Centralized unit selection for breadcrumb
    // 🏢 ENTERPRISE: selectedFloor αφαιρέθηκε - Floors δεν είναι navigation level (Επιλογή Α)
    projectsLoading,
    selectUnit,  // 🏢 ENTERPRISE: Centralized unit selection action
    // 🏢 ENTERPRISE: Real-time building functions
    getBuildingCount,
    getBuildingsForProject,
    // 🏢 ENTERPRISE: Real-time unit functions
    getUnitCount
  } = useNavigation();

  // ==========================================================================
  // 🏢 ENTERPRISE: Memoized Real-time Buildings Data
  // ==========================================================================

  const projectBuildings = useMemo(() => {
    if (!selectedProject) return [];
    return getBuildingsForProject(selectedProject.id);
  }, [selectedProject, getBuildingsForProject]);

  /**
   * 🏢 ENTERPRISE ARCHITECTURE (Επιλογή Α):
   * Memoized units για το επιλεγμένο building.
   * Συλλέγει ΟΛΕΣ τις units από:
   * 1. ΟΛΟΥΣ τους ορόφους του building (αν υπάρχουν)
   * 2. Απευθείας από το building (αν δεν έχει ορόφους)
   * Οι όροφοι είναι δομικοί κόμβοι - δεν εμφανίζονται στην πλοήγηση.
   */
  const buildingUnits = useMemo(() => {
    if (!selectedBuilding) return [];

    // 🏢 ENTERPRISE: Combine units from floors AND direct building units
    const floorUnits = selectedBuilding.floors?.flatMap(floor => floor.units) || [];
    const directUnits = selectedBuilding.units || [];

    return [...floorUnits, ...directUnits];
  }, [selectedBuilding]);

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
                  icon={NAVIGATION_ENTITIES.company.icon}
                  iconColor={NAVIGATION_ENTITIES.company.color}
                  title={company.companyName}
                  subtitle={subtitle}
                  extraInfo={extraInfo}
                  badgeStatus={!projectsLoading && !hasProjects ? 'no_projects' : undefined}
                  badgeText={!projectsLoading && !hasProjects ? getNavigationFilterCategories().company_without_projects : undefined}
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
                  icon={NAVIGATION_ENTITIES.project.icon}
                  iconColor={NAVIGATION_ENTITIES.project.color}
                  title={project.name}
                  subtitle={`${buildingCount} κτίρια`}
                  badgeStatus={!hasBuildings ? 'no_projects' : undefined}
                  badgeText={!hasBuildings ? getNavigationFilterCategories().project_without_buildings : undefined}
                />
              );
            })}
          </>
        )}

        {/* Buildings - 🏢 ENTERPRISE: Using memoized real-time data with unit count */}
        {mobileLevel === 'buildings' && selectedProject && (
          <>
            {projectBuildings.map(building => {
              // 🏢 ENTERPRISE: Real-time unit count
              const unitCount = getUnitCount(building.id);
              const hasUnits = unitCount > 0;

              return (
                <NavigationButton
                  key={building.id}
                  onClick={() => onBuildingSelect(building.id)}
                  icon={NAVIGATION_ENTITIES.building.icon}
                  iconColor={NAVIGATION_ENTITIES.building.color}
                  title={building.name}
                  subtitle={`${unitCount} μονάδες`}
                  badgeStatus={!hasUnits ? 'no_projects' : undefined}
                  badgeText={!hasUnits ? getNavigationFilterCategories().building_without_units : undefined}
                />
              );
            })}
          </>
        )}

        {/*
         * 🏢 ENTERPRISE ARCHITECTURE DECISION (Επιλογή Α):
         * Οι Όροφοι ΔΕΝ εμφανίζονται ως level στην πλοήγηση.
         * Units συνδέονται απευθείας με Buildings.
         */}

        {/* Units - 🏢 ENTERPRISE: Απευθείας από Building (skip Floors) */}
        {mobileLevel === 'units' && selectedBuilding && (
          <>
            {buildingUnits.map(unit => (
              <NavigationButton
                key={unit.id}
                onClick={() => {
                  // 🏢 ENTERPRISE: Use centralized selectUnit for breadcrumb display
                  selectUnit({ id: unit.id, name: unit.name, type: unit.type });
                  onUnitSelect?.(unit.id);
                }}
                icon={NAVIGATION_ENTITIES.unit.icon}
                iconColor={NAVIGATION_ENTITIES.unit.color}
                title={unit.name}
                subtitle={unit.type || NAVIGATION_ENTITIES.unit.label}
                isSelected={selectedUnit?.id === unit.id}
              />
            ))}
          </>
        )}

        {/* Actions - 🏢 ENTERPRISE: Εξαρτάται από Building (skip Floors) */}
        {mobileLevel === 'actions' && selectedBuilding && (
          <nav className="space-y-3" aria-label="Ενέργειες Κτιρίου">
            <NavigationButton
              onClick={() => onNavigateToPage('properties')}
              icon={NAVIGATION_ENTITIES.unit.icon}
              iconColor={NAVIGATION_ENTITIES.unit.color}
              title="Προβολή Μονάδων"
              subtitle={`${buildingUnits.length} μονάδες στο κτίριο`}
              variant="compact"
            />

            <NavigationButton
              onClick={() => onNavigateToPage('buildings')}
              icon={NAVIGATION_ENTITIES.building.icon}
              iconColor={NAVIGATION_ENTITIES.building.color}
              title="Λεπτομέρειες Κτιρίου"
              subtitle={selectedBuilding.name}
              variant="compact"
            />

            {selectedProject && (
              <NavigationButton
                onClick={() => onNavigateToPage('projects')}
                icon={NAVIGATION_ENTITIES.project.icon}
                iconColor={NAVIGATION_ENTITIES.project.color}
                title="Λεπτομέρειες Έργου"
                subtitle={selectedProject.name}
                variant="compact"
              />
            )}
          </nav>
        )}
      </div>
    </div>
  );
}

export default MobileNavigation;