/**
 * =============================================================================
 * ΤΑ ΛΕΞΙΛΟΓΙΑ ΤΟΥ ΤΙΜΟΚΑΤΑΛΟΓΟΥ (ADR-923 §5.4 · §5.11 · §12) — ΡΙΖΕΣ, CHECK 3.73
 * =============================================================================
 *
 * | Λεξιλόγιο | Τιμές | Πηγή πρακτικής |
 * |---|---|---|
 * | κατάσταση έκδοσης | `draft → published → superseded` (+ `discarded`) | SAP condition records · ADR-175 |
 * | είδος τιμοκαταλόγου | `sales` (προς πελάτες) · `cost` (εσωτερικός master, απορροφά `boq_price_lists`) | ADR-175 §4.1.3 |
 * | τύπος τιμής | `net_list` · `net_customer` — **δεν αναμιγνύονται** | BMEcat `price_type` |
 * | κοινό | `anonymous` < `signedIn` < `customerGroup` < `partner` | §12 · SAP access sequence |
 * | υποκείμενο γραμμής | `variant` (SKU) · `costItem` (εργασία ΑΤΟΕ με ανάλυση) | RIB iTWO |
 *
 * 🔑 Σε τιμοκατάλογο `net_customer` η τιμή **είναι ήδη** η τιμή του πελάτη ⇒ εκεί δεν
 * εφαρμόζεται ομάδα έκπτωσης (BMEcat: «net_customer» = μετά από όλες τις εκπτώσεις).
 *
 * @module subapps/catalog/vocabulary/pricing
 */

import type { BasisPoints } from '@/lib/pricing/discount-rule';

// ── Κατάσταση έκδοσης ────────────────────────────────────────────────────────

export const PRICE_LIST_VERSION_STATUSES = ['draft', 'published', 'superseded', 'discarded'] as const;

export type PriceListVersionStatus = (typeof PRICE_LIST_VERSION_STATUSES)[number];

/** Οι καταστάσεις που **έχουν ισχύ** ως προς ημερομηνία: η δημοσίευση είναι αμετάκλητη. */
export function isPublishedStatus(status: PriceListVersionStatus): boolean {
  return status === 'published' || status === 'superseded';
}

/** Από τι ξεκινά μια νέα πρόχειρη έκδοση: κενή, ή αντίγραφο της τελευταίας δημοσιευμένης (σπορά, ADR-923 §5.11 «3β»). */
export const PRICE_VERSION_BASES = ['empty', 'latestPublished'] as const;

export type PriceVersionBasis = (typeof PRICE_VERSION_BASES)[number];

// ── Είδος τιμοκαταλόγου ──────────────────────────────────────────────────────

export const PRICE_LIST_KINDS = ['sales', 'cost'] as const;

export type PriceListKind = (typeof PRICE_LIST_KINDS)[number];

export function isPriceListKind(value: unknown): value is PriceListKind {
  return (PRICE_LIST_KINDS as readonly unknown[]).includes(value);
}

// ── Τύπος τιμής (BMEcat) ─────────────────────────────────────────────────────

export const PRICE_TYPES = ['net_list', 'net_customer'] as const;

export type PriceType = (typeof PRICE_TYPES)[number];

export function isPriceType(value: unknown): value is PriceType {
  return (PRICE_TYPES as readonly unknown[]).includes(value);
}

/** Δέχεται ο τύπος τιμής ομάδες έκπτωσης; Μόνο ο τιμοκατάλογος **λίστας**. */
export function acceptsDiscountGroups(priceType: PriceType): boolean {
  return priceType === 'net_list';
}

// ── Κοινό ────────────────────────────────────────────────────────────────────

export const AUDIENCE_KINDS = ['anonymous', 'signedIn', 'customerGroup', 'partner'] as const;

export type AudienceKind = (typeof AUDIENCE_KINDS)[number];

/**
 * Η ειδικότητα κάθε κοινού: ο **ειδικότερος** κανόνας νικά (§12 — συνεργάτης > κατηγορία >
 * συνδεδεμένος > ανώνυμος). `Record` ⇒ νέο κοινό χωρίς βαθμό σπάει τη μεταγλώττιση.
 */
export const AUDIENCE_SPECIFICITY: Readonly<Record<AudienceKind, number>> = {
  anonymous: 0,
  signedIn: 1,
  customerGroup: 2,
  partner: 3,
};

// ── Είδος ομάδας ─────────────────────────────────────────────────────────────

/**
 * Οι δύο ομάδες της τιμολόγησης — **ίδιο σχήμα** (κωδικός + ετικέτες), άλλος ρόλος: ομάδα έκπτωσης SKU (DATANORM
 * Rabattgruppe, «TOSH-CARR») · ομάδα πελάτη (SAP ομάδα τιμής πελάτη, «χονδρέμπορος»). Ένας γραφέας, ένας επεξεργαστής.
 */
export const PRICING_GROUP_KINDS = ['discountGroup', 'customerGroup'] as const;

export type PricingGroupKind = (typeof PRICING_GROUP_KINDS)[number];

// ── Υποκείμενο γραμμής ───────────────────────────────────────────────────────

export const PRICE_LINE_SUBJECT_KINDS = ['variant', 'costItem'] as const;

export type PriceLineSubjectKind = (typeof PRICE_LINE_SUBJECT_KINDS)[number];

// ── Αριθμητικά όρια ──────────────────────────────────────────────────────────

/** Ποσότητα τιμής (BMEcat `PRICE_QUANTITY`): η τιμή αφορά 1, 10, 100 ή 1.000 μονάδες. */
export const PRICE_QUANTITIES = [1, 10, 100, 1000] as const;

export type PriceQuantity = (typeof PRICE_QUANTITIES)[number];

export function isPriceQuantity(value: unknown): value is PriceQuantity {
  return (PRICE_QUANTITIES as readonly unknown[]).includes(value);
}

/** Ποσότητα παραγγελίας: δεκαδικά ψηφία που δέχεται η μηχανή (μέτρα καλωδίου: 12,5 · 0,125). */
export const ORDER_QUANTITY_DECIMALS = 3;

/**
 * Φράχτης δημοσίευσης (§18): γραμμή που αλλάζει τιμή **πάνω** από αυτό ⇒ η δημοσίευση θέλει
 * ρητή επιβεβαίωση. 20% — αρκετό για ετήσια αναπροσαρμογή, αρκετά μικρό για να πιάσει ένα
 * χαμένο μηδενικό του ERP (×10 = +900%).
 */
export const PRICE_CHANGE_FENCE_BP: BasisPoints = 2000;

/**
 * Τα όρια της παράκαμψης ανά τιμοκατάλογο (ADR-923 §5.11 απόφαση Β): κάτω από 5% κάθε ετήσια
 * αναπροσαρμογή θα ζητούσε επιβεβαίωση (ο φράχτης θα γινόταν θόρυβος)· πάνω από 50% δεν πιάνει πια
 * ούτε διπλασιασμό από λάθος.
 */
export const PRICE_CHANGE_FENCE_MIN_BP: BasisPoints = 500;
export const PRICE_CHANGE_FENCE_MAX_BP: BasisPoints = 5000;

/** Ο φράχτης που **ισχύει** για μια λίστα: η δική της παράκαμψη, αλλιώς της πλατφόρμας. */
export function effectiveFenceBp(changeFenceBp: BasisPoints | null): BasisPoints {
  return changeFenceBp ?? PRICE_CHANGE_FENCE_BP;
}

/**
 * Γραμμές ανά συναλλαγή (δέσμη επικόλλησης · τμήμα σποράς έκδοσης). Κάτω από το όριο των 500 εγγραφών ανά
 * συναλλαγή του Firestore, με περιθώριο για την έκδοση και τις υποδοχές της ίδιας συναλλαγής.
 */
export const PRICE_LINES_PER_TRANSACTION = 400;

/** Βήματα σε αλυσίδα («50+10+5+2+2» είναι ήδη ακραίο). */
export const MAX_DISCOUNT_STEPS = 5;

/** Κλίμακες ανά συνθήκη. */
export const MAX_DISCOUNT_TIERS = 20;
