'use client';

/**
 * ADR-368: DXF Coordinate Units Selector (pill buttons).
 * Used in StepUpload (FloorplanImportWizard). Extracted to keep StepUpload <500 lines.
 *
 * @module features/floorplan-import/components/DxfUnitsSelector
 */

import { Ruler } from 'lucide-react';
import type { SceneUnits } from '@/subapps/dxf-viewer/utils/scene-units';
import type { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface TFn { (key: string, options?: Record<string, unknown>): string; }

const UNIT_OPTIONS: Array<{ value: SceneUnits | 'auto'; labelKey: string }> = [
  { value: 'auto', labelKey: 'floorplanImport.drawingUnits.auto' },
  { value: 'm',   labelKey: 'floorplanImport.drawingUnits.m'    },
  { value: 'cm',  labelKey: 'floorplanImport.drawingUnits.cm'   },
  { value: 'mm',  labelKey: 'floorplanImport.drawingUnits.mm'   },
  { value: 'ft',  labelKey: 'floorplanImport.drawingUnits.ft'   },
  { value: 'in',  labelKey: 'floorplanImport.drawingUnits.in'   },
];

export interface DxfUnitsSelectorProps {
  value: SceneUnits | 'auto';
  onChange: (v: SceneUnits | 'auto') => void;
  colors: ReturnType<typeof useSemanticColors>;
  t: TFn;
}

export function DxfUnitsSelector({ value, onChange, colors, t }: DxfUnitsSelectorProps) {
  return (
    <fieldset className="rounded-md border border-border p-3 space-y-2">
      <legend className={`flex items-center gap-1.5 px-1 text-xs font-medium ${colors.text.secondary}`}>
        <Ruler className="w-3.5 h-3.5" aria-hidden="true" />
        {t('floorplanImport.drawingUnits.title')}
      </legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('floorplanImport.drawingUnits.title')}>
        {UNIT_OPTIONS.map(opt => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : `${colors.bg.secondary} ${colors.text.secondary} border-border hover:border-primary/50`
              }`}
            >
              {t(opt.labelKey)}
            </button>
          );
        })}
      </div>
      <p className={`text-xs ${colors.text.muted}`}>
        {t('floorplanImport.drawingUnits.hint')}
      </p>
    </fieldset>
  );
}
