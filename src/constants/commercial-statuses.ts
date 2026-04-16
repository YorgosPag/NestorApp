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

// =============================================================================
// 2. RUNTIME TYPE GUARD
// =============================================================================

/** Returns `true` if `value` is one of the 7 canonical commercial statuses. */
export function isCommercialStatus(value: unknown): value is CommercialStatus {
  return (
    typeof value === 'string' &&
    (COMMERCIAL_STATUSES as readonly string[]).includes(value)
  );
}

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

export type FinalizedCommercialStatus =
  (typeof FINALIZED_COMMERCIAL_STATUSES)[number];

/** Returns `true` if `value` represents an active market listing. */
export function isListedCommercialStatus(
  value: unknown,
): value is ListedCommercialStatus {
  return (
    typeof value === 'string' &&
    (LISTED_COMMERCIAL_STATUSES as readonly string[]).includes(value)
  );
}

/** Returns `true` if `value` represents a finalized transaction. */
export function isFinalizedCommercialStatus(
  value: unknown,
): value is FinalizedCommercialStatus {
  return (
    typeof value === 'string' &&
    (FINALIZED_COMMERCIAL_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Semantic alias: statuses που απαιτούν δήλωση `askingPrice` πριν από
 * οποιαδήποτε sales/rental ενέργεια. Delegates στο `isListedCommercialStatus`
 * — SSoT: η λίστα ορίζεται μία φορά στο `LISTED_COMMERCIAL_STATUSES`.
 *
 * Χρήση: UX hints σε property creation / edit forms για να υπενθυμίσουν
 * στον χρήστη ότι τα listings χωρίς τιμή δεν εμφανίζονται σε sales dashboards.
 */
export function requiresAskingPrice(
  value: unknown,
): value is ListedCommercialStatus {
  return isListedCommercialStatus(value);
}

/**
 * Semantic alias: statuses που απαιτούν δήλωση μεικτού εμβαδού (`areaGross`)
 * πριν εμφανιστούν σε sales/rental dashboards & listings. Delegates στο
 * `isListedCommercialStatus` — SSoT: η λίστα παραμένει στο
 * `LISTED_COMMERCIAL_STATUSES`. Αν προστεθεί νέο listed status, όλοι οι
 * semantic aliases ενημερώνονται αυτόματα.
 *
 * Χρήση: UX hints για να υπενθυμίσουν στον χρήστη ότι listings χωρίς
 * μεικτό εμβαδό δεν μπορούν να υπολογίσουν €/m² και αποκλείονται από
 * sales/rental dashboards.
 */
export function requiresGrossArea(
  value: unknown,
): value is ListedCommercialStatus {
  return isListedCommercialStatus(value);
}

// =============================================================================
// 3b. DISPLAY ELIGIBILITY GATE — Single SSoT for sales/rental dashboards
// =============================================================================
//
// Εμφάνιση σε sales dashboards & customer-facing listings (public vetrina)
// απαιτεί και τα τρία:
//   1) listed commercialStatus (for-sale / for-rent / for-sale-and-rent)
//   2) askingPrice > 0
//   3) grossArea > 0
//
// Coerent με το UX contract του `SalesDashboardRequirementsAlert`: όταν ο
// alert εμφανίζεται, το property δεν πρέπει να εμφανίζεται στις δημόσιες
// λίστες/πίνακες. Ένας κοινός gate evita drift ανάμεσα σε UI promise και
// query behavior (Google pattern: UI = contract).

/** Input contract για το display-eligibility gate. Agnostic σε data shape. */
export interface SalesDisplayEligibilityInput {
  commercialStatus?: CommercialStatus | string | null;
  askingPrice?: number | null;
  grossArea?: number | null;
}

/**
 * Returns `true` αν το property πληροί όλες τις προϋποθέσεις για εμφάνιση
 * σε sales/rental dashboards & customer-facing listings.
 *
 * Συμπεριφορά:
 *   - Listed status required (μέσω `isListedCommercialStatus`).
 *   - `askingPrice` πρέπει να είναι **θετικός αριθμός** (> 0). null/0/negative → excluded.
 *   - `grossArea` πρέπει να είναι **θετικός αριθμός** (> 0). null/0/negative → excluded.
 *
 * Η σειρά είναι μη-σημασιολογική (όλα required), αλλά short-circuit για
 * performance σε μεγάλες λίστες: status πρώτο (φθηνό string check).
 *
 * @see SalesDashboardRequirementsAlert — UI counterpart του gate.
 * @see ADR-287 Batch 18 — SSoT for sales dashboard display eligibility.
 */
export function isDisplayableInSalesDashboard(
  input: SalesDisplayEligibilityInput,
): boolean {
  if (!isListedCommercialStatus(input.commercialStatus)) return false;

  const price = input.askingPrice;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return false;
  }

  const area = input.grossArea;
  if (typeof area !== 'number' || !Number.isFinite(area) || area <= 0) {
    return false;
  }

  return true;
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
