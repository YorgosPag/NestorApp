'use client';

/**
 * PropertySelectByBuilding — Single property picker scoped to a building
 *
 * Renders sorted property list `{code} — {name} ({floorLabel})`.
 * Multi-level aware: optionally narrows to properties present on a given
 * floor via `floorIdContext` (uses `propertiesOnFloor` helper).
 *
 * @module components/properties/shared/PropertySelectByBuilding
 * @see ADR-329 §3.4, §3.7.1 (multi-level visibility)
 */

import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePropertiesByBuilding } from './usePropertiesByBuilding';
import { useFloorsByBuilding } from './useFloorsByBuilding';
import { propertiesOnFloor } from '@/lib/properties/floor-helpers';
import { PropertyTypeIcon } from './property-type-icon';
import type { Property } from '@/types/property';

export interface PropertySelectByBuildingProps {
  buildingId: string | null | undefined;
  value: string;
  onChange: (propertyId: string, property: Property | null) => void;
  /** When set, filter to properties on this floor (single + multi-level aware). */
  floorIdContext?: string | null;
  disabled?: boolean;
  id?: string;
}

function compareCode(a: string, b: string): number {
  return a.localeCompare(b, 'el', { numeric: true });
}

export function PropertySelectByBuilding({
  buildingId,
  value,
  onChange,
  floorIdContext,
  disabled = false,
  id,
}: PropertySelectByBuildingProps) {
  const { t } = useTranslation(['building-tabs']);
  const { properties, loading } = usePropertiesByBuilding(buildingId);
  const { floors } = useFloorsByBuilding(buildingId);

  const floorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of floors) map.set(f.id, f.name);
    return map;
  }, [floors]);

  const visibleProperties = useMemo(() => {
    const base = floorIdContext ? propertiesOnFloor(floorIdContext, properties) : properties;
    return [...base].sort((a, b) => {
      const fa = a.floor ?? 0;
      const fb = b.floor ?? 0;
      if (fa !== fb) return fa - fb;
      return compareCode(a.code ?? a.name, b.code ?? b.name);
    });
  }, [properties, floorIdContext]);

  const handleChange = (next: string) => {
    const picked = visibleProperties.find((p) => p.id === next) ?? null;
    onChange(next, picked);
  };

  const isDisabled = disabled || !buildingId || loading;
  const isEmpty = !loading && visibleProperties.length === 0;

  return (
    <section className="flex flex-col gap-1.5">
      <Select value={value} onValueChange={handleChange} disabled={isDisabled}>
        <SelectTrigger size="sm" id={id}>
          <SelectValue placeholder={t('tabs.measurements.scope.propertyPickerPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {visibleProperties.map((p) => {
            const code = p.code ?? p.name;
            const floorLabel = floorNameById.get(p.floorId ?? '') ?? '';
            return (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-1.5">
                  <PropertyTypeIcon type={p.type} className="h-4 w-4" />
                  <span>{code} — {p.name}{floorLabel ? ` (${floorLabel})` : ''}</span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {isEmpty && (
        <p className="text-xs text-muted-foreground">{t('tabs.measurements.scope.propertiesPickerEmpty')}</p>
      )}
    </section>
  );
}
