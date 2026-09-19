/**
 * =============================================================================
 * SSoT: τα ΣΗΜΑΤΑ κατάστασης μιας μονάδας — ακίνητο · θέση · αποθήκη (ADR-777 §8.60.20)
 * =============================================================================
 *
 * **Ένα** badge διάθεσης από το `commercialStatus` (η εμπορική αλήθεια) **+** ένα badge
 * λειτουργίας **μόνο όταν η μονάδα δεν είναι έτοιμη** (αρχή Figma «δείξε μόνο ό,τι διαφέρει»:
 * μια λίστα γεμάτη «Έτοιμο» δεν λέει τίποτα, ενώ ένα «Υπό συντήρηση» ανάμεσά τους λέει).
 *
 * Ως τις 2026-09-18 υπήρχαν **εννέα** χάρτες «κατάσταση → ετικέτα/χρώμα» για θέσεις και αποθήκες
 * (κάρτες · πίνακες κτιρίου · δέντρο έργου · σελίδα αποθήκης · σύστημα badges), όλοι πάνω στο
 * παλιό ανάμεικτο `status` — γι' αυτό μια πωλημένη θέση έδειχνε «Διαθέσιμη». Και οι κάρτες
 * ακινήτων είχαν δικό τους μισό χάρτη (4 από τις 7 καταστάσεις).
 *
 * ⚠️ Καθαρό — χωρίς React, χωρίς `t`: επιστρέφει **κλειδιά** (namespace `properties-enums`),
 * ώστε να ελέγχεται σε jest και να το καταναλώνει κάθε επιφάνεια με τον δικό της μεταφραστή.
 *
 * @module lib/units/unit-status-badges
 * @see ADR-777 §8.60.20 · constants/commercial-statuses · constants/operational-statuses
 */

import {
  DEFAULT_COMMERCIAL_STATUS,
  normalizeCommercialStatus,
  type CommercialStatus,
} from '@/constants/commercial-statuses';
import {
  isOperationalException,
  normalizeOperationalStatus,
  type OperationalStatus,
} from '@/constants/operational-statuses';
import type {
  GridCardBadge,
  GridCardBadgeVariant,
} from '@/design-system/components/GridCard/GridCard.types';
import { resolveSpaceStatuses, type SpaceStatusSource } from '@/lib/spaces/space-status-split';

/** Ένα σήμα πριν τη μετάφραση: κλειδί ετικέτας + απόχρωση. */
export interface UnitStatusBadgeSpec {
  readonly labelKey: string;
  readonly variant: GridCardBadgeVariant;
}

/** Το namespace όπου ζουν **και οι δύο** ομάδες ετικετών (ίδιες με τη φόρμα ακινήτου). */
export const UNIT_STATUS_NAMESPACE = 'properties-enums';

/**
 * Διάθεση → απόχρωση. Εξαντλητικό (`Record<CommercialStatus,…>`): όγδοη κατάσταση χωρίς γραμμή
 * **δεν μεταγλωττίζεται**. Οι τέσσερις καταστάσεις αγοράς κρατούν τις αποχρώσεις που είχαν ήδη
 * οι κάρτες ακινήτων — καμία ορατή αλλαγή εκεί.
 */
const COMMERCIAL_VARIANTS: Readonly<Record<CommercialStatus, GridCardBadgeVariant>> = {
  unavailable: 'default',
  'for-sale': 'info',
  'for-rent': 'warning',
  'for-sale-and-rent': 'secondary',
  reserved: 'outline',
  sold: 'success',
  rented: 'success',
};

/**
 * Λειτουργία → απόχρωση. Ήταν τοπικός χάρτης της κάρτας ακινήτου (`usePropertyCardModel`)· ανέβηκε
 * εδώ όταν απέκτησε δεύτερο καταναλωτή (χώροι) — **ίδιες** αποχρώσεις, καμία ορατή αλλαγή.
 */
const OPERATIONAL_VARIANTS: Readonly<Record<OperationalStatus, GridCardBadgeVariant>> = {
  ready: 'success',
  'under-construction': 'warning',
  inspection: 'info',
  maintenance: 'secondary',
  draft: 'default',
};

/** Το σήμα διάθεσης — ή `null` όταν η κατάσταση είναι άγνωστη (ποτέ «Διαθέσιμη» από εικασία). */
export function commercialStatusBadge(value: unknown): UnitStatusBadgeSpec | null {
  const status = normalizeCommercialStatus(value);
  if (!status) return null;
  return { labelKey: `commercialStatus.${status}`, variant: COMMERCIAL_VARIANTS[status] };
}

/** Το σήμα λειτουργίας — για **κάθε** δηλωμένη κατάσταση (η κάρτα ακινήτου το δείχνει πάντα). */
export function operationalStatusBadge(value: unknown): UnitStatusBadgeSpec | null {
  const status = normalizeOperationalStatus(value);
  if (!status) return null;
  return { labelKey: `operationalStatus.${status}`, variant: OPERATIONAL_VARIANTS[status] };
}

/** Το σήμα λειτουργίας — **μόνο** για εξαίρεση (`null` για «Έτοιμο» ή αδήλωτο). */
export function operationalExceptionBadge(value: unknown): UnitStatusBadgeSpec | null {
  return isOperationalException(normalizeOperationalStatus(value)) ? operationalStatusBadge(value) : null;
}

/** Ό,τι χρειάζεται από μια μονάδα για τα σήματά της. */
export interface UnitStatusSource {
  readonly commercialStatus?: unknown;
  readonly operationalStatus?: unknown;
}

/** Όλα τα σήματα μιας μονάδας, με τη σειρά που εμφανίζονται: διάθεση, μετά εξαίρεση. */
export function unitStatusBadgeSpecs(unit: UnitStatusSource): UnitStatusBadgeSpec[] {
  return [
    commercialStatusBadge(unit.commercialStatus),
    operationalExceptionBadge(unit.operationalStatus),
  ].filter((spec): spec is UnitStatusBadgeSpec => spec !== null);
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Τα σήματα, μεταφρασμένα, στο σχήμα των καρτών (`GridCardBadge`). */
export function unitStatusBadges(unit: UnitStatusSource, t: Translate): GridCardBadge[] {
  return unitStatusBadgeSpecs(unit).map((spec) => ({
    label: t(spec.labelKey, { ns: UNIT_STATUS_NAMESPACE }),
    variant: spec.variant,
  }));
}

/**
 * Τα σήματα ενός **χώρου** (θέση · αποθήκη) — περνούν πρώτα από τον ΕΝΑ αναγνώστη
 * (`resolveSpaceStatuses`), ώστε κάθε επιφάνεια να δείχνει το ίδιο ό,τι κι αν της έδωσαν:
 * mapped αντικείμενο, ωμό έγγραφο ή παλιό έγγραφο με το ανάμεικτο `status`.
 */
export function spaceStatusBadges(space: SpaceStatusSource, t: Translate): GridCardBadge[] {
  return unitStatusBadges(resolveSpaceStatuses(space), t);
}

/**
 * Η διάθεση ενός χώρου ως **κλειδί + ετικέτα** — για επιφάνειες που χρωματίζουν ανά κατάσταση
 * (`SalesGridCard`, ίδιο συμβόλαιο με τη σελίδα «Πωλημένα» των ακινήτων). Αδήλωτη ⇒ «Μη διαθέσιμο»,
 * όπως κάθε νέα μονάδα — ποτέ «Διαθέσιμη» από εικασία.
 */
export function spaceCommercialStatusView(
  space: SpaceStatusSource,
  t: Translate,
): { readonly statusKey: CommercialStatus; readonly statusLabel: string } {
  const statusKey = resolveSpaceStatuses(space).commercialStatus ?? DEFAULT_COMMERCIAL_STATUS;
  return { statusKey, statusLabel: t(`commercialStatus.${statusKey}`, { ns: UNIT_STATUS_NAMESPACE }) };
}
