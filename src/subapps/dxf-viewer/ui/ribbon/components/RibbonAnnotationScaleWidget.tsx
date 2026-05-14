'use client';

/**
 * ADR-345 Fase 6 — Annotation scale widget for the Text Editor contextual tab.
 *
 * Compact trigger (current scale name) + Popover with full
 * AnnotationScaleManager. The manager is too tall to render directly
 * in the ribbon body (ADR-345 Fase 6 fix).
 *
 * Micro-leaf: reads `currentScale` from `useTextToolbarStore`,
 * entity scales via `useTextAnnotationScaleSync` (SSoT).
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useTextToolbarStore } from '../../../state/text-toolbar';
import { useTextAnnotationScaleSync } from '../../text-toolbar/hooks/useTextAnnotationScaleSync';
import { AnnotationScaleManager } from '../../text-toolbar/controls/AnnotationScaleManager';

export function RibbonAnnotationScaleWidget() {
  const { t } = useTranslation(['dxf-viewer-shell', 'textToolbar']);
  const currentScale = useTextToolbarStore((s) => s.currentScale);
  const setValue = useTextToolbarStore((s) => s.setValue);
  const { scales, handleScalesChange } = useTextAnnotationScaleSync();
  const [open, setOpen] = useState(false);

  const handleCurrentScaleChange = useCallback(
    (name: string) => setValue('currentScale', name),
    [setValue],
  );

  const label =
    currentScale === null
      ? t('textToolbar:annotationScale.mixed')
      : (currentScale ?? t('textToolbar:annotationScale.activePlaceholder'));

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.textEditor.properties.annotationScale')}
      </span>
      <span className="dxf-ribbon-widget-compact">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              aria-label={t('textToolbar:annotationScale.activeLabel')}
              className="min-w-[100px] justify-between"
            >
              <span className="truncate">{label}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            className="w-80 max-h-[70vh] overflow-y-auto p-0"
          >
            <AnnotationScaleManager
              scales={scales}
              currentScale={currentScale}
              paperHeightDefault={2.5}
              onScalesChange={handleScalesChange}
              onCurrentScaleChange={handleCurrentScaleChange}
            />
          </PopoverContent>
        </Popover>
      </span>
    </span>
  );
}
