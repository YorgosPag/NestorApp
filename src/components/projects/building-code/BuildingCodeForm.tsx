'use client';

import { Label } from '@/components/ui/label';
import { NumericField } from '@/components/ui/numeric-field';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { UseProjectBuildingCodeResult } from '@/hooks/useProjectBuildingCode';
import { PlotTypeSelector } from './PlotTypeSelector';
import { FrontagesCounter } from './FrontagesCounter';
import { ZoneSelector } from './ZoneSelector';
import { ProvenanceBadge } from './ProvenanceBadge';
import { ResetToDefaultButton } from './ResetToDefaultButton';
import { FrontagesList } from './FrontagesList';
import {
  FieldIssues,
  ValidationSummary,
} from './BuildingCodeValidationDisplay';
import type { Project } from '@/types/project';

interface BuildingCodeFormProps {
  hook: UseProjectBuildingCodeResult;
  isEditing: boolean;
  project?: Project | null;
}

export function BuildingCodeForm({ hook, isEditing, project }: BuildingCodeFormProps) {
  const { t } = useTranslation('buildingCode');
  const { draft, validation, isSaving } = hook;
  const fieldDisabled = !isEditing || isSaving;

  return (
    <div className="space-y-6">
      <fieldset className="grid gap-4 md:grid-cols-2" disabled={fieldDisabled}>
        <div className="space-y-2">
          <Label htmlFor="bc-plotType">{t('plotType.label')}</Label>
          <PlotTypeSelector value={draft.plotType} onChange={hook.setPlotType} disabled={fieldDisabled} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bc-frontagesCount">{t('frontagesCount.label')}</Label>
          <FrontagesCounter
            value={draft.frontagesCount}
            onChange={hook.setFrontagesCount}
            disabled={fieldDisabled}
          />
          <FieldIssues field="frontagesCount" validation={validation} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="bc-zone">{t('zone.label')}</Label>
          <ZoneSelector value={draft.zoneId} onChange={hook.setZoneId} disabled={fieldDisabled} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-3" disabled={fieldDisabled}>
        <div className="space-y-2">
          <NumericField
            id="bc-sd"
            label={t('sd.label')}
            step={0.01}
            min={0}
            disabled={fieldDisabled}
            value={draft.sd}
            onValueChange={hook.setSd}
          />
          <div className="flex items-center justify-between">
            <ProvenanceBadge provenance={draft.provenance.sd} zoneId={draft.zoneId} />
            {isEditing && hook.isFieldResettable('sd') && (
              <ResetToDefaultButton
                fieldLabel={t('sd.label')}
                zoneId={draft.zoneId!}
                onReset={() => hook.resetField('sd')}
              />
            )}
          </div>
          <FieldIssues field="sd" validation={validation} />
        </div>

        <div className="space-y-2">
          <NumericField
            id="bc-coverage"
            label={t('coverage.label')}
            step={1}
            min={0}
            max={100}
            disabled={fieldDisabled}
            value={draft.coveragePct}
            onValueChange={hook.setCoveragePct}
          />
          <div className="flex items-center justify-between">
            <ProvenanceBadge provenance={draft.provenance.coveragePct} zoneId={draft.zoneId} />
            {isEditing && hook.isFieldResettable('coveragePct') && (
              <ResetToDefaultButton
                fieldLabel={t('coverage.label')}
                zoneId={draft.zoneId!}
                onReset={() => hook.resetField('coveragePct')}
              />
            )}
          </div>
          <FieldIssues field="coveragePct" validation={validation} />
        </div>

        <div className="space-y-2">
          <NumericField
            id="bc-height"
            label={t('maxHeight.label')}
            step={0.5}
            min={0}
            disabled={fieldDisabled}
            value={draft.maxHeight}
            onValueChange={hook.setMaxHeight}
          />
          <div className="flex items-center justify-between">
            <ProvenanceBadge provenance={draft.provenance.maxHeight} zoneId={draft.zoneId} />
            {isEditing && hook.isFieldResettable('maxHeight') && (
              <ResetToDefaultButton
                fieldLabel={t('maxHeight.label')}
                zoneId={draft.zoneId!}
                onReset={() => hook.resetField('maxHeight')}
              />
            )}
          </div>
          <FieldIssues field="maxHeight" validation={validation} />
        </div>
      </fieldset>

      <ValidationSummary validation={validation} />

      {draft.frontagesCount > 0 && (
        <FrontagesList
          frontages={draft.frontages ?? []}
          frontagesCount={draft.frontagesCount}
          project={project ?? null}
          isEditing={isEditing}
          onFrontageAddressChange={hook.setFrontageAddressId}
        />
      )}
    </div>
  );
}
