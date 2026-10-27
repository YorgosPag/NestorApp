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

// ── Είδος τιμοκαταλόγου ──────────────────────────────────────────────────────

export const PRICE_LIST_KINDS = ['sales', 'cost'] as const;

export type PriceListKind = (typeof PRICE_LIST_KINDS)[number];

// ── Τύπος τιμής (BMEcat) ─────────────────────────────────────────────────────

export const PRICE_TYPES = ['net_list', 'net_customer'] as const;

export type PriceType = (typeof PRICE_TYPES)[number];

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

/** Βήματα σε αλυσίδα («50+10+5+2+2» είναι ήδη ακραίο). */
export const MAX_DISCOUNT_STEPS = 5;

/** Κλίμακες ανά συνθήκη. */
export const MAX_DISCOUNT_TIERS = 20;
