'use client';

/**
 * =============================================================================
 * SPEC-237D: Unit Selector (Step 5)
 * =============================================================================
 *
 * Radix Select for unit selection.
 * If the selected unit is multi-level (ADR-236: maisonette, penthouse),
 * shows radio buttons for level selection.
 *
 * @module features/floorplan-import/components/StepUnitSelector
 */

import React from 'react';
import { Layers } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { EntityOption } from '../hooks/useFloorplanImportState';

// =============================================================================
// TYPES
// =============================================================================

interface StepUnitSelectorProps {
  unitItems: EntityOption[];
  unitLoading: boolean;
  selectedUnitId: string | null;
  onSelectUnit: (id: string) => void;
  /** Multi-level unit support (ADR-236) */
  isMultiLevel: boolean;
  levelItems: EntityOption[];
  selectedLevelId: string | null;
  onSelectLevel: (floorId: string) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function StepUnitSelector({
  unitItems,
  unitLoading,
  selectedUnitId,
  onSelectUnit,
  isMultiLevel,
  levelItems,
  selectedLevelId,
  onSelectLevel,
}: StepUnitSelectorProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('files');

  return (
    <div className="space-y-6 py-4">
      {/* ── Unit selector ── */}
      <section className="space-y-2">
        <p className={`text-sm font-medium ${colors.text.secondary}`}>
          {t('floorplanImport.select.unit')}
        </p>
        {unitLoading ? (
          <div className="flex justify-center py-4">
            <Spinner size="small" />
          </div>
        ) : unitItems.length === 0 ? (
          <p className={`text-sm ${colors.text.muted}`}>
            {t('floorplanImport.noItems')}
          </p>
        ) : (
          <Select value={selectedUnitId ?? ''} onValueChange={onSelectUnit}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('floorplanImport.select.unit')} />
            </SelectTrigger>
            <SelectContent>
              {unitItems.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </section>

      {/* ── Level selector for multi-level units (ADR-236) ── */}
      {selectedUnitId && isMultiLevel && levelItems.length >= 2 && (
        <section className="space-y-2">
          <p className={`text-sm font-medium ${colors.text.secondary}`}>
            {t('floorplanImport.select.level')}
          </p>
          <fieldset className="space-y-2">
            {levelItems.map((level) => {
              const isSelected = level.id === selectedLevelId;
              return (
                <label
                  key={level.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="unit-level"
                    value={level.id}
                    checked={isSelected}
                    onChange={() => onSelectLevel(level.id)}
                    className="sr-only"
                  />
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      isSelected ? 'border-primary' : 'border-muted-foreground/40'
                    }`}
                  >
                    {isSelected && (
                      <span className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </span>
                  <Layers className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm ${isSelected ? 'font-medium' : ''}`}>
                    {level.label}
                  </span>
                </label>
              );
            })}
          </fieldset>
        </section>
      )}
    </div>
  );
}
