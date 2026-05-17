'use client';

import React from 'react';
import { useTranslation } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DimStyle, DimAngularUnitFormat } from '../../../../types/dimension';
import type { UpdateCustomStylePatch } from '../../../../systems/dimensions/dim-style-registry';

const ANGULAR_UNIT_FORMATS: DimAngularUnitFormat[] = [
  'decimalDegrees', 'degMinSec', 'gradians', 'radians', 'surveyorUnits',
];

interface UnitsSectionProps {
  style: DimStyle;
  onChange: (patch: UpdateCustomStylePatch) => void;
  readOnly?: boolean;
}

function NumField({
  id, label, value, onChange, disabled, min, step,
}: {
  id: string; label: string; value: number; onChange: (v: number) => void;
  disabled?: boolean; min?: number; step?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label htmlFor={id} className="text-xs shrink-0 w-36">{label}</Label>
      <Input
        id={id}
        type="number"
        min={min ?? 0}
        step={step ?? 1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-6 text-xs w-20 px-1.5"
      />
    </div>
  );
}

export function UnitsSection({ style, onChange, readOnly = false }: UnitsSectionProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const f = (key: string) => t(`panels.dimensions.editor.fields.${key}`);
  const aunitLabel = (v: string) => t(`panels.dimensions.editor.dimaunit.${v}`);

  return (
    <div className="flex flex-col gap-2 py-1">
      <NumField
        id="dimdec" label={f('dimdec')} value={style.dimdec} min={0} step={1}
        onChange={(v) => onChange({ dimdec: Math.min(8, Math.max(0, Math.round(v))) })}
        disabled={readOnly}
      />
      <NumField
        id="dimrnd" label={f('dimrnd')} value={style.dimrnd} min={0} step={0.001}
        onChange={(v) => onChange({ dimrnd: v })}
        disabled={readOnly}
      />
      <NumField
        id="dimlfac" label={f('dimlfac')} value={style.dimlfac} min={0.001} step={0.01}
        onChange={(v) => onChange({ dimlfac: v || 1 })}
        disabled={readOnly}
      />
      <NumField
        id="dimzin" label={f('dimzin')} value={style.dimzin} min={0} step={1}
        onChange={(v) => onChange({ dimzin: Math.max(0, Math.round(v)) })}
        disabled={readOnly}
      />

      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs shrink-0 w-36">{f('dimaunit')}</Label>
        <Select
          value={style.dimaunit}
          onValueChange={(v) => onChange({ dimaunit: v as DimAngularUnitFormat })}
          disabled={readOnly}
        >
          <SelectTrigger className="h-6 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANGULAR_UNIT_FORMATS.map((v) => (
              <SelectItem key={v} value={v} className="text-xs">{aunitLabel(v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <NumField
        id="dimadec" label={f('dimadec')} value={style.dimadec} min={0} step={1}
        onChange={(v) => onChange({ dimadec: Math.min(8, Math.max(0, Math.round(v))) })}
        disabled={readOnly}
      />
    </div>
  );
}
