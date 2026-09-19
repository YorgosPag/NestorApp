/**
 * =============================================================================
 * SSoT: η ΔΙΑΘΕΣΙΜΟΤΗΤΑ χώρων — φίλτρα και μετρήσεις από ΜΙΑ αλήθεια (ADR-777 §8.60.20)
 * =============================================================================
 *
 * Οι γρήγορες επιλογές, τα φίλτρα, τα πλακίδια στατιστικών και οι αναφορές θέσεων/αποθηκών
 * μετρούσαν το παλιό ανάμεικτο `status` με **δικό τους** κατηγόρημα ο καθένας
 * (`status === 'available'` σε ~10 σημεία). Εδώ ζει ο **ένας** κουβάς ανά χώρο, και προέρχεται
 * **μόνο** από το `commercialStatus` — την ίδια αλήθεια που γράφει η φόρμα και η συναλλαγή.
 *
 * | Κουβάς | Καταστάσεις | «Διαθέσιμη;» |
 * |---|---|---|
 * | `listed` | for-sale · for-rent · for-sale-and-rent | ✅ |
 * | `reserved` · `sold` · `rented` | η συναλλαγή | — |
 * | `unavailable` | εκτός αγοράς **ή** αδήλωτο | — |
 *
 * 🔑 Αδήλωτη διάθεση πέφτει στο `unavailable` — **ποτέ** στο `listed`: ένας χώρος που κανείς δεν
 * έβγαλε στην αγορά δεν είναι «διαθέσιμος» (πρότυπο Revit/Yardi, `DEFAULT_COMMERCIAL_STATUS`).
 *
 * @module lib/spaces/space-availability
 * @see ADR-777 §8.60.20 · lib/spaces/space-status-split
 */

import {
  DEFAULT_COMMERCIAL_STATUS,
  isFinalizedCommercialStatus,
  isListedCommercialStatus,
} from '@/constants/commercial-statuses';
import { isOperationalException } from '@/constants/operational-statuses';
import { resolveSpaceStatuses, type SpaceStatusSource } from '@/lib/spaces/space-status-split';

/** Οι κουβάδες διαθεσιμότητας, με τη σειρά που εμφανίζονται στις γρήγορες επιλογές. */
export const SPACE_AVAILABILITY_BUCKETS = [
  'listed',
  'reserved',
  'sold',
  'rented',
  'unavailable',
] as const;

export type SpaceAvailabilityBucket = (typeof SPACE_AVAILABILITY_BUCKETS)[number];

/** Η τιμή «όλοι» των φίλτρων — ονομασμένη, όχι ωμό `'all'` σε κάθε κατηγόρημα. */
export const ALL_SPACE_AVAILABILITY = 'all';

export type SpaceAvailabilityFilter = SpaceAvailabilityBucket | typeof ALL_SPACE_AVAILABILITY;

export function isSpaceAvailabilityBucket(value: unknown): value is SpaceAvailabilityBucket {
  return (
    typeof value === 'string' &&
    (SPACE_AVAILABILITY_BUCKETS as readonly string[]).includes(value)
  );
}

/**
 * Ό,τι χρειάζεται από έναν χώρο — και το παλιό `status`, ώστε **κάθε** μέτρηση να είναι
 * «read both» μέσω του ΕΝΟΣ αναγνώστη (ένα παλιό `status: 'sold'` μετρά ως πωλημένο).
 */
export type SpaceAvailabilitySource = SpaceStatusSource;

/** Χώρος → ο **ένας** κουβάς του. */
export function spaceAvailabilityBucket(space: SpaceAvailabilitySource): SpaceAvailabilityBucket {
  const status = resolveSpaceStatuses(space).commercialStatus ?? DEFAULT_COMMERCIAL_STATUS;
  if (isListedCommercialStatus(status)) return 'listed';
  if (status === 'reserved' || status === 'sold' || status === 'rented') return status;
  return 'unavailable';
}

/** Το κατηγόρημα κάθε φίλτρου διάθεσης (`'all'` ⇒ όλοι). */
export function matchesSpaceAvailability(
  space: SpaceAvailabilitySource,
  filter: string,
): boolean {
  if (!isSpaceAvailabilityBucket(filter)) return true;
  return spaceAvailabilityBucket(space) === filter;
}

/**
 * Το κατηγόρημα των **πολλαπλών** γρήγορων επιλογών (λίστες θέσεων/αποθηκών): καμία επιλογή ⇒
 * όλοι· αλλιώς ο κουβάς του χώρου πρέπει να είναι ανάμεσα στους επιλεγμένους.
 */
export function matchesAnySpaceAvailability(
  space: SpaceAvailabilitySource,
  selected: readonly string[],
): boolean {
  if (selected.length === 0) return true;
  return selected.includes(spaceAvailabilityBucket(space));
}

/** Οι δύο όψεις κατάστασης ενός panel φίλτρων (μονή επιλογή, `'all'` ⇒ όλοι). */
export interface SpaceStatusFilterSelection {
  readonly status?: readonly string[];
  readonly operationalStatus?: readonly string[];
}

/**
 * Το κατηγόρημα των **δύο** όψεων του panel — διάθεση (από το `commercialStatus`) **και**
 * λειτουργία — για τις σελίδες θέσεων και αποθηκών. Η λειτουργία διαβάζεται μέσω του ΕΝΟΣ
 * αναγνώστη, άρα και ένα παλιό `status: 'maintenance'` απαντά σωστά.
 */
export function matchesSpaceStatusFilters(
  space: SpaceAvailabilitySource,
  selection: SpaceStatusFilterSelection,
): boolean {
  if (!matchesSpaceAvailability(space, selection.status?.[0] ?? ALL_SPACE_AVAILABILITY)) return false;
  const wanted = selection.operationalStatus?.[0];
  if (!wanted || wanted === ALL_SPACE_AVAILABILITY) return true;
  return resolveSpaceStatuses(space).operationalStatus === wanted;
}

/** Η θέση του κουβά στη φυσική σειρά — το κλειδί ταξινόμησης «κατά κατάσταση». */
export function spaceAvailabilityRank(space: SpaceAvailabilitySource): number {
  return SPACE_AVAILABILITY_BUCKETS.indexOf(spaceAvailabilityBucket(space));
}

/** Οι μετρήσεις μιας λίστας χώρων — ό,τι δείχνουν πλακίδια και αναφορές. */
export interface SpaceStatusCounts {
  readonly total: number;
  readonly byAvailability: Readonly<Record<SpaceAvailabilityBucket, number>>;
  /** Έχουν χρήστη (πώληση · μίσθωση) — η «κατοίκηση», παραγόμενη. */
  readonly inUse: number;
  /** Δεν είναι έτοιμοι για χρήση (υπό κατασκευή · επιθεώρηση · συντήρηση · πρόχειρο). */
  readonly notReady: number;
  /** Ποσοστό 0–100 με χρήστη. */
  readonly utilizationRate: number;
  /** Ποσοστό 0–100 στην αγορά. */
  readonly availabilityRate: number;
}

function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Λίστα χώρων → μετρήσεις (ένα πέρασμα). */
export function countSpaceStatuses(spaces: readonly SpaceAvailabilitySource[]): SpaceStatusCounts {
  const byAvailability: Record<SpaceAvailabilityBucket, number> = {
    listed: 0, reserved: 0, sold: 0, rented: 0, unavailable: 0,
  };
  let inUse = 0;
  let notReady = 0;
  for (const space of spaces) {
    const resolved = resolveSpaceStatuses(space);
    byAvailability[spaceAvailabilityBucket(resolved)] += 1;
    if (isFinalizedCommercialStatus(resolved.commercialStatus)) inUse += 1;
    if (isOperationalException(resolved.operationalStatus)) notReady += 1;
  }
  return {
    total: spaces.length,
    byAvailability,
    inUse,
    notReady,
    utilizationRate: percent(inUse, spaces.length),
    availabilityRate: percent(byAvailability.listed, spaces.length),
  };
}

/** Η τιμή κατανομής για χώρο **χωρίς** δηλωμένη λειτουργική κατάσταση — ονομασμένη, όχι μαντεμένη. */
export const UNDECLARED_STATUS_KEY = 'unknown';

/** Οι κατανομές μιας λίστας χώρων ανά εμπορική και ανά λειτουργική κατάσταση (για αναφορές). */
export interface SpaceStatusDistributions {
  /** Ανά `commercialStatus` (7 τιμές· αδήλωτο ⇒ `unavailable`, όπως κάθε νέα μονάδα). */
  readonly byCommercialStatus: Readonly<Record<string, number>>;
  /** Ανά `operationalStatus` (αδήλωτο ⇒ `UNDECLARED_STATUS_KEY`). */
  readonly byOperationalStatus: Readonly<Record<string, number>>;
}

/** Λίστα χώρων → κατανομές, μέσω του ΕΝΟΣ αναγνώστη (και για παλιά έγγραφα). */
export function spaceStatusDistributions(spaces: readonly SpaceAvailabilitySource[]): SpaceStatusDistributions {
  const byCommercialStatus: Record<string, number> = {};
  const byOperationalStatus: Record<string, number> = {};
  for (const space of spaces) {
    const resolved = resolveSpaceStatuses(space);
    const commercial = resolved.commercialStatus ?? DEFAULT_COMMERCIAL_STATUS;
    const operational = resolved.operationalStatus ?? UNDECLARED_STATUS_KEY;
    byCommercialStatus[commercial] = (byCommercialStatus[commercial] ?? 0) + 1;
    byOperationalStatus[operational] = (byOperationalStatus[operational] ?? 0) + 1;
  }
  return { byCommercialStatus, byOperationalStatus };
}
