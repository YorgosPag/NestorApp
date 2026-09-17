/**
 * =============================================================================
 * «ΓΙΑΤΙ ΕΙΝΑΙ ΜΕΛΟΣ;» — Η ΠΡΟΕΛΕΥΣΗ ΤΟΥ ΕΓΓΡΑΦΟΥ ΜΕΛΟΥΣ ΕΡΓΟΥ (ADR-862 Φ0 Β14)
 * =============================================================================
 *
 * Κάθε έγγραφο `companies/{W}/projects/{P}/members/{mbr_…}` λέει **πώς γεννήθηκε**.
 *
 * 🌐 Οι μεγάλοι (Procore Project Directory · ACC project members · ProjectWise work
 * area participants) κάνουν τον δημιουργό μέλος **αυτόματα**, αλλά η οθόνη τους δεν
 * λέει **γιατί** κάποιος είναι μέλος: ο αυτόματος διαχειριστής και ο ρητά προσθεμένος
 * φαίνονται ίδιοι. Εδώ η απάντηση **ζει στο έγγραφο**, ώστε ένας έλεγχος πρόσβασης
 * (ISO 27001 A.5.18 «access rights review») να μη χρειάζεται αρχαιολογία στα logs.
 *
 * ⚠️ **ΠΛΗΡΟΦΟΡΙΑ, ΟΧΙ ΕΞΟΥΣΙΟΔΟΤΗΣΗ.** Κανένας κριτής δεν διαβάζει αυτό το πεδίο για
 * να αποφασίσει. Γι' αυτό ο αναγνώστης το μεταφράζει **ανεκτικά** (άγνωστο ⇒ απόν),
 * σε αντίθεση με το `cdeAudience`/`taskTeamId`, που είναι αυστηρά.
 *
 * @module types/project-member-enrollment
 * @see lib/auth/project-member-write — ο ΕΝΑΣ γραφέας
 * @see lib/auth/project-staffing-policy — η πολιτική που γεννά το `creator`
 */

/**
 * - `creator`  — έγινε μέλος **στη γέννηση** του έργου, ως δημιουργός του (ατομικά).
 * - `manual`   — τον πρόσθεσε **άνθρωπος** από τη διαχείριση ρόλων.
 * - `backfill` — γράφτηκε από τη **μετανάστευση** για έργο γεννημένο πριν το Β14.
 */
export type ProjectMemberEnrollment = 'creator' | 'manual' | 'backfill';

/** Ο **ΕΝΑΣ** κατάλογος — κάθε αγκύρωση και κάθε φρουρός διαβάζουν από εδώ. */
export const PROJECT_MEMBER_ENROLLMENTS: readonly ProjectMemberEnrollment[] = [
  'creator',
  'manual',
  'backfill',
] as const;

/** Στενεύει `unknown → ProjectMemberEnrollment` για ό,τι έρχεται από τη βάση. */
export function isProjectMemberEnrollment(value: unknown): value is ProjectMemberEnrollment {
  return (
    typeof value === 'string' &&
    (PROJECT_MEMBER_ENROLLMENTS as readonly string[]).includes(value)
  );
}
