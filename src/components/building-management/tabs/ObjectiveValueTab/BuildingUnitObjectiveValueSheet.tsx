'use client';

/**
 * @fileoverview **Η ανάλυση μιας μονάδας ή ενός χώρου** (ADR-898 Φ4β · §19) — συρτάρι στο πλάι του πίνακα (το Inspector του Figma, το
 * Properties του Revit): ο πίνακας μένει ορατός, η ανάλυση δίπλα του.
 * @module components/building-management/tabs/ObjectiveValueTab/BuildingUnitObjectiveValueSheet
 *
 * 🔑 Το **ίδιο** σώμα με την αγγελία (`ObjectiveValueEvaluated`, `voice="building"`) — κάθε συντελεστής με παραπομπή
 *   στον νόμο — και **από πού** ήρθε ό,τι κληρονόμησε η μονάδα από το κτίριο.
 */

import React from 'react';

import { ObjectiveValueEvaluated } from '@/components/objective-value/ObjectiveValueEvaluated';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { BuildingObjectiveValueRow, BuildingSpaceReference } from '@/lib/objective-value/building-objective-values-contract';

import { BuildingObjectiveValueRelations } from './BuildingObjectiveValueRelations';
import { BuildingSpacePositionQuestion } from './BuildingSpacePositionQuestion';
import type { BuildingObjectiveValueLabels } from './useBuildingObjectiveValueLabels';

const NS = 'objective-value';
const B = `${NS}:building`;

function Body({ row, labels }: { readonly row: BuildingObjectiveValueRow; readonly labels: BuildingObjectiveValueLabels }) {
  const { value } = row;
  if (value.kind !== 'evaluated') {
    return (
      <>
        <p role="status" className="m-0 text-sm text-foreground">{labels.status(value)}</p>
        <p className="m-0 text-xs text-muted-foreground">{labels.t(`${NS}:result.disclaimer`)}</p>
      </>
    );
  }
  return (
    <>
      <ObjectiveValueEvaluated value={value} voice="building" />
      {value.inherited.length > 0 && (
        <p className="m-0 text-xs text-muted-foreground">
          <strong className="font-medium text-foreground">{labels.t(`${B}.inherited.title`)}:</strong> {labels.inherited(value.inherited)}
        </p>
      )}
    </>
  );
}

/** Ό,τι έχει μόνο ο χώρος: η ερώτηση της θέσης του (§19). */
function SpaceQuestion({ row, labels }: { readonly row: BuildingObjectiveValueRow; readonly labels: BuildingObjectiveValueLabels }) {
  if (row.space === null || row.kind === 'unit') return null;
  // `key`: άλλος χώρος ⇒ νέα ουρά αποθήκευσης (η ουρά είναι ανά έγγραφο).
  return <BuildingSpacePositionQuestion key={row.id} row={row} kind={row.kind} space={row.space} labels={labels} />;
}

interface SheetProps {
  /** Η τελευταία επιλεγμένη γραμμή — μένει όσο το συρτάρι κλείνει (καμία κενή κίνηση κλεισίματος). */
  readonly row: BuildingObjectiveValueRow | null;
  /** Όλες οι γραμμές — για τη σχέση μονάδα ↔ παρακολουθήματα. */
  readonly rows: readonly BuildingObjectiveValueRow[];
  /** Χώροι μονάδων σε άλλο κτίριο (ADR-898 §20) — αναφορές χωρίς ποσό. */
  readonly references: readonly BuildingSpaceReference[];
  readonly open: boolean;
  readonly labels: BuildingObjectiveValueLabels;
  readonly onOpen: (row: BuildingObjectiveValueRow) => void;
  readonly onClose: () => void;
}

export function BuildingUnitObjectiveValueSheet({ row, rows, references, open, labels, onOpen, onClose }: SheetProps) {
  return (
    <Sheet open={open && row !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-lg">
        {row !== null && (
          <>
            <SheetHeader>
              <SheetTitle>{labels.kind(row.kind)} {labels.rowName(row)} · {labels.floor(row.floor)}</SheetTitle>
              <SheetDescription>{labels.t(`${B}.sheet.description`)}</SheetDescription>
            </SheetHeader>
            <BuildingObjectiveValueRelations row={row} rows={rows} references={references} labels={labels} onOpen={onOpen} />
            <SpaceQuestion row={row} labels={labels} />
            <Body row={row} labels={labels} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
