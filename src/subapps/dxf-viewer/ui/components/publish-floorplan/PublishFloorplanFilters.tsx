'use client';

/**
 * @fileoverview **Ο ΠΙΝΑΚΑΣ ΦΙΛΤΡΩΝ** της «Δημοσίευσης κάτοψης»: πρότυπο · χρώμα · προαιρετικές ομάδες (ADR-909 Β2.8).
 * @related ../../../print/public-floorplan/public-floorplan-presets (η επιλογή και τα πρότυπα) · ./PublishFloorplanDialog
 * @module subapps/dxf-viewer/ui/components/publish-floorplan/PublishFloorplanFilters
 *
 * Τρεις άξονες, με τη σειρά που αποφασίζει ο άνθρωπος:
 *
 * 1. **πρότυπο** — γεμίζει τους διακόπτες με ένα κλικ· μόλις αλλάξει διακόπτης, λέει «Προσαρμοσμένο»·
 * 2. **χρώμα** — ανεξάρτητο από το πρότυπο (Revit: «Color · Black Lines · Grayscale» είναι του Print Setup)·
 * 3. **ομάδες** — «Κτίσμα και εξοπλισμός» χωριστά από «Σχέδιο» (Revit: Model / Annotation Categories).
 *
 * 🔑 **Ελεγχόμενο, χωρίς δική του κατάσταση**: η επιλογή ζει στον διάλογο και ταξιδεύει στη **συνταγή**.
 * ⛔ Δεν γράφει σε κανένα store — οι ρυθμίσεις όψης του ανθρώπου δεν αλλάζουν επειδή ετοίμασε μια αγγελία.
 */

import * as React from 'react';

import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PublicFloorplanGroup } from '@/lib/listings/floorplan-render-recipe';

import type { PublicFloorplanGroupCounts } from '../../../print/public-floorplan/public-floorplan-profile';
import {
  PUBLIC_FLOORPLAN_PLOT_STYLES,
  PUBLIC_FLOORPLAN_PRESETS,
  PUBLIC_FLOORPLAN_PRESET_IDS,
  PUBLIC_FLOORPLAN_SECTIONS,
  publicFloorplanGroupsOf,
  publicFloorplanPresetOf,
  withFloorplanGroup,
  type PublicFloorplanChoice,
  type PublicFloorplanPresetId,
} from '../../../print/public-floorplan/public-floorplan-presets';
import { PrintRadioGroup, type PrintRadioOption } from '../print/PrintRadioGroup';

/** Ό,τι δείχνει ο επιλογέας προτύπου όταν οι διακόπτες δεν ταιριάζουν με κανένα πρότυπο. */
const CUSTOM_PRESET = 'custom';
type PresetValue = PublicFloorplanPresetId | typeof CUSTOM_PRESET;

export interface PublishFloorplanFiltersProps {
  readonly choice: PublicFloorplanChoice;
  readonly onChange: (next: PublicFloorplanChoice) => void;
  /** Πόσα στοιχεία έχει το σχέδιο ανά ομάδα — `null` όσο δεν έχει βγει ακόμη η πρώτη εικόνα. */
  readonly counts: PublicFloorplanGroupCounts | null;
  readonly disabled: boolean;
}

export function PublishFloorplanFilters({
  choice,
  onChange,
  counts,
  disabled,
}: PublishFloorplanFiltersProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const preset: PresetValue = publicFloorplanPresetOf(choice.groups) ?? CUSTOM_PRESET;

  const presetOptions: PrintRadioOption<PresetValue>[] = PUBLIC_FLOORPLAN_PRESET_IDS.map((id) => ({
    value: id,
    label: t(`publishFloorplan.filters.presets.${id}`),
    disabled,
  }));
  // «Προσαρμοσμένο» δεν διαλέγεται — **προκύπτει**. Γι' αυτό δεν είναι τέταρτο κουμπί *(μετρημένο ζωντανά: η σειρά
  // γινόταν 370 px σε στήλη 272 και έπεφτε πάνω στην εικόνα)*· το λέει ο τίτλος, και κανένα κουμπί δεν είναι αναμμένο.
  const presetLegend = preset === CUSTOM_PRESET
    ? `${t('publishFloorplan.filters.preset')} · ${t('publishFloorplan.filters.presets.custom')}`
    : t('publishFloorplan.filters.preset');

  return (
    <aside className="flex flex-col gap-4 text-sm" aria-label={t('publishFloorplan.filters.title')}>
      <PrintRadioGroup
        legend={presetLegend}
        name="publish-floorplan-preset"
        value={preset}
        options={presetOptions}
        onChange={(next) => {
          if (next !== CUSTOM_PRESET) onChange({ ...choice, groups: PUBLIC_FLOORPLAN_PRESETS[next] });
        }}
      />

      <PrintRadioGroup
        legend={t('publishFloorplan.filters.colour')}
        name="publish-floorplan-colour"
        value={choice.plotStyle}
        options={PUBLIC_FLOORPLAN_PLOT_STYLES.map((style) => ({
          value: style,
          label: t(`publishFloorplan.filters.colours.${style}`),
          disabled,
        }))}
        onChange={(plotStyle) => onChange({ ...choice, plotStyle })}
      />

      {PUBLIC_FLOORPLAN_SECTIONS.map((section) => (
        <fieldset key={section} className="flex flex-col gap-2" disabled={disabled}>
          <legend className="mb-1 text-xs font-medium text-muted-foreground">
            {t(`publishFloorplan.filters.sections.${section}`)}
          </legend>
          {publicFloorplanGroupsOf(section).map((group) => (
            <GroupSwitch
              key={group}
              group={group}
              shown={choice.groups.includes(group)}
              count={counts === null ? null : counts[group]}
              onChange={(shown) => onChange(withFloorplanGroup(choice, group, shown))}
            />
          ))}
        </fieldset>
      ))}

      <footer className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p>{t('publishFloorplan.filters.always')}</p>
        <p>{t('publishFloorplan.filters.never')}</p>
      </footer>
    </aside>
  );
}

/**
 * Ένας διακόπτης ομάδας, με το πλήθος των στοιχείων της στο σχέδιο.
 *
 * 🔑 Ομάδα με **0** στοιχεία είναι ανενεργή: ο διακόπτης της δεν θα άλλαζε ούτε ένα pixel, και ένας
 * διακόπτης που «δεν κάνει τίποτα» διαβάζεται ως σφάλμα. Ο αριθμός λέει τον λόγο.
 */
function GroupSwitch({ group, shown, count, onChange }: {
  readonly group: PublicFloorplanGroup;
  readonly shown: boolean;
  readonly count: number | null;
  readonly onChange: (shown: boolean) => void;
}): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const id = `publish-floorplan-group-${group}`;

  return (
    <label htmlFor={id} className="flex items-center gap-2">
      <Switch id={id} checked={shown} onCheckedChange={onChange} disabled={count === 0} />
      <span className="flex-1">{t(`publishFloorplan.filters.groups.${group}`)}</span>
      {count !== null && (
        <output htmlFor={id} className="tabular-nums text-xs text-muted-foreground">{count}</output>
      )}
    </label>
  );
}
