/**
 * =============================================================================
 * ΤΙ ΧΩΡΑΕΙ ΣΤΟ CLAIM — Η ΣΥΝΘΕΣΗ ΚΑΙ ΤΟ ΟΡΙΟ (ADR-813 Φάση Β)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Τι ακριβώς γράφεται στο custom claim, και **χωράει**;»*
 *
 * ⚠️ **ΔΕΝ ΕΙΝΑΙ ΚΡΙΤΗΣ** (CHECK 3.68). Δεν αποφασίζει «επιτρέπεται;» — αυτό το
 * κάνουν ο `decideCapability` (πελάτης) και ο `checkPermission` (server).
 * Εδώ ζει **σύνθεση** και **μέτρηση**: τι μπαίνει στο token και πόσο πιάνει.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΤΟ ΟΡΙΟ ΔΕΝ ΗΤΑΝ ΘΕΩΡΗΤΙΚΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η Firebase δηλώνει **hard limit 1.000 bytes** για το custom claims payload,
 * και το επιβάλλει σε **χρόνο εκτέλεσης** με `auth/claims-too-large`. Ο
 * `claims-handler` αντέγραφε ολόκληρο τον κατάλογο του ρόλου μέσα στο claim
 * ⇒ μετρημένο 2026-08-26:
 *
 *     company_admin    54 perms → 1.585 bytes  ⛔
 *     project_manager  42 perms → 1.302 bytes  ⛔
 *
 * δηλαδή **η διαδρομή που υπάρχει για να δίνει ρόλο δεν μπορούσε να δώσει δύο
 * από τους ρόλους της**. Η αντιγραφή έφυγε (και οι δύο κριτές παράγουν ήδη τα
 * δικαιώματα του ρόλου) — αλλά αυτό **δεν αρκεί**:
 *
 * 🔑 **ΤΟ ΜΕΓΕΘΟΣ ΕΙΝΑΙ ΚΛΑΣΗ, ΟΧΙ ΔΕΙΓΜΑ.** Το `SetUserClaimsRequest` δέχεται
 *    `permissions?: PermissionId[]` και τα επικυρώνει **ένα-ένα** — χωρίς
 *    **κανένα όριο πλήθους**. Ένας χειριστής που στέλνει 54 extras ξαναφέρνει
 *    ακριβώς το ίδιο σφάλμα, από άλλη πόρτα. Αν διορθώναμε μόνο την αντιγραφή,
 *    θα είχαμε λύσει το **δείγμα** και αφήσει την **κλάση**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΗ FIREBASE
 * ─────────────────────────────────────────────────────────────────────────────
 * Η τεκμηρίωση της Firebase λέει το όριο και **σε αφήνει να το ανακαλύψεις όταν
 * σκάσει** — ένα αδιαφανές `auth/claims-too-large` χωρίς να πει **πόσο**, **τι
 * περίσσεψε**, ή **ποιος** το προκάλεσε. Εδώ η υπέρβαση μετριέται **πριν** τη
 * γραφή, με ονόματα και αριθμούς, ώστε το μήνυμα να λέει τι να αφαιρέσεις.
 *
 * ⚠️ **Η ΜΕΤΡΗΣΗ ΠΕΡΙΛΑΜΒΑΝΕΙ ΤΗ ΣΦΡΑΓΙΔΑ ΤΟΥ ΓΡΑΦΕΑ.** Ο `setClaimsWithMirror`
 * προσθέτει `claimsUpdatedAt` **μετά** από εδώ (ADR-360). Μέτρηση χωρίς αυτό θα
 * ήταν αισιόδοξη κατά **31 bytes** — και θα άφηνε ένα claim 995 bytes να περάσει
 * τον έλεγχο και να σκάσει στη Firebase. *Μετράμε ό,τι όντως γράφεται.*
 *
 * @module lib/auth/claim-payload
 * @enterprise ADR-813 Φάση Β — το claim κουβαλά ταυτότητα, όχι αντίγραφο
 * @see lib/auth/set-claims-with-mirror.ts — ο ΕΝΑΣ γραφέας (προσθέτει τη σφραγίδα)
 * @see lib/auth/authority.ts   — ο κριτής του πελάτη (βήμα 6 παράγει τον ρόλο)
 * @see lib/auth/permissions.ts — ο κριτής του server (Check 5 παράγει τον ρόλο)
 */

import { isValidPermission, type GlobalRole, type PermissionId } from './types';

/**
 * Το όριο της Firebase για το custom claims payload, σε bytes.
 *
 * ⚠️ **ΔΕΝ είναι δική μας πολιτική** — είναι περιορισμός της πλατφόρμας
 * («The custom claims payload must not exceed 1000 bytes»). Μην το «χαλαρώσεις»
 * για να περάσει κάτι: η Firebase θα το απορρίψει ούτως ή άλλως, απλώς
 * αργότερα και με χειρότερο μήνυμα.
 */
export const FIREBASE_CLAIM_LIMIT_BYTES = 1000;

/**
 * Οι ρόλοι που παίρνουν `admin_access` **ρητά** στο claim.
 *
 * 🔑 **ΓΙΑΤΙ ΡΗΤΑ, ΑΦΟΥ Ο ΚΑΤΑΛΟΓΟΣ ΤΟ ΕΧΕΙ ΗΔΗ**: το `filterItemsByPermissions`
 * του `smart-navigation-factory` κάνει **ωμό `includes`** πάνω στο claim — δεν
 * ρωτά κριτή, δεν κοιτά ρόλο — και **και οι 8** δηλώσεις του ζητούν αυτό το ένα
 * id. Χωρίς τη ρητή προσθήκη, ο διαχειριστής θα έχανε ολόκληρο το μενού.
 *
 * ⚠️ Μετρημένο ότι οι δύο ρόλοι το χρειάζονται για **διαφορετικό** λόγο:
 * ο `company_admin` το έχει μέσα στα 54 του καταλόγου (που πλέον δεν
 * αντιγράφονται), ενώ ο `super_admin` έχει `permissions: []` — όλη του η δύναμη
 * είναι το `isBypass`, οπότε δεν θα το έπαιρνε από πουθενά.
 *
 * ⛔ **ΔΕΝ κρίνει «επιτρέπεται;»** — απαντά «τι γράφω στο token;». Ο κριτής
 * παραμένει ο `decideCapability`.
 */
const ROLES_WITH_EXPLICIT_ADMIN_ACCESS: readonly GlobalRole[] = [
  'super_admin',
  'company_admin',
];

/** Ό,τι ξέρουμε τη στιγμή που συνθέτουμε το claim. */
export interface ClaimPayloadInput {
  readonly companyId: string;
  readonly globalRole: GlobalRole;
  /** Ρητά δοσμένα extras από τον χειριστή — **ποτέ** ο κατάλογος του ρόλου. */
  readonly explicitPermissions?: readonly PermissionId[] | undefined;
  /** Τα claims που **ήδη** έχει ο χρήστης· η πηγή του `mfaEnrolled`. */
  readonly previousClaims?: Record<string, unknown> | undefined;
}

/** Ό,τι γράφεται — χωρίς τη σφραγίδα `claimsUpdatedAt` του γραφέα. */
export interface ClaimPayload {
  readonly companyId: string;
  readonly globalRole: GlobalRole;
  readonly mfaEnrolled: boolean;
  readonly permissions: PermissionId[];
}

/**
 * **Το claim του ΠΟΛΙΤΗ** — ταυτότητα **χωρίς οργανισμό** (ADR-844).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟΣ ΤΥΠΟΣ ΚΑΙ ΟΧΙ `companyId: string | null`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **Η ΑΠΟΥΣΙΑ ΤΟΥ ΚΛΕΙΔΙΟΥ ΕΙΝΑΙ Η ΣΗΜΑΣΙΑ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ.** Ο
 * {@link extractCustomClaims} (`lib/auth/auth-context.ts`) επιστρέφει `null`
 * ακριβώς όταν λείπει το `companyId` — και **αυτό** είναι που γεννά τον
 * **προσωπικό** κλάδο του ADR-817. Ένα `companyId: null` **μέσα** στο claim θα
 * ήταν κλειδί που υπάρχει με τιμή που δεν στέκει· ένα `companyId: ''` το
 * απορρίπτει fail-closed το ADR-657 §3.5 *(«κενή συμβολοσειρά = **απουσία**, όχι
 * μισθωτής»)*. Το κλειδί απλώς **δεν γράφεται**.
 *
 * ⛔ **ΜΗΝ το ενοποιήσεις με το {@link ClaimPayload} βάζοντας προαιρετικό
 * `companyId`**: τότε ο μεταγλωττιστής θα επέτρεπε στον διαχειριστικό γραφέα
 * (`claims-handler`) να παραλείψει τον μισθωτή **σιωπηλά** — δηλαδή να παράγει
 * πολίτη εκεί που ζητήθηκε μέλος εταιρείας. Δύο σχήματα επειδή υπάρχουν
 * **πραγματικά δύο**, και ο μεταγλωττιστής τα κρατά χωριστά.
 *
 * 🔑 Ο ρόλος είναι **σταθερά** `external_user`: ο πολίτης δεν διαπραγματεύεται
 * ρόλο. Ο τύπος το λέει, ώστε να μην μπορεί κανείς να περάσει `company_admin`
 * από αυτή τη διαδρομή — **μη εκφράσιμο**, όχι αποθαρρυμένο.
 */
export interface CitizenClaimPayload {
  readonly globalRole: 'external_user';
  readonly mfaEnrolled: boolean;
  readonly permissions: PermissionId[];
}

/**
 * Ό,τι μπορεί να γραφτεί ως custom claim — **και τα δύο** σχήματα.
 *
 * Υπάρχει ώστε η **μέτρηση** ({@link claimPayloadBytes} · {@link checkClaimFits})
 * να είναι **μία** για όλα όσα γράφονται. Το όριο της Firebase δεν ρωτά ποιος
 * είσαι.
 */
export type AnyClaimPayload = ClaimPayload | CitizenClaimPayload;

/**
 * Συνθέτει το claim του **πολίτη** — ανθρώπου χωρίς οργανισμό (ADR-844).
 *
 * @param previousClaims Τα claims που **ήδη** έχει· η πηγή του `mfaEnrolled`.
 * @returns Payload για τον {@link setClaimsWithMirror}, **χωρίς** `companyId`.
 *
 * ⚠️ **`permissions` ΠΑΝΤΑ κενό, και είναι απόφαση.** Τα permissions είναι
 * **εμβέλειας εταιρείας** κατά δήλωση του ίδιου του PDP (`lib/auth/permissions.ts`:
 * *«η παραχώρηση ζει δίπλα στο `companyId` και δεν κουβαλά δική της εμβέλεια»*).
 * Μια παραχώρηση σε κάποιον χωρίς εταιρεία **δεν έχει πού να ισχύσει** — θα ήταν
 * δικαίωμα χωρίς χώρο, δηλαδή θόρυβος που μοιάζει με εξουσία.
 *
 * ⛔ Και γι' αυτό **δεν** δέχεται `explicitPermissions`: η υπογραφή κάνει την
 * κατάχρηση **αδύνατη να γραφτεί**, αντί να την απαγορεύει με σχόλιο.
 *
 * @example
 * composeCitizenClaimPayload();
 * // → { globalRole: 'external_user', mfaEnrolled: false, permissions: [] }
 */
export function composeCitizenClaimPayload(
  previousClaims?: Record<string, unknown> | undefined,
): CitizenClaimPayload {
  return {
    globalRole: 'external_user',
    // ⚠️ Ίδιο `=== true` με τον εταιρικό συνθέτη, για τον ίδιο λόγο: η εγγραφή
    //    MFA είναι πράξη **του ίδιου του ανθρώπου** — τη διατηρούμε, δεν την
    //    κρίνουμε, και η απουσία της σημαίνει «δεν έχει», ποτέ «άγνωστο».
    mfaEnrolled: previousClaims?.mfaEnrolled === true,
    permissions: [],
  };
}

/**
 * Συνθέτει το claim: **ταυτότητα + extras**, ποτέ αντίγραφο του καταλόγου.
 *
 * @param input Ταυτότητα, ρητά extras, και τα προηγούμενα claims.
 * @returns Το payload που θα δοθεί στον `setClaimsWithMirror`.
 *
 * @example
 * composeClaimPayload({ companyId: 'comp_1', globalRole: 'company_admin' });
 * // → { companyId: 'comp_1', globalRole: 'company_admin',
 * //     mfaEnrolled: false, permissions: ['admin_access'] }
 */
export function composeClaimPayload(input: ClaimPayloadInput): ClaimPayload {
  const explicit = Array.isArray(input.explicitPermissions)
    ? input.explicitPermissions
    : [];

  const permissions = new Set<PermissionId>(explicit);
  if (ROLES_WITH_EXPLICIT_ADMIN_ACCESS.includes(input.globalRole)) {
    permissions.add('admin_access');
  }

  return {
    companyId: input.companyId,
    globalRole: input.globalRole,
    // ⚠️ **`=== true`, ΠΟΤΕ truthy**: απουσία σημαίνει «δεν έχει εγγραφεί», όχι
    //    «άγνωστο» — fail-closed. Η εγγραφή MFA είναι πράξη **του ίδιου του
    //    χρήστη**· η ανάθεση ρόλου δεν έχει αρμοδιότητα να την κρίνει, μόνο να
    //    τη **διατηρήσει**.
    mfaEnrolled: input.previousClaims?.mfaEnrolled === true,
    permissions: Array.from(permissions).filter(isValidPermission),
  };
}

/**
 * Πόσα bytes πιάνει το claim **όπως όντως γράφεται** — με τη σφραγίδα μέσα.
 *
 * @param payload Το συντεθειμένο claim.
 * @returns Μέγεθος σε bytes UTF-8.
 *
 * ⚠️ **`Buffer.byteLength(..., 'utf8')`, ΠΟΤΕ `.length`**: το `String.length`
 * μετρά **μονάδες UTF-16**. Στα ελληνικά η διαφορά είναι **×1,45** (το ίδιο
 * λάθος που το CHECK 3.34 §8.43 πλήρωσε: 163.749 αντί για 240.521). Εδώ τα ids
 * είναι λατινικά **σήμερα** — αλλά ένα όριο που είναι σωστό μόνο όσο κανείς δεν
 * γράφει ελληνικά δεν είναι όριο.
 */
export function claimPayloadBytes(payload: AnyClaimPayload): number {
  // Η σφραγίδα που θα προσθέσει ο `setClaimsWithMirror` (ADR-360) — 13ψήφιο
  // epoch ms. Χρησιμοποιείται σταθερή τιμή **ίδιου μήκους** ώστε η μέτρηση να
  // είναι ντετερμινιστική και να μη διαφέρει μεταξύ δύο κλήσεων.
  const withStamp = { ...payload, claimsUpdatedAt: 1_000_000_000_000 };
  return Buffer.byteLength(JSON.stringify(withStamp), 'utf8');
}

/** Η απάντηση στο «χωράει;» — με τους αριθμούς μέσα, ώστε να λέει τι να κόψεις. */
export interface ClaimFitVerdict {
  readonly fits: boolean;
  readonly bytes: number;
  readonly limit: number;
  /** Πόσα bytes περισσεύουν· `0` όταν χωράει. */
  readonly overBy: number;
}

/**
 * Χωράει αυτό το claim στο όριο της Firebase;
 *
 * @param payload Το συντεθειμένο claim.
 * @returns Ετυμηγορία **με αριθμούς**, ποτέ σκέτο `boolean`.
 *
 * @example
 * const fit = checkClaimFits(payload);
 * if (!fit.fits) throw new Error(`υπερβαίνει κατά ${fit.overBy} bytes`);
 */
export function checkClaimFits(payload: AnyClaimPayload): ClaimFitVerdict {
  const bytes = claimPayloadBytes(payload);
  return {
    fits: bytes <= FIREBASE_CLAIM_LIMIT_BYTES,
    bytes,
    limit: FIREBASE_CLAIM_LIMIT_BYTES,
    overBy: Math.max(0, bytes - FIREBASE_CLAIM_LIMIT_BYTES),
  };
}
