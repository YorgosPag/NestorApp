/**
 * @fileoverview **Η ΟΨΗ ΤΟΥ ΠΡΩΤΟΚΟΛΛΟΥ** — ό,τι τυπώνεται, και **μόνο** αυτό (ADR-916 Φ-Γ2 Σ4).
 * @module services/pdf/renderers/handover-protocol/handover-protocol-view
 * @related handover-protocol-manifest.ts (η ίδια όψη σε JSON) · handover-protocol-pdf-renderer.ts (η ίδια όψη σε σελίδα)
 *
 * 🔑 **Μία όψη, δύο αποδόσεις**: ο πίνακας του PDF και το `manifest.json` παράγονται από **το ίδιο** αντικείμενο, άρα δεν
 *    μπορούν να διαφωνήσουν για ένα αρχείο. Η σειρά των γραμμών είναι η σειρά **του αποτυπώματος** (`inHandoverDigestOrder`,
 *    κατά bytes): ο τρίτος που ξαναϋπολογίζει το αποτύπωμα διαβάζει τον πίνακα με τη σειρά που θα τον ταξινομούσε.
 * 🔒 **Ελαχιστοποίηση με τύπο (GDPR άρθ. 5 §1 γ · ρήτρα `personalData`)**: ο παραλήπτης είναι **ένα** πεδίο, το
 *    ονοματεπώνυμο. Δεν υπάρχει πεδίο για email, τηλέφωνο, ΑΦΜ ή IP — ό,τι δεν υπάρχει στον τύπο δεν τυπώνεται ποτέ.
 *    Ο φορέας τυπώνεται **χωρίς** διευθύνσεις email: τις έχει η δημόσια σελίδα του, και το PDF δεν τις χρειάζεται.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import type { FrozenLegalText } from '@/lib/legal/frozen-legal-document';
import type { OperatorStatementView } from '@/lib/platform-operator/operator-presentation';
import { inHandoverDigestOrder } from '@/lib/property-handover/handover-delivery-plan';

/** Μία γραμμή του πίνακα = μία γραμμή του καθολικού, με sha256 (κανένα πρωτόκολλο χωρίς). */
export interface HandoverProtocolRow {
  readonly sourceFileId: string;
  readonly copyFileId: string;
  readonly sha256: string;
  readonly size: number;
  /** Το όνομα του αντιγράφου όπως το βλέπει ο αγοραστής — `null` αν δεν διαβάστηκε (το αναγνωριστικό αρκεί). */
  readonly name: string | null;
}

/** Ό,τι **δεν** μπορεί να λείπει για να υπάρξει αναθεώρηση N+1: ποια αντικαθιστά. */
export interface HandoverProtocolSupersedes {
  readonly protocolId: string;
  readonly revision: number;
}

/** Οι χρόνοι των γεγονότων — ISO. `null` ⇒ δεν συνέβη ή δεν καταγράφηκε, και τυπώνεται ως «—». */
export interface HandoverProtocolEvents {
  readonly saleCompletedAt: string | null;
  readonly invitationAcceptedAt: string | null;
  readonly deliveryStartedAt: string | null;
  readonly deliveryCompletedAt: string | null;
}

export interface HandoverProtocolLegalText {
  readonly version: number;
  /** `sha256:…` — το αποτύπωμα του παγωμένου κειμένου. */
  readonly digest: string;
  /** Το **δεσμευτικό** κείμενο (ελληνικά), αυτολεξεί από την παγωμένη έκδοση. */
  readonly text: FrozenLegalText;
  /** Σχετική διαδρομή της δημόσιας σελίδας της έκδοσης — πάντα γνωστή. */
  readonly path: string;
  /** Απόλυτος σύνδεσμος — `null` όταν η εγκατάσταση δεν ξέρει τη δημόσια διεύθυνσή της (τότε **κανένα** QR). */
  readonly url: string | null;
}

/**
 * **Η πόρτα επαλήθευσης αυτού του πρωτοκόλλου** (ADR-916 Φ-Γ2 Σ6) — `/handover-protocol/verify/{protocolId}`. Τυπώνεται
 * δίπλα στο κείμενο των όρων, **εκτός** manifest (το σχήμα v1 μένει αυτολεξεί).
 */
export interface HandoverProtocolVerificationLink {
  /** Σχετική διαδρομή — πάντα γνωστή. */
  readonly path: string;
  /** Απόλυτος σύνδεσμος — `null` όταν η εγκατάσταση δεν ξέρει τη δημόσια διεύθυνσή της (τότε **κανένα** QR). */
  readonly url: string | null;
}

export interface HandoverProtocolView {
  readonly protocolId: string;
  readonly revision: number;
  readonly supersedes: HandoverProtocolSupersedes | null;
  readonly issuedAt: string;
  readonly issuerName: string;
  readonly propertyLabel: string | null;
  readonly appurtenances: readonly string[];
  /** Μόνο ονοματεπώνυμο (ρήτρα `personalData`). */
  readonly recipientName: string | null;
  readonly events: HandoverProtocolEvents;
  /** Το αποτύπωμα v2 του καθολικού (ADR-916 §5.10). */
  readonly ledgerDigest: string;
  /** Με τη σειρά του αποτυπώματος. */
  readonly rows: readonly HandoverProtocolRow[];
  readonly totalBytes: number;
  readonly legalText: HandoverProtocolLegalText;
  readonly verification: HandoverProtocolVerificationLink;
  readonly operator: OperatorStatementView;
}

export type HandoverProtocolViewInput = Omit<HandoverProtocolView, 'rows' | 'totalBytes'> & {
  readonly rows: readonly HandoverProtocolRow[];
};

/** **Η όψη** — ταξινομεί τις γραμμές κατά bytes και αθροίζει τα bytes. Ίδια είσοδος ⇒ ίδια όψη, σε οποιαδήποτε σειρά. */
export function handoverProtocolViewOf(input: HandoverProtocolViewInput): HandoverProtocolView {
  const rows = inHandoverDigestOrder(input.rows);
  return { ...input, rows, totalBytes: rows.reduce((sum, row) => sum + row.size, 0) };
}
