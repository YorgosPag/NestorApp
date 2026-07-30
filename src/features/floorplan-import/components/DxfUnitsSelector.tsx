'use client';

/**
 * ADR-368: DXF Coordinate Units Selector (pill buttons).
 * Used in StepUpload (FloorplanImportWizard). Extracted to keep StepUpload <500 lines.
 *
 * @module features/floorplan-import/components/DxfUnitsSelector
 */

import { Ruler } from 'lucide-react';
import type { SceneUnits } from '@/subapps/dxf-viewer/utils/scene-units';
import type { UnitDecision } from '@/subapps/dxf-viewer/utils/import-unit-decision';
import type { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { UnitEvidenceReadout } from './UnitEvidenceReadout';

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
  /**
   * ADR-716 §8.1 — the verdict + evidence for the file currently in hand (null until a file
   * is picked, or when it carries no readable header). Rendered under the pills so the unit
   * is a VISIBLE decision, never a silent assumption.
   */
  decision?: UnitDecision | null;
}

export function DxfUnitsSelector({ value, onChange, colors, t, decision }: DxfUnitsSelectorProps) {
  return (
    <fieldset className="rounded-md border border-border p-3 space-y-2">
      <legend className={`flex items-center gap-1.5 px-1 text-xs font-medium ${colors.text.secondary}`}>
        <Ruler className="w-3.5 h-3.5" aria-hidden="true" />
        {t('floorplanImport.drawingUnits.title')}
      </legend>
      {/*
        ΠΛΕΓΜΑ, όχι flex-wrap: το πλάτος του πλήκτρου το ορίζει η **στήλη**, όχι το κείμενο.
        Με `flex-wrap` τα 6 πλήκτρα έπαιρναν intrinsic πλάτος («Εκατοστά (cm)» ≫ «Πόδια (ft)»),
        το άθροισμα ξεπερνούσε το πλάτος του dialog και το σπάσιμο έβγαινε άνισο και
        απρόβλεπτο — 2+2+2 με ωμά κλειδιά, 5+1 στα ελληνικά, 4+2 σε στενότερο παράθυρο
        (μετρημένο 2026-07-31). Οι 3 στήλες δίνουν σταθερό 3+3 σε ΚΑΘΕ γλώσσα και πλάτος·
        το κείμενο τυλίγεται μέσα στο πλήκτρο αντί να ξεχειλίζει έξω από το πλαίσιο.
      */}
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={t('floorplanImport.drawingUnits.title')}>
        {UNIT_OPTIONS.map(opt => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={`px-2 py-1 rounded text-xs font-medium text-center transition-colors border ${
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
      <UnitEvidenceReadout decision={decision} colors={colors} t={t} />
      <p className={`text-xs ${colors.text.muted}`}>
        {t('floorplanImport.drawingUnits.hint')}
      </p>
    </fieldset>
  );
}
