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
import type { DimStyle } from '../../../../types/dimension';
import type { UpdateCustomStylePatch } from '../../../../systems/dimensions/dim-style-registry';

const ARROWHEAD_NAMES = [
  'none', 'closedFilled', 'closedBlank', 'closed', 'dot', 'dotSmall',
  'dotBlank', 'dotSmallBlank', 'architecturalTick', 'oblique', 'open',
  'openRightAngle', 'openSlanted', 'origin', 'origin2', 'box', 'boxFilled',
  'datumTriangle', 'datumTriangleFilled',
] as const;

interface SymbolsSectionProps {
  style: DimStyle;
  onChange: (patch: UpdateCustomStylePatch) => void;
}

export function SymbolsSection({ style, onChange }: SymbolsSectionProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const f = (key: string) => t(`panels.dimensions.editor.fields.${key}`);
  const blkLabel = (name: string) => t(`panels.dimensions.editor.dimblk.${name}`, { defaultValue: '' }) || name;

  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs shrink-0 w-36">{f('dimblk')}</Label>
        <Select value={style.dimblk} onValueChange={(v) => onChange({ dimblk: v, dimblk1: v, dimblk2: v })}>
          <SelectTrigger className="h-6 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ARROWHEAD_NAMES.map((name) => (
              <SelectItem key={name} value={name} className="text-xs">
                {blkLabel(name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="dimcen" className="text-xs shrink-0 w-36">{f('dimcen')}</Label>
        <Input
          id="dimcen"
          type="number"
          step={0.1}
          value={style.dimcen}
          onChange={(e) => onChange({ dimcen: parseFloat(e.target.value) || 0 })}
          className="h-6 text-xs w-20 px-1.5"
        />
      </div>
    </div>
  );
}
