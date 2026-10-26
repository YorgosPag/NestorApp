'use client';

/**
 * @fileoverview **Οι μονάδες του αρχείου τοπογραφικού** — ένα dropdown για κάθε δρόμο εισαγωγής: ο οδηγός του DXF Viewer
 * (ADR-650 M8β/Ε) και η αγγελία οικοπέδου (ADR-920 Β4.9).
 * @related lib/terrain/survey-import/topo-import-types (`TopoUnit`) · ./SurveyColumnMapTable (ο πίνακας που το φιλοξενεί)
 * @module components/terrain/survey-import/SurveyUnitSelect
 *
 * 🔑 **Μετακόμισε από τον viewer** (`TopoUnitSelect`) όταν απέκτησε δεύτερο καταναλωτή έξω από το subapp — ένα widget,
 *   μία λίστα μονάδων, κανένα δίδυμο (N.18).
 * 🔑 **`null` = δεν διαλέχτηκε ακόμη**: η αγγελία δεν μαντεύει ποτέ μονάδα σιωπηλά (§13.7)· το dropdown δείχνει τότε
 *   «Διάλεξε μονάδες…» αντί για μια προεπιλογή που μοιάζει με απόφαση.
 */

import React from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TopoUnit } from '@/lib/terrain/survey-import/topo-import-types';

/** Οι μονάδες που μπορεί να έχει ένα αρχείο τοπογραφικού — η ΜΙΑ λίστα και των δύο δρόμων. */
export const SURVEY_UNITS: readonly TopoUnit[] = ['m', 'mm', 'ft'];

const NS = 'terrain-survey:unit';

export interface SurveyUnitSelectProps {
  readonly unit: TopoUnit | null;
  readonly disabled?: boolean;
  readonly onUnit: (unit: TopoUnit) => void;
}

export function SurveyUnitSelect({ unit, disabled = false, onUnit }: SurveyUnitSelectProps) {
  const { t } = useTranslation('terrain-survey');
  const choose = (value: string) => {
    const picked = SURVEY_UNITS.find((candidate) => candidate === value);
    if (picked !== undefined) onUnit(picked);
  };
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{t(`${NS}.label`)}</span>
      {/* `''` (όχι `undefined`) κρατά το Select ελεγχόμενο και δείχνει το placeholder — κανένα SelectItem δεν έχει `''` (CHECK 3.48). */}
      <Select value={unit ?? ''} onValueChange={choose} disabled={disabled}>
        <SelectTrigger size="sm">
          <SelectValue placeholder={t(`${NS}.placeholder`)} />
        </SelectTrigger>
        <SelectContent>
          {SURVEY_UNITS.map((candidate) => (
            <SelectItem key={candidate} value={candidate}>{t(`${NS}.${candidate}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
