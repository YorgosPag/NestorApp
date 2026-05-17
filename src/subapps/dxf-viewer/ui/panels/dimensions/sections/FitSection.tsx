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
import type { DimStyle, DimLinearUnitFormat } from '../../../../types/dimension';
import type { UpdateCustomStylePatch } from '../../../../systems/dimensions/dim-style-registry';

const DIMATFIT_VALUES = ['0', '1', '2', '3'] as const;
const DIMTMOVE_VALUES = ['0', '1', '2'] as const;
const LINEAR_UNIT_FORMATS: DimLinearUnitFormat[] = [
  'scientific', 'decimal', 'engineering', 'architectural', 'fractional', 'windowsDesktop',
];

interface FitSectionProps {
  style: DimStyle;
  onChange: (patch: UpdateCustomStylePatch) => void;
  readOnly?: boolean;
}

export function FitSection({ style, onChange, readOnly = false }: FitSectionProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const f = (key: string) => t(`panels.dimensions.editor.fields.${key}`);
  const fitLabel = (v: string) => t(`panels.dimensions.editor.dimatfit.${v}`);
  const moveLabel = (v: string) => t(`panels.dimensions.editor.dimtmove.${v}`);
  const lunitLabel = (v: string) => t(`panels.dimensions.editor.dimlunit.${v}`);

  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs shrink-0 w-36">{f('dimatfit')}</Label>
        <Select
          value={String(style.dimatfit)}
          onValueChange={(v) => onChange({ dimatfit: parseInt(v, 10) })}
          disabled={readOnly}
        >
          <SelectTrigger className="h-6 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIMATFIT_VALUES.map((v) => (
              <SelectItem key={v} value={v} className="text-xs">{fitLabel(v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs shrink-0 w-36">{f('dimtmove')}</Label>
        <Select
          value={String(style.dimtmove)}
          onValueChange={(v) => onChange({ dimtmove: parseInt(v, 10) })}
          disabled={readOnly}
        >
          <SelectTrigger className="h-6 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIMTMOVE_VALUES.map((v) => (
              <SelectItem key={v} value={v} className="text-xs">{moveLabel(v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="dimscale" className="text-xs shrink-0 w-36">{f('dimscale')}</Label>
        <Input
          id="dimscale"
          type="number"
          min={0.01}
          step={0.01}
          value={style.dimscale}
          disabled={readOnly}
          onChange={(e) => onChange({ dimscale: parseFloat(e.target.value) || 1 })}
          className="h-6 text-xs w-20 px-1.5"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs shrink-0 w-36">{f('dimlunit')}</Label>
        <Select
          value={style.dimlunit}
          onValueChange={(v) => onChange({ dimlunit: v as DimLinearUnitFormat })}
          disabled={readOnly}
        >
          <SelectTrigger className="h-6 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LINEAR_UNIT_FORMATS.map((v) => (
              <SelectItem key={v} value={v} className="text-xs">{lunitLabel(v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
