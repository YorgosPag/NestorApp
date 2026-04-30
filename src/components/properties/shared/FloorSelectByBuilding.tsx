'use client';

/**
 * FloorSelectByBuilding — Single floor picker scoped to a building
 *
 * Subscribes to the floors collection for `buildingId` and renders a sorted
 * select (basement → ground → upper). Used by ADR-329 BOQ scope picker for
 * `scope='floor'`.
 *
 * @module components/properties/shared/FloorSelectByBuilding
 * @see ADR-329 §3.4 (Floor Select)
 */

import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFloorsByBuilding, type FloorOption } from './useFloorsByBuilding';
import { usePropertiesByBuilding } from './usePropertiesByBuilding';
import { propertiesOnFloor } from '@/lib/properties/floor-helpers';

export interface FloorSelectByBuildingProps {
  buildingId: string | null | undefined;
  value: string;
  onChange: (floorId: string, meta: { propertyCount: number; floor: FloorOption | null }) => void;
  disabled?: boolean;
  id?: string;
}

export function FloorSelectByBuilding({
  buildingId,
  value,
  onChange,
  disabled = false,
  id,
}: FloorSelectByBuildingProps) {
  const { t } = useTranslation(['building-tabs']);
  const { floors, loading: floorsLoading } = useFloorsByBuilding(buildingId);
  const { properties, loading: propertiesLoading } = usePropertiesByBuilding(buildingId);

  const propertyCountByFloor = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of floors) {
      map.set(f.id, propertiesOnFloor(f.id, properties).length);
    }
    return map;
  }, [floors, properties]);

  const selectedFloor = floors.find((f) => f.id === value) ?? null;
  const selectedCount = value ? propertyCountByFloor.get(value) ?? 0 : 0;

  const handleChange = (next: string) => {
    const floor = floors.find((f) => f.id === next) ?? null;
    onChange(next, {
      propertyCount: propertyCountByFloor.get(next) ?? 0,
      floor,
    });
  };

  const isDisabled = disabled || !buildingId || floorsLoading;
  const isEmpty = !floorsLoading && floors.length === 0;

  return (
    <section className="flex flex-col gap-1.5">
      <Select value={value} onValueChange={handleChange} disabled={isDisabled}>
        <SelectTrigger size="sm" id={id}>
          <SelectValue placeholder={t('tabs.measurements.scope.floorPickerPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {floors.map((f) => {
            const count = propertyCountByFloor.get(f.id) ?? 0;
            return (
              <SelectItem key={f.id} value={f.id}>
                {f.number} — {f.name} ({count})
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {isEmpty && (
        <p className="text-xs text-muted-foreground">{t('tabs.measurements.scope.floorPickerEmpty')}</p>
      )}
      {selectedFloor && !propertiesLoading && (
        <p className="text-xs text-muted-foreground">
          {t('tabs.measurements.scope.floorPickerHint', { count: selectedCount })}
        </p>
      )}
    </section>
  );
}
