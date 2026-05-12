'use client';

/**
 * ADR-344 Phase 5.C + Phase 11 — Annotation scale manager.
 *
 * Two responsibilities:
 *   1) Per-entity scales: edits `annotationScales` and `currentScale` on the
 *      selected `DxfTextNode`(s). (Phase 5.C — entity-level)
 *   2) Viewport scale: reads/writes the global `ViewportStore` active scale
 *      and list. Sync buttons copy between entity and viewport. (Phase 11)
 *
 * Rendering uses `useActiveScale` / `useScaleList` from ViewportContext —
 * leaf-level subscription per ADR-040.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, ArrowDownToLine, ArrowUpFromLine, AlertTriangle } from 'lucide-react';
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
import {
  useActiveScale,
  useScaleList,
  setActiveScale,
  setScaleList,
} from '../../../systems/viewport';
import { STANDARD_SCALE_PRESETS } from '../../../systems/viewport/standard-scales';

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

  // Viewport state (leaf subscriptions — ADR-040)
  const viewportActive = useActiveScale();
  const viewportScales = useScaleList();

  const entityCurrentScaleStr = typeof currentScale === 'string' ? currentScale : null;
  const entityOverridesViewport =
    entityCurrentScaleStr !== null && entityCurrentScaleStr !== viewportActive;

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

  const handleSyncToViewport = () => {
    setScaleList(scales);
    if (entityCurrentScaleStr !== null) setActiveScale(entityCurrentScaleStr);
  };

  const handleSyncFromViewport = () => {
    onScalesChange(viewportScales);
    onCurrentScaleChange(viewportActive);
  };

  return (
    <section className={cn('flex flex-col gap-3 p-2', disabled && 'opacity-40')}>
      <header>
        <h3 className="text-sm font-medium">{t('textToolbar:annotationScale.title')}</h3>
      </header>

      <ViewportSection
        activeName={viewportActive}
        scaleList={viewportScales}
        disabled={disabled}
        onActiveChange={setActiveScale}
        onSyncFromViewport={handleSyncFromViewport}
        canSyncFromViewport={viewportScales.length > 0}
        t={t}
      />

      {entityOverridesViewport && (
        <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          {t('textToolbar:annotationScale.entityOverride')}
        </p>
      )}

      <Select
        value={typeof currentScale === 'string' ? currentScale : undefined}
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
          {STANDARD_SCALE_PRESETS.map((s) => (
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

      <Button
        variant="outline"
        size="sm"
        onClick={handleSyncToViewport}
        disabled={disabled || scales.length === 0}
        className="min-h-[44px] sm:min-h-[32px] gap-1"
      >
        <ArrowUpFromLine className="h-3 w-3" />
        {t('textToolbar:annotationScale.syncToViewport')}
      </Button>
    </section>
  );
}

interface ViewportSectionProps {
  readonly activeName: string;
  readonly scaleList: readonly AnnotationScale[];
  readonly disabled?: boolean;
  readonly onActiveChange: (name: string) => void;
  readonly onSyncFromViewport: () => void;
  readonly canSyncFromViewport: boolean;
  readonly t: ReturnType<typeof useTranslation>['t'];
}

function ViewportSection({
  activeName,
  scaleList,
  disabled,
  onActiveChange,
  onSyncFromViewport,
  canSyncFromViewport,
  t,
}: ViewportSectionProps) {
  return (
    <section className="flex flex-col gap-2 rounded border bg-muted/30 p-2">
      <h4 className="text-xs font-medium uppercase text-muted-foreground">
        {t('textToolbar:annotationScale.viewportSectionTitle')}
      </h4>
      <Select
        value={activeName}
        onValueChange={onActiveChange}
        disabled={disabled || scaleList.length === 0}
      >
        <SelectTrigger size="md" aria-label={t('textToolbar:annotationScale.viewportActive')}>
          <SelectValue placeholder={t('textToolbar:annotationScale.viewportActivePlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {scaleList.map((s) => (
            <SelectItem key={s.name} value={s.name}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        onClick={onSyncFromViewport}
        disabled={disabled || !canSyncFromViewport}
        className="min-h-[44px] sm:min-h-[32px] gap-1"
      >
        <ArrowDownToLine className="h-3 w-3" />
        {t('textToolbar:annotationScale.syncFromViewport')}
      </Button>
    </section>
  );
}
