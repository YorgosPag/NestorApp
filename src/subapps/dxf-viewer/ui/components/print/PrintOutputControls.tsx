'use client';

/**
 * ADR-453 — Print dialog · source + fit-mode + scale + target controls.
 *
 * @module subapps/dxf-viewer/ui/components/print/PrintOutputControls
 */

import * as React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  FitMode,
  OutputTarget,
  PrintOutputMode,
  PrintPlotStyle,
  PrintSource,
} from '../../../print/config/paper-types';
import { PRINT_SCALE_DENOMINATORS } from '../../../print/config/paper-constants';
import { PrintRadioGroup } from './PrintRadioGroup';

/** ADR-454 — plot-style options offered in the dialog (2D only). */
const PLOT_STYLES: readonly PrintPlotStyle[] = ['colour', 'monochrome', 'grayscale', 'by-pen'];

/** ADR-604 — output-encoding options offered in the dialog (2D only). */
const OUTPUT_MODES: readonly PrintOutputMode[] = ['vector', 'raster'];

interface PrintOutputControlsProps {
  source: PrintSource;
  onSourceChange: (s: PrintSource) => void;
  canPrint3d: boolean;
  fitMode: FitMode;
  onFitModeChange: (f: FitMode) => void;
  scaleDenominator: number;
  onScaleChange: (n: number) => void;
  plotStyle: PrintPlotStyle;
  onPlotStyleChange: (p: PrintPlotStyle) => void;
  outputMode: PrintOutputMode;
  onOutputModeChange: (m: PrintOutputMode) => void;
  target: OutputTarget;
  onTargetChange: (t: OutputTarget) => void;
  includeTitleBlock: boolean;
  onIncludeTitleBlockChange: (v: boolean) => void;
}

export function PrintOutputControls(props: PrintOutputControlsProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const {
    source, onSourceChange, canPrint3d,
    fitMode, onFitModeChange, scaleDenominator, onScaleChange,
    plotStyle, onPlotStyleChange,
    outputMode, onOutputModeChange,
    target, onTargetChange,
    includeTitleBlock, onIncludeTitleBlockChange,
  } = props;

  const is3d = source === '3d';

  return (
    <section className="space-y-3">
      <PrintRadioGroup<PrintSource>
        legend={t('print.source.label')}
        name="dxf-print-source"
        value={source}
        onChange={onSourceChange}
        options={[
          { value: '2d', label: t('print.source.2d') },
          { value: '3d', label: t('print.source.3d'), disabled: !canPrint3d },
        ]}
      />

      <PrintRadioGroup<FitMode>
        legend={t('print.fitMode.label')}
        name="dxf-print-fit"
        value={fitMode}
        onChange={onFitModeChange}
        options={[
          { value: 'fit-to-page', label: t('print.fitMode.fitToPage') },
          { value: 'drawing-scale', label: t('print.fitMode.drawingScale'), disabled: is3d },
        ]}
      />

      {fitMode === 'drawing-scale' && !is3d && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t('print.scale.label')}
          </label>
          <Select
            value={String(scaleDenominator)}
            onValueChange={(v) => onScaleChange(Number(v))}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRINT_SCALE_DENOMINATORS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {`1:${n}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!is3d && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t('print.plotStyle.label')}
          </label>
          <Select
            value={plotStyle}
            onValueChange={(v) => onPlotStyleChange(v as PrintPlotStyle)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLOT_STYLES.map((style) => (
                <SelectItem key={style} value={style}>
                  {t(`print.plotStyle.${style}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('print.plotStyle.hint')}
          </p>
        </div>
      )}

      {!is3d && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t('print.outputMode.label')}
          </label>
          <Select
            value={outputMode}
            onValueChange={(v) => onOutputModeChange(v as PrintOutputMode)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTPUT_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {t(`print.outputMode.${mode}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('print.outputMode.hint')}
          </p>
        </div>
      )}

      <PrintRadioGroup<OutputTarget>
        legend={t('print.target.label')}
        name="dxf-print-target"
        value={target}
        onChange={onTargetChange}
        options={[
          { value: 'save-pdf', label: t('print.target.savePdf') },
          { value: 'open-print', label: t('print.target.openPrint') },
        ]}
      />

      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={includeTitleBlock}
          onChange={(e) => onIncludeTitleBlockChange(e.target.checked)}
          className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
        />
        {t('print.titleBlock.label')}
      </label>

      <p className="text-xs text-muted-foreground">{t('print.plotterNote')}</p>
    </section>
  );
}
