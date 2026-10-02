'use client';

/**
 * @fileoverview **«Πού είναι αυτός ο χώρος κατά τον νόμο;»** (ADR-898 §19) — η απάντηση **ανά χώρο**, στο συρτάρι του
 * πίνακα: υπερισχύει του γεγονότος κτιρίου (είσοδος αποθηκών υπογείου) και της ζώνης/του ορόφου του χώρου.
 * @related `services/objective-value/space-position-mutation-gateway.ts` (η πόρτα γραφής) · `BuildingObjectiveValueFacts.tsx`
 *   (το ίδιο χειριστήριο `ChoiceSelect`, η ίδια ουρά και ένδειξη αποθήκευσης)
 * @module components/building-management/tabs/ObjectiveValueTab/BuildingSpacePositionQuestion
 *
 * 🔑 Η οθόνη **δεν** λύνει θέση: δείχνει ό,τι έλυσε ο server (`space.position`) και από πού, και στέλνει μόνο την απάντηση.
 *   Τα ποσά τα ξαναϋπολογίζει ο server (το γεγονός `PARKING_UPDATED`/`STORAGE_UPDATED` ⇒ νέα ανάγνωση).
 */

import React, { useCallback, useId } from 'react';

import { ObjectiveValueSaveStatus } from '@/components/objective-value/ObjectiveValueSaveStatus';
import { ChoiceSelect } from '@/components/objective-value/objective-value-inputs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useFieldPatchQueue } from '@/hooks/useFieldPatchQueue';
import type { BuildingObjectiveValueRow, BuildingSpaceRowFacts } from '@/lib/objective-value/building-objective-values-contract';
import {
  SPACE_LAW_POSITIONS,
  type BuildingSpaceKind,
  type SpaceLawPosition,
} from '@/lib/objective-value/building-space-objective-value';
import type { ObjectiveValueWriteOutcome, ObjectiveValueWriteRejection } from '@/lib/objective-value/objective-value-improve-subject';
import { updateSpaceObjectiveValuePositionWithPolicy } from '@/services/objective-value/space-position-mutation-gateway';

import type { BuildingObjectiveValueLabels } from './useBuildingObjectiveValueLabels';

const B = 'objective-value:building';

interface PositionPatch {
  readonly position: SpaceLawPosition | null;
}

/** Από πού ήρθε η θέση που ισχύει τώρα — μία πρόταση, ώστε ο άνθρωπος να ξέρει τι υπερισχύει. */
function sourceText(space: BuildingSpaceRowFacts, kind: BuildingSpaceKind, labels: BuildingObjectiveValueLabels): string {
  const { position } = space;
  if (position.kind === 'mainUse') return labels.t(`${B}.space.source.mainUse`);
  if (position.kind === 'open') {
    const options = position.candidates.map((candidate) => labels.position(kind, candidate)).join(' · ');
    return labels.t(`${B}.space.source.open`, { options });
  }
  return labels.t(`${B}.space.source.${position.source}`, { position: labels.position(kind, position.position) });
}

function useSpacePositionSave(row: BuildingObjectiveValueRow, kind: BuildingSpaceKind, declared: SpaceLawPosition | null) {
  const send = useCallback(
    (patch: PositionPatch): Promise<ObjectiveValueWriteOutcome> =>
      updateSpaceObjectiveValuePositionWithPolicy({ kind, spaceId: row.id, position: patch.position }),
    [kind, row.id],
  );
  return useFieldPatchQueue<PositionPatch, ObjectiveValueWriteRejection>(send, declared);
}

interface QuestionProps {
  readonly row: BuildingObjectiveValueRow;
  readonly kind: BuildingSpaceKind;
  readonly space: BuildingSpaceRowFacts;
  readonly labels: BuildingObjectiveValueLabels;
}

export function BuildingSpacePositionQuestion({ row, kind, space, labels }: QuestionProps) {
  const { t } = labels;
  const fieldId = useId();
  const save = useSpacePositionSave(row, kind, space.declaredPosition);
  // Αισιόδοξη επικάλυψη: ό,τι στάλθηκε και δεν επιβεβαιώθηκε ακόμη νικά την ανάγνωση του server.
  const pending = save.overlay;
  const shown = pending !== null && 'position' in pending ? pending.position : space.declaredPosition;
  return (
    <section aria-labelledby={`${fieldId}-label`} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Label id={`${fieldId}-label`} htmlFor={fieldId}>{t(`${B}.space.question`)}</Label>
        <ObjectiveValueSaveStatus save={save} />
      </header>
      <ChoiceSelect
        id={fieldId}
        value={shown}
        values={SPACE_LAW_POSITIONS[kind]}
        getLabel={(position) => labels.position(kind, position)}
        placeholder={t(`${B}.space.placeholder`)}
        onChange={(position) => save.enqueue({ position })}
      />
      <p className="m-0 text-xs text-muted-foreground">{sourceText(space, kind, labels)}</p>
      {shown !== null && (
        <Button type="button" variant="link" size="sm" className="h-auto self-start p-0" onClick={() => save.enqueue({ position: null })}>
          {t(`${B}.space.clear`)}
        </Button>
      )}
    </section>
  );
}
