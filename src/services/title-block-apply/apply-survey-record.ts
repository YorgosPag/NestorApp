/**
 * @fileoverview Μια **βαθμωτή** δήλωση του σχεδίου → η καρτέλα «Στοιχεία Τοπογραφικού»
 *               (ADR-759 Φ3γ).
 *
 * Οι φύλακες, η ανάγνωση τη στιγμή της εγγραφής και το patch **ενός κλειδιού** ζουν στο
 * `survey-record-write.ts` — τα μοιράζεται με τον writer των **γραμμών** (Φ4β), γιατί είναι
 * κατά λέξη οι ίδιες τέσσερις ερωτήσεις και δύο αντίγραφά τους θα απέκλιναν σιωπηλά.
 *
 * @module services/title-block-apply/apply-survey-record
 */

import { applySurveyFieldBinding } from '@/config/survey-bindable-fields';
import type { BindingTarget } from '@/types/title-block-binding';
import type { ApplyTargetContext, ApplyTargetResult } from './apply-types';
import { writeSurveyRecordPatch } from './survey-record-write';

type SurveyTarget = Extract<BindingTarget, { kind: 'survey-record' }>;

export async function applySurveyRecordTarget(
  target: SurveyTarget,
  ctx: ApplyTargetContext,
): Promise<ApplyTargetResult> {
  return writeSurveyRecordPatch(target, ctx, (record) =>
    // Το `rawText` είναι ό,τι έγραφε το σχέδιο — **ποτέ** η αναλυμένη τιμή. Η ανάλυση μπορεί
    // να είναι λάθος· το πρωτότυπο ποτέ (ADR-745 §8 κανόνας 3).
    //
    // 🔴 **Το `value` ΔΙΝΕΤΑΙ, δεν ξανα-αναλύεται εδώ.** Η ανάλυση έγινε **μία** φορά, στον Λ2,
    // και το αποτέλεσμά της **φάνηκε στην οθόνη** πριν ο άνθρωπος πατήσει Έγκριση. Δεύτερη
    // ανάλυση τη στιγμή της εγγραφής θα ήταν δεύτερη πηγή αλήθειας για το ίδιο ερώτημα: την
    // ημέρα που ο κανόνας αλλάξει, το σύστημα θα **γράφει άλλο** από αυτό που ενέκρινε ο
    // μηχανικός — σιωπηλά, και με το όνομά του πάνω του.
    applySurveyFieldBinding(record, target.field, target.value, ctx.snapshotValue),
  );
}
