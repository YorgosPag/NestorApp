'use client';
import React, { useState, useEffect } from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  Building2 as BuildingIcon,
  Building,
  Home,
  Package,
  ParkingCircle,
  Folder,
  ChevronDown
} from 'lucide-react';
import { useProjectHierarchy } from '../contexts/ProjectHierarchyContext';
import { SelectionButton } from './shared/SelectionButton';
import type { DxfDestination } from '../pipeline/types';
import type { CompanyContact } from '../../../types/contacts';
import type { Project, Building as ProjectBuilding, Floor } from '../contexts/ProjectHierarchyContext';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS, HOVER_BORDER_EFFECTS, HOVER_TEXT_EFFECTS } from '../ui/effects';
import { AnimatedSpinner } from '../components/modal/ModalLoadingStates';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PANEL_LAYOUT } from '../config/panel-tokens';

interface HierarchicalDestinationSelectorProps {
  onDestinationSelect: (destId: string) => void;
  selectedDestination: DxfDestination | null;
}

export function HierarchicalDestinationSelector({
  onDestinationSelect,
  selectedDestination
}: HierarchicalDestinationSelectorProps) {
  const iconSizes = useIconSizes();
  const { quick, radius, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
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
      case 'project': return BuildingIcon;
      case 'building': return Building;
      case 'floor': return Home;
      case 'storage': return Package;
      case 'parking': return ParkingCircle;
      default: return Folder;
    }
  };

  if (loading) {
    return (
      <section className={`text-center ${PANEL_LAYOUT.PADDING.VERTICAL_XXXL}`}>
        <AnimatedSpinner size="large" className={`mx-auto ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`} />
        <p className={`${colors.text.muted}`}>Φόρτωση δεδομένων...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={`text-center ${PANEL_LAYOUT.PADDING.VERTICAL_XXXL}`}>
        <p className={`${colors.text.error} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>Σφάλμα: {error}</p>
        <button
          onClick={loadCompanies}
          className={`${PANEL_LAYOUT.SPACING.COMFORTABLE} ${colors.bg.info} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${colors.text.inverted} rounded-lg`}
        >
          Ξαναδοκιμή
        </button>
      </section>
    );
  }

  return (
    <article>
      <header>
        <h3 className={`text-lg font-medium ${colors.text.primary} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>{getStepTitle()}</h3>
        <p className={`${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>{getStepDescription()}</p>
      </header>

      {/* Breadcrumb Navigation */}
      <nav className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_SM} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG} text-sm`}>
        {selectedCompany && (
          <>
            <button
              onClick={() => setCurrentStep('company')}
              className={`${colors.text.info} ${HOVER_TEXT_EFFECTS.LIGHTER} flex items-center ${PANEL_LAYOUT.GAP.XS}`}
            >
              <BuildingIcon className={iconSizes.sm} />
              <span>{selectedCompany.companyName}</span>
            </button>
            {selectedProject && <span className={`${colors.text.muted}`}>→</span>}
          </>
        )}
        {selectedProject && (
          <>
            <button
              onClick={() => setCurrentStep('project')}
              className={`${colors.text.info} ${HOVER_TEXT_EFFECTS.LIGHTER} flex items-center ${PANEL_LAYOUT.GAP.XS}`}
            >
              <Folder className={iconSizes.sm} />
              <span>{selectedProject.name}</span>
            </button>
            {selectedBuilding && <span className={`${colors.text.muted}`}>→</span>}
          </>
        )}
        {selectedBuilding && (
          <>
            <button
              onClick={() => setCurrentStep('building')}
              className={`${colors.text.info} ${HOVER_TEXT_EFFECTS.LIGHTER} flex items-center ${PANEL_LAYOUT.GAP.XS}`}
            >
              <Building className={iconSizes.sm} />
              <span>{selectedBuilding.name}</span>
            </button>
            {selectedFloor && <span className={`${colors.text.muted}`}>→</span>}
          </>
        )}
        {selectedFloor && (
          <span className={`${colors.text.secondary} flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
            <Home className={iconSizes.sm} />
            <span>{selectedFloor.name}</span>
          </span>
        )}
      </nav>

      <section className={`${PANEL_LAYOUT.SPACING.GAP_SM} max-h-96 overflow-y-auto`}>
        {/* Company Selection */}
        {currentStep === 'company' && (
          <>
            {companies.length === 0 ? (
              <p className={`${colors.text.muted} text-center ${PANEL_LAYOUT.PADDING.VERTICAL_XXXL}`}>
                Δεν βρέθηκαν εταιρείες στο σύστημα.
              </p>
            ) : (
              companies.map(company => (
                <SelectionButton
                  key={company.id}
                  onClick={() => handleCompanySelect(company.id!)}
                  icon={<BuildingIcon className={iconSizes.md} />}
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
          <fieldset className={PANEL_LAYOUT.SPACING.GAP_MD}>
            <label className={`text-sm font-medium ${colors.text.primary}`}>Επιλέξτε Έργο</label>
            {projects.length === 0 ? (
              <p className={`${colors.text.muted} text-center ${PANEL_LAYOUT.PADDING.VERTICAL_XXXL} ${colors.bg.secondary} rounded-lg ${getStatusBorder('muted')}`}>
                Δεν βρέθηκαν έργα για την επιλεγμένη εταιρεία.
              </p>
            ) : (
              <Select onValueChange={handleProjectSelect}>
                <SelectTrigger className={`w-full ${colors.bg.hover} ${getStatusBorder('muted')} ${colors.text.primary}`}>
                  <SelectValue placeholder="-- Επιλέξτε Έργο --" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      <span className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                        <Folder className={`${iconSizes.sm} ${colors.text.info}`} />
                        <span>{project.name}</span>
                        <span className={`${colors.text.muted} text-xs`}>({project.buildings.length} κτίρια)</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </fieldset>
        )}

        {/* Building Selection */}
        {currentStep === 'building' && selectedProject && (
          <>
            {selectedProject.buildings.length === 0 ? (
              <div className={`${colors.text.muted} text-center ${PANEL_LAYOUT.PADDING.VERTICAL_XXXL}`}>
                Δεν βρέθηκαν κτίρια για το επιλεγμένο έργο.
              </div>
            ) : (
              selectedProject.buildings.map(building => (
                <SelectionButton
                  key={building.id}
                  onClick={() => handleBuildingSelect(building.id)}
                  icon={<Building className={iconSizes.md} />}
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
              <div className={`${colors.text.muted} text-center ${PANEL_LAYOUT.PADDING.VERTICAL_XXXL}`}>
                Δεν βρέθηκαν όροφοι για το επιλεγμένο κτίριο.
              </div>
            ) : (
              selectedBuilding.floors.map(floor => (
                <button
                  key={floor.id}
                  onClick={() => handleFloorSelect(floor.id)}
                  className={`w-full text-left ${PANEL_LAYOUT.SPACING.LG} rounded-lg ${getStatusBorder('muted')} ${HOVER_BORDER_EFFECTS.GRAY} ${HOVER_BACKGROUND_EFFECTS.MUTED} transition-colors`}
                >
                  <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
                    <Home className={`${iconSizes.lg} ${colors.text.info}`} />
                    <div>
                      <div className={`${colors.text.primary} font-medium`}>{floor.name}</div>
                      <div className={`${colors.text.muted} text-sm`}>
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
                className={`w-full text-left ${PANEL_LAYOUT.SPACING.LG} rounded-lg border transition-colors ${
                  selectedDestination?.id === dest.id
                    ? `${useBorderTokens().getStatusBorder('info')} ${colors.bg.selection}`
                    : `${getStatusBorder('muted')} ${HOVER_BORDER_EFFECTS.GRAY} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
                }`}
              >
                <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
                  {React.createElement(getDestinationIcon(dest.type), {
                    className: `${iconSizes.lg} ${colors.text.info}`
                  })}
                  <div>
                    <div className={`${colors.text.primary} font-medium`}>{dest.label}</div>
                    <div className={`${colors.text.muted} text-sm capitalize`}>{dest.type}</div>
                  </div>
                </div>
              </button>
            ))}
          </>
        )}
      </section>
    </article>
  );
}