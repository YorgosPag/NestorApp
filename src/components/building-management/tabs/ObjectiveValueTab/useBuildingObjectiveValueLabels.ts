'use client';

/**
 * @fileoverview **Οι λέξεις του πίνακα αντικειμενικής του κτιρίου** (ADR-898 Φ4β) — ΜΙΑ πηγή για την οθόνη **και** την
 * εξαγωγή XLSX: ό,τι λέει η γραμμή στην οθόνη, το ίδιο λέει το κελί του αρχείου.
 * @module components/building-management/tabs/ObjectiveValueTab/useBuildingObjectiveValueLabels
 *
 * 🔑 Κάθε κατάσταση λέει **γιατί**: όρια ⇒ από τι εξαρτώνται · λείπει ⇒ τι λείπει · πριν από στάδιο ⇒ ποιο στάδιο.
 *   Ποτέ σκέτο «—» χωρίς εξήγηση (εκεί όπου το Revit δείχνει κενό κελί και για «άγνωστο» και για «διαφέρει»).
 */

import { useCallback, useMemo } from 'react';

import { useObjectiveValueAmountText, useObjectiveValueOpenLabel } from '@/components/objective-value/ObjectiveValueEvaluated';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatFloorLabel } from '@/lib/intl-domain';
import type { BuildingInheritedFact, BuildingUnitObjectiveValue } from '@/lib/objective-value/building-objective-value';
import type { BuildingUnitObjectiveValueRow } from '@/lib/objective-value/building-objective-values-contract';
import type { BuildingStageReached } from '@/lib/objective-value/objective-value-stages';

const NS = 'objective-value';
const B = `${NS}:building`;

/** Η υπογραφή του `t` που περνά σε βοηθούς (ίδια με `PriceLabelT` — βλ. `pending-ratchet-work`). */
type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface BuildingObjectiveValueLabels {
  readonly t: Translate;
  /** Το ποσό (ακριβές ή «Χ έως Υ») · `null` = κανένα ποσό — η κατάσταση εξηγεί γιατί. */
  readonly amount: (value: BuildingUnitObjectiveValue) => string | null;
  readonly status: (value: BuildingUnitObjectiveValue) => string;
  readonly unitName: (row: BuildingUnitObjectiveValueRow) => string;
  readonly floor: (floor: number | null) => string;
  readonly stage: (stage: BuildingStageReached) => string;
  readonly inherited: (facts: readonly BuildingInheritedFact[]) => string;
}

export function useBuildingObjectiveValueLabels(): BuildingObjectiveValueLabels {
  const { t } = useTranslation([NS]);
  const amountText = useObjectiveValueAmountText();
  const openLabel = useObjectiveValueOpenLabel();

  const stage = useCallback((value: BuildingStageReached) => t(`${NS}:stages.${value}`), [t]);

  const status = useCallback(
    (value: BuildingUnitObjectiveValue): string => {
      switch (value.kind) {
        case 'unsupported':
          return t(`${B}.status.unsupported`);
        case 'no-zone':
          return t(`${B}.status.noZone`);
        case 'beforeStage':
          return t(`${B}.status.beforeStage`, { stage: stage(value.stage) });
        case 'evaluated':
          return evaluatedStatus(value.bounds, t, openLabel);
      }
    },
    [t, openLabel, stage],
  );

  return useMemo(
    () => ({
      t,
      amount: (value) => (value.kind === 'evaluated' ? amountText(value.bounds) : null),
      status,
      unitName: (row) => row.name ?? t(`${B}.unnamed`),
      floor: (floor) => (floor === null ? t(`${B}.noFloor`) : formatFloorLabel(floor)),
      stage,
      inherited: (facts) => facts.map((fact) => t(`${B}.inherited.facts.${fact}`)).join(', '),
    }),
    [t, amountText, status, stage],
  );
}

type Evaluated = Extract<BuildingUnitObjectiveValue, { readonly kind: 'evaluated' }>;

function evaluatedStatus(
  bounds: Evaluated['bounds'],
  t: Translate,
  openLabel: ReturnType<typeof useObjectiveValueOpenLabel>,
): string {
  if (bounds.kind === 'exact') return t(`${B}.status.exact`);
  if (bounds.kind === 'range') return t(`${B}.status.range`, { fields: bounds.open.map(openLabel).join(', ') });
  if (bounds.result.kind === 'invalid') return t(`${B}.status.invalid`);
  return t(`${B}.status.unresolved`, { fields: bounds.result.missing.map((field) => t(`${NS}:result.missing.${field}`)).join(', ') });
}
