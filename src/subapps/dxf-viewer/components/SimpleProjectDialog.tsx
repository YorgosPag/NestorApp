'use client';
import React, { useState, useEffect } from 'react';
import { Triangle } from 'lucide-react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useProjectHierarchy, type Building, type Unit, type Floor } from '../contexts/ProjectHierarchyContext';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useAuth } from '@/auth/contexts/AuthContext';
import DxfImportModal from './DxfImportModal';
import { useTypography } from '@/hooks/useTypography';
import { getModalConfig } from '../config/modal-config';
import { getModalIconColor } from '../config/modal-colors';
import { MODAL_FLEX_PATTERNS, MODAL_SPACING, getIconSize } from '../config/modal-layout';
import { PANEL_LAYOUT } from '../config/panel-tokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { dlog, derr } from '../debug';
import { useFloorplanImport } from './useFloorplanImport';
import { CompanyStep, ProjectStep, BuildingStep } from './WizardSteps';
import { UnitStep, StatusCounts, SitePlanSection } from './WizardStepsUnit';

// ── Types ──────────────────────────────────────────────────────
interface SimpleProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFileImport?: (file: File) => Promise<void>;
}

type DialogStep = 'company' | 'project' | 'building' | 'unit';

// ── Component ──────────────────────────────────────────────────
export function SimpleProjectDialog({ isOpen, onClose, onFileImport }: SimpleProjectDialogProps) {
  const { t } = useTranslation('dxf-viewer');
  const { user } = useAuth();
  const colors = useSemanticColors();
  const typography = useTypography();

  const {
    companies, selectedCompany, projects, selectedProject,
    loading, error, loadCompanies, selectCompany,
    loadProjectsForCompany, selectProject, setBuildingDirect, setFloorDirect,
  } = useProjectHierarchy();

  // ── Wizard State ─────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<DialogStep>('company');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState('');
  const [floors, setFloors] = useState<Floor[]>([]);

  // ── Floorplan Import Hook ────────────────────────────────────
  const handleClose = () => {
    setCurrentStep('company');
    setSelectedCompanyId('');
    setSelectedProjectId('');
    setSelectedBuildingId('');
    setBuildings([]);
    setSelectedUnitId('');
    setUnits([]);
    setSelectedFloorId('');
    setFloors([]);
    onClose();
  };

  const floorplanImport = useFloorplanImport({
    selectedProjectId, selectedBuildingId, selectedUnitId,
    selectedFloorId, selectedCompanyId, currentStep,
    buildings, floors, onFileImport, onClose: handleClose,
  });

  // ── Auto-load Companies ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen || loading) return;
    const needsForceRefresh = companies && companies.length > 0;
    dlog('ProjectDialog', `🔄 Loading companies - dialog opened (force=${!!needsForceRefresh})`);
    loadCompanies(!!needsForceRefresh);
  }, [isOpen]); // eslint-disable-line -- intentional: only trigger on dialog open

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('company');
      setSelectedCompanyId('');
      setSelectedProjectId('');
      setSelectedBuildingId('');
      setBuildings([]);
      setSelectedFloorId('');
      setFloors([]);
    }
  }, [isOpen]);

  // ── Data Loading ─────────────────────────────────────────────
  const loadBuildingsForProject = async (projectId: string) => {
    try {
      interface BuildingsApiResponse { buildings: Building[]; count: number; }
      const companyParam = selectedCompanyId ? `&companyId=${selectedCompanyId}` : '';
      const result = await apiClient.get<BuildingsApiResponse>(
        `${API_ROUTES.BUILDINGS.LIST}?projectId=${projectId}${companyParam}`
      );
      setBuildings(result?.buildings?.length ? result.buildings : []);
    } catch (err) {
      derr('ProjectDialog', '❌ Error loading buildings:', err);
      setBuildings([]);
    }
  };

  const loadFloorsForBuilding = async (buildingId: string) => {
    try {
      interface FloorsApiResponse { floors: Floor[]; count: number; }
      const result = await apiClient.get<FloorsApiResponse>(
        `${API_ROUTES.FLOORS.LIST}?buildingId=${buildingId}`
      );
      setFloors(result?.floors?.length ? result.floors : []);
    } catch (err) {
      derr('ProjectDialog', '❌ Error loading floors:', err);
      setFloors([]);
    }
  };

  const loadUnitsForBuilding = async (buildingId: string) => {
    try {
      interface UnitsApiResponse { units: Unit[]; count: number; }
      const params = new URLSearchParams();
      if (selectedCompanyId) params.set('companyId', selectedCompanyId);
      params.set('buildingId', buildingId);
      const result = await apiClient.get<UnitsApiResponse>(
        `${API_ROUTES.UNITS.LIST}?${params.toString()}`
      );
      setUnits(result?.units || []);
    } catch (err) {
      derr('ProjectDialog', '❌ Error loading units:', err);
      setUnits([]);
    }
  };

  // ── Reset helpers ────────────────────────────────────────────
  const resetDownstream = (from: DialogStep) => {
    if (from === 'company' || from === 'project') {
      setSelectedProjectId('');
      setSelectedBuildingId('');
      setBuildings([]);
      setFloors([]);
      setSelectedFloorId('');
      setUnits([]);
      setSelectedUnitId('');
    }
    if (from === 'building') {
      setSelectedBuildingId('');
      setFloors([]);
      setSelectedFloorId('');
      setUnits([]);
      setSelectedUnitId('');
    }
    if (from === 'unit') {
      setSelectedUnitId('');
    }
  };

  // ── Navigation Handlers ──────────────────────────────────────
  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    if (companyId) selectCompany(companyId);
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    if (projectId) selectProject(projectId);
  };

  const handleBuildingChange = async (buildingId: string) => {
    setSelectedBuildingId(buildingId);
    const building = buildings.find(b => b.id === buildingId) ?? null;
    setBuildingDirect(building);
    setFloors([]);
    setSelectedFloorId('');
    setUnits([]);
    setSelectedUnitId('');
    if (buildingId) {
      await loadUnitsForBuilding(buildingId);
      await loadFloorsForBuilding(buildingId);
    }
  };

  const handleUnitChange = (unitId: string) => setSelectedUnitId(unitId);

  const handleFloorChange = (floorId: string) => {
    setSelectedFloorId(floorId);
    const floor = floors.find(f => f.id === floorId) ?? null;
    setFloorDirect(floor);
  };

  const handleNext = async () => {
    if (currentStep === 'company' && selectedCompanyId) {
      setCurrentStep('project');
      resetDownstream('company');
      try { await loadProjectsForCompany(selectedCompanyId); }
      catch (err) { derr('ProjectDialog', '🔺 Failed to load projects:', err); }
    } else if (currentStep === 'project' && selectedProjectId) {
      setCurrentStep('building');
      resetDownstream('building');
      await loadBuildingsForProject(selectedProjectId);
    } else if (currentStep === 'building' && selectedBuildingId) {
      setCurrentStep('unit');
    }
  };

  const handleBack = () => {
    if (currentStep === 'project') {
      setCurrentStep('company');
      resetDownstream('company');
    } else if (currentStep === 'building') {
      setCurrentStep('project');
      resetDownstream('building');
    } else if (currentStep === 'unit') {
      setCurrentStep('building');
      resetDownstream('unit');
    }
  };

  // ── Render ───────────────────────────────────────────────────
  if (!isOpen) return null;
  const modalConfig = getModalConfig('PROJECT_WIZARD');

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className={modalConfig.className} style={{ zIndex: modalConfig.zIndex }}>
          <DialogHeader className={MODAL_SPACING.SPACE.blockMedium}>
            <DialogTitle className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
              <Triangle className={`${getIconSize('title')} ${getModalIconColor('dxf_technical')}`} />
              <section>
                <h1 className={typography.heading.lg}>{t('wizard.title')}</h1>
                <p className={typography.body.sm}>{t(`wizard.steps.${currentStep}`)}</p>
              </section>
            </DialogTitle>
          </DialogHeader>

          <DialogDescription className="sr-only">
            {t('wizard.screenReaderDescription')}
          </DialogDescription>

          <main className={MODAL_SPACING.CONTAINER.padding}>
            {currentStep === 'company' && (
              <CompanyStep
                companies={companies}
                selectedCompanyId={selectedCompanyId}
                loading={loading}
                error={error}
                onCompanyChange={handleCompanyChange}
                onRetry={() => loadCompanies()}
              />
            )}

            {currentStep === 'project' && (
              <ProjectStep
                selectedCompany={selectedCompany}
                projects={projects}
                selectedProjectId={selectedProjectId}
                loading={loading}
                error={error}
                onProjectChange={handleProjectChange}
              />
            )}

            {currentStep === 'building' && (
              <BuildingStep
                selectedCompany={selectedCompany}
                selectedProject={selectedProject}
                buildings={buildings}
                selectedBuildingId={selectedBuildingId}
                floors={floors}
                selectedFloorId={selectedFloorId}
                onBuildingChange={handleBuildingChange}
                onFloorChange={handleFloorChange}
                onLoadFloorplan={floorplanImport.handleLoadFloorplan}
              />
            )}

            <StatusCounts
              currentStep={currentStep}
              companies={companies}
              projects={projects}
              buildings={buildings}
              units={units}
              loading={loading}
            />

            {currentStep === 'project' && selectedProjectId && (
              <SitePlanSection onLoadFloorplan={floorplanImport.handleLoadFloorplan} />
            )}

            {currentStep === 'unit' && (
              <UnitStep
                companies={companies}
                selectedCompanyId={selectedCompanyId}
                projects={projects}
                selectedProjectId={selectedProjectId}
                buildings={buildings}
                selectedBuildingId={selectedBuildingId}
                units={units}
                selectedUnitId={selectedUnitId}
                onUnitChange={handleUnitChange}
                onLoadFloorplan={floorplanImport.handleLoadFloorplan}
              />
            )}
          </main>

          <DialogFooter className={MODAL_FLEX_PATTERNS.ROW.between}>
            <Button
              variant="outline" size="default"
              onClick={currentStep === 'company' ? handleClose : handleBack}
            >
              {currentStep === 'company' ? t('wizard.navigation.cancel') : t('wizard.navigation.previous')}
            </Button>

            {(currentStep === 'company' || currentStep === 'project' || currentStep === 'building') && (
              <Button
                variant="default" size="default"
                onClick={handleNext}
                disabled={
                  (currentStep === 'company' && !selectedCompanyId) ||
                  (currentStep === 'project' && !selectedProjectId) ||
                  (currentStep === 'building' && !selectedBuildingId)
                }
              >
                {t('wizard.navigation.next')}
              </Button>
            )}

            {currentStep === 'unit' && (
              <Button
                variant="default" size="default"
                onClick={() => dlog('ProjectDialog', 'Ready for unit floorplan selection:', selectedUnitId)}
                disabled={!selectedUnitId}
              >
                {t('wizard.navigation.ready')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DXF/PDF Import Modal */}
      <DxfImportModal
        isOpen={floorplanImport.showDxfModal}
        onClose={() => floorplanImport.setShowDxfModal(false)}
        onImport={floorplanImport.handleDxfImportFromModal}
        onPdfImport={floorplanImport.handlePdfImportFromModal}
        allowPdf
      />

      {/* Floorplan Replacement Confirmation */}
      <AlertDialog open={floorplanImport.showReplaceConfirm} onOpenChange={floorplanImport.setShowReplaceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('wizard.replace.title', { typeLabel: floorplanImport.pendingImportData?.typeLabel })}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className={`${PANEL_LAYOUT.SPACING.GAP_MD} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted}`}>
                <p>{t('wizard.replace.existingWarning', { typeLabel: floorplanImport.pendingImportData?.typeLabel })}</p>
                <p>{t('wizard.replace.layerWarning')}</p>
                <p className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('wizard.replace.confirmQuestion')}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={floorplanImport.handleCancelImport}>
              {t('wizard.replace.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={floorplanImport.handleConfirmedImport}>
              {t('wizard.replace.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
