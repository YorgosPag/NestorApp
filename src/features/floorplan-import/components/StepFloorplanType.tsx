'use client';

/**
 * =============================================================================
 * SPEC-237D: Floorplan Type Selector (Step 5)
 * =============================================================================
 *
 * 3 clickable radio cards: Building / Floor / Unit floorplan.
 * If unit selected → shows inline unit selector (Radix Select).
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

// =============================================================================
// TYPES
// =============================================================================

interface StepFloorplanTypeProps {
  selectedType: FloorplanType | null;
  onSelectType: (type: FloorplanType) => void;
  unitItems: EntityOption[];
  unitLoading: boolean;
  selectedUnitId: string | null;
  onSelectUnit: (id: string) => void;
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
  { type: 'unit', icon: Home, labelKey: 'floorplanImport.types.unit' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function StepFloorplanType({
  selectedType,
  onSelectType,
  unitItems,
  unitLoading,
  selectedUnitId,
  onSelectUnit,
}: StepFloorplanTypeProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('files');

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
                  isSelected ? 'text-primary' : 'text-muted-foreground'
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
      {selectedType === 'unit' && (
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
      )}
    </div>
  );
}
