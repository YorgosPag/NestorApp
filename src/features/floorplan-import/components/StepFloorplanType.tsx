'use client';

/**
 * =============================================================================
 * SPEC-237D: Floorplan Type Selector (Step 5)
 * =============================================================================
 *
 * 3 clickable radio cards: Building / Floor / Unit floorplan.
 * If unit selected → shows inline unit selector (Radix Select).
 * If multi-level unit → shows level selector after unit (ADR-236).
 *
 * @module features/floorplan-import/components/StepFloorplanType
 */

import React from 'react';
import { Building2, Layers, Home } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FloorplanType, EntityOption } from '../hooks/useFloorplanImportState';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

interface StepFloorplanTypeProps {
  selectedType: FloorplanType | null;
  onSelectType: (type: FloorplanType) => void;
  unitItems: EntityOption[];
  unitLoading: boolean;
  selectedPropertyId: string | null;
  onSelectProperty: (id: string) => void;
  /** Multi-level unit support (ADR-236) */
  isMultiLevel: boolean;
  levelItems: EntityOption[];
  selectedLevelId: string | null;
  onSelectLevel: (floorId: string) => void;
}

// =============================================================================
// TYPE CARD CONFIG
// =============================================================================

interface TypeCardConfig {
  type: FloorplanType;
  icon: React.ElementType;
  labelKey: string;
}

const TYPE_CARDS: TypeCardConfig[] = [
  { type: 'building', icon: Building2, labelKey: 'floorplanImport.types.building' },
  { type: 'floor', icon: Layers, labelKey: 'floorplanImport.types.floor' },
  { type: 'property', icon: Home, labelKey: 'floorplanImport.types.unit' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function StepFloorplanType({
  selectedType,
  onSelectType,
  unitItems,
  unitLoading,
  selectedPropertyId,
  onSelectProperty,
  isMultiLevel,
  levelItems,
  selectedLevelId,
  onSelectLevel,
}: StepFloorplanTypeProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation(['files', 'files-media']);

  return (
    <div className="space-y-6 py-4">
      {/* ── Type cards ── */}
      <fieldset className="grid grid-cols-3 gap-3">
        {TYPE_CARDS.map(({ type, icon: Icon, labelKey }) => {
          const isSelected = selectedType === type;
          return (
            <label
              key={type}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 px-4 py-6 transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/40 hover:bg-muted/20'
              }`}
            >
              <input
                type="radio"
                name="floorplan-type"
                value={type}
                checked={isSelected}
                onChange={() => onSelectType(type)}
                className="sr-only"
              />
              <Icon
                className={`${iconSizes.xl2} transition-colors ${
                  isSelected ? 'text-primary' : colors.text.muted
                }`}
              />
              <span className={`text-center text-sm ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                {t(labelKey)}
              </span>
            </label>
          );
        })}
      </fieldset>

      {/* ── Unit selector (conditional) ── */}
      {selectedType === 'property' && (
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
            <Select value={selectedPropertyId ?? ''} onValueChange={onSelectProperty}>
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
      )}

      {/* ── Level selector for multi-level units (ADR-236) ── */}
      {selectedType === 'property' && selectedPropertyId && isMultiLevel && levelItems.length >= 2 && (
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
                  <Layers className={`h-4 w-4 ${isSelected ? 'text-primary' : colors.text.muted}`} />
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
