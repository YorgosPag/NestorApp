'use client';

import React from 'react';
import { useTranslation } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DimStyle, DimTextVerticalPlacement } from '../../../../types/dimension';
import type { UpdateCustomStylePatch } from '../../../../systems/dimensions/dim-style-registry';

const TEXT_PLACEMENTS: DimTextVerticalPlacement[] = ['centered', 'above', 'outside', 'jis', 'below'];

interface TextSectionProps {
  style: DimStyle;
  onChange: (patch: UpdateCustomStylePatch) => void;
}

export function TextSection({ style, onChange }: TextSectionProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const f = (key: string) => t(`panels.dimensions.editor.fields.${key}`);
  const tadLabel = (v: string) => t(`panels.dimensions.editor.dimtad.${v}`);

  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="dimtxt" className="text-xs shrink-0 w-36">{f('dimtxt')}</Label>
        <Input
          id="dimtxt"
          type="number"
          min={0.1}
          step={0.1}
          value={style.dimtxt}
          onChange={(e) => onChange({ dimtxt: parseFloat(e.target.value) || 0.1 })}
          className="h-6 text-xs w-20 px-1.5"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs shrink-0 w-36">{f('dimtad')}</Label>
        <Select value={style.dimtad} onValueChange={(v) => onChange({ dimtad: v as DimTextVerticalPlacement })}>
          <SelectTrigger className="h-6 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEXT_PLACEMENTS.map((v) => (
              <SelectItem key={v} value={v} className="text-xs">{tadLabel(v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="dimgap" className="text-xs shrink-0 w-36">{f('dimgap')}</Label>
        <Input
          id="dimgap"
          type="number"
          min={0}
          step={0.1}
          value={style.dimgap}
          onChange={(e) => onChange({ dimgap: parseFloat(e.target.value) || 0 })}
          className="h-6 text-xs w-20 px-1.5"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="dimtih" checked={style.dimtih} onCheckedChange={(v) => onChange({ dimtih: Boolean(v) })} />
        <Label htmlFor="dimtih" className="text-xs cursor-pointer">{f('dimtih')}</Label>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="dimtoh" checked={style.dimtoh} onCheckedChange={(v) => onChange({ dimtoh: Boolean(v) })} />
        <Label htmlFor="dimtoh" className="text-xs cursor-pointer">{f('dimtoh')}</Label>
      </div>
    </div>
  );
}
