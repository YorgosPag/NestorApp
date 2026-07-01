'use client';

import React from 'react';
import { useTranslation } from '@/i18n';
import type { DimStyle } from '../../../../types/dimension';
import type { UpdateCustomStylePatch } from '../../../../systems/dimensions/dim-style-registry';
import {
  NumField,
  BoolField,
  ColorField,
  LineweightField,
  LinetypeField,
} from './dim-style-fields';

interface LinesSectionProps {
  style: DimStyle;
  onChange: (patch: UpdateCustomStylePatch) => void;
  readOnly?: boolean;
}

export function LinesSection({ style, onChange, readOnly = false }: LinesSectionProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const f = (key: string) => t(`panels.dimensions.editor.fields.${key}`);

  return (
    <div className="flex flex-col gap-2 py-1">
      {/* Dimension line — colour / weight / linetype (ADR-562 Φ5) */}
      <ColorField label={f('dimclrd')} value={style.dimclrd} onChange={(v) => onChange({ dimclrd: v })} disabled={readOnly} />
      <LineweightField label={f('dimlwd')} value={style.dimlwd} onChange={(v) => onChange({ dimlwd: v })} disabled={readOnly} />
      <LinetypeField label={f('dimltype')} value={style.dimltype} onChange={(v) => onChange({ dimltype: v })} disabled={readOnly} />
      {/* Extension lines — colour / weight / linetype (dimltex1 mirrors dimltex2, unified) */}
      <ColorField label={f('dimclre')} value={style.dimclre} onChange={(v) => onChange({ dimclre: v })} disabled={readOnly} />
      <LineweightField label={f('dimlwe')} value={style.dimlwe} onChange={(v) => onChange({ dimlwe: v })} disabled={readOnly} />
      <LinetypeField label={f('dimltex1')} value={style.dimltex1} onChange={(v) => onChange({ dimltex1: v, dimltex2: v })} disabled={readOnly} />

      <NumField id="dimasz" label={f('dimasz')} value={style.dimasz} onChange={(v) => onChange({ dimasz: v })} disabled={readOnly} />
      <NumField id="dimexe" label={f('dimexe')} value={style.dimexe} onChange={(v) => onChange({ dimexe: v })} disabled={readOnly} />
      <NumField id="dimexo" label={f('dimexo')} value={style.dimexo} onChange={(v) => onChange({ dimexo: v })} disabled={readOnly} />
      <NumField id="dimdli" label={f('dimdli')} value={style.dimdli} onChange={(v) => onChange({ dimdli: v })} disabled={readOnly} />
      <BoolField id="sDL1" label={f('suppressDimLine1')} checked={style.suppressDimLine1} onChange={(v) => onChange({ suppressDimLine1: v })} disabled={readOnly} />
      <BoolField id="sDL2" label={f('suppressDimLine2')} checked={style.suppressDimLine2} onChange={(v) => onChange({ suppressDimLine2: v })} disabled={readOnly} />
      <BoolField id="sEL1" label={f('suppressExtLine1')} checked={style.suppressExtLine1} onChange={(v) => onChange({ suppressExtLine1: v })} disabled={readOnly} />
      <BoolField id="sEL2" label={f('suppressExtLine2')} checked={style.suppressExtLine2} onChange={(v) => onChange({ suppressExtLine2: v })} disabled={readOnly} />
    </div>
  );
}
