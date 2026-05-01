'use client';

/**
 * BOQEditorScopeSection — Scope picker + cascading floor/property selector
 *
 * 5-radio segmented control + dependent picker (Floor / Property /
 * Multi-Property). Lock (scope-locked) + single-property-floor toast (§3.8) +
 * suggest-switch-to-floor for multi-select (§3.4).
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQEditorScopeSection
 * @see ADR-329 §3.1, §3.4, §3.8
 */

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FloorSelectByBuilding } from '@/components/properties/shared/FloorSelectByBuilding';
import { PropertySelectByBuilding } from '@/components/properties/shared/PropertySelectByBuilding';
import { PropertyMultiSelectByBuilding } from '@/components/properties/shared/PropertyMultiSelectByBuilding';
import { usePropertiesByBuilding } from '@/components/properties/shared/usePropertiesByBuilding';
import { propertiesOnFloor } from '@/lib/properties/floor-helpers';
import type { BOQScope } from '@/types/boq';

interface BOQEditorScopeSectionProps {
  buildingId: string;
  scope: BOQScope;
  linkedFloorId: string;
  linkedUnitId: string;
  linkedUnitIds: string[];
  scopeLocked: boolean;
  onScopeChange: (scope: BOQScope) => void;
  onLinkedFloorIdChange: (id: string) => void;
  onLinkedUnitIdChange: (id: string) => void;
  onLinkedUnitIdsChange: (ids: string[]) => void;
}

const SCOPE_OPTIONS: BOQScope[] = ['building', 'common_areas', 'floor', 'property', 'properties'];

export function BOQEditorScopeSection({
  buildingId, scope, linkedFloorId, linkedUnitId, linkedUnitIds, scopeLocked,
  onScopeChange, onLinkedFloorIdChange, onLinkedUnitIdChange, onLinkedUnitIdsChange,
}: BOQEditorScopeSectionProps) {
  const { t } = useTranslation(['building-tabs']);
  const colors = useSemanticColors();
  const lastSuggestedFloorRef = useRef<string | null>(null);
  const { properties } = usePropertiesByBuilding(buildingId, { enabled: scope !== 'building' && scope !== 'common_areas' });

  const handleFloorChange = useCallback((
    floorId: string,
    meta: { propertyCount: number; floor: { id: string; name: string } | null },
  ) => {
    onLinkedFloorIdChange(floorId);
    if (meta.propertyCount === 1 && floorId !== lastSuggestedFloorRef.current) {
      lastSuggestedFloorRef.current = floorId;
      const onlyProp = propertiesOnFloor(floorId, properties)[0] ?? null;
      const floorName = meta.floor?.name ?? '';
      const propertyCode = onlyProp?.code ?? onlyProp?.name ?? '';
      toast.info(t('tabs.measurements.scope.singlePropertyFloorToast.title'), {
        description: t('tabs.measurements.scope.singlePropertyFloorToast.body', {
          floorName,
          propertyCode,
        }),
        action: onlyProp ? {
          label: t('tabs.measurements.scope.singlePropertyFloorToast.confirm'),
          onClick: () => {
            onScopeChange('property');
            onLinkedUnitIdChange(onlyProp.id);
          },
        } : undefined,
        duration: 8000,
      });
    }
  }, [onLinkedFloorIdChange, properties, t, onScopeChange, onLinkedUnitIdChange]);

  const handleSuggestFloor = useCallback((floorId: string) => {
    if (floorId === lastSuggestedFloorRef.current) return;
    lastSuggestedFloorRef.current = floorId;
    toast.info(t('tabs.measurements.scope.multiSelect.suggestSwitchToFloor'), {
      action: {
        label: t('tabs.measurements.scope.multiSelect.suggestSwitchConfirm'),
        onClick: () => {
          onScopeChange('floor');
          onLinkedFloorIdChange(floorId);
        },
      },
      duration: 8000,
    });
  }, [onScopeChange, onLinkedFloorIdChange, t]);

  return (
    <fieldset className={cn('space-y-2', scopeLocked && 'opacity-60')}>
      <legend className={cn('text-sm font-semibold', colors.text.muted)}>
        {t('tabs.measurements.scope.label')}
      </legend>

      <ul className="flex flex-col gap-1.5">
        {SCOPE_OPTIONS.map((opt) => (
          <li key={opt}>
            <Button
              type="button"
              variant={scope === opt ? 'default' : 'outline'}
              size="sm"
              className="w-full justify-start whitespace-normal text-left leading-tight"
              disabled={scopeLocked}
              onClick={() => onScopeChange(opt)}
            >
              {t(`tabs.measurements.scope.${labelKey(opt)}`)}
            </Button>
          </li>
        ))}
      </ul>

      {scope === 'floor' && (
        <FloorSelectByBuilding
          buildingId={buildingId}
          value={linkedFloorId}
          onChange={(id, meta) => handleFloorChange(id, meta)}
          disabled={scopeLocked}
          id="boq-scope-floor"
        />
      )}

      {scope === 'property' && (
        <PropertySelectByBuilding
          buildingId={buildingId}
          value={linkedUnitId}
          onChange={(id) => onLinkedUnitIdChange(id)}
          disabled={scopeLocked}
          id="boq-scope-property"
        />
      )}

      {scope === 'properties' && (
        <PropertyMultiSelectByBuilding
          buildingId={buildingId}
          value={linkedUnitIds}
          onChange={onLinkedUnitIdsChange}
          onSuggestSwitchToFloor={handleSuggestFloor}
          disabled={scopeLocked}
        />
      )}

      {scopeLocked && (
        <p className="text-xs text-muted-foreground">
          {t('tabs.measurements.scope.scopeLock.tooltip')}
        </p>
      )}
    </fieldset>
  );
}

function labelKey(scope: BOQScope): string {
  switch (scope) {
    case 'building': return 'building';
    case 'common_areas': return 'commonAreas';
    case 'floor': return 'floor';
    case 'property': return 'property';
    case 'properties': return 'properties';
  }
}
