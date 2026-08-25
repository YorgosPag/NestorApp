'use client';
import React from 'react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Building, Unit } from '../contexts/ProjectHierarchyContext';
import { getModalIconColor } from '../config/modal-colors';
import { MODAL_FLEX_PATTERNS, MODAL_SPACING, getIconSize } from '../config/modal-layout';
import { getSelectStyles } from '../config/modal-select/core/styles/select-styles';
import {
  useWizardStepChrome, WizardEmptyNote, WizardFloorplanAction,
  type CompanyData, type ProjectData, type LoadFloorplan,
} from './modal/wizard-step-chrome';

// ⚠️ Οι κοινοί τύποι, το τρίπτυχο hooks και οι επαναλαμβανόμενες κάρτες ζουν στο
// `./modal/wizard-step-chrome` — ΜΗΝ τα ξαναγράψεις εδώ (N.18 / CHECK 3.28).

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
  onLoadFloorplan: LoadFloorplan;
}

export function UnitStep({
  companies, selectedCompanyId, projects, selectedProjectId,
  buildings, selectedBuildingId, units, selectedUnitId,
  onUnitChange, onLoadFloorplan,
}: UnitStepProps) {
  const { t, typography } = useWizardStepChrome();

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
          <WizardEmptyNote messageKey="wizard.empty.units" />
        )}
      </div>

      {/* Unit Floorplan */}
      {selectedUnitId && (
        <WizardFloorplanAction
          titleKey="wizard.floorplanSections.selectForUnit"
          labelKey="wizard.floorplanTypes.unit"
          hintKey="wizard.floorplanSections.hintUnit"
          target="property"
          onLoadFloorplan={onLoadFloorplan}
        />
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
  const { t, typography } = useWizardStepChrome();

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
  onLoadFloorplan: LoadFloorplan;
}

export function SitePlanSection({ onLoadFloorplan }: SitePlanSectionProps) {
  return (
    <WizardFloorplanAction
      titleKey="wizard.floorplanSections.selectForProject"
      labelKey="wizard.floorplanTypes.sitePlan"
      hintKey="wizard.floorplanSections.hintSitePlan"
      target="project"
      onLoadFloorplan={onLoadFloorplan}
    />
  );
}
