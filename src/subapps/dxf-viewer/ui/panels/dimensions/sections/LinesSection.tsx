'use client';

import React from 'react';
import { useTranslation } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { DimStyle } from '../../../../types/dimension';
import type { UpdateCustomStylePatch } from '../../../../systems/dimensions/dim-style-registry';

interface LinesSectionProps {
  style: DimStyle;
  onChange: (patch: UpdateCustomStylePatch) => void;
}

function NumField({
  id, label, value, onChange,
}: {
  id: string; label: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label htmlFor={id} className="text-xs shrink-0 w-36">{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        step={0.1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-6 text-xs w-20 px-1.5"
      />
    </div>
  );
}

function BoolField({
  id, label, checked, onChange,
}: {
  id: string; label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      <Label htmlFor={id} className="text-xs cursor-pointer">{label}</Label>
    </div>
  );
}

export function LinesSection({ style, onChange }: LinesSectionProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const f = (key: string) => t(`panels.dimensions.editor.fields.${key}`);

  return (
    <div className="flex flex-col gap-2 py-1">
      <NumField id="dimasz" label={f('dimasz')} value={style.dimasz} onChange={(v) => onChange({ dimasz: v })} />
      <NumField id="dimexe" label={f('dimexe')} value={style.dimexe} onChange={(v) => onChange({ dimexe: v })} />
      <NumField id="dimexo" label={f('dimexo')} value={style.dimexo} onChange={(v) => onChange({ dimexo: v })} />
      <NumField id="dimdli" label={f('dimdli')} value={style.dimdli} onChange={(v) => onChange({ dimdli: v })} />
      <BoolField id="sDL1" label={f('suppressDimLine1')} checked={style.suppressDimLine1} onChange={(v) => onChange({ suppressDimLine1: v })} />
      <BoolField id="sDL2" label={f('suppressDimLine2')} checked={style.suppressDimLine2} onChange={(v) => onChange({ suppressDimLine2: v })} />
      <BoolField id="sEL1" label={f('suppressExtLine1')} checked={style.suppressExtLine1} onChange={(v) => onChange({ suppressExtLine1: v })} />
      <BoolField id="sEL2" label={f('suppressExtLine2')} checked={style.suppressExtLine2} onChange={(v) => onChange({ suppressExtLine2: v })} />
    </div>
  );
}
