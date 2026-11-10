/**
 * **Οι όψεις του καταλόγου που παράγει ο διακομιστής, και ποια γραφή αγγίζει ποια** (ADR-923 §5.11 «3δ» Ζ · §5.5.2 · ADR-905 §2).
 *
 * Οι όψεις αυτές διαβάζονται **μόνο** από τον διακομιστή· η οθόνη μένει ζωντανή ακούγοντας **ένα** έγγραφο-αριθμό ανά όψη.
 * Αυτό το αρχείο είναι η **μία** απάντηση στο «ποια όψη αλλάζει όταν γράφεται αυτή η εγγραφή;» — τη ρωτά ο γραφέας
 * (μέσα στη μηχανή) και από τον ίδιο σπόρο ο πελάτης υπολογίζει ποιο έγγραφο ακούει.
 *
 * | Όψη | Τι δείχνει | Ποιες γραφές την αγγίζουν | Τιμές; |
 * |---|---|---|---|
 * | `lists` | οι τιμοκατάλογοι του χώρου + η χρονογραμμή εκδόσεών τους | λίστα · έκδοση | ✅ |
 * | `list:{id}` | ό,τι ανήκει σε ΕΝΑΝ τιμοκατάλογο (εκδόσεις, γραμμές) | λίστα · έκδοση · γραμμή | ✅ |
 * | `discounts` | ομάδες έκπτωσης · ομάδες πελατών · αναθέσεις · συνθήκες · κανόνες ορατότητας | αυτά τα πέντε | ✅ |
 * | `supply` | οι σχέσεις προμήθειας ενός χώρου (§5.12) | ο γραφέας της σχέσης, στους δύο χώρους (έξω από τη μηχανή) | — |
 * | `importBatch:{id}` | μία παρτίδα εισαγωγής και οι προτάσεις της (§5.5.2) | παρτίδα · πρόταση | — |
 *
 * 🔑 Η γραμμή **δεν** αγγίζει το `lists`· η συναλλαγή γραμμών όμως αγγίζει και την **έκδοση** (`linesRevision`), άρα το
 *    `lists` αυξάνεται **μία** φορά ανά συναλλαγή — ποτέ ανά γραμμή (`distinctCatalogViews`): σπορά 4.000 γραμμών = 10 σήματα.
 * 🔴 **Όψη ≠ τιμή.** Η βιτρίνα ρωτά «άλλαξαν τιμές;» **μόνο** μέσω `isPricingView` — ποτέ «υπάρχει σήμα;» (αλλιώς κάθε κλικ
 *    εισαγωγής θα ακύρωνε τις δημόσιες τιμές).
 * ⚠️ Τα **φυσικά** ονόματα μένουν όπως γεννήθηκαν (`catalog_pricing_view_signals`, `generateDeterministicCatalogPricingViewSignalId`):
 *    ίδια ids ⇒ υπάρχοντα έγγραφα και listeners συνεχίζουν, μηδέν μετάπτωση. Το λεξιλόγιο γενικεύτηκε, η αποθήκευση όχι.
 * ⚠️ Καθαρό: καμία εισαγωγή διακομιστή — το είδος έρχεται ως συμβολοσειρά (`CatalogKind`).
 *
 * @module subapps/catalog/views/catalog-view-key
 */

/** Οι όψεις **τιμών** — το κλειστό σύνολο που ρωτά η βιτρίνα. */
export type PricingView =
  | { readonly kind: 'lists' }
  | { readonly kind: 'list'; readonly priceListId: string }
  | { readonly kind: 'discounts' };

export type CatalogView =
  | PricingView
  /** ADR-923 §5.12: οι σχέσεις προμήθειας ενός χώρου, από όποια πλευρά. Τη σηματοδοτεί ο γραφέας της σχέσης, στους δύο χώρους. */
  | { readonly kind: 'supply' }
  /** ADR-923 §5.5.2: μία παρτίδα εισαγωγής και οι προτάσεις της — ζωντανή σε κάθε ανοιχτή καρτέλα. */
  | { readonly kind: 'importBatch'; readonly batchId: string };

const LISTS: CatalogView = { kind: 'lists' };
const DISCOUNTS: CatalogView = { kind: 'discounts' };

/** Ο σπόρος του id του σήματος — ίδιος για γραφέα και listener. */
export function catalogViewKey(view: CatalogView): string {
  switch (view.kind) {
    case 'list': return `list:${view.priceListId}`;
    case 'importBatch': return `importBatch:${view.batchId}`;
    default: return view.kind;
  }
}

/** Αλλάζει αυτή η όψη **τιμές**; — η μία απάντηση για τη βιτρίνα (`showcasePricesTouched`). */
export function isPricingView(view: CatalogView): view is PricingView {
  return view.kind === 'lists' || view.kind === 'list' || view.kind === 'discounts';
}

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

const listOf = (priceListId: unknown): readonly CatalogView[] => (nonEmpty(priceListId) ? [{ kind: 'list', priceListId }] : []);

const batchOf = (batchId: unknown): readonly CatalogView[] => (nonEmpty(batchId) ? [{ kind: 'importBatch', batchId }] : []);

const derivedListId = (record: Readonly<Record<string, unknown>>): unknown => {
  const derived = record.derived;
  return typeof derived === 'object' && derived !== null ? (derived as { readonly priceListId?: unknown }).priceListId : undefined;
};

/** Οι όψεις που αλλάζει μια γραφή εγγραφής του είδους `kind` (κενό για είδη χωρίς ζωντανή όψη). */
export function catalogViewsOfWrite(kind: string, record: Readonly<Record<string, unknown>>): readonly CatalogView[] {
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
    case 'visibilityRule':
      return [DISCOUNTS];
    case 'importBatch':
      return batchOf(record.id);
    case 'importProposal':
      return batchOf(record.batchId);
    default:
      return [];
  }
}

/** Οι όψεις χωρίς διπλότυπα (μία αύξηση ανά όψη ανά συναλλαγή, όσες γραφές κι αν την άγγιξαν). */
export function distinctCatalogViews(views: Iterable<CatalogView>): readonly CatalogView[] {
  const byKey = new Map<string, CatalogView>();
  for (const view of views) byKey.set(catalogViewKey(view), view);
  return [...byKey.values()];
}
