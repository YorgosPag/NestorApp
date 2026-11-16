/**
 * =============================================================================
 * «ΟΙ ΥΠΟΘΕΣΕΙΣ ΜΟΥ» — όλα τα είδη υπόθεσης σε ΜΙΑ λίστα (ADR-862 §5.3.11)
 * =============================================================================
 *
 * Ο επαγγελματίας έχει **ένα** σπίτι για κάθε συνεργασία του (μοτίβο Procore «My Projects» / ACC «Projects»):
 * υποθέσεις μεταβίβασης **και** αναθέσεις έκδοσης εγγράφου, στην ίδια λίστα, στο ίδιο URL
 * (`/o/[ws]/cases/[engagementId]` · `/engagements/[engagementId]`). Κάθε κάρτα/όψη φέρει το `kind` της — η
 * επιφάνεια διαλέγει περιεχόμενο **μόνο** από αυτό.
 *
 * @module types/my-engagements
 */

import type { DocumentKind } from '@/config/document-validity/document-validity';
import type { BallInCourtParty, IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import type { InspectionContactRole } from '@/lib/document-validity/issuance-inspection-contact';
import type { QuoteTotals } from '@/lib/document-validity/issuance-quote';
import type { ActingForView, EngagedCaseView, MyCaseCard } from '@/types/conveyance-case';
import type { DeclaredCredential, EngagementState, EngagementVerdict } from '@/types/engagement';
import type { ViewFreshness } from '@/types/server-view';

/** Η κάρτα μιας **ανάθεσης έκδοσης** — ό,τι χρειάζεται για να αποφασίσει «ανοίγω;». */
export interface MyIssuanceCard {
  readonly kind: 'document_issuance';
  readonly engagementId: string;
  readonly engagementState: EngagementState;
  readonly verdict: EngagementVerdict;
  readonly offeredAt: string;
  readonly expiresAt: string;
  readonly hostName: string | null;
  readonly propertyName: string | null;
  /** `null` ⇒ η ανάθεση δεν διαβάστηκε (η συμμετοχή δεν κρατά αντίγραφο του είδους — μία αλήθεια, η ανάθεση). */
  readonly documentKind: DocumentKind | null;
  /** Το **παραγόμενο** στάδιο της ανάθεσης — `null` αν η ανάθεση δεν διαβάστηκε. */
  readonly stage: IssuanceStage | null;
  readonly ballInCourt: BallInCourtParty | null;
  readonly actingFor: ActingForView | null;
}

export type MyEngagementCard = MyCaseCard | MyIssuanceCard;

/**
 * ADR-915 §45.15 — ο υπεύθυνος επικοινωνίας αυτοψίας που **όρισε ρητά** το γραφείο. Όνομα και τηλέφωνο είναι της
 * επαφής **τώρα** (κανένα αντίγραφο)· `phone: null` = η επαφή δεν έχει τηλέφωνο.
 */
export interface InspectionContactView {
  readonly name: string | null;
  readonly phone: string | null;
  readonly role: InspectionContactRole;
  readonly roleOther: string | null;
}

/** ADR-915 §45.15 — ένας ιδιοκτήτης του ακινήτου όπως τον ξέρει το γραφείο (όνομα · ΑΦΜ), για το έντυπο του εγγράφου. */
export interface IssuanceOwnerView {
  readonly name: string | null;
  /** `null` ⇒ το γραφείο δεν έχει ΑΦΜ για αυτόν — η όψη το λέει, ποτέ κενό σιωπηλά. */
  readonly vatNumber: string | null;
}

/**
 * ADR-915 §45.10 — **τα στοιχεία της εκτέλεσης**, μόνο όσο η ανάθεση είναι αναληφθείσα (`accepted`, μετά την έγκριση):
 * πού (η αυτοψία), για ποιον (ο ιδιοκτήτης που ενέκρινε — το όνομα μπαίνει και στο ΠΕΑ), πόσο (η συμφωνημένη
 * αναθεώρηση) και ως πότε (η τρέχουσα προθεσμία). Κάθε πεδίο `null` = «δεν δηλώθηκε / δεν διαβάστηκε», ποτέ μαντεψιά.
 * §45.15 — και **με ποιον** κλείνει την αυτοψία + **όλοι** οι ιδιοκτήτες με ΑΦΜ.
 * 🔒 Ε-9′: η πλατφόρμα δεν αποκαλύπτει ποτέ **μόνη της** κανάλι επικοινωνίας. Το μόνο τηλέφωνο εδώ είναι του υπευθύνου
 *    αυτοψίας, που το γραφείο **όρισε ρητά** για αυτόν τον σκοπό· κανένα email, κανένα κανάλι του γραφείου.
 */
export interface IssuanceAgreementView {
  readonly siteAddress: string | null;
  readonly ownerName: string | null;
  /** `null` ⇒ παλιά ανάθεση χωρίς προσφορά (§42 Π-8). */
  readonly totals: QuoteTotals | null;
  /** ISO ημέρα — `null` ⇒ καμία δέσμευση χρόνου. */
  readonly dueOn: string | null;
  /** `null` ⇒ το γραφείο δεν όρισε ακόμη υπεύθυνο αυτοψίας. */
  readonly inspectionContact: InspectionContactView | null;
  /** `null` ⇒ οι ιδιοκτήτες δεν διαβάστηκαν τώρα· `[]` ⇒ το μητρώο δεν ξέρει ιδιοκτήτη. */
  readonly owners: readonly IssuanceOwnerView[] | null;
}

/**
 * Ο **χώρος της ανάθεσης** όπως τον βλέπει ο επαγγελματίας (ADR-915 §39). 🔒 Ε-9′: **κανένα** τηλέφωνο ή email —
 * μόνο ονόματα και γεγονότα. Η παράδοση (Φ-Γ) και τα μηνύματα (Φ-Δ) προστίθενται εδώ, πάνω στο ίδιο `kind`.
 */
export interface EngagedIssuanceView {
  readonly kind: 'document_issuance';
  readonly engagementId: string;
  readonly hostName: string | null;
  readonly propertyName: string | null;
  readonly documentKind: DocumentKind;
  readonly stage: IssuanceStage;
  readonly ballInCourt: BallInCourtParty | null;
  /** Ό,τι δήλωσε ο ίδιος στην αποδοχή — «(δηλωμένο)», ποτέ «επαληθευμένο». */
  readonly credential: DeclaredCredential | null;
  /** Πότε ζήτησε το γραφείο την έκδοση — η χρονογραμμή του χώρου ξεκινά εδώ. */
  readonly proposedAt: string;
  /** ADR-915 §45.10 (Π-7) — ό,τι υποσχέθηκε η σελίδα προσφοράς «μετά την έγκριση»· `null` ⇒ ο χώρος δεν είναι σε εκτέλεση. */
  readonly agreement: IssuanceAgreementView | null;
  /**
   * Το ίδιο συμβόλαιο φρεσκάδας με την όψη της μεταβίβασης (ADR-901 §14.8). Στη Φ-Β ο χώρος δεν έχει γραφέα σήματος
   * ⇒ `revision` μένει 0 και η όψη ξαναδιαβάζεται στην αλλαγή ημέρας ή στο άνοιγμα — ρητά, όχι ξεχασμένα (ADR-915 §39).
   */
  readonly freshness: ViewFreshness;
}

export type EngagedView = EngagedCaseView | EngagedIssuanceView;
