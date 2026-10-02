'use client';

/**
 * @fileoverview **Ο ιδιώτης ως κάτοχος της ενότητας «Αντικειμενική αξία»** (ADR-898 Φ3β-3) — η αγγελία ιδιώτη →
 * `ObjectiveValueImproveSubject`. Η πόρτα γραφής: `PATCH /api/owner-properties/[id]` (συναλλαγή στον server).
 * @related `lib/objective-value/objective-value-improve-subject.ts` · `services/property/property-mutation-gateway.ts`
 *   (ο αδελφός του γραφείου)
 * @module components/owner-property/improve/owner-improve-subject
 */

import { useMemo } from 'react';

import type { ObjectiveValueDeclarationsPatch } from '@/lib/objective-value/objective-value-declarations';
import {
  objectiveValueRejectionOf,
  type ObjectiveValueImproveSubject,
  type ObjectiveValueWriteOutcome,
} from '@/lib/objective-value/objective-value-improve-subject';
import { setOwnerListingObjectiveValue, type OwnerListingResult } from '@/services/owner-property/owner-property.service';
import type { OwnerProperty } from '@/types/owner-property';

function outcomeOf(result: OwnerListingResult): ObjectiveValueWriteOutcome {
  switch (result.kind) {
    case 'saved':
      return { kind: 'saved' };
    case 'invalid':
      return { kind: 'rejected', reasons: result.violations.map(objectiveValueRejectionOf) };
    case 'failed':
      return { kind: 'failed' };
  }
}

export function useOwnerImproveSubject(property: OwnerProperty): ObjectiveValueImproveSubject {
  const { id, objectiveValueDeclarations } = property;
  return useMemo(
    () => ({
      id,
      declarations: objectiveValueDeclarations,
      // Κάθε στιγμιότυπο του listener είναι νέο αντικείμενο ⇒ νέα αναθεώρηση (ίδιο συμβόλαιο με τη Φ3β-2).
      revision: property,
      write: (patch: ObjectiveValueDeclarationsPatch) => setOwnerListingObjectiveValue(id, patch).then(outcomeOf),
    }),
    [id, objectiveValueDeclarations, property],
  );
}
