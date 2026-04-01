'use client';
import { useState } from 'react';
import type { Building, Floor } from '../contexts/ProjectHierarchyContext';
import { useFloorplan } from '../../../contexts/FloorplanContext';
import { dxfImportService } from '../io/dxf-import';
import { FloorplanService, type FloorplanData } from '../../../services/floorplans/FloorplanService';
import { BuildingFloorplanService } from '../../../services/floorplans/BuildingFloorplanService';
import { PropertyFloorplanService, type PropertyFloorplanData } from '../../../services/floorplans/PropertyFloorplanService';
import { FloorFloorplanService } from '../../../services/floorplans/FloorFloorplanService';
import { useAuth } from '@/auth/contexts/AuthContext';
import { resolveCompanyIdForBuilding } from '@/services/company-id-resolver';
import { usePdfBackgroundStore } from '../pdf-background/stores/pdfBackgroundStore';
import { unifiedSceneManager } from '../managers/SceneUpdateManager';
import { PANEL_LAYOUT } from '../config/panel-tokens';
import { dlog, dwarn, derr } from '../debug';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { SceneModel } from '../types/scene';

type DialogStep = 'company' | 'project' | 'building' | 'property';
type FloorplanType = 'project' | 'parking' | 'building' | 'storage' | 'property' | 'floor';

interface UseFloorplanImportParams {
  selectedProjectId: string;
  selectedBuildingId: string;
  selectedUnitId: string;
  selectedFloorId: string;
  selectedCompanyId: string;
  currentStep: DialogStep;
  buildings: Building[];
  floors: Floor[];
  onFileImport?: (file: File) => Promise<void>;
  onClose: () => void;
}

/**
 * Custom hook encapsulating all floorplan import logic (DXF + PDF).
 * Extracted from SimpleProjectDialog for SRP compliance (N.7.1).
 */
export function useFloorplanImport(params: UseFloorplanImportParams) {
  const {
    selectedProjectId, selectedBuildingId, selectedUnitId,
    selectedFloorId, selectedCompanyId, currentStep,
    buildings, floors, onFileImport, onClose,
  } = params;

  const { t } = useTranslation('dxf-viewer');
  const { user } = useAuth();
  const { setProjectFloorplan, setParkingFloorplan } = useFloorplan();
  const { loadPdf: loadPdfToBackground, setEnabled: setPdfEnabled, unloadPdf } = usePdfBackgroundStore();

  // DXF Import Modal state
  const [showDxfModal, setShowDxfModal] = useState(false);
  const [currentFloorplanType, setCurrentFloorplanType] = useState<FloorplanType>('project');

  // Replacement confirmation state
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<{
    file: File;
    encoding: string;
    type: FloorplanType;
    typeLabel: string;
  } | null>(null);

  // ── DXF Parsing ──────────────────────────────────────────────
  const parseDxfForProjectTab = async (file: File, encoding?: string): Promise<SceneModel | null> => {
    try {
      const result = await dxfImportService.importDxfFile(file, encoding);
      if (result.success && result.scene) {
        return result.scene;
      }
      dwarn('ProjectDialog', '⚠️ DXF parsing failed for project tab:', result.error);
      return null;
    } catch (error) {
      derr('ProjectDialog', '❌ Error parsing DXF for project tab:', error);
      return null;
    }
  };

  // ── Context Update Helper ────────────────────────────────────
  const updateFloorplanContext = (
    type: FloorplanType,
    data: FloorplanData
  ) => {
    if (type === 'project') {
      setProjectFloorplan(selectedProjectId, {
        projectId: data.projectId,
        type: 'project',
        fileType: data.fileType,
        scene: data.scene,
        pdfImageUrl: data.pdfImageUrl,
        pdfDimensions: data.pdfDimensions,
        fileName: data.fileName,
        timestamp: data.timestamp,
      });
    } else if (type === 'parking') {
      setParkingFloorplan(selectedProjectId, {
        projectId: data.projectId,
        type: 'parking',
        fileType: data.fileType,
        scene: data.scene,
        pdfImageUrl: data.pdfImageUrl,
        pdfDimensions: data.pdfDimensions,
        fileName: data.fileName,
        timestamp: data.timestamp,
      });
    }
  };

  // ── CompanyId Helper ─────────────────────────────────────────
  const resolveCompanyId = () =>
    resolveCompanyIdForBuilding({
      buildingId: selectedBuildingId, buildings, user, selectedCompanyId,
    });

  // ── DXF Import ───────────────────────────────────────────────
  const performFloorplanImport = async (
    file: File, encoding: string, type: FloorplanType
  ) => {
    dlog('ProjectDialog', '🔺 Clearing PDF background before loading DXF...');
    unloadPdf();
    setPdfEnabled(false);

    if (onFileImport) {
      await onFileImport(file);
    } else {
      dwarn('ProjectDialog', '🔺 onFileImport callback not provided!');
    }

    const scene = await parseDxfForProjectTab(file, encoding);
    if (!scene) {
      dwarn('ProjectDialog', '⚠️ Could not parse DXF for project tab - no scene data');
      setShowDxfModal(false);
      onClose();
      return;
    }

    const projectFloorplanData: FloorplanData = {
      projectId: selectedProjectId,
      buildingId: currentStep === 'building' ? selectedBuildingId : undefined,
      type: type as FloorplanData['type'],
      fileType: 'dxf',
      scene: scene as unknown as FloorplanData['scene'],
      pdfImageUrl: null,
      pdfDimensions: null,
      fileName: file.name,
      timestamp: Date.now(),
    };

    let saved = false;
    const createdBy = user?.uid;

    if (currentStep === 'property' && type === 'property') {
      const unitData = {
        propertyId: selectedUnitId, type: 'property' as const,
        scene: scene as unknown as PropertyFloorplanData['scene'],
        fileName: file.name, timestamp: Date.now(),
      };
      const { companyId } = resolveCompanyId();
      saved = await PropertyFloorplanService.saveFloorplan({
        companyId, projectId: selectedProjectId || undefined,
        buildingId: selectedBuildingId, propertyId: selectedUnitId,
        data: unitData, createdBy: createdBy || '', originalFile: file,
      });
      if (saved) {
        apiClient.post(API_ROUTES.PROPERTIES.ACTIVITY(selectedUnitId), {
          action: 'updated',
          changes: [{ field: 'floorplan', oldValue: null, newValue: file.name, label: 'Κάτοψη μονάδας' }],
        }).catch(() => { /* fire-and-forget */ });
      }
    } else if (currentStep === 'building' && type === 'floor' && selectedFloorId) {
      const selectedFloorData = floors.find(f => f.id === selectedFloorId);
      const floorData = {
        buildingId: selectedBuildingId, floorId: selectedFloorId,
        floorNumber: selectedFloorData?.number || 0, type: 'floor' as const,
        scene, fileName: file.name, timestamp: Date.now(),
      };
      const { companyId } = resolveCompanyId();
      if (companyId && createdBy) {
        saved = await FloorFloorplanService.saveFloorplan({
          companyId, projectId: selectedProjectId || undefined,
          buildingId: selectedBuildingId, floorId: selectedFloorId,
          floorNumber: selectedFloorData?.number, data: floorData, createdBy,
        });
      }
    } else if (currentStep === 'building' && (type === 'building' || type === 'storage')) {
      const buildingData = {
        buildingId: selectedBuildingId, type: type as 'building' | 'storage',
        scene, fileName: file.name, timestamp: Date.now(),
      };
      const { companyId } = resolveCompanyId();
      const fileRecordOptions = companyId && createdBy
        ? { companyId, projectId: selectedProjectId || undefined, createdBy, originalFile: file }
        : undefined;
      saved = await BuildingFloorplanService.saveFloorplan(
        selectedBuildingId, type as 'building' | 'storage', buildingData, fileRecordOptions
      );
    } else {
      saved = await FloorplanService.saveFloorplan(
        selectedProjectId, type as 'project' | 'parking', projectFloorplanData
      );
    }

    if (saved) {
      updateFloorplanContext(type, projectFloorplanData);
    } else {
      derr('ProjectDialog', `❌ Failed to save ${type} floorplan to Firestore`);
    }

    setShowDxfModal(false);
    onClose();
  };

  // ── PDF Import ───────────────────────────────────────────────
  const performPdfFloorplanImport = async (file: File, type: FloorplanType) => {
    dlog('ProjectDialog', '📄 Performing PDF floorplan import:', file.name, type);
    unifiedSceneManager.resetScene('pdf-import');
    await loadPdfToBackground(file);
    setPdfEnabled(true);

    await new Promise(resolve => setTimeout(resolve, PANEL_LAYOUT.TIMING.OBSERVER_RETRY));

    const pdfState = usePdfBackgroundStore.getState();
    const pdfImageUrl = pdfState.renderedImageUrl;
    const pdfDimensions = pdfState.pageDimensions;

    if (!pdfImageUrl) {
      derr('ProjectDialog', '❌ PDF rendering failed - no image URL');
      return;
    }

    if (pdfImageUrl.length > 900000) {
      const sizeMB = (pdfImageUrl.length / (1024 * 1024)).toFixed(2);
      dwarn('ProjectDialog', '⚠️ PDF image is very large:', sizeMB, 'MB');
    }

    const floorplanData: FloorplanData = {
      projectId: selectedProjectId,
      buildingId: currentStep === 'building' ? selectedBuildingId : undefined,
      type: type as FloorplanData['type'],
      fileType: 'pdf',
      scene: null,
      pdfImageUrl,
      pdfDimensions: pdfDimensions ? { width: pdfDimensions.width, height: pdfDimensions.height } : null,
      fileName: file.name,
      timestamp: Date.now(),
    };

    let saved = false;
    const createdBy = user?.uid;

    if (currentStep === 'building' && type === 'floor' && selectedFloorId) {
      const selectedFloorData = floors.find(f => f.id === selectedFloorId);
      const floorData = {
        buildingId: selectedBuildingId, floorId: selectedFloorId,
        floorNumber: selectedFloorData?.number || 0, type: 'floor' as const,
        fileType: 'pdf' as const, scene: null, pdfImageUrl, pdfDimensions,
        fileName: file.name, timestamp: Date.now(),
      };
      const { companyId } = resolveCompanyId();
      if (companyId && createdBy) {
        saved = await FloorFloorplanService.saveFloorplan({
          companyId, projectId: selectedProjectId || undefined,
          buildingId: selectedBuildingId, floorId: selectedFloorId,
          floorNumber: selectedFloorData?.number, data: floorData, createdBy,
        });
      }
    } else if (currentStep === 'building' && (type === 'building' || type === 'storage')) {
      const buildingData = {
        buildingId: selectedBuildingId, type: type as 'building' | 'storage',
        fileType: 'pdf' as const, scene: null, pdfImageUrl, pdfDimensions,
        fileName: file.name, timestamp: Date.now(),
      };
      const { companyId } = resolveCompanyId();
      const opts = companyId && createdBy
        ? { companyId, projectId: selectedProjectId || undefined, createdBy, originalFile: file }
        : undefined;
      saved = await BuildingFloorplanService.saveFloorplan(
        selectedBuildingId, type as 'building' | 'storage', buildingData, opts
      );
    } else {
      saved = await FloorplanService.saveFloorplan(
        selectedProjectId, type as 'project' | 'parking', floorplanData
      );
    }

    if (saved) {
      dlog('ProjectDialog', '✅ PDF floorplan saved to Firestore');
      updateFloorplanContext(type, floorplanData);
    } else {
      derr('ProjectDialog', `❌ Failed to save PDF ${type} floorplan to Firestore`);
    }

    setShowDxfModal(false);
    onClose();
  };

  // ── Existence Check Helper ───────────────────────────────────
  const checkExistingFloorplan = async (type: FloorplanType): Promise<boolean> => {
    if (currentStep === 'property' && type === 'property') {
      const { companyId } = resolveCompanyId();
      return PropertyFloorplanService.hasFloorplan(companyId, selectedUnitId);
    }
    if (currentStep === 'building' && type === 'floor' && selectedFloorId) {
      const { companyId } = resolveCompanyId();
      return FloorFloorplanService.hasFloorplan(companyId, selectedFloorId);
    }
    if (currentStep === 'building' && (type === 'building' || type === 'storage')) {
      return BuildingFloorplanService.hasFloorplan(selectedBuildingId, type as 'building' | 'storage');
    }
    return FloorplanService.hasFloorplan(selectedProjectId, type as 'project' | 'parking');
  };

  // ── Type Labels ──────────────────────────────────────────────
  const getTypeLabel = (type: FloorplanType): string => {
    const labels: Record<FloorplanType, string> = {
      project: t('wizard.floorplanTypes.project'),
      parking: t('wizard.floorplanTypes.parking'),
      building: t('wizard.floorplanTypes.building'),
      storage: t('wizard.floorplanTypes.storage'),
      property: t('wizard.floorplanTypes.property'),
      floor: t('wizard.floorplanTypes.floor'),
    };
    return labels[type];
  };

  // ── Public Handlers ──────────────────────────────────────────
  const handleLoadFloorplan = (type: FloorplanType) => {
    setCurrentFloorplanType(type);
    setShowDxfModal(true);
  };

  const handleDxfImportFromModal = async (file: File, encoding: string) => {
    const type = currentFloorplanType;
    try {
      const hasExisting = await checkExistingFloorplan(type);
      if (hasExisting) {
        setPendingImportData({ file, encoding, type, typeLabel: getTypeLabel(type) });
        setShowReplaceConfirm(true);
        return;
      }
      await performFloorplanImport(file, encoding, type);
    } catch (error) {
      derr('ProjectDialog', `❌ Failed to load ${type} floorplan:`, error);
    }
  };

  const handlePdfImportFromModal = async (file: File) => {
    const type = currentFloorplanType;
    try {
      const hasExisting = await checkExistingFloorplan(type);
      if (hasExisting) {
        setPendingImportData({ file, encoding: 'pdf', type, typeLabel: getTypeLabel(type) });
        setShowReplaceConfirm(true);
        return;
      }
      await performPdfFloorplanImport(file, type);
    } catch (error) {
      derr('ProjectDialog', '❌ Failed to import PDF:', error);
    }
  };

  const handleConfirmedImport = async () => {
    if (!pendingImportData) return;
    setShowReplaceConfirm(false);
    try {
      if (pendingImportData.encoding === 'pdf') {
        await performPdfFloorplanImport(pendingImportData.file, pendingImportData.type);
      } else {
        await performFloorplanImport(pendingImportData.file, pendingImportData.encoding, pendingImportData.type);
      }
    } catch (error) {
      derr('ProjectDialog', '❌ Failed to import floorplan after confirmation:', error);
    } finally {
      setPendingImportData(null);
    }
  };

  const handleCancelImport = () => {
    setShowReplaceConfirm(false);
    setPendingImportData(null);
  };

  return {
    showDxfModal, setShowDxfModal,
    showReplaceConfirm, setShowReplaceConfirm,
    pendingImportData,
    handleLoadFloorplan,
    handleDxfImportFromModal,
    handlePdfImportFromModal,
    handleConfirmedImport,
    handleCancelImport,
  };
}
