'use client';

/**
 * Building Space Filter Bar — search + type/status selects + export action.
 *
 * ONE filter bar for every building space tab (Units, Parking, Storage): the three tabs
 * carried the same markup as parallel twins (CHECK 3.28). Labels come from the caller, so
 * each tab keeps its own i18n namespace; the value narrowing is membership-based — the
 * Radix `onValueChange` hands back a `string`, and only `'all'` or a listed option passes.
 *
 * @module components/building-management/shared/BuildingSpaceFilterBar
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, BarChart3 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export interface SpaceFilterOption<V extends string> {
  readonly value: V;
  readonly label: string;
}

export interface SpaceSelectFilter<V extends string> {
  readonly value: V | 'all';
  readonly onChange: (value: V | 'all') => void;
  readonly options: ReadonlyArray<SpaceFilterOption<V>>;
  /** Label of the «all» entry — also the placeholder. */
  readonly allLabel: string;
}

interface BuildingSpaceFilterBarProps<T extends string, S extends string> {
  readonly searchPlaceholder: string;
  readonly searchTerm: string;
  readonly onSearchChange: (value: string) => void;
  readonly typeFilter: SpaceSelectFilter<T>;
  readonly statusFilter: SpaceSelectFilter<S>;
  readonly exportLabel: string;
}

/** `'all'`, a listed option, or `null` for anything else — narrowing by membership, never a cast. */
export function narrowSpaceFilterValue<V extends string>(
  raw: string,
  options: ReadonlyArray<SpaceFilterOption<V>>,
): V | 'all' | null {
  if (raw === 'all') return 'all';
  return options.find((option) => option.value === raw)?.value ?? null;
}

function SpaceSelect<V extends string>({ filter }: { filter: SpaceSelectFilter<V> }) {
  const handleChange = (raw: string) => {
    const next = narrowSpaceFilterValue(raw, filter.options);
    if (next !== null) filter.onChange(next);
  };

  return (
    <Select value={filter.value} onValueChange={handleChange}>
      <SelectTrigger>
        <SelectValue placeholder={filter.allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{filter.allLabel}</SelectItem>
        {filter.options.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function BuildingSpaceFilterBar<T extends string, S extends string>({
  searchPlaceholder,
  searchTerm,
  onSearchChange,
  typeFilter,
  statusFilter,
  exportLabel,
}: BuildingSpaceFilterBarProps<T, S>) {
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  return (
    <Card>
      <CardContent className="p-2">
        <fieldset className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <label className="relative md:col-span-2">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${colors.text.muted} ${iconSizes.sm}`} />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </label>

          <SpaceSelect filter={typeFilter} />
          <SpaceSelect filter={statusFilter} />

          <Button variant="outline" className="flex items-center gap-2">
            <BarChart3 className={iconSizes.sm} />
            {exportLabel}
          </Button>
        </fieldset>
      </CardContent>
    </Card>
  );
}
