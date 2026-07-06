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
import type { DimStyle, DimTextFillMode, DimTextVerticalPlacement } from '../../../../types/dimension';
import type { UpdateCustomStylePatch } from '../../../../systems/dimensions/dim-style-registry';
import { ColorField, SelectField } from './dim-style-fields';
import { DIM_FONT_OPTIONS } from './dim-style-field-options';

const TEXT_PLACEMENTS: DimTextVerticalPlacement[] = ['centered', 'above', 'outside', 'jis', 'below'];
// ADR-362 Phase K3 — DIMTFILL text-background mask modes (AutoCAD 3-way).
const TEXT_FILL_MODES: DimTextFillMode[] = ['none', 'backgroundColor', 'customColor'];

interface TextSectionProps {
  style: DimStyle;
  onChange: (patch: UpdateCustomStylePatch) => void;
  readOnly?: boolean;
}

export function TextSection({ style, onChange, readOnly = false }: TextSectionProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const f = (key: string) => t(`panels.dimensions.editor.fields.${key}`);
  const tadLabel = (v: string) => t(`panels.dimensions.editor.dimtad.${v}`);
  const tfillLabel = (v: string) => t(`panels.dimensions.editor.dimtfill.${v}`);

  return (
    <div className="flex flex-col gap-2 py-1">
      {/* ADR-562 Φ5 — text colour + font family */}
      <ColorField label={f('dimclrt')} value={style.dimclrt} onChange={(v) => onChange({ dimclrt: v })} disabled={readOnly} />
      <SelectField label={f('textFontFamily')} value={style.textFontFamily} options={DIM_FONT_OPTIONS} onChange={(v) => onChange({ textFontFamily: v })} disabled={readOnly} />

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="dimtxt" className="text-xs shrink-0 w-36">{f('dimtxt')}</Label>
        <Input
          id="dimtxt"
          type="number"
          min={0.1}
          step={0.1}
          value={style.dimtxt}
          disabled={readOnly}
          onChange={(e) => onChange({ dimtxt: parseFloat(e.target.value) || 0.1 })}
          className="h-6 text-xs w-20 px-1.5"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs shrink-0 w-36">{f('dimtad')}</Label>
        <Select value={style.dimtad} onValueChange={(v) => onChange({ dimtad: v as DimTextVerticalPlacement })} disabled={readOnly}>
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
          disabled={readOnly}
          onChange={(e) => onChange({ dimgap: parseFloat(e.target.value) || 0 })}
          className="h-6 text-xs w-20 px-1.5"
        />
      </div>

      {/* ADR-362 Phase K3 — DIMTFILL text-background mask: mode (3-way) + custom
          colour (shown only for «Δικό μου χρώμα»). Feeds the SAME `dimtfill` /
          `dimtfillclr` the renderer's `drawTextBackgroundMask` already reads. */}
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs shrink-0 w-36">{f('dimtfill')}</Label>
        <Select value={style.dimtfill} onValueChange={(v) => onChange({ dimtfill: v as DimTextFillMode })} disabled={readOnly}>
          <SelectTrigger className="h-6 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEXT_FILL_MODES.map((v) => (
              <SelectItem key={v} value={v} className="text-xs">{tfillLabel(v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {style.dimtfill === 'customColor' && (
        <ColorField label={f('dimtfillclr')} value={style.dimtfillclr} onChange={(v) => onChange({ dimtfillclr: v })} disabled={readOnly} />
      )}

      <div className="flex items-center gap-2">
        <Checkbox id="dimtih" checked={style.dimtih} onCheckedChange={(v) => onChange({ dimtih: Boolean(v) })} disabled={readOnly} />
        <Label htmlFor="dimtih" className="text-xs cursor-pointer">{f('dimtih')}</Label>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="dimtoh" checked={style.dimtoh} onCheckedChange={(v) => onChange({ dimtoh: Boolean(v) })} disabled={readOnly} />
        <Label htmlFor="dimtoh" className="text-xs cursor-pointer">{f('dimtoh')}</Label>
      </div>
    </div>
  );
}
