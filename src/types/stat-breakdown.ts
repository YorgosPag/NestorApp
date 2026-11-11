/**
 * @fileoverview **Υποσύνολα κάρτας στατιστικού — το σχήμα, ανεξάρτητο από το μέγεθος** (ADR-777 §8.101).
 * @module types/stat-breakdown
 * @related lib/listings/listing-price-label.ts (`priceTotalsView` — τιμή ανά ρόλο) ·
 *   lib/properties/display-area-label.ts (`areaTotalsView` — εμβαδόν ανά είδος) ·
 *   components/shared/stat-breakdown/StatBreakdown.tsx (ο ΕΝΑΣ ζωγράφος)
 *
 * 🔑 Ο κανόνας είναι ο ίδιος για **κάθε** μέγεθος που δεν αθροίζεται σε έναν αριθμό: ποσά άλλης μονάδας (πώληση ·
 * ενοίκιο) **ή** εμβαδά άλλου είδους (μικτό · καθαρό) απαντώνται **χωριστά**, κάθε γραμμή με την κλάση και το πλήθος της
 * (Revit *Footer → «Title, count, and totals»* · ArchiCAD: στήλη Gross και στήλη Net, η καθεμιά με το σύνολό της).
 * Ως τις 2026-11-11 το σχήμα λεγόταν `PriceTotalsRow`/`priceBreakdown` ⇒ το εμβαδόν δεν είχε πού να πάει και η
 * καρτέλα Μονάδων κτιρίου τύπωνε **ένα** «Συν. Εμβαδόν» από μικτά **και** καθαρά.
 */

/**
 * Μία γραμμή υποσυνόλου: **η κλάση με το πλήθος της**, και το μέγεθος **με τη μονάδα/το είδος του**.
 * `value: null` ⇒ η κλάση **δεν έχει** μέγεθος (χωρίς τιμή · χωρίς εμβαδόν) — ονομάζεται, δεν μηδενίζεται.
 */
export interface StatBreakdownRow {
  readonly key: string;
  readonly label: string;
  readonly value: string | null;
}

/**
 * Η απάντηση μιας κάρτας: **είτε** ένα μέγεθος **είτε** υποσύνολα — ποτέ και τα δύο.
 * ⚠️ Τα ονόματα ταιριάζουν επίτηδες με την κάρτα (`value` · `breakdown`), ώστε η σελίδα να γράφει
 * `{ title, ...xxxTotalsView(…), icon }` χωρίς να μεταφέρει πεδία.
 */
export interface StatBreakdownView {
  /** Το μέγεθος της μίας κλάσης, ή {@link EMPTY_STAT_VALUE}· κενό όταν μιλούν τα υποσύνολα. */
  readonly value: string;
  /** Κενό ⇔ **μία** κλάση: η επιγραφή δεν θα πρόσθετε τίποτα. */
  readonly breakdown: readonly StatBreakdownRow[];
}

/** «Δεν υπάρχει μέγεθος να δειχτεί». Τυπογραφικό σύμβολο, ίδιο σε κάθε γλώσσα — όχι κείμενο (N.11). Ποτέ «0». */
export const EMPTY_STAT_VALUE = '—';
