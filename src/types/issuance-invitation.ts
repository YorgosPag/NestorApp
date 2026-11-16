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
import type { EnergyClass } from '@/constants/energy-classes';
import type { AdvanceStateKind, AdvanceTerms } from '@/lib/document-validity/issuance-advance';
import type { QuoteTerms } from '@/lib/document-validity/issuance-quote';
import type { CheckoutLaunch, InvoiceCheckoutAttemptResponse, OnlinePaymentMethod } from '@/subapps/accounting/types/online-payment';
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
 * ποτέ email/τηλέφωνο τρίτων, και ΑΦΜ τρίτων **μόνο** ως τελευταία ψηφία (§45.15, μόνο στον υπεύθυνο). Ο επαγγελματίας
 * **δεν** βλέπει τον ιδιοκτήτη (το έργο του το κανονίζει το γραφείο).
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
  /**
   * §42 — **τι ζητά η σελίδα**: `give-quote` (επαγγελματίας, αίτημα προσφοράς) · `approve-quote` (υπεύθυνος, κρίνει
   * πρόσωπο **και** τιμή) · `legacy-accept` (παλιά ανάθεση §27: «Αναλαμβάνω/Αρνούμαι» χωρίς τιμή).
   */
  readonly step: IssuanceLinkStep;
  /** §42 — ο φάκελος προσφοράς· **μόνο** για τον επαγγελματία. */
  readonly brief: IssuanceQuoteBrief | null;
  /** §42 — η προσφορά προς έγκριση· **μόνο** για τον υπεύθυνο. */
  readonly quote: IssuanceQuoteView | null;
  /**
   * §45.15 — οι ιδιοκτήτες για επιβεβαίωση· **μόνο** στο `approve-quote`. `null` = δεν ζητείται (άλλο βήμα) ή δεν
   * διαβάστηκαν τώρα — η σελίδα τότε δεν ζητά τεκμήριο, ποτέ δεν λέει «κανένας ιδιοκτήτης».
   */
  readonly owners: readonly IssuanceLinkOwnerView[] | null;
}

/**
 * §45.15 — ένας ιδιοκτήτης όπως τον βλέπει ο υπεύθυνος στη σελίδα έγκρισης. Το ΑΦΜ **τρίτου** φτάνει μόνο ως τα
 * τελευταία ψηφία (ιδιωτικότητα εκ σχεδιασμού)· ολόκληρο μόνο το δικό του (`self`).
 */
export interface IssuanceLinkOwnerView {
  readonly contactId: string;
  readonly name: string | null;
  /** Είναι ο ίδιος ο παραλήπτης του συνδέσμου. */
  readonly self: boolean;
  readonly vat: IssuanceLinkOwnerVat;
}

export type IssuanceLinkOwnerVat =
  | { readonly kind: 'none' }
  | { readonly kind: 'masked'; readonly tail: string }
  | { readonly kind: 'full'; readonly value: string };

export type IssuanceLinkStep = 'give-quote' | 'approve-quote' | 'legacy-accept';

/**
 * §42 — **ο φάκελος προσφοράς**: κλειστή λίστα, ό,τι χρειάζεται η τιμή — ποτέ ιδιοκτήτης, επαφές ή ακριβής διεύθυνση.
 * Κάθε πεδίο `null` = δεν δηλώθηκε.
 */
export interface IssuanceQuoteBrief {
  readonly grossAreaSqm: number | null;
  readonly floor: number | null;
  readonly constructionYear: number | null;
  readonly energyClass: EnergyClass | null;
  /** Ως πότε ισχύει το τρέχον ΠΕΑ (`YYYY-MM-DD`). */
  readonly energyValidUntil: string | null;
}

/** §42 — η προσφορά όπως τη βλέπει ο υπεύθυνος: οι όροι, η αναθεώρηση, και το σύνολο της αρχικής (αν αναθεωρήθηκε). */
export interface IssuanceQuoteView extends QuoteTerms {
  readonly revision: number;
  readonly previousTotalMinor: number | null;
  /**
   * §45 — η ημέρα που η συναλλαγή του ακινήτου **χρειάζεται** το έγγραφο (`issuanceSigningDayOf`, από το ΙΔΙΟ μητρώο με την
   * οθόνη του γραφείου)· `null` = δεν μπλοκάρει τίποτα. Ο υπεύθυνος βλέπει «μετά την υπογραφή» **πριν** εγκρίνει.
   */
  readonly signingDay: string | null;
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

/**
 * ADR-943 §5.9 — **η πληρωμή της προκαταβολής**, όπως τη βλέπει ο υπεύθυνος με τον σύνδεσμο που **ενέκρινε**: οι όροι
 * (ποσό · πολιτική · αξία αυτοψίας — ο πίνακας ακύρωσης παράγεται από αυτούς στον client, από τους ίδιους κανόνες),
 * πού βρίσκεται τώρα η προκαταβολή, και αν μπορεί να πληρωθεί (τρόποι · ο μηχανικός δέχεται πληρωμές).
 */
export interface IssuanceAdvancePaymentView {
  readonly recipientName: string | null;
  readonly officeName: string | null;
  readonly propertyLabel: string | null;
  readonly documentKind: DocumentKind;
  readonly professionalName: string | null;
  readonly advance: AdvanceTerms;
  readonly state: AdvanceStateKind;
  /** Οι τρόποι που δέχεται ο λογαριασμός για πληρωμή **marketplace** — κενό ⇒ καμία online πληρωμή προκαταβολής. */
  readonly methods: readonly OnlinePaymentMethod[];
  /** Ο μηχανικός δέχεται πληρωμές (δικαιούχος `authorized`, όπως τον ξέρουμε) — αλλιώς «περιμένουμε τον μηχανικό». */
  readonly payeeReady: boolean;
}

/**
 * Η απάντηση του `GET /api/issuance-link`: ανοιχτή όψη (σύνδεσμος χωρίς κωδικό) ή η πύλη του κωδικού — και (ADR-943
 * §5.9) μετά την **έγκριση με προκαταβολή**, το βήμα της πληρωμής με τον ίδιο σύνδεσμο.
 */
export type IssuanceLinkLanding =
  | { readonly access: 'open'; readonly view: IssuanceLinkView }
  | { readonly access: 'code-required'; readonly gate: IssuanceLinkGateView }
  | { readonly access: 'advance'; readonly advance: IssuanceAdvancePaymentView };

/** Τι ξεκλειδώνει ο κωδικός (§29): την όψη της απάντησης, ή (ADR-943) την πληρωμή της προκαταβολής. */
export type IssuanceLinkUnlocked =
  | { readonly view: IssuanceLinkView }
  | { readonly advance: IssuanceAdvancePaymentView };

/** Το σώμα του `POST /api/issuance-link/advance-checkout` — **ποτέ** ποσό· το ρητό αίτημα έναρξης ως δύο `true` (Κ-6). */
export interface IssuanceAdvanceCheckoutBody {
  readonly method: OnlinePaymentMethod;
  readonly locale: 'el' | 'en';
  /** «Ζητώ να ξεκινήσει η εργασία μέσα στις 14 ημέρες υπαναχώρησης» (ν.2251/1994 3ι §4 α ii). */
  readonly startRequested: true;
  /** «Αναγνωρίζω ότι χάνω το δικαίωμα υπαναχώρησης όταν η υπηρεσία παρασχεθεί πλήρως» (3ιβ (α)). */
  readonly acknowledgesWithdrawalLoss: true;
  readonly accessCode: string | null;
}

/**
 * Οι αρνήσεις της έναρξης πληρωμής προκαταβολής (πέρα από του συνδέσμου):
 * - `not-payable` — η προκαταβολή δεν περιμένει πληρωμή (πληρώθηκε · καμία · άλλαξε η ανάθεση)·
 * - `payee-not-ready` — ο μηχανικός δεν δέχεται ακόμη πληρωμές (ειδοποιείται)·
 * - `method-unavailable` — ο λογαριασμός δεν έχει marketplace ή τον τρόπο·
 * - `provider-unavailable` — ο πάροχος αρνήθηκε την έναρξη (ξαναδοκιμάστε).
 */
export const ISSUANCE_ADVANCE_CHECKOUT_REFUSALS = ['not-payable', 'payee-not-ready', 'method-unavailable', 'provider-unavailable'] as const;
export type IssuanceAdvanceCheckoutRefusal = (typeof ISSUANCE_ADVANCE_CHECKOUT_REFUSALS)[number];

/** Η έκβαση μιας απόπειρας προκαταβολής — το ίδιο σχήμα με του τιμολογίου (ADR-ACC-030 §5.6), χωρίς την επίσκεψη. */
export type IssuanceAdvanceAttemptResponse =
  | Extract<InvoiceCheckoutAttemptResponse, { status: 'ok' }>
  | { readonly status: 'refused'; readonly reason: 'unknown-attempt' };

export type IssuanceAdvanceCheckoutResult =
  | { readonly status: 'started'; readonly checkoutId: string; readonly launch: CheckoutLaunch }
  | { readonly status: 'refused'; readonly reason: IssuanceAdvanceCheckoutRefusal };

/**
 * Οι αρνήσεις του συνδέσμου πέρα από τις κοινές της πρόσκλησης:
 * - `superseded` — ο σύνδεσμος δεν είναι πια ο τρέχων (νέα αποστολή · νέα πρόταση · ακύρωση · απαντήθηκε από το γραφείο)·
 * - `lead-changed` — ο υπεύθυνος ιδιοκτήτης άλλαξε από την αποστολή·
 * - `answer-mismatch` — απάντηση άλλου ακροατηρίου (π.χ. «αποδέχομαι» σε σύνδεσμο έγκρισης)·
 * - `code-required` · `code-wrong` · `code-locked` — §29: λείπει ο κωδικός · λάθος (μετρά) · κλείδωσε μετά από 5 λάθη.
 * - `owners-changed` — §45.15: οι ιδιοκτήτες άλλαξαν ανάμεσα στην όψη και την έγκριση· καμία βεβαίωση για όσους δεν είδε.
 */
export const ISSUANCE_LINK_REFUSALS = ['superseded', 'lead-changed', 'answer-mismatch', 'code-required', 'code-wrong', 'code-locked', 'owners-changed'] as const;
export type IssuanceLinkRefusal = (typeof ISSUANCE_LINK_REFUSALS)[number];

/**
 * §39 — **ο χώρος της ανάθεσης** μετά το «Αναλαμβάνω», όπως τον βλέπει η σελίδα του συνδέσμου:
 * - `invited`     — εκδόθηκε πρόσκληση σε λογαριασμό· `href` = η σελίδα της (`/case-invite/[token]`)
 * - `no-project`  — το ακίνητο δεν ανήκει σε έργο ⇒ κανένας χώρος ακόμη (ίδια συμπεριφορά με τη μεταβίβαση)
 * - `no-authority` — το προσόν της ανάθεσης δεν δηλώνει μητρώο ⇒ κανένας χώρος (ποτέ μαντεψιά μητρώου)
 * - `none`        — η απάντηση δεν ανοίγει χώρο (άρνηση · έγκριση ιδιοκτήτη)
 */
export type IssuanceSpaceView =
  | { readonly kind: 'invited'; readonly href: string }
  | { readonly kind: 'no-project' }
  | { readonly kind: 'no-authority' }
  | { readonly kind: 'none' };

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
