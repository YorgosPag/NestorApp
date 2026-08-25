/**
 * «Φτιάξε μου τον χώρο μου» — η αλυσίδα του **Κ-1**, μία φορά
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΛΥΝΕΙ (ADR-787 Κ-1 · μετρημένο 2026-08-25)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ένας αυτο-εγγεγραμμένος άνθρωπος **δεν είχε κανέναν τρόπο** να αποκτήσει
 * εταιρικό χώρο: εγγραφόταν, έπαιρνε τον ιδιωτικό του χώρο, και τέρμα. Ο χώρος
 * γραφείου δινόταν **μόνο** από `super_admin` μέσω `set-user-claims`.
 *
 * ⚠️ **ΔΕΝ έλειπε μηχανή — έλειπε ο ΚΡΙΚΟΣ.** Μετρημένο πριν γραφτεί γραμμή:
 *
 * | Κομμάτι | Πού ζει | Καλούντες πριν από αυτό το αρχείο |
 * |---|---|---|
 * | `claimAlias` | `alias-registry.ts` | **0** |
 * | `ensureCompanyDocument` | `services/company-document.service.ts` | 2 |
 * | `setClaimsWithMirror` | `lib/auth/set-claims-with-mirror.ts` | 1 |
 * | σχήμα `workspace_members` | `api/admin/set-user-claims/claims-handler.ts` | το πρότυπο |
 *
 * Δηλαδή **όλα τα εξαρτήματα υπήρχαν και κανένα δεν ήταν συνδεδεμένο**. Αυτό το
 * αρχείο **δεν γράφει νέα μηχανή· δίνει στα υπάρχοντα τη σειρά τους**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ `WorkspaceService.createWorkspace` ΔΕΝ ΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ, ΚΑΙ ΕΙΝΑΙ ΣΩΣΤΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Γράφει στη συλλογή `WORKSPACES` — που **δεν υπάρχει στη βάση** (γραμμένο στο
 * ίδιο το `types/workspace-membership.ts`: *«συλλογή `workspaces` → δεν υπάρχει
 * στη βάση»*) και που ο `GET /api/workspaces` **δεν διαβάζει ποτέ**: εκείνος
 * παράγει τον κατάλογο από τα **claims** και τα **`workspace_members`**.
 *
 * ⛔ **ΜΗΝ «συνδέσεις» το `createWorkspace` εδώ.** Θα ήταν **τρίτο ράφι** για
 *    ερώτημα που έχει ήδη απάντηση — ακριβώς το σχήμα του **ADR-749** (τέσσερις
 *    μηχανές, τρεις αριθμοί). Ο χώρος γραφείου **είναι** το `companies/{id}` συν
 *    η συμμετοχή· δεν υπάρχει δεύτερο έγγραφο που να τον «δηλώνει».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ — ΚΑΙ ΕΙΝΑΙ ΟΛΟ ΤΟ ΣΧΕΔΙΟ
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. **έχει ήδη χώρο;**   ⇒ σταμάτα        — καμία γραφή
 *   2. **δέσμευσε το όνομα** (`claimAlias`)  — το **μόνο** βήμα που μπορεί να
 *      απορριφθεί για λόγο **του ανθρώπου** (πιασμένο όνομα)
 *   3. το **έγγραφο** του χώρου
 *   4. η **συμμετοχή** + το **προφίλ**
 *   5. τα **claims**                          — η **άδεια**, πάντα τελευταία
 *
 * ⚠️ **Το όνομα δεσμεύεται ΠΡΩΤΟ.** Αν γινόταν τελευταίο, ο άνθρωπος θα είχε ήδη
 * εταιρεία, συμμετοχή και δικαιώματα — και **μετά** θα μάθαινε *«αυτό το όνομα
 * δεν γίνεται»*. Θα έμενε με χώρο που δεν ζήτησε και δεν μπορεί να ονομάσει.
 *
 * ⚠️ **Τα claims γράφονται ΤΕΛΕΥΤΑΙΑ.** Είναι η **άδεια**: δοσμένη πριν υπάρχουν
 * το έγγραφο και η συμμετοχή, δίνει στον άνθρωπο `companyId` προς χώρο που
 * **δεν υπάρχει ακόμη** — κάθε κλήση δεδομένων θα αποτύγχανε με ταυτότητα που ο
 * διακομιστής θεωρεί έγκυρη. Το ίδιο ελάττωμα που περιγράφει το `landing.ts`
 * για την προσγείωση, μια στάση πιο νωρίς.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ♻️ Η ΕΠΑΝΑΛΗΨΗ ΕΙΝΑΙ ΑΣΦΑΛΗΣ — ΚΑΙ ΔΕΝ ΤΗ ΓΡΑΨΑΜΕ ΕΜΕΙΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Αν η αλυσίδα κοπεί στη μέση (δίκτυο, ψυχρή εκκίνηση), η **επανάληψη με το ίδιο
 * όνομα** συνεχίζει από εκεί που έμεινε, χωρίς διπλά:
 *
 * * `claimAlias` → `describeCollision` επιστρέφει **`ok: true`** όταν ο **ίδιος**
 *   χώρος ξαναζητά το **ίδιο** όνομα (*«δεν είναι σύγκρουση, είναι idempotency»*).
 * * `ensureCompanyDocument` → `create-if-not-exists` μέσα σε **transaction**.
 * * η συμμετοχή και το προφίλ → `set(..., { merge: true })`.
 *
 * ⚠️ **Ένα καινούριο `companyId` ανά προσπάθεια θα ΚΑΤΕΣΤΡΕΦΕ αυτή την ιδιότητα**:
 * η δεύτερη προσπάθεια θα ζητούσε το ίδιο όνομα για **άλλη** ταυτότητα, δηλαδή
 * θα έπεφτε σε `already-taken` πάνω στον **ίδιο της τον εαυτό**. Γι' αυτό η
 * ταυτότητα **παράγεται μετά** τον φρουρό και **πριν** από κάθε γραφή, και η
 * επανάληψη περνά από τον ίδιο δρόμο.
 *
 * @module lib/workspace/workspace-provisioning
 * @see docs/centralized-systems/reference/adrs/ADR-787-multi-organization-platform.md Κ-1
 */

import 'server-only';

import { FieldValue as AdminFieldValue } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { getAdminAuth, getAdminFirestore, isFirebaseAdminAvailable } from '@/lib/firebaseAdmin';
import { setClaimsWithMirror } from '@/lib/auth/set-claims-with-mirror';
import { ensureCompanyDocument } from '@/services/company-document.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import { generateCompanyId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { ProvisioningRejection } from '@/types/workspace';

import { claimAlias } from './alias-registry';

const logger = createModuleLogger('workspace-provisioning');

/**
 * Ο ρόλος του δημιουργού. **Σταθερά, ποτέ είσοδος.**
 *
 * ⛔ Δεν γίνεται παράμετρος «για ευελιξία»: ο μόνος ρόλος που έχει νόημα για
 *    όποιον φτιάχνει χώρο είναι ο διαχειριστής του, και μια παράμετρος εδώ θα
 *    ήταν **κανάλι ανύψωσης δικαιωμάτων** από το σύνορο HTTP.
 */
const FOUNDER_ROLE = 'company_admin' as const;

// =============================================================================
// ΟΙ ΕΤΥΜΗΓΟΡΙΕΣ — ΡΗΤΕΣ, ΚΛΕΙΣΤΕΣ
// =============================================================================

/**
 * ⚠️ Η {@link ProvisioningRejection} **ορίζεται στο `types/workspace.ts`**, όχι
 * εδώ: τη γεννά ο διακομιστής αλλά τη **διαβάζει η οθόνη**, και ένα
 * `server-only` module δεν είναι σπίτι για κοινό λεξιλόγιο.
 *
 * 🔑 **Κωδικός, ποτέ κείμενο.** Η οθόνη διαλέγει τη διατύπωση από τα locale
 * αρχεία (N.11). Ένα έτοιμο μήνυμα από τον διακομιστή θα ήταν σκληρή
 * συμβολοσειρά οθόνης γραμμένη σε λάθος στρώμα — και θα αγνοούσε τη γλώσσα του
 * ανθρώπου που τη διαβάζει.
 */
export type { ProvisioningRejection };

/**
 * Το αποτέλεσμα της αλυσίδας.
 *
 * ⚠️ Η επιτυχία κουβαλά **και** την ταυτότητα **και** το ψευδώνυμο: η πρώτη
 * χρειάζεται για τα claims, το δεύτερο για τη **διεύθυνση** στην οποία θα
 * σταλεί ο άνθρωπος (`workspacePath`). Επιστροφή μόνο του ενός θα ανάγκαζε τον
 * καλούντα σε δεύτερη αναζήτηση — που για τη σχέση `companyId → ψευδώνυμο`
 * είναι **σάρωση**, δηλαδή απαρίθμηση γραφείων (Ε-5 §4 #1).
 */
export type ProvisioningResult =
  | { readonly ok: true; readonly companyId: string; readonly alias: string }
  | { readonly ok: false; readonly reason: ProvisioningRejection };

/** Ό,τι χρειάζεται η αλυσίδα — και τίποτα παραπάνω. */
export interface ProvisioningInput {
  /** Ο άνθρωπος, **από το υπογεγραμμένο token**. Ποτέ από το σώμα του αιτήματος. */
  readonly uid: string;
  /**
   * Ο χώρος που δηλώνει **σήμερα** το token του — κενό αν δεν ανήκει πουθενά.
   *
   * ⚠️ Είναι ο **φρουρός**, όχι πληροφορία: όποιος έχει ήδη χώρο δεν περνά.
   */
  readonly currentCompanyId: string;
  /** Η επωνυμία που έγραψε ο άνθρωπος — ετικέτα οθόνης, όχι ταυτότητα. */
  readonly displayName: string;
  /** Το ψευδώνυμο που ζήτησε — **ωμό**· η μορφή κρίνεται από τον `claimAlias`. */
  readonly requestedAlias: string;
}

// =============================================================================
// Η ΑΛΥΣΙΔΑ
// =============================================================================

/**
 * Φτιάχνει εταιρικό χώρο και κάνει τον αιτούντα **διαχειριστή** του.
 *
 * @returns Πάντα ρητή ετυμηγορία — ποτέ `throw` για λόγο που αφορά τον χρήστη.
 */
export async function provisionWorkspace(
  input: ProvisioningInput,
): Promise<ProvisioningResult> {
  // ── 1. Ο ΦΡΟΥΡΟΣ — ένας χώρος ανά άνθρωπο, σε αυτό το βήμα ─────────────────
  //
  // ⚠️ Η **αρχή Α2** του ADR-787 λέει *«ένας άνθρωπος → πολλοί χώροι»*, και
  //    ισχύει: κανείς **προσκαλείται** σε όσους θέλει. Αυτό εδώ είναι άλλο
  //    ερώτημα — *«πόσους χώρους ΦΤΙΑΧΝΕΙ μόνος του;»*. Ο περιορισμός δεν είναι
  //    τεχνικός· είναι ότι ο χώρος που μόλις φτιάχτηκε γίνεται αμέσως ο **ενεργός**
  //    (γράφεται στα claims), οπότε ένας δεύτερος θα έδιωχνε σιωπηλά τον πρώτο.
  //    Όταν υπάρξει επιλογέας χώρου (ADR-748), αυτή η γραμμή ξαναδιαβάζεται.
  if (input.currentCompanyId.length > 0) {
    return { ok: false, reason: 'already-has-workspace' };
  }

  if (!isFirebaseAdminAvailable()) {
    logger.error('[K-1] Firebase Admin μη διαθέσιμο — καμία γραφή δεν επιχειρήθηκε', {
      uid: input.uid,
    });
    return { ok: false, reason: 'registry-unavailable' };
  }

  // Η ταυτότητα γεννιέται **πριν** από κάθε γραφή και **μία** φορά — δες την
  // ενότητα «η επανάληψη είναι ασφαλής» στην κεφαλίδα.
  const companyId = generateCompanyId();

  // ── 2. ΤΟ ΟΝΟΜΑ ΠΡΩΤΑ ──────────────────────────────────────────────────────
  const verdict = await claimAliasOrExplain(companyId, input.requestedAlias, input.uid);
  if (!verdict.ok) return verdict;
  const alias = verdict.alias;

  // ── 3-5. ΤΟ ΕΓΓΡΑΦΟ, Η ΣΥΜΜΕΤΟΧΗ, Η ΑΔΕΙΑ ──────────────────────────────────
  try {
    await ensureCompanyDocument(
      companyId,
      { name: input.displayName, contactId: companyId },
      input.uid,
    );
    await writeFounderMembership(companyId, alias, input);
    await grantFounderClaims(input.uid, companyId);
  } catch (error) {
    // ⚠️ Το ψευδώνυμο **δεν** ελευθερώνεται εδώ, και είναι απόφαση: ανήκει ήδη
    //    σε **αυτό** το `companyId`, οπότε η επανάληψη το ξαναβρίσκει δικό της
    //    (idempotency). Μια «καθαρίστρια» γραφή στο μονοπάτι της αποτυχίας θα
    //    ήταν πράξη που εκτελείται ακριβώς όταν οι γραφές δεν δουλεύουν.
    logger.error('[K-1] Η αλυσίδα έσπασε μετά τη δέσμευση ονόματος', {
      uid: input.uid,
      companyId,
      alias,
      error: getErrorMessage(error),
    });
    return { ok: false, reason: 'failed' };
  }

  logger.info('[K-1] Ο χώρος δημιουργήθηκε', { uid: input.uid, companyId, alias });
  return { ok: true, companyId, alias };
}

// =============================================================================
// ΤΑ ΒΗΜΑΤΑ
// =============================================================================

/**
 * Δεσμεύει το όνομα και μεταφράζει την αποτυχία σε **κωδικό**.
 *
 * ⚠️ Το `claimAlias` **ρίχνει** όταν το μητρώο δεν είναι διαθέσιμο και
 * **επιστρέφει** όταν το όνομα δεν γίνεται. Οι δύο περιπτώσεις **δεν ενώνονται**:
 * η πρώτη λέει στον άνθρωπο *«δοκίμασε ξανά»*, η δεύτερη *«διάλεξε άλλο»*. Ένα
 * κοινό «απέτυχε» θα τον έβαζε να ξαναγράφει όνομα που ήταν μια χαρά.
 */
async function claimAliasOrExplain(
  companyId: string,
  requestedAlias: string,
  uid: string,
): Promise<{ ok: true; alias: string } | { ok: false; reason: ProvisioningRejection }> {
  try {
    const verdict = await claimAlias(companyId, requestedAlias);
    return verdict.ok
      ? { ok: true, alias: verdict.alias }
      : { ok: false, reason: verdict.reason };
  } catch (error) {
    logger.error('[K-1] Η δέσμευση ονόματος δεν επιχειρήθηκε', {
      uid,
      error: getErrorMessage(error),
    });
    return { ok: false, reason: 'registry-unavailable' };
  }
}

/**
 * Η **άδεια** — και **διατηρεί** ό,τι υπήρχε ήδη στα claims.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ MERGE ΕΙΝΑΙ ΕΥΘΥΝΗ ΤΟΥ ΚΑΛΟΥΝΤΑ — ΚΑΙ ΕΔΩ ΕΧΕΙ ΔΟΝΤΙΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `setClaimsWithMirror` το δηλώνει ρητά: *«ο καλών περνά το **ΠΛΗΡΕΣ** φορτίο
 * — αυτό το βοήθημα **ΔΕΝ** κάνει merge»*. Άρα μια γραφή μόνο με `companyId` +
 * `globalRole` **σβήνει** ό,τι άλλο υπήρχε.
 *
 * ⚠️ Και υπάρχει κάτι να σβηστεί: το **`mfaEnrolled` είναι custom claim**
 * (`lib/auth/auth-context.ts` → `token.mfaEnrolled === true`), και ο άνθρωπος
 * **μπορεί** να έχει ενεργοποιήσει 2FA πριν φτιάξει γραφείο — ο
 * `useTwoFactorEnrollment` δεν απαιτεί χώρο. Χωρίς αυτή τη διατήρηση, η
 * δημιουργία χώρου θα **απενεργοποιούσε σιωπηλά τον δεύτερο παράγοντα**:
 * υποβάθμιση ασφαλείας ως παρενέργεια μιας εντελώς άσχετης πράξης.
 *
 * ⛔ **ΜΗΝ γράψεις εδώ `emailVerified`.** Το κατέχει το **Firebase Auth** και
 *    διαβάζεται από το **τυπικό** πεδίο `email_verified` του token — όχι από
 *    custom claim (ίδιο αρχείο, δίπλα στο `mfaEnrolled`). Ένα custom claim με
 *    το ίδιο όνομα θα ήταν **δεύτερη αυθεντία** για ερώτημα που έχει ήδη
 *    ιδιοκτήτη (ADR-749) — και θα μπορούσε να λέει «ναι» ενώ το Auth λέει «όχι».
 */
async function grantFounderClaims(uid: string, companyId: string): Promise<void> {
  const existing = await readExistingClaims(uid);
  await setClaimsWithMirror(uid, {
    ...existing,
    companyId,
    globalRole: FOUNDER_ROLE,
  });
}

/**
 * Τα σημερινά custom claims — `{}` αν δεν διαβάζονται.
 *
 * ⚠️ Κενό αντικείμενο σε αποτυχία είναι **σωστό εδώ, και μόνο εδώ**: η επόμενη
 * γραμμή γράφει ούτως ή άλλως `companyId` + `globalRole`, οπότε το χειρότερο
 * αποτέλεσμα είναι να χαθεί ένα **προαιρετικό** claim — ενώ μια εξαίρεση θα
 * ακύρωνε χώρο που **έχει ήδη γραφτεί**. Η απώλεια καταγράφεται, δεν σιωπά.
 */
async function readExistingClaims(uid: string): Promise<Record<string, unknown>> {
  try {
    return (await getAdminAuth().getUser(uid)).customClaims ?? {};
  } catch (error) {
    logger.warn('[K-1] Τα υπάρχοντα claims δεν διαβάστηκαν — γράφονται μόνο τα νέα', {
      uid,
      error: getErrorMessage(error),
    });
    return {};
  }
}

/**
 * Η **συμμετοχή**, το **προφίλ** και το **ψευδώνυμο του χώρου** — μία γραφή.
 *
 * 🔑 **Ένα `WriteBatch`, ποτέ τρία `set`.** Τα τρία έγγραφα απαντούν **μαζί** στο
 * *«ποιος είναι ο χώρος μου και τι είμαι εκεί;»*. Χωριστές γραφές αφήνουν
 * παράθυρο όπου ο άνθρωπος είναι μέλος αλλά το προφίλ του λέει άλλα — και το
 * παράθυρο είναι ακριβώς η στιγμή που ο πελάτης ανανεώνει το token.
 *
 * ⚠️ Το σχήμα του μέλους **αντιγράφει** το `set-user-claims/claims-handler.ts`
 * (`uid` · `globalRole` · `status` · `joinedAt` · `addedBy` · `permissionSetIds`)
 * — είναι το **υπάρχον** συμβόλαιο που διαβάζει ο `decideMembership`. Ένα
 * διαφορετικό σχήμα εδώ θα έφτιαχνε μέλη που ο κριτής **δεν αναγνωρίζει**.
 *
 * ⚠️ Το `alias` γράφεται **στο έγγραφο του χώρου** επειδή το ζητά ρητά ο
 * `alias-registry.ts`: *«όταν αποκτήσει έδρα το ψευδώνυμο στο ίδιο το έγγραφο
 * του χώρου (ADR-787 Κ-1), τότε γεμίζει εδώ και γεννά το 308»*. Χωρίς αυτό, η
 * μορφή-ταυτότητα (`/o/comp_…`) δεν μπορεί ποτέ να μάθει το κανονικό όνομα.
 */
async function writeFounderMembership(
  companyId: string,
  alias: string,
  input: ProvisioningInput,
): Promise<void> {
  const db = getAdminFirestore();
  const now = AdminFieldValue.serverTimestamp();
  const batch = db.batch();

  const companyRef = db.collection(COLLECTIONS.COMPANIES).doc(companyId);
  batch.set(companyRef, { alias, updatedAt: now }, { merge: true });

  batch.set(
    companyRef.collection(SUBCOLLECTIONS.WORKSPACE_MEMBERS).doc(input.uid),
    {
      uid: input.uid,
      globalRole: FOUNDER_ROLE,
      status: 'active',
      joinedAt: now,
      addedBy: input.uid,
      updatedAt: now,
      permissionSetIds: [],
    },
    { merge: true },
  );

  batch.set(
    db.collection(COLLECTIONS.USERS).doc(input.uid),
    {
      companyId,
      globalRole: FOUNDER_ROLE,
      // ⚠️ Ο άνθρωπος έφτιαξε **δικό του** γραφείο, άρα παύει να είναι στην ουρά
      //    έγκρισης του ADR-660. Χωρίς αυτή τη γραμμή θα έμενε `pending` για
      //    πάντα, ενώ είναι διαχειριστής — δύο απαντήσεις στο ίδιο ερώτημα.
      status: 'active',
      updatedAt: now,
    },
    { merge: true },
  );

  await batch.commit();

  // Το ίχνος γράφεται **έξω** από το batch και δεν μπλοκάρει: μια αποτυχία
  // καταγραφής δεν επιτρέπεται να ακυρώσει χώρο που ήδη υπάρχει (ίδια πειθαρχία
  // με το `claims-handler.ts`).
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.COMPANY,
    entityId: companyId,
    entityName: input.displayName,
    action: 'created',
    changes: [{ field: 'members', oldValue: null, newValue: input.uid }],
    performedBy: input.uid,
    performedByName: input.displayName,
    companyId,
  }).catch((error: unknown) => {
    logger.warn('[K-1] Το ίχνος δημιουργίας απέτυχε (μη μπλοκάρον)', {
      companyId,
      error: getErrorMessage(error),
    });
  });
}
