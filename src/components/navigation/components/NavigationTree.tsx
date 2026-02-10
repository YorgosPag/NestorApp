'use client';

/**
 * Centralized Navigation Tree Component
 * Main navigation interface with hierarchical structure
 *
 * 🏢 ENTERPRISE ARCHITECTURE (Επιλογή Α):
 * Floors αφαιρέθηκαν από navigation - Units συνδέονται απευθείας με Buildings
 */
import React, { useMemo } from 'react';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';
import { useNavigation } from '../core/NavigationContext';
// 🏢 ENTERPRISE: Icons/Colors από centralized config - ZERO hardcoded values
import { NAVIGATION_ENTITIES } from '../config';
import { NavigationButton } from './NavigationButton';
import { NavigationBreadcrumb } from './NavigationBreadcrumb';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface NavigationTreeProps {
  className?: string;
  onNavigateToPage?: (type: 'properties' | 'projects' | 'buildings' | 'floorplan') => void;
}

export function NavigationTree({ className, onNavigateToPage }: NavigationTreeProps) {
  const {
    companies,
    selectedCompany,
    projects,
    selectedProject,
    selectedBuilding,
    // 🏢 ENTERPRISE: selectedFloor αφαιρέθηκε - Floors δεν είναι navigation level (Επιλογή Α)
    currentLevel,
    loading,
    error,
    loadCompanies,
    selectCompany,
    selectProject,
    selectBuilding,
    // 🏢 ENTERPRISE: selectFloor αφαιρέθηκε - Floors δεν είναι navigation level (Επιλογή Α)
    navigateToExistingPages,
    // 🏢 ENTERPRISE: Real-time building functions
    getBuildingCount,
    getBuildingsForProject
  } = useNavigation();

  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('navigation');

  /**
   * 🏢 ENTERPRISE (Επιλογή Α): Τίτλοι χωρίς 'floors' level - i18n aware
   */
  const getStepTitle = () => {
    return t(`tree.steps.${currentLevel}`, t('tree.steps.default'));
  };

  /**
   * 🏢 ENTERPRISE (Επιλογή Α): Περιγραφές χωρίς 'floors' level - i18n aware
   */
  const getStepDescription = () => {
    return t(`tree.descriptions.${currentLevel}`, t('tree.descriptions.default'));
  };

  const handleNavigateToPage = (type: 'properties' | 'projects' | 'buildings' | 'floorplan') => {
    if (onNavigateToPage) {
      onNavigateToPage(type);
    } else {
      navigateToExistingPages(type);
    }
  };

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

  if (loading) {
    return (
      <div className={`text-center py-8 ${className || ''}`}>
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500 dark:text-muted-foreground">{t('tree.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className || ''}`}>
        <p className="text-red-500 dark:text-red-400 mb-4">{t('tree.errorMessage', { error })}</p>
        <button
          onClick={loadCompanies}
          className={cn(
            "px-4 py-2 bg-blue-600 text-white rounded-lg",
            HOVER_BACKGROUND_EFFECTS.BLUE
          )}
        >
          {t('tree.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className={className || ''}>
      {/* Title */}
      <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-2">
        {getStepTitle()}
      </h3>
      <p className="text-gray-500 dark:text-muted-foreground mb-4 text-sm">
        {getStepDescription()}
      </p>

      {/* Breadcrumb */}
      <NavigationBreadcrumb className="mb-6" />

      {/* Content */}
      <div className="space-y-2 max-h-96 overflow-y-auto">

        {/* Companies */}
        {currentLevel === 'companies' && (
          <>
            {companies.length === 0 ? (
              <div className="text-gray-500 dark:text-muted-foreground text-center py-8">
                {t('tree.empty.companies')}
              </div>
            ) : (
              companies.map(company => (
                <NavigationButton
                  key={company.id}
                  onClick={() => selectCompany(company.id)}
                  icon={NAVIGATION_ENTITIES.company.icon}
                  iconColor={NAVIGATION_ENTITIES.company.color}
                  title={company.companyName}
                  subtitle={company.industry}
                  extraInfo={company.vatNumber ? t('tree.vatNumber', { vatNumber: company.vatNumber }) : undefined}
                  isSelected={selectedCompany?.id === company.id}
                />
              ))
            )}
          </>
        )}

        {/* Projects */}
        {currentLevel === 'projects' && selectedCompany && (
          <>
            {projects.length === 0 ? (
              <div className="text-gray-500 dark:text-muted-foreground text-center py-8">
                {t('tree.empty.projects')}
              </div>
            ) : (
              projects.map(project => (
                <NavigationButton
                  key={project.id}
                  onClick={() => selectProject(project.id)}
                  icon={NAVIGATION_ENTITIES.project.icon}
                  iconColor={NAVIGATION_ENTITIES.project.color}
                  title={project.name}
                  subtitle={t('tree.buildingCount', { count: getBuildingCount(project.id) })}
                  isSelected={selectedProject?.id === project.id}
                />
              ))
            )}
          </>
        )}

        {/* Buildings - 🏢 ENTERPRISE: Using memoized real-time data */}
        {currentLevel === 'buildings' && selectedProject && (
          <>
            {projectBuildings.length === 0 ? (
              <div className="text-gray-500 dark:text-muted-foreground text-center py-8">
                {t('tree.empty.buildings')}
              </div>
            ) : (
              /* 🏢 ENTERPRISE: Buildings display without floor count (Επιλογή Α) */
              projectBuildings.map(building => (
                <NavigationButton
                  key={building.id}
                  onClick={() => selectBuilding(building.id)}
                  icon={NAVIGATION_ENTITIES.building.icon}
                  iconColor={NAVIGATION_ENTITIES.building.color}
                  title={building.name}
                  subtitle={NAVIGATION_ENTITIES.building.label}
                  isSelected={selectedBuilding?.id === building.id}
                />
              ))
            )}
          </>
        )}

        {/*
         * 🏢 ENTERPRISE ARCHITECTURE DECISION (Επιλογή Α):
         * Οι Όροφοι ΔΕΝ εμφανίζονται ως level στην πλοήγηση.
         * Units συνδέονται απευθείας με Buildings.
         */}

        {/* Final Destinations - 🏢 ENTERPRISE: Εξαρτάται από Building (skip Floors) */}
        {currentLevel === 'units' && selectedBuilding && (
          <nav className="space-y-3" aria-label={t('tree.steps.units')}>
            <p className="text-sm font-medium text-gray-900 dark:text-foreground mb-3">
              {t('tree.destinations.navigateTo')}
            </p>

            <NavigationButton
              onClick={() => handleNavigateToPage('properties')}
              icon={NAVIGATION_ENTITIES.unit.icon}
              iconColor={NAVIGATION_ENTITIES.unit.color}
              title={t('tree.destinations.viewUnits')}
              subtitle={t('tree.destinations.unitsInBuilding', { count: buildingUnits.length })}
              variant="compact"
            />

            <NavigationButton
              onClick={() => handleNavigateToPage('buildings')}
              icon={NAVIGATION_ENTITIES.building.icon}
              iconColor={NAVIGATION_ENTITIES.building.color}
              title={t('tree.destinations.buildingDetails')}
              subtitle={selectedBuilding.name}
              variant="compact"
            />

            {selectedProject && (
              <NavigationButton
                onClick={() => handleNavigateToPage('projects')}
                icon={NAVIGATION_ENTITIES.project.icon}
                iconColor={NAVIGATION_ENTITIES.project.color}
                title={t('tree.destinations.projectDetails')}
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

export default NavigationTree;