'use client';
import React from 'react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { Building, Unit } from '../contexts/ProjectHierarchyContext';
import { useTypography } from '@/hooks/useTypography';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { getModalIconColor } from '../config/modal-colors';
import { MODAL_FLEX_PATTERNS, MODAL_DIMENSIONS, MODAL_SPACING, getIconSize } from '../config/modal-layout';
import { getSelectStyles } from '../config/modal-select';
import { ProjectModalContainer, ModalActions } from './modal/ModalContainer';
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

function useModalBorder() {
  const { getStatusBorder } = useBorderTokens();
  return (variant: 'default' | 'info' | 'success' | 'warning' | 'error') =>
    getStatusBorder(variant);
}

// ── Unit Step ──────────────────────────────────────────────────
interface UnitStepProps {
  companies: CompanyData[];
  selectedCompanyId: string;
  projects: ProjectData[];
  selectedProjectId: string;
  buildings: Building[];
  selectedBuildingId: string;
  units: Unit[];
  selectedUnitId: string;
  onUnitChange: (id: string) => void;
  onLoadFloorplan: (type: 'project' | 'parking' | 'building' | 'storage' | 'property' | 'floor') => void;
}

export function UnitStep({
  companies, selectedCompanyId, projects, selectedProjectId,
  buildings, selectedBuildingId, units, selectedUnitId,
  onUnitChange, onLoadFloorplan,
}: UnitStepProps) {
  const { t } = useTranslation('dxf-viewer');
  const typography = useTypography();
  const getBorder = useModalBorder();

  return (
    <>
      <div className={MODAL_SPACING.SECTIONS.betweenBlocks}>
        <h3 className={`${typography.heading.md} ${MODAL_SPACING.SECTIONS.betweenItems}`}>
          {t('wizard.steps.unit')}
        </h3>

        {/* Hierarchy Display */}
        <div className={`${MODAL_SPACING.SPACE.blockMedium} ${MODAL_SPACING.SECTIONS.betweenSections}`}>
          <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
            <span className={typography.label.sm}>{t('wizard.labels.company')}</span>
            <span className={getModalIconColor('info')}>
              {companies?.find(c => c.id === selectedCompanyId)?.companyName}
            </span>
          </div>
          <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
            <span className={typography.label.sm}>{t('wizard.labels.project')}</span>
            <span className={getModalIconColor('success')}>
              {projects?.find(p => p.id === selectedProjectId)?.name}
            </span>
          </div>
          <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
            <span className={typography.label.sm}>{t('wizard.labels.building')}</span>
            <span className={getModalIconColor('warning')}>
              {buildings?.find(b => b.id === selectedBuildingId)?.name}
            </span>
          </div>
        </div>

        {/* Unit Dropdown */}
        {units.length > 0 ? (
          <Select value={selectedUnitId} onValueChange={onUnitChange}>
            <SelectTrigger className={getSelectStyles().trigger}>
              <SelectValue placeholder={t('wizard.placeholders.unit')} />
            </SelectTrigger>
            <SelectContent>
              {units.map(unit => (
                <SelectItem key={unit.id} value={unit.id}>
                  <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                    <NAVIGATION_ENTITIES.property.icon
                      className={`${getIconSize('field')} ${NAVIGATION_ENTITIES.property.color}`}
                    />
                    <span>{unit.name || unit.unitName}</span>
                    {unit.type && <span className={typography.body.sm}>({unit.type})</span>}
                    {unit.floor && (
                      <span className={typography.body.sm}>
                        - {t('wizard.counts.floorOrdinal', { floor: unit.floor })}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <ProjectModalContainer title="" className={getBorder('default')}>
            <p className={typography.body.sm}>{t('wizard.empty.units')}</p>
          </ProjectModalContainer>
        )}
      </div>

      {/* Unit Floorplan */}
      {selectedUnitId && (
        <ProjectModalContainer
          title={t('wizard.floorplanSections.selectForUnit')}
          className={`${MODAL_SPACING.SECTIONS.betweenBlocks} ${getBorder('default')}`}
        >
          <ModalActions alignment="center">
            <Button
              onClick={() => onLoadFloorplan('property')}
              variant="default" size="default"
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
    </>
  );
}

// ── Status Counts ──────────────────────────────────────────────
interface StatusCountsProps {
  currentStep: 'company' | 'project' | 'building' | 'property';
  companies: CompanyData[];
  projects: ProjectData[];
  buildings: Building[];
  units: Unit[];
  loading: boolean;
}

export function StatusCounts({
  currentStep, companies, projects, buildings, units, loading,
}: StatusCountsProps) {
  const { t } = useTranslation('dxf-viewer');
  const typography = useTypography();

  return (
    <div className={MODAL_FLEX_PATTERNS.COLUMN.center}>
      {currentStep === 'company' && companies.length > 0 && !loading && (
        <p className={typography.body.sm}>
          {t('wizard.counts.companiesFound', { count: companies.length })}
        </p>
      )}
      {currentStep === 'project' && projects.length > 0 && !loading && (
        <p className={typography.body.sm}>
          {t('wizard.counts.projectsFound', { count: projects.length })}
        </p>
      )}
      {currentStep === 'building' && buildings.length > 0 && (
        <p className={typography.body.sm}>
          {t('wizard.counts.buildingsFound', { count: buildings.length })}
        </p>
      )}
      {currentStep === 'property' && units.length > 0 && (
        <p className={typography.body.sm}>
          {t('wizard.counts.unitsFound', { count: units.length })}
        </p>
      )}
    </div>
  );
}

// ── Site Plan Section (Project-level) ──────────────────────────
interface SitePlanSectionProps {
  onLoadFloorplan: (type: 'project' | 'parking' | 'building' | 'storage' | 'property' | 'floor') => void;
}

export function SitePlanSection({ onLoadFloorplan }: SitePlanSectionProps) {
  const { t } = useTranslation('dxf-viewer');
  const typography = useTypography();
  const getBorder = useModalBorder();

  return (
    <ProjectModalContainer
      title={t('wizard.floorplanSections.selectForProject')}
      className={`${MODAL_SPACING.SECTIONS.betweenBlocks} ${getBorder('default')}`}
    >
      <ModalActions alignment="center">
        <Button
          onClick={() => onLoadFloorplan('project')}
          variant="default" size="default"
          className={MODAL_DIMENSIONS.BUTTONS.flex}
        >
          {t('wizard.floorplanTypes.sitePlan')}
        </Button>
      </ModalActions>
      <p className={`${typography.body.sm} ${MODAL_FLEX_PATTERNS.COLUMN.center} ${MODAL_SPACING.CONTAINER.paddingSmall}`}>
        {t('wizard.floorplanSections.hintSitePlan')}
      </p>
    </ProjectModalContainer>
  );
}
