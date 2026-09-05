import 'server-only';

/**
 * @fileoverview **Ο ΠΟΛΙΤΗΣ ΑΠΟΚΤΑ ΤΑΥΤΟΤΗΤΑ** — ο άνθρωπος που ήρθε από τον δρόμο.
 * @related ADR-844 · ADR-660 (pending-registration) · ADR-817 (προσωπικός χώρος)
 * @module server/auth/citizen-identity
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΛΥΝΕΙ: ΠΩΣ ΓΙΝΕΤΑΙ ΚΑΠΟΙΟΣ **ΚΑΠΟΙΟΣ**, ΧΩΡΙΣ ΝΑ ΤΟΝ ΠΕΡΙΜΕΝΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η Μαρία διαβάζει μια δημόσια αγγελία και θέλει να μιλήσει στον ιδιοκτήτη.
 * Δεν έχει λογαριασμό και δεν ήρθε για να αποκτήσει — ήρθε για **μία πράξη**.
 *
 * Μέχρι σήμερα υπήρχαν **δύο τοίχοι**, και οι δύο αόρατοι από την οθόνη:
 *
 * 1. **Χωρίς `globalRole` claim, το API απαντά 401.** Ο
 *    `extractIdentityClaims` (`lib/auth/auth-context.ts`) κρίνει τον **ρόλο**
 *    πριν τον **χώρο**: άκυρος ρόλος ⇒ `missing_claims`. Ο «προσωπικός» κλάδος
 *    του ADR-817 γεννιέται όταν λείπει το **`companyId`** — **όχι** ο ρόλος.
 * 2. **Το ADR-660 κόβει fail-closed κάθε αυτο-εγγραφή.** Ο μόνος τρόπος για
 *    `external_user` ήταν **χειροκίνητη έγκριση διαχειριστή**.
 *
 * 🔑 **Ο δεύτερος τοίχος χτίστηκε για ΑΛΛΗ ΕΡΩΤΗΣΗ, και εκεί μένει ακέραιος.**
 * Το ADR-660 φυλάει *«ποιος μπαίνει στον **χώρο εργασίας**»* — στα έργα, στα
 * κτίρια, στα οικονομικά. Η Μαρία **δεν ζητά** χώρο εργασίας· ζητά να στείλει
 * ένα μήνυμα. Το να την αφήνει να περιμένει έγκριση δεν είναι αυστηρότητα, είναι
 * **απάντηση σε ερώτηση που δεν έγινε**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔒 Η ΑΚΤΙΝΑ ΕΚΡΗΞΗΣ ΕΙΝΑΙ **ΜΕΤΡΗΜΕΝΗ ΚΑΙ ΚΛΕΙΣΤΗ** — δεν είναι ισχυρισμός
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `external_user` **χωρίς** `companyId` ⇒ ο `extractCustomClaims` επιστρέφει
 * `null` ⇒ **προσωπικός** κλάδος ⇒ φτάνει **ακριβώς** τις διαδρομές του κλειστού
 * συνόλου **ADR-817 §5** (`lib/auth/__tests__/personal-scope-consumers.test.ts`,
 * σήμερα **13**, καθεμιά δηλωμένη **με λόγο**).
 *
 * ⛔ Οι **319** διαδρομές `withAuth` απαντούν **401 όπως και σήμερα**, γιατί
 * απαιτούν `companyId` που αυτός ο άνθρωπος **δεν έχει και δεν αποκτά εδώ**.
 * Δηλαδή το σύνολο των οθονών που ανοίγουν δεν το φυλάει αυτό το αρχείο —
 * το φυλάει ο **μεταγλωττιστής** και μια πύλη που κοκκινίζει σε κάθε προσθήκη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚖️ ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΣΙΩΠΗΛΗ ΔΗΜΙΟΥΡΓΙΑ (EDPB Recommendations 2/2025)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το EDPB δέχεται τον λογαριασμό μόνο όταν είναι *αντικειμενικά απαραίτητος* και
 * απαιτεί ρητά *«ενημέρωσε **καθαρά** τον χρήστη **γιατί**»*. Η αγγλόφωνη
 * πρακτική τον λέει *«stealth account creation»* — **εδώ δεν ισχύει**.
 *
 * ⚠️ **Η ΕΝΗΜΕΡΩΣΗ ΔΕΝ ΖΕΙ ΕΔΩ, ΚΑΙ ΕΙΝΑΙ ΠΡΟΫΠΟΘΕΣΗ ΤΗΣ ΚΛΗΣΗΣ**: η φόρμα το
 * λέει **πριν** πατηθεί το κουμπί (`FirstContactDisclosureForm`). Αν κάποιος
 * καλέσει αυτή τη συνάρτηση από διαδρομή **χωρίς** εκείνη τη γραμμή, η
 * δημιουργία γίνεται σιωπηλή — και **παύει να είναι νόμιμη**. Δεν είναι κάτι
 * που μπορεί να επιβάλει ο μεταγλωττιστής· γι' αυτό γράφεται εδώ.
 *
 * **Layering**: server — Admin SDK. Καμία κρίση «επιτρέπεται;» (CHECK 3.68):
 * η σύνθεση του claim ζει στο `lib/auth/claim-payload`, ο γραφέας στο
 * `lib/auth/set-claims-with-mirror`. Εδώ ζει **η ακολουθία**.
 */

import { FieldValue as AdminFieldValue } from 'firebase-admin/firestore';

import type { UserStatus } from '@/auth/types/auth.types';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  checkClaimFits,
  composeCitizenClaimPayload,
} from '@/lib/auth/claim-payload';
import { setClaimsWithMirror } from '@/lib/auth/set-claims-with-mirror';
import { isValidGlobalRole } from '@/lib/auth/types';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('CITIZEN_IDENTITY');

/**
 * **Η κατάσταση του εγγράφου που λέει «αυτός ήρθε από τον δρόμο»** (ADR-844).
 *
 * 🔴 **ΞΕΧΩΡΙΣΤΗ ΑΠΟ ΤΟ `'pending'`, ΚΑΙ ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΟ ΤΗΣ ΣΧΕΔΙΑΣΗΣ.** Το
 * `'pending'` σημαίνει *«ζήτησε να μπει σε γραφείο και **περιμένει** άνθρωπο»*.
 * Ο πολίτης **δεν περιμένει κανέναν** — δεν ζήτησε γραφείο. Μία κοινή τιμή για
 * τα δύο θα σήμαινε ότι μια οθόνη διαχειριστή δείχνει τη Μαρία σε λίστα
 * *«εκκρεμείς εγκρίσεις»* που **δεν θα αδειάσει ποτέ**, ή ότι ο
 * `ensurePendingRegistration` την υποβαθμίζει σε κάθε της σύνδεση.
 *
 * ⚠️ Η τιμή διαβάζεται **ονομαστικά** από τον `ensurePendingRegistration`
 * (ADR-660). Αλλαγή εδώ **χωρίς** αλλαγή εκεί σπάει το no-op **σιωπηλά** — γι'
 * αυτό η σταθερά είναι **μία** και εξάγεται.
 *
 * ✅ **ΔΑΝΕΙΣΜΕΝΗ, ΟΧΙ ΕΠΙΝΟΗΜΕΝΗ — ΚΑΙ ΤΟ ΕΠΙΒΑΛΛΕΙ Ο ΜΕΤΑΓΛΩΤΤΙΣΤΗΣ.** Το
 * `satisfies UserStatus` δένει τη σταθερά στο **ένα** λεξιλόγιο
 * (`USER_STATUSES`, `auth/types/auth.types.ts`). Χωρίς αυτό θα ήταν ωμό string
 * — ακριβώς η κλάση βλάβης του ADR-822 §4.4, όπου μια «θεραπεία» παραλίγο να
 * γράψει στην παραγωγή `status: 'disabled'`, **τιμή που δεν υπάρχει**.
 */
export const CITIZEN_STATUS = 'citizen' as const satisfies UserStatus;

/** Γιατί δεν δόθηκε ταυτότητα. **Ονομασμένοι λόγοι, ποτέ `null`.** */
export type CitizenIdentityRefusal =
  /**
   * Ο λογαριασμός Auth είναι **απενεργοποιημένος**.
   *
   * 🔴 **Ο ΚΡΙΣΙΜΟΤΕΡΟΣ ΦΡΟΥΡΟΣ ΤΟΥ ΑΡΧΕΙΟΥ.** Χωρίς αυτόν, κάποιος που
   * αποκλείστηκε ρητά θα ξανάμπαινε γράφοντας το email του σε **δημόσια φόρμα
   * επαφής** — δηλαδή η πιο ανοιχτή πόρτα του συστήματος θα ακύρωνε την πιο
   * ρητή του απόφαση. Ίδιο κριτήριο και ίδιο όνομα με το `account-disabled`
   * του `lib/auth/identity-materialisation.ts` (ADR-822).
   */
  | 'account-disabled'
  /** Το claim δεν χωρά στο όριο της Firebase — δες `claim-payload.ts`. */
  | 'claim-too-large'
  /** Η Firebase Auth δεν απάντησε. **Δεν μάθαμε** ≠ «δεν επιτρέπεσαι». */
  | 'identity-unavailable';

export type CitizenIdentityOutcome =
  | {
      readonly kind: 'ready';
      readonly uid: string;
      /** Για `signInWithCustomToken` στον φυλλομετρητή. */
      readonly customToken: string;
      /** Γεννήθηκε **τώρα** ο λογαριασμός; Η οθόνη το λέει αλλιώς. */
      readonly born: boolean;
    }
  | { readonly kind: 'refused'; readonly reason: CitizenIdentityRefusal };

export interface CitizenIdentityInput {
  /** **Επαληθευμένο** email. Ο καλών οφείλει να το έχει ήδη αποδείξει. */
  readonly email: string;
  readonly displayName: string;
}

// =============================================================================
// 1. Ο ΛΟΓΑΡΙΑΣΜΟΣ — βρες, αλλιώς γέννησε
// =============================================================================

interface ResolvedAccount {
  readonly uid: string;
  readonly disabled: boolean;
  readonly customClaims: Record<string, unknown> | undefined;
  readonly born: boolean;
}

function isUserNotFound(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && (error as { code?: unknown }).code === 'auth/user-not-found'
  );
}

/**
 * **Βρες τον λογαριασμό αυτού του email, αλλιώς γέννησέ τον.**
 *
 * ⚠️ **`emailVerified: true` ΚΑΙ ΕΙΝΑΙ ΑΛΗΘΕΙΑ, ΟΧΙ ΕΥΚΟΛΙΑ.** Ο καλών φτάνει
 * εδώ **μόνο** αφού ο άνθρωπος πάτησε τον σύνδεσμο ή έγραψε τον κωδικό που
 * στείλαμε σε **αυτή** τη διεύθυνση. Το να το γράφαμε `false` θα ήταν να πούμε
 * ψέματα προς την **αυστηρή** κατεύθυνση: ο άνθρωπος θα έβλεπε αργότερα
 * *«επιβεβαίωσε το email σου»* για κάτι που **μόλις** επιβεβαίωσε.
 *
 * ⚠️ Ο καλών **δεν** μαθαίνει αν ο λογαριασμός προϋπήρχε — δες το `born`, που
 * ταξιδεύει μόνο ως προς **τι λέει η οθόνη**, ποτέ ως προς το τι επιτρέπεται.
 */
async function resolveAccount(input: CitizenIdentityInput): Promise<ResolvedAccount> {
  const auth = getAdminAuth();

  try {
    const existing = await auth.getUserByEmail(input.email);
    return {
      uid: existing.uid,
      disabled: existing.disabled,
      customClaims: existing.customClaims,
      born: false,
    };
  } catch (error: unknown) {
    if (!isUserNotFound(error)) throw error;
  }

  const created = await auth.createUser({
    email: input.email,
    emailVerified: true,
    displayName: input.displayName,
  });

  return { uid: created.uid, disabled: false, customClaims: undefined, born: true };
}

// =============================================================================
// 2. ΤΑ CLAIMS — χορήγησε ΜΟΝΟ σε ποιον δεν έχει
// =============================================================================

/**
 * **Έχει ήδη ταυτότητα;** Τότε **μην την αγγίξεις**.
 *
 * 🔴 **ΑΥΤΟΣ Ο ΕΛΕΓΧΟΣ ΕΙΝΑΙ Η ΔΙΑΦΟΡΑ ΑΝΑΜΕΣΑ ΣΕ «ΔΩΣΕ ΤΑΥΤΟΤΗΤΑ» ΚΑΙ
 * «ΥΠΟΒΑΘΜΙΣΕ ΤΑΥΤΟΤΗΤΑ».** Ένας `company_admin` που στέλνει μήνυμα από δημόσια
 * αγγελία με το email του **δεν επιτρέπεται** να βγει `external_user` χωρίς
 * εταιρεία — θα έχανε τον χώρο του με ένα κλικ σε φόρμα επαφής.
 *
 * ⚠️ Και ο `setClaimsWithMirror` **δεν κάνει merge** *(«ο καλών περνά το ΠΛΗΡΕΣ
 * payload»)*, άρα μια κλήση χωρίς αυτόν τον φρουρό θα **έσβηνε** το `companyId`
 * — όχι θα το άφηνε. Η υποβάθμιση θα ήταν **ολική και σιωπηλή**.
 *
 * ⚠️ Ισχύει **και** για τον ήδη-πολίτη: η δεύτερη επαφή του δεν ξαναγράφει
 * τίποτα. Ιδεμποτησία.
 */
function alreadyHasIdentity(customClaims: Record<string, unknown> | undefined): boolean {
  const role = customClaims?.globalRole;
  return typeof role === 'string' && isValidGlobalRole(role);
}

async function grantCitizenClaims(
  uid: string,
  previousClaims: Record<string, unknown> | undefined,
): Promise<CitizenIdentityRefusal | null> {
  const payload = composeCitizenClaimPayload(previousClaims);

  // ⚠️ Η μέτρηση είναι **η ίδια** με του εταιρικού γραφέα (ADR-813). Το claim
  //    του πολίτη είναι μικροσκοπικό σήμερα — αλλά το όριο είναι **κλάση, όχι
  //    δείγμα**, και μια δεύτερη διαδρομή που δεν μετρά είναι μια διαδρομή που
  //    θα σκάσει με `auth/claims-too-large` όταν κάποιος προσθέσει πεδίο.
  const fit = checkClaimFits(payload);
  if (!fit.fits) {
    logger.error('Το claim του πολίτη δεν χωρά', {
      uid, bytes: fit.bytes, limit: fit.limit, overBy: fit.overBy,
    });
    return 'claim-too-large';
  }

  await setClaimsWithMirror(uid, payload);
  return null;
}

// =============================================================================
// 3. ΤΟ ΕΓΓΡΑΦΟ — ο καθρέφτης, γραμμένος ΠΡΙΝ την πρώτη σύνδεση
// =============================================================================

/**
 * **Το `users/{uid}` του πολίτη.**
 *
 * 🔴 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ**: γράφεται **πριν** επιστραφεί το custom token,
 * άρα **πριν** ο φυλλομετρητής συνδεθεί, άρα **πριν** τρέξει ο
 * `ensurePendingRegistration` στο `POST /api/auth/session`. Εκείνος διαβάζει
 * {@link CITIZEN_STATUS} και κάνει **no-op**. Με την αντίστροφη σειρά, η πρώτη
 * σύνδεση της Μαρίας θα έγραφε `globalRole: null` πάνω στο έγγραφό της ⇒
 * **ενεργή** απόκλιση claim↔εγγράφου, που το ADR-660 §5.13 μετρά σήμερα **0/4**.
 *
 * ⚠️ **`globalRole` και `companyId` γράφονται ΡΗΤΑ**, ώστε το έγγραφο να λέει
 * **ό,τι ακριβώς λέει το claim**. Ο `ensurePendingRegistration` γράφει
 * `globalRole: null` γιατί εκεί **όντως** δεν υπάρχει ρόλος· εδώ υπάρχει, και
 * ένα `null` θα ήταν ο καθρέφτης να δείχνει άλλο πρόσωπο από τον άνθρωπο.
 */
async function writeCitizenDocument(uid: string, input: CitizenIdentityInput): Promise<void> {
  await getAdminFirestore()
    .collection(COLLECTIONS.USERS)
    .doc(uid)
    .set(
      {
        uid,
        email: input.email,
        displayName: input.displayName,
        emailVerified: true,
        companyId: null,
        globalRole: 'external_user',
        status: CITIZEN_STATUS,
        authProvider: 'first-contact-invitation',
        updatedAt: AdminFieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

// =============================================================================
// 4. Η ΑΚΟΛΟΥΘΙΑ
// =============================================================================

/**
 * **Δώσε σε αυτόν τον άνθρωπο ταυτότητα, και τα κλειδιά να μπει.**
 *
 * @param input Email **ήδη επαληθευμένο** από τον καλούντα, και το όνομα που
 *              έδωσε ο ίδιος.
 * @returns `ready` με `customToken` για `signInWithCustomToken`, ή ονομασμένη
 *          άρνηση.
 *
 * ⚠️ **Ιδεμποτησία**: δεύτερη κλήση για τον ίδιο άνθρωπο δεν γεννά τίποτα, δεν
 * ξαναγράφει claims, και επιστρέφει **νέο** custom token — που είναι το σωστό:
 * το token είναι εφήμερο κλειδί, όχι ταυτότητα.
 */
export async function ensureCitizenIdentity(
  input: CitizenIdentityInput,
): Promise<CitizenIdentityOutcome> {
  try {
    const account = await resolveAccount(input);

    if (account.disabled) {
      logger.warn('Απενεργοποιημένος λογαριασμός ζήτησε ταυτότητα πολίτη', {
        uid: account.uid,
      });
      return { kind: 'refused', reason: 'account-disabled' };
    }

    if (!alreadyHasIdentity(account.customClaims)) {
      const refusal = await grantCitizenClaims(account.uid, account.customClaims);
      if (refusal !== null) return { kind: 'refused', reason: refusal };
      await writeCitizenDocument(account.uid, input);
    }

    const customToken = await getAdminAuth().createCustomToken(account.uid);
    return { kind: 'ready', uid: account.uid, customToken, born: account.born };
  } catch (error: unknown) {
    // 🔴 **«Δεν μάθαμε» ΠΟΤΕ ίδιο με «δεν επιτρέπεσαι»** (N.12). Ένα σφάλμα
    //    δικτύου προς τη Firebase δεν είναι απόφαση για τον άνθρωπο.
    logger.error('Η ταυτότητα του πολίτη δεν δόθηκε', {
      error: getErrorMessage(error),
    });
    return { kind: 'refused', reason: 'identity-unavailable' };
  }
}
