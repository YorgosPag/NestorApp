'use client';

/**
 * Centralized Navigation Tree Component
 * Main navigation interface with hierarchical structure
 *
 * 🏢 ENTERPRISE ARCHITECTURE (Επιλογή Α):
 * Floors αφαιρέθηκαν από navigation - Units συνδέονται απευθείας με Buildings
 */
import React, { useMemo } from 'react';
import { Building, Construction, Home, MapPin, Map, Factory } from 'lucide-react';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';
import { useNavigation } from '../core/NavigationContext';
import { NavigationButton } from './NavigationButton';
import { NavigationBreadcrumb } from './NavigationBreadcrumb';

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

  /**
   * 🏢 ENTERPRISE (Επιλογή Α): Τίτλοι χωρίς 'floors' level
   */
  const getStepTitle = () => {
    switch (currentLevel) {
      case 'companies': return 'Επιλέξτε Εταιρεία';
      case 'projects': return 'Επιλέξτε Έργο';
      case 'buildings': return 'Επιλέξτε Κτίριο';
      // 🏢 ENTERPRISE: 'floors' case αφαιρέθηκε (Επιλογή Α)
      case 'units': return 'Επιλέξτε Προορισμό';
      default: return 'Πλοήγηση';
    }
  };

  /**
   * 🏢 ENTERPRISE (Επιλογή Α): Περιγραφές χωρίς 'floors' level
   */
  const getStepDescription = () => {
    switch (currentLevel) {
      case 'companies': return 'Επιλέξτε την εταιρεία για να δείτε τα έργα της';
      case 'projects': return 'Επιλέξτε το έργο για να δείτε τα κτίρια';
      case 'buildings': return 'Επιλέξτε το κτίριο για να δείτε τις μονάδες';
      // 🏢 ENTERPRISE: 'floors' case αφαιρέθηκε (Επιλογή Α)
      case 'units': return 'Επιλέξτε τον τελικό προορισμό';
      default: return '';
    }
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
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-500 dark:text-muted-foreground">Φόρτωση δεδομένων...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className || ''}`}>
        <p className="text-red-500 dark:text-red-400 mb-4">Σφάλμα: {error}</p>
        <button
          onClick={loadCompanies}
          className={cn(
            "px-4 py-2 bg-blue-600 text-white rounded-lg",
            HOVER_BACKGROUND_EFFECTS.BLUE
          )}
        >
          Ξαναδοκιμή
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
                Δεν βρέθηκαν εταιρείες στο σύστημα.
              </div>
            ) : (
              companies.map(company => (
                <NavigationButton
                  key={company.id}
                  onClick={() => selectCompany(company.id)}
                  icon={Factory}
                  iconColor="text-blue-600"
                  title={company.companyName}
                  subtitle={company.industry}
                  extraInfo={company.vatNumber ? `ΑΦΜ: ${company.vatNumber}` : undefined}
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
                Δεν βρέθηκαν έργα για την επιλεγμένη εταιρεία.
              </div>
            ) : (
              projects.map(project => (
                <NavigationButton
                  key={project.id}
                  onClick={() => selectProject(project.id)}
                  icon={Construction}
                  iconColor="text-green-600"
                  title={project.name}
                  subtitle={`${getBuildingCount(project.id)} κτίρια`}
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
                Δεν βρέθηκαν κτίρια για το επιλεγμένο έργο.
              </div>
            ) : (
              /* 🏢 ENTERPRISE: Buildings display without floor count (Επιλογή Α) */
              projectBuildings.map(building => (
                <NavigationButton
                  key={building.id}
                  onClick={() => selectBuilding(building.id)}
                  icon={Building}
                  iconColor="text-purple-600"
                  title={building.name}
                  subtitle="Κτίριο"
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
          <nav className="space-y-3" aria-label="Τελικοί Προορισμοί">
            <p className="text-sm font-medium text-gray-900 dark:text-foreground mb-3">
              Μετάβαση σε:
            </p>

            <NavigationButton
              onClick={() => handleNavigateToPage('properties')}
              icon={Home}
              iconColor="text-teal-600"
              title="Προβολή Μονάδων"
              subtitle={`${buildingUnits.length} μονάδες στο κτίριο`}
              variant="compact"
            />

            <NavigationButton
              onClick={() => handleNavigateToPage('buildings')}
              icon={Building}
              iconColor="text-purple-600"
              title="Λεπτομέρειες Κτιρίου"
              subtitle={selectedBuilding.name}
              variant="compact"
            />

            {selectedProject && (
              <NavigationButton
                onClick={() => handleNavigateToPage('projects')}
                icon={Construction}
                iconColor="text-green-600"
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

export default NavigationTree;