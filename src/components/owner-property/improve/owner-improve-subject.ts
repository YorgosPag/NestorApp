'use client';

/**
 * @fileoverview **Ο ιδιώτης ως κάτοχος της ενότητας «Αντικειμενική αξία»** (ADR-898 Φ3β-3) — η αγγελία ιδιώτη →
 * `ObjectiveValueImproveSubject`. Η πόρτα γραφής: `PATCH /api/owner-properties/[id]` (συναλλαγή στον server).
 * @related `lib/objective-value/objective-value-improve-subject.ts` · `services/property/property-mutation-gateway.ts`
 *   (ο αδελφός του γραφείου)
 * @module components/owner-property/improve/owner-improve-subject
 */

import { useMemo } from 'react';

import { useOwnerPropertyImportPort } from '@/hooks/energy-certificate/useEnergyCertificateImportPorts';

import type { CommonChargesPatch } from '@/lib/common-charges/common-charges';
import type {
  CommonChargesImproveSubject,
  CommonChargesWriteOutcome,
} from '@/lib/common-charges/common-charges-improve-subject';
import type { ObjectiveValueDeclarationsPatch } from '@/lib/objective-value/objective-value-declarations';
import {
  objectiveValueRejectionOf,
  type ObjectiveValueImproveSubject,
  type ObjectiveValueWriteOutcome,
} from '@/lib/objective-value/objective-value-improve-subject';
import type { EnergyCertificatePatch } from '@/lib/energy-certificate/energy-certificate';
import type { EnergyCertificateImproveSubject } from '@/lib/energy-certificate/energy-certificate-improve-subject';
import {
  setOwnerListingCommonCharges,
  setOwnerListingEnergyCertificate,
  setOwnerListingObjectiveValue,
  type OwnerListingResult,
} from '@/services/owner-property/owner-property.service';
import type { OwnerProperty } from '@/types/owner-property';

import type { ImproveSubjects } from './improve-sections';

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

/**
 * Τα μπλοκ-δηλώσεις (κοινόχρηστα §8.93 · ΠΕΑ §8.94) δεν έχουν ονομασμένη άρνηση: ό,τι δεν αποθηκεύτηκε **απέτυχε**,
 * και η επανάληψη έχει νόημα — ακόμη και ένα «άκυρο» από τον server σημαίνει ότι η φόρμα άφησε να περάσει κάτι που
 * δεν έπρεπε.
 */
function commonChargesOutcomeOf(result: OwnerListingResult): CommonChargesWriteOutcome {
  return result.kind === 'saved' ? { kind: 'saved' } : { kind: 'failed' };
}

/** Ο ιδιώτης ως κάτοχος της ενότητας «Κοινόχρηστα». Η πόρτα γραφής: `PATCH /api/owner-properties/[id]`. */
function useOwnerCommonChargesSubject(property: OwnerProperty): CommonChargesImproveSubject {
  const { id, commonCharges } = property;
  return useMemo(
    () => ({
      charges: commonCharges,
      revision: property,
      write: (patch: CommonChargesPatch) => setOwnerListingCommonCharges(id, patch).then(commonChargesOutcomeOf),
    }),
    [id, commonCharges, property],
  );
}

/** Ο ιδιώτης ως κάτοχος της ενότητας «Ενεργειακό πιστοποιητικό» (ADR-777 §8.94). Ίδια πόρτα, ίδιος κανόνας έκβασης. */
function useOwnerEnergyCertificateSubject(property: OwnerProperty): EnergyCertificateImproveSubject {
  const { id, energy } = property;
  // ADR-777 §8.96 — το ΠΕΑ ανεβαίνει στον φάκελο του ακινήτου (στα «Έγγραφά» του) και προτείνει τα πεδία.
  const importPort = useOwnerPropertyImportPort(property);
  return useMemo(
    () => ({
      certificate: energy,
      revision: property,
      write: (patch: EnergyCertificatePatch) => setOwnerListingEnergyCertificate(id, patch).then(commonChargesOutcomeOf),
      importPort,
    }),
    [id, energy, property, importPort],
  );
}

/** **Η δέσμη των κατόχων** — ένας ανά ενότητα του καταχωρητή, φτιαγμένη μία φορά στη σελίδα. */
export function useOwnerImproveSubjects(property: OwnerProperty): ImproveSubjects {
  const objectiveValue = useOwnerImproveSubject(property);
  const commonCharges = useOwnerCommonChargesSubject(property);
  const energyCertificate = useOwnerEnergyCertificateSubject(property);
  return useMemo(
    () => ({ objectiveValue, commonCharges, energyCertificate }),
    [objectiveValue, commonCharges, energyCertificate],
  );
}
