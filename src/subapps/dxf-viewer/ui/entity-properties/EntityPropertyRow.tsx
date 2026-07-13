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
import { Pencil } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEscapeHandler, ESC_PRIORITY } from '@/subapps/dxf-viewer/systems/escape-bus';
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

/** Shared props for value-carrying palette rows (color + rename) — one signature SSoT (N.18). */
interface ValueRowProps {
  readonly field: EntityPropertyField;
  readonly value: string;
  readonly onChange: (commandKey: string, value: string) => void;
}

/** Resolve a field's translated label — the one label lookup shared by every palette row. */
function useFieldLabel(field: EntityPropertyField): string {
  const { t } = useTranslation('dxf-viewer-shell');
  return t(field.labelKey);
}

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
    return <EditableRow field={field} value={state?.value ?? null} onChange={onChange} />;
  }
  if (field.control === 'rename') {
    return <InlineRenameRow field={field} value={state?.value ?? ''} onChange={onChange} />;
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

function ColorRow({ field, value, onChange }: ValueRowProps) {
  const label = useFieldLabel(field);
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

/**
 * SSoT draft-commit input row (label + text `<Input>`). Owns the shared editing
 * lifecycle: local `draft` mirrors the external value while NOT focused, live
 * keystroke `filter` (optional), commit on blur/Enter via `resolve(draft)` →
 * `string` (emit) | `null` (reject → revert). Numeric & free-text rows are thin
 * wrappers supplying only their transform (N.18 — one editing engine, no twins).
 */
function DraftInputRow({
  label, external, inputMode, filter, resolve, onCommit,
}: {
  label: string;
  external: string;
  inputMode: 'text' | 'numeric' | 'decimal';
  filter?: (raw: string) => string;
  resolve: (draft: string) => string | null;
  onCommit: (value: string) => void;
}) {
  const editingRef = React.useRef(false);
  const [draft, setDraft] = React.useState(external);
  React.useEffect(() => {
    if (!editingRef.current) setDraft(external);
  }, [external]);

  const finish = () => {
    editingRef.current = false;
    const next = resolve(draft);
    if (next === null || next === external) { setDraft(next ?? external); return; }
    setDraft(next);
    onCommit(next);
  };

  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <Input
        className="h-7 w-36 shrink-0 text-xs"
        type="text"
        inputMode={inputMode}
        value={draft}
        aria-label={label}
        onFocus={() => { editingRef.current = true; }}
        onChange={(ev) => setDraft(filter ? filter(ev.target.value) : ev.target.value)}
        onBlur={finish}
        onKeyDown={(ev) => { if (ev.key === 'Enter') ev.currentTarget.blur(); }}
      />
    </div>
  );
}

/**
 * Numeric value row (`control:'numeric'`) — routes through the `ribbon-combobox-numeric`
 * config (live filter + clamp/commit) and delegates the editing lifecycle to
 * {@link DraftInputRow}. Always-open input (numeric values carry no accidental-save risk;
 * free-text identity uses the explicit {@link InlineRenameRow} instead).
 */
function EditableRow({
  field, value, onChange,
}: {
  field: EntityPropertyField;
  value: string | null;
  onChange: (commandKey: string, value: string) => void;
}) {
  const label = useFieldLabel(field);
  const command: RibbonCommand = {
    id: field.commandKey, labelKey: field.labelKey, commandKey: field.commandKey,
    numericInput: field.numericInput, options: field.options,
  };
  const config = resolveNumericConfig(command, field.options);
  return (
    <DraftInputRow
      label={label}
      external={value ?? ''}
      inputMode={config?.allowDecimal ? 'decimal' : 'numeric'}
      filter={(raw) => (config ? filterNumericDraft(raw, config) : raw)}
      resolve={(draft) => (config ? commitNumericDraft(draft, config) : null)}
      onCommit={(next) => onChange(field.commandKey, next)}
    />
  );
}

/**
 * Explicit click-to-edit identity row (`control:'rename'`) — read-only display by default,
 * enters edit mode ONLY on deliberate intent (double-click στο label / κουμπί ✎ / **F2**),
 * mirroring big-player rename (Revit/ArchiCAD/C4D/Figma) & το native `LayerItem`. Enter/blur
 * = commit, **Esc = cancel/revert** via το κεντρικό Escape Command Bus (ADR-364) ώστε το Esc
 * να μη «σκάει» και σε deselect. Commit εκπέμπει `onChange` → το bridge κάνει το atomic
 * rename-all-instances· empty/ίδιο = no-op (καμία αποθήκευση χωρίς πρόθεση).
 */
function InlineRenameRow({ field, value, onChange }: ValueRowProps) {
  const { t } = useTranslation('dxf-viewer-shell');
  const label = t(field.labelKey);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  // Suppresses the blur→commit that the input's unmount fires right after Esc — without it
  // the stale onBlur closure would re-commit the value we just cancelled (Esc-vs-blur race).
  const cancelledRef = React.useRef(false);

  React.useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const begin = () => { cancelledRef.current = false; setDraft(value); setEditing(true); };
  const cancel = () => { cancelledRef.current = true; setEditing(false); setDraft(value); };
  const commit = () => {
    if (cancelledRef.current) { cancelledRef.current = false; return; }
    setEditing(false);
    const next = draft.trim();
    if (next === '' || next === value) { setDraft(value); return; }
    onChange(field.commandKey, next);
  };

  // ADR-364: Esc cancels via the centralized Escape Command Bus (not a local key handler),
  // so it never falls through to entity-deselect while the field is focused.
  useEscapeHandler(
    editing
      ? {
          id: `inline-rename-${field.commandKey}`,
          priority: ESC_PRIORITY.POPOVER_DROPDOWN,
          allowWhenEditable: true,
          canHandle: () => editing,
          handle: () => { cancel(); return true; },
        }
      : null,
  );

  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      {editing ? (
        <Input
          className="h-7 w-36 shrink-0 text-xs"
          type="text"
          value={draft}
          aria-label={label}
          autoFocus
          onChange={(ev) => setDraft(ev.target.value)}
          onBlur={commit}
          onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); ev.currentTarget.blur(); } }}
        />
      ) : (
        <span className="flex w-36 shrink-0 items-center justify-between gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="truncate text-left text-xs text-foreground"
                onDoubleClick={begin}
                onKeyDown={(ev) => { if (ev.key === 'F2') { ev.preventDefault(); begin(); } }}
              >
                {value || '—'}
              </button>
            </TooltipTrigger>
            {value ? <TooltipContent side="top">{value}</TooltipContent> : null}
          </Tooltip>
          <button
            type="button"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={t('blockAdvancedPanel.fields.renameAction')}
            onClick={begin}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </span>
      )}
    </div>
  );
}

function ToggleRow({
  field, toggle,
}: {
  field: EntityPropertyField;
  toggle?: EntityPropertyToggleBridge;
}) {
  const label = useFieldLabel(field);
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
