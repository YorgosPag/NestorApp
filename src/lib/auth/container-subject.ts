/**
 * =============================================================================
 * Ο ΚΑΛΩΝ ΤΟΥ ΚΡΙΤΗ — ποιος γεμίζει το υποκείμενο (ADR-862 Φ0 Β7)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Ποιος είναι αυτός ο άνθρωπος **μέσα σε αυτή την υπόθεση**;»*
 * **Η απάντηση**: ταυτότητα από το **token**, ομάδα και ακροατήριο από τον
 * **διακομιστή**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΑΥΘΕΝΤΙΑ ΕΙΝΑΙ Η ΑΝΑΖΗΤΗΣΗ, ΟΧΙ ΤΟ TOKEN ΚΑΙ ΟΧΙ Ο ΠΕΛΑΤΗΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο κριτής του Β5 (`lib/auth/container-access.ts`) είναι **καθαρός και
 * σύγχρονος**: δεν διαβάζει, επίτηδες — αλλιώς θα γινόταν `async`+`server-only`
 * και ο πελάτης θα **έχανε** τον έναν PEP του. Άρα τα γεγονότα της ομάδας πρέπει
 * να τα φέρει **κάποιος**. Αυτός είναι αυτό το αρχείο.
 *
 * 🌐 **Είναι το πρότυπο, όχι ιδιοτροπία**: το **AuthZEN 1.0 §5.1.1** γράφει ότι
 * *«many authorization systems are stateless, and expect the **client (PEP)** to
 * pass in any properties or attributes that are expected to be used in the
 * evaluation»*· τα *contextual tuples* του **OpenFGA** είναι ακριβώς αυτό —
 * γεγονότα **περασμένα** στο ερώτημα, έγκυρα μόνο γι' αυτό.
 *
 * ⛔ **ΚΑΙ ΓΙ' ΑΥΤΟ Η ΟΜΑΔΑ ΔΕΝ ΜΠΑΙΝΕΙ ΣΤΟ CLAIM.** Η τεκμηρίωση του OpenFGA το
 * λέει κατάμουτρα για token claims ως contextual tuples: *«access will continue
 * until token expiration even if the underlying claims like group membership
 * change»*. Ομάδα στο claim = μετακίνηση μηχανικού σε άλλη ομάδα που **δεν
 * ισχύει** μέχρι να λήξει το token — δηλαδή ξένο WIP ορατό, με υπογραφή.
 *
 * ⚠️ **ΚΑΙ ΟΧΙ ΤΟ `cdeTeamId` ΤΟΥ ΑΡΧΕΙΟΥ.** Εκείνο το γράφει ο **πελάτης** στη
 * δημιουργία (`file-record.service.ts` — client SDK) και οι κανόνες του Β4 το
 * **επιτρέπουν** ρητά ως *υπόδειξη*. Υπόδειξη διαβασμένη ως ταυτότητα είναι
 * αυτο-ανακήρυξη σε ομάδα: *«δηλώνω ότι ανήκω στη δική μου»*.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΕΙΣ ΑΠΟΥΣΙΕΣ, ΤΡΕΙΣ ΑΠΑΝΤΗΣΕΙΣ — ΠΟΤΕ ΙΣΟΠΕΔΩΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * |  Τι λείπει | Τι σημαίνει | Τι δίνει |
 * |---|---|---|
 * | το αρχείο **δεν έχει έργο** | δεν είναι δοχείο υπόθεσης | `audience: null` ⇒ `pre-cde` **όπως σήμερα**, κάθε κατάσταση CDE ⇒ ⛔ |
 * | **δεν υπάρχει** έγγραφο μέλους | δεν συμμετέχει | `audience: null` ⇒ `denied-not-engaged` |
 * | μέλος **χωρίς** `cdeAudience` | συμμετέχει ως μελετητής | `'design'` *(δηλωμένο όριο 3)* |
 * | μέλος με **ακατάληπτο** ακροατήριο/ομάδα | το έγγραφο είναι χαλασμένο | `unknown` — ⛔ **ποτέ** `'design'` |
 * | η βάση **δεν απάντησε** | δεν ξέρουμε | `unknown` ⇒ ο καλών **δεν κρίνει** |
 *
 * Η ισοπέδωση της 2ης με την 3η θα έδινε δικαιώματα **μελετητή** σε όποιον
 * **δεν είναι μέλος** — το ακριβώς αντίστροφο του φρουρού. Η ισοπέδωση της 4ης
 * με τη 2η θα έλεγε «δεν συμμετέχεις» σε μέλος, επειδή έπεσε το δίκτυο (N.12).
 *
 * @module lib/auth/container-subject
 * @see lib/auth/container-access — ο κριτής που καταναλώνει το υποκείμενο
 * @see lib/auth/project-member-read — η **αυθεντία** της ομάδας
 * @see ADR-862 Φ0 Β7 · ADR-801 §7 · AuthZEN 1.0 §5.1.1
 */

import 'server-only';

import type { ContainerSubject } from '@/types/container-access';

import {
  readProjectMember,
  type ProjectMemberRead,
} from './project-member-read';
import type { AuthContext } from './types';

// =============================================================================
// ΤΟ ΕΡΩΤΗΜΑ ΚΑΙ Η ΕΚΒΑΣΗ
// =============================================================================

export interface ContainerSubjectQuery {
  /** Η **ήδη επαληθευμένη** ταυτότητα (`withAuth`). */
  readonly caller: AuthContext;
  /**
   * Η υπόθεση, **από το έγγραφο του πόρου** (`FileRecord.projectId`).
   *
   * ⚠️ **Προαιρετικό επειδή ΕΙΝΑΙ** — μετρημένο 2026-09-16: **13 από 35** ζωντανά
   * αρχεία έχουν `projectId`. Τα υπόλοιπα **22** δεν είναι δοχεία υπόθεσης, και
   * είναι **όλα** `pre-cde` ⇒ η σημερινή ορατότητα μένει ακέραιη. ⛔ ΜΗΝ το
   * δεχτείς από σώμα αιτήματος: ο αιτών θα διάλεγε **σε ποια υπόθεση** είναι μέλος.
   */
  readonly projectId?: string | null;
  /**
   * Ζήτησε **ΡΗΤΑ** το ιστορικό; Προεπιλογή `false`.
   * ⛔ ΠΟΤΕ `true` από προεπιλογή — δες {@link ContainerSubject.historyRequested}.
   */
  readonly historyRequested?: boolean;
  /** Ανά-αίτημα απομνημόνευση της αναζήτησης μέλους. */
  readonly cache?: Map<string, ProjectMemberRead>;
}

/**
 * ⚠️ **Ονομασμένη ένωση, ποτέ «υποκείμενο με κενά»**: ένα υποκείμενο που
 * κατασκευάστηκε **χωρίς να ρωτηθεί** η βάση θα ταξίδευε στον κριτή ως
 * *«κανονικός άνθρωπος χωρίς ομάδα»* — δηλαδή μια **βλάβη** θα διαβαζόταν ως
 * **απάντηση πολιτικής**, και ο άνθρωπος θα έβλεπε «δεν συμμετέχεις».
 */
export type ContainerSubjectBuild =
  | { readonly outcome: 'subject'; readonly subject: ContainerSubject }
  | { readonly outcome: 'unknown'; readonly why: string };

// =============================================================================
// Η ΚΑΤΑΣΚΕΥΗ
// =============================================================================

/**
 * **Το υποκείμενο, με την ομάδα από τον διακομιστή.**
 *
 * @example
 * const built = await containerSubjectFor({ caller: ctx, projectId: record.projectId });
 * if (built.outcome === 'unknown') return authorityUnavailable();
 * const decision = decideContainerAccess({ subject: built.subject, facts, action });
 */
export async function containerSubjectFor(
  query: ContainerSubjectQuery,
): Promise<ContainerSubjectBuild> {
  const { caller, projectId, historyRequested = false, cache } = query;

  const identity = {
    uid: caller.uid,
    globalRole: caller.globalRole,
    permissions: caller.permissions,
    companyId: caller.companyId,
    historyRequested,
  } as const;

  // ── Αρχείο χωρίς υπόθεση ⇒ δεν υπάρχει ομάδα να βρεθεί ────────────────────
  // ⚠️ **Ρωτήσαμε και δεν υπάρχει έργο** — άλλο από «δεν μπορέσαμε να ρωτήσουμε».
  if (projectId === undefined || projectId === null || projectId.trim().length === 0) {
    return { outcome: 'subject', subject: { ...identity, taskTeamId: null, audience: null } };
  }

  const read = await readProjectMember({
    companyId: caller.companyId,
    projectId,
    uid: caller.uid,
    ...(cache === undefined ? {} : { cache }),
  });

  // 🔴 **ΒΛΑΒΗ ΚΑΙ ΑΓΝΟΙΑ ΚΑΤΑΛΗΓΟΥΝ ΣΤΟ ΙΔΙΟ «ΔΕΝ ΚΡΙΝΩ» — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ.**
  //    Το `unreadable` (έγγραφο μέλους με ακατάληπτο ακροατήριο/ομάδα) **δεν**
  //    επιτρέπεται να πέσει στο `absent`: εκείνο σημαίνει «δεν συμμετέχει», ενώ
  //    εδώ ο άνθρωπος **είναι** μέλος και το σύστημα δεν ξέρει *τι είδους*.
  //    Και **ούτε** να συνεχίσει με προεπιλογή: η προεπιλογή είναι `'design'`,
  //    δηλαδή θα **προήγαγε** τη βλάβη σε προνόμιο.
  //    ⚠️ Ο `why` ταξιδεύει ώστε το σύρμα να λέει **ποια** από τις δύο ήταν.
  if (read.outcome === 'unknown' || read.outcome === 'unreadable') {
    return { outcome: 'unknown', why: read.why };
  }

  if (read.outcome === 'absent') {
    return { outcome: 'subject', subject: { ...identity, taskTeamId: null, audience: null } };
  }

  return {
    outcome: 'subject',
    subject: {
      ...identity,
      // ⚠️ `?? null` και **όχι** παράλειψη: ο τύπος απαιτεί ρητό `null`, ώστε ο
      //    κριτής να μη χρειαστεί ποτέ να ερμηνεύσει `undefined` (`denied-teamless`
      //    είναι **απόφαση**, όχι παράπλευρη συνέπεια απουσίας πεδίου).
      taskTeamId: read.member.taskTeamId ?? null,
      // 🔑 Δηλωμένο όριο 3 της Φ0 — **μέλος** χωρίς ακροατήριο είναι μελετητής.
      //    ⛔ Ισχύει ΜΟΝΟ επειδή φτάσαμε εδώ: το έγγραφο μέλους **υπάρχει**.
      audience: read.member.cdeAudience ?? 'design',
    },
  };
}
