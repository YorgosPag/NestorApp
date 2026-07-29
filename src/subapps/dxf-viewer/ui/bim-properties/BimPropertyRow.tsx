'use client';

/**
 * ADR-471 — Generic BIM Properties-palette row (SSoT).
 *
 * Μία γραμμή ιδιότητας δομικού στοιχείου στο docked Properties panel: ετικέτα +
 * Radix `<Select>` (editable) ή read-only τιμή (readout). Canonical select =
 * `@/components/ui/select` (ADR-001 — ΟΧΙ EnterpriseComboBox). Tokens/semantic
 * classes· μηδέν inline styles (N.3).
 *
 * Εξάχθηκε (boy-scout, N.0.2) από το column-only `ColumnPropertyRow` ώστε να το
 * μοιράζονται ΟΛΑ τα advanced panels (κολόνα/δοκάρι/…) — μηδέν διπλότυπο. Mirror
 * της label-resolution του `RibbonCombobox` (isLiteralLabel ? labelKey : t).
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
// ADR-724 §14.7 — ο σκελετός της γραμμής ζει σε ΕΝΑ σημείο (ήταν αντιγραμμένος σε 6).
import { PaletteFieldRow } from '../components/palette-primitives';
import type { BimPropertyField, BimPropertyOption } from './bim-property-types';

const MIXED_PLACEHOLDER = '—';

function resolveLabel(option: BimPropertyOption, t: (key: string) => string): string {
  return option.isLiteralLabel ? option.labelKey : t(option.labelKey);
}

/**
 * ADR-715 — τα options σε **διαδοχικές** ομάδες κατά `groupLabelKey`. Διαδοχικές και όχι
 * ταξινομημένες: η σειρά των options είναι σημασιολογική (συχνότερο πρώτα) και δεν επιτρέπεται
 * να αναδιαταχθεί για χάρη της ομαδοποίησης. Options χωρίς key → ομάδα με `label: null`,
 * που αποδίδεται χωρίς κεφαλίδα (άρα ένα πεδίο χωρίς groups μένει ακριβώς όπως ήταν).
 */
function groupOptions(
  options: readonly BimPropertyOption[],
): readonly { readonly label: string | null; readonly items: readonly BimPropertyOption[] }[] {
  const groups: { label: string | null; items: BimPropertyOption[] }[] = [];
  for (const option of options) {
    const label = option.groupLabelKey ?? null;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(option);
    else groups.push({ label, items: [option] });
  }
  return groups;
}

export interface BimPropertyRowProps {
  readonly field: BimPropertyField;
  /** Τρέχουσα τιμή (από τον κοινό resolver)· `null` = mixed/άγνωστο. */
  readonly value: string | null;
  readonly onChange: (commandKey: string, value: string) => void;
  /** ADR-460 — ανενεργό control (π.χ. cross-tie pattern σε κυκλική/τοίχωμα). */
  readonly disabled?: boolean;
  /** ADR-460 — shape-aware override των `field.options` (π.χ. διαμάντι out σε Γ/Τ/Π). */
  readonly options?: readonly BimPropertyOption[];
}

export function BimPropertyRow({
  field,
  value,
  onChange,
  disabled,
  options: optionsOverride,
}: BimPropertyRowProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const label = t(field.labelKey);

  // Read-only readout (βάρη/όγκοι/ρ%): απλή ένδειξη, χωρίς control.
  if (field.readOnly) {
    return (
      <PaletteFieldRow label={label}>
        <span className="shrink-0 text-xs font-medium text-foreground">
          {value ?? MIXED_PLACEHOLDER}
        </span>
      </PaletteFieldRow>
    );
  }

  // Empty-string value → no selection (Radix forbids value=""). Inject current
  // free-form value as first option ώστε να μη χάνεται (mirror RibbonCombobox).
  // ADR-460 — ανενεργό control (π.χ. cross-tie σε κυκλική): δείξε ουδέτερο «—»
  // (δεν εφαρμόζεται) ΑΝΤΙ της αποθηκευμένης τιμής — non-destructive (η τιμή μένει).
  const baseOptions = optionsOverride ?? field.options;
  const resolved = disabled || value === '' ? null : value;
  const inOptions = resolved === null || baseOptions.some((o) => o.value === resolved);
  const options: readonly BimPropertyOption[] = inOptions
    ? baseOptions
    : [{ value: resolved, labelKey: resolved, isLiteralLabel: true }, ...baseOptions];

  return (
    <PaletteFieldRow label={label}>
      <Select
        value={resolved ?? undefined}
        onValueChange={(next) => onChange(field.commandKey, next)}
        disabled={disabled}
      >
        <SelectTrigger size="sm" aria-label={label} className="w-36 shrink-0">
          <SelectValue placeholder={MIXED_PLACEHOLDER} />
        </SelectTrigger>
        <SelectContent className="w-auto min-w-[var(--radix-select-trigger-width)] max-w-[24rem]">
          {groupOptions(options).map((group, groupIndex) => (
            // key = η ετικέτα της ομάδας· `groupIndex` καλύπτει τις ανώνυμες (label === null),
            // που μπορούν να είναι πολλές όταν αναμιγνύονται grouped/ungrouped options.
            <SelectGroup key={group.label ?? `ungrouped-${groupIndex}`}>
              {group.label !== null && <SelectLabel>{t(group.label)}</SelectLabel>}
              {group.items.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="whitespace-nowrap">
                  {resolveLabel(opt, t)}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </PaletteFieldRow>
  );
}
