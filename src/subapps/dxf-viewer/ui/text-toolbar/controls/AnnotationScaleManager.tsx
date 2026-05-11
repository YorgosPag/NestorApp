'use client';

/**
 * ADR-344 Phase 5.C + Q11 — Per-entity annotation scale manager.
 *
 * Manages the `annotationScales` array on the selected `DxfTextNode`(s).
 * Standard scales preset list + custom input. The active scale dropdown
 * picks `currentScale` from the entity's own list.
 *
 * NOTE: the actual viewport context binding (Phase 11) is out of scope
 * here — this component edits node-level data only.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { AnnotationScale, MixedValue } from '../../../text-engine/types';

const STANDARD_SCALES: ReadonlyArray<{ readonly name: string; readonly factor: number }> = [
  { name: '1:1', factor: 1 },
  { name: '1:2', factor: 2 },
  { name: '1:5', factor: 5 },
  { name: '1:10', factor: 10 },
  { name: '1:20', factor: 20 },
  { name: '1:50', factor: 50 },
  { name: '1:100', factor: 100 },
  { name: '1:200', factor: 200 },
  { name: '1:500', factor: 500 },
  { name: '1:1000', factor: 1000 },
] as const;

interface AnnotationScaleManagerProps {
  readonly scales: readonly AnnotationScale[];
  readonly currentScale: MixedValue<string>;
  readonly paperHeightDefault: number;
  readonly onScalesChange: (next: readonly AnnotationScale[]) => void;
  readonly onCurrentScaleChange: (name: string) => void;
  readonly disabled?: boolean;
}

export function AnnotationScaleManager({
  scales,
  currentScale,
  paperHeightDefault,
  onScalesChange,
  onCurrentScaleChange,
  disabled,
}: AnnotationScaleManagerProps) {
  const { t } = useTranslation(['textToolbar']);
  const [customName, setCustomName] = useState('');
  const [customFactor, setCustomFactor] = useState('');

  const addScale = (name: string, factor: number) => {
    if (scales.some((s) => s.name === name)) return;
    onScalesChange([
      ...scales,
      { name, paperHeight: paperHeightDefault, modelHeight: paperHeightDefault * factor },
    ]);
  };

  const removeScale = (name: string) => {
    onScalesChange(scales.filter((s) => s.name !== name));
  };

  const handleCustomSubmit = () => {
    const factor = parseFloat(customFactor);
    if (!customName || Number.isNaN(factor) || factor <= 0) return;
    addScale(customName, factor);
    setCustomName('');
    setCustomFactor('');
  };

  return (
    <section className={cn('flex flex-col gap-3 p-2', disabled && 'opacity-40')}>
      <header>
        <h3 className="text-sm font-medium">{t('textToolbar:annotationScale.title')}</h3>
      </header>

      <Select
        value={currentScale ?? undefined}
        onValueChange={onCurrentScaleChange}
        disabled={disabled || scales.length === 0}
      >
        <SelectTrigger size="md" aria-label={t('textToolbar:annotationScale.activeLabel')}>
          <SelectValue placeholder={t('textToolbar:annotationScale.activePlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {scales.map((s) => (
            <SelectItem key={s.name} value={s.name}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ul className="flex flex-col gap-1" aria-label={t('textToolbar:annotationScale.listLabel')}>
        {scales.map((s) => (
          <li key={s.name} className="flex items-center justify-between gap-2 text-sm">
            <span className="font-mono">{s.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeScale(s.name)}
              disabled={disabled}
              aria-label={t('textToolbar:annotationScale.remove', { name: s.name })}
              className="min-h-[44px] sm:min-h-[32px]"
            >
              <X className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{t('textToolbar:annotationScale.addStandard')}</span>
        <div className="flex flex-wrap gap-1">
          {STANDARD_SCALES.map((s) => (
            <Button
              key={s.name}
              variant="outline"
              size="sm"
              onClick={() => addScale(s.name, s.factor)}
              disabled={disabled || scales.some((existing) => existing.name === s.name)}
              className="min-h-[44px] sm:min-h-[28px] text-xs"
            >
              {s.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder={t('textToolbar:annotationScale.customNamePlaceholder')}
          disabled={disabled}
          className="h-9 flex-1 rounded border px-2 text-sm bg-background"
          aria-label={t('textToolbar:annotationScale.customNameLabel')}
        />
        <input
          type="number"
          value={customFactor}
          onChange={(e) => setCustomFactor(e.target.value)}
          placeholder={t('textToolbar:annotationScale.customFactorPlaceholder')}
          disabled={disabled}
          min={0.001}
          step={0.001}
          className="h-9 w-20 rounded border px-2 text-sm bg-background"
          aria-label={t('textToolbar:annotationScale.customFactorLabel')}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleCustomSubmit}
          disabled={disabled || !customName || !customFactor}
          aria-label={t('textToolbar:annotationScale.add')}
          className="min-h-[44px] sm:min-h-[32px]"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
