'use client';

/**
 * Centralized Navigation Tree Component
 * Main navigation interface with hierarchical structure
 */
import React from 'react';
import { Building, Construction, Home, MapPin, Map } from 'lucide-react';
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
    selectedFloor,
    currentLevel,
    loading,
    error,
    loadCompanies,
    selectCompany,
    selectProject,
    selectBuilding,
    selectFloor,
    navigateToExistingPages
  } = useNavigation();

  const getStepTitle = () => {
    switch (currentLevel) {
      case 'companies': return 'Επιλέξτε Εταιρεία';
      case 'projects': return 'Επιλέξτε Έργο';
      case 'buildings': return 'Επιλέξτε Κτίριο';
      case 'floors': return 'Επιλέξτε Όροφο';
      case 'units': return 'Επιλέξτε Προορισμό';
    }
  };

  const getStepDescription = () => {
    switch (currentLevel) {
      case 'companies': return 'Επιλέξτε την εταιρεία για να δείτε τα έργα της';
      case 'projects': return 'Επιλέξτε το έργο για να δείτε τα κτίρια';
      case 'buildings': return 'Επιλέξτε το κτίριο για να δείτε τους ορόφους';
      case 'floors': return 'Επιλέξτε τον όροφο για να δείτε τις μονάδες';
      case 'units': return 'Επιλέξτε τον τελικό προορισμό';
    }
  };

  const handleNavigateToPage = (type: 'properties' | 'projects' | 'buildings' | 'floorplan') => {
    if (onNavigateToPage) {
      onNavigateToPage(type);
    } else {
      navigateToExistingPages(type);
    }
  };

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
                  icon={Building}
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
                  title={project.name}
                  subtitle={`${project.buildings.length} κτίρια`}
                  isSelected={selectedProject?.id === project.id}
                />
              ))
            )}
          </>
        )}

        {/* Buildings */}
        {currentLevel === 'buildings' && selectedProject && (
          <>
            {selectedProject.buildings.length === 0 ? (
              <div className="text-gray-500 dark:text-muted-foreground text-center py-8">
                Δεν βρέθηκαν κτίρια για το επιλεγμένο έργο.
              </div>
            ) : (
              selectedProject.buildings.map(building => (
                <NavigationButton
                  key={building.id}
                  onClick={() => selectBuilding(building.id)}
                  icon={Home}
                  title={building.name}
                  subtitle={`${building.floors.length} όροφοι`}
                  isSelected={selectedBuilding?.id === building.id}
                />
              ))
            )}
          </>
        )}

        {/* Floors */}
        {currentLevel === 'floors' && selectedBuilding && (
          <>
            {selectedBuilding.floors.length === 0 ? (
              <div className="text-gray-500 dark:text-muted-foreground text-center py-8">
                Δεν βρέθηκαν όροφοι για το επιλεγμένο κτίριο.
              </div>
            ) : (
              selectedBuilding.floors.map(floor => (
                <NavigationButton
                  key={floor.id}
                  onClick={() => selectFloor(floor.id)}
                  icon={Home}
                  title={floor.name}
                  subtitle={`${floor.units.length} μονάδες`}
                  isSelected={selectedFloor?.id === floor.id}
                />
              ))
            )}
          </>
        )}

        {/* Final Destinations */}
        {currentLevel === 'units' && selectedFloor && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-900 dark:text-foreground mb-3">
              Μετάβαση σε:
            </div>

            <NavigationButton
              onClick={() => handleNavigateToPage('properties')}
              icon={MapPin}
              title="Προβολή Ακινήτων"
              subtitle={`${selectedFloor.units.length} μονάδες σε αυτόν τον όροφο`}
              variant="compact"
            />

            <NavigationButton
              onClick={() => handleNavigateToPage('floorplan')}
              icon={Map}
              title="Κάτοψη Ορόφου"
              subtitle="Προβολή της κάτοψης με όλες τις μονάδες"
              variant="compact"
            />

            {selectedProject && (
              <NavigationButton
                onClick={() => handleNavigateToPage('projects')}
                icon={Construction}
                title="Λεπτομέρειες Έργου"
                subtitle={selectedProject.name}
                variant="compact"
              />
            )}

            {selectedBuilding && (
              <NavigationButton
                onClick={() => handleNavigateToPage('buildings')}
                icon={Home}
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

export default NavigationTree;