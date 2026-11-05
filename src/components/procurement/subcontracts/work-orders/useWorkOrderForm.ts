'use client';

/**
 * Η κατάσταση της φόρμας «Νέα εντολή εργασίας» (ADR-928 §5.24) — καμία δική της επικύρωση, καμία δική της κρίση:
 *
 * 🔑 Το σώμα επικυρώνεται με το **ίδιο** σχήμα που κρίνει η διαδρομή (`addAssignmentBodySchema`): ό,τι περνά εδώ, περνά
 *    και εκεί — και το αντίστροφο.
 * 🔑 «Μπορεί;» = ο κριτής του γραφέα (`refuseAssignment`) + το δικαίωμα στο **έργο-στόχο** (`useWorkOrderTargetAuthority`)
 *    μέσα από το `workOrderBlock`. Ποτέ το έργο της σελίδας.
 * 🔑 CAS: `expectedRevision` = η **ζωντανή** αναθεώρηση της σύμβασης τη στιγμή της υποβολής (σελίδα και λίστα είναι ζωντανές).
 */

import { useCallback, useState } from 'react';
import { useWorkOrderTargetAuthority } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import type { CalendarDay } from '@/constants/platform-operator';
import { addAssignmentBodySchema } from '@/subapps/procurement/subcontracts/schema/agreement.schema';
import { latestWorkOrderFor, workOrderBlock, type WorkOrder, type WorkOrderBlock } from '@/subapps/procurement/subcontracts/agreements/work-orders';
import type { AgreementAssignmentInput, SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';

export interface WorkOrderFields {
  readonly projectId: string;
  readonly buildingIds: readonly string[];
  readonly startDate: CalendarDay | null;
  /** Όπως το γράφει ο άνθρωπος — `''` ⇒ χωρίς διάρκεια. */
  readonly durationDays: string;
  readonly note: string;
}

/** Το σώμα της διαδρομής, ή `null` όσο κάτι λείπει/είναι άκυρο — κρίνεται από το σχήμα της διαδρομής. */
export function workOrderBodyOf(agreement: Pick<SubcontractAgreement, 'revision'> | null, fields: WorkOrderFields): AgreementAssignmentInput | null {
  if (!agreement) return null;
  const duration = fields.durationDays.trim();
  const note = fields.note.trim();
  const parsed = addAssignmentBodySchema.safeParse({
    expectedRevision: agreement.revision,
    projectId: fields.projectId,
    buildingIds: fields.buildingIds,
    startDate: fields.startDate,
    durationDays: duration === '' ? null : Number(duration),
    note: note === '' ? null : note,
  });
  return parsed.success ? parsed.data : null;
}

/** Άλλο έργο ⇒ τα κτίρια του προηγούμενου δεν ισχύουν (ο γραφέας θα τα απέρριπτε: `buildingNotInProject`). */
export function patchWorkOrderFields(current: WorkOrderFields, patch: Partial<WorkOrderFields>): WorkOrderFields {
  const projectChanged = patch.projectId !== undefined && patch.projectId !== current.projectId;
  return { ...current, ...(projectChanged ? { buildingIds: [] } : {}), ...patch };
}

export interface WorkOrderForm {
  readonly fields: WorkOrderFields;
  readonly setFields: (patch: Partial<WorkOrderFields>) => void;
  readonly block: WorkOrderBlock | null;
  /** Η πιο πρόσφατη εντολή της ίδιας σύμβασης στο ίδιο έργο — ενημέρωση, όχι φραγμός. */
  readonly previous: WorkOrder | null;
  readonly body: AgreementAssignmentInput | null;
}

/**
 * @param agreement η κύρια σύμβαση (ζωντανή)· `null` όσο δεν έχει επιλεγεί.
 * @param fixedProjectId σταθερό έργο-στόχος (καρτέλα έργου)· `null` ⇒ επιλογή.
 */
export function useWorkOrderForm(agreement: SubcontractAgreement | null, fixedProjectId: string | null): WorkOrderForm {
  const [fields, setAll] = useState<WorkOrderFields>({ projectId: fixedProjectId ?? '', buildingIds: [], startDate: null, durationDays: '', note: '' });
  const setFields = useCallback((patch: Partial<WorkOrderFields>) => setAll((current) => patchWorkOrderFields(current, patch)), []);
  const target = fields.projectId || null;
  const verdict = useWorkOrderTargetAuthority(target);
  return {
    fields,
    setFields,
    block: agreement ? workOrderBlock(agreement, target, verdict) : null,
    previous: agreement && target ? latestWorkOrderFor(agreement, target) : null,
    body: workOrderBodyOf(agreement, fields),
  };
}
