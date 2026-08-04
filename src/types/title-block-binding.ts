/**
 * @fileoverview Πρόταση σύνδεσης πινακίδας → οντότητα βάσης, και η **εγκεκριμένη** εγγραφή της.
 *
 * ADR-745 §6.2. Δύο σχήματα, με σκόπιμα διαφορετική διάρκεια ζωής:
 * - `BindingProposal` — έξοδος του **Λ2**, εφήμερη, **ποτέ** δεν αποθηκεύεται.
 * - `TitleBlockBinding` — τι **εγκρίθηκε**, από ποιο κελί, ποιου αρχείου, από ποιον. Αποθηκεύεται.
 *
 * 🔑 **Η μαρτυρία ΕΙΝΑΙ η βεβαιότητα.** Δεν υπάρχει `confidence: 'certain' | 'probable'` και δεν
 * υπάρχει σκορ. Ο άνθρωπος δεν ωφελείται από το «87%» — ωφελείται από το «**ταιριάζει το
 * e-mail**». Ίδια αρχή με τη Φ2 (§6.4): *«ο πίνακας υποψηφίων είναι η βεβαιότητα»*, γενικευμένη
 * ώστε να κουβαλά και το **γιατί**. Είναι και το σημείο όπου ξεπερνάμε τα εμπορικά CAD: κανένα
 * δεν εξηγεί την πρόταση που κάνει.
 *
 * @module types/title-block-binding
 */

import type { AcquisitionStatus } from '@/types/ownership-table';
import type { ProjectRole } from '@/types/entity-associations';
import type { TitleBlockFieldKey } from '@/types/title-block-reading';

// ── Μαρτυρία ──────────────────────────────────────────────────────────────────

/**
 * Τι **απέδειξε** την αντιστοίχιση, από την ισχυρότερη προς την ασθενέστερη.
 *
 * Η σειρά δεν είναι διακοσμητική — είναι η σειρά κατάταξης των υποψηφίων. Ένα e-mail είναι
 * ταυτότητα· ένα όνομα είναι ένδειξη.
 */
export const BINDING_EVIDENCE_KINDS = [
  'email',
  'phone',
  'name-exact',
  'name-abbrev',
  'name-fuzzy',
] as const;

export type BindingEvidenceKind = (typeof BINDING_EVIDENCE_KINDS)[number];

export interface BindingEvidence {
  readonly kind: BindingEvidenceKind;
  /** Η τιμή που ταίριαξε — αυτό ακριβώς δείχνεται στον άνθρωπο, όχι κάποιο ποσοστό. */
  readonly value: string;
}

/** Μεγαλύτερο = ισχυρότερο. Παράγεται από τη σειρά, ώστε να μην μπορεί να αποκλίνει. */
export const evidenceStrength = (kind: BindingEvidenceKind): number =>
  BINDING_EVIDENCE_KINDS.length - BINDING_EVIDENCE_KINDS.indexOf(kind);

// ── Στόχοι ────────────────────────────────────────────────────────────────────

/** Τα πεδία διεύθυνσης έργου που μπορεί να προτείνει η πινακίδα (ADR-745 §7). */
export const BINDABLE_ADDRESS_FIELDS = ['municipality', 'regionalUnit', 'neighborhood'] as const;
export type BindableAddressField = (typeof BINDABLE_ADDRESS_FIELDS)[number];

/** Μεταδεδομένα του **σχεδίου** — δεν αγγίζουν το έργο (ADR-745 §7). */
export const BINDABLE_DRAWING_FIELDS = ['scale', 'studyDate', 'drawingNumber', 'drawingType'] as const;
export type BindableDrawingField = (typeof BINDABLE_DRAWING_FIELDS)[number];

/**
 * Πού μπορεί να προσγειωθεί μια τιμή της πινακίδας.
 *
 * 🔴 **Δεν υπάρχει `{ kind: 'project-field'; field: 'client' }` και δεν πρόκειται να υπάρξει.**
 * Το `Project.client` τυπώνεται σε PDF προβολής ως «Πελάτης», και ο «ΕΡΓΟΔΟΤΗΣ» της πινακίδας
 * είναι η **ιδιοκτήτρια/πωλήτρια** — όχι ο πελάτης (§9 Q1, απόφαση 2026-08-04). Γράφοντάς τον
 * εκεί, ο Νέστωρ θα διαφήμιζε την αντισυμβαλλόμενη ως πελάτισσα.
 */
export type BindingTarget =
  | { readonly kind: 'contact'; readonly contactId: string; readonly role: ProjectRole; readonly projectId: string }
  | {
      readonly kind: 'landowner';
      readonly projectId: string;
      readonly contactId: string;
      readonly acquisitionStatus: AcquisitionStatus;
    }
  | {
      readonly kind: 'project-address';
      readonly projectId: string;
      readonly field: BindableAddressField;
      readonly value: string;
    }
  | { readonly kind: 'project-field'; readonly projectId: string; readonly field: 'buildingBlock'; readonly value: string }
  | { readonly kind: 'drawing-meta'; readonly levelId: string; readonly field: BindableDrawingField; readonly value: string };

export type BindingTargetKind = BindingTarget['kind'];

// ── Πρόταση (Λ2 — εφήμερη) ────────────────────────────────────────────────────

export interface BindingCandidate {
  readonly target: BindingTarget;
  /** Πώς ονομάζεται ο στόχος για τον άνθρωπο (όνομα επαφής, τιμή πεδίου). */
  readonly label: string;
  /**
   * Ταξινομημένες κατά ισχύ.
   *
   * **Κενή μόνο όταν δεν τίθεται ερώτημα ταυτότητας**: ο δήμος ή το Ο.Τ. δεν «ταιριάζουν» με
   * κάποια οντότητα — είναι **τιμές που διαβάστηκαν** και ζητούν έγκριση για να γραφτούν. Για
   * στόχο **προσώπου** η κενή λίστα σημαίνει «δεν είναι υποψήφιος» και δεν πρέπει να παραχθεί.
   */
  readonly evidence: readonly BindingEvidence[];
}

/**
 * Γιατί ένα πεδίο **δεν** έχει υποψήφιο.
 *
 * Ποτέ σιωπηλά κενό: το ADR-745 §8 κανόνας 3 απαιτεί ορατή απώλεια. Ο χρήστης που βλέπει
 * «καμία πρόταση» χωρίς αιτία δεν μπορεί να ξεχωρίσει το «δεν βρέθηκε» από το «δεν κοιτάχτηκε».
 */
export type BindingBlockReason =
  /** Το σχέδιο δεν είναι δεμένο σε έργο — τα πεδία έργου δεν έχουν πού να προσγειωθούν. */
  | 'no-project'
  /** Το πεδίο δεν αντιστοιχίζεται σε καμία οντότητα (π.χ. `projectTitle`, `studyType`). */
  | 'unsupported-field'
  /** Αναζητήθηκε και δεν βρέθηκε τίποτα στη βάση. */
  | 'no-match'
  /** Βρέθηκε πρόσωπο αλλά η ειδικότητα δεν δίνει **έναν** ρόλο (0 ή >1 — §6.4). */
  | 'role-undecided';

export interface BindingProposal {
  readonly fieldKey: TitleBlockFieldKey;
  /** Ποια πινακίδα του layer — ένα layer φέρει μετρημένα δύο (§2.3 Παγίδα Δ). */
  readonly titleBlockIndex: number;
  /** Το κελί της **τιμής** (id οντότητας σκηνής). */
  readonly sourceHandle: string;
  /** Το κελί της **ετικέτας** — το overlay της Φ4 πρέπει να καλύψει και τα δύο (§6.1). */
  readonly labelHandle: string;
  /** Τι έγραφε η πινακίδα τη στιγμή της ανάγνωσης. */
  readonly snapshotValue: string;
  /** Το πρόσωπο του κελιού μελετητών, όταν η πρόταση αφορά πρόσωπο. */
  readonly personName?: string;
  /** Ταξινομημένοι· 0 = τίποτα, 1 = βέβαιο, >1 = διφορούμενο (η βεβαιότητα είναι το πλήθος). */
  readonly candidates: readonly BindingCandidate[];
  /** Παρόν **μόνο** όταν `candidates` είναι κενό. */
  readonly blockedBy?: BindingBlockReason;
}

// ── Εγκεκριμένη σύνδεση (αποθηκεύεται) ────────────────────────────────────────

/**
 * `superseded` αντί για διαγραφή: μια λάθος έγκριση είναι **γεγονός που συνέβη**.
 *
 * Ίδια αρχή με το `withdrawn` της Φ3α — σκέτη διαγραφή χάνει το ιστορικό και αφήνει
 * ανεξήγητο γιατί κάποια στιγμή η βάση έλεγε κάτι άλλο.
 */
export type TitleBlockBindingStatus = 'active' | 'superseded';

export interface TitleBlockBinding {
  readonly id: string;
  /** Απομόνωση μισθωτή — **υποχρεωτικό**, το διαβάζουν τα Firestore rules. */
  readonly companyId: string;
  readonly fileRecordId: string;
  readonly levelId: string;
  readonly layerName: string;
  readonly titleBlockIndex: number;
  readonly fieldKey: TitleBlockFieldKey;
  readonly sourceHandle: string;
  readonly labelHandle: string;
  readonly target: BindingTarget;
  /** Τι έγραφε η πινακίδα τη στιγμή της σύνδεσης — για ανίχνευση απόκλισης. */
  readonly snapshotValue: string;
  readonly status: TitleBlockBindingStatus;
  /** **Ποτέ** σιωπηλή αυτόματη σύνδεση: κάθε εγγραφή φέρει τον άνθρωπο που την ενέκρινε. */
  readonly confirmedBy: string;
  readonly confirmedAt: string;
}

/**
 * Κατάταξη υποψηφίων: ισχυρότερη μαρτυρία πρώτα, μετά **πλήθος** μαρτυριών, μετά όνομα.
 *
 * Το τρίτο σκέλος δεν είναι σχολαστικισμός: χωρίς αυτό, δύο εξίσου τεκμηριωμένοι υποψήφιοι
 * εναλλάσσονται ανάλογα με τη σειρά ανάγνωσης της βάσης, και ο άνθρωπος βλέπει άλλη πρόταση σε
 * κάθε άνοιγμα του ίδιου σχεδίου.
 */
export function compareBindingCandidates(a: BindingCandidate, b: BindingCandidate): number {
  const best = (c: BindingCandidate) =>
    c.evidence.reduce((max, e) => Math.max(max, evidenceStrength(e.kind)), 0);
  const byStrength = best(b) - best(a);
  if (byStrength !== 0) return byStrength;
  const byCount = b.evidence.length - a.evidence.length;
  if (byCount !== 0) return byCount;
  return a.label.localeCompare(b.label);
}
