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
import { getErrorMessage, isPermissionDeniedError } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { getSurveyRecord, updateSurveyRecord } from '@/services/survey-record.service';
import type { SurveyRecord } from '@/types/project-survey-record';
import { applyFailed, type ApplyTargetContext, type ApplyTargetResult } from './apply-types';

const logger = createModuleLogger('SurveyRecordWrite');

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
  // ⚠️ Ο φύλακας **δεν** είναι πλεονασμός επειδή η ανάγνωση μεταφράζει ήδη την άρνηση των
  // κανόνων σε `null` (δες `readVisibleRecord`): ο υπερδιαχειριστής **διαβάζει** κάθε μισθωτή,
  // οπότε για εκείνον αυτή η γραμμή είναι ο **μόνος** έλεγχος ιδιοκτησίας που εκτελείται.
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
 * Η εγγραφή **όπως τη βλέπει ο καλών** — ή `null` όταν δεν τη βλέπει καθόλου.
 *
 * 🔴 **ΜΕΤΡΗΜΕΝΟ ΣΕ ΖΩΝΤΑΝΟ EMULATOR (ADR-759 §Θ.1), και δεν φαινόταν από πουθενά αλλού.**
 * Το `getSurveyRecord` είναι `getById` ⇒ σκέτο `getDoc`. Σε πραγματική βάση ο κανόνας READ
 * του `survey_records` **απορρίπτει** τόσο το έγγραφο άλλου μισθωτή (`false for 'get'`) όσο
 * και το **ανύπαρκτο** (`evaluation error` — το `resource.data.companyId` πάνω σε `null`
 * `resource`). Και στις δύο περιπτώσεις ο SDK **πετά**, δεν επιστρέφει `null`.
 *
 * Άρα η εξαίρεση έφτανε στο catch-all του `writeSurveyRecordPatch` και ο άνθρωπος έπαιρνε
 * `SURVEY_RECORD_UPDATE_FAILED` — κατά λέξη το *«ανεξήγητο permission error»* που οι κωδικοί
 * αυτού του αρχείου υπάρχουν για να αποτρέψουν — ενώ ο `ownedOrNull` και ολόκληρο το
 * σκεπτικό του §4.9 **δεν εκτελούνταν ποτέ**. Κανένα από τα 3.113 πράσινα tests δεν μπορούσε
 * να το δει: τα mocks επιστρέφουν `null`, γιατί γράφουν σε **μνήμη** όπου δεν υπάρχουν
 * κανόνες.
 *
 * 🔑 **Η μετάφραση είναι η ΙΔΙΑ πολιτική, όχι νέα**: «ξένο ≡ ανύπαρκτο». Απλώς εφαρμόζεται
 * πλέον και στη διαδρομή που πραγματικά εκτελείται. Ότι οι δύο αιτίες είναι **αδιάκριτες**
 * είναι το ζητούμενο, όχι περιορισμός: ξεχωριστός κωδικός θα ήταν μαντείο ύπαρξης.
 *
 * ⚠️ Μεταφράζεται **μόνο** η ανάγνωση. Άρνηση των κανόνων στην **εγγραφή** (π.χ. πάγωμα που
 * μεσολάβησε) παραμένει `SURVEY_RECORD_UPDATE_FAILED`: «δεν υπάρχει» εκεί θα ήταν ψέμα.
 */
async function readVisibleRecord(recordId: string): Promise<SurveyRecord | null> {
  try {
    return await getSurveyRecord(recordId);
  } catch (error) {
    if (!isPermissionDeniedError(error)) throw error;
    // Σήμα ασφαλείας, όχι μήνυμα προς τον καλούντα — ίδιο πρότυπο με το `ownedOrNull`.
    logger.warn('Survey record read denied by rules — treated as missing', { recordId });
    return null;
  }
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
    const checked = checkRecord(await readVisibleRecord(address.recordId), address, ctx);
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
