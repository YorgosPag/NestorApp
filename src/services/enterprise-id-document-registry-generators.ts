/**
 * ENTERPRISE ID — ΟΙ ΤΑΥΤΟΤΗΤΕΣ ΤΟΥ ΜΗΤΡΩΟΥ ΛΗΞΕΩΝ ΕΓΓΡΑΦΩΝ (ADR-915)
 *
 * Νέος κρίκος της αλυσίδας (βλ. `enterprise-id-composite-key-generators.ts`) — όχι γραμμή στο
 * `enterprise-id-class.ts`, που βρίσκεται **ακριβώς** στο όριο των 500 γραμμών (N.7.1): **διάσπαση ανά
 * τομέα, όχι κόψιμο**, όπως κάθε προηγούμενος κρίκος.
 *
 * ⚠️ Η μηχανή (`mintDeterministicV4Id`) μένει στην `EnterpriseIdService`· εδώ μόνο **ονοματοδοσία**.
 *
 * @module services/enterprise-id-document-registry-generators
 */

import { ENTERPRISE_ID_PREFIXES } from './enterprise-id-prefixes';
import { AreaMarketIdGenerators } from './enterprise-id-area-market-generators';

const P = ENTERPRISE_ID_PREFIXES;

export abstract class DocumentRegistryIdGenerators extends AreaMarketIdGenerators {
  /**
   * ADR-915 §26 — **ΕΝΑΣ** ρητός υπεύθυνος ανά (γραφείο, ακίνητο): ορισμός = `set`, επαναφορά = `delete`, πάντα το
   * **ίδιο** έγγραφο — ιδεμποτές από κατασκευή, και κανένα ερώτημα για να βρεθεί.
   */
  generateDeterministicDocumentObligorDesignationId(seed: string): string {
    return this.mintDeterministicV4Id(P.DOCUMENT_OBLIGOR_DESIGNATION, seed);
  }

  /**
   * ADR-915 §27 — **ΜΙΑ** ανάθεση έκδοσης ανά (γραφείο, ακίνητο, είδος εγγράφου): νέος κύκλος ξαναγράφει το **ίδιο**
   * έγγραφο ⇒ δύο ταυτόχρονες προτάσεις δεν γεννούν ποτέ δύο αναθέσεις (άρα ούτε δύο ΠΕΑ).
   */
  generateDeterministicDocumentIssuanceAssignmentId(seed: string): string {
    return this.mintDeterministicV4Id(P.DOCUMENT_ISSUANCE_ASSIGNMENT, seed);
  }

  /**
   * ADR-915 §35 — **ΜΙΑ** απόφαση μόνιμης υποχρέωσης ανά (γραφείο, ακίνητο, είδος): επιβεβαίωση/εξαίρεση = `set`,
   * «ξανά ρώτα» = `delete`, πάντα το **ίδιο** έγγραφο — δύο ταυτόχρονες αποφάσεις δεν γίνονται ποτέ δύο υποχρεώσεις.
   */
  generateDeterministicPropertyUpkeepDeclarationId(seed: string): string {
    return this.mintDeterministicV4Id(P.PROPERTY_UPKEEP_DECLARATION, seed);
  }

  /**
   * ADR-945 §7.2 — **ΕΝΑ** αίτημα προσφορών ανά (κάτοχος, ακίνητο, είδος): νέος κύκλος ξαναγράφει το **ίδιο** έγγραφο
   * (`cycle + 1`) ⇒ δύο ταυτόχρονα «ζήτα προσφορές» δεν γεννούν ποτέ δύο αιτήματα.
   */
  generateDeterministicDocumentIssuanceRequestId(seed: string): string {
    return this.mintDeterministicV4Id(P.DOCUMENT_ISSUANCE_REQUEST, seed);
  }

  /**
   * ADR-945 §7.2 — **ΜΙΑ** προσφορά ανά (αίτημα, κύκλος, επαγγελματίας): ίδια πρόσκληση ⇒ ίδια διεύθυνση (ιδεμποτές), και
   * κάθε κύκλος κρατά το ιστορικό του — τίποτα δεν γράφεται από πάνω.
   */
  generateDeterministicDocumentIssuanceBidId(seed: string): string {
    return this.mintDeterministicV4Id(P.DOCUMENT_ISSUANCE_BID, seed);
  }

  /**
   * ADR-915 §28 — ο **σύνδεσμος** της ανάθεσης (έγκριση ιδιοκτήτη · απάντηση επαγγελματία). Τυχαίο, όχι ντετερμινιστικό:
   * επαναποστολή = **νέο** id, και η ανάθεση θυμάται ποιο είναι το τρέχον (ο παλιός πεθαίνει από κατασκευή).
   */
  generateDocumentIssuanceInvitationId(): string {
    return this.generateId(P.DOCUMENT_ISSUANCE_INVITATION).id;
  }

  /**
   * ADR-947 Δ3 — **ΕΝΑ** αμετάβλητο στιγμιότυπο αντικειμενικής αξίας ανά (εκδότης, περιεχόμενο): ο σπόρος είναι το
   * `digest` του κανονικού περιεχομένου ⇒ η ίδια οριστικοποίηση δύο φορές δίνει το **ίδιο** έγγραφο (ιδεμποτές από
   * κατασκευή, όπως ένα commit του Git), και κάθε διαφορετικό περιεχόμενο νέο.
   */
  generateDeterministicObjectiveValueSnapshotId(seed: string): string {
    return this.mintDeterministicV4Id(P.OBJECTIVE_VALUE_SNAPSHOT, seed);
  }
}
