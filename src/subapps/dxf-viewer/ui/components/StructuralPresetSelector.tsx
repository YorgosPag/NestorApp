'use client';

/**
 * ADR-479 Slice 2 — Structural Project Preset selector (Revit «Project Template»).
 *
 * Building-level dropdown: ο μηχανικός διαλέγει ένα built-in preset (κανονισμός/υλικά/
 * σεισμικά/έδαφος/occupancy) και το κτίριο «γεννιέται» ήδη σωστό αντί να ορίζει το κάθε
 * πεδίο. Thin reader/writer του `useStructuralSettingsStore`:
 *  - value = {@link resolveActivePresetKind} επί των τρεχόντων settings (null ⇒
 *    «Προσαρμοσμένο» — ο μηχανικός απέκλινε από κάθε template, όπως στο Revit).
 *  - onChange ⇒ `applyStructuralPreset(kind)` (ήδη persist-άρει στο ενεργό building),
 *    ΚΑΙ εκπέμπει `bim:compute-loads-requested` ώστε η αλλαγή κανονισμού/υλικών/φορτίων/
 *    σεισμικών να **επανυπολογίσει αμέσως** τη διαδρομή φορτίων → οπλισμό → πέδιλα →
 *    σχέδια/αναφορές (Revit «apply template = κτίριο ενημερώνεται»). Mirror του ρητού
 *    ribbon «Υπολογισμός Φορτίων» (`useDxfViewerCallbacks` → ίδιο event)· ο
 *    `useStructuralLoadTakedown` διαβάζει τα φρέσκα settings (`getState()`) event-time.
 *
 * Canonical `@/components/ui/select` (ADR-001 — ΟΧΙ RibbonCombobox: αυτό εξαρτάται από
 * το ribbon command context, εδώ είμαστε σε modal). Mount: {@link FloorManagementDialog}.
 *
 * @see ../../bim/structural/presets — οι ορισμοί + factory + active-preset detection
 * @see ../../hooks/useStructuralLoadTakedown — ο consumer του compute-loads event
 * @see docs/centralized-systems/reference/adrs/ADR-479-structural-project-presets.md
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  STRUCTURAL_PRESET_DEFINITIONS,
  STRUCTURAL_PRESET_ORDER,
  isStructuralPresetKind,
  resolveActivePresetKind,
} from '../../bim/structural/presets';
import { useStructuralSettingsStore } from '../../state/structural-settings-store';
import { EventBus } from '../../systems/events/EventBus';

export const StructuralPresetSelector: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');

  // Primitive selector → re-render μόνο όταν αλλάζει το ενεργό preset (όχι σε κάθε
  // settings mutation). `s` extends StructuralSettings, οπότε περνά απευθείας.
  const activeKind = useStructuralSettingsStore((s) => resolveActivePresetKind(s));
  const applyStructuralPreset = useStructuralSettingsStore((s) => s.applyStructuralPreset);

  const handleValueChange = useCallback(
    (next: string) => {
      if (!isStructuralPresetKind(next)) return;
      // 1) set + persist building settings (sync set → getState() is φρέσκο μετά).
      applyStructuralPreset(next);
      // 2) επανυπολογισμός αλυσίδας (φορτία → οπλισμός → πέδιλα → σχέδια/αναφορές).
      //    Ίδιο event με το ρητό ribbon «Υπολογισμός Φορτίων» — μηδέν διπλότυπο path.
      EventBus.emit('bim:compute-loads-requested', {});
    },
    [applyStructuralPreset],
  );

  const selectorLabel = t('structural.preset.selectorLabel');

  return (
    <section className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground" htmlFor="structural-preset-trigger">
        {selectorLabel}
      </label>
      <Select value={activeKind ?? undefined} onValueChange={handleValueChange}>
        <SelectTrigger id="structural-preset-trigger" size="md" aria-label={selectorLabel}>
          <SelectValue placeholder={t('structural.preset.custom')} />
        </SelectTrigger>
        {/* w-auto: μη κόβονται οι μακριές ελληνικές ετικέτες των presets. */}
        <SelectContent className="w-auto min-w-[16rem]">
          {STRUCTURAL_PRESET_ORDER.map((kind) => (
            <SelectItem key={kind} value={kind} className="whitespace-nowrap">
              {t(STRUCTURAL_PRESET_DEFINITIONS[kind].labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t('structural.preset.sectionDescription')}</p>
    </section>
  );
};
