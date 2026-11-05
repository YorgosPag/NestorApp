/**
 * @fileoverview **Το μοντέλο του εγγράφου υπεργολαβίας** — ουδέτερο ως προς την απόδοση (ADR-928 §5.17).
 * @module subapps/procurement/subcontracts/document/document-types
 *
 * 🔑 Κάθε κείμενο εδώ είναι **ήδη αποδοσμένο** στη γλώσσα του εγγράφου. Η προεπισκόπηση HTML (Φ3) και το Typst (Φ4)
 *    μόνο τοποθετούν: καμία μορφοποίηση στην απόδοση ⇒ οθόνη και χαρτί δεν μπορούν να διαφωνήσουν.
 * 🔑 Σειριοποιήσιμο σε JSON (μόνο συμβολοσειρές, αριθμοί, πίνακες) — ακριβώς η είσοδος `--input` του Typst (§5.8).
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { SubcontractIssue } from '../clauses/clause-issues';

/** Τμήμα κειμένου· `value` = αποδοσμένη τιμή παραμέτρου (η απόδοση μπορεί να την τονίσει), `missing` = λείπει. */
export type DocumentInline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'value'; readonly text: string; readonly missing: boolean };

export type DocumentBlock =
  | { readonly kind: 'paragraph'; readonly inlines: readonly DocumentInline[] }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly items: readonly (readonly DocumentInline[])[] };

/** Ζεύγος ετικέτα–τιμή (στοιχεία έργου, μέρους). */
export interface DocumentField {
  readonly label: string;
  readonly value: string;
}

export interface DocumentParty {
  readonly role: string;
  readonly name: string;
  readonly details: readonly string[];
}

export interface DocumentLineRow {
  readonly number: number;
  readonly description: string;
  readonly kind: string;
  readonly pricing: string;
  readonly unit: string;
  /** `null` ⇒ «κατά επιμέτρηση» (`byMeasurement`). */
  readonly quantity: string | null;
  readonly unitPrice: string;
  readonly amount: string | null;
  readonly amountInWords: string | null;
  readonly comment: string | null;
  readonly measurementRule: readonly DocumentBlock[];
}

export interface DocumentTotals {
  readonly label: string;
  /** Το ποσό, ή «τουλάχιστον …» όταν λείπουν ποσότητες. */
  readonly value: string;
  readonly isLowerBound: boolean;
  readonly unpricedNote: string | null;
  readonly valueInWords: string | null;
  readonly vatNote: string;
}

export interface DocumentClause {
  readonly clauseKey: string;
  readonly number: number;
  readonly heading: string;
  readonly blocks: readonly DocumentBlock[];
  /** Η γλώσσα δεν έχει εγκεκριμένη μετάφραση ⇒ τυπώθηκε το ελληνικό, με ορατή σημείωση. */
  readonly untranslatedNote: string | null;
}

/** Εντολή εργασίας κύριας σύμβασης (ADR-928 §5.24): «Εντολή εργασίας αρ. 2» + ταυτότητα έργου, κτίρια, χρόνοι. */
export interface DocumentWorkOrder {
  readonly number: number;
  readonly heading: string;
  readonly fields: readonly DocumentField[];
}

export interface DocumentSectionLabels {
  readonly parties: string;
  readonly project: string;
  readonly workOrders: string;
  readonly lines: string;
  readonly terms: string;
  readonly paymentPlan: string;
  readonly clauses: string;
  readonly columns: Readonly<Record<'number' | 'description' | 'unit' | 'quantity' | 'unitPrice' | 'amount', string>>;
  readonly byMeasurement: string;
}

export interface AgreementDocument {
  readonly language: HumanLanguage;
  readonly isAuthoritative: boolean;
  /** Μόνο σε μη ελληνικό: «νομικά δεσμευτικό είναι μόνο το ελληνικό» (§5.2.2). */
  readonly prevailingNotice: string | null;
  readonly kindLabel: string;
  readonly documentNumber: string;
  readonly title: string;
  readonly validUntil: string | null;
  readonly labels: DocumentSectionLabels;
  readonly parties: readonly DocumentParty[];
  readonly signatory: string | null;
  readonly project: readonly DocumentField[];
  /** Μόνο σε κύρια σύμβαση: οι εντολές εργασίας με τη σειρά έκδοσης (§5.24). */
  readonly workOrders: readonly DocumentWorkOrder[];
  readonly lines: readonly DocumentLineRow[];
  readonly totals: DocumentTotals;
  readonly terms: readonly string[];
  readonly paymentPlan: readonly string[];
  readonly clauses: readonly DocumentClause[];
  /** Ό,τι εμποδίζει αυτό το χαρτί να τυπωθεί ως έχει (π.χ. `translationMissing`) — ίδιοι κωδικοί με τον γραφέα. */
  readonly issues: readonly SubcontractIssue[];
}
