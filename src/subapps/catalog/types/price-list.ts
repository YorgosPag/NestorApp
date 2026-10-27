/**
 * =============================================================================
 * ΤΙΜΟΚΑΤΑΛΟΓΟΙ, ΕΚΔΟΣΕΙΣ, ΓΡΑΜΜΕΣ, ΟΜΑΔΕΣ ΚΑΙ ΣΥΝΘΗΚΕΣ — ορισμοί (ADR-923 §5.4 · §5.11 · §12)
 * =============================================================================
 *
 * ```
 * PriceList (κωδικός · είδος · τύπος τιμής · EUR)
 *   └── PriceListVersion (αύξων · draft → published → superseded · validFrom)
 *         └── PriceListLine (υποκείμενο · καθαρή τιμή σε λεπτά · ποσότητα τιμής · ομάδα έκπτωσης)
 *
 * DiscountGroup («TOSH-CARR») × κοινό  ──►  DiscountCondition (ισχύς · αλυσίδα ή κλίμακες)
 * CustomerGroup («χονδρέμπορος») ◄── CustomerAssignment (επαφή | χώρος → ΜΙΑ ομάδα)
 * ```
 *
 * 🔑 **Χρήμα σε λεπτά, ποσοστά σε μονάδες βάσης, ΦΠΑ ποτέ μέσα στην τιμή.**
 * 🔑 **Κανένα αποθηκευμένο `validTo` στην έκδοση**: το παράγει η επόμενη δημοσιευμένη (SAP) —
 *    δύο αλήθειες για το ίδιο όριο θα μπορούσαν να διαφωνήσουν.
 * 🔑 Οι συνθήκες **έχουν** και τα δύο άκρα (`[validFrom, validUntil)`), επειδή δεν σχηματίζουν
 *    αλυσίδα: μια προσφορά «−10% τον Νοέμβριο» τελειώνει χωρίς να την αντικαταστήσει τίποτα.
 *
 * Ημερομηνίες ως ISO 8601 (όπως οι όροι άδειας μέσων). Τα παράγωγα της έκδοσης (`seal`) τα
 * γράφει **μόνο** ο γραφέας (3β).
 *
 * @module subapps/catalog/types/price-list
 */

import type { LocalizedText } from '@/i18n/localized-text';
import type { MinorAmount } from '@/lib/money/money';
import type { BasisPoints, DiscountRule } from '@/lib/pricing/discount-rule';
import type {
  AudienceKind,
  PriceLineSubjectKind,
  PriceListKind,
  PriceListVersionStatus,
  PriceQuantity,
  PriceType,
} from '../vocabulary/pricing';

// ── Τιμοκατάλογος και έκδοση ─────────────────────────────────────────────────

export interface PriceListDefinition {
  readonly code: string;
  readonly labels: LocalizedText;
  readonly kind: PriceListKind;
  readonly priceType: PriceType;
  /**
   * Σε ποιο κοινό **προσφέρεται** η λίστα (ADR-923 §5.11 απόφαση Α — commercetools price selection): ο
   * διακομιστής διαλέγει για τον θεατή τη λίστα με το **ειδικότερο** κοινό που τον καλύπτει. `null` = δεν
   * προσφέρεται σε κανέναν (πάντα για `cost`, που είναι εσωτερικός master). Νόμισμα **δεν** αποθηκεύεται:
   * είναι το `MONEY_CURRENCY` της πλατφόρμας (μία αλήθεια).
   */
  readonly audience: PriceAudience | null;
  /** Φράχτης δημοσίευσης αυτής της λίστας (SAP: ανοχή ανά τύπο συνθήκης)· `null` = ο της πλατφόρμας. */
  readonly changeFenceBp: BasisPoints | null;
}

/** Η σφραγίδα της δημοσίευσης — γράφεται από τον γραφέα, ποτέ από το σώμα αιτήματος. */
export interface PriceListVersionSeal {
  readonly linesHash: string;
  readonly lineCount: number;
  readonly publishedAt: string;
  readonly publishedBy: string;
  /** Ο φράχτης που **ίσχυε** τη στιγμή της δημοσίευσης — όχι ο σημερινός. */
  readonly fenceBp: BasisPoints;
  /** Πόσες γραμμές πέρασαν τον φράχτη (0 ⇒ καμία επιβεβαίωση). */
  readonly fencedCount: number;
  /** Το αποτύπωμα της φραγμένης διαφοράς που **επιβεβαίωσε** ο άνθρωπος· `null` αν δεν χρειάστηκε. */
  readonly confirmedDiffDigest: string | null;
}

/**
 * Παράγωγα της έκδοσης — τα γράφει **μόνο** ο γραφέας (`stageDerived`), χωρίς αναθεώρηση:
 * - `linesRevision`: ανεβαίνει σε **κάθε** εγγραφή γραμμής. Η δημοσίευση κάνει CAS πάνω του, άρα δημοσιεύει
 *   **ακριβώς** τις γραμμές της διαφοράς που είδε ο άνθρωπος.
 * - `seed`: η αντιγραφή γραμμών από την έκδοση βάσης, σε τμήματα. Όσο `done = false`, η δημοσίευση αρνείται.
 */
export interface PriceListVersionDerived {
  readonly linesRevision: number;
  readonly seed: PriceVersionSeed | null;
}

/** Η πρόοδος της σποράς: πόσες γραμμές, μέχρι ποια γραμμή της πηγής (δρομέας = id εγγράφου), τελείωσε; */
export interface PriceVersionSeed {
  readonly fromVersionId: string;
  readonly copied: number;
  readonly cursor: string | null;
  readonly done: boolean;
}

/** Παράγωγα της γραμμής για τους δείκτες (γραμμές ανά έκδοση · ιστορικό τιμής υποκειμένου). */
export interface PriceListLineDerived {
  readonly subjectKey: string;
  readonly priceListId: string;
  readonly versionNumber: number;
}

export interface PriceListVersionDefinition {
  readonly priceListId: string;
  /** Αύξων αριθμός μέσα στον τιμοκατάλογο (1, 2, …) — η ανθρώπινη ταυτότητα της έκδοσης. */
  readonly number: number;
  readonly status: PriceListVersionStatus;
  /** Από πότε ισχύει (ISO). `null` επιτρέπεται **μόνο** σε πρόχειρο. */
  readonly validFrom: string | null;
  /** Η έκδοση από την οποία αντιγράφηκαν οι γραμμές («νέα έκδοση από την τρέχουσα»). */
  readonly basedOnVersionId: string | null;
  readonly seal: PriceListVersionSeal | null;
}

/** Η έκδοση όπως αποθηκεύεται: ορισμός + παράγωγα του γραφέα. */
export interface StoredPriceListVersionDefinition extends PriceListVersionDefinition {
  readonly derived: PriceListVersionDerived;
}

// ── Γραμμή ───────────────────────────────────────────────────────────────────

/** Χάρτης είδος → μορφή υποκειμένου. Δεμένος στη ρίζα `PriceLineSubjectKind` (CHECK 3.73). */
export interface PriceLineSubjectByKind {
  readonly variant: { readonly variantId: string };
  /** Εργασία ΑΤΟΕ του εσωτερικού master (ADR-175 §4.1.3), προαιρετικά ανά περιοχή. */
  readonly costItem: { readonly atoeCode: string; readonly region: string | null };
}

export type PriceLineSubject = {
  [K in PriceLineSubjectKind]: { readonly kind: K } & PriceLineSubjectByKind[K];
}[PriceLineSubjectKind];

/**
 * Ανάλυση τιμής εργασίας (rate build-up, ADR-175): η τιμή μονάδας **είναι** το άθροισμα των τριών.
 * Η φύρα εφαρμόζεται στην **ποσότητα** του BOQ, όχι στην τιμή — εδώ μόνο η προεπιλογή της.
 */
export interface CostBreakdown {
  readonly material: MinorAmount;
  readonly labor: MinorAmount;
  readonly equipment: MinorAmount;
  readonly defaultWasteBp: BasisPoints;
  /** Το SKU του υλικού (RIB iTWO: οι πόροι της ανάλυσης δείχνουν σε προϊόν). */
  readonly materialVariantId: string | null;
}

export interface PriceListLineDefinition {
  readonly versionId: string;
  readonly subject: PriceLineSubject;
  /** Καθαρή τιμή **χωρίς ΦΠΑ**, σε λεπτά, για `priceQuantity` μονάδες. */
  readonly netPrice: MinorAmount;
  readonly priceQuantity: PriceQuantity;
  readonly unitCode: string;
  readonly discountGroupId: string | null;
  /** Υποχρεωτική για `costItem`, απαγορευμένη για `variant`. */
  readonly breakdown: CostBreakdown | null;
}

/** Η γραμμή όπως αποθηκεύεται: ορισμός + παράγωγα για τους δείκτες. */
export interface StoredPriceListLineDefinition extends PriceListLineDefinition {
  readonly derived: PriceListLineDerived;
}

// ── Ομάδες ───────────────────────────────────────────────────────────────────

/** Ομάδα έκπτωσης SKU (DATANORM Rabattgruppe) — «TOSH-CARR». */
export interface DiscountGroupDefinition {
  readonly code: string;
  readonly labels: LocalizedText;
}

/** Ομάδα πελάτη που ορίζει ο προμηθευτής — «χονδρέμπορος». */
export interface CustomerGroupDefinition {
  readonly code: string;
  readonly labels: LocalizedText;
}

/** Ο συμβαλλόμενος: επαφή του προμηθευτή ή ολόκληρος χώρος του Νέστορα. */
export type PricingPartyRef =
  | { readonly kind: 'contact'; readonly contactId: string }
  | { readonly kind: 'workspace'; readonly companyId: string };

/** Συμβαλλόμενος → **μία** ομάδα πελάτη (SAP: μία ομάδα τιμής ανά πελάτη). */
export interface CustomerAssignmentDefinition {
  readonly party: PricingPartyRef;
  readonly customerGroupId: string;
}

// ── Κοινό και συνθήκη ────────────────────────────────────────────────────────

/** Χάρτης είδος κοινού → στοιχεία. Δεμένος στη ρίζα `AudienceKind` (CHECK 3.73). */
export interface PriceAudienceByKind {
  readonly anonymous: Record<never, never>;
  readonly signedIn: Record<never, never>;
  readonly customerGroup: { readonly customerGroupId: string };
  readonly partner: { readonly party: PricingPartyRef };
}

export type PriceAudience = {
  [K in AudienceKind]: { readonly kind: K } & PriceAudienceByKind[K];
}[AudienceKind];

/** Συνθήκη έκπτωσης: ομάδα έκπτωσης (ή `null` = όλες) × κοινό, με ισχύ `[validFrom, validUntil)`. */
export interface DiscountConditionDefinition {
  readonly discountGroupId: string | null;
  readonly audience: PriceAudience;
  readonly validFrom: string | null;
  readonly validUntil: string | null;
  readonly rule: DiscountRule;
}

/** Ποιος ρωτά την τιμή — το παράγει ο διακομιστής, ποτέ ο πελάτης (§12). */
export type PricingViewer =
  | { readonly kind: 'anonymous' }
  | {
      readonly kind: 'signedIn';
      readonly customerGroupId: string | null;
      readonly party: PricingPartyRef | null;
    };
