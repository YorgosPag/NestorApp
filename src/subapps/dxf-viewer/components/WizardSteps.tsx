'use client';
import React from 'react';
import { Building2, Folder, Building as BuildingIcon, Layers, Info } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { Building, Floor } from '../contexts/ProjectHierarchyContext';
import { useTypography } from '@/hooks/useTypography';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { getModalIconColor } from '../config/modal-colors';
import { MODAL_FLEX_PATTERNS, MODAL_DIMENSIONS, MODAL_SPACING, getIconSize } from '../config/modal-layout';
import { getSelectStyles } from '../config/modal-select';
import {
  ProjectModalContainer, ModalActions, ErrorModalContainer,
} from './modal/ModalContainer';
import { InlineLoading, ModalErrorState } from './modal/ModalLoadingStates';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ── Shared Types ───────────────────────────────────────────────
interface CompanyData {
  id?: string;
  companyName: string;
  industry?: string;
}

interface ProjectData {
  id: string;
  name: string;
}

// ── Border Helper Hook ─────────────────────────────────────────
function useModalBorder() {
  const { getStatusBorder } = useBorderTokens();
  return (variant: 'default' | 'info' | 'success' | 'warning' | 'error') =>
    getStatusBorder(variant);
}

// ── Step 1: Company Selection ──────────────────────────────────
interface CompanyStepProps {
  companies: CompanyData[];
  selectedCompanyId: string;
  loading: boolean;
  error: string | null;
  onCompanyChange: (id: string) => void;
  onRetry: () => void;
}

export function CompanyStep({
  companies, selectedCompanyId, loading, error, onCompanyChange, onRetry,
}: CompanyStepProps) {
  const { t } = useTranslation('dxf-viewer');
  const typography = useTypography();
  const getBorder = useModalBorder();

  return (
    <fieldset className={MODAL_SPACING.SECTIONS.betweenSections}>
      <legend className={`block ${typography.label.sm} ${MODAL_SPACING.SECTIONS.betweenItems}`}>
        {t('wizard.labels.selectCompany')}
      </legend>

      {loading ? (
        <InlineLoading message={t('wizard.loading.companies')} type="card" />
      ) : error ? (
        <ErrorModalContainer title="">
          <p className={`${typography.body.sm} ${MODAL_SPACING.CONTAINER.paddingSmall}`}>
            {t('wizard.loading.error', { error })}
          </p>
          <Button onClick={onRetry} variant="destructive" size="sm">
            {t('wizard.loading.retry')}
          </Button>
        </ErrorModalContainer>
      ) : (
        <Select value={selectedCompanyId} onValueChange={onCompanyChange}>
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
                    <span className={typography.body.sm}>({company.industry})</span>
                  )}
                </div>
              </SelectItem>
            )) || []}
          </SelectContent>
        </Select>
      )}

      {(!companies || companies.length === 0) && !loading && !error && (
        <ProjectModalContainer title="" className={getBorder('default')}>
          <p className={typography.body.sm}>{t('wizard.empty.companies')}</p>
        </ProjectModalContainer>
      )}
    </fieldset>
  );
}

// ── Step 2: Project Selection ──────────────────────────────────
interface ProjectStepProps {
  selectedCompany: CompanyData | null;
  projects: ProjectData[];
  selectedProjectId: string;
  loading: boolean;
  error: string | null;
  onProjectChange: (id: string) => void;
}

export function ProjectStep({
  selectedCompany, projects, selectedProjectId, loading, error, onProjectChange,
}: ProjectStepProps) {
  const { t } = useTranslation('dxf-viewer');
  const typography = useTypography();
  const getBorder = useModalBorder();

  return (
    <div className={MODAL_SPACING.SECTIONS.betweenSections}>
      <label className={`block ${typography.label.sm} ${MODAL_SPACING.SECTIONS.betweenItems}`}>
        {t('wizard.labels.selectProject')}
      </label>

      {selectedCompany && (
        <ProjectModalContainer title="" className={`${MODAL_SPACING.SECTIONS.betweenItems} ${getBorder('info')}`}>
          <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
            <BuildingIcon className={`${getIconSize('title')} ${getModalIconColor('info')}`} />
            <div>
              <p className={typography.heading.md}>{selectedCompany.companyName}</p>
              <p className={typography.body.sm}>{selectedCompany.industry}</p>
            </div>
          </div>
        </ProjectModalContainer>
      )}

      {loading ? (
        <InlineLoading message={t('wizard.loading.projects')} type="card" />
      ) : error ? (
        <ModalErrorState message={t('wizard.loading.projectsError', { error })} />
      ) : (
        <Select value={selectedProjectId} onValueChange={onProjectChange}>
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
        <ProjectModalContainer title="" className={getBorder('default')}>
          <p className={typography.body.sm}>{t('wizard.empty.projects')}</p>
        </ProjectModalContainer>
      )}
    </div>
  );
}

// ── Step 3: Building Selection ─────────────────────────────────
interface BuildingStepProps {
  selectedCompany: CompanyData | null;
  selectedProject: ProjectData | null;
  buildings: Building[];
  selectedBuildingId: string;
  floors: Floor[];
  selectedFloorId: string;
  onBuildingChange: (id: string) => void;
  onFloorChange: (id: string) => void;
  onLoadFloorplan: (type: 'project' | 'parking' | 'building' | 'storage' | 'unit' | 'floor') => void;
}

export function BuildingStep({
  selectedCompany, selectedProject, buildings, selectedBuildingId,
  floors, selectedFloorId, onBuildingChange, onFloorChange, onLoadFloorplan,
}: BuildingStepProps) {
  const { t } = useTranslation('dxf-viewer');
  const typography = useTypography();
  const getBorder = useModalBorder();

  return (
    <div className={MODAL_SPACING.SECTIONS.betweenSections}>
      <label className={`block ${typography.label.sm} ${MODAL_SPACING.SECTIONS.betweenItems}`}>
        {t('wizard.labels.selectBuilding')}
      </label>

      {/* Company & Project Summary */}
      {selectedCompany && selectedProject && (
        <div className={`${MODAL_SPACING.SECTIONS.betweenSections} ${MODAL_FLEX_PATTERNS.COLUMN.stretchWithGap}`}>
          <ProjectModalContainer title="" className={getBorder('info')}>
            <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
              <BuildingIcon className={`${getIconSize('title')} ${getModalIconColor('info')}`} />
              <div>
                <p className={typography.heading.md}>{selectedCompany.companyName}</p>
                <p className={typography.body.sm}>{selectedCompany.industry}</p>
              </div>
            </div>
          </ProjectModalContainer>
          <ProjectModalContainer title="" className={getBorder('success')}>
            <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
              <Building2 className={`${getIconSize('title')} ${getModalIconColor('success')}`} />
              <div>
                <p className={typography.heading.md}>{selectedProject.name}</p>
                <p className={typography.body.sm}>
                  {t('wizard.counts.buildings', { count: buildings.length })}
                </p>
              </div>
            </div>
          </ProjectModalContainer>
        </div>
      )}

      {/* Building Dropdown */}
      {buildings.length > 0 ? (
        <Select value={selectedBuildingId} onValueChange={onBuildingChange}>
          <SelectTrigger className={getSelectStyles().trigger}>
            <SelectValue placeholder={t('wizard.placeholders.building')} />
          </SelectTrigger>
          <SelectContent>
            {buildings.map(building => (
              <SelectItem key={building.id} value={building.id}>
                <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                  <Building2 className={`${getIconSize('field')} ${getModalIconColor('warning')}`} />
                  <span>{building.name}</span>
                  {building.floors && (
                    <span className={typography.body.sm}>
                      ({t('wizard.counts.floors', { count: building.floors.length })})
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <ProjectModalContainer title="" className={getBorder('default')}>
          <p className={typography.body.sm}>{t('wizard.empty.buildings')}</p>
        </ProjectModalContainer>
      )}

      {/* Building General Floorplan */}
      {selectedBuildingId && (
        <ProjectModalContainer
          title={t('wizard.floorplanSections.selectForBuilding')}
          className={`${MODAL_SPACING.SECTIONS.betweenBlocks} ${getBorder('default')}`}
        >
          <ModalActions alignment="center">
            <Button
              onClick={() => onLoadFloorplan('building')}
              variant="default" size="default"
              className={MODAL_DIMENSIONS.BUTTONS.flex}
            >
              {t('wizard.floorplanTypes.buildingGeneral')}
            </Button>
          </ModalActions>
          <p className={`${typography.body.sm} ${MODAL_FLEX_PATTERNS.COLUMN.center} ${MODAL_SPACING.CONTAINER.paddingSmall}`}>
            {t('wizard.floorplanSections.hintBuilding')}
          </p>
        </ProjectModalContainer>
      )}

      {/* Floor Selection Section */}
      {selectedBuildingId && (
        <FloorSection
          floors={floors}
          selectedFloorId={selectedFloorId}
          onFloorChange={onFloorChange}
          onLoadFloorplan={onLoadFloorplan}
        />
      )}
    </div>
  );
}

// ── Floor Sub-Section ──────────────────────────────────────────
interface FloorSectionProps {
  floors: Floor[];
  selectedFloorId: string;
  onFloorChange: (id: string) => void;
  onLoadFloorplan: (type: 'project' | 'parking' | 'building' | 'storage' | 'unit' | 'floor') => void;
}

function FloorSection({ floors, selectedFloorId, onFloorChange, onLoadFloorplan }: FloorSectionProps) {
  const { t } = useTranslation('dxf-viewer');
  const typography = useTypography();
  const getBorder = useModalBorder();

  return (
    <ProjectModalContainer
      title={t('wizard.floorplanSections.selectFloorAndLoad')}
      className={`${MODAL_SPACING.SECTIONS.betweenBlocks} ${getBorder('info')}`}
    >
      {floors.length > 0 ? (
        <>
          <div className={MODAL_SPACING.SECTIONS.betweenItems}>
            <label className={`block ${typography.label.sm} ${MODAL_SPACING.SECTIONS.betweenItems}`}>
              {t('wizard.labels.selectFloor')}
            </label>
            <Select value={selectedFloorId} onValueChange={onFloorChange}>
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
          {selectedFloorId && (
            <ModalActions alignment="center">
              <Button
                onClick={() => onLoadFloorplan('floor')}
                variant="default" size="default"
                className={MODAL_DIMENSIONS.BUTTONS.flex}
              >
                {t('wizard.floorplanTypes.floor')}
              </Button>
            </ModalActions>
          )}
        </>
      ) : (
        <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
          <Info className={`${getIconSize('field')} ${getModalIconColor('info')}`} />
          <p className={typography.body.sm}>{t('wizard.floorplanSections.noFloorsGuide')}</p>
        </div>
      )}
      <p className={`${typography.body.sm} ${MODAL_FLEX_PATTERNS.COLUMN.center} ${MODAL_SPACING.CONTAINER.paddingSmall}`}>
        {t('wizard.floorplanSections.hintFloor')}
      </p>
    </ProjectModalContainer>
  );
}

// UnitStep, StatusCounts, SitePlanSection → WizardStepsUnit.tsx
