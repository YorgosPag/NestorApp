/**
 * @fileoverview ADR-915 §28 — **ο σύνδεσμος της ανάθεσης έκδοσης**: το τέταρτο είδος του κοινού πυρήνα προσκλήσεων
 *   (ADR-853 §20), και το πρώτο **χωρίς λογαριασμό**.
 * @related types/invitation-core.ts (τα κοινά πεδία) · server/issuance-invitations/* · lib/document-validity/issuance-assignment.ts
 * @module types/issuance-invitation
 *
 * 🔑 Ο σύνδεσμος **δεν** κουβαλά εξουσία: η ανάθεση θυμάται ποιο `invitationId` είναι το **τρέχον** αίτημα, και ο μειωτής
 *    δέχεται μόνο αυτό (§28 Η-Β1). Το έγγραφο εδώ λέει μόνο **πού** δείχνει ο σύνδεσμος και **σε ποιον** στάλθηκε.
 *
 * **Layering**: leaf — καθαροί τύποι.
 */

import type { IssuerQualification } from '@/config/document-validity/document-issuers';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import type { IssuanceAudience } from '@/lib/document-validity/issuance-request';
import type { InvitationRecordCore, StoredAccessCode } from '@/types/invitation-core';

export interface IssuanceInvitation extends InvitationRecordCore {
  /** Το γραφείο που έστειλε — μισθωτής της ανάθεσης. */
  readonly companyId: string;
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
  /** Η ΜΙΑ ανάθεση (γραφείο, ακίνητο, είδος) στην οποία απαντά ο σύνδεσμος. */
  readonly assignmentId: string;
  /** Ο υπεύθυνος ιδιοκτήτης (έγκριση) ή ο επαγγελματίας (απάντηση) — κρίνεται από **εδώ**, ποτέ από το αίτημα. */
  readonly audience: IssuanceAudience;
  /** Η επαφή του γραφείου στην οποία στάλθηκε. */
  readonly contactId: string;
  /** §29 — ο κωδικός του δεύτερου καναλιού (HMAC + μετρητής)· `null` = ο σύνδεσμος αρκεί. */
  readonly accessCode: StoredAccessCode | null;
}

/**
 * **Η δημόσια όψη του συνδέσμου** (§28 Η-Β11) — ό,τι χρειάζεται ο άνθρωπος για να αποφασίσει, τίποτα παραπάνω: ονόματα,
 * ποτέ email/τηλέφωνο/ΑΦΜ τρίτων. Ο επαγγελματίας **δεν** βλέπει τον ιδιοκτήτη (το έργο του το κανονίζει το γραφείο).
 */
export interface IssuanceLinkView {
  readonly audience: IssuanceAudience;
  /** «Για: <όνομα>» — η σελίδα λέει σε ποιον απευθύνεται (αντιστάθμιση προώθησης, §28 Η-Β6). */
  readonly recipientName: string | null;
  readonly officeName: string | null;
  readonly propertyLabel: string | null;
  readonly documentKind: DocumentKind;
  /** Μόνο για τον ιδιοκτήτη: ποιον προτείνει το γραφείο, με το **δηλωμένο** προσόν. */
  readonly professional: {
    readonly name: string | null;
    readonly qualification: IssuerQualification;
    readonly registryNumber: string | null;
  } | null;
  readonly note: string | null;
  readonly expiresAt: string;
}

/**
 * **Τι δείχνει ο σύνδεσμος ΠΡΙΝ από τον κωδικό** (§29): μόνο σε ποιον απευθύνεται και ποιο γραφείο ζητά — όπως το
 * DocuSign, που κρύβει το έγγραφο μέχρι το access code. Ακίνητο, έγγραφο, επαγγελματίας, σημείωση: μόνο μετά.
 */
export interface IssuanceLinkGateView {
  readonly audience: IssuanceAudience;
  readonly recipientName: string | null;
  readonly officeName: string | null;
  readonly attemptsLeft: number;
}

/** Η απάντηση του `GET /api/issuance-link`: ανοιχτή όψη (σύνδεσμος χωρίς κωδικό) ή η πύλη του κωδικού. */
export type IssuanceLinkLanding =
  | { readonly access: 'open'; readonly view: IssuanceLinkView }
  | { readonly access: 'code-required'; readonly gate: IssuanceLinkGateView };

/**
 * Οι αρνήσεις του συνδέσμου πέρα από τις κοινές της πρόσκλησης:
 * - `superseded` — ο σύνδεσμος δεν είναι πια ο τρέχων (νέα αποστολή · νέα πρόταση · ακύρωση · απαντήθηκε από το γραφείο)·
 * - `lead-changed` — ο υπεύθυνος ιδιοκτήτης άλλαξε από την αποστολή·
 * - `answer-mismatch` — απάντηση άλλου ακροατηρίου (π.χ. «αποδέχομαι» σε σύνδεσμο έγκρισης)·
 * - `code-required` · `code-wrong` · `code-locked` — §29: λείπει ο κωδικός · λάθος (μετρά) · κλείδωσε μετά από 5 λάθη.
 */
export const ISSUANCE_LINK_REFUSALS = ['superseded', 'lead-changed', 'answer-mismatch', 'code-required', 'code-wrong', 'code-locked'] as const;
export type IssuanceLinkRefusal = (typeof ISSUANCE_LINK_REFUSALS)[number];

/** Ό,τι βλέπει το γραφείο πριν πατήσει «Αποστολή» (§28 Η-Β7) — ο **ίδιος** συνθέτης με το μήνυμα που φεύγει. */
export interface IssuancePreview {
  readonly audience: IssuanceAudience;
  readonly recipient: { readonly contactId: string; readonly name: string | null; readonly email: string };
  readonly subject: string;
  readonly text: string;
  /** Οι επιλέξιμοι συνιδιοκτήτες· `reachable: false` = χωρίς email (φαίνεται, δεν διαλέγεται). */
  readonly coOwners: readonly { readonly contactId: string; readonly name: string | null; readonly reachable: boolean }[];
  /** Το μήνυμα ενημέρωσης, όπως θα το δει ένας συνιδιοκτήτης — `null` όταν δεν ενημερώνεται κανείς. */
  readonly coOwnerMessage: { readonly subject: string; readonly text: string } | null;
}
