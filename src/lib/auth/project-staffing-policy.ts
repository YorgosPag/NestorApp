/**
 * =============================================================================
 * ΠΟΙΟΣ ΜΠΑΙΝΕΙ ΣΤΟ ΕΡΓΟ ΜΟΛΙΣ ΓΕΝΝΗΘΕΙ (ADR-862 Φ0 Β14)
 * =============================================================================
 *
 * **Καθαρή συνάρτηση** — καμία ανάγνωση, κανένα `server-only`. Η πολιτική δεν ξέρει
 * **πώς** γράφεται ένα μέλος· το ξέρει ο `project-member-write`. Εδώ ζει μόνο το **ποιος**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🌐 Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ — ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΜΠΑΙΝΕΙ ΟΛΟ ΤΟ ΓΡΑΦΕΙΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * | Πλατφόρμα | Στη γέννηση του έργου |
 * |---|---|
 * | Procore | ο δημιουργός γίνεται **Admin** σε όλα τα εργαλεία του έργου· ο Company Admin **όχι** |
 * | ACC / BIM 360 | ο δημιουργός γίνεται ο **πρώτος Project Administrator**· ο account admin **δεν** είναι μέλος |
 * | ProjectWise | ο δημιουργός της work area γίνεται **Administrator**· όποιος δεν προστέθηκε ⇒ άρνηση |
 * | Trimble Connect | ο δημιουργός γίνεται **Admin** |
 *
 * ⇒ **Κανείς** από τους πέντε δεν δίνει σιωπηρή πρόσβαση σε όλο τον οργανισμό. Η ένταξη
 * του υπόλοιπου γραφείου είναι **ρητή πράξη** (Procore «Add from Company Directory»).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΟΜΑΔΑ ΕΡΓΑΣΙΑΣ ΕΙΝΑΙ Ο ΟΡΓΑΝΙΣΜΟΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το ISO 19650 ορίζει το WIP ως ορατό **μόνο** στην *task team*. Στο ACC οι φάκελοι WIP
 * δικαιοδοτούνται **ανά εταιρεία**: η ομάδα εργασίας στην πράξη **είναι** ο οργανισμός που
 * κάνει τη μελέτη. ⇒ `taskTeamId` = το `companyId` του γραφείου. Το πρόθεμα του enterprise
 * id λέει ήδη τι είδους ομάδα είναι: `comp_…` = οργανισμός· μια μελλοντική υπο-ομάδα θα
 * φέρει **δικό της** πρόθεμα — καμία ερμηνεία, καμία σύγκρουση.
 *
 * @module lib/auth/project-staffing-policy
 * @see lib/auth/project-member-write — ο ΕΝΑΣ γραφέας
 * @see ADR-862 Φ0 Β14 «Στελέχωση έργου»
 */

import type { CdeAudience } from '@/types/container-access';
import type { ProjectMemberEnrollment } from '@/types/project-member-enrollment';

/** Τα γεγονότα της γέννησης — από **επαληθευμένη** ταυτότητα, ποτέ από σώμα αιτήματος. */
export interface ProjectBirthFacts {
  /** Ο μισθωτής του έργου (`ctx.companyId`). */
  readonly companyId: string;
  readonly projectId: string;
  /** Ο δημιουργός (`ctx.uid`). */
  readonly createdBy: string;
}

/** Μία θέση στην αρχική ομάδα — **χωρίς** το «πώς γράφεται». */
export interface InitialTeamSeat {
  readonly uid: string;
  readonly roleId: string;
  readonly cdeAudience: CdeAudience;
  readonly taskTeamId: string;
  readonly enrollment: ProjectMemberEnrollment;
}

/**
 * Ο ρόλος έργου του δημιουργού.
 *
 * 🔑 `project_manager` επειδή είναι ο ρόλος του `role-catalogue.ts` που φέρει
 * `projects:projects:view` **και** τις πέντε πράξεις `iso19650:containers:*` —
 * δηλαδή το ανάλογο του «Project Admin» των μεγάλων.
 * ⚠️ **Δεν διευρύνει ποτέ την πρόσβαση**: το βήμα (8) του κριτή κρίνει από τις
 * ικανότητες του **token**. Ο ρόλος έργου απαντά «τι κάνει στο έργο», όχι «τι επιτρέπεται».
 */
export const PROJECT_CREATOR_ROLE_ID = 'project_manager';

/**
 * **Η αρχική ομάδα ενός έργου** — σήμερα: ο δημιουργός.
 *
 * ⚠️ Επιστρέφει **πίνακα** επίτηδες: η επόμενη θέση (π.χ. «υπεύθυνος έργου» όταν αποκτήσει
 * πεδίο) μπαίνει **εδώ**, και η γέννηση + η μετανάστευση την παίρνουν χωρίς αλλαγή.
 */
export function initialProjectTeam(facts: ProjectBirthFacts): readonly InitialTeamSeat[] {
  return [
    {
      uid: facts.createdBy,
      roleId: PROJECT_CREATOR_ROLE_ID,
      cdeAudience: 'design',
      taskTeamId: facts.companyId,
      enrollment: 'creator',
    },
  ];
}
