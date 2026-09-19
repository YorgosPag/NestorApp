/**
 * =============================================================================
 * SSoT: η ΚΑΤΑΣΤΑΣΗ ενός χώρου — τρία ερωτήματα, τρία πεδία (ADR-777 §8.60.20)
 * =============================================================================
 *
 * Ως τις 2026-09-18 θέσεις στάθμευσης και αποθήκες είχαν **ένα** πεδίο `status`
 * (`available · occupied · reserved · sold · maintenance · unavailable · deleted`) που απαντούσε
 * **τρία** διαφορετικά ερωτήματα — και το διάβαζαν ~40 αρχεία. Μια θέση πωλημένη μαζί με ακίνητο
 * (που γράφει μόνο `commercialStatus`) έμενε «Διαθέσιμη» στη λίστα: δύο αλήθειες για την ίδια
 * έννοια (ADR-749).
 *
 * | Ερώτημα | Πεδίο | Λεξιλόγιο |
 * |---|---|---|
 * | στην αγορά / σε συναλλαγή; | `commercialStatus` | `COMMERCIAL_STATUSES` (ίδιο με τα ακίνητα) |
 * | φυσικά χρησιμοποιήσιμος;   | `operationalStatus` | `OPERATIONAL_STATUSES` (ίδιο με τα ακίνητα) |
 * | στον κάδο;                  | `status` | `active` · `deleted` (ADR-281) |
 *
 * Το «έχει χρήστη;» **δεν αποθηκεύεται** — παράγεται από τη συναλλαγή (`isFinalizedCommercialStatus`).
 * Ίδιο μοντέλο με RESO (`StandardStatus` ≠ `OccupantType`) και RealPage (κατοίκηση × μίσθωση ×
 * «Down»).
 *
 * 🔑 **Αυτό είναι το ΜΟΝΟ σημείο που διαβάζει το παλιό ανάμεικτο πεδίο** («read both, write new»):
 * mappers, διαδρομές API, showcase, αναφορές και το script συμπλήρωσης ρωτούν **εδώ**. Όταν η
 * συμπλήρωση τρέξει παντού, ο πίνακας `LEGACY_SPACE_STATUS_SPLIT` είναι ο μόνος κλάδος που φεύγει.
 *
 * ⚠️ Καθαρό (χωρίς `server-only`, χωρίς React): τρέχει σε client, server, script και jest.
 *
 * @module lib/spaces/space-status-split
 * @see ADR-777 §8.60.20 · ADR-749 (μία αλήθεια) · ADR-281 (κάδος)
 */

import {
  normalizeCommercialStatus,
  type CommercialStatus,
} from '@/constants/commercial-statuses';
import {
  DEFAULT_OPERATIONAL_STATUS,
  normalizeOperationalStatus,
  type OperationalStatus,
} from '@/constants/operational-statuses';
import {
  ACTIVE_RECORD_STATUS,
  TRASHED_STATUS,
  type RecordLifecycleStatus,
} from '@/lib/firestore/trashed-status';

/** Οι τιμές που έγραφε το παλιό ανάμεικτο `status` χώρου (θέση · αποθήκη · παλιές φόρμες). */
export const LEGACY_SPACE_STATUSES = [
  'available',
  'occupied',
  'reserved',
  'sold',
  'owner',
  'maintenance',
  'unavailable',
] as const;

export type LegacySpaceStatus = (typeof LEGACY_SPACE_STATUSES)[number];

/** Τι **ισχυριζόταν** κάθε παλιά τιμή — και τίποτα περισσότερο. */
interface LegacyClaim {
  readonly commercialStatus?: CommercialStatus;
  readonly operationalStatus?: OperationalStatus;
}

/**
 * Κάθε παλιά τιμή → ό,τι **ρητά** δήλωνε. Εξαντλητικό (`Record`): νέα παλιά τιμή χωρίς γραμμή
 * εδώ **δεν μεταγλωττίζεται**.
 *
 * ⛔ **Καμία μαντεψιά**:
 * - `available` σήμαινε «ελεύθερη», **όχι** «προς πώληση» — το `COMMERCIAL_STATUS_ALIASES` τη
 *   διαβάζει ως `for-sale` για ακίνητα, και ακριβώς γι' αυτό **δεν** το καλούμε εδώ.
 * - `occupied` / `owner` έλεγαν «έχει χρήστη» χωρίς να λένε **πώς** (πώληση ή μίσθωση;).
 * - Καμία δεν έλεγε ότι ο χώρος είναι «Έτοιμος»· απουσία λειτουργικής ≠ `ready`.
 */
export const LEGACY_SPACE_STATUS_SPLIT: Readonly<Record<LegacySpaceStatus, LegacyClaim>> = {
  available: {},
  occupied: {},
  owner: {},
  reserved: { commercialStatus: 'reserved' },
  sold: { commercialStatus: 'sold' },
  unavailable: { commercialStatus: 'unavailable' },
  maintenance: { operationalStatus: 'maintenance' },
};

function isLegacySpaceStatus(value: unknown): value is LegacySpaceStatus {
  return typeof value === 'string' && (LEGACY_SPACE_STATUSES as readonly string[]).includes(value);
}

/** Οι τρεις απαντήσεις για έναν χώρο — ό,τι δεν είναι γνωστό **λείπει**, δεν μαντεύεται. */
export interface SpaceStatuses {
  readonly status: RecordLifecycleStatus;
  readonly commercialStatus?: CommercialStatus;
  readonly operationalStatus?: OperationalStatus;
}

/** Το ελάχιστο σχήμα εγγράφου που χρειάζεται η απάντηση. */
export interface SpaceStatusSource {
  readonly status?: unknown;
  readonly commercialStatus?: unknown;
  readonly operationalStatus?: unknown;
}

/**
 * Αποθηκευμένο έγγραφο (νέο, παλιό ή μικτό) → οι τρεις απαντήσεις.
 *
 * 🔑 **Τα νέα πεδία κερδίζουν πάντα.** Το παλιό `status` συμπληρώνει **μόνο** ό,τι λείπει — έτσι
 * μια θέση που πούλησε το `appurtenance-sync` (γράφει μόνο `commercialStatus`) διαβάζεται
 * «Πωλήθηκε» ακόμη κι αν το παλιό πεδίο λέει ακόμη `available` (το περιστατικό της Φάσης 6).
 */
export function resolveSpaceStatuses(source: SpaceStatusSource): SpaceStatuses {
  const status: RecordLifecycleStatus =
    source.status === TRASHED_STATUS ? TRASHED_STATUS : ACTIVE_RECORD_STATUS;
  const claim: LegacyClaim = isLegacySpaceStatus(source.status)
    ? LEGACY_SPACE_STATUS_SPLIT[source.status]
    : {};

  const commercialStatus =
    normalizeCommercialStatus(source.commercialStatus) ?? claim.commercialStatus;
  const operationalStatus =
    normalizeOperationalStatus(source.operationalStatus) ?? claim.operationalStatus;

  return {
    status,
    ...(commercialStatus ? { commercialStatus } : {}),
    ...(operationalStatus ? { operationalStatus } : {}),
  };
}

/**
 * Κουβαλά ακόμη το έγγραφο το παλιό ανάμεικτο πεδίο; — η ερώτηση του script συμπλήρωσης και
 * της άγκυρας «read both».
 */
export function hasLegacySpaceStatus(source: SpaceStatusSource): boolean {
  return isLegacySpaceStatus(source.status);
}

/**
 * Οι καταστάσεις μιας **νέας** θέσης/αποθήκης πριν τη γέννησή της (φόρμες δημιουργίας) — ζωντανή,
 * λειτουργικά «πρόχειρο», χωρίς διάθεση (νέα μονάδα = εκτός αγοράς, §8.60.18). Ίδιος κανόνας με τον
 * server (`mapCommonSpaceCreateFields`) και με τη γέννηση ακινήτου· ήταν ωμό `status: 'available'`
 * σε τέσσερα σημεία.
 */
export const NEW_SPACE_STATUSES = {
  status: ACTIVE_RECORD_STATUS,
  operationalStatus: DEFAULT_OPERATIONAL_STATUS,
} as const satisfies SpaceStatuses;

// =============================================================================
// ΣΥΜΠΛΗΡΩΣΗ (backfill) — ο ΙΔΙΟΣ αναγνώστης, σε μορφή «τι να γραφτεί»
// =============================================================================

/** Η απόφαση για ένα έγγραφο — **ονομασμένη**, ποτέ `boolean`. */
export type SpaceStatusBackfill =
  | { readonly kind: 'write'; readonly updates: Readonly<Record<string, string>> }
  | { readonly kind: 'noop' };

/** Ό,τι ισχυριζόταν το παλιό πεδίο και **λείπει** από τα νέα — τίποτα που υπάρχει δεν ξαναγράφεται. */
function missingClaims(source: SpaceStatusSource, legacy: LegacySpaceStatus): Record<string, string> {
  const claim = LEGACY_SPACE_STATUS_SPLIT[legacy];
  const updates: Record<string, string> = {};
  if (claim.commercialStatus && !normalizeCommercialStatus(source.commercialStatus)) {
    updates.commercialStatus = claim.commercialStatus;
  }
  if (claim.operationalStatus && !normalizeOperationalStatus(source.operationalStatus)) {
    updates.operationalStatus = claim.operationalStatus;
  }
  return updates;
}

/**
 * Αποθηκευμένο έγγραφο → τι γράφει η συμπλήρωση (`scripts/migrations/migrate-space-status-split.ts`).
 *
 * - ζωντανό με παλιό `status` ⇒ `status: active` + ό,τι ισχυριζόταν και λείπει·
 * - στον κάδο με παλιό `previousStatus` ⇒ `previousStatus: active` + τα ίδια (αλλιώς η επαναφορά
 *   θα ξανάγραφε το ανάμεικτο πεδίο)·
 * - αλλιώς `noop` — **ιδεμπότητα**: δεύτερη εκτέλεση δεν αλλάζει τίποτα.
 */
export function planSpaceStatusBackfill(
  source: SpaceStatusSource & { readonly previousStatus?: unknown },
): SpaceStatusBackfill {
  if (isLegacySpaceStatus(source.status)) {
    return { kind: 'write', updates: { status: ACTIVE_RECORD_STATUS, ...missingClaims(source, source.status) } };
  }
  if (source.status === TRASHED_STATUS && isLegacySpaceStatus(source.previousStatus)) {
    return {
      kind: 'write',
      updates: { previousStatus: ACTIVE_RECORD_STATUS, ...missingClaims(source, source.previousStatus) },
    };
  }
  return { kind: 'noop' };
}
