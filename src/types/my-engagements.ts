/**
 * =============================================================================
 * «ΟΙ ΥΠΟΘΕΣΕΙΣ ΜΟΥ» — όλα τα είδη υπόθεσης σε ΜΙΑ λίστα (ADR-862 §5.3.11)
 * =============================================================================
 *
 * Ο επαγγελματίας έχει **ένα** σπίτι για κάθε συνεργασία του (μοτίβο Procore «My Projects» / ACC «Projects»):
 * υποθέσεις μεταβίβασης, αναθέσεις έκδοσης εγγράφου **και** φάκελοι ιδιωτών (ADR-916 Φ-Ε1), στην ίδια λίστα, στο ίδιο URL
 * (`/o/[ws]/cases/[engagementId]` · `/engagements/[engagementId]`). Κάθε κάρτα/όψη φέρει το `kind` της — η
 * επιφάνεια διαλέγει περιεχόμενο **μόνο** από αυτό.
 *
 * @module types/my-engagements
 */

import type { DocumentKind } from '@/config/document-validity/document-validity';
import type { AdvanceGlance, AdvanceTimelineEntry } from '@/lib/document-validity/issuance-advance';
import type { BallInCourtParty, IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import type { DeliveryChangeGlance } from '@/lib/document-validity/issuance-delivery-change';
import type { IssuanceLateness } from '@/lib/document-validity/issuance-delivery-due';
import type { InspectionContactRole } from '@/lib/document-validity/issuance-inspection-contact';
import type { QuoteTotals } from '@/lib/document-validity/issuance-quote';
import type { ActingForView, EngagedCaseView, MyCaseCard } from '@/types/conveyance-case';
import type { PropertyDossierFileTab } from '@/config/upload-entry-points/entries-property-dossier';
import type {
  DeclaredCredential,
  DossierEngagementRole,
  EngagementState,
  EngagementSubjectKind,
  EngagementVerdict,
} from '@/types/engagement';
import type { ViewFreshness } from '@/types/server-view';
import type { IssuanceDocumentRequests } from '@/types/issuance-document-request';

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
  /**
   * ADR-915 §45.18 Φ6 — η προθεσμία παράδοσης και η βαθμίδα της (ο ΙΔΙΟΣ κριτής με το μητρώο του γραφείου), **μόνο** σε
   * αναληφθείσα ανάθεση με προθεσμία· αλλιώς `null`. Μόνο ημερομηνίες: καμία τιμή, κανένας ιδιοκτήτης (Ε-9′).
   */
  readonly delivery: IssuanceDeliveryGlance | null;
}

export interface IssuanceDeliveryGlance {
  readonly dueOn: string;
  readonly lateness: IssuanceLateness;
}

/**
 * ADR-916 Φ-Ε1 — η κάρτα ενός **φακέλου ιδιώτη** που του δόθηκε. Μόνο ό,τι χρειάζεται για το «ανοίγω;»: το όνομα του
 * φακέλου (όπως το λέει ο κάτοχος), ο ρόλος και ως πότε ισχύει. 🔒 Κανένα στοιχείο επικοινωνίας του κατόχου.
 */
export interface MyDossierCard {
  readonly kind: 'property_dossier';
  readonly engagementId: string;
  readonly engagementState: EngagementState;
  readonly verdict: EngagementVerdict;
  readonly offeredAt: string;
  readonly expiresAt: string;
  readonly role: DossierEngagementRole;
  /** `null` ⇒ ο φάκελος δεν διαβάστηκε ή δεν είναι πια του κατόχου που κάλεσε (η κάρτα μένει, με την ετυμηγορία της). */
  readonly dossierLabel: string | null;
  readonly actingFor: ActingForView | null;
}

export type MyEngagementCard = MyCaseCard | MyIssuanceCard | MyDossierCard;

/** Τι ημερομηνία είναι η εκκρεμότητα — η παράδοση του εγγράφου ή η υπογραφή της μεταβίβασης. */
export type EngagementOpenItemDue = 'delivery' | 'signing';

/**
 * ADR-915 §45.19 Φ6β — **μία εκκρεμότητα του επαγγελματία** (Procore «My Open Items»): ποια ημερομηνία, σε ποιο
 * ακίνητο, για ποιο γραφείο. Παράγεται από τον οικοδεσπότη κάθε είδους (`openItem`, ADR-862 §5.3.11), **ποτέ**
 * αποθηκεύεται. Η βαθμίδα από τον **ίδιο** κριτή ημερών με το μητρώο (`issuanceLatenessOf`).
 * 🔒 Μόνο ημερομηνίες και ονόματα: καμία τιμή, κανένα κανάλι επικοινωνίας (Ε-9′).
 */
export interface EngagementOpenItem {
  readonly engagementId: string;
  readonly kind: EngagementSubjectKind;
  readonly due: EngagementOpenItemDue;
  /** ISO ημέρα. */
  readonly dueOn: string;
  readonly countdown: IssuanceLateness;
  readonly hostName: string | null;
  readonly propertyName: string | null;
}

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
  /**
   * §45.15 (1β-γ-2) — ο ιδιοκτήτης δήλωσε στην έγκριση **άλλο** ΑΦΜ και το γραφείο δεν το έχει εφαρμόσει ακόμη ⇒ η όψη
   * λέει «εκκρεμεί επιβεβαίωση γραφείου» **αντί** για αριθμό που μπορεί να είναι λάθος.
   */
  readonly vatPendingOfficeConfirmation: boolean;
  /**
   * §45.20 — αυτός είναι ο ιδιοκτήτης που **ενέκρινε** την προσφορά (κρίση κατά ταυτότητα επαφής, ποτέ κατά όνομα) ⇒ η
   * όψη τον σημειώνει μέσα στον κατάλογο αντί για δεύτερη γραμμή «Ιδιοκτήτης» με το ίδιο όνομα.
   */
  readonly approvedQuote: boolean;
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
  /** §45.18 Φ6 — η βαθμίδα της προθεσμίας σήμερα (ίδιο ρολόι με το μητρώο)· `no-due-date` όταν δεν υπάρχει. */
  readonly lateness: IssuanceLateness;
  /** `null` ⇒ το γραφείο δεν όρισε ακόμη υπεύθυνο αυτοψίας. */
  readonly inspectionContact: InspectionContactView | null;
  /** `null` ⇒ οι ιδιοκτήτες δεν διαβάστηκαν τώρα· `[]` ⇒ το μητρώο δεν ξέρει ιδιοκτήτη. */
  readonly owners: readonly IssuanceOwnerView[] | null;
  /** §45.20 Φ6γ — το αίτημα νέας ημερομηνίας **αυτής** της συμμετοχής: εκκρεμεί ή η τελευταία απάντηση. */
  readonly deliveryChange: DeliveryChangeGlance;
  /**
   * ADR-943 Φ5α — η προκαταβολή της συμφωνίας (ο ΙΔΙΟΣ υπολογισμός με κάθε άλλη οθόνη, `advanceGlanceOf`)· `null` ⇒ χωρίς
   * προκαταβολή. 🔒 Ε-9′: μόνο ποσά και στιγμές — καμία αιτιολογία αντίρρησης του ιδιοκτήτη (ό,τι ειπώθηκε ανήκει στο γραφείο).
   */
  readonly advance: AdvanceGlance | null;
  /** ADR-943 Φ5δ — το χρονολόγιο των χρημάτων (`advanceTimelineOf`, η ΙΔΙΑ λίστα με γραφείο και ιδιοκτήτη· χωρίς αιτιολογίες). */
  readonly advanceTimeline: readonly AdvanceTimelineEntry[];
}

/**
 * Ο **χώρος της ανάθεσης** όπως τον βλέπει ο επαγγελματίας (ADR-915 §39). 🔒 Ε-9′: **κανένα** τηλέφωνο ή email —
 * μόνο ονόματα και γεγονότα. Η παράδοση (Φ-Γ) και τα μηνύματα (Φ-Δ) προστίθενται εδώ, πάνω στο ίδιο `kind`.
 */
export interface EngagedIssuanceView {
  readonly kind: 'document_issuance';
  readonly engagementId: string;
  /**
   * §45.20 — η ταυτότητα του γραφείου, για την πόρτα προς τη **δημόσια** βιτρίνα του (`agencyDoorFor` → `/pro/<…>`).
   * Δεν είναι διαρροή: είναι το κλειδί δημόσια αναγνώσιμου εγγράφου (ADR-827 §9.4), ήδη ορατό σε κάθε κάρτα καταλόγου.
   */
  readonly hostCompanyId: string;
  readonly hostName: string | null;
  readonly propertyName: string | null;
  /**
   * §45.20 — η **δημοσιευμένη** αγγελία του ακινήτου (`public_listings/{propertyId}`), ή `null` όταν δεν υπάρχει. Ο
   * επαγγελματίας είναι ήδη μέρος της ανάθεσης — δεν είναι μαντείο· σύνδεσμος σε 404 όμως θα ήταν αδιέξοδο.
   */
  readonly publicListingId: string | null;
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
   * ADR-942 Φ1 — «Έγγραφα για την έκδοση»: τι ζητείται, τι έχει ήδη ο φάκελος του κατόχου, τι ζήτησε ο ίδιος. `null` ⇒
   * το είδος δεν έχει κατάλογο ή το γραφείο δεν κατέχει πια το ακίνητο (καμία ενότητα)· `'unknown'` ⇒ δεν διαβάστηκε.
   */
  readonly documentRequests: IssuanceDocumentRequests | null | 'unknown';
  /**
   * Το ίδιο συμβόλαιο φρεσκάδας με την όψη της μεταβίβασης (ADR-901 §14.8). Στη Φ-Β ο χώρος δεν έχει γραφέα σήματος
   * ⇒ `revision` μένει 0 και η όψη ξαναδιαβάζεται στην αλλαγή ημέρας ή στο άνοιγμα — ρητά, όχι ξεχασμένα (ADR-915 §39).
   */
  readonly freshness: ViewFreshness;
}

/** ADR-916 Φ-Ε1 — ένα αρχείο του φακέλου που **φτάνει** στη συμμετοχή (η ίδια κρίση εύρους με την πόρτα ανοίγματος). */
export interface EngagedDossierFile {
  readonly fileId: string;
  readonly fileName: string;
  readonly tab: PropertyDossierFileTab;
  readonly contentType: string;
  /** ISO — πότε μπήκε στον φάκελο· `null` ⇒ δεν διαβάστηκε. */
  readonly addedAt: string | null;
}

/**
 * ADR-916 Φ-Ε1 — ο **φάκελος ιδιώτη** όπως τον βλέπει ο επαγγελματίας: **μόνο** τα αρχεία του εύρους του (καρτέλες
 * μείον εξαιρέσεις), παραγόμενα σε **κάθε** ανάγνωση — εξαίρεση ή μετακίνηση αρχείου ισχύει αμέσως. 🔒 Κανένα στοιχείο
 * επικοινωνίας του κατόχου· άνοιγμα/λήψη **μόνο** από την πόρτα του server, με ίχνος στο βιβλίο του κατόχου.
 */
export interface EngagedDossierView {
  readonly kind: 'property_dossier';
  readonly engagementId: string;
  readonly dossierLabel: string;
  readonly role: DossierEngagementRole;
  readonly expiresAt: string;
  readonly tabs: readonly PropertyDossierFileTab[];
  /** Πώς λέγεται η καρτέλα κάτοψης — οικόπεδο ⇒ «Τοπογραφικό» (ο ΙΔΙΟΣ κριτής με τη σελίδα του κατόχου, `floorplanTabKind`). */
  readonly floorplanKind: 'floorplan' | 'topographic';
  readonly files: readonly EngagedDossierFile[];
  readonly credential: DeclaredCredential | null;
  /** Χωρίς γραφέα σήματος (όπως η ανάθεση έκδοσης, §39): ξαναδιαβάζεται στο άνοιγμα ή στην αλλαγή ημέρας — ρητά. */
  readonly freshness: ViewFreshness;
}

export type EngagedView = EngagedCaseView | EngagedIssuanceView | EngagedDossierView;
