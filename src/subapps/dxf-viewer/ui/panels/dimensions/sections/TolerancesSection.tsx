'use client';

import React from 'react';
import { useTranslation } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DimStyle, DimToleranceJustify } from '../../../../types/dimension';
import type { UpdateCustomStylePatch } from '../../../../systems/dimensions/dim-style-registry';

const TOLERANCE_JUSTIFY: DimToleranceJustify[] = ['bottom', 'middle', 'top'];

interface TolerancesSectionProps {
  style: DimStyle;
  onChange: (patch: UpdateCustomStylePatch) => void;
  readOnly?: boolean;
}

export function TolerancesSection({ style, onChange, readOnly = false }: TolerancesSectionProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const f = (key: string) => t(`panels.dimensions.editor.fields.${key}`);
  const toljLabel = (v: string) => t(`panels.dimensions.editor.dimtolj.${v}`);

  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center gap-2">
        <Checkbox
          id="dimtol"
          checked={style.dimtol}
          onCheckedChange={(v) => onChange({ dimtol: Boolean(v) })}
          disabled={readOnly}
        />
        <Label htmlFor="dimtol" className="text-xs cursor-pointer">{f('dimtol')}</Label>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="dimlim"
          checked={style.dimlim}
          onCheckedChange={(v) => onChange({ dimlim: Boolean(v) })}
          disabled={readOnly}
        />
        <Label htmlFor="dimlim" className="text-xs cursor-pointer">{f('dimlim')}</Label>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="dimtp" className="text-xs shrink-0 w-36">{f('dimtp')}</Label>
        <Input
          id="dimtp"
          type="number"
          step={0.01}
          value={style.dimtp}
          disabled={readOnly}
          onChange={(e) => onChange({ dimtp: parseFloat(e.target.value) || 0 })}
          className="h-6 text-xs w-20 px-1.5"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="dimtm" className="text-xs shrink-0 w-36">{f('dimtm')}</Label>
        <Input
          id="dimtm"
          type="number"
          step={0.01}
          value={style.dimtm}
          disabled={readOnly}
          onChange={(e) => onChange({ dimtm: parseFloat(e.target.value) || 0 })}
          className="h-6 text-xs w-20 px-1.5"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="dimtdec" className="text-xs shrink-0 w-36">{f('dimtdec')}</Label>
        <Input
          id="dimtdec"
          type="number"
          min={0}
          max={8}
          step={1}
          value={style.dimtdec}
          disabled={readOnly}
          onChange={(e) => onChange({ dimtdec: Math.min(8, Math.max(0, Math.round(parseFloat(e.target.value) || 0))) })}
          className="h-6 text-xs w-20 px-1.5"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs shrink-0 w-36">{f('dimtolj')}</Label>
        <Select
          value={style.dimtolj}
          onValueChange={(v) => onChange({ dimtolj: v as DimToleranceJustify })}
          disabled={readOnly}
        >
          <SelectTrigger className="h-6 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOLERANCE_JUSTIFY.map((v) => (
              <SelectItem key={v} value={v} className="text-xs">{toljLabel(v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
