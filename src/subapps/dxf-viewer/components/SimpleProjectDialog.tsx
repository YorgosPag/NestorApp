'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Triangle, Building2, Folder, Building as BuildingIcon, Layers, Plus, Info } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjectHierarchy, type Building, type Unit, type Floor } from '../contexts/ProjectHierarchyContext';
import { useFloorplan } from '../../../contexts/FloorplanContext';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { dxfImportService } from '../io/dxf-import';
import { FloorplanService, type FloorplanData } from '../../../services/floorplans/FloorplanService';
import { BuildingFloorplanService } from '../../../services/floorplans/BuildingFloorplanService';
import { UnitFloorplanService, type UnitFloorplanData } from '../../../services/floorplans/UnitFloorplanService';
import { FloorFloorplanService } from '../../../services/floorplans/FloorFloorplanService';
import { useAuth } from '@/hooks/useAuth';
import DxfImportModal from './DxfImportModal';
import type { SceneModel } from '../types/scene';
// 🏢 ENTERPRISE: PDF Background support
import { usePdfBackgroundStore } from '../pdf-background/stores/pdfBackgroundStore';
// 🏢 ENTERPRISE: DXF Scene manager for clearing scene when loading PDF
import { unifiedSceneManager } from '../managers/SceneUpdateManager';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { getModalConfig } from '../config/modal-config';
import {
  ProjectModalContainer,
  ModalActions,
  ErrorModalContainer
} from './modal/ModalContainer';
import { useTypography } from '@/hooks/useTypography';
import { getModalIconColor } from '../config/modal-colors';
import { MODAL_FLEX_PATTERNS, MODAL_DIMENSIONS, MODAL_SPACING, getIconSize } from '../config/modal-layout';
import { getSelectStyles } from '../config/modal-select';
// 🏢 ENTERPRISE: Centralized spacing & timing tokens
import { PANEL_LAYOUT } from '../config/panel-tokens';
import { InlineLoading, ModalErrorState } from './modal/ModalLoadingStates';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface SimpleProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFileImport?: (file: File) => Promise<void>;
}

type DialogStep = 'company' | 'project' | 'building' | 'unit';

export function SimpleProjectDialog({ isOpen, onClose, onFileImport }: SimpleProjectDialogProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('dxf-viewer');
  const { user } = useAuth();

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

  // ✅ ENTERPRISE FIX: Only borders, NO background colors
  // Background is handled by ModalContainer dark-theme variants
  const getModalContainerBorder = (variant: 'default' | 'info' | 'success' | 'warning' | 'error') => {
    // ✅ REMOVED: Background colors that were overriding dark theme
    // Now only returns border styling - background comes from ModalContainer
    return getStatusBorder(variant);
  };

  const { setProjectFloorplan, setParkingFloorplan } = useFloorplan();

  // 🏢 ENTERPRISE: PDF Background store for loading PDF files
  const { loadPdf: loadPdfToBackground, setEnabled: setPdfEnabled, unloadPdf } = usePdfBackgroundStore();

  const [currentStep, setCurrentStep] = useState<DialogStep>('company');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [units, setUnits] = useState<Unit[]>([]);
  // 🏢 ENTERPRISE (2026-01-31): Floor selection state for floor-level floorplans
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [floors, setFloors] = useState<Floor[]>([]);

  // 🏢 ADR-179: Inline floor creation state
  const [newFloorName, setNewFloorName] = useState<string>('');
  const [isCreatingFloor, setIsCreatingFloor] = useState(false);

  // DXF Import Modal state
  const [showDxfModal, setShowDxfModal] = useState(false);
  const [currentFloorplanType, setCurrentFloorplanType] = useState<'project' | 'parking' | 'building' | 'storage' | 'unit' | 'floor'>('project');

  // ✅ ENTERPRISE: Controlled AlertDialog state for floorplan replacement confirmation
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<{
    file: File;
    encoding: string;
    type: 'project' | 'parking' | 'building' | 'storage' | 'unit' | 'floor';
    typeLabel: string;
  } | null>(null);

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

  // 🏢 ENTERPRISE: Auto-load companies when dialog opens
  // CRITICAL: Include error in dependencies to prevent infinite loop on authentication errors
  useEffect(() => {
    // Only attempt to load if:
    // 1. Dialog is open
    // 2. No companies loaded yet
    // 3. Not currently loading
    // 4. No previous error (prevents infinite retry loop)
    if (isOpen && (!companies || companies.length === 0) && !loading && !error) {
      console.log('🔄 [SimpleProjectDialog] Loading companies - dialog opened');
      loadCompanies();
    }
  }, [isOpen, companies?.length, loading, error, loadCompanies]);

  // Reset selection when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('company');
      setSelectedCompanyId('');
      setSelectedProjectId('');
      setSelectedBuildingId('');
      setBuildings([]);
      // 🏢 ENTERPRISE (2026-01-31): Reset floor state
      setSelectedFloorId('');
      setFloors([]);
    }
  }, [isOpen]);

  /**
   * 🏢 ENTERPRISE (2026-01-31): Load buildings for project from Firestore collection
   * Buildings are stored in a separate 'buildings' collection with projectId foreign key
   */
  const loadBuildingsForProject = async (projectId: string) => {
    try {
      console.log(`🔄 [SimpleProjectDialog] Loading buildings for project: ${projectId}`);

      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface BuildingsApiResponse {
        buildings: Building[];
        count: number;
      }

      const result = await apiClient.get<BuildingsApiResponse>(`/api/buildings?projectId=${projectId}`);

      if (result?.buildings && result.buildings.length > 0) {
        setBuildings(result.buildings);
        console.log(`✅ [SimpleProjectDialog] Loaded ${result.buildings.length} buildings for project`);
      } else {
        setBuildings([]);
        console.log(`⚠️ [SimpleProjectDialog] No buildings found for project: ${projectId}`);
      }
    } catch (error) {
      console.error('❌ [SimpleProjectDialog] Error loading buildings for project:', error);
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
      // 🏢 ENTERPRISE (2026-01-31): Load floors from separate Firestore collection via API
      await loadFloorsForBuilding(buildingId);
    } else {
      setUnits([]);
      setSelectedUnitId('');
      setFloors([]);
      setSelectedFloorId('');
    }
  };

  /**
   * 🏢 ENTERPRISE (2026-01-31): Load floors for building from Firestore collection
   * Floors are stored in a separate 'floors' collection with buildingId foreign key
   */
  const loadFloorsForBuilding = async (buildingId: string) => {
    try {
      console.log(`🔄 [SimpleProjectDialog] Loading floors for building: ${buildingId}`);

      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface FloorsApiResponse {
        floors: Floor[];
        count: number;
      }

      const result = await apiClient.get<FloorsApiResponse>(`/api/floors?buildingId=${buildingId}`);

      if (result?.floors && result.floors.length > 0) {
        setFloors(result.floors);
        console.log(`✅ [SimpleProjectDialog] Loaded ${result.floors.length} floors for building`);
      } else {
        setFloors([]);
        console.log(`⚠️ [SimpleProjectDialog] No floors found for building: ${buildingId}`);
      }
    } catch (error) {
      console.error('❌ [SimpleProjectDialog] Error loading floors for building:', error);
      setFloors([]);
    }
  };

  const loadUnitsForBuilding = async (buildingId: string) => {
    try {
      console.log(`🔄 [SimpleProjectDialog] Loading units for building: ${buildingId}`);

      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface UnitsApiResponse {
        units: Unit[];
        count: number;
      }

      const result = await apiClient.get<UnitsApiResponse>('/api/units');

      // Filter units that belong to the selected building
      const buildingUnits = (result?.units || []).filter((unit: Unit) =>
        unit.buildingId === buildingId || unit.building === buildingId
      );

      setUnits(buildingUnits);
      console.log(`✅ [SimpleProjectDialog] Loaded ${buildingUnits.length} units for building`);

      if (buildingUnits.length === 0) {
        const allBuildingIds = [...new Set((result?.units || []).map((u: Unit) => u.buildingId))];
        console.log(`⚠️ [SimpleProjectDialog] No units found. Available building IDs:`, allBuildingIds);
      }
    } catch (error) {
      console.error('❌ [SimpleProjectDialog] Error loading units for building:', error);
      setUnits([]);
    }
  };

  const handleUnitChange = (unitId: string) => {

    setSelectedUnitId(unitId);
  };

  // 🏢 ENTERPRISE (2026-01-31): Floor selection handler
  const handleFloorChange = (floorId: string) => {
    console.log(`🏢 [SimpleProjectDialog] Floor selected: ${floorId}`);
    setSelectedFloorId(floorId);
  };

  /**
   * 🏢 ADR-179: Inline floor creation — creates a floor via POST /api/floors
   * and refreshes the floors list for the current building.
   */
  const handleCreateFloorInline = useCallback(async () => {
    if (!newFloorName.trim() || !selectedBuildingId || !selectedProjectId) return;

    setIsCreatingFloor(true);
    try {
      interface CreateFloorApiResponse {
        success: boolean;
        floor: Floor;
        message?: string;
        error?: string;
      }

      const result = await apiClient.post<CreateFloorApiResponse>('/api/floors', {
        number: floors.length,
        name: newFloorName.trim(),
        buildingId: selectedBuildingId,
        projectId: selectedProjectId,
      });

      if (result?.success && result.floor) {
        console.log(`✅ [ADR-179] Floor created: ${result.floor.id}`);
        // Refresh floors list and auto-select the new floor
        await loadFloorsForBuilding(selectedBuildingId);
        setSelectedFloorId(result.floor.id);
        setNewFloorName('');
      } else {
        console.error('❌ [ADR-179] Failed to create floor:', result?.error);
      }
    } catch (error) {
      console.error('❌ [ADR-179] Error creating floor:', error);
    } finally {
      setIsCreatingFloor(false);
    }
  }, [newFloorName, selectedBuildingId, selectedProjectId, floors.length]);

  const handleClose = () => {
    setCurrentStep('company');
    setSelectedCompanyId('');
    setSelectedProjectId('');
    setSelectedBuildingId('');
    setBuildings([]);
    setSelectedUnitId('');
    setUnits([]);
    // 🏢 ENTERPRISE (2026-01-31): Reset floor state
    setSelectedFloorId('');
    setFloors([]);
    // 🏢 ADR-179: Reset inline floor creation state
    setNewFloorName('');
    setIsCreatingFloor(false);
    onClose();
  };

  // ✅ ENTERPRISE: Inner function to perform the actual import (used by both fresh import and confirmed replacement)
  const performFloorplanImport = async (file: File, encoding: string, type: 'project' | 'parking' | 'building' | 'storage' | 'unit' | 'floor') => {
    // 🏢 ENTERPRISE: Clear PDF background when loading DXF (only one floorplan at a time)
    console.log('🔺 [DXF Import] Clearing PDF background before loading DXF...');
    unloadPdf();
    setPdfEnabled(false);

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

      // 🏢 ENTERPRISE: Create compatible floorplan data for FloorplanService
      const projectFloorplanData: FloorplanData = {
        projectId: floorplanData.projectId,
        buildingId: floorplanData.buildingId,
        type: floorplanData.type as 'project' | 'parking' | 'building' | 'storage',
        fileType: 'dxf',
        // 🏢 ENTERPRISE: Cast SceneModel to DxfSceneData via unknown (different structure, compatible at runtime)
        scene: floorplanData.scene as unknown as FloorplanData['scene'],
        pdfImageUrl: null,
        pdfDimensions: null,
        fileName: floorplanData.fileName,
        timestamp: floorplanData.timestamp
      };

      // Save to Firestore (persistent storage) - use appropriate service
      let saved = false;
      if (currentStep === 'unit' && type === 'unit') {
        const unitData = {
          unitId: selectedUnitId,
          type: 'unit' as const,
          scene: scene as unknown as UnitFloorplanData['scene'],
          fileName: file.name,
          timestamp: Date.now()
        };
        saved = await UnitFloorplanService.saveFloorplan(selectedUnitId, unitData);
      } else if (currentStep === 'building' && type === 'floor' && selectedFloorId) {
        // 🏢 ENTERPRISE (2026-01-31): Save floor floorplan
        const selectedFloorData = floors.find(f => f.id === selectedFloorId);
        const floorData = {
          buildingId: selectedBuildingId,
          floorId: selectedFloorId,
          floorNumber: selectedFloorData?.number || 0,
          type: 'floor' as const,
          scene,
          fileName: file.name,
          timestamp: Date.now()
        };
        const createdBy = user?.uid;
        if (selectedCompanyId && createdBy) {
          saved = await FloorFloorplanService.saveFloorplan({
            companyId: selectedCompanyId,
            projectId: selectedProjectId || undefined,
            buildingId: selectedBuildingId,
            floorId: selectedFloorId,
            floorNumber: selectedFloorData?.number,
            data: floorData,
            createdBy
          });
        } else {
          saved = false;
        }
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
        // 🏢 ENTERPRISE: Store in context for immediate access
        // Context uses narrower type for project-level floorplans only
        if (type === 'project') {
          setProjectFloorplan(selectedProjectId, {
            projectId: projectFloorplanData.projectId,
            type: 'project',
            fileType: 'dxf',
            scene: projectFloorplanData.scene,
            pdfImageUrl: null,
            pdfDimensions: null,
            fileName: projectFloorplanData.fileName,
            timestamp: projectFloorplanData.timestamp
          });
        } else if (type === 'parking') {
          setParkingFloorplan(selectedProjectId, {
            projectId: projectFloorplanData.projectId,
            type: 'parking',
            fileType: 'dxf',
            scene: projectFloorplanData.scene,
            pdfImageUrl: null,
            pdfDimensions: null,
            fileName: projectFloorplanData.fileName,
            timestamp: projectFloorplanData.timestamp
          });
        }
      } else {
        console.error(`❌ Failed to save ${type} floorplan to Firestore`);
      }
    } else {
      console.warn('⚠️ Could not parse DXF for project tab - no scene data');
    }

    // Close modals after processing
    setShowDxfModal(false);
    handleClose();
  };

  // ✅ ENTERPRISE: Handler for confirmed replacement (called from AlertDialog)
  const handleConfirmedImport = async () => {
    if (!pendingImportData) return;

    setShowReplaceConfirm(false);

    try {
      // 🏢 ENTERPRISE: Check if this is a PDF import (encoding === 'pdf')
      if (pendingImportData.encoding === 'pdf') {
        await performPdfFloorplanImport(
          pendingImportData.file,
          pendingImportData.type
        );
      } else {
        // DXF import
        await performFloorplanImport(
          pendingImportData.file,
          pendingImportData.encoding,
          pendingImportData.type
        );
      }
    } catch (error) {
      console.error('❌ Failed to import floorplan after confirmation:', error);
    } finally {
      setPendingImportData(null);
    }
  };

  // ✅ ENTERPRISE: Handler for cancelled replacement
  const handleCancelImport = () => {
    setShowReplaceConfirm(false);
    setPendingImportData(null);
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
      } else if (currentStep === 'building' && type === 'floor' && selectedFloorId) {
        // 🏢 ENTERPRISE (2026-01-31): Check for existing floor floorplan
        hasExisting = await FloorFloorplanService.hasFloorplan(selectedBuildingId, selectedFloorId);
      } else if (currentStep === 'building' && (type === 'building' || type === 'storage')) {
        hasExisting = await BuildingFloorplanService.hasFloorplan(selectedBuildingId, type as 'building' | 'storage');
      } else {
        hasExisting = await FloorplanService.hasFloorplan(selectedProjectId, type as 'project' | 'parking');
      }

      // ✅ ENTERPRISE: If floorplan exists, show controlled AlertDialog for confirmation
      if (hasExisting) {
        const typeLabels = {
          project: t('wizard.floorplanTypes.project'),
          parking: t('wizard.floorplanTypes.parking'),
          building: t('wizard.floorplanTypes.building'),
          storage: t('wizard.floorplanTypes.storage'),
          unit: t('wizard.floorplanTypes.unit'),
          floor: t('wizard.floorplanTypes.floor')  // 🏢 ENTERPRISE (2026-01-31): Floor label
        };

        // Store pending data and show confirmation dialog
        setPendingImportData({
          file,
          encoding,
          type,
          typeLabel: typeLabels[type as keyof typeof typeLabels]
        });
        setShowReplaceConfirm(true);
        return; // Wait for user confirmation via AlertDialog
      }

      // ✅ ENTERPRISE: No existing floorplan - proceed directly with import
      await performFloorplanImport(file, encoding, type);

    } catch (error) {
      console.error(`❌ Failed to load ${type} floorplan:`, error);
    }
  };

  const handleLoadFloorplan = (type: 'project' | 'parking' | 'building' | 'storage' | 'unit' | 'floor') => {

    setCurrentFloorplanType(type);
    setShowDxfModal(true);
  };

  /**
   * 🏢 ENTERPRISE: Handle PDF file import from modal
   * Loads PDF as background layer AND saves to FloorplanService for persistent storage
   */
  const handlePdfImportFromModal = async (file: File) => {
    console.log('📄 [SimpleProjectDialog] Importing PDF:', file.name);

    const type = currentFloorplanType;

    try {
      // 🏢 ENTERPRISE: Check if floorplan already exists before proceeding
      let hasExisting = false;

      if (currentStep === 'building' && (type === 'building' || type === 'storage')) {
        hasExisting = await BuildingFloorplanService.hasFloorplan(selectedBuildingId, type as 'building' | 'storage');
      } else {
        hasExisting = await FloorplanService.hasFloorplan(selectedProjectId, type as 'project' | 'parking');
      }

      // If floorplan exists, show confirmation dialog (reuse existing confirmation flow)
      if (hasExisting) {
        const typeLabels = {
          project: t('wizard.floorplanTypes.project'),
          parking: t('wizard.floorplanTypes.parking'),
          building: t('wizard.floorplanTypes.building'),
          storage: t('wizard.floorplanTypes.storage'),
          unit: t('wizard.floorplanTypes.unit')
        };

        // Store pending data with special marker for PDF
        setPendingImportData({
          file,
          encoding: 'pdf', // Special marker for PDF files
          type,
          typeLabel: typeLabels[type as keyof typeof typeLabels]
        });
        setShowReplaceConfirm(true);
        return; // Wait for user confirmation via AlertDialog
      }

      // 🏢 ENTERPRISE: No existing floorplan - proceed directly with PDF import
      await performPdfFloorplanImport(file, type);

    } catch (error) {
      console.error('❌ [SimpleProjectDialog] Failed to import PDF:', error);
    }
  };

  /**
   * 🏢 ENTERPRISE: Perform actual PDF floorplan import
   * Renders PDF, saves to Firestore, and loads to background store
   */
  const performPdfFloorplanImport = async (file: File, type: 'project' | 'parking' | 'building' | 'storage' | 'unit' | 'floor') => {
    console.log('📄 [SimpleProjectDialog] Performing PDF floorplan import:', file.name, type);

    // 🏢 ENTERPRISE: Clear DXF scene when loading PDF (only one floorplan at a time)
    console.log('📄 [PDF Import] Clearing DXF scene before loading PDF...');
    unifiedSceneManager.resetScene('pdf-import');

    // Load PDF to background store (renders the PDF)
    console.log('📄 [PDF Import] Loading PDF to background store...');
    await loadPdfToBackground(file);
    console.log('📄 [PDF Import] loadPdfToBackground completed');

    // Enable PDF background display
    setPdfEnabled(true);

    // 🏢 ENTERPRISE: Small delay to ensure state is committed (Zustand batching)
    await new Promise(resolve => setTimeout(resolve, PANEL_LAYOUT.TIMING.OBSERVER_RETRY));

    // 🏢 ENTERPRISE: Get rendered image and dimensions from store
    const pdfState = usePdfBackgroundStore.getState();
    console.log('📄 [PDF Import] Store state after load:', {
      hasDocumentInfo: !!pdfState.documentInfo,
      hasRenderedImageUrl: !!pdfState.renderedImageUrl,
      isLoading: pdfState.isLoading,
      error: pdfState.error
    });

    const pdfImageUrl = pdfState.renderedImageUrl;
    const pdfDimensions = pdfState.pageDimensions;

    if (!pdfImageUrl) {
      console.error('❌ [SimpleProjectDialog] PDF rendering failed - no image URL');
      console.error('❌ [SimpleProjectDialog] Store error:', pdfState.error);
      return;
    }

    // 🏢 ENTERPRISE: Check if PDF image is too large for Firestore (1MB limit)
    const imageSizeKB = Math.round(pdfImageUrl.length / 1024);
    const imageSizeMB = (pdfImageUrl.length / (1024 * 1024)).toFixed(2);
    console.log('📄 [SimpleProjectDialog] PDF rendered:', {
      hasImageUrl: !!pdfImageUrl,
      dimensions: pdfDimensions,
      imageUrlLength: pdfImageUrl.length,
      imageSizeKB: imageSizeKB,
      imageSizeMB: imageSizeMB
    });

    if (pdfImageUrl.length > 900000) {
      console.warn('⚠️ [SimpleProjectDialog] PDF image is very large:', imageSizeMB, 'MB - may exceed Firestore limit');
    }

    // 🏢 ENTERPRISE: Create FloorplanData for PDF storage
    const floorplanData: FloorplanData = {
      projectId: selectedProjectId,
      buildingId: currentStep === 'building' ? selectedBuildingId : undefined,
      type: type as 'project' | 'parking' | 'building' | 'storage',
      fileType: 'pdf',
      scene: null, // No DXF scene for PDF
      pdfImageUrl: pdfImageUrl,
      pdfDimensions: pdfDimensions ? {
        width: pdfDimensions.width,
        height: pdfDimensions.height
      } : null,
      fileName: file.name,
      timestamp: Date.now()
    };

    // 🏢 ENTERPRISE: Save to Firestore for persistent storage
    let saved = false;
    if (currentStep === 'building' && type === 'floor' && selectedFloorId) {
      // 🏢 ENTERPRISE (2026-01-31): Save floor PDF floorplan
      const selectedFloorData = floors.find(f => f.id === selectedFloorId);
      const floorData = {
        buildingId: selectedBuildingId,
        floorId: selectedFloorId,
        floorNumber: selectedFloorData?.number || 0,
        type: 'floor' as const,
        fileType: 'pdf' as const,
        scene: null,
        pdfImageUrl: pdfImageUrl,
        pdfDimensions: pdfDimensions,
        fileName: file.name,
        timestamp: Date.now()
      };
      const createdBy = user?.uid;
      if (selectedCompanyId && createdBy) {
        saved = await FloorFloorplanService.saveFloorplan({
          companyId: selectedCompanyId,
          projectId: selectedProjectId || undefined,
          buildingId: selectedBuildingId,
          floorId: selectedFloorId,
          floorNumber: selectedFloorData?.number,
          data: floorData,
          createdBy
        });
      } else {
        saved = false;
      }
    } else if (currentStep === 'building' && (type === 'building' || type === 'storage')) {
      const buildingData = {
        buildingId: selectedBuildingId,
        type: type as 'building' | 'storage',
        fileType: 'pdf' as const,
        scene: null,
        pdfImageUrl: pdfImageUrl,
        pdfDimensions: pdfDimensions,
        fileName: file.name,
        timestamp: Date.now()
      };
      saved = await BuildingFloorplanService.saveFloorplan(selectedBuildingId, type as 'building' | 'storage', buildingData);
    } else {
      saved = await FloorplanService.saveFloorplan(selectedProjectId, type as 'project' | 'parking', floorplanData);
    }

    if (saved) {
      console.log('✅ [SimpleProjectDialog] PDF floorplan saved to Firestore');

      // 🏢 ENTERPRISE: Store in context for immediate access
      // Context uses narrower type for project-level floorplans only
      if (type === 'project') {
        setProjectFloorplan(selectedProjectId, {
          projectId: floorplanData.projectId,
          type: 'project',
          fileType: 'pdf',
          scene: null,
          pdfImageUrl: floorplanData.pdfImageUrl,
          pdfDimensions: floorplanData.pdfDimensions,
          fileName: floorplanData.fileName,
          timestamp: floorplanData.timestamp
        });
      } else if (type === 'parking') {
        setParkingFloorplan(selectedProjectId, {
          projectId: floorplanData.projectId,
          type: 'parking',
          fileType: 'pdf',
          scene: null,
          pdfImageUrl: floorplanData.pdfImageUrl,
          pdfDimensions: floorplanData.pdfDimensions,
          fileName: floorplanData.fileName,
          timestamp: floorplanData.timestamp
        });
      }
    } else {
      console.error(`❌ [SimpleProjectDialog] Failed to save PDF ${type} floorplan to Firestore`);
    }

    // Close modals after processing
    setShowDxfModal(false);
    handleClose();
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
                <h1 className={typography.heading.lg}>{t('wizard.title')}</h1>
                <p className={`${typography.body.sm}`}>
                  {t(`wizard.steps.${currentStep}`)}
                </p>
              </section>
            </DialogTitle>
          </DialogHeader>

          {/* 🏢 ENTERPRISE: Accessibility - Screen reader description */}
          <DialogDescription className="sr-only">
            {t('wizard.screenReaderDescription')}
          </DialogDescription>

        {/* Content */}
        <main className={MODAL_SPACING.CONTAINER.padding}>

          {/* Company Selection - Step 1 */}
          {currentStep === 'company' && (
            <fieldset className={MODAL_SPACING.SECTIONS.betweenSections}>
              <legend className={`block ${typography.label.sm} ${MODAL_SPACING.SECTIONS.betweenItems}`}>
                {t('wizard.labels.selectCompany')}
              </legend>

            {loading ? (
              <InlineLoading message={t('wizard.loading.companies')} type="card" />
            ) : error ? (
              <ErrorModalContainer title="">
                <p className={`${typography.body.sm} ${MODAL_SPACING.CONTAINER.paddingSmall}`}>{t('wizard.loading.error', { error })}</p>
                <Button
                  onClick={loadCompanies}
                  variant="destructive"
                  size="sm"
                >
                  {t('wizard.loading.retry')}
                </Button>
              </ErrorModalContainer>
            ) : (
              <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                <SelectTrigger className={getSelectStyles().trigger}>
                  <SelectValue placeholder={t('wizard.placeholders.company')} />
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
                  <p className={`${typography.body.sm}`}>{t('wizard.empty.companies')}</p>
                </ProjectModalContainer>
              )}
            </fieldset>
          )}

          {/* Project Selection - Step 2 */}
          {currentStep === 'project' && (
            <div className={MODAL_SPACING.SECTIONS.betweenSections}>
              <label className={`block ${typography.label.sm} ${MODAL_SPACING.SECTIONS.betweenItems}`}>
                {t('wizard.labels.selectProject')}
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
                <InlineLoading message={t('wizard.loading.projects')} type="card" />
              ) : error ? (
                <ModalErrorState message={t('wizard.loading.projectsError', { error })} />
              ) : (
                <Select value={selectedProjectId} onValueChange={handleProjectChange}>
                  <SelectTrigger className={getSelectStyles().trigger}>
                    <SelectValue placeholder={t('wizard.placeholders.project')} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                          <Folder className={`${getIconSize('field')} ${getModalIconColor('info')}`} />
                          <span>{project.name}</span>
                        </div>
                      </SelectItem>
                    )) || []}
                  </SelectContent>
                </Select>
              )}

              {(!projects || projects.length === 0) && !loading && !error && selectedCompany && (
                <ProjectModalContainer title="" className={getModalContainerBorder('default')}>
                  <p className={`${typography.body.sm}`}>{t('wizard.empty.projects')}</p>
                </ProjectModalContainer>
              )}
            </div>
          )}

          {/* Building Selection - Step 3 */}
          {currentStep === 'building' && (
            <div className={MODAL_SPACING.SECTIONS.betweenSections}>
              <label className={`block ${typography.label.sm} ${MODAL_SPACING.SECTIONS.betweenItems}`}>
                {t('wizard.labels.selectBuilding')}
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
                        <p className={`${typography.body.sm}`}>{t('wizard.counts.buildings', { count: buildings.length })}</p>
                      </div>
                    </div>
                  </ProjectModalContainer>
                </div>
              )}

              {buildings.length > 0 ? (
                <Select value={selectedBuildingId} onValueChange={handleBuildingChange}>
                  <SelectTrigger className={getSelectStyles().trigger}>
                    <SelectValue placeholder={t('wizard.placeholders.building')} />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings?.map(building => (
                      <SelectItem key={building.id} value={building.id}>
                        <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                          <Building2 className={`${getIconSize('field')} ${getModalIconColor('warning')}`} />
                          <span>{building.name}</span>
                          {building.floors && (
                            <span className={typography.body.sm}>({t('wizard.counts.floors', { count: building.floors.length })})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <ProjectModalContainer title="" className={getModalContainerBorder('default')}>
                  <p className={`${typography.body.sm}`}>{t('wizard.empty.buildings')}</p>
                </ProjectModalContainer>
              )}
            </div>
          )}

          {/* Status */}
          <div className={MODAL_FLEX_PATTERNS.COLUMN.center}>
            {currentStep === 'company' && companies.length > 0 && !loading && (
              <p className={`${typography.body.sm}`}>{t('wizard.counts.companiesFound', { count: companies.length })}</p>
            )}
            {currentStep === 'project' && projects.length > 0 && !loading && (
              <p className={`${typography.body.sm}`}>{t('wizard.counts.projectsFound', { count: projects.length })}</p>
            )}
            {currentStep === 'building' && buildings.length > 0 && (
              <p className={`${typography.body.sm}`}>{t('wizard.counts.buildingsFound', { count: buildings.length })}</p>
            )}
            {currentStep === 'unit' && units.length > 0 && (
              <p className={`${typography.body.sm}`}>{t('wizard.counts.unitsFound', { count: units.length })}</p>
            )}
          </div>

          {/* 🏢 ADR-179: Site Plan — single button for project-level site plan/topographic */}
          {currentStep === 'project' && selectedProjectId && (
            <ProjectModalContainer title={t('wizard.floorplanSections.selectForProject')} className={`${MODAL_SPACING.SECTIONS.betweenBlocks} ${getModalContainerBorder('default')}`}>
              <ModalActions alignment="center">
                <Button
                  onClick={() => handleLoadFloorplan('project')}
                  variant="default"
                  size="default"
                  className={MODAL_DIMENSIONS.BUTTONS.flex}
                >
                  {t('wizard.floorplanTypes.sitePlan')}
                </Button>
              </ModalActions>
              <p className={`${typography.body.sm} ${MODAL_FLEX_PATTERNS.COLUMN.center} ${MODAL_SPACING.CONTAINER.paddingSmall}`}>
                {t('wizard.floorplanSections.hintSitePlan')}
              </p>
            </ProjectModalContainer>
          )}

          {/* 🏢 ADR-179: IFC-Compliant Floor Selection — always shown when building is selected */}
          {currentStep === 'building' && selectedBuildingId && (
            <ProjectModalContainer title={t('wizard.floorplanSections.selectFloorAndLoad')} className={`${MODAL_SPACING.SECTIONS.betweenBlocks} ${getModalContainerBorder('info')}`}>
              {floors.length > 0 ? (
                <>
                  {/* Case A: Floors exist — dropdown + load button */}
                  <div className={MODAL_SPACING.SECTIONS.betweenItems}>
                    <label className={`block ${typography.label.sm} ${MODAL_SPACING.SECTIONS.betweenItems}`}>
                      {t('wizard.labels.selectFloor')}
                    </label>
                    <Select value={selectedFloorId} onValueChange={handleFloorChange}>
                      <SelectTrigger className={getSelectStyles().trigger}>
                        <SelectValue placeholder={t('wizard.placeholders.floor')} />
                      </SelectTrigger>
                      <SelectContent>
                        {floors.map(floor => (
                          <SelectItem key={floor.id} value={floor.id}>
                            <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                              <Layers className={`${getIconSize('field')} ${getModalIconColor('info')}`} />
                              <span>{floor.name || t('wizard.counts.floorOrdinal', { floor: floor.number })}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Floor Floorplan Button — only when floor is selected */}
                  {selectedFloorId && (
                    <ModalActions alignment="center">
                      <Button
                        onClick={() => handleLoadFloorplan('floor')}
                        variant="default"
                        size="default"
                        className={MODAL_DIMENSIONS.BUTTONS.flex}
                      >
                        {t('wizard.floorplanTypes.floor')}
                      </Button>
                    </ModalActions>
                  )}
                </>
              ) : (
                <>
                  {/* Case B: No floors — inline creation form */}
                  <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                    <Info className={`${getIconSize('field')} ${getModalIconColor('info')}`} />
                    <p className={typography.body.sm}>
                      {t('wizard.floorplanSections.noFloorsYet')}
                    </p>
                  </div>
                  <div className={`${MODAL_SPACING.SECTIONS.betweenItems} ${MODAL_FLEX_PATTERNS.ROW.centerWithGap}`}>
                    <Input
                      value={newFloorName}
                      onChange={(e) => setNewFloorName(e.target.value)}
                      placeholder={t('wizard.floorplanSections.floorNamePlaceholder')}
                      className={MODAL_DIMENSIONS.BUTTONS.flex}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateFloorInline();
                      }}
                      disabled={isCreatingFloor}
                    />
                    <Button
                      onClick={handleCreateFloorInline}
                      variant="default"
                      size="default"
                      disabled={!newFloorName.trim() || isCreatingFloor}
                    >
                      <Plus className={getIconSize('field')} />
                      {t('wizard.floorplanSections.createFloor')}
                    </Button>
                  </div>
                </>
              )}
              <p className={`${typography.body.sm} ${MODAL_FLEX_PATTERNS.COLUMN.center} ${MODAL_SPACING.CONTAINER.paddingSmall}`}>
                {t('wizard.floorplanSections.hintFloor')}
              </p>
            </ProjectModalContainer>
          )}

          {/* Step 4: Unit Selection - Only shown when in unit step */}
          {currentStep === 'unit' && (
            <div className={MODAL_SPACING.SECTIONS.betweenBlocks}>
              <h3 className={`${typography.heading.md} ${MODAL_SPACING.SECTIONS.betweenItems}`}>{t('wizard.steps.unit')}</h3>

              {/* Hierarchy Display */}
              <div className={`${MODAL_SPACING.SPACE.blockMedium} ${MODAL_SPACING.SECTIONS.betweenSections}`}>
                <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                  <span className={`${typography.label.sm}`}>{t('wizard.labels.company')}</span>
                  <span className={getModalIconColor('info')}>{companies?.find(c => c.id === selectedCompanyId)?.companyName}</span>
                </div>
                <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                  <span className={`${typography.label.sm}`}>{t('wizard.labels.project')}</span>
                  <span className={getModalIconColor('success')}>{projects?.find(p => p.id === selectedProjectId)?.name}</span>
                </div>
                <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                  <span className={`${typography.label.sm}`}>{t('wizard.labels.building')}</span>
                  <span className={getModalIconColor('warning')}>{buildings?.find(b => b.id === selectedBuildingId)?.name}</span>
                </div>
              </div>

              {/* Units Selection */}
              {units.length > 0 ? (
                <Select value={selectedUnitId} onValueChange={handleUnitChange}>
                  <SelectTrigger className={getSelectStyles().trigger}>
                    <SelectValue placeholder={t('wizard.placeholders.unit')} />
                  </SelectTrigger>
                  <SelectContent>
                    {units?.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>
                        <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                          <NAVIGATION_ENTITIES.unit.icon className={`${getIconSize('field')} ${NAVIGATION_ENTITIES.unit.color}`} />
                          <span>{unit.name || unit.unitName}</span>
                          {unit.type && (
                            <span className={typography.body.sm}>({unit.type})</span>
                          )}
                          {unit.floor && (
                            <span className={typography.body.sm}>- {t('wizard.counts.floorOrdinal', { floor: unit.floor })}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <ProjectModalContainer title="" className={getModalContainerBorder('default')}>
                  <p className={`${typography.body.sm}`}>{t('wizard.empty.units')}</p>
                </ProjectModalContainer>
              )}
            </div>
          )}

          {/* Unit Floorplan Options - Only shown when unit is selected */}
          {currentStep === 'unit' && selectedUnitId && (
            <ProjectModalContainer title={t('wizard.floorplanSections.selectForUnit')} className={`${MODAL_SPACING.SECTIONS.betweenBlocks} ${getModalContainerBorder('default')}`}>
              <ModalActions alignment="center">
                <Button
                  onClick={() => handleLoadFloorplan('unit')}
                  variant="default"
                  size="default"
                  className={MODAL_DIMENSIONS.BUTTONS.flex}
                >
                  {t('wizard.floorplanTypes.unit')}
                </Button>
              </ModalActions>
              <p className={`${typography.body.sm} ${MODAL_FLEX_PATTERNS.COLUMN.center} ${MODAL_SPACING.CONTAINER.paddingSmall}`}>
                {t('wizard.floorplanSections.hintUnit')}
              </p>
            </ProjectModalContainer>
          )}
        </main>

          <DialogFooter className={MODAL_FLEX_PATTERNS.ROW.between}>
            <Button
              variant="outline"
              size="default"
              onClick={currentStep === 'company' ? handleClose : handleBack}
            >
              {currentStep === 'company' ? t('wizard.navigation.cancel') : t('wizard.navigation.previous')}
            </Button>

            {currentStep === 'company' && (
              <Button
                variant="default"
                size="default"
                onClick={handleNext}
                disabled={!selectedCompanyId}
              >
                {t('wizard.navigation.next')}
              </Button>
            )}

            {currentStep === 'project' && (
              <Button
                variant="default"
                size="default"
                onClick={handleNext}
                disabled={!selectedProjectId}
              >
                {t('wizard.navigation.next')}
              </Button>
            )}

            {currentStep === 'building' && (
              <Button
                variant="default"
                size="default"
                onClick={handleNext}
                disabled={!selectedBuildingId}
              >
                {t('wizard.navigation.next')}
              </Button>
            )}

            {currentStep === 'unit' && (
              <Button
                variant="default"
                size="default"
                onClick={() => console.log('Ready for unit floorplan selection:', selectedUnitId)}
                disabled={!selectedUnitId}
              >
                {t('wizard.navigation.ready')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DXF/PDF Import Modal - Nested Modal */}
      <DxfImportModal
        isOpen={showDxfModal}
        onClose={() => setShowDxfModal(false)}
        onImport={handleDxfImportFromModal}
        onPdfImport={handlePdfImportFromModal}
        allowPdf
      />

      {/* ✅ ENTERPRISE: Floorplan Replacement Confirmation Dialog */}
      <AlertDialog open={showReplaceConfirm} onOpenChange={setShowReplaceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('wizard.replace.title', { typeLabel: pendingImportData?.typeLabel })}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className={`${PANEL_LAYOUT.SPACING.GAP_MD} ${PANEL_LAYOUT.TYPOGRAPHY.SM} text-muted-foreground`}>
                <p>
                  {t('wizard.replace.existingWarning', { typeLabel: pendingImportData?.typeLabel })}
                </p>
                <p>
                  {t('wizard.replace.layerWarning')}
                </p>
                <p className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>
                  {t('wizard.replace.confirmQuestion')}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelImport}>
              {t('wizard.replace.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedImport}>
              {t('wizard.replace.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
