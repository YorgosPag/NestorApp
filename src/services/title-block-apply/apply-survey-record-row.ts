/**
 * @fileoverview Μια **γραμμή** του σχεδίου → επαναλαμβανόμενη ενότητα της καρτέλας
 *               (ADR-759 Φ4β).
 *
 * 🔴 **Η μία διαφορά από τον βαθμωτό writer, και είναι όλη η φάση: η ΤΑΥΤΟΔΥΝΑΜΙΑ.** Ένα
 * βαθμωτό πεδίο έχει όνομα, οπότε δεύτερη έγκριση γράφει την ίδια θέση. Μια γραμμή δεν έχει —
 * και δεύτερη έγκριση **θα πρόσθετε δεύτερη γραμμή**. Ο στόχος κουβαλά γι' αυτό `rowId`
 * παραγόμενο ντετερμινιστικά από το σχέδιο, και το `applySurveyRowBinding` κάνει upsert.
 *
 * Ο έλεγχος «υπάρχει / είναι του μισθωτή / είναι αυτού του έργου / δεν είναι παγωμένη» και η
 * εγγραφή **ενός κλειδιού** είναι κοινά με τον βαθμωτό writer (`survey-record-write.ts`).
 *
 * @module services/title-block-apply/apply-survey-record-row
 */

import { applySurveyRowBinding } from '@/config/survey-row-bindings';
import type { BindingTarget } from '@/types/title-block-binding';
import type { ApplyTargetContext, ApplyTargetResult } from './apply-types';
import { writeSurveyRecordPatch } from './survey-record-write';

type SurveyRowTarget = Extract<BindingTarget, { kind: 'survey-record-row' }>;

export async function applySurveyRecordRowTarget(
  target: SurveyRowTarget,
  ctx: ApplyTargetContext,
): Promise<ApplyTargetResult> {
  return writeSurveyRecordPatch(target, ctx, (record) =>
    applySurveyRowBinding(record, target.list, target.rowId, target.parts),
  );
}
