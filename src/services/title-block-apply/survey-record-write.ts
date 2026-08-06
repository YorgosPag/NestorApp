/**
 * @fileoverview Ο **ένας** δρόμος προς μια εγγραφή τοπογραφικού: φύλακες, patch, εγγραφή.
 *
 * 🔴 **Γιατί εξήχθη (Φ4β).** Μέχρι τη Φ4 υπήρχε **ένας** writer (βαθμωτό πεδίο). Η Φ4β έφερε
 * **δεύτερο** (γραμμή λίστας) που ρωτά **τα ίδια τέσσερα** πράγματα πριν γράψει: υπάρχει η
 * εγγραφή; είναι του μισθωτή; είναι αυτού του έργου; είναι παγωμένη; Αντιγραμμένοι, οι δύο θα
 * απέκλιναν στον πρώτο νέο φύλακα — και η αστοχία θα ήταν **σιωπηλή**: ο ένας δρόμος θα
 * έγραφε εκεί που ο άλλος αρνείται. Είναι κατά λέξη ο sibling clone του N.18, στο σημείο όπου
 * κοστίζει περισσότερο.
 *
 * @module services/title-block-apply/survey-record-write
 */

import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { getSurveyRecord, updateSurveyRecord } from '@/services/survey-record.service';
import type { SurveyRecord } from '@/types/project-survey-record';
import { applyFailed, type ApplyTargetContext, type ApplyTargetResult } from './apply-types';

/** Ό,τι κοινό φέρει κάθε στόχος τοπογραφικού — σε ποια εγγραφή, ποιου έργου. */
export interface SurveyRecordAddress {
  readonly recordId: string;
  readonly projectId: string;
}

/** Τι άλλαξε ένας writer: η νέα εγγραφή, και **ποιο** κλειδί πρώτου επιπέδου χρειάζεται εγγραφή. */
export interface SurveyRecordPatch {
  readonly record: SurveyRecord;
  readonly documentKey: keyof SurveyRecord;
}

/**
 * Ό,τι πρέπει να ισχύει **τη στιγμή της εγγραφής** — όχι τη στιγμή της πρότασης.
 *
 * Επιστρέφει την εγγραφή όταν όλα στέκουν, αλλιώς την **αιτία με κωδικό**. Ο Λ2 έχει ήδη
 * απαντήσει τα ίδια ερωτήματα πριν το κλικ, ώστε η οθόνη να μην υπόσχεται εγγραφή που θα
 * αποτύχει· εδώ επαναλαμβάνονται γιατί **ένας φύλακας που ζει μόνο στο UI δεν είναι φύλακας**.
 */
function checkRecord(
  record: SurveyRecord | null,
  address: SurveyRecordAddress,
  ctx: ApplyTargetContext,
):
  | { readonly ok: true; readonly record: SurveyRecord }
  | { readonly ok: false; readonly failure: ApplyTargetResult } {
  // 🔴 **Ξένο ≡ ανύπαρκτο, από το SSoT — και δεν είναι θέμα ύφους** (ADR-742 / ADR-759 §4.9).
  //
  // Εδώ έγραφε `record.companyId !== ctx.companyId` με **δικό του** κωδικό
  // (`SURVEY_RECORD_FOREIGN`). Δύο πράγματα ήταν λάθος, και το δεύτερο είναι σφάλμα ασφαλείας:
  //
  // 1. **Ο ξεχωριστός κωδικός είναι μαντείο ύπαρξης**: «ανήκει σε άλλον» επιβεβαιώνει ότι το id
  //    **υπάρχει**. Η σιωπηλή πολιτική του `ownedOrNull` το κλείνει, και **καταγράφει** την
  //    απόπειρα — σήμα ασφαλείας αντί για μήνυμα προς τον καλούντα.
  // 2. **Η παγίδα του κενού**: με χαλασμένο token (`companyId: ''`) και έγγραφο με κενό/απόν
  //    `companyId` (ADR-232 — τα φτιάχνει το υπεργραφείο), η ωμή `!==` απαντούσε **«ίδιος
  //    μισθωτής»**. Το `ownedOrNull` ρωτά `isPayloadOwnedByCompany`: το κενό δεν είναι tenant,
  //    είναι **απουσία** tenant.
  //
  // Ο έλεγχος εξακολουθεί να ανήκει εδώ: το `getSurveyRecord` είναι `getById`, δηλαδή **δεν**
  // περνά από φίλτρο μισθωτή (CHECK 3.35 — το ίδιο κενό που έψαξε το ADR-747), και το id
  // έρχεται από στόχο που έφτιαξε ο πελάτης.
  const owned = ownedOrNull(record, ctx.companyId, {
    resource: 'survey record',
    resourceId: address.recordId,
    path: 'title-block-apply',
  });
  if (!owned) {
    return { ok: false, failure: applyFailed('survey record not found', 'SURVEY_RECORD_MISSING') };
  }
  if (owned.projectId !== address.projectId) {
    return {
      ok: false,
      failure: applyFailed(
        'survey record belongs to another project',
        'SURVEY_RECORD_WRONG_PROJECT',
      ),
    };
  }
  if (owned.confirmedBy !== null) {
    // 🔒 Ορατός αποκλεισμός, ποτέ σιωπηλή παράκαμψη — και **ποτέ** αυτόματη άρση της
    // επιβεβαίωσης. Τα rules θα το απέρριπταν έτσι κι αλλιώς· εδώ ο λόγος γίνεται **κωδικός**
    // που η οθόνη μπορεί να μεταφράσει, αντί για ανεξήγητο permission error.
    return {
      ok: false,
      failure: applyFailed('survey record is confirmed (frozen)', 'SURVEY_RECORD_LOCKED'),
    };
  }
  // ⚠️ Επιστρέφεται το `owned`, όχι το `record`: είναι **το ίδιο αντικείμενο**, αλλά μόνο το
  // πρώτο έχει περάσει τον φύλακα. Με το `record` εδώ, μια μελλοντική αλλαγή του `ownedOrNull`
  // σε «καθάρισε και επίστρεψε» θα παρακάμπτονταν σιωπηλά.
  return { ok: true, record: owned };
}

/**
 * Διαβάζει **τώρα**, ελέγχει, εφαρμόζει το `patch`, γράφει **ένα** κλειδί.
 *
 * 🔴 **Η ΑΝΑΓΝΩΣΗ ΓΙΝΕΤΑΙ ΤΩΡΑ, ΟΧΙ ΑΠΟ ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ ΤΗΣ ΠΑΛΕΤΑΣ.** Ο Λ2 διάβασε τα
 * τοπογραφικά όταν **άνοιξε** η παλέτα· ο άνθρωπος πατά Έγκριση λεπτά αργότερα. Στο μεταξύ η
 * καρτέλα μπορεί να έχει επιβεβαιώσει την εγγραφή (⇒ παγωμένη), να έχει αλλάξει το πεδίο με
 * το χέρι, ή να έχει διαγραφεί ολόκληρη. Ίδιο πρότυπο με το `project-snapshot.ts`.
 *
 * 🔴 **ΚΑΙ ΤΟ PATCH ΕΙΝΑΙ ΕΝΟΣ ΚΛΕΙΔΙΟΥ.** Το `updateSurveyRecord` δέχεται
 * `Partial<SurveyRecord>` και το gateway είναι σκέτο pass-through. Γράφοντας ολόκληρη την
 * εγγραφή που μόλις διαβάσαμε, θα σβήναμε ό,τι έγραψε ο μηχανικός στο ενδιάμεσο — **χωρίς
 * σφάλμα και χωρίς μήνυμα**.
 */
export async function writeSurveyRecordPatch(
  address: SurveyRecordAddress,
  ctx: ApplyTargetContext,
  patch: (record: SurveyRecord) => SurveyRecordPatch,
): Promise<ApplyTargetResult> {
  try {
    const checked = checkRecord(await getSurveyRecord(address.recordId), address, ctx);
    if (!checked.ok) return checked.failure;

    const { record, documentKey } = patch(checked.record);

    const ok = await updateSurveyRecord(address.recordId, {
      [documentKey]: record[documentKey],
      updatedAt: nowISO(),
    });
    return ok
      ? { success: true }
      : applyFailed('survey record update failed', 'SURVEY_RECORD_UPDATE_FAILED');
  } catch (error) {
    return applyFailed(getErrorMessage(error), 'SURVEY_RECORD_UPDATE_FAILED');
  }
}
