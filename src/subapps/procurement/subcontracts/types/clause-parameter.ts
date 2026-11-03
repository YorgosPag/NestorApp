/**
 * @fileoverview **Τυποποιημένες παράμετροι ρήτρας** και **ζώνες ανοχής** (ADR-928 §5.2 · §5.2.1).
 * @module subapps/procurement/subcontracts/types/clause-parameter
 *
 * 🔑 **Καμία παρεμβολή αυθαίρετου κειμένου.** Η παλιά εφαρμογή (2009) είχε `{o1}…{o10}`· τα πρότυπα ADR-191
 * έχουν `{{μεταβλητή}}` μέσα σε HTML. Εδώ κάθε παράμετρος έχει **είδος**, και η τιμή της είναι **διακριτή ένωση
 * με το ίδιο είδος** — ένα ποσοστό δεν μπορεί να πάρει τιμή «50 € ανά ημέρα», ούτε στον τύπο ούτε στην επικύρωση.
 *
 * 🔑 **Ακέραιες μονάδες, ποτέ κινητή υποδιαστολή**: ποσοστά σε `BasisPoints` (5% = 500, `lib/pricing`), ποσά σε
 * `MinorAmount` (λεπτά, `lib/money`). Η κράτηση 5% επί 12.345,67 € δεν επιτρέπεται να βγει 617,2834999.
 *
 * 🏆 **Ζώνες ανοχής** (βελτίωση πάνω στο Workday Evisort «Preferred / Fallback / Walk away»): η προτιμώμενη τιμή,
 * το εύρος που περνά **χωρίς** έγκριση, και τα όρια που **απαγορεύονται**. Η έγκριση ζητείται μόνο ανάμεσα.
 */

import type { MinorAmount } from '@/lib/money/money';
import type { BasisPoints } from '@/lib/pricing/discount-rule';
import type { IsoWeekday } from '@/lib/calendar/weekly-hours';
import type { UomCode } from '@/lib/uom/uom-registry';

/** Τα είδη παραμέτρων (ADR-928 §5.2). Νέο είδος = νέος κλάδος σε κάθε διακριτή ένωση παρακάτω. */
export const CLAUSE_PARAMETER_KINDS = [
  'percent',
  'money',
  'days',
  'ratio',
  'weekday',
  'milestone',
  'unit',
  'enum',
  'party',
  'text',
] as const;
export type ClauseParameterKind = (typeof CLAUSE_PARAMETER_KINDS)[number];

/** Τα μέρη που μπορεί να ονομάσει μια ρήτρα (π.χ. «ο γερανός βαρύνει τον …»). */
export const CLAUSE_PARTIES = ['employer', 'subcontractor', 'project_owner', 'shared'] as const;
export type ClauseParty = (typeof CLAUSE_PARTIES)[number];

/**
 * Ορόσημο έργου στο οποίο δένεται μια προθεσμία ή πληρωμή («μετά τον φέροντα οργανισμό»). Ανοιχτό λεξιλόγιο της
 * εταιρείας: κλειδί + ετικέτα ανά γλώσσα στη βιβλιοθήκη, όχι κλειστή λίστα στον κώδικα.
 */
export type ProjectMilestoneKey = string;

/** Κείμενο ανά γλώσσα (ISO 639-1). Το ελληνικό είναι πάντα παρόν και υπερισχύει (ADR-928 §5.2.2). */
export type ClauseLanguage = string;
export type LocalizedText = Readonly<Record<ClauseLanguage, string>>;

/** Η τιμή μιας παραμέτρου — διακριτή ένωση στο είδος. */
export type ClauseParameterValue =
  | { readonly kind: 'percent'; readonly value: BasisPoints }
  | { readonly kind: 'money'; readonly value: MinorAmount }
  | { readonly kind: 'days'; readonly value: number }
  /** Αναλογία στη σειρά των `terms` του ορισμού, π.χ. τεχνίτες:βοηθοί:εργάτες = [1, 1, 1]. */
  | { readonly kind: 'ratio'; readonly value: readonly number[] }
  | { readonly kind: 'weekday'; readonly value: IsoWeekday }
  | { readonly kind: 'milestone'; readonly value: ProjectMilestoneKey }
  | { readonly kind: 'unit'; readonly value: UomCode }
  /** Κλειδί επιλογής από τα `options` του ορισμού. */
  | { readonly kind: 'enum'; readonly value: string }
  | { readonly kind: 'party'; readonly value: ClauseParty }
  /** Σύντομο ελεύθερο κείμενο (π.χ. όνομα εντολοδόχου). Ποτέ μορφοποίηση ή markup. */
  | { readonly kind: 'text'; readonly value: string };

/** Κλειστό αριθμητικό εύρος· `null` = ανοιχτό από αυτή την πλευρά. */
export interface NumericRange {
  readonly min: number | null;
  readonly max: number | null;
}

/**
 * Ζώνες ανοχής αριθμητικής παραμέτρου (`percent` · `money` · `days`), στη μονάδα της τιμής.
 * - `acceptable`: εντός ⇒ αλλαγή **χωρίς** έγκριση.
 * - `walkAway`: εκτός ⇒ **απαγορεύεται** (π.χ. κράτηση < 3%).
 * - ανάμεσα ⇒ απόκλιση που θέλει έγκριση (`subcontracts:agreements:approve_deviation`).
 */
export interface NumericTolerance {
  readonly kind: 'numeric';
  readonly acceptable: NumericRange;
  readonly walkAway: NumericRange;
}

/** Ζώνες ανοχής παραμέτρου επιλογής: ποιες επιλογές περνούν ελεύθερα και ποιες απαγορεύονται. */
export interface OptionTolerance {
  readonly kind: 'options';
  readonly acceptable: readonly string[];
  readonly forbidden: readonly string[];
}

/**
 * «Μόνο η προτιμώμενη περνά ελεύθερα»: κάθε άλλη έγκυρη τιμή θέλει έγκριση. Για είδη χωρίς εύρος ή επιλογές
 * (`weekday` · `milestone` · `party` · `unit` · `ratio` · `text`) όπου η εταιρεία θέλει να ελέγχει κάθε αλλαγή.
 */
export interface FixedTolerance {
  readonly kind: 'fixed';
}

/** `null` στον ορισμό ⇒ καμία ζώνη: κάθε έγκυρη τιμή είναι αποδεκτή. */
export type ClauseParameterTolerance = NumericTolerance | OptionTolerance | FixedTolerance;

/** Επιλογή παραμέτρου `enum` — κλειδί αμετάβλητο, ετικέτα ανά γλώσσα. */
export interface ClauseParameterOption {
  readonly key: string;
  readonly label: LocalizedText;
}

/**
 * 🔑 **Δέσιμο σε εμπορικό όρο** (ADR-928 §5.2 · Φ1 απόφαση 2). Οι όροι που τροφοδοτούν υπολογισμούς ζουν **μία** φορά,
 * στα δεδομένα (`CommercialTerms`). Η ρήτρα που τους διατυπώνει **δεν** κρατά δεύτερη τιμή: η παράμετρός της δένεται
 * στον όρο, παίρνει από εκεί την τιμή κατά την απόδοση, και οι **ζώνες ανοχής** της κρίνουν τα δεδομένα («κράτηση < 3%
 * απαγορεύεται» πιάνει το `CommercialTerms`). Κλειστό σύνολο· ο αναγνώστης κάθε δεσίματος ζει στο
 * `clauses/commercial-term-bindings.ts` ως ολικός `Record` (νέο κλειδί χωρίς αναγνώστη = σφάλμα μεταγλώττισης).
 */
export const COMMERCIAL_TERM_BINDING_KEYS = [
  'retention.rate',
  'withholding.rate',
  'penalty.perDay',
  'penalty.cap',
  'cash.limitPerPayment',
  'vat.treatment',
  'payment.anchorWeekday',
] as const;
export type CommercialTermBindingKey = (typeof COMMERCIAL_TERM_BINDING_KEYS)[number];

/** Από πού παίρνει τιμή η παράμετρος: από το ίδιο το έγγραφο (ανά ρήτρα) ή από δεσμευμένο εμπορικό όρο. */
export type ClauseParameterSource =
  | { readonly kind: 'clause' }
  | { readonly kind: 'term'; readonly term: CommercialTermBindingKey };

/** Ο ορισμός μιας παραμέτρου μέσα σε έκδοση ρήτρας. */
export interface ClauseParameterDefinition {
  /** Σταθερό μέσα στη ρήτρα (π.χ. `rate`, `cap`, `anchor_weekday`). */
  readonly key: string;
  readonly kind: ClauseParameterKind;
  readonly label: LocalizedText;
  readonly source: ClauseParameterSource;
  /** Η προτιμώμενη τιμή — η προεπιλογή κάθε νέου συμφωνητικού. */
  readonly preferred: ClauseParameterValue;
  readonly tolerance: ClauseParameterTolerance | null;
  /** Μόνο για `ratio`: τα μέλη της αναλογίας, με τη σειρά των τιμών. */
  readonly terms?: readonly { readonly key: string; readonly label: LocalizedText }[];
  /** Μόνο για `enum`. */
  readonly options?: readonly ClauseParameterOption[];
}

/** Πού πέφτει μια τιμή σε σχέση με τις ζώνες της παραμέτρου. */
export type ToleranceVerdict = 'preferred' | 'acceptable' | 'needs_approval' | 'forbidden';
