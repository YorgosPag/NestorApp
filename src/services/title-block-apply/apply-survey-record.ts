/**
 * @fileoverview Μια δήλωση του σχεδίου → η καρτέλα «Στοιχεία Τοπογραφικού» (ADR-759 Φ3γ).
 *
 * 🔴 **Η ΑΝΑΓΝΩΣΗ ΓΙΝΕΤΑΙ ΤΩΡΑ, ΟΧΙ ΑΠΟ ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ ΤΗΣ ΠΑΛΕΤΑΣ.** Ο Λ2 διάβασε τα
 * τοπογραφικά όταν **άνοιξε** η παλέτα· ο άνθρωπος πατά Έγκριση λεπτά αργότερα. Στο μεταξύ η
 * καρτέλα του έργου μπορεί να έχει επιβεβαιώσει την εγγραφή (⇒ παγωμένη), να έχει αλλάξει το
 * πεδίο με το χέρι, ή να έχει διαγραφεί ολόκληρη. Ίδιο σκεπτικό — και ίδιο πρότυπο — με το
 * `project-snapshot.ts`.
 *
 * 🔴 **ΚΑΙ ΤΟ PATCH ΕΙΝΑΙ ΕΝΟΣ ΚΛΕΙΔΙΟΥ.** Το `updateSurveyRecord` δέχεται
 * `Partial<SurveyRecord>` και το gateway είναι σκέτο pass-through. Γράφοντας ολόκληρη την
 * εγγραφή που μόλις διαβάσαμε, θα σβήναμε ό,τι έγραψε ο μηχανικός στην καρτέλα στο ενδιάμεσο —
 * **χωρίς σφάλμα και χωρίς μήνυμα**. Το `documentKey` της προδιαγραφής υπάρχει ακριβώς γι'
 * αυτό, και είναι ο λόγος που ο κατάλογος κρατά «ποιο κλειδί πρώτου επιπέδου» ανά πεδίο.
 *
 * @module services/title-block-apply/apply-survey-record
 */

import { applySurveyFieldBinding } from '@/config/survey-bindable-fields';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { getSurveyRecord, updateSurveyRecord } from '@/services/survey-record.service';
import type { SurveyRecord } from '@/types/project-survey-record';
import type { BindingTarget } from '@/types/title-block-binding';
import { applyFailed, type ApplyTargetContext, type ApplyTargetResult } from './apply-types';

type SurveyTarget = Extract<BindingTarget, { kind: 'survey-record' }>;

/**
 * Ό,τι πρέπει να ισχύει **τη στιγμή της εγγραφής** — όχι τη στιγμή της πρότασης.
 *
 * Επιστρέφει την εγγραφή όταν όλα στέκουν, αλλιώς την **αιτία με κωδικό**. Ο Λ2 έχει ήδη
 * απαντήσει τα ίδια ερωτήματα πριν το κλικ, ώστε η οθόνη να μην υπόσχεται εγγραφή που θα
 * αποτύχει· εδώ επαναλαμβάνονται γιατί **ένας φύλακας που ζει μόνο στο UI δεν είναι φύλακας**.
 */
function checkRecord(
  record: SurveyRecord | null,
  target: SurveyTarget,
  ctx: ApplyTargetContext,
): { readonly ok: true; readonly record: SurveyRecord } | { readonly ok: false; readonly failure: ApplyTargetResult } {
  if (!record) {
    return { ok: false, failure: applyFailed('survey record not found', 'SURVEY_RECORD_MISSING') };
  }
  if (record.companyId !== ctx.companyId) {
    // Δεν είναι θεωρητικό: το `getSurveyRecord` είναι `getById`, δηλαδή **δεν** περνά από
    // φίλτρο μισθωτή (CHECK 3.35 — το ίδιο κενό που έψαξε το ADR-747). Το id έρχεται από
    // στόχο που έφτιαξε ο πελάτης, οπότε ο έλεγχος ανήκει εδώ.
    return { ok: false, failure: applyFailed('cross-tenant survey record', 'SURVEY_RECORD_FOREIGN') };
  }
  if (record.projectId !== target.projectId) {
    return { ok: false, failure: applyFailed('survey record belongs to another project', 'SURVEY_RECORD_WRONG_PROJECT') };
  }
  if (record.confirmedBy !== null) {
    // 🔒 Ορατός αποκλεισμός, ποτέ σιωπηλή παράκαμψη — και **ποτέ** αυτόματη άρση της
    // επιβεβαίωσης. Τα rules θα το απέρριπταν έτσι κι αλλιώς· εδώ ο λόγος γίνεται **κωδικός**
    // που η οθόνη μπορεί να μεταφράσει, αντί για ανεξήγητο permission error.
    return { ok: false, failure: applyFailed('survey record is confirmed (frozen)', 'SURVEY_RECORD_LOCKED') };
  }
  return { ok: true, record };
}

export async function applySurveyRecordTarget(
  target: SurveyTarget,
  ctx: ApplyTargetContext,
): Promise<ApplyTargetResult> {
  try {
    const checked = checkRecord(await getSurveyRecord(target.recordId), target, ctx);
    if (!checked.ok) return checked.failure;

    // Το `rawText` είναι ό,τι έγραφε το σχέδιο — **ποτέ** η αναλυμένη τιμή. Η ανάλυση μπορεί
    // να είναι λάθος· το πρωτότυπο ποτέ (ADR-745 §8 κανόνας 3).
    const { record, documentKey } = applySurveyFieldBinding(
      checked.record,
      target.field,
      target.value,
      ctx.snapshotValue,
    );

    const ok = await updateSurveyRecord(target.recordId, {
      [documentKey]: record[documentKey],
      updatedAt: nowISO(),
    });
    return ok ? { success: true } : applyFailed('survey record update failed', 'SURVEY_RECORD_UPDATE_FAILED');
  } catch (error) {
    return applyFailed(getErrorMessage(error), 'SURVEY_RECORD_UPDATE_FAILED');
  }
}
