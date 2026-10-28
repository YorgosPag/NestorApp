/**
 * **Οι όψεις τιμών και ποια γραφή αγγίζει ποια** (ADR-923 §5.11 «3δ» Ζ · ADR-905 §2).
 *
 * Οι τιμές διαβάζονται **μόνο** από τον διακομιστή (κριτής `pricingView`)· η οθόνη μένει ζωντανή ακούγοντας **ένα**
 * έγγραφο-αριθμό ανά όψη. Αυτό το αρχείο είναι η **μία** απάντηση στο «ποια όψη αλλάζει όταν γράφεται αυτή η εγγραφή;»
 * — τη ρωτά ο γραφέας (μέσα στη μηχανή) και από τον ίδιο σπόρο ο πελάτης υπολογίζει ποιο έγγραφο ακούει.
 *
 * | Όψη | Τι δείχνει | Ποιες γραφές την αγγίζουν |
 * |---|---|---|
 * | `lists` | οι τιμοκατάλογοι του χώρου + η χρονογραμμή εκδόσεών τους | λίστα · έκδοση |
 * | `list:{id}` | ό,τι ανήκει σε ΕΝΑΝ τιμοκατάλογο (εκδόσεις, γραμμές) | λίστα · έκδοση · γραμμή |
 * | `discounts` | ομάδες έκπτωσης · ομάδες πελατών · αναθέσεις · συνθήκες | αυτά τα τέσσερα |
 *
 * 🔑 Η γραμμή **δεν** αγγίζει το `lists`· η συναλλαγή γραμμών όμως αγγίζει και την **έκδοση** (`linesRevision`), άρα το
 *    `lists` αυξάνεται **μία** φορά ανά συναλλαγή — ποτέ ανά γραμμή (`distinctPricingViews`): σπορά 4.000 γραμμών = 10 σήματα.
 * ⚠️ Καθαρό: καμία εισαγωγή διακομιστή — το είδος έρχεται ως συμβολοσειρά (`CatalogKind`).
 *
 * @module subapps/catalog/pricing/pricing-view-key
 */

export type PricingView =
  | { readonly kind: 'lists' }
  | { readonly kind: 'list'; readonly priceListId: string }
  | { readonly kind: 'discounts' };

const LISTS: PricingView = { kind: 'lists' };
const DISCOUNTS: PricingView = { kind: 'discounts' };

/** Ο σπόρος του id του σήματος — ίδιος για γραφέα και listener. */
export function pricingViewKey(view: PricingView): string {
  return view.kind === 'list' ? `list:${view.priceListId}` : view.kind;
}

const listOf = (priceListId: unknown): readonly PricingView[] =>
  typeof priceListId === 'string' && priceListId.length > 0 ? [{ kind: 'list', priceListId }] : [];

const derivedListId = (record: Readonly<Record<string, unknown>>): unknown => {
  const derived = record.derived;
  return typeof derived === 'object' && derived !== null ? (derived as { readonly priceListId?: unknown }).priceListId : undefined;
};

/** Οι όψεις που αλλάζει μια γραφή εγγραφής του είδους `kind` (κενό για είδη εκτός τιμολόγησης). */
export function pricingViewsOfWrite(kind: string, record: Readonly<Record<string, unknown>>): readonly PricingView[] {
  switch (kind) {
    case 'priceList':
      return [LISTS, ...listOf(record.id)];
    case 'priceListVersion':
      return [LISTS, ...listOf(record.priceListId)];
    case 'priceListLine':
      return listOf(derivedListId(record));
    case 'discountGroup':
    case 'customerGroup':
    case 'customerAssignment':
    case 'discountCondition':
      return [DISCOUNTS];
    default:
      return [];
  }
}

/** Οι όψεις χωρίς διπλότυπα (μία αύξηση ανά όψη ανά συναλλαγή, όσες γραφές κι αν την άγγιξαν). */
export function distinctPricingViews(views: Iterable<PricingView>): readonly PricingView[] {
  const byKey = new Map<string, PricingView>();
  for (const view of views) byKey.set(pricingViewKey(view), view);
  return [...byKey.values()];
}
