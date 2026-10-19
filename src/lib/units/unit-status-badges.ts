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
 * ⚠️ Καθαρό — χωρίς hooks, χωρίς `t`: επιστρέφει **κλειδιά** (namespace `properties-enums`) και
 * **αναφορές** εικονιδίων (όχι απόδοση), ώστε να ελέγχεται σε jest και να το καταναλώνει κάθε
 * επιφάνεια με τον δικό της μεταφραστή.
 *
 * @module lib/units/unit-status-badges
 * @see ADR-777 §8.60.20 · constants/commercial-statuses · constants/operational-statuses
 */

import {
  DEFAULT_COMMERCIAL_STATUS,
  normalizeCommercialStatus,
  resolveCommercialStatus,
  type CommercialStatus,
  type CommercialStatusSource,
} from '@/constants/commercial-statuses';
import {
  isOperationalException,
  normalizeOperationalStatus,
  type OperationalStatus,
} from '@/constants/operational-statuses';
import {
  CalendarCheck,
  Check,
  CircleCheck,
  CircleSlash,
  ClipboardCheck,
  HardHat,
  Hourglass,
  KeyRound,
  PencilLine,
  Tag,
  Tags,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type {
  GridCardBadge,
  GridCardBadgeVariant,
} from '@/design-system/components/GridCard/GridCard.types';
import { resolveSpaceStatuses, type SpaceStatusSource } from '@/lib/spaces/space-status-split';

/** Ένα σήμα πριν τη μετάφραση: κλειδί ετικέτας + απόχρωση + σχήμα. */
export interface UnitStatusBadgeSpec {
  readonly labelKey: string;
  readonly variant: GridCardBadgeVariant;
  readonly icon: LucideIcon;
}

/** Η παρουσίαση μιας κατάστασης: απόχρωση **και** σχήμα, ορισμένα μαζί. */
interface StatusPresentation {
  readonly variant: GridCardBadgeVariant;
  readonly icon: LucideIcon;
}

/** Το namespace όπου ζουν **και οι δύο** ομάδες ετικετών (ίδιες με τη φόρμα ακινήτου). */
export const UNIT_STATUS_NAMESPACE = 'properties-enums';

/**
 * Διάθεση → απόχρωση + σχήμα. Εξαντλητικό (`Record<CommercialStatus,…>`): όγδοη κατάσταση χωρίς
 * γραμμή **δεν μεταγλωττίζεται**. Οι αποχρώσεις είναι αυτές που είχαν ήδη οι κάρτες ακινήτων.
 *
 * 🔑 **Το σχήμα είναι δεύτερο μη χρωματικό κανάλι** (ADR-771 · WCAG 1.4.1 · πρότυπο GitHub Primer
 * `StateLabel`): η ετικέτα λέει ήδη την κατάσταση· το εικονίδιο την κάνει **αναγνωρίσιμη με μια
 * ματιά** σε στήλη πίνακα, και ξεχωρίζει όσες μοιράζονται απόχρωση (πωλήθηκε · ενοικιάστηκε).
 * Οικογένειες: διάθεση στην αγορά = ετικέτα/κλειδί · σε εξέλιξη = κλεψύδρα · ολοκληρωμένη = τικ.
 * Κάθε σχήμα **μοναδικό** στον πίνακα (άγκυρα Ζ1).
 */
const COMMERCIAL_PRESENTATION: Readonly<Record<CommercialStatus, StatusPresentation>> = {
  unavailable: { variant: 'default', icon: CircleSlash },
  'for-sale': { variant: 'info', icon: Tag },
  'for-rent': { variant: 'warning', icon: KeyRound },
  'for-sale-and-rent': { variant: 'secondary', icon: Tags },
  reserved: { variant: 'outline', icon: Hourglass },
  sold: { variant: 'success', icon: CircleCheck },
  rented: { variant: 'success', icon: CalendarCheck },
};

/**
 * Λειτουργία → απόχρωση. Ήταν τοπικός χάρτης της κάρτας ακινήτου (`usePropertyCardModel`)· ανέβηκε
 * εδώ όταν απέκτησε δεύτερο καταναλωτή (χώροι) — **ίδιες** αποχρώσεις, καμία ορατή αλλαγή.
 */
const OPERATIONAL_PRESENTATION: Readonly<Record<OperationalStatus, StatusPresentation>> = {
  ready: { variant: 'success', icon: Check },
  'under-construction': { variant: 'warning', icon: HardHat },
  inspection: { variant: 'info', icon: ClipboardCheck },
  maintenance: { variant: 'secondary', icon: Wrench },
  draft: { variant: 'default', icon: PencilLine },
};

/** Το κλειδί ετικέτας μιας διάθεσης (namespace {@link UNIT_STATUS_NAMESPACE}) — ένα σημείο για σήμα, φίλτρο και εξαγωγή. */
export function commercialStatusLabelKey(status: CommercialStatus): string {
  return `commercialStatus.${status}`;
}

/** Το σήμα διάθεσης — ή `null` όταν η κατάσταση είναι άγνωστη (ποτέ «Διαθέσιμη» από εικασία). */
export function commercialStatusBadge(value: unknown): UnitStatusBadgeSpec | null {
  const status = normalizeCommercialStatus(value);
  if (!status) return null;
  return { labelKey: commercialStatusLabelKey(status), ...COMMERCIAL_PRESENTATION[status] };
}

/** Το σήμα λειτουργίας — για **κάθε** δηλωμένη κατάσταση (η κάρτα ακινήτου το δείχνει πάντα). */
export function operationalStatusBadge(value: unknown): UnitStatusBadgeSpec | null {
  const status = normalizeOperationalStatus(value);
  if (!status) return null;
  return { labelKey: `operationalStatus.${status}`, ...OPERATIONAL_PRESENTATION[status] };
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

/**
 * Ένα σήμα, μεταφρασμένο, στο σχήμα των καρτών — ο **ΕΝΑΣ** τρόπος να γίνει spec σήμα, ώστε
 * ετικέτα, απόχρωση και σχήμα να φτάνουν **μαζί** σε κάθε επιφάνεια (ήταν τρεις χειρόγραφες
 * μετατροπές `{ label, variant }` ως τις 2026-10-19).
 */
export function badgeFromSpec(spec: UnitStatusBadgeSpec, t: Translate): GridCardBadge {
  return { label: t(spec.labelKey, { ns: UNIT_STATUS_NAMESPACE }), variant: spec.variant, icon: spec.icon };
}

/** Τα σήματα, μεταφρασμένα, στο σχήμα των καρτών (`GridCardBadge`). */
export function unitStatusBadges(unit: UnitStatusSource, t: Translate): GridCardBadge[] {
  return unitStatusBadgeSpecs(unit).map((spec) => badgeFromSpec(spec, t));
}

/** Τα σήματα ως **κείμενο** (εξαγωγή XLSX) — `null` όταν δεν υπάρχει κανένα, ποτέ κενό κελί-ψέμα. */
export function statusBadgesText(badges: readonly GridCardBadge[]): string | null {
  return badges.map((badge) => badge.label).join(' · ') || null;
}

/** Ό,τι χρειάζεται από ένα **ακίνητο** για τα σήματά του (κανονικό πεδίο + παλιό κάτοπτρο). */
export interface PropertyStatusSource extends CommercialStatusSource {
  readonly operationalStatus?: unknown;
}

/**
 * Τα σήματα ενός **ακινήτου** — η διάθεση περνά πρώτα από τον ΕΝΑ αναγνώστη
 * (`resolveCommercialStatus`), ώστε κάθε επιφάνεια να διαβάζει το κανονικό `commercialStatus`
 * και όχι το `@deprecated` κάτοπτρο `status`.
 */
export function propertyStatusBadges(property: PropertyStatusSource, t: Translate): GridCardBadge[] {
  return unitStatusBadges(
    { commercialStatus: resolveCommercialStatus(property), operationalStatus: property.operationalStatus },
    t,
  );
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
  return { statusKey, statusLabel: t(commercialStatusLabelKey(statusKey), { ns: UNIT_STATUS_NAMESPACE }) };
}
