'use client';
import React from 'react';
import { Building2, Folder, Building as BuildingIcon, Layers, Info } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { Building, Floor } from '../contexts/ProjectHierarchyContext';
import { getModalIconColor } from '../config/modal-colors';
import { MODAL_FLEX_PATTERNS, MODAL_SPACING, getIconSize } from '../config/modal-layout';
import { getSelectStyles } from '../config/modal-select/core/styles/select-styles';
import { ProjectModalContainer, ErrorModalContainer } from './modal/ModalContainer';
import { InlineLoading, ModalErrorState } from './modal/ModalLoadingStates';
import {
  useWizardStepChrome, WizardStepSection, CompanySummaryCard,
  WizardEmptyNote, WizardFloorplanAction, WizardLoadButton, WizardHint,
  type CompanyData, type ProjectData, type LoadFloorplan,
} from './modal/wizard-step-chrome';
import { formatBuildingLabel } from '@/lib/entity-formatters';

// ⚠️ Οι κοινοί τύποι, το τρίπτυχο hooks και οι επαναλαμβανόμενες κάρτες ζουν στο
// `./modal/wizard-step-chrome` — ΜΗΝ τα ξαναγράψεις εδώ (N.18 / CHECK 3.28).

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
  const { t, typography } = useWizardStepChrome();

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
        <WizardEmptyNote messageKey="wizard.empty.companies" />
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
  const { t } = useWizardStepChrome();

  return (
    <WizardStepSection labelKey="wizard.labels.selectProject">
      {selectedCompany && (
        <CompanySummaryCard
          company={selectedCompany}
          className={MODAL_SPACING.SECTIONS.betweenItems}
        />
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
        <WizardEmptyNote messageKey="wizard.empty.projects" />
      )}
    </WizardStepSection>
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
  onLoadFloorplan: LoadFloorplan;
}

export function BuildingStep({
  selectedCompany, selectedProject, buildings, selectedBuildingId,
  floors, selectedFloorId, onBuildingChange, onFloorChange, onLoadFloorplan,
}: BuildingStepProps) {
  const { t, typography, getBorder } = useWizardStepChrome();

  return (
    <WizardStepSection labelKey="wizard.labels.selectBuilding">
      {/* Company & Project Summary */}
      {selectedCompany && selectedProject && (
        <div className={`${MODAL_SPACING.SECTIONS.betweenSections} ${MODAL_FLEX_PATTERNS.COLUMN.stretchWithGap}`}>
          <CompanySummaryCard company={selectedCompany} />
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
                  <span>{formatBuildingLabel(building.code, building.name)}</span>
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
        <WizardEmptyNote messageKey="wizard.empty.buildings" />
      )}

      {/* Building General Floorplan */}
      {selectedBuildingId && (
        <WizardFloorplanAction
          titleKey="wizard.floorplanSections.selectForBuilding"
          labelKey="wizard.floorplanTypes.buildingGeneral"
          hintKey="wizard.floorplanSections.hintBuilding"
          target="building"
          onLoadFloorplan={onLoadFloorplan}
        />
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
    </WizardStepSection>
  );
}

// ── Floor Sub-Section ──────────────────────────────────────────
interface FloorSectionProps {
  floors: Floor[];
  selectedFloorId: string;
  onFloorChange: (id: string) => void;
  onLoadFloorplan: LoadFloorplan;
}

function FloorSection({ floors, selectedFloorId, onFloorChange, onLoadFloorplan }: FloorSectionProps) {
  const { t, typography, getBorder } = useWizardStepChrome();

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
            <WizardLoadButton
              target="floor"
              labelKey="wizard.floorplanTypes.floor"
              onLoadFloorplan={onLoadFloorplan}
            />
          )}
        </>
      ) : (
        <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
          <Info className={`${getIconSize('field')} ${getModalIconColor('info')}`} />
          <p className={typography.body.sm}>{t('wizard.floorplanSections.noFloorsGuide')}</p>
        </div>
      )}
      <WizardHint messageKey="wizard.floorplanSections.hintFloor" />
    </ProjectModalContainer>
  );
}

// UnitStep, StatusCounts, SitePlanSection → WizardStepsUnit.tsx
