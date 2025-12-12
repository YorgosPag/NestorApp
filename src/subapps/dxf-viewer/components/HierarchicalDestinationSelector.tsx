'use client';
import React, { useState, useEffect } from 'react';
import { useProjectHierarchy } from '../contexts/ProjectHierarchyContext';
import { SelectionButton } from './shared/SelectionButton';
import type { DxfDestination } from '../pipeline/types';
import type { CompanyContact } from '../../../types/contacts';
import type { Project, Building, Floor } from '../contexts/ProjectHierarchyContext';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS, HOVER_BORDER_EFFECTS, HOVER_TEXT_EFFECTS } from '../ui/effects';

interface HierarchicalDestinationSelectorProps {
  onDestinationSelect: (destId: string) => void;
  selectedDestination: DxfDestination | null;
}

export function HierarchicalDestinationSelector({
  onDestinationSelect,
  selectedDestination
}: HierarchicalDestinationSelectorProps) {
  const {
    companies,
    selectedCompany,
    projects,
    selectedProject,
    selectedBuilding,
    selectedFloor,
    loading,
    error,
    loadCompanies,
    selectCompany,
    selectProject,
    selectBuilding,
    selectFloor
  } = useProjectHierarchy();

  const [currentStep, setCurrentStep] = useState<'company' | 'project' | 'building' | 'floor' | 'destination'>('company');

  // Load companies on mount
  useEffect(() => {
    if (companies.length === 0) {
      loadCompanies();
    }
  }, []);

  // Auto-advance steps based on selections
  useEffect(() => {
    if (selectedCompany && !selectedProject && currentStep === 'company') {
      setCurrentStep('project');
    } else if (selectedProject && !selectedBuilding && currentStep === 'project') {
      setCurrentStep('building');
    } else if (selectedBuilding && !selectedFloor && currentStep === 'building') {
      setCurrentStep('floor');
    } else if (selectedFloor && currentStep === 'floor') {
      setCurrentStep('destination');
    }
  }, [selectedCompany, selectedProject, selectedBuilding, selectedFloor, currentStep]);

  const handleCompanySelect = (companyId: string) => {
    selectCompany(companyId);
    setCurrentStep('project');
  };

  const handleProjectSelect = (projectId: string) => {
    selectProject(projectId);
    setCurrentStep('building');
  };

  const handleBuildingSelect = (buildingId: string) => {
    selectBuilding(buildingId);
    setCurrentStep('floor');
  };

  const handleFloorSelect = (floorId: string) => {
    selectFloor(floorId);
    setCurrentStep('destination');
  };

  const handleFinalDestinationSelect = (dest: { id: string, type: string, label: string }) => {
    onDestinationSelect(dest.id);
  };

  const getAvailableFinalDestinations = () => {
    const destinations: Array<{ id: string, type: string, label: string }> = [];

    if (selectedProject) {
      destinations.push({
        id: selectedProject.id,
        type: 'project',
        label: `${selectedProject.name} - Γενική Κάτοψη`
      });

      if (selectedProject.parkingSpots && selectedProject.parkingSpots.length > 0) {
        destinations.push({
          id: `${selectedProject.id}_parking`,
          type: 'parking',
          label: `${selectedProject.name} - Θέσεις Στάθμευσης`
        });
      }
    }

    if (selectedBuilding) {
      destinations.push({
        id: selectedBuilding.id,
        type: 'building',
        label: `${selectedProject?.name} → ${selectedBuilding.name}`
      });

      if (selectedBuilding.storageAreas && selectedBuilding.storageAreas.length > 0) {
        destinations.push({
          id: `${selectedBuilding.id}_storage`,
          type: 'storage',
          label: `${selectedProject?.name} → ${selectedBuilding.name} → Αποθήκες`
        });
      }
    }

    if (selectedFloor) {
      destinations.push({
        id: selectedFloor.id,
        type: 'floor',
        label: `${selectedProject?.name} → ${selectedBuilding?.name} → ${selectedFloor.name}`
      });
    }

    return destinations;
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'company': return 'Επιλέξτε Εταιρεία';
      case 'project': return 'Επιλέξτε Έργο';
      case 'building': return 'Επιλέξτε Κτίριο';
      case 'floor': return 'Επιλέξτε Όροφο';
      case 'destination': return 'Επιλέξτε Προορισμό';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 'company': return 'Επιλέξτε την εταιρεία που διαχειρίζεται το έργο';
      case 'project': return 'Επιλέξτε το έργο στο οποίο ανήκει η κάτοψη';
      case 'building': return 'Επιλέξτε το κτίριο της κάτοψης';
      case 'floor': return 'Επιλέξτε τον όροφο της κάτοψης';
      case 'destination': return 'Επιλέξτε τον τελικό προορισμό για την αποθήκευση';
    }
  };

  const getDestinationIcon = (type: string) => {
    switch (type) {
      case 'project': return '🏗️';
      case 'building': return '🏢';
      case 'floor': return '🏠';
      case 'storage': return '📦';
      case 'parking': return '🅿️';
      default: return '📁';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-400">Φόρτωση δεδομένων...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 mb-4">Σφάλμα: {error}</p>
        <button
          onClick={loadCompanies}
          className={`px-4 py-2 bg-blue-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} text-white rounded-lg`}
        >
          Ξαναδοκιμή
        </button>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-white mb-2">{getStepTitle()}</h3>
      <p className="text-gray-400 mb-6">{getStepDescription()}</p>

      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 mb-6 text-sm">
        {selectedCompany && (
          <>
            <button
              onClick={() => setCurrentStep('company')}
              className={`text-blue-400 ${HOVER_TEXT_EFFECTS.LIGHTER}`}
            >
              🏢 {selectedCompany.companyName}
            </button>
            {selectedProject && <span className="text-gray-500">→</span>}
          </>
        )}
        {selectedProject && (
          <>
            <button
              onClick={() => setCurrentStep('project')}
              className={`text-blue-400 ${HOVER_TEXT_EFFECTS.LIGHTER}`}
            >
              📁 {selectedProject.name}
            </button>
            {selectedBuilding && <span className="text-gray-500">→</span>}
          </>
        )}
        {selectedBuilding && (
          <>
            <button
              onClick={() => setCurrentStep('building')}
              className={`text-blue-400 ${HOVER_TEXT_EFFECTS.LIGHTER}`}
            >
              🏢 {selectedBuilding.name}
            </button>
            {selectedFloor && <span className="text-gray-500">→</span>}
          </>
        )}
        {selectedFloor && (
          <span className="text-gray-300">🏠 {selectedFloor.name}</span>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {/* Company Selection */}
        {currentStep === 'company' && (
          <>
            {companies.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                Δεν βρέθηκαν εταιρείες στο σύστημα.
              </div>
            ) : (
              companies.map(company => (
                <SelectionButton
                  key={company.id}
                  onClick={() => handleCompanySelect(company.id!)}
                  icon="🏢"
                  title={company.companyName}
                  subtitle={company.industry}
                  extraInfo={company.vatNumber ? `ΑΦΜ: ${company.vatNumber}` : undefined}
                />
              ))
            )}
          </>
        )}

        {/* Project Selection */}
        {currentStep === 'project' && selectedCompany && (
          <>
            {projects.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                Δεν βρέθηκαν έργα για την επιλεγμένη εταιρεία.
              </div>
            ) : (
              projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => handleProjectSelect(project.id)}
                  className={`w-full text-left p-4 rounded-lg border border-gray-600 ${HOVER_BORDER_EFFECTS.GRAY} ${HOVER_BACKGROUND_EFFECTS.MUTED} transition-colors`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">📁</span>
                    <div>
                      <div className="text-white font-medium">{project.name}</div>
                      <div className="text-gray-400 text-sm">
                        {project.buildings.length} κτίρια
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </>
        )}

        {/* Building Selection */}
        {currentStep === 'building' && selectedProject && (
          <>
            {selectedProject.buildings.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                Δεν βρέθηκαν κτίρια για το επιλεγμένο έργο.
              </div>
            ) : (
              selectedProject.buildings.map(building => (
                <SelectionButton
                  key={building.id}
                  onClick={() => handleBuildingSelect(building.id)}
                  icon="🏢"
                  title={building.name}
                  subtitle={`${building.floors.length} όροφοι`}
                />
              ))
            )}
          </>
        )}

        {/* Floor Selection */}
        {currentStep === 'floor' && selectedBuilding && (
          <>
            {selectedBuilding.floors.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                Δεν βρέθηκαν όροφοι για το επιλεγμένο κτίριο.
              </div>
            ) : (
              selectedBuilding.floors.map(floor => (
                <button
                  key={floor.id}
                  onClick={() => handleFloorSelect(floor.id)}
                  className={`w-full text-left p-4 rounded-lg border border-gray-600 ${HOVER_BORDER_EFFECTS.GRAY} ${HOVER_BACKGROUND_EFFECTS.MUTED} transition-colors`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">🏠</span>
                    <div>
                      <div className="text-white font-medium">{floor.name}</div>
                      <div className="text-gray-400 text-sm">
                        {floor.units.length} μονάδες
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </>
        )}

        {/* Final Destination Selection */}
        {currentStep === 'destination' && (
          <>
            {getAvailableFinalDestinations().map(dest => (
              <button
                key={dest.id}
                onClick={() => handleFinalDestinationSelect(dest)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  selectedDestination?.id === dest.id
                    ? 'border-blue-500 bg-blue-900/30'
                    : `border-gray-600 ${HOVER_BORDER_EFFECTS.GRAY} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getDestinationIcon(dest.type)}</span>
                  <div>
                    <div className="text-white font-medium">{dest.label}</div>
                    <div className="text-gray-400 text-sm capitalize">{dest.type}</div>
                  </div>
                </div>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}