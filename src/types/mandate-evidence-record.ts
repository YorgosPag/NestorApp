/**
 * @fileoverview **Η ΕΓΓΡΑΦΗ ΜΗΤΡΩΟΥ ΕΝΟΣ ΠΑΓΩΜΕΝΟΥ ΑΠΟΔΕΙΚΤΙΚΟΥ** — ύπαρξη · διατήρηση · διάθεση (ADR-864 §20).
 * @related lib/mandate/evidence-retention.ts · services/mandate/evidence-registry.ts ·
 *   services/mandate/evidence-retention.service.ts · types/owner-property-mandate.ts (`AttestationEvidence`)
 * @module types/mandate-evidence-record
 *
 * 🔴 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΜΗΤΡΩΟ ΚΑΙ ΟΧΙ ΤΟ `proof.evidence` ΤΗΣ ΕΝΤΟΛΗΣ** (μετρημένο 2026-09-17): ο γραφέας
 * `setOwnerPropertyMandate` **αντικαθιστά** την εντολή ανά γραφείο ⇒ η αναφορά χάνεται από τη βάση ενώ το
 * αντικείμενο μένει κλειδωμένο στο bucket **για πάντα**, χωρίς κανέναν να ξέρει ότι υπάρχει. Το μητρώο κρατά
 * ό,τι χρειάζεται η διατήρηση (**γραφείο** + **ακίνητο**) ανεξάρτητα από τη ζωή της εντολής — και μετά τη
 * διαγραφή μένει ως **ταφόπλακα**: αποτύπωμα + κανόνας + ημερομηνία (απόδειξη διάθεσης, Purview/Adobe Sign).
 */

/** Ο κύκλος ζωής — **μόνο προς τα εμπρός**, πλην της επέκτασης διατήρησης (που μένει `retained`). */
export const MANDATE_EVIDENCE_STATES = ['sealed', 'retained', 'disposed'] as const;
export type MandateEvidenceState = (typeof MANDATE_EVIDENCE_STATES)[number];

/** Δικαστική/ρυθμιστική δέσμευση — **υπερισχύει** κάθε προθεσμίας (Vault · Purview «holds always win»). */
export interface EvidenceLegalHold {
  readonly placedBy: string;
  readonly placedAt: string;
  readonly reason: string;
}

export interface MandateEvidenceRecord {
  /** `mevd_*` — ίδιο με το `AttestationEvidence.id` και το τελευταίο τμήμα της διαδρομής. */
  readonly id: string;
  readonly ownerPropertyId: string;
  /** Ο άξονας της **σχέσης** που κρίνει πότε ξεκινά το ρολόι — και ο άξονας μισθωτή (CHECK 3.35). */
  readonly agencyCompanyId: string;
  readonly path: string;
  /** `sha256:…` — επιβιώνει της διάθεσης. */
  readonly digest: string;
  readonly sizeBytes: number;
  readonly contentType: string;
  readonly fileName: string;
  readonly sealedAt: string;
  readonly state: MandateEvidenceState;
  /** Πότε **έληξε η σχέση** — `null` όσο ζει. */
  readonly relationshipEndedAt: string | null;
  /** Η **κλειδωμένη** (Locked) ημερομηνία στο GCS — `null` όσο `sealed`. Μόνο αυξάνει. */
  readonly retainUntil: string | null;
  /** Ο κανόνας που παρήγαγε την ημερομηνία (`EVIDENCE_RETENTION_RULE.id`). */
  readonly ruleId: string | null;
  readonly legalHold: EvidenceLegalHold | null;
  readonly disposedAt: string | null;
}
