/**
 * @fileoverview **ΤΟ ΠΡΩΤΟΚΟΛΛΟ ΠΑΡΑΔΟΣΗΣ ΨΗΦΙΑΚΩΝ ΑΡΧΕΙΩΝ** — το σφραγισμένο έγγραφο που βεβαιώνει **ποια** αρχεία
 *               παραδόθηκαν και ότι **δεν άλλαξαν** (ADR-916 Φ-Γ2 Σ4 · κείμενο ADR-861 `handover-protocol`).
 * @module types/property-handover-protocol
 *
 * 🔑 **Ένα πρωτόκολλο ανά αποτύπωμα καθολικού**: η ταυτότητα (`phpr_*`) παράγεται από `(παράδοση, αποτύπωμα)` ⇒ ίδιο
 *    καθολικό = ίδιο πρωτόκολλο, όσες φορές κι αν τρέξει ο εκτελεστής. Συμπλήρωση (Δ5) = νέο αποτύπωμα = **νέα αναθεώρηση**
 *    που δηλώνει ποια αντικαθιστά· η παλιά μένει (ISO 19650: η αναθεώρηση δεν σβήνει ιστορικό).
 * 🔒 `property_handover_protocols` = `deny_all`: τη γράφει **μόνο** ο διακομιστής, και κανείς πελάτης δεν τη διαβάζει. Ο
 *    αγοραστής βλέπει το **PDF** στον φάκελό του, το γραφείο στα αρχεία του ακινήτου.
 */

/** **Ο δείκτης στο τελευταίο πρωτόκολλο** — αποθηκεύεται στην παράδοση, ώστε η αναθεώρηση να κρίνεται χωρίς ερώτημα. */
export interface PropertyHandoverProtocolPointer {
  readonly protocolId: string;
  /** 1, 2, … — αυξάνει κατά ένα σε κάθε νέο αποτύπωμα καθολικού. */
  readonly revision: number;
  /** Το αποτύπωμα v2 του καθολικού που σφραγίστηκε (ADR-916 §5.10). */
  readonly digest: string;
  readonly issuedAt: string;
  /** Το PDF στα αρχεία της **εταιρείας** (`files`). */
  readonly companyFileId: string;
  /** Το αντίγραφο του PDF στον φάκελο του **αγοραστή** (`files_personal`). */
  readonly recipientFileId: string;
}

/**
 * **Όσα βλέπει ο αγοραστής** — προβάλλονται στον κύριο φάκελό του (`origin.protocol`), όπως η πρόοδος της παράδοσης
 * (Δ10: ο αγοραστής δεν διαβάζει ποτέ την ίδια την παράδοση). Το `fileId` είναι το **δικό του** αντίτυπο.
 */
export interface PropertyHandoverProtocolSummary {
  readonly revision: number;
  readonly issuedAt: string;
  readonly fileId: string;
}

/** Η έκδοση του νομικού κειμένου που τυπώθηκε — **σε ισχύ** την ημέρα έκδοσης (`legalDocumentInForce`). */
export interface PropertyHandoverProtocolLegalText {
  readonly version: number;
  /** `sha256:…` του παγωμένου κειμένου (ADR-861). */
  readonly digest: string;
}

/** Το πρωτόκολλο, όπως αποθηκεύεται στο `property_handover_protocols/{phpr_*}`. */
export interface PropertyHandoverProtocol extends PropertyHandoverProtocolPointer {
  readonly companyId: string;
  readonly propertyId: string;
  readonly handoverId: string;
  readonly recipientUserId: string;
  /** Η αναθεώρηση που αντικαθιστά — `null` στην πρώτη. */
  readonly supersedesProtocolId: string | null;
  /** sha256 του **σφραγισμένου** PDF (64 hex) — ό,τι ψάχνει η πόρτα επαλήθευσης (Σ6). */
  readonly pdfSha256: string;
  readonly legalText: PropertyHandoverProtocolLegalText;
  /** Γραμμές του πίνακα και σύνολο bytes — ίδια με το καθολικό τη στιγμή της σφράγισης. */
  readonly rows: number;
  readonly bytes: number;
}
