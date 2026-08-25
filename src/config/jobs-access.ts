/**
 * ADR-748 Φάση 3 — Ο ΖΩΝΤΑΝΟΣ ΥΠΟΛΟΓΙΣΜΟΣ «ποιες δουλειές έχει ο Χ» (Ε5.α/Ε5.ζ).
 *
 * ΚΑΘΑΡΗ ΣΥΝΑΡΤΗΣΗ. Μηδέν I/O, μηδέν Firebase, μηδέν React — όπως το
 * `decideAssetPackAccess()` (ADR-655), που είναι το ρητό πρότυπο του Ε5.ζ.
 * Διαβάζει το `jobs-registry.ts`· **δεν το αντιγράφει** (Ε5.γ/Υ-5: καμία
 * αντιγραφή δικαιωμάτων ή ταξινόμησης, ΠΟΤΕ).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΟΡΙΖΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ (μετρημένο 2026-08-02)
 *
 * Το Π-15 λέει ότι οι πηγές δικαιωμάτων είναι **ΤΡΕΙΣ**. Στον browser φτάνει
 * **ΜΙΑ**. Μετρημένο στο `api/admin/set-user-claims/claims-handler.ts:159-164`:
 *
 *     finalPermissions = PREDEFINED_ROLES[globalRole].permissions
 *                      + explicit permissions
 *                      + admin_access (super_admin | company_admin)
 *
 *   • `GlobalRole`     (custom claims)                    → ✅ φτάνει
 *   • `ProjectRole`    (`/projects/{pid}/members/{uid}`)  → ❌ ΠΟΤΕ
 *   • `PermissionSets` (`members/{uid}.permissionSetIds`) → ❌ ΠΟΤΕ
 *
 * Ο Νίκος στην εταιρεία Β είναι `external_user` (μηδέν δουλειές από claims) και
 * **μελετητής στο έργο**. Υπολογισμός που θα έκρυβε ό,τι δεν βεβαιώνουν τα
 * claims θα του έκρυβε το «Σχέδιο» ⇒ **άδεια οθόνη** — κατά λέξη το σενάριο
 * που το Ε-5.1 προειδοποιεί και το ελάττωμα του ACC (§6.11.1).
 *
 * ⇒ Η ΑΠΟΦΑΣΗ ΔΕΝ ΕΙΝΑΙ BOOLEAN. Είναι **τρεις διακριτές καταστάσεις**, όπως
 *   τα διακριτά `deny:*` του `decideAssetPackAccess()`:
 *
 *     'granted'  — μετρημένο δικαίωμα τη γεννά (ή bypass ρόλος)
 *     'unknown'  — η πηγή που θα απαντούσε ΔΕΝ είναι διαθέσιμη εδώ
 *     'none'     — καμία διαθέσιμη πηγή δεν τη στηρίζει
 *
 * ΚΑΙ Ο ΚΑΝΟΝΑΣ ΑΠΟΚΡΥΨΗΣ:
 *
 *     🔒 ΚΡΥΒΕΤΑΙ ΜΟΝΟ ΤΟ 'none'. ΤΟ 'unknown' ΔΕΝ ΚΡΥΒΕΤΑΙ ΠΟΤΕ.
 *
 * Έτσι το **Ε5.ζ (fail-closed)** μένει ακέραιο στην **απόφαση** — καμία δουλειά
 * δεν επινοείται από το πουθενά — και το **Ε14.ζ** μένει ακέραιο στο **φίλτρο**:
 * *«το φίλτρο δεν προσποιείται ποτέ ότι αφαιρεί πρόσβαση»*. Fail-closed σε
 * απόφαση **ασφαλείας** είναι σωστό· fail-closed σε φίλτρο **UX** κρύβει από τον
 * χρήστη πράγματα που δικαιούται (Ε5.η: αυτό εδώ είναι UX, ΟΧΙ ασφάλεια).
 *
 * 🔑 Και ξεκλειδώνει το **Υ-6** (η αλυσίδα αιτίασης ορατή): κάθε απόφαση φέρει
 * τον **λόγο** της, άρα η οθόνη μπορεί να πει «βλέπεις το Σχέδιο επειδή έχεις
 * `dxf:files:view`» ή «δεν το ξέρω — ο ρόλος σου στο έργο δεν φτάνει εδώ».
 * **Ούτε ο ACC ούτε η Figma διακρίνουν «δεν δικαιούσαι» από «δεν ξέρω».**
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΔΕΥΤΕΡΗ ΠΑΓΙΔΑ, ΕΠΙΣΗΣ ΜΕΤΡΗΜΕΝΗ: `roles.ts:55-62`
 *
 *     super_admin: { permissions: [], isBypass: true }
 *
 * Ο υπερδιαχειριστής έχει **ΚΕΝΗ** λίστα permissions· όλη του η δύναμη ζει στο
 * `isBypass`. Στα claims του υπάρχει μόνο το `admin_access` (claims-handler:161)
 * ⇒ υπολογισμός χωρίς έλεγχο bypass θα του έδινε **μόνο τη Διαχείριση** και θα
 * του έκρυβε τις άλλες πέντε. Γι' αυτό ο έλεγχος bypass είναι **πρώτος**, και
 * γίνεται με το υπάρχον `isRoleBypass()` — **ΠΟΤΕ** χειρόγραφο
 * `globalRole === 'super_admin'` (θα ήταν έβδομο λεξιλόγιο ρόλων).
 * ─────────────────────────────────────────────────────────────────────────────
 * ΟΝΟΜΑΤΟΛΟΓΙΑ (Ε6.στ, Π-9): `Job` = ΔΟΥΛΕΙΑ. `Workspace` = ΟΡΓΑΝΙΣΜΟΣ.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-748-role-based-workspaces.md §9/Ε-5
 * @see src/config/jobs-registry.ts — τα δεδομένα· εδώ ζει μόνο η λογική
 * @see src/config/jobs-visibility.ts — η **ορατότητα** («τι δείχνει η ενεργή
 *      δουλειά»). Χωρίστηκε στη Φάση 3.6: ήταν δεύτερη ερώτηση σε ίδιο αρχείο,
 *      με δικό της τμήμα ήδη — και το αρχείο είχε φτάσει 497/500.
 * @see src/lib/asset-packs/asset-pack-access.ts — το πρότυπο (ADR-655)
 */

import { JOBS, JOB_ORDER, type JobId } from './jobs-registry';

// =============================================================================
// ΤΑΥΤΟΤΗΤΑ
// =============================================================================

/**
 * «Καμία ενεργή δουλειά» = δείξε τα πάντα, ακριβώς όπως σήμερα.
 *
 * Είναι η **προεπιλογή** και αντιγράφει συνειδητά το πιο πετυχημένο σημείο της
 * Φάσης 2 (`RIBBON_SPECIALTY_ALL`): υπάρχων χρήστης δεν βλέπει **καμία** αλλαγή
 * μέχρι να γυρίσει **ο ίδιος** τον διακόπτη (Α-1, Α-3).
 */
export const JOB_ALL = 'all' as const;

/** Ό,τι μπορεί να είναι «ενεργό»: μία από τις έξι, ή «Όλα». */
export type JobSelection = JobId | typeof JOB_ALL;

/** Οι τρεις πηγές δικαιωμάτων του Π-15, ως ταυτότητες. */
export type PermissionSourceId = 'globalRole' | 'projectRoles' | 'permissionSets';

/** Η σειρά είναι σταθερή για να είναι σταθερά και τα μηνύματα του Υ-6. */
export const PERMISSION_SOURCE_ORDER: readonly PermissionSourceId[] = [
  'globalRole',
  'projectRoles',
  'permissionSets',
] as const;

/**
 * Η **είσοδος** του υπολογισμού. Ό,τι ξέρουμε τη στιγμή της ερώτησης — και,
 * εξίσου σημαντικό, **τι δεν ξέρουμε**.
 */
export interface JobAccessInput {
  /**
   * Η **ένωση** των permissions από όσες πηγές είναι διαθέσιμες (Ε1.ζ).
   * Ποτέ αποθηκευμένη λίστα δουλειών — μόνο ωμά permissions (Ε5.α).
   */
  readonly permissions: readonly string[];
  /** `isRoleBypass(globalRole)` — υπολογισμένο από τον καλούντα, όχι εδώ. */
  readonly isBypass: boolean;
  /**
   * Ποιες πηγές **απάντησαν πραγματικά**. Πηγή που λείπει ⇒ `unknown`, όχι
   * `none`. Σήμερα στον browser: `globalRole` μόνο.
   */
  readonly availableSources: readonly PermissionSourceId[];
}

/** Γιατί βγήκε η απόφαση — το υλικό του Υ-6 (αλυσίδα αιτίασης). */
export type JobAccessReason =
  /** Ρόλος bypass (super_admin): τα βλέπει όλα εξ ορισμού (Ε4.ε). */
  | { readonly kind: 'bypass' }
  /** Το συγκεκριμένο permission που τη γέννησε. */
  | { readonly kind: 'permission'; readonly permission: string }
  /** Δεν ξέρουμε: αυτές οι πηγές δεν απάντησαν. */
  | { readonly kind: 'sources-unavailable'; readonly missing: readonly PermissionSourceId[] }
  /** Όλες οι πηγές απάντησαν και καμία δεν τη στηρίζει. */
  | { readonly kind: 'no-permission' };

export type JobAccessDecision = 'granted' | 'unknown' | 'none';

export interface JobAccess {
  readonly job: JobId;
  readonly decision: JobAccessDecision;
  readonly reason: JobAccessReason;
}

// =============================================================================
// Η ΑΠΟΦΑΣΗ
// =============================================================================

/** Οι πηγές που δεν απάντησαν — σταθερή σειρά (PERMISSION_SOURCE_ORDER). */
function missingSources(
  available: readonly PermissionSourceId[],
): readonly PermissionSourceId[] {
  return PERMISSION_SOURCE_ORDER.filter((source) => !available.includes(source));
}

/**
 * Σειρά ελέγχων — **η σειρά είναι ο μηχανισμός**, μην την αλλάξεις:
 *
 *   1. **bypass** πρώτα. Ο `super_admin` έχει `permissions: []` (roles.ts:58):
 *      κάθε άλλος έλεγχος θα του έκρυβε τα πάντα πλην Διαχείρισης.
 *   2. **μετρημένο permission** ⇒ `granted`, με το permission ως αιτία (Υ-6).
 *   3. **ελλιπείς πηγές** ⇒ `unknown`. ΠΟΤΕ `none` όταν κάποιος δεν ρωτήθηκε:
 *      «κανείς δεν κοίταξε» ≠ «δεν υπάρχει» (ο κανόνας N.12, ως κώδικας).
 *   4. αλλιώς ⇒ `none`.
 */
export function decideJobAccess(job: JobId, input: JobAccessInput): JobAccess {
  if (input.isBypass) {
    return { job, decision: 'granted', reason: { kind: 'bypass' } };
  }

  const matched = JOBS[job].permissions.find((permission) =>
    input.permissions.includes(permission),
  );
  if (matched !== undefined) {
    return { job, decision: 'granted', reason: { kind: 'permission', permission: matched } };
  }

  const missing = missingSources(input.availableSources);
  if (missing.length > 0) {
    return { job, decision: 'unknown', reason: { kind: 'sources-unavailable', missing } };
  }

  return { job, decision: 'none', reason: { kind: 'no-permission' } };
}

/** Και οι έξι, στη σταθερή σειρά του μητρώου (JOB_ORDER). */
export function resolveJobAccess(input: JobAccessInput): readonly JobAccess[] {
  return JOB_ORDER.map((job) => decideJobAccess(job, input));
}

/**
 * Ό,τι **δεν κρύβεται**: `granted` ∪ `unknown`.
 *
 * 🔒 Η καρδιά του κανόνα. Το `unknown` μένει μέσα επειδή η απόκρυψή του θα
 * έκρυβε δουλειά που ο χρήστης **δικαιούται** μέσω πηγής που ο browser δεν
 * ρώτησε ποτέ (Ε14.ζ). Καμία δουλειά δεν επινοείται — το `none` φεύγει.
 */
export function resolveAvailableJobs(input: JobAccessInput): readonly JobId[] {
  return resolveJobAccess(input)
    .filter((access) => access.decision !== 'none')
    .map((access) => access.job);
}

/**
 * Ε7.δ — «πάντα υπάρχει προεπιλογή» (κανόνας Revit: *if you do not select a
 * discipline, an appropriate default is used*).
 *
 * Κριτήριο: η δουλειά με τα **περισσότερα μετρημένα** δικαιώματα· σε ισοβαθμία,
 * η σταθερή σειρά του μητρώου. **Υπολογισμένη, ποτέ hardcoded.**
 *
 * ⚠️ Επιστρέφει `JOB_ALL` όταν δεν υπάρχει καμία διαθέσιμη — και **αυτό είναι η
 * απάντηση, όχι αποτυχία**: «μηδέν δουλειές» παύει να υπάρχει ως κατάσταση
 * (Ε7.α/Υ-10). Κανείς δεν βλέπει ποτέ κενή οθόνη επειδή δεν τον ρώτησε κανείς.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ADR-798 Φάση 3 — ΤΟ `tiebreak`: **ΣΠΑΕΙ ΙΣΟΒΑΘΜΙΑ, ΔΕΝ ΔΙΕΥΡΥΝΕΙ ΣΥΝΟΛΟ**
 *
 * 🔴 Το κενό που κλείνει, ονομασμένο: ένας **τοπογράφος** και ένας **δικηγόρος**
 * με **ταυτόσημα** permissions έπαιρναν **ταυτόσημη** προεπιλογή, και ο νικητής
 * έβγαινε από τη **σειρά του πίνακα** — δηλαδή από τίποτα.
 *
 * 🔒 **ΤΡΕΙΣ ΔΟΜΙΚΕΣ ΕΓΓΥΗΣΕΙΣ, ΚΑΙ ΚΑΜΙΑ ΔΕΝ ΕΙΝΑΙ ΣΥΜΒΑΣΗ:**
 *
 *   1. Το `available` υπολογίζεται **πριν** και **χωρίς** το `tiebreak`, από
 *      permissions και μόνο. Το επάγγελμα **δεν μπορεί** να προσθέσει δουλειά:
 *      αν το `tiebreak` δεν είναι μέλος του `available`, ο βρόχος δεν το
 *      συναντά ποτέ. **Αυτο-δηλωμένη ιδιότητα που διεύρυνε το σύνολο θα ήταν
 *      κλιμάκωση προνομίων με ένα dropdown** (Α4 · NIST SP 800-63 IAL1).
 *   2. Ο έλεγχος ισοβαθμίας είναι `===`, **ποτέ `>=`**: δουλειά με **λιγότερα**
 *      μετρημένα δικαιώματα δεν κερδίζει επειδή ταιριάζει με το επάγγελμα. Η
 *      μέτρηση προηγείται πάντα της δήλωσης.
 *   3. Παράλειψη του ορίσματος ⇒ **γραμμή προς γραμμή η παλιά συμπεριφορά**.
 *      Γι' αυτό είναι **προαιρετικό**: κανένας υπάρχων καλών δεν αλλάζει.
 *
 * ⛔ **ΜΗΝ** το μεταφέρεις μέσα στο `resolveAvailableJobs()` — εκεί θα ήταν
 * πηγή δικαιώματος. ⛔ **ΜΗΝ** εισαγάγεις εδώ το `isco-job-affinity.ts`: αυτό
 * το αρχείο **δεν ξέρει καν** ότι υπάρχει επάγγελμα, και αυτή η άγνοια **είναι**
 * η εγγύηση #1. Ο καλών λύνει τη συγγένεια και περνά έτοιμο `JobId`.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @param tiebreak Η δουλειά που **προτιμάται σε ισοβαθμία** — π.χ. αυτή που
 *   υποδεικνύει το δηλωμένο επάγγελμα. `null`/παράλειψη ⇒ καμία προτίμηση.
 */
export function pickDefaultJob(
  input: JobAccessInput,
  tiebreak?: JobId | null,
): JobSelection {
  const available = resolveAvailableJobs(input);
  if (available.length === 0) return JOB_ALL;

  // ───────────────────────────────────────────────────────────────────────────
  // ADR-798 Φάση 3 (διόρθωση 2026-08-25) — ΤΟ BYPASS ΔΕΝ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ ΔΙΚΑΙΩΜΑ
  //
  // 🔴 Το ελάττωμα, μετρημένο ζωντανά: ο `super_admin` έχει
  // `PREDEFINED_ROLES.super_admin.permissions = []` (roles.ts:58), αλλά το
  // `useEffectivePermissions:91-93` του προσθέτει **πάντα** `admin_access` —
  // **σωστά**, το χρειάζεται για **ορατότητα**. Παρασιτικά όμως το
  // `admin_access` ζει σε **ακριβώς μία** από τις έξι δουλειές
  // (`jobs-registry.ts`, Διαχείριση) ⇒ σκορ `{administration: 1, άλλες: 0}`
  // ⇒ **μοναδικός νικητής** ⇒ ο έλεγχος ισοβαθμίας παρακάτω **δεν εκτελείται
  // ΠΟΤΕ**. Αποτέλεσμα: δηλωμένος μηχανικός (ISCO 2149 → πρόθεμα 214 → Σχέδιο)
  // προσγειωνόταν στη **Διαχείριση**, με το `tiebreak` να φτάνει σωστά και να
  // αγνοείται. Μετρημένο **0 στους 4** ζωντανούς λογαριασμούς μπορούσαν να το
  // πυροδοτήσουν ⇒ **αδρανής φρουρός** (ADR-749 §5).
  //
  // 🔑 Η ΑΣΥΜΦΩΝΙΑ ΗΤΑΝ ΜΕΣΑ ΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ: το `decideJobAccess` ξεχωρίζει
  // ρητά `{kind:'bypass'}` από `{kind:'permission'}` — το σχόλιό του λέει
  // «**μετρημένο** permission ⇒ granted». Το `pickDefaultJob` δεν ρωτούσε, και
  // μετρούσε ωμά το `input.permissions`. **Δύο συναρτήσεις, ένα αρχείο, δύο
  // απαντήσεις στο ίδιο ερώτημα** — σχήμα ADR-749 σε μικρογραφία.
  //
  // 🔒 ΔΕΝ ΠΑΡΑΒΙΑΖΕΙ ΤΟ Α4 («το επάγγελμα ΠΟΤΕ δεν δίνει δικαίωμα»): το
  // `available` υπολογίζεται **πριν** και **χωρίς** αυτό, και ο bypass χρήστης
  // έχει **ήδη και τις έξι**. Το `tiebreak` διαλέγει **ανάμεσα σε όσες ήδη
  // δικαιούται** — καμία διεύρυνση, ούτε μία δουλειά παραπάνω.
  //
  // ⛔ ΜΗΝ το «απλοποιήσεις» σε `input.permissions`: τότε το `admin_access`
  // ξαναγίνεται σιωπηλή προεπιλογή «Διαχείριση» για **κάθε** υπερδιαχειριστή.
  // ───────────────────────────────────────────────────────────────────────────
  const counted: readonly string[] = input.isBypass ? [] : input.permissions;

  let best: JobId = available[0];
  let bestScore = -1;
  for (const job of available) {
    const score = JOBS[job].permissions.filter((permission) =>
      counted.includes(permission),
    ).length;
    // Αυστηρό `>`: η ισοβαθμία κρατά τον πρώτο κατά JOB_ORDER (Ε7.δ).
    if (score > bestScore) {
      best = job;
      bestScore = score;
      continue;
    }
    // ADR-798 Φάση 3 — **μόνο** πάνω σε ισοβαθμία, και **μόνο** για μέλος του
    // `available`: εδώ ο τοπογράφος παύει να παίρνει την απάντηση του δικηγόρου.
    if (score === bestScore && job === tiebreak) {
      best = job;
    }
  }
  return best;
}

