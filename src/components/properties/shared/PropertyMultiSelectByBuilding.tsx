'use client';

/**
 * PropertyMultiSelectByBuilding — Hybrid chips + tree multi-select picker
 *
 * Top: chips of selected properties (horizontal scroll, X to remove).
 * Bottom: tree grouped by floor (collapsible), parent checkbox = "select
 * all on floor". Optional search input. Suggests fallback to `scope='floor'`
 * when selection ⊆ single floor's properties.
 *
 * Used by ADR-329 BOQ scope picker for `scope='properties'`.
 *
 * @module components/properties/shared/PropertyMultiSelectByBuilding
 * @see ADR-329 §3.4 (Property Multi-Select Tree — Hybrid Pattern)
 */

import { useMemo, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFloorsByBuilding, type FloorOption } from './useFloorsByBuilding';
import { usePropertiesByBuilding } from './usePropertiesByBuilding';
import { propertiesOnFloor } from '@/lib/properties/floor-helpers';
import type { Property } from '@/types/property';

export interface PropertyMultiSelectByBuildingProps {
  buildingId: string | null | undefined;
  value: string[];
  onChange: (propertyIds: string[]) => void;
  /** Fired when selection ⊆ single floor's properties (suggest scope='floor'). */
  onSuggestSwitchToFloor?: (floorId: string) => void;
  disabled?: boolean;
}

interface FloorGroup {
  floor: FloorOption;
  properties: Property[];
}

function compareCode(a: string, b: string): number {
  return a.localeCompare(b, 'el', { numeric: true });
}

function buildGroups(floors: FloorOption[], properties: Property[]): FloorGroup[] {
  return floors.map((floor) => ({
    floor,
    properties: [...propertiesOnFloor(floor.id, properties)].sort((a, b) =>
      compareCode(a.code ?? a.name, b.code ?? b.name),
    ),
  }));
}

function matchesSearch(p: Property, term: string): boolean {
  if (!term) return true;
  const lc = term.toLowerCase();
  return (p.name?.toLowerCase().includes(lc) ?? false) ||
    (p.code?.toLowerCase().includes(lc) ?? false);
}

export function PropertyMultiSelectByBuilding({
  buildingId,
  value,
  onChange,
  onSuggestSwitchToFloor,
  disabled = false,
}: PropertyMultiSelectByBuildingProps) {
  const { t } = useTranslation(['building-tabs']);
  const { floors } = useFloorsByBuilding(buildingId);
  const { properties, loading } = usePropertiesByBuilding(buildingId);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const selectedSet = useMemo(() => new Set(value), [value]);

  const allGroups = useMemo(() => buildGroups(floors, properties), [floors, properties]);
  const filteredGroups = useMemo(() => {
    if (!search) return allGroups;
    return allGroups
      .map((g) => ({ ...g, properties: g.properties.filter((p) => matchesSearch(p, search)) }))
      .filter((g) => g.properties.length > 0);
  }, [allGroups, search]);

  const totalProperties = useMemo(
    () => allGroups.reduce((s, g) => s + g.properties.length, 0),
    [allGroups],
  );
  const defaultExpandAll = totalProperties <= 15;

  const isCollapsed = useCallback(
    (floorId: string): boolean => {
      if (collapsed.has(floorId)) return true;
      if (defaultExpandAll) return false;
      const hasSelection = allGroups
        .find((g) => g.floor.id === floorId)
        ?.properties.some((p) => selectedSet.has(p.id)) ?? false;
      return !hasSelection;
    },
    [collapsed, defaultExpandAll, allGroups, selectedSet],
  );

  const toggleCollapse = useCallback((floorId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(floorId)) next.delete(floorId);
      else next.add(floorId);
      return next;
    });
  }, []);

  const togglePropertySelection = useCallback((propertyId: string) => {
    const next = new Set(selectedSet);
    if (next.has(propertyId)) next.delete(propertyId);
    else next.add(propertyId);
    const arr = Array.from(next);
    onChange(arr);
    maybeSuggestFloor(arr, allGroups, onSuggestSwitchToFloor);
  }, [selectedSet, onChange, allGroups, onSuggestSwitchToFloor]);

  const toggleFloor = useCallback((group: FloorGroup) => {
    const ids = group.properties.map((p) => p.id);
    const allSelected = ids.every((id) => selectedSet.has(id));
    const next = new Set(selectedSet);
    if (allSelected) ids.forEach((id) => next.delete(id));
    else ids.forEach((id) => next.add(id));
    const arr = Array.from(next);
    onChange(arr);
    maybeSuggestFloor(arr, allGroups, onSuggestSwitchToFloor);
  }, [selectedSet, onChange, allGroups, onSuggestSwitchToFloor]);

  const removeChip = useCallback((propertyId: string) => {
    const next = new Set(selectedSet);
    next.delete(propertyId);
    onChange(Array.from(next));
  }, [selectedSet, onChange]);

  const selectedProperties = useMemo(
    () => properties.filter((p) => selectedSet.has(p.id)),
    [properties, selectedSet],
  );

  if (!buildingId) return null;
  if (loading && properties.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 rounded-md border p-3">
      <ChipsRow
        selectedProperties={selectedProperties}
        onRemove={removeChip}
        labelHeader={t('tabs.measurements.scope.multiSelect.selectedHeader', { count: selectedProperties.length })}
        labelEmpty={t('tabs.measurements.scope.multiSelect.selectedEmpty')}
        labelRemove={t('tabs.measurements.scope.multiSelect.removeChip')}
        disabled={disabled}
      />

      <section className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('tabs.measurements.scope.multiSelect.searchPlaceholder')}
          disabled={disabled}
        />
      </section>

      <ul className="flex flex-col gap-1 max-h-80 overflow-y-auto">
        {filteredGroups.map((group) => (
          <FloorGroupRow
            key={group.floor.id}
            group={group}
            collapsed={isCollapsed(group.floor.id)}
            onToggleCollapse={() => toggleCollapse(group.floor.id)}
            onToggleFloor={() => toggleFloor(group)}
            onTogglePropertySelection={togglePropertySelection}
            selectedSet={selectedSet}
            disabled={disabled}
            t={t}
          />
        ))}
      </ul>

      {properties.length > 0 && filteredGroups.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('tabs.measurements.scope.propertiesPickerEmpty')}</p>
      )}
    </section>
  );
}

function maybeSuggestFloor(
  selectedIds: string[],
  groups: FloorGroup[],
  onSuggestSwitchToFloor?: (floorId: string) => void,
): void {
  if (!onSuggestSwitchToFloor || selectedIds.length === 0) return;
  for (const g of groups) {
    if (g.properties.length === 0) continue;
    const ids = g.properties.map((p) => p.id);
    const allSelected = ids.every((id) => selectedIds.includes(id));
    const onlyFromThisFloor = selectedIds.every((id) => ids.includes(id));
    if (allSelected && onlyFromThisFloor) {
      onSuggestSwitchToFloor(g.floor.id);
      return;
    }
  }
}

interface ChipsRowProps {
  selectedProperties: Property[];
  onRemove: (id: string) => void;
  labelHeader: string;
  labelEmpty: string;
  labelRemove: string;
  disabled: boolean;
}

function ChipsRow({ selectedProperties, onRemove, labelHeader, labelEmpty, labelRemove, disabled }: ChipsRowProps) {
  return (
    <header className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-muted-foreground">{labelHeader}</p>
      {selectedProperties.length === 0 ? (
        <p className="text-xs text-muted-foreground">{labelEmpty}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {selectedProperties.map((p) => (
            <li key={p.id}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 gap-1"
                onClick={() => onRemove(p.id)}
                disabled={disabled}
                aria-label={labelRemove}
              >
                <span>{p.code ?? p.name}</span>
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}

interface FloorGroupRowProps {
  group: FloorGroup;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onToggleFloor: () => void;
  onTogglePropertySelection: (id: string) => void;
  selectedSet: Set<string>;
  disabled: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function FloorGroupRow({
  group, collapsed, onToggleCollapse, onToggleFloor, onTogglePropertySelection,
  selectedSet, disabled, t,
}: FloorGroupRowProps) {
  const ids = group.properties.map((p) => p.id);
  const selectedOnFloor = ids.filter((id) => selectedSet.has(id)).length;
  const allSelected = ids.length > 0 && selectedOnFloor === ids.length;
  const someSelected = selectedOnFloor > 0 && selectedOnFloor < ids.length;

  return (
    <li className="flex flex-col">
      <article className="flex items-center gap-2 py-1">
        <button
          type="button"
          className="flex items-center justify-center"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'expand' : 'collapse'}
          disabled={disabled}
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        <Checkbox
          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
          onCheckedChange={onToggleFloor}
          disabled={disabled || ids.length === 0}
          aria-label={t('tabs.measurements.scope.multiSelect.selectAllOnFloor')}
        />
        <span className="text-sm font-medium">
          {t('tabs.measurements.scope.multiSelect.groupHeader', { floorName: group.floor.name, count: ids.length })}
        </span>
      </article>
      {!collapsed && (
        <ul className="flex flex-col pl-8">
          {group.properties.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-1">
              <Checkbox
                checked={selectedSet.has(p.id)}
                onCheckedChange={() => onTogglePropertySelection(p.id)}
                disabled={disabled}
                id={`prop-${p.id}`}
              />
              <label htmlFor={`prop-${p.id}`} className="text-sm cursor-pointer">
                {p.code ? `${p.code} — ${p.name}` : p.name}
              </label>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
