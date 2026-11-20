/**
 * =============================================================================
 * SSoT: Η ΠΑΡΟΥΣΙΑ ΤΗΣ ΑΓΓΕΛΙΑΣ — «πού βρίσκεται αυτό το ακίνητο ΑΠΕΝΑΝΤΙ ΣΤΟ ΚΟΙΝΟ;» (ADR-777 §8.103)
 * =============================================================================
 *
 * **Ένας άξονας, πέντε ονόματα — και η απουσία είναι ΕΝΑ από αυτά.** Ως τις 2026-11-19 η κάρτα έδειχνε
 * «Δημόσια» όταν η αγγελία ζούσε στο κοινό και **τίποτα** όταν δεν ζούσε: η απουσία σήματος δεν τραβά το
 * μάτι, άρα ο άνθρωπος **δεν μπορούσε** να ξεχωρίσει με μια ματιά τα δημοσιευμένα από τα αδημοσίευτα.
 * Πρότυπο Shopify (κατάσταση ≠ κανάλι) · Zillow Rental Manager («Off market» ονομασμένο) · Idealista
 * (η απενεργοποιημένη αγγελία μένει ορατή στον ιδιοκτήτη με δικό της όνομα).
 *
 * | Παρουσία     | Σημασία                                                        |
 * |--------------|----------------------------------------------------------------|
 * | `public`     | διατίθεται και **ζει στον δημόσιο χάρτη**                      |
 * | `network`    | διατίθεται κλειστά, στο επαγγελματικό δίκτυο                   |
 * | `custodians` | διατίθεται κλειστά, μόνο στους διαχειριστές                    |
 * | `unlisted`   | **δεν** διατίθεται ακόμη ή πια — καμία αγγελία σε κανένα κοινό |
 * | `settled`    | η συναλλαγή ολοκληρώθηκε — η αγγελία έκλεισε                    |
 *
 * 🔑 **ΚΑΝΕΝΑΣ ΔΕΥΤΕΡΟΣ ΚΡΙΤΗΣ.** Η ετυμηγορία παράγεται από τον **ίδιο** κριτή με την πύλη προβολής
 * (`offeredAudienceOf` / `offerStateOf`) — αυτόν που αποφασίζει αν ο γραφέας κάνει `set()` ή `delete()` στο
 * `public_listings`. Άρα «Στο κοινό» στην κάρτα ⇔ το ακίνητο **περνά** την πύλη δημοσίευσης.
 *
 * ⚠️ Καθαρό — χωρίς hooks, χωρίς `t`: επιστρέφει **κλειδιά** (namespace `UNIT_STATUS_NAMESPACE` = `properties-enums`) και **αναφορές**
 * εικονιδίων, ίδιο ιδίωμα με το `lib/units/unit-status-badges`.
 *
 * @module lib/listings/listing-presence
 * @see services/listings/public-listing-projection (ο κριτής) · constants/marketing-audiences (η ρίζα του κοινού)
 */

import { EyeOff, Flag, Globe, Lock, Network, TriangleAlert, type LucideIcon } from 'lucide-react';

import { MARKETING_AUDIENCES, type MarketingAudience } from '@/constants/marketing-audiences';
import type { GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';
import {
  offerStateOf,
  offeredAudienceOf,
  type OfferedAudienceFacts,
} from '@/services/listings/public-listing-projection';

/** Οι παρουσίες **χωρίς** αγγελία σε κανένα κοινό — ό,τι δεν είναι κοινό του λεξιλογίου. */
const ABSENT_PRESENCES = ['unlisted', 'settled'] as const;

export type ListingPresence = MarketingAudience | (typeof ABSENT_PRESENCES)[number];

/**
 * Το κλειστό σύνολο, **δεμένο στη ρίζα του κοινού**: τέταρτο κοινό μπαίνει εδώ μόνο του.
 * Σειρά = σειρά εμφάνισης (φίλτρα): από το ευρύτερο κοινό στο στενότερο, μετά οι απουσίες.
 */
export const LISTING_PRESENCES: readonly ListingPresence[] = [
  ...[...MARKETING_AUDIENCES].reverse(),
  ...ABSENT_PRESENCES,
];


/**
 * **Πού βρίσκεται η αγγελία.** Διατίθεται ⇒ το κοινό της· αλλιώς **ονομάζεται** γιατί δεν υπάρχει αγγελία.
 *
 * 🔴 Το `settled` κρίνεται από τον ίδιο ταξινομητή (`offerStateOf`) — ποτέ από δεύτερη λίστα «πουλημένων».
 */
export function listingPresenceOf(property: OfferedAudienceFacts): ListingPresence {
  const audience = offeredAudienceOf(property);
  if (audience !== null) return audience;
  return offerStateOf(property) === 'settled' ? 'settled' : 'unlisted';
}

/** Ένα σήμα παρουσίας πριν τη μετάφραση. */
export interface ListingPresenceSpec {
  readonly labelKey: string;
  readonly variant: GridCardBadgeVariant;
  readonly icon: LucideIcon;
  /** Δεύτερο μη χρωματικό κανάλι πέρα από το σχήμα (διακεκομμένο περίγραμμα = «δεν υπάρχει αγγελία»). */
  readonly className?: string;
}

/**
 * Παρουσία → απόχρωση + σχήμα. Εξαντλητικό (`Record<ListingPresence, …>`): έκτη παρουσία χωρίς γραμμή
 * **δεν μεταγλωττίζεται**. Το σχήμα είναι **μοναδικό** ανά παρουσία (WCAG 1.4.1 · ADR-771) και **διαφορετικό**
 * από τα σχήματα της εμπορικής κατάστασης (`unit-status-badges`), που κάθονται στην ίδια γραμμή.
 *
 * 🔑 **Μόνο το «Στο κοινό» είναι γεμάτο**: είναι η μόνη κατάσταση όπου ο κόσμος βλέπει την αγγελία, άρα η
 * μόνη που αξίζει να «φωνάζει». Οι κλειστές είναι περίγραμμα· η απουσία είναι **διακεκομμένο** περίγραμμα.
 */
// Ο τύπος ονομάζει τη ΡΙΖΑ (`MarketingAudience`) ρητά, όχι το ψευδώνυμο `ListingPresence` (CHECK 3.73).
const LISTING_PRESENCE_PRESENTATION: Readonly<
  Record<MarketingAudience | (typeof ABSENT_PRESENCES)[number], Omit<ListingPresenceSpec, 'labelKey'>>
> = {
  public: { variant: 'success', icon: Globe },
  network: { variant: 'outline', icon: Network },
  custodians: { variant: 'outline', icon: Lock },
  // Το διακεκομμένο είναι **φορέας νοήματος** («δεν υπάρχει αγγελία»), άρα ζητά τον ρόλο περιγράμματος ≥3:1
  // (WCAG 1.4.11 · Material 3 `outline` έναντι του διακοσμητικού `outline-variant`). Το γενικό `--border` του
  // `outline` badge μετρήθηκε 1,46:1 στο σκοτεινό θέμα (ADR-777 §8.103): η γραμμή υπήρχε στο DOM και δεν φαινόταν.
  unlisted: { variant: 'outline', icon: EyeOff, className: 'border-dashed border-control-outline' },
  settled: { variant: 'secondary', icon: Flag },
};

/** Το κλειδί ετικέτας μιας παρουσίας — ένα σημείο για σήμα και φίλτρο. */
export function listingPresenceLabelKey(presence: ListingPresence): string {
  return `listingPresence.${presence}`;
}

/** Το σήμα μιας παρουσίας. */
export function listingPresenceSpec(presence: ListingPresence): ListingPresenceSpec {
  return { labelKey: listingPresenceLabelKey(presence), ...LISTING_PRESENCE_PRESENTATION[presence] };
}

// =============================================================================
// ΠΡΟΘΕΣΗ ⇄ ΚΟΣΜΟΣ — «ΕΦΤΑΣΕ Η ΑΓΓΕΛΙΑ ΕΚΕΙ ΠΟΥ ΛΕΕΙ ΤΟ ΣΗΜΑ;» (ADR-777 §8.103.2)
// =============================================================================

/**
 * **Τι είδαμε στον κόσμο**: υπάρχει το έγγραφο `public_listings/{id}`; `unknown` = δεν ξέρουμε ακόμη
 * (φορτώνει) ή η ανάγνωση απέτυχε — και τότε **κανένας ισχυρισμός**.
 */
export type ListingObservation = 'present' | 'absent' | 'unknown';

/**
 * **Η απόσταση ανάμεσα στην πρόθεση και στον κόσμο.**
 *
 * | Πρόθεση (`listingPresenceOf`) | Κόσμος   | Ετυμηγορία  |
 * |-------------------------------|----------|-------------|
 * | `public`                      | `absent` | `missing`   — ο γραφέας απέτυχε· ο κόσμος **δεν** τη βλέπει |
 * | οτιδήποτε άλλο                | `present`| `lingering` — η απόσυρση απέτυχε· ο κόσμος **ακόμη** τη βλέπει |
 * | ό,τι άλλο, ή `unknown`        |          | `aligned`   |
 *
 * 🔑 **Παρατήρηση, όχι αποθηκευμένη έκβαση** (πρότυπο Zillow: την κατάσταση συνδιάθεσης την αναφέρει ο
 * **προορισμός**). Το `PublishOutcome 'failed'` δεν γράφεται πουθενά, και δεν πρέπει: η εγγραφή της αποτυχίας
 * θα αποτύγχανε στην ίδια διακοπή, θα ήταν δεύτερος γραφέας στο `properties`, και θα κατέγραφε την **απόπειρα**
 * αντί για τον κόσμο. Η σύγκριση πιάνει **κάθε** δρόμο (επαγγελματίας · ιδιώτης · συμφιλίωση) χωρίς να τον ξέρει.
 *
 * ⚠️ Μόνο **ύπαρξη**: μπαγιάτικο περιεχόμενο σε έγγραφο που υπάρχει δεν κρίνεται εδώ.
 */
export type ListingReach = 'aligned' | 'missing' | 'lingering';

/** Η ετυμηγορία — καθαρή, χωρίς χρόνο· την καθίζηση την κάνει ο καταναλωτής ({@link LISTING_REACH_SETTLE_MS}). */
export function listingReachOf(presence: ListingPresence, observed: ListingObservation): ListingReach {
  if (observed === 'unknown') return 'aligned';
  const intendedPublic = presence === 'public';
  if (intendedPublic && observed === 'absent') return 'missing';
  if (!intendedPublic && observed === 'present') return 'lingering';
  return 'aligned';
}

/**
 * **Πόσο επιμένει μια απόκλιση πριν δηλωθεί.** Το ακίνητο ενημερώνεται **πριν** ο γραφέας γράψει το δημόσιο
 * έγγραφο (μέσα στο ίδιο αίτημα αποθήκευσης), άρα κάθε αποθήκευση περνά στιγμιαία από απόκλιση. Χωρίς καθίζηση
 * το σήμα θα αναβόσβηνε ψευδή προειδοποίηση· 30″ είναι ευρύ περιθώριο για γραφέα που τελειώνει σε δευτερόλεπτα.
 */
export const LISTING_REACH_SETTLE_MS = 30_000;

type ListingReachGap = Exclude<ListingReach, 'aligned'>;

/** Ένα σήμα απόκλισης: το σήμα παρουσίας **συν** η εξήγηση που διαβάζεται. */
export interface ListingReachSpec extends ListingPresenceSpec {
  readonly hintKey: string;
}

/**
 * Απόκλιση → σήμα. Και οι δύο είναι **προειδοποίηση** (`warning` + τρίγωνο): το σήμα πρόθεσης που **δεν ισχύει**
 * δεν εμφανίζεται ποτέ. Εξαντλητικό — τρίτη απόκλιση χωρίς γραμμή δεν μεταγλωττίζεται.
 */
const LISTING_REACH_PRESENTATION: Readonly<Record<ListingReachGap, Omit<ListingPresenceSpec, 'labelKey'>>> = {
  missing: { variant: 'warning', icon: TriangleAlert },
  lingering: { variant: 'warning', icon: TriangleAlert },
};

/** Το σήμα μιας απόκλισης. */
export function listingReachSpec(reach: ListingReachGap): ListingReachSpec {
  return {
    labelKey: `listingPresence.reach.${reach}`,
    hintKey: `listingPresence.reach.${reach}Hint`,
    ...LISTING_REACH_PRESENTATION[reach],
  };
}

/** Το κλειδί του προσβάσιμου ονόματος του σήματος-συνδέσμου προς τη δημόσια σελίδα (`{label}` = η ετικέτα του σήματος). */
export const LISTING_OPEN_PUBLIC_KEY = 'listingPresence.openPublic';

/** Πόσα ακίνητα βρίσκονται σε κάθε παρουσία — πάντα **όλες** οι παρουσίες, και το μηδέν ονομασμένο. */
export function countListingPresences(
  properties: readonly OfferedAudienceFacts[],
): Readonly<Record<ListingPresence, number>> {
  const counts = Object.fromEntries(LISTING_PRESENCES.map((presence) => [presence, 0])) as Record<ListingPresence, number>;
  for (const property of properties) counts[listingPresenceOf(property)] += 1;
  return counts;
}
