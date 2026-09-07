/**
 * @fileoverview 🏆 **ΤΟ ΣΗΜΑ ΩΣ ΠΡΑΞΗ** — δήλωση και απόσυρση, χωριστά από τη βιτρίνα
 *   (ADR-841 §7 Α21, Φάση 2).
 * @related ADR-841 §7 Α21.7 · services/mandate/showcase-mark-publication ·
 *   app/api/agency-profile/mark/route
 * @module services/mandate/showcase-mark-custody
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΗ ΠΡΑΞΗ — ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΑΝΑΤΡΕΨΕ ΤΟ ΣΧΕΔΙΟ ΤΗΣ ΦΑΣΗΣ 2
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Η Φάση 1 έβαλε το σήμα **μέσα στη δήλωση της βιτρίνας**, με σκεπτικό που ήταν σωστό
 * για κάθε άλλο πεδίο: *«η δήλωση είναι ολόκληρη η βιτρίνα, άρα απόν = καθάρισέ το»*.
 * Και ονόμασε σωστά τη συνέπεια: *«η οθόνη **οφείλει** να στέλνει το υπάρχον σήμα σε
 * κάθε αποθήκευση, αλλιώς μια αλλαγή επωνυμίας σβήνει το λογότυπο»*.
 *
 * 🔴 **ΑΛΛΑ Η ΟΘΟΝΗ ΔΕΝ ΕΧΕΙ ΑΠΟ ΠΟΥ ΝΑ ΤΟ ΠΑΡΕΙ.** Διαβάζει πίσω το **ίδιο έγγραφο με
 * τον κόσμο** — δηλωμένη αρχή του `useAgencyShowcase`: *«ένας ξεχωριστός δικός μας
 * αναγνώστης θα ήταν δεύτερο βιβλίο· το γραφείο θα έβλεπε “δημοσιευμένο” ενώ ο κόσμος
 * δεν θα το έβρισκε»*. Και σε εκείνο το έγγραφο το σήμα ζει ως **δημόσιο URL**· το
 * `privateStoragePath` που ζητά το σύρμα **δεν επιστρέφει ποτέ**, και **δεν επιτρέπεται**
 * να επιστρέψει: θα έδειχνε την εσωτερική δομή αποθήκευσης σε κάθε **ανώνυμο** επισκέπτη.
 *
 * ⇒ Η θεραπεία *«στείλ' το ξανά»* ήταν **δομικά ανέφικτη**, όχι παραλειφθείσα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΚΑΙ Η ΕΥΚΟΛΗ ΛΥΣΗ ΑΠΟΡΡΙΦΘΗΚΕ: «ΑΠΟΝ ΣΗΜΑΙΝΕΙ ΜΗΝ ΑΓΓΙΖΕΙΣ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Θα ήταν λιγότερος κώδικας: `undefined` ⇒ *«κράτα το»*, `null` ⇒ *«σβήσ' το»*. Και θα
 * έβαζε **δύο σημασιολογίες απουσίας** στο ίδιο σχήμα — μία για το `place`
 * *(«κανένας τόπος»)* και μία για το `mark` *(«μην αγγίζεις»)*. Η διαφορά είναι
 * **σιωπηλή**: πελάτης που παραλείπει το πεδίο από σφάλμα δεν το μαθαίνει **ποτέ**, και
 * η βλάβη εκδηλώνεται ως *«το λογότυπο μερικές φορές μένει»*.
 *
 * 🏆 **Η ΞΕΧΩΡΙΣΤΗ ΠΡΑΞΗ ΕΙΝΑΙ ΚΑΙ ΤΟ ΚΑΘΟΛΙΚΟ ΠΡΟΤΥΠΟ.** GitHub, Slack, LinkedIn,
 * Clerk: **το avatar δεν έχει «Αποθήκευση»** — αλλάζει τη στιγμή που το ανεβάζεις. Ο
 * άνθρωπος δεν σκέφτεται ποτέ *«πρέπει τώρα να πατήσω κάτι για να μείνει η φωτογραφία;»*.
 * Και η δήλωση της βιτρίνας μένει **ολόκληρη και αμετάβλητη**, όπως ήταν.
 *
 * ⚠️ **SERVER-ONLY**: το ράφι σέρνει `sharp` + Admin SDK.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { isShowcaseMarkKind } from '@/lib/agency/showcase-mark-kind';
import {
  publishShowcaseMark,
  type ShowcaseMarkDeclaration,
} from '@/services/mandate/showcase-mark-publication';
import type { AgencyProfileRejection } from '@/services/mandate/agency-profile-verdict';
import type { DeclaredShowcaseMark } from '@/types/agency-profile';

const logger = createModuleLogger('showcase-mark-custody');

/**
 * Τι απέγινε η πράξη — **ποτέ `boolean`**: μια άρνηση οφείλει να εξηγείται, και η
 * εξήγηση οφείλει να λέει **τι να κάνει ο άνθρωπος**.
 */
export type ShowcaseMarkWriteResult =
  | { readonly kind: 'declared'; readonly mark: DeclaredShowcaseMark }
  | { readonly kind: 'retracted' }
  | { readonly kind: 'rejected'; readonly reason: AgencyProfileRejection }
  | { readonly kind: 'failed' };

/**
 * **«Αυτό είναι το σήμα μου.»**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΣΕΙΡΑ ΤΩΝ ΤΡΙΩΝ ΒΗΜΑΤΩΝ ΕΙΝΑΙ ΟΛΟΚΛΗΡΟ ΤΟ ΣΚΕΠΤΙΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | # | βήμα | γιατί **εκεί** |
 * |---|---|---|
 * | 1 | **είδος** | λάθος του αιτήματος — δεν αξίζει ούτε ανάγνωση εγγράφου |
 * | 2 | **υπάρχει βιτρίνα;** | **πριν** από κάθε byte: εικόνα σε ανώνυμο κοινό για βιτρίνα που δεν υπάρχει είναι διαρροή **χωρίς οθόνη να τη δείχνει** |
 * | 3 | **ράφι** *(έξω από συναλλαγή)* | `sharp` + κάδος είναι **παρενέργεια**, και το σώμα μιας συναλλαγής **ξαναεκτελείται** σε σύγκρουση |
 * | 4 | **έγγραφο** *(συναλλαγή)* | ο γραφέας της βιτρίνας κάνει `set` χωρίς `merge` — χωρίς CAS, μια ταυτόχρονη δημοσίευση θα έγραφε πάνω στο μόλις δηλωμένο σήμα |
 *
 * 🔑 **ΤΟ ΒΗΜΑ 2 ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ ΤΕΧΝΙΚΟΣ ΠΕΡΙΟΡΙΣΜΟΣ.** Θα μπορούσαμε να
 * δημιουργήσουμε βιτρίνα στο πέρασμα. **Δεν το κάνουμε**: η δημοσίευση είναι η
 * **συγκατάθεση** του ανθρώπου να μπει σε δημόσιο κατάλογο *(§9.10)*, και ένα ανέβασμα
 * εικόνας **δεν είναι** τέτοια συγκατάθεση. «Δεν υπάρχει avatar χωρίς λογαριασμό.»
 *
 * ⚠️ **Ιδεμποτής**: δεύτερη κλήση με το ίδιο αρχείο δίνει το **ίδιο** sha256 ⇒ τα ίδια
 * κλειδιά ραφιού ⇒ καμία νέα εγγραφή. Δεύτερη κλήση με **άλλο** αρχείο **αντικαθιστά**:
 * η κάρτα έχει **μία** θέση για *«ποιος είσαι;»*.
 */
export async function declareShowcaseMark(
  adminDb: AdminFirestore,
  companyId: string,
  declaration: ShowcaseMarkDeclaration,
): Promise<ShowcaseMarkWriteResult> {
  // ── 1 · Το είδος ────────────────────────────────────────────────────────
  // ⚠️ **Δεύτερος έλεγχος, και είναι σκόπιμος.** Ο πρώτος ζει στη διαδρομή (`declaredMark`),
  //    όπου το σύρμα είναι `string`. Εδώ ο τύπος υπόσχεται ήδη `ShowcaseMarkKind` — αλλά ο
  //    γραφέας **δεν οφείλει να εμπιστεύεται** ότι κάποιος έτρεξε τον φρουρό: τον καλεί
  //    και ο διακομιστής, και οι άγκυρες, και ό,τι γραφτεί του χρόνου.
  if (!isShowcaseMarkKind(declaration.kind)) {
    return { kind: 'rejected', reason: 'agency-profile-mark-unknown-kind' };
  }

  const ref = adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId);

  try {
    // ── 2 · Υπάρχει βιτρίνα; ─────────────────────────────────────────────
    const existing = await ref.get();
    if (!existing.exists) {
      return { kind: 'rejected', reason: 'agency-profile-mark-without-showcase' };
    }

    // ── 3 · Τα bytes ─────────────────────────────────────────────────────
    // 🔑 Ο **υπάρχων** φρουρός κατοχής + ο **υπάρχων** καθαριστής EXIF/GPS. Καμία νέα
    //    μηχανή: αυτό το βήμα είναι **μία κλήση** σε ό,τι έχτισε η Φάση 1.
    const outcome = await publishShowcaseMark(companyId, declaration);

    if (outcome.kind === 'refused') {
      // ⚠️ **Δύο αρνήσεις, δύο θεραπείες** (N.12): *«διάλεξε άλλο αρχείο»* απέναντι σε
      //    *«ξαναδοκίμασε το ίδιο»*. Ένα κοινό «απέτυχε» θα έστελνε τον άνθρωπο να ψάξει
      //    λάθος πράγμα.
      return {
        kind: 'rejected',
        reason:
          outcome.reason === 'showcase-mark-not-owned'
            ? 'agency-profile-mark-not-owned'
            : 'agency-profile-mark-unpublishable',
      };
    }

    // ⚠️ Ο τύπος επιτρέπει `cleared` *(δήλωση `null`)*, που εδώ **δεν μπορεί να συμβεί** —
    //    και ένα σιωπηλό `default` θα το έκρυβε ως επιτυχία με κενό σήμα.
    if (outcome.kind !== 'published') {
      logger.error('Το ράφι απάντησε «cleared» σε ΔΗΛΩΣΗ — αδύνατο', { companyId });
      return { kind: 'failed' };
    }

    // ── 4 · Το έγγραφο ───────────────────────────────────────────────────
    await writeMark(adminDb, companyId, outcome.mark);
    return { kind: 'declared', mark: outcome.mark };
  } catch (error) {
    logger.error('[MARK] Η δήλωση του σήματος απέτυχε', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}

/**
 * **«Δεν θέλω πια σήμα.»** — και ο επισκέπτης πέφτει στο **παραγόμενο** lettermark, που
 * δεν αποτυγχάνει ποτέ.
 *
 * 🔑 **Τα bytes φεύγουν, όχι μόνο η αναφορά τους.** Ο άνθρωπος που αφαίρεσε τη
 * φωτογραφία του πρέπει να δει το δημόσιο URL να **παύει να απαντά** — αλλιώς η
 * «αφαίρεση» είναι απόκρυψη, και το αρχείο μένει σε κάθε κρυφή μνήμη και σε κάθε
 * σελιδοδείκτη.
 *
 * ⚠️ **Ιδεμποτής και για βιτρίνα ΧΩΡΙΣ σήμα**: το κενό σύνολο πάνω σε κενό πρόθεμα δεν
 * κάνει τίποτα, και η απάντηση παραμένει `retracted`. Ο άνθρωπος που πατά δύο φορές
 * «Αφαίρεση» δεν πρέπει να δει σφάλμα για πράξη που **πέτυχε**.
 */
export async function retractShowcaseMark(
  adminDb: AdminFirestore,
  companyId: string,
): Promise<ShowcaseMarkWriteResult> {
  const ref = adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId);

  try {
    const existing = await ref.get();
    if (!existing.exists) {
      return { kind: 'rejected', reason: 'agency-profile-mark-without-showcase' };
    }

    // 🔑 `null` ⇒ κενό σύνολο ⇒ το πρόθεμα `showcases/{companyId}/` **αδειάζει**. Καμία
    //    διαδρομή διαγραφής δεν γράφτηκε ποτέ — είναι η **ίδια** πράξη με άλλη τιμή.
    await publishShowcaseMark(companyId, null);
    await writeMark(adminDb, companyId, null);
    return { kind: 'retracted' };
  } catch (error) {
    logger.error('[MARK] Η απόσυρση του σήματος απέτυχε', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}

/**
 * **Γράψε ΜΟΝΟ το σήμα** — σε συναλλαγή, και ο λόγος δεν είναι αυτό το πεδίο.
 *
 * 🔴 Ο γραφέας της βιτρίνας κάνει **`set` χωρίς `merge`** *(η δήλωση είναι ολόκληρη η
 * βιτρίνα)*. Ένα σκέτο `update({ mark })` εδώ θα έχανε **σιωπηλά** απέναντι σε μια
 * δημοσίευση που ξεκίνησε λίγο πριν: εκείνη διάβασε το **παλιό** σήμα και θα το έγραφε
 * από πάνω. Η συναλλαγή κάνει το ζευγάρι **ανάγνωση+γραφή** ατομικό και στις **δύο**
 * κατευθύνσεις — όποια χάσει, **ξαναεκτελείται** και βλέπει την αλήθεια.
 *
 * ⚠️ **Καμία παρενέργεια εδώ μέσα**: το ράφι έτρεξε **πριν**, ακριβώς επειδή αυτό το
 * σώμα μπορεί να εκτελεστεί πολλές φορές.
 *
 * ⚠️ **`update` και όχι `set`**: γράφουμε **ένα** πεδίο ενός εγγράφου που ανήκει σε άλλον
 * γραφέα. Ένα `set` εδώ θα απαιτούσε να ξέρουμε **όλη** τη βιτρίνα — δηλαδή θα γεννούσε
 * δεύτερο κατασκευαστή της.
 */
async function writeMark(
  adminDb: AdminFirestore,
  companyId: string,
  mark: DeclaredShowcaseMark | null,
): Promise<void> {
  const ref = adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId);

  await adminDb.runTransaction(async (transaction) => {
    // ⚠️ Η ανάγνωση **δεν είναι** διακοσμητική: είναι αυτή που εγγράφει το έγγραφο στο CAS
    //    της συναλλαγής. Χωρίς αυτήν, η γραφή δεν έχει τίποτα να συγκρίνει και ο
    //    ανταγωνιστής περνά απαρατήρητος.
    await transaction.get(ref);
    transaction.update(ref, { mark });
  });
}
