'use client';

/**
 * ADR-562 Φ5 — Shared presentational field components for the DIMSTYLE Style Manager.
 *
 * SSoT for the accordion sections (Lines/Text/Symbols): one implementation of each
 * field kind, reused everywhere — no per-section copy-paste.
 *
 * - `NumField` / `BoolField` — extracted from `LinesSection` (were local there).
 * - `SelectField` — generic labelled Radix Select over a literal string list.
 * - `ColorField` — ACI colour Select with a swatch preview (AutoCAD DIMSTYLE dialog
 *   pattern). Reuses `resolveDimColor` (ACI→hex) + `getDynamicBackgroundClass`
 *   (dynamic bg without inline styles, N.3).
 * - `LineweightField` — `LineweightMm` Select (ByLayer + concrete mm); picks the
 *   real `LineweightMm` from the option list (no `as LineweightMm` cast).
 * - `LinetypeField` — Select over the live `listSelectableLinetypeNames()` catalog.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-562-dimension-per-part-styling.md §Φ5
 */

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
import { getDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import type { LineweightMm } from '../../../../types/entities';
import { LINEWEIGHT_SPECIAL } from '../../../../config/lineweight-iso-catalog';
import { resolveDimColor } from '../../../../rendering/entities/dimension/dim-color-resolver';
import { listSelectableLinetypeNames } from '../../../../stores/LinetypeRegistry';
import { DIM_COLOR_OPTIONS, DIM_LINEWEIGHT_OPTIONS } from './dim-style-field-options';

const ROW = 'flex items-center justify-between gap-2';
const LABEL = 'text-xs shrink-0 w-36';
const TRIGGER = 'h-6 text-xs w-40';

export function NumField({
  id, label, value, onChange, disabled,
}: {
  id: string; label: string; value: number; onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <div className={ROW}>
      <Label htmlFor={id} className={LABEL}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        step={0.1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-6 text-xs w-20 px-1.5"
      />
    </div>
  );
}

export function BoolField({
  id, label, checked, onChange, disabled,
}: {
  id: string; label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} disabled={disabled} />
      <Label htmlFor={id} className="text-xs cursor-pointer">{label}</Label>
    </div>
  );
}

/** Generic labelled Select over a literal-value string list (font, …). */
export function SelectField({
  label, value, options, onChange, disabled,
}: {
  label: string; value: string; options: readonly string[]; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div className={ROW}>
      <Label className={LABEL}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={TRIGGER}><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** ACI colour Select with a swatch preview — AutoCAD/Revit DIMSTYLE colour dropdown. */
export function ColorField({
  label, value, onChange, disabled,
}: {
  label: string; value: number; onChange: (aci: number) => void; disabled?: boolean;
}) {
  const { t } = useTranslation('dxf-viewer-panels');
  const cl = (key: string) => t(`panels.dimensions.editor.colorOptions.${key}`);
  return (
    <div className={ROW}>
      <Label className={LABEL}>{label}</Label>
      <Select value={String(value)} onValueChange={(v) => onChange(parseInt(v, 10))} disabled={disabled}>
        <SelectTrigger className={TRIGGER}><SelectValue /></SelectTrigger>
        <SelectContent>
          {DIM_COLOR_OPTIONS.map((o) => (
            <SelectItem key={o.aci} value={String(o.aci)} className="text-xs">
              <span className="inline-flex items-center gap-2">
                <span className={`inline-block w-3 h-3 rounded-sm border border-border ${getDynamicBackgroundClass(resolveDimColor(o.aci))}`} />
                {cl(o.labelKey)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** `LineweightMm` Select (ByLayer + concrete ISO mm). No cast — value looked up. */
export function LineweightField({
  label, value, onChange, disabled,
}: {
  label: string; value: LineweightMm; onChange: (v: LineweightMm) => void; disabled?: boolean;
}) {
  const { t } = useTranslation('dxf-viewer-panels');
  const fmt = (lw: LineweightMm) =>
    lw === LINEWEIGHT_SPECIAL.BYLAYER ? t('panels.dimensions.editor.byLayer') : `${lw.toFixed(2)} mm`;
  return (
    <div className={ROW}>
      <Label className={LABEL}>{label}</Label>
      <Select
        value={String(value)}
        onValueChange={(v) => {
          const lw = DIM_LINEWEIGHT_OPTIONS.find((x) => String(x) === v);
          if (lw !== undefined) onChange(lw);
        }}
        disabled={disabled}
      >
        <SelectTrigger className={TRIGGER}><SelectValue /></SelectTrigger>
        <SelectContent>
          {DIM_LINEWEIGHT_OPTIONS.map((lw) => (
            <SelectItem key={lw} value={String(lw)} className="text-xs">{fmt(lw)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Linetype-name Select over the live registry catalog (ByLayer + registered). */
export function LinetypeField({
  label, value, onChange, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <SelectField
      label={label}
      value={value}
      options={listSelectableLinetypeNames()}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
