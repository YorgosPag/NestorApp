/**
 * @related ADR-186 §8b — 6-field CRUD form
 *
 * Composes the selectors + numeric inputs + provenance badges + reset
 * buttons + inline validation. Receives the `useProjectBuildingCode` hook
 * result so it stays a pure presentational component.
 */
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { UseProjectBuildingCodeResult } from '@/hooks/useProjectBuildingCode';
import { PlotTypeSelector } from './PlotTypeSelector';
import { FrontagesCounter } from './FrontagesCounter';
import { ZoneSelector } from './ZoneSelector';
import { ProvenanceBadge } from './ProvenanceBadge';
import { ResetToDefaultButton } from './ResetToDefaultButton';
import {
  FieldIssues,
  ValidationSummary,
} from './BuildingCodeValidationDisplay';

interface BuildingCodeFormProps {
  hook: UseProjectBuildingCodeResult;
}

function parseNumber(raw: string): number {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function BuildingCodeForm({ hook }: BuildingCodeFormProps) {
  const { t } = useTranslation('buildingCode');
  const { draft, validation, isSaving, canSave, isDirty } = hook;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (canSave) void hook.save();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold">{t('form.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('form.subtitle')}</p>
      </header>

      <fieldset className="grid gap-4 md:grid-cols-2" disabled={isSaving}>
        <div className="space-y-2">
          <Label htmlFor="bc-plotType">{t('plotType.label')}</Label>
          <PlotTypeSelector value={draft.plotType} onChange={hook.setPlotType} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bc-frontagesCount">{t('frontagesCount.label')}</Label>
          <FrontagesCounter
            value={draft.frontagesCount}
            onChange={hook.setFrontagesCount}
          />
          <FieldIssues field="frontagesCount" validation={validation} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="bc-zone">{t('zone.label')}</Label>
          <ZoneSelector value={draft.zoneId} onChange={hook.setZoneId} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-3" disabled={isSaving}>
        <div className="space-y-2">
          <Label htmlFor="bc-sd">{t('sd.label')}</Label>
          <Input
            id="bc-sd"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={Number.isFinite(draft.sd) ? draft.sd : 0}
            onChange={(e) => hook.setSd(parseNumber(e.target.value))}
          />
          <div className="flex items-center justify-between">
            <ProvenanceBadge
              provenance={draft.provenance.sd}
              zoneId={draft.zoneId}
            />
            <ResetToDefaultButton
              fieldLabel={t('sd.label')}
              enabled={hook.isFieldResettable('sd')}
              onReset={() => hook.resetField('sd')}
            />
          </div>
          <FieldIssues field="sd" validation={validation} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bc-coverage">{t('coverage.label')}</Label>
          <Input
            id="bc-coverage"
            type="number"
            inputMode="decimal"
            step="1"
            min={0}
            max={100}
            value={Number.isFinite(draft.coveragePct) ? draft.coveragePct : 0}
            onChange={(e) => hook.setCoveragePct(parseNumber(e.target.value))}
          />
          <div className="flex items-center justify-between">
            <ProvenanceBadge
              provenance={draft.provenance.coveragePct}
              zoneId={draft.zoneId}
            />
            <ResetToDefaultButton
              fieldLabel={t('coverage.label')}
              enabled={hook.isFieldResettable('coveragePct')}
              onReset={() => hook.resetField('coveragePct')}
            />
          </div>
          <FieldIssues field="coveragePct" validation={validation} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bc-height">{t('maxHeight.label')}</Label>
          <Input
            id="bc-height"
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            value={Number.isFinite(draft.maxHeight) ? draft.maxHeight : 0}
            onChange={(e) => hook.setMaxHeight(parseNumber(e.target.value))}
          />
          <div className="flex items-center justify-between">
            <ProvenanceBadge
              provenance={draft.provenance.maxHeight}
              zoneId={draft.zoneId}
            />
            <ResetToDefaultButton
              fieldLabel={t('maxHeight.label')}
              enabled={hook.isFieldResettable('maxHeight')}
              onReset={() => hook.resetField('maxHeight')}
            />
          </div>
          <FieldIssues field="maxHeight" validation={validation} />
        </div>
      </fieldset>

      <ValidationSummary validation={validation} />

      <footer className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={hook.reset}
          disabled={!isDirty || isSaving}
        >
          {t('form.cancel')}
        </Button>
        <Button type="submit" disabled={!canSave}>
          {isSaving ? t('form.saving') : t('form.save')}
        </Button>
      </footer>
    </form>
  );
}
