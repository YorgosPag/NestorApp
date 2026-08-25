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
// 🏢 ENTERPRISE: μία απάντηση για τις δύο οθόνες πλοήγησης — δες το ίδιο το module
// για το τι έκρυβαν τα δύο αντίγραφα (ωμά κλειδιά i18n, λάθος κλειδί, δύο ΑΦΜ).
import {
  describeNavigationCompany,
  describeNavigationProject,
  describeNavigationBuilding,
  buildBuildingActionDescriptors,
} from '../core/utils/navigation-item-descriptors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

interface MobileNavigationProps {
  /** 🏢 ENTERPRISE: 'floors' αφαιρέθηκε από navigation levels (Επιλογή Α) */
  mobileLevel: 'companies' | 'projects' | 'buildings' | 'properties' | 'actions' | 'extras';
  onBack: () => void;
  getTitle: () => string;
  onCompanySelect: (companyId: string) => void;
  onProjectSelect: (projectId: string) => void;
  onBuildingSelect: (buildingId: string) => void;
  /** @deprecated 🏢 ENTERPRISE: Floors αφαιρέθηκαν από navigation (Επιλογή Α) */
  onFloorSelect?: (floorId: string) => void;
  onPropertySelect?: (propertyId: string) => void;
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
  onPropertySelect,
  onNavigateToPage,
  navigationCompanyIds
}: MobileNavigationProps) {
  const {
    companies,
    projects,
    selectedCompany,
    selectedProject,
    selectedBuilding,
    selectedProperty,  // 🏢 ENTERPRISE: Centralized unit selection for breadcrumb
    // 🏢 ENTERPRISE: selectedFloor αφαιρέθηκε - Floors δεν είναι navigation level (Επιλογή Α)
    projectsLoading,
    selectProperty,  // 🏢 ENTERPRISE: Centralized unit selection action
    // 🏢 ENTERPRISE: Real-time building functions
    getBuildingCount,
    getBuildingsForProject,
    // 🏢 ENTERPRISE: Real-time unit functions
    getPropertyCount
  } = useNavigation();

  // 🏢 ENTERPRISE: i18n hook
  //
  // ⚠️ ΔΥΟ namespaces, και το δεύτερο ΔΕΝ είναι διακοσμητικό: οι ετικέτες των
  // badge ζουν στο `navigation-entities`. Χωρίς αυτό, το `t('navigation-entities:…')`
  // αστοχεί — και επειδή το `config.ts` δεν ορίζει `fallbackNS`, η αστοχία
  // καταλήγει **ωμό κλειδί στην οθόνη** αντί για σφάλμα.
  const { t } = useTranslation(['navigation', 'navigation-entities']);

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
  const buildingProperties = useMemo(() => {
    if (!selectedBuilding) return [];

    // 🏢 ENTERPRISE: Combine properties from floors AND direct building properties
    const floorProperties = selectedBuilding.floors?.flatMap(floor => floor.properties) || [];
    const directProperties = selectedBuilding.properties || [];

    return [...floorProperties, ...directProperties];
  }, [selectedBuilding]);

  return (
    <div className="md:hidden">
      {/* Mobile Header */}
      <div className="flex items-center justify-between mb-4">
        {mobileLevel !== 'companies' && (
          <button
            onClick={onBack}
            className={`flex items-center gap-2 px-3 py-2 text-primary ${HOVER_TEXT_EFFECTS.BLUE}`}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('mobile.back')}
          </button>
        )}
        <h3 className="text-lg font-semibold text-foreground">
          {getTitle()}
        </h3>
        <div className="w-16" /> {/* Spacer */}
      </div>

      {/* Mobile Content */}
      <div className="space-y-2">
        {/* Companies */}
        {mobileLevel === 'companies' && (
          <>
            {companies.map(company => {
              const descriptor = describeNavigationCompany({
                company,
                hasProjects: projects.some(p => p.companyId === company.id),
                isNavigationCompany: navigationCompanyIds.includes(company.id),
                projectsLoading,
                t,
              });

              return (
                <NavigationButton
                  key={company.id}
                  onClick={() => onCompanySelect(company.id)}
                  {...descriptor}
                />
              );
            })}
          </>
        )}

        {/* Projects - 🏢 ENTERPRISE: Using real-time building counts */}
        {mobileLevel === 'projects' && selectedCompany && (
          <>
            {projects.filter(project => project.linkedCompanyId === selectedCompany.id).map(project => (
              <NavigationButton
                key={project.id}
                onClick={() => onProjectSelect(project.id)}
                // 🏢 ENTERPRISE: Real-time building count
                {...describeNavigationProject({ project, buildingCount: getBuildingCount(project.id), t })}
              />
            ))}
          </>
        )}

        {/* Buildings - 🏢 ENTERPRISE: Using memoized real-time data with unit count */}
        {mobileLevel === 'buildings' && selectedProject && (
          <>
            {projectBuildings.map(building => (
              <NavigationButton
                key={building.id}
                onClick={() => onBuildingSelect(building.id)}
                // 🏢 ENTERPRISE: Real-time unit count
                {...describeNavigationBuilding({ building, propertyCount: getPropertyCount(building.id), t })}
              />
            ))}
          </>
        )}

        {/*
         * 🏢 ENTERPRISE ARCHITECTURE DECISION (Επιλογή Α):
         * Οι Όροφοι ΔΕΝ εμφανίζονται ως level στην πλοήγηση.
         * Units συνδέονται απευθείας με Buildings.
         */}

        {/* Units - 🏢 ENTERPRISE: Απευθείας από Building (skip Floors) */}
        {mobileLevel === 'properties' && selectedBuilding && (
          <>
            {buildingProperties.map(unit => (
              <NavigationButton
                key={unit.id}
                onClick={() => {
                  // 🏢 ENTERPRISE: Use centralized selectProperty for breadcrumb display
                  selectProperty({ id: unit.id, name: unit.name, type: unit.type });
                  onPropertySelect?.(unit.id);
                }}
                icon={NAVIGATION_ENTITIES.property.icon}
                iconColor={NAVIGATION_ENTITIES.property.color}
                title={unit.name}
                subtitle={unit.type || NAVIGATION_ENTITIES.property.label}
                isSelected={selectedProperty?.id === unit.id}
              />
            ))}
          </>
        )}

        {/* Actions - 🏢 ENTERPRISE: Εξαρτάται από Building (skip Floors) */}
        {mobileLevel === 'actions' && selectedBuilding && (
          <nav className="space-y-3" aria-label={t('mobile.actionsLabel')}>
            {buildBuildingActionDescriptors({
              selectedBuilding,
              selectedProject,
              propertyCount: buildingProperties.length,
              t,
            }).map(action => (
              <NavigationButton
                key={action.key}
                onClick={() => onNavigateToPage(action.page)}
                icon={action.icon}
                iconColor={action.iconColor}
                title={action.title}
                subtitle={action.subtitle}
                variant="compact"
              />
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}

export default MobileNavigation;