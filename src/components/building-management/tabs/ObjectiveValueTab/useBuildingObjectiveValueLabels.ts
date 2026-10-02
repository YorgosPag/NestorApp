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
import type {
  BuildingObjectiveValueRow,
  BuildingObjectiveValueRowKind,
  BuildingSpaceReference,
  OtherBuildingRef,
} from '@/lib/objective-value/building-objective-values-contract';
import type { BuildingSpaceKind, SpaceLawPosition } from '@/lib/objective-value/building-space-objective-value';
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
  readonly rowName: (row: BuildingObjectiveValueRow) => string;
  /** «Μονάδα» · «Θέση στάθμευσης» · «Αποθήκη». */
  readonly kind: (kind: BuildingObjectiveValueRowKind) => string;
  /** Η θέση κατά τον νόμο — οι ΙΔΙΕΣ λέξεις με τον υπολογιστή (`property.parkingPosition.*` / `storagePosition.*`). */
  readonly position: (kind: BuildingSpaceKind, position: SpaceLawPosition) => string;
  readonly floor: (floor: number | null) => string;
  readonly stage: (stage: BuildingStageReached) => string;
  readonly inherited: (facts: readonly BuildingInheritedFact[]) => string;
  /** Η ετικέτα ενός άλλου κτιρίου (`κωδικός — όνομα`) · «Άλλο κτίριο» όταν δεν διαβάστηκε. */
  readonly otherBuilding: (ref: OtherBuildingRef) => string;
  /** «Α3 · σε άλλο κτίριο (Β)» — η μονάδα-κάτοχος που ζει αλλού (ADR-898 §20). */
  readonly ownerElsewhere: (unitName: string | null, ref: OtherBuildingRef) => string;
  readonly referenceName: (reference: BuildingSpaceReference) => string;
}

export function useBuildingObjectiveValueLabels(): BuildingObjectiveValueLabels {
  const { t } = useTranslation([NS]);
  const amountText = useObjectiveValueAmountText();
  const openLabel = useObjectiveValueOpenLabel();

  const stage = useCallback((value: BuildingStageReached) => t(`${NS}:stages.${value}`), [t]);
  const otherBuilding = useCallback((ref: OtherBuildingRef) => ref.label ?? t(`${B}.elsewhere.unnamedBuilding`), [t]);

  const status = useCallback(
    (value: BuildingUnitObjectiveValue): string => {
      switch (value.kind) {
        case 'unsupported':
          return t(value.reason === 'mainUse' ? `${B}.status.mainUse` : `${B}.status.unsupported`);
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
      rowName: (row) => row.name ?? t(`${B}.unnamed.${row.kind}`),
      kind: (kind) => t(`${B}.kinds.${kind}`),
      position: (kind, position) => t(`${NS}:property.${kind === 'parking' ? 'parkingPosition' : 'storagePosition'}.${position}`),
      floor: (floor) => (floor === null ? t(`${B}.noFloor`) : formatFloorLabel(floor)),
      stage,
      inherited: (facts) => facts.map((fact) => t(`${B}.inherited.facts.${fact}`)).join(', '),
      otherBuilding,
      ownerElsewhere: (unitName, ref) => t(`${B}.elsewhere.owner`, { unit: unitName ?? t(`${B}.unnamed.unit`), building: otherBuilding(ref) }),
      referenceName: (reference) => reference.name ?? t(`${B}.unnamed.${reference.kind}`),
    }),
    [t, amountText, status, stage, otherBuilding],
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
