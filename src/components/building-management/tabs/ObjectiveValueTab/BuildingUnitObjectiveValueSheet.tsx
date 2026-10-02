'use client';

/**
 * @fileoverview **Η ανάλυση μιας μονάδας** (ADR-898 Φ4β) — συρτάρι στο πλάι του πίνακα (το Inspector του Figma, το
 * Properties του Revit): ο πίνακας μένει ορατός, η ανάλυση δίπλα του.
 * @module components/building-management/tabs/ObjectiveValueTab/BuildingUnitObjectiveValueSheet
 *
 * 🔑 Το **ίδιο** σώμα με την αγγελία (`ObjectiveValueEvaluated`, `voice="building"`) — κάθε συντελεστής με παραπομπή
 *   στον νόμο — και **από πού** ήρθε ό,τι κληρονόμησε η μονάδα από το κτίριο.
 */

import React from 'react';

import { ObjectiveValueEvaluated } from '@/components/objective-value/ObjectiveValueEvaluated';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { BuildingUnitObjectiveValueRow } from '@/lib/objective-value/building-objective-values-contract';

import type { BuildingObjectiveValueLabels } from './useBuildingObjectiveValueLabels';

const NS = 'objective-value';
const B = `${NS}:building`;

function Body({ row, labels }: { readonly row: BuildingUnitObjectiveValueRow; readonly labels: BuildingObjectiveValueLabels }) {
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

interface SheetProps {
  /** Η τελευταία επιλεγμένη μονάδα — μένει όσο το συρτάρι κλείνει (καμία κενή κίνηση κλεισίματος). */
  readonly row: BuildingUnitObjectiveValueRow | null;
  readonly open: boolean;
  readonly labels: BuildingObjectiveValueLabels;
  readonly onClose: () => void;
}

export function BuildingUnitObjectiveValueSheet({ row, open, labels, onClose }: SheetProps) {
  return (
    <Sheet open={open && row !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-lg">
        {row !== null && (
          <>
            <SheetHeader>
              <SheetTitle>{labels.unitName(row)} · {labels.floor(row.floor)}</SheetTitle>
              <SheetDescription>{labels.t(`${B}.sheet.description`)}</SheetDescription>
            </SheetHeader>
            <Body row={row} labels={labels} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
