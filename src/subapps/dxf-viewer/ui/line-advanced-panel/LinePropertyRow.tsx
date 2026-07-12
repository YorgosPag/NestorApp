'use client';

/**
 * ADR-510 Φ2E #5 — one line-property row + a group section, for the left
 * Properties palette. Renders a descriptor field (`LinePropertyField`) driven by
 * the SHARED `useRibbonLineToolBridge` state (`getComboboxState`/`onComboboxChange`),
 * so the palette and the ribbon read/write the exact same SSoT.
 *
 * Control dispatch (palette-native, reusing the existing engines/helpers — μηδέν clone):
 *   - select  → `BimPropertyRow` (ADR-471 SSoT row, ίδιο με ColumnAdvancedPanel)
 *   - color   → `ColorDialogTrigger` (ο ΙΔΙΟΣ picker με ribbon/settings)
 *   - numeric → editable `<Input>` + pure `ribbon-combobox-numeric` helpers
 *     (resolve/filter/commit — ίδιο SSoT με το ribbon RibbonEditableCombobox)
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Input } from '@/components/ui/input';
import { ColorDialogTrigger } from '../color/EnterpriseColorDialog';
import { BimPropertyRow } from '../bim-properties/BimPropertyRow';
import {
  resolveNumericConfig,
  filterNumericDraft,
  commitNumericDraft,
} from '../ribbon/components/buttons/ribbon-combobox-numeric';
import type { RibbonComboboxState } from '../ribbon/context/RibbonCommandContext';
import type { RibbonCommand } from '../ribbon/types/ribbon-types';
import type { BimPropertyField } from '../bim-properties/bim-property-types';
import type { LinePropertyField, LinePropertyGroup } from './line-property-fields';

type ComboState = RibbonComboboxState | null;

interface LinePropertyRowProps {
  readonly field: LinePropertyField;
  readonly state: ComboState;
  readonly onChange: (commandKey: string, value: string) => void;
}

/** Dispatch one descriptor field to the matching palette control. */
export function LinePropertyRow({ field, state, onChange }: LinePropertyRowProps): React.ReactElement {
  if (field.control === 'color') {
    return <ColorRow field={field} value={state?.value ?? '#000000'} onChange={onChange} />;
  }
  if (field.control === 'numeric') {
    return <NumericRow field={field} value={state?.value ?? null} onChange={onChange} />;
  }
  // select — options come live from the bridge (linetype/layer/style); fall back to
  // the descriptor's static list (lineweight) when the bridge supplies none.
  const bimField: BimPropertyField = { commandKey: field.commandKey, labelKey: field.labelKey, options: field.options };
  const options = state && state.options.length > 0 ? state.options : field.options;
  return <BimPropertyRow field={bimField} value={state?.value ?? null} options={options} onChange={onChange} />;
}

/** A titled group of rows (Γενικά / Γεωμετρία / Πολυγραμμή). */
export function LinePropertySection({
  title, group, getComboboxState, onComboboxChange,
}: {
  readonly title: string;
  readonly group: LinePropertyGroup;
  readonly getComboboxState: (commandKey: string) => ComboState;
  readonly onComboboxChange: (commandKey: string, value: string) => void;
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold text-foreground">{title}</h3>
      {group.fields.map((f) => (
        <LinePropertyRow key={f.commandKey} field={f} state={getComboboxState(f.commandKey)} onChange={onComboboxChange} />
      ))}
    </section>
  );
}

// ── Palette-native controls (color + numeric) ─────────────────────────────────

function ColorRow({
  field, value, onChange,
}: {
  field: LinePropertyField;
  value: string;
  onChange: (commandKey: string, value: string) => void;
}) {
  const { t } = useTranslation('dxf-viewer-shell');
  const label = t(field.labelKey);
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <ColorDialogTrigger
        value={value}
        onChange={(hex) => onChange(field.commandKey, hex)}
        label={value}
        title={label}
        alpha={false}
        modes={['hex', 'rgb', 'hsl']}
        palettes={['dxf', 'semantic', 'material']}
        recent
        eyedropper
        dimBackdrop={false}
      />
    </div>
  );
}

function NumericRow({
  field, value, onChange,
}: {
  field: LinePropertyField;
  value: string | null;
  onChange: (commandKey: string, value: string) => void;
}) {
  const { t } = useTranslation('dxf-viewer-shell');
  const label = t(field.labelKey);
  const command: RibbonCommand = {
    id: field.commandKey, labelKey: field.labelKey, commandKey: field.commandKey,
    numericInput: field.numericInput, options: field.options,
  };
  const config = resolveNumericConfig(command, field.options);
  const external = value ?? '';
  const editingRef = React.useRef(false);
  const [draft, setDraft] = React.useState(external);
  React.useEffect(() => {
    if (!editingRef.current) setDraft(external);
  }, [external]);

  const finish = () => {
    editingRef.current = false;
    const next = config ? commitNumericDraft(draft, config) : null;
    if (next === null) { setDraft(external); return; }
    setDraft(next);
    if (next !== external) onChange(field.commandKey, next);
  };

  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <Input
        className="h-7 w-36 shrink-0 text-xs"
        type="text"
        inputMode={config?.allowDecimal ? 'decimal' : 'numeric'}
        value={draft}
        aria-label={label}
        onFocus={() => { editingRef.current = true; }}
        onChange={(ev) => setDraft(config ? filterNumericDraft(ev.target.value, config) : ev.target.value)}
        onBlur={finish}
        onKeyDown={(ev) => { if (ev.key === 'Enter') ev.currentTarget.blur(); }}
      />
    </div>
  );
}
