'use client';
import React, { useState, useEffect } from 'react';
import { Triangle, Building2, Folder, Home, Building as BuildingIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useProjectHierarchy, type Building, type Unit } from '../contexts/ProjectHierarchyContext';
import { useFloorplan } from '../../../contexts/FloorplanContext';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { dxfImportService } from '../io/dxf-import';
import { FloorplanService, type FloorplanData } from '../../../services/floorplans/FloorplanService';
import { BuildingFloorplanService } from '../../../services/floorplans/BuildingFloorplanService';
import { UnitFloorplanService } from '../../../services/floorplans/UnitFloorplanService';
import { useNotifications } from '../../../providers/NotificationProvider';
import DxfImportModal from './DxfImportModal';
import type { SceneModel } from '../types/scene';
import { HOVER_TEXT_EFFECTS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { MODAL_CONFIGURATIONS, getModalConfig, getModalZIndex } from '../config/modal-config';
import {
  ProjectModalContainer,
  ModalFormSection,
  ModalField,
  ModalActions,
  ModalContentGrid,
  ErrorModalContainer
} from './modal/ModalContainer';
import { useTypography } from '@/hooks/useTypography';
import { MODAL_COLOR_SCHEMES, getModalColorScheme, getModalIconColor } from '../config/modal-colors';
import { MODAL_FLEX_PATTERNS, MODAL_DIMENSIONS, MODAL_SPACING, getIconSize } from '../config/modal-layout';
import { getSelectStyles, getSelectPlaceholder, MODAL_SELECT_ITEM_PATTERNS } from '../config/modal-select';
import { CompaniesLoadingState, ProjectsLoadingState, ModalEmptyState, InlineLoading, ModalErrorState } from './modal/ModalLoadingStates';

interface SimpleProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFileImport?: (file: File) => Promise<void>;
}

type DialogStep = 'company' | 'project' | 'building' | 'unit';

export function SimpleProjectDialog({ isOpen, onClose, onFileImport }: SimpleProjectDialogProps) {
  const {
    companies,
    selectedCompany,
    projects,
    selectedProject,
    loading,
    error,
    loadCompanies,
    selectCompany,
    loadProjectsForCompany,
    selectProject
  } = useProjectHierarchy();

  const { getStatusBorder } = useBorderTokens();

  const colors = useSemanticColors();
  const typography = useTypography();

  // Enterprise helper για modal container borders
  const getModalContainerBorder = (variant: 'default' | 'info' | 'success' | 'warning' | 'error') => {
    const baseClasses = {
      default: colors.bg.muted,
      info: `${colors.bg.infoSubtle}`,
      success: `${colors.bg.successSubtle}`,
      warning: `${colors.bg.warningSubtle}`,
      error: `${colors.bg.errorSubtle}`
    };

    return `${baseClasses[variant]} ${getStatusBorder(variant)}`;
  };

  const { setProjectFloorplan, setParkingFloorplan } = useFloorplan();

  const [currentStep, setCurrentStep] = useState<DialogStep>('company');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [units, setUnits] = useState<Unit[]>([]);

  // DXF Import Modal state
  const [showDxfModal, setShowDxfModal] = useState(false);
  const [currentFloorplanType, setCurrentFloorplanType] = useState<'project' | 'parking' | 'building' | 'storage' | 'unit'>('project');

  // Confirmation toast hook - TEMPORARY FIX: showConfirmDialog not available
  // const { showConfirmDialog } = useNotifications();

  // Real DXF parsing for project tabs using the same service as canvas
  const parseDxfForProjectTab = async (file: File, encoding?: string): Promise<SceneModel | null> => {

    try {
      const result = await dxfImportService.importDxfFile(file, encoding);
      if (result.success && result.scene) {

        return result.scene;
      } else {
        console.warn('⚠️ DXF parsing failed for project tab:', result.error);
        return null;
      }
    } catch (error) {
      console.error('❌ Error parsing DXF for project tab:', error);
      return null;
    }
  };

  // Auto-load companies when dialog opens
  useEffect(() => {
    if (isOpen && (!companies || companies.length === 0)) {

      loadCompanies();
    }
  }, [isOpen, companies.length, loadCompanies]);

  // Reset selection when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('company');
      setSelectedCompanyId('');
      setSelectedProjectId('');
      setSelectedBuildingId('');
      setBuildings([]);
    }
  }, [isOpen]);

  // Load buildings when project is selected
  const loadBuildingsForProject = async (projectId: string) => {
    try {

      const selectedProjectData = projects?.find(p => p.id === projectId);
      if (selectedProjectData?.buildings) {
        setBuildings(selectedProjectData.buildings);

      } else {
        setBuildings([]);

      }
    } catch (error) {
      console.error('🔺 Failed to load buildings:', error);
      setBuildings([]);
    }
  };

  const handleCompanyChange = (companyId: string) => {

    setSelectedCompanyId(companyId);
    if (companyId) {
      selectCompany(companyId);
    }
  };

  const handleProjectChange = (projectId: string) => {

    setSelectedProjectId(projectId);
    if (projectId) {
      selectProject(projectId);
    }
  };

  const handleNext = async () => {
    if (currentStep === 'company' && selectedCompanyId) {

      setCurrentStep('project');
      
      // Load projects for the selected company
      try {
        await loadProjectsForCompany(selectedCompanyId);

      } catch (error) {
        console.error('🔺 Failed to load projects:', error);
      }
    } else if (currentStep === 'project' && selectedProjectId) {

      setCurrentStep('building');
      
      // Load buildings for the selected project
      await loadBuildingsForProject(selectedProjectId);
    } else if (currentStep === 'building' && selectedBuildingId) {

      setCurrentStep('unit');
      
      // Units are already loaded by handleBuildingChange
    }
  };

  const handleBack = () => {
    if (currentStep === 'project') {
      setCurrentStep('company');
    } else if (currentStep === 'building') {
      setCurrentStep('project');
    } else if (currentStep === 'unit') {
      setCurrentStep('building');
    }
  };

  const handleBuildingChange = async (buildingId: string) => {

    setSelectedBuildingId(buildingId);
    
    // Load units for selected building
    if (buildingId) {
      await loadUnitsForBuilding(buildingId);
    } else {
      setUnits([]);
      setSelectedUnitId('');
    }
  };

  const loadUnitsForBuilding = async (buildingId: string) => {
    try {

      // Fetch units from API
      const response = await fetch('/api/units');
      if (!response.ok) {
        throw new Error(`Failed to fetch units: ${response.statusText}`);
      }
      
      const result = await response.json();
      if (result.success) {

        // Filter units that belong to the selected building
        const buildingUnits = result.units.filter((unit: Unit) =>
          unit.buildingId === buildingId || unit.building === buildingId
        );
        
        setUnits(buildingUnits);

        if (buildingUnits.length === 0) {

          const allBuildingIds = [...new Set(result.units.map((u: Unit) => u.buildingId))];

        }
      } else {
        throw new Error(result.error || 'Failed to fetch units');
      }
    } catch (error) {
      console.error('❌ Error loading units for building:', error);
      setUnits([]);
    }
  };

  const handleUnitChange = (unitId: string) => {

    setSelectedUnitId(unitId);
  };

  const handleClose = () => {
    setCurrentStep('company');
    setSelectedCompanyId('');
    setSelectedProjectId('');
    setSelectedBuildingId('');
    setBuildings([]);
    setSelectedUnitId('');
    setUnits([]);
    onClose();
  };

  // Handle DXF import with encoding from modal
  const handleDxfImportFromModal = async (file: File, encoding: string) => {
    console.log('🔺 SimpleProjectDialog.handleDxfImportFromModal called:', {
      fileName: file.name,
      encoding,
      currentStep,
      currentFloorplanType,
      selectedProjectId,
      selectedBuildingId,
      selectedUnitId
    });

    const type = currentFloorplanType;
    const targetId = currentStep === 'unit' ? selectedUnitId :
                    (currentStep === 'building' ? selectedBuildingId : selectedProjectId);
    const targetType = currentStep === 'unit' ? 'unit' :
                      (currentStep === 'building' ? 'building' : 'project');

    try {
      // Check if floorplan already exists before proceeding
      let hasExisting = false;
      
      if (currentStep === 'unit' && type === 'unit') {
        hasExisting = await UnitFloorplanService.hasFloorplan(selectedUnitId);
      } else if (currentStep === 'building' && (type === 'building' || type === 'storage')) {
        hasExisting = await BuildingFloorplanService.hasFloorplan(selectedBuildingId, type as 'building' | 'storage');
      } else {
        hasExisting = await FloorplanService.hasFloorplan(selectedProjectId, type as 'project' | 'parking');
      }
      
      // If floorplan exists, show confirmation dialog
      if (hasExisting) {
        const typeLabels = {
          project: 'Κάτοψη Έργου',
          parking: 'Κάτοψη Θ.Σ.',
          building: 'Κάτοψη Κτηρίου',
          storage: 'Κάτοψη Αποθηκών',
          unit: 'Κάτοψη Μονάδας'
        };
        
        // TEMPORARY FIX: Use browser confirm instead of showConfirmDialog
        const confirmed = confirm(
          `Αντικατάσταση ${typeLabels[type as keyof typeof typeLabels]}\n\n` +
          `Υπάρχει ήδη αποθηκευμένη ${typeLabels[type as keyof typeof typeLabels]} για αυτή την εταιρεία.\n\n` +
          `Η νέα κάτοψη που θα φορτώσετε ενδέχεται να μην ταιριάζει με τα υπάρχοντα layers που έχουν σχεδιαστεί πάνω στην προηγούμενη κάτοψη.\n\n` +
          `Θέλετε να συνεχίσετε και να αντικαταστήσετε την υπάρχουσα κάτοψη;`
        );
        
        if (!confirmed) {

          return;
        }
      }
      
      // Use the same mechanism as Upload DXF File button to load to canvas
      console.log('🔺 SimpleProjectDialog calling onFileImport with file:', {
        fileName: file.name,
        hasOnFileImport: !!onFileImport
      });

      if (onFileImport) {
        await onFileImport(file);
        console.log('🔺 SimpleProjectDialog onFileImport completed');
      } else {
        console.warn('🔺 SimpleProjectDialog: onFileImport callback not provided!');
      }
      
      // Also parse and store for project tab using real DXF parser with encoding
      const scene = await parseDxfForProjectTab(file, encoding);
      
      if (scene) {
        const floorplanData = {
          projectId: selectedProjectId,
          buildingId: currentStep === 'building' ? selectedBuildingId : undefined,
          type,
          scene,
          fileName: file.name,
          timestamp: Date.now(),
          encoding: encoding // Store the encoding used
        };

        // Create compatible floorplan data without encoding - ensure proper type matching
        const projectFloorplanData = {
          projectId: floorplanData.projectId,
          buildingId: floorplanData.buildingId,
          type: floorplanData.type as 'project' | 'parking' | 'building' | 'storage',
          scene: floorplanData.scene,
          fileName: floorplanData.fileName,
          timestamp: floorplanData.timestamp
        } satisfies FloorplanData;

        // Save to Firestore (persistent storage) - use appropriate service
        let saved = false;
        if (currentStep === 'unit' && type === 'unit') {
          const unitData = {
            unitId: selectedUnitId,
            type: 'unit' as const,
            scene,
            fileName: file.name,
            timestamp: Date.now()
          };
          saved = await UnitFloorplanService.saveFloorplan(selectedUnitId, unitData);
        } else if (currentStep === 'building' && (type === 'building' || type === 'storage')) {
          const buildingData = {
            buildingId: selectedBuildingId,
            type: type as 'building' | 'storage',
            scene,
            fileName: file.name,
            timestamp: Date.now()
          };
          saved = await BuildingFloorplanService.saveFloorplan(selectedBuildingId, type as 'building' | 'storage', buildingData);
        } else {
          saved = await FloorplanService.saveFloorplan(selectedProjectId, type as 'project' | 'parking', projectFloorplanData);
        }
        
        if (saved) {

          // Store in context for immediate access - create context-compatible objects
          if (type === 'project') {
            const contextData = {
              projectId: projectFloorplanData.projectId,
              type: 'project' as const,
              scene: projectFloorplanData.scene,
              fileName: projectFloorplanData.fileName,
              timestamp: projectFloorplanData.timestamp
            };
            setProjectFloorplan(selectedProjectId, contextData);
          } else if (type === 'parking') {
            const contextData = {
              projectId: projectFloorplanData.projectId,
              type: 'parking' as const,
              scene: projectFloorplanData.scene,
              fileName: projectFloorplanData.fileName,
              timestamp: projectFloorplanData.timestamp
            };
            setParkingFloorplan(selectedProjectId, contextData);
          }
        } else {
          console.error(`❌ Failed to save ${type} floorplan to Firestore`);
        }
      } else {
        console.warn('⚠️ Could not parse DXF for project tab - no scene data');
      }
      
    } catch (error) {
      console.error(`❌ Failed to load ${type} floorplan:`, error);
    }
    
    // Close modals after processing
    setShowDxfModal(false);
    handleClose();
  };

  const handleLoadFloorplan = (type: 'project' | 'parking' | 'building' | 'storage' | 'unit') => {

    setCurrentFloorplanType(type);
    setShowDxfModal(true);
  };

  if (!isOpen) return null;

  // Get enterprise modal configuration
  const modalConfig = getModalConfig('PROJECT_WIZARD');

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent
          className={modalConfig.className}
          style={{ zIndex: modalConfig.zIndex }}
        >
          <DialogHeader className={MODAL_SPACING.SPACE.blockMedium}>
            <DialogTitle className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
              <Triangle className={`${getIconSize('title')} ${getModalIconColor('dxf_technical')}`} />
              <section>
                <h1 className={typography.heading.lg}>Enhanced DXF Import</h1>
                <p className={`${typography.body.sm}`}>
                  {currentStep === 'company' ? 'Βήμα 1: Επιλογή Εταιρείας' :
                   currentStep === 'project' ? 'Βήμα 2: Επιλογή Έργου' :
                   currentStep === 'building' ? 'Βήμα 3: Επιλογή Κτιρίου' : 'Βήμα 4: Επιλογή Μονάδας'}
                </p>
              </section>
            </DialogTitle>
          </DialogHeader>

        {/* Content */}
        <main className={MODAL_SPACING.CONTAINER.padding}>

          {/* Company Selection - Step 1 */}
          {currentStep === 'company' && (
            <fieldset className={MODAL_SPACING.SECTIONS.betweenSections}>
              <legend className={`block ${typography.label.sm} ${MODAL_SPACING.SECTIONS.betweenItems}`}>
                Επιλογή Εταιρείας
              </legend>
            
            {loading ? (
              <InlineLoading message="Φόρτωση εταιρειών..." type="card" />
            ) : error ? (
              <ErrorModalContainer title="">
                <p className={`${typography.body.sm} ${MODAL_SPACING.CONTAINER.paddingSmall}`}>Σφάλμα φόρτωσης: {error}</p>
                <Button
                  onClick={loadCompanies}
                  variant="destructive"
                  size="sm"
                >
                  Ξαναδοκιμή
                </Button>
              </ErrorModalContainer>
            ) : (
              <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                <SelectTrigger className={getSelectStyles().trigger}>
                  <SelectValue placeholder="-- Επιλέξτε Εταιρεία --" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map(company => (
                    <SelectItem key={company.id} value={company.id!}>
                      <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                        <BuildingIcon className={`${getIconSize('field')} ${getModalIconColor('info')}`} />
                        <span>{company.companyName}</span>
                        {company.industry && (
                          <span className={`${typography.body.sm}`}>({company.industry})</span>
                        )}
                      </div>
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
            )}
            
              {(!companies || companies.length === 0) && !loading && !error && (
                <ProjectModalContainer title="" className={getModalContainerBorder('default')}>
                  <p className={`${typography.body.sm}`}>Δεν βρέθηκαν εταιρείες στο σύστημα.</p>
                </ProjectModalContainer>
              )}
            </fieldset>
          )}

          {/* Project Selection - Step 2 */}
          {currentStep === 'project' && (
            <div className={MODAL_SPACING.SECTIONS.betweenSections}>
              <label className={`block ${typography.label.sm} ${MODAL_SPACING.SECTIONS.betweenItems}`}>
                Επιλογή Έργου
              </label>

              {/* Selected Company Info */}
              {selectedCompany && (
                <ProjectModalContainer title="" className={`${MODAL_SPACING.SECTIONS.betweenItems} ${getModalContainerBorder('info')}`}>
                  <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                    <BuildingIcon className={`${getIconSize('title')} ${getModalIconColor('info')}`} />
                    <div>
                      <p className={typography.heading.md}>{selectedCompany.companyName}</p>
                      <p className={`${typography.body.sm}`}>{selectedCompany.industry}</p>
                    </div>
                  </div>
                </ProjectModalContainer>
              )}

              {loading ? (
                <InlineLoading message="Φόρτωση έργων..." type="card" />
              ) : error ? (
                <ModalErrorState message={`Σφάλμα φόρτωσης έργων: ${error}`} />
              ) : (
                <Select value={selectedProjectId} onValueChange={handleProjectChange}>
                  <SelectTrigger className={getSelectStyles().trigger}>
                    <SelectValue placeholder="-- Επιλέξτε Έργο --" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                          <Folder className={`${getIconSize('field')} ${getModalIconColor('info')}`} />
                          <span>{project.name}</span>
                          {project.buildings?.length > 0 && (
                            <span className={typography.body.sm}>({project.buildings.length} κτίρια)</span>
                          )}
                        </div>
                      </SelectItem>
                    )) || []}
                  </SelectContent>
                </Select>
              )}

              {(!projects || projects.length === 0) && !loading && !error && selectedCompany && (
                <ProjectModalContainer title="" className={getModalContainerBorder('default')}>
                  <p className={`${typography.body.sm}`}>Δεν βρέθηκαν έργα για την επιλεγμένη εταιρεία.</p>
                </ProjectModalContainer>
              )}
            </div>
          )}

          {/* Building Selection - Step 3 */}
          {currentStep === 'building' && (
            <div className={MODAL_SPACING.SECTIONS.betweenSections}>
              <label className={`block ${typography.label.sm} ${MODAL_SPACING.SECTIONS.betweenItems}`}>
                Επιλογή Κτιρίου
              </label>

              {/* Selected Company & Project Info */}
              {selectedCompany && selectedProject && (
                <div className={`${MODAL_SPACING.SECTIONS.betweenSections} ${MODAL_FLEX_PATTERNS.COLUMN.stretchWithGap}`}>
                  <ProjectModalContainer
                    title=""
                    className={getModalContainerBorder('info')}
                  >
                    <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                      <BuildingIcon className={`${getIconSize('title')} ${getModalIconColor('info')}`} />
                      <div>
                        <p className={typography.heading.md}>{selectedCompany.companyName}</p>
                        <p className={`${typography.body.sm}`}>{selectedCompany.industry}</p>
                      </div>
                    </div>
                  </ProjectModalContainer>
                  <ProjectModalContainer
                    title=""
                    className={getModalContainerBorder('success')}
                  >
                    <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                      <Building2 className={`${getIconSize('title')} ${getModalIconColor('success')}`} />
                      <div>
                        <p className={typography.heading.md}>{selectedProject.name}</p>
                        <p className={`${typography.body.sm}`}>{selectedProject.buildings?.length || 0} κτίρια</p>
                      </div>
                    </div>
                  </ProjectModalContainer>
                </div>
              )}

              {buildings.length > 0 ? (
                <Select value={selectedBuildingId} onValueChange={handleBuildingChange}>
                  <SelectTrigger className={getSelectStyles().trigger}>
                    <SelectValue placeholder="-- Επιλέξτε Κτίριο --" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings?.map(building => (
                      <SelectItem key={building.id} value={building.id}>
                        <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                          <Building2 className={`${getIconSize('field')} ${getModalIconColor('warning')}`} />
                          <span>{building.name}</span>
                          {building.floors && (
                            <span className={typography.body.sm}>({building.floors.length} όροφοι)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <ProjectModalContainer title="" className={getModalContainerBorder('default')}>
                  <p className={`${typography.body.sm}`}>Δεν βρέθηκαν κτίρια για το επιλεγμένο έργο.</p>
                </ProjectModalContainer>
              )}
            </div>
          )}

          {/* Status */}
          <div className={MODAL_FLEX_PATTERNS.COLUMN.center}>
            {currentStep === 'company' && companies.length > 0 && !loading && (
              <p className={`${typography.body.sm}`}>Βρέθηκαν {companies.length} διαθέσιμες εταιρείες</p>
            )}
            {currentStep === 'project' && projects.length > 0 && !loading && (
              <p className={`${typography.body.sm}`}>Βρέθηκαν {projects.length} έργα για την επιλεγμένη εταιρεία</p>
            )}
            {currentStep === 'building' && buildings.length > 0 && (
              <p className={`${typography.body.sm}`}>Βρέθηκαν {buildings.length} κτίρια για το επιλεγμένο έργο</p>
            )}
            {currentStep === 'unit' && units.length > 0 && (
              <p className={`${typography.body.sm}`}>Βρέθηκαν {units.length} μονάδες για το επιλεγμένο κτίριο</p>
            )}
          </div>

          {/* Floorplan Options - Only shown when project is selected */}
          {currentStep === 'project' && selectedProjectId && (
            <ProjectModalContainer title="Επιλέξτε Κάτοψη για Φόρτωση" className={`${MODAL_SPACING.SECTIONS.betweenBlocks} ${getModalContainerBorder('default')}`}>
              <ModalActions alignment="center">
                <Button
                  onClick={() => handleLoadFloorplan('project')}
                  variant="default"
                  size="default"
                  className={MODAL_DIMENSIONS.BUTTONS.flex}
                >
                  Κάτοψη Έργου
                </Button>
                <Button
                  onClick={() => handleLoadFloorplan('parking')}
                  variant="default"
                  size="default"
                  className={`${MODAL_DIMENSIONS.BUTTONS.flex} ${colors.bg.success} hover:${colors.bg.success}`}
                >
                  Κάτοψη Θ.Σ.
                </Button>
              </ModalActions>
              <p className={`${typography.body.sm} ${MODAL_FLEX_PATTERNS.COLUMN.center} ${MODAL_SPACING.CONTAINER.paddingSmall}`}>
                Η κάτοψη θα φορτωθεί στον καμβά και στην αντίστοιχη καρτέλα του έργου
              </p>
            </ProjectModalContainer>
          )}

          {/* Building Floorplan Options - Only shown when building is selected */}
          {currentStep === 'building' && selectedBuildingId && (
            <ProjectModalContainer title="Επιλέξτε Κάτοψη Κτιρίου για Φόρτωση" className={`${MODAL_SPACING.SECTIONS.betweenBlocks} ${getModalContainerBorder('default')}`}>
              <ModalActions alignment="center">
                <Button
                  onClick={() => handleLoadFloorplan('building')}
                  variant="default"
                  size="default"
                  className={MODAL_DIMENSIONS.BUTTONS.flex}
                >
                  Κάτοψη Κτιρίου
                </Button>
                <Button
                  onClick={() => handleLoadFloorplan('storage')}
                  variant="default"
                  size="default"
                  className={`${MODAL_DIMENSIONS.BUTTONS.flex} ${colors.bg.success} hover:${colors.bg.success}`}
                >
                  Κάτοψη Αποθηκών
                </Button>
              </ModalActions>
              <p className={`${typography.body.sm} ${MODAL_FLEX_PATTERNS.COLUMN.center} ${MODAL_SPACING.CONTAINER.paddingSmall}`}>
                Η κάτοψη θα φορτωθεί στον καμβά και στη διαχείριση κτιρίων
              </p>
            </ProjectModalContainer>
          )}

          {/* Step 4: Unit Selection - Only shown when in unit step */}
          {currentStep === 'unit' && (
            <div className={MODAL_SPACING.SECTIONS.betweenBlocks}>
              <h3 className={`${typography.heading.md} ${MODAL_SPACING.SECTIONS.betweenItems}`}>Βήμα 4: Επιλογή Μονάδας</h3>
              
              {/* Hierarchy Display */}
              <div className={`${MODAL_SPACING.SPACE.blockMedium} ${MODAL_SPACING.SECTIONS.betweenSections}`}>
                <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                  <span className={`${typography.label.sm}`}>Εταιρεία:</span>
                  <span className={getModalIconColor('info')}>{companies?.find(c => c.id === selectedCompanyId)?.companyName}</span>
                </div>
                <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                  <span className={`${typography.label.sm}`}>Έργο:</span>
                  <span className={getModalIconColor('success')}>{projects?.find(p => p.id === selectedProjectId)?.name}</span>
                </div>
                <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                  <span className={`${typography.label.sm}`}>Κτίριο:</span>
                  <span className={getModalIconColor('warning')}>{buildings?.find(b => b.id === selectedBuildingId)?.name}</span>
                </div>
              </div>

              {/* Units Selection */}
              {units.length > 0 ? (
                <Select value={selectedUnitId} onValueChange={handleUnitChange}>
                  <SelectTrigger className={getSelectStyles().trigger}>
                    <SelectValue placeholder="-- Επιλέξτε Μονάδα --" />
                  </SelectTrigger>
                  <SelectContent>
                    {units?.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>
                        <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                          <Home className={`${getIconSize('field')} ${getModalIconColor('upload')}`} />
                          <span>{unit.name || unit.unitName}</span>
                          {unit.type && (
                            <span className={typography.body.sm}>({unit.type})</span>
                          )}
                          {unit.floor && (
                            <span className={typography.body.sm}>- {unit.floor}ος όροφος</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <ProjectModalContainer title="" className={getModalContainerBorder('default')}>
                  <p className={`${typography.body.sm}`}>Δεν βρέθηκαν μονάδες για το επιλεγμένο κτίριο.</p>
                </ProjectModalContainer>
              )}
            </div>
          )}

          {/* Unit Floorplan Options - Only shown when unit is selected */}
          {currentStep === 'unit' && selectedUnitId && (
            <ProjectModalContainer title="Επιλέξτε Κάτοψη Μονάδας για Φόρτωση" className={`${MODAL_SPACING.SECTIONS.betweenBlocks} ${getModalContainerBorder('default')}`}>
              <ModalActions alignment="center">
                <Button
                  onClick={() => handleLoadFloorplan('unit')}
                  variant="default"
                  size="default"
                  className={`${MODAL_DIMENSIONS.BUTTONS.flex} ${colors.bg.warning} hover:${colors.bg.warning}`}
                >
                  Κάτοψη Μονάδας
                </Button>
              </ModalActions>
              <p className={`${typography.body.sm} ${MODAL_FLEX_PATTERNS.COLUMN.center} ${MODAL_SPACING.CONTAINER.paddingSmall}`}>
                Η κάτοψη θα φορτωθεί στον καμβά και στη διαχείριση μονάδων
              </p>
            </ProjectModalContainer>
          )}
        </main>

          <DialogFooter className={MODAL_FLEX_PATTERNS.ROW.between}>
            <Button
              variant="outline"
              onClick={currentStep === 'company' ? handleClose : handleBack}
            >
              {currentStep === 'company' ? 'Ακύρωση' : '← Προηγούμενο'}
            </Button>

            {currentStep === 'company' && (
              <Button
                onClick={handleNext}
                disabled={!selectedCompanyId}
              >
                Επόμενο →
              </Button>
            )}

            {currentStep === 'project' && (
              <Button
                onClick={handleNext}
                disabled={!selectedProjectId}
              >
                Επόμενο →
              </Button>
            )}

            {currentStep === 'building' && (
              <Button
                onClick={handleNext}
                disabled={!selectedBuildingId}
              >
                Επόμενο →
              </Button>
            )}

            {currentStep === 'unit' && (
              <Button
                onClick={() => console.log('Ready for unit floorplan selection:', selectedUnitId)}
                disabled={!selectedUnitId}
              >
                Έτοιμο
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DXF Import Modal - Nested Modal */}
      <DxfImportModal
        isOpen={showDxfModal}
        onClose={() => setShowDxfModal(false)}
        onImport={handleDxfImportFromModal}
      />
    </>
  );
}