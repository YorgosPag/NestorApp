/**
 * =============================================================================
 * SSoT: CommercialStatus Canonical Definitions
 * =============================================================================
 *
 * **Single Source of Truth** για το commercial (sales/rental) status ενός unit.
 * Πριν από αυτό το module, το ίδιο concept οριζόταν δύο φορές:
 *   - inline union στο `src/types/property.ts`
 *   - duplicated array στο `src/config/report-builder/domain-definitions.ts`
 *
 * **Layering**: Leaf module — **καμία** εξάρτηση από components, hooks, services.
 * Ασφαλές για import παντού (server, client, tests).
 *
 * **Προσθήκη νέας κατάστασης**: Πρόσθεσε entry στο `COMMERCIAL_STATUSES` array +
 * i18n keys σε `properties-enums.json`. Τα πάντα άλλα derive αυτόματα.
 *
 * @module constants/commercial-statuses
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 9)
 * @see ADR-197 — Sales Pages Implementation (canonical origin)
 */

// =============================================================================
// 1. CANONICAL ARRAY — Single point of addition για νέες καταστάσεις
// =============================================================================

/**
 * All canonical CommercialStatus values, in natural lifecycle order.
 *
 * - `unavailable`         — Μη διαθέσιμη (default — not on market)
 * - `for-sale`            — Προς πώληση
 * - `for-rent`            — Προς ενοικίαση
 * - `for-sale-and-rent`   — Πώληση & Ενοικίαση (dual listing)
 * - `reserved`            — Κρατημένη (προκαταβολή)
 * - `sold`                — Πωλημένη
 * - `rented`              — Ενοικιασμένη
 */
export const COMMERCIAL_STATUSES = [
  'unavailable',
  'for-sale',
  'for-rent',
  'for-sale-and-rent',
  'reserved',
  'sold',
  'rented',
] as const;

/** Canonical TypeScript union — derived automatically from `COMMERCIAL_STATUSES`. */
export type CommercialStatus = (typeof COMMERCIAL_STATUSES)[number];

/**
 * Default commercial disposition for a freshly-created unit.
 *
 * Revit / Yardi / SAP RE-FX pattern: a new unit is **not on the market** until
 * a user explicitly lists it. NEVER default to `for-sale` or `reserved` — those
 * are deliberate sales actions, not creation side-effects.
 *
 * @see ADR-197 — Sales Pages Implementation (single disposition field)
 */
export const DEFAULT_COMMERCIAL_STATUS: CommercialStatus = 'unavailable';

/**
 * SSoT mirror: derive the **legacy** `status` field value from the canonical
 * `commercialStatus`.
 *
 * The legacy `status` field (`PropertyStatus`, `@deprecated` in `types/property.ts`)
 * is kept ONLY for backward-compat with old readers (search index pre-migration,
 * dashboards). Its value MUST always equal the canonical `commercialStatus` —
 * never diverge. `CommercialStatus` is a structural subset of `PropertyStatus`
 * (identical tokens), so the mirror is an identity map after normalization.
 *
 * Single writer rule: only property write paths (create route, PATCH route,
 * mutation gateway) call this. UI code MUST NOT hardcode legacy `status` values.
 *
 * @param commercialStatus — canonical commercial status (or any normalizable input)
 * @returns the canonical `CommercialStatus` token to mirror into legacy `status`,
 *          falling back to {@link DEFAULT_COMMERCIAL_STATUS} when unresolvable.
 */
export function deriveLegacyStatusFromCommercial(
  commercialStatus: unknown,
): CommercialStatus {
  return normalizeCommercialStatus(commercialStatus) ?? DEFAULT_COMMERCIAL_STATUS;
}

// =============================================================================
// 2. RUNTIME TYPE GUARD
// =============================================================================

// =============================================================================
// 3. DERIVED SUBSETS — Active listings vs finalized transactions
// =============================================================================

/**
 * Statuses που σημαίνουν ενεργή διάθεση στην αγορά (listed for a transaction).
 * Χρησιμοποιείται από sales dashboards / available-properties filters.
 */
export const LISTED_COMMERCIAL_STATUSES = [
  'for-sale',
  'for-rent',
  'for-sale-and-rent',
] as const satisfies readonly CommercialStatus[];

export type ListedCommercialStatus = (typeof LISTED_COMMERCIAL_STATUSES)[number];

/**
 * Statuses που σημαίνουν ολοκληρωμένη συναλλαγή (finalized deal).
 * Χρησιμοποιείται από reports / revenue aggregators.
 */
export const FINALIZED_COMMERCIAL_STATUSES = [
  'sold',
  'rented',
] as const satisfies readonly CommercialStatus[];

/**
 * Η κατάσταση «πωλήθηκε», ονομασμένη — για **ερωτήματα** Firestore, όπου δεν
 * μπορεί να μπει κατηγόρημα και ένα ωμό `'sold'` αποκλίνει σιωπηλά.
 *
 * @see ADR-777 Α20 — το `commercialStatus` είναι πλέον ΠΑΡΑΓΟΜΕΝΟ από τις
 *      διαθέσεις, άρα κάθε τιμή σε ερώτημα οφείλει να προέρχεται από εδώ.
 */
export const SOLD_COMMERCIAL_STATUS: CommercialStatus = 'sold';

/** Returns `true` if `value` represents an active market listing. */
export function isListedCommercialStatus(
  value: unknown,
): value is ListedCommercialStatus {
  return (
    typeof value === 'string' &&
    (LISTED_COMMERCIAL_STATUSES as readonly string[]).includes(value)
  );
}


/**
 * Semantic alias: statuses που απαιτούν δήλωση `askingPrice` (τιμή πώλησης).
 * Περιλαμβάνει `for-sale` και `for-sale-and-rent` — ΕΞΑΙΡΕΙ `for-rent` (που
 * απαιτεί μόνο `rentPrice`, όχι asking price).
 *
 * Χρήση: UX hints σε property forms για να υπενθυμίσουν ότι τα listings
 * χωρίς τιμή πώλησης δεν εμφανίζονται σε sales dashboards.
 */
export function requiresAskingPrice(
  value: unknown,
): value is 'for-sale' | 'for-sale-and-rent' {
  return value === 'for-sale' || value === 'for-sale-and-rent';
}

/**
 * Statuses που απαιτούν δήλωση `rentPrice` (μηνιαίο ενοίκιο):
 * `for-rent` και `for-sale-and-rent`.
 *
 * Χρήση: UX hints σε property forms για να υπενθυμίσουν ότι τα rental
 * listings χωρίς μηνιαίο ενοίκιο δεν εμφανίζονται σε rental dashboards.
 */
export function requiresRentPrice(
  value: unknown,
): value is 'for-rent' | 'for-sale-and-rent' {
  return value === 'for-rent' || value === 'for-sale-and-rent';
}

// =============================================================================
// 3b. DISPLAY ELIGIBILITY GATE — Single SSoT for sales/rental dashboards
// =============================================================================
//
// Εμφάνιση σε sales/rental dashboards & customer-facing listings απαιτεί:
//   1) listed commercialStatus (for-sale / for-rent / for-sale-and-rent)
//   2) **τις τιμές που ζητά Η ΙΔΙΑ Η ΚΑΤΑΣΤΑΣΗ** — μέσω `requiresAskingPrice`
//      / `requiresRentPrice`, δηλαδή ΤΑ ΙΔΙΑ δύο κατηγορήματα που καταναλώνει
//      και ο `SalesDashboardRequirementsAlert`
//   3) grossArea > 0
//
// 🔴 ΓΙΑΤΙ ΤΟ (2) ΓΡΑΦΤΗΚΕ ΞΑΝΑ (ADR-777 §8.2 ανοιχτό #1, 2026-08-09).
// Μέχρι σήμερα αυτό το gate απαιτούσε `askingPrice > 0` **χωρίς κανέναν κλάδο
// για την κατάσταση**, ενώ ο κώδικας δηλώνει σε ΤΕΣΣΕΡΑ σημεία ότι μια
// ενοικίαση δεν έχει τιμή πώλησης:
//   (α) `requiresAskingPrice` παραπάνω **εξαιρεί ρητά** το `for-rent`
//   (β) `requiresRentPrice` υπάρχει ως ξεχωριστός κανόνας
//   (γ) `PropertyCommercialPriceFields` **δεν ζωγραφίζει καν** το πεδίο
//       askingPrice όταν η κατάσταση είναι `for-rent`
//   (δ) το ίδιο component περνά `askingPrice: undefined` στο alert εκεί
// ⇒ ένα ακίνητο **μόνο προς ενοικίαση** δεν περνούσε ΠΟΤΕ αυτή την πύλη, και
// ο ιδιοκτήτης **δεν είχε καμία ενέργεια** να το διορθώσει: το πεδίο που του
// ζητούσε σιωπηλά η πύλη **δεν υπάρχει στην οθόνη του**. Δεν ήταν δύσκολο —
// ήταν αδύνατο εκ κατασκευής.
//
// 🔴 ΚΑΙ Ο ΙΣΧΥΡΙΣΜΟΣ ΣΥΜΦΩΝΙΑΣ ΗΤΑΝ ΨΕΥΔΗΣ. Το προηγούμενο σχόλιο εδώ έλεγε
// «Coerent με το UX contract του `SalesDashboardRequirementsAlert` … evita
// drift ανάμεσα σε UI promise και query behavior». Για `for-rent` το alert
// **σβήνει** μόλις συμπληρωθούν ενοίκιο + εμβαδόν — δηλαδή **υπόσχεται**
// εμφάνιση που η πύλη αρνιόταν. Ένα σχόλιο που δηλώνει συμφωνία δεν είναι
// συμφωνία· η συμφωνία είναι να **καταναλώνουν τα ίδια κατηγορήματα**, που
// είναι ακριβώς αυτό που κάνουν τώρα οι δύο πλευρές.
// (Το ίδιο σχόλιο παρέπεμπε και σε `requiresGrossArea()` — συνάρτηση που
// **δεν υπήρξε ποτέ**· το εμβαδόν ζητείται ανεξαρτήτως κατάστασης.)
//
// ⚠️ ΔΗΛΩΜΕΝΗ ΣΥΝΕΠΕΙΑ ΓΙΑ ΤΟ `for-sale-and-rent`: η συμμετρία το κάνει
// **αυστηρότερο** — ζητά ΚΑΙ τιμή πώλησης ΚΑΙ ενοίκιο, όπως ακριβώς ζητά και
// το alert. Ένα διπλό listing με μία μόνο τιμή **κόβει σιωπηλά τη μισή
// προσφορά** (ίδιο σκεπτικό με το `secondary` του price-resolver), οπότε
// σύμφωνα με την απόφαση του Giorgio (2026-08-09) δεν δημοσιεύεται — αλλά ο
// ιδιοκτήτης **το μαθαίνει** από το alert.
//
// @see ADR-777 Α6/Α7 · §8.2 ανοιχτό #1 — απόφαση Giorgio 2026-08-09

/** Input contract για το display-eligibility gate. Agnostic σε data shape. */
export interface SalesDisplayEligibilityInput {
  commercialStatus?: CommercialStatus | string | null;
  askingPrice?: number | null;
  /**
   * Μηνιαίο ενοίκιο. Απαιτείται **μόνο** για τις καταστάσεις που το ζητούν
   * (`requiresRentPrice`) — και τότε είναι εξίσου δεσμευτικό με το askingPrice.
   */
  rentPrice?: number | null;
  grossArea?: number | null;
}

/** Θετικός, πεπερασμένος αριθμός. `null` / `0` / αρνητικό / NaN → όχι τιμή. */
function isPositiveAmount(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Returns `true` αν το property πληροί όλες τις προϋποθέσεις για εμφάνιση
 * σε sales/rental dashboards & customer-facing listings.
 *
 * Συμπεριφορά:
 *   - Listed status required (μέσω `isListedCommercialStatus`).
 *   - `askingPrice > 0` **μόνο αν** `requiresAskingPrice(status)`.
 *   - `rentPrice > 0` **μόνο αν** `requiresRentPrice(status)`.
 *   - `grossArea > 0` **πάντα** (ανεξαρτήτως κατάστασης).
 *
 * Η σειρά είναι μη-σημασιολογική (όλα required), αλλά short-circuit για
 * performance σε μεγάλες λίστες: status πρώτο (φθηνό string check).
 *
 * @see SalesDashboardRequirementsAlert — καταναλώνει τα **ίδια** κατηγορήματα.
 * @see ADR-287 Batch 18 — SSoT for sales dashboard display eligibility.
 */
export function isDisplayableInSalesDashboard(
  input: SalesDisplayEligibilityInput,
): boolean {
  const status = input.commercialStatus;
  if (!isListedCommercialStatus(status)) return false;

  if (requiresAskingPrice(status) && !isPositiveAmount(input.askingPrice)) {
    return false;
  }

  if (requiresRentPrice(status) && !isPositiveAmount(input.rentPrice)) {
    return false;
  }

  return isPositiveAmount(input.grossArea);
}

// =============================================================================
// 4. ALIAS RESOLUTION — Greek ↔ English normalization (ADR-287 Batch 10A)
// =============================================================================
//
// Consumers across the codebase (AI pipeline, legacy Firestore data, admin
// commands) receive status values σε πολλαπλές μορφές:
//   - Canonical English: 'for-sale', 'sold', 'reserved', ...
//   - Legacy English:    'available' (→ 'for-sale'), 'off-market' (→ 'unavailable')
//   - Greek (user text): 'πωλημένο', 'κρατημένο', 'ενοικιασμένο', 'προς πώληση', ...
//
// Ο `normalizeCommercialStatus()` resolver παρέχει το **μοναδικό σημείο**
// μετατροπής από οποιαδήποτε από αυτές τις μορφές στην canonical τιμή,
// εξαλείφοντας hardcoded if/else chains σε consumers (π.χ. UC-013 admin stats).

/**
 * Alias map: user-facing / legacy input → canonical `CommercialStatus`.
 *
 * Keys αποθηκεύονται **lowercase** — ο resolver κάνει `.toLowerCase()` στην είσοδο
 * πριν το lookup. Περιέχει:
 *   - Canonical values (self-mapping) για idempotency
 *   - Legacy English ('available', 'off-market')
 *   - Greek aliases σε πολλαπλές μορφές (με/χωρίς τόνους, verbal tenses)
 *
 * **Προσθήκη νέου alias**: Πρόσθεσε entry εδώ — δεν χρειάζεται αλλαγή αλλού.
 */
export const COMMERCIAL_STATUS_ALIASES: Record<string, CommercialStatus> = {
  // Canonical (self-mapping — guarantees idempotency)
  'unavailable': 'unavailable',
  'for-sale': 'for-sale',
  'for-rent': 'for-rent',
  'for-sale-and-rent': 'for-sale-and-rent',
  'reserved': 'reserved',
  'sold': 'sold',
  'rented': 'rented',

  // Legacy English variants
  'available': 'for-sale',
  'off-market': 'unavailable',
  'for sale': 'for-sale',
  'for rent': 'for-rent',

  // Greek — πωλημένο / sold
  'πωλημένο': 'sold',
  'πωλημενο': 'sold',
  'πωλημένη': 'sold',
  'πωλημενη': 'sold',
  'πωλήθηκε': 'sold',
  'πωληθηκε': 'sold',
  'πουλημένο': 'sold',
  'πουλημενο': 'sold',

  // Greek — κρατημένο / reserved
  'κρατημένο': 'reserved',
  'κρατημενο': 'reserved',
  'κρατημένη': 'reserved',
  'κρατημενη': 'reserved',
  'προκρατημένο': 'reserved',
  'προκρατημενο': 'reserved',

  // Greek — ενοικιασμένο / rented
  'ενοικιασμένο': 'rented',
  'ενοικιασμενο': 'rented',
  'ενοικιασμένη': 'rented',
  'ενοικιασμενη': 'rented',
  'ενοικιάστηκε': 'rented',
  'ενοικιαστηκε': 'rented',

  // Greek — προς πώληση / for-sale
  'προς πώληση': 'for-sale',
  'προς πωληση': 'for-sale',
  'διαθέσιμο': 'for-sale',
  'διαθεσιμο': 'for-sale',
  'διαθέσιμη': 'for-sale',
  'διαθεσιμη': 'for-sale',
  'αδιάθετο': 'for-sale',
  'αδιαθετο': 'for-sale',

  // Greek — προς ενοικίαση / for-rent
  'προς ενοικίαση': 'for-rent',
  'προς ενοικιαση': 'for-rent',

  // Greek — προς πώληση & ενοικίαση / for-sale-and-rent
  'προς πώληση & ενοικίαση': 'for-sale-and-rent',
  'προς πωληση & ενοικιαση': 'for-sale-and-rent',
  'πώληση & ενοικίαση': 'for-sale-and-rent',
  'πωληση & ενοικιαση': 'for-sale-and-rent',

  // Greek — μη διαθέσιμο / unavailable
  'μη διαθέσιμο': 'unavailable',
  'μη διαθεσιμο': 'unavailable',
  'μη διαθέσιμη': 'unavailable',
  'μη διαθεσιμη': 'unavailable',
};

/**
 * Normalize any user-facing or legacy input to the canonical `CommercialStatus`.
 *
 * Safe to call with untrusted input (Firestore data, AI-extracted entities,
 * user message text). Returns `null` αν το value δεν αντιστοιχεί σε γνωστό
 * alias — ο consumer μπορεί να ταξινομήσει ως "other" ή να το απορρίψει.
 *
 * @param raw — Οποιοδήποτε string (με ή χωρίς whitespace, case-insensitive)
 * @returns Canonical `CommercialStatus` ή `null` αν unknown
 *
 * @example
 * normalizeCommercialStatus('πωλημένο')        // → 'sold'
 * normalizeCommercialStatus('  AVAILABLE  ')   // → 'for-sale'
 * normalizeCommercialStatus('sold')            // → 'sold' (idempotent)
 * normalizeCommercialStatus('κάτι τυχαίο')     // → null
 */
export function normalizeCommercialStatus(
  raw: unknown,
): CommercialStatus | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  if (key.length === 0) return null;
  return COMMERCIAL_STATUS_ALIASES[key] ?? null;
}
