'use client';

/**
 * ADR-507 / ADR-510 — one entity-property row + a group section, for the left
 * Properties palette. Renders a descriptor field (`EntityPropertyField`) driven by
 * the SHARED per-entity bridge, so the palette and the ribbon read/write the exact
 * same SSoT.
 *
 * Control dispatch (palette-native, reusing existing engines/helpers — μηδέν clone):
 *   - select   → `BimPropertyRow` (ADR-471 SSoT row, ίδιο με τα advanced panels)
 *   - color    → `ColorDialogTrigger` (ο ΙΔΙΟΣ picker με ribbon/settings)
 *   - numeric  → editable `<Input>` + pure `ribbon-combobox-numeric` helpers
 *   - toggle   → `Switch` (get/onToggle) — Σταυρωτή / Πίσω πλάνο / Μονόχρωμη
 *   - readout  → `BimPropertyRow` read-only (Εμβαδόν)
 *
 * Γενικεύθηκε από το πρώην line-only `LinePropertyRow` ώστε γραμμή & γραμμοσκίαση να
 * μοιράζονται ΕΝΑ renderer (SSoT). Το `LinePropertyRow` re-export-άρει το section.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
import type { EntityPropertyField, EntityPropertyGroup } from './entity-property-fields';

type ComboState = RibbonComboboxState | null;

/** Optional toggle half of the bridge (only style panels with toggle fields supply it). */
export interface EntityPropertyToggleBridge {
  /** `null` (mixed/άγνωστο) → treated as unchecked by the row. */
  readonly getToggleState: (commandKey: string) => boolean | null;
  readonly onToggle: (commandKey: string, next: boolean) => void;
}

interface EntityPropertyRowProps {
  readonly field: EntityPropertyField;
  readonly state: ComboState;
  readonly onChange: (commandKey: string, value: string) => void;
  readonly toggle?: EntityPropertyToggleBridge;
}

/** Dispatch one descriptor field to the matching palette control. */
export function EntityPropertyRow({ field, state, onChange, toggle }: EntityPropertyRowProps): React.ReactElement {
  if (field.control === 'color') {
    return <ColorRow field={field} value={state?.value ?? '#000000'} onChange={onChange} />;
  }
  if (field.control === 'numeric') {
    return <NumericRow field={field} value={state?.value ?? null} onChange={onChange} />;
  }
  if (field.control === 'toggle') {
    return <ToggleRow field={field} toggle={toggle} />;
  }
  if (field.control === 'readout') {
    // Read-only readout (Εμβαδόν): reuse the ADR-471 row's read-only mode.
    const readoutField: BimPropertyField = { commandKey: field.commandKey, labelKey: field.labelKey, options: [], readOnly: true };
    return <BimPropertyRow field={readoutField} value={state?.value ?? null} onChange={onChange} />;
  }
  // select — options come live from the bridge (layer/pattern/style); fall back to the
  // descriptor's static list (lineweight/island/…) when the bridge supplies none.
  const bimField: BimPropertyField = { commandKey: field.commandKey, labelKey: field.labelKey, options: field.options };
  const options = state && state.options.length > 0 ? state.options : field.options;
  return <BimPropertyRow field={bimField} value={state?.value ?? null} options={options} onChange={onChange} />;
}

/** A titled group of rows (Γενικά / Μοτίβο / Διαβάθμιση / …). */
export function EntityPropertySection({
  title, group, getComboboxState, onComboboxChange, toggle,
}: {
  readonly title: string;
  readonly group: EntityPropertyGroup;
  readonly getComboboxState: (commandKey: string) => ComboState;
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly toggle?: EntityPropertyToggleBridge;
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold text-foreground">{title}</h3>
      {group.fields.map((f) => (
        <EntityPropertyRow
          key={f.commandKey}
          field={f}
          state={getComboboxState(f.commandKey)}
          onChange={onComboboxChange}
          toggle={toggle}
        />
      ))}
    </section>
  );
}

// ── Palette-native controls (color + numeric + toggle) ────────────────────────

function ColorRow({
  field, value, onChange,
}: {
  field: EntityPropertyField;
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
  field: EntityPropertyField;
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

function ToggleRow({
  field, toggle,
}: {
  field: EntityPropertyField;
  toggle?: EntityPropertyToggleBridge;
}) {
  const { t } = useTranslation('dxf-viewer-shell');
  const label = t(field.labelKey);
  const checked = toggle?.getToggleState(field.commandKey) ?? false;
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <Switch
        checked={checked}
        aria-label={label}
        onCheckedChange={(next) => toggle?.onToggle(field.commandKey, next)}
      />
    </div>
  );
}
