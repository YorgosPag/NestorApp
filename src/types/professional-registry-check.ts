/**
 * @fileoverview **Η ΑΠΑΝΤΗΣΗ ΤΟΥ ΜΗΤΡΩΟΥ ΓΙΑ ΜΙΑ ΑΔΕΙΑ** — τύποι ετυμηγορίας, αποθηκευμένου ελέγχου και κρίσης
 * (ADR-915 §40.7 Φ2). Τους βλέπουν ο διακομιστής **και** η οθόνη.
 * @module types/professional-registry-check
 *
 * 🔑 **Δήλωση ≠ απάντηση της αρχής** (πρότυπο ΓΕΜΗ, ADR-841 §7 Α23 · Stripe): οι **δηλωμένες** τάξεις ζουν στην άδεια
 *    της επαφής (`ShowcaseLicence.grades`, απόν = «δεν δηλώθηκε»)· η **απάντηση** του μητρώου ζει χωριστά, server-only,
 *    και λέει και το ρητό «Όχι» (`'none'`) — που ο άνθρωπος δεν δηλώνει ποτέ, αλλά η αρχή το γράφει.
 * 🔑 Το «επαληθευμένο» **δεν αποθηκεύεται**: κρίνεται στην ανάγνωση (`lib/professional/registry-check-judgment.ts`).
 */

import type { LicenceGrade, LicenceGradeScope, ProfessionalLicence } from '@/config/professional-licences';

/** Τι λέει το μητρώο για **μία** κατηγορία: τάξη, ή ρητό «Όχι» (το «Οχι» της στήλης). */
export type RegistryScopeAnswer = LicenceGrade | 'none';

/** Η απάντηση για **κάθε** κατηγορία της άδειας — το μητρώο δεν σιωπά, άρα ολικό. */
export type RegistryGrades = Readonly<Record<LicenceGradeScope, RegistryScopeAnswer>>;

/** Η μία γραμμή του μητρώου που μας αφορά — **μόνο** ό,τι χρειάζεται η κρίση (GDPR 5(1)(γ)). */
export interface RegistryInspectorRow {
  readonly number: string;
  /** Το επώνυμο όπως το γράφει το μητρώο — για σύγκριση με την επαφή· ποτέ δεν δείχνεται. */
  readonly surname: string;
  readonly grades: RegistryGrades;
  /** sha256 των τριών κελιών (αριθμός · επώνυμο · τάξεις) όπως διαβάστηκαν — απόδειξη, όχι αντίγραφο της σελίδας. */
  readonly rowSha256: string;
}

/** Γιατί **δεν** μάθαμε — κάθε λόγος οδηγεί σε άλλη πράξη ανθρώπου. */
export type RegistryCheckUnavailableReason =
  /** Ο διακόπτης `ENERGY_INSPECTOR_REGISTRY_LOOKUP` είναι κλειστός — ο άνθρωπος ελέγχει από τον σύνδεσμο. */
  | 'disabled'
  /** Δεν απάντησε (timeout · δίκτυο). */
  | 'network'
  /** Απάντησε με σφάλμα (5xx · 4xx). */
  | 'server';

/** Η ετυμηγορία **ενός** αιτήματος στο μητρώο. */
export type RegistryLookupVerdict =
  | { readonly kind: 'found'; readonly row: RegistryInspectorRow }
  /** Ρωτήθηκε καθαρά — ο αριθμός επέστρεψε στη σελίδα — και **δεν υπάρχει**. */
  | { readonly kind: 'absent' }
  /** Περισσότερες από μία γραμμές με τον ίδιο αριθμό — καμία μαντεψιά. */
  | { readonly kind: 'ambiguous' }
  /** Η σελίδα δεν είναι αυτή που ξέρουμε — **ονομασμένη** αποτυχία, ποτέ σιωπηλό «δεν βρέθηκε». */
  | { readonly kind: 'layout-changed'; readonly detail: string }
  | { readonly kind: 'unavailable'; readonly reason: RegistryCheckUnavailableReason };

/** Ο αποθηκευμένος έλεγχος — ένα έγγραφο ανά (επαφή, άδεια), ολική αντικατάσταση σε κάθε έλεγχο. */
export interface ProfessionalRegistryCheckRecord {
  readonly companyId: string;
  readonly contactId: string;
  readonly licence: ProfessionalLicence;
  readonly number: string;
  readonly surname: string;
  readonly grades: RegistryGrades;
  readonly rowSha256: string;
  readonly checkedAt: string;
  readonly checkedBy: string;
}

/**
 * **Η κρίση** — από το ζεύγος (τρέχουσα άδεια της επαφής ⇄ αποθηκευμένος έλεγχος), ποτέ αποθηκευμένη.
 * - `not-checked` — κανείς δεν ρώτησε το μητρώο για **αυτή** την άδεια.
 * - `verified` — ίδιος αριθμός **και** ίδιο επώνυμο: οι τάξεις είναι της αρχής.
 * - `name-mismatch` — ο αριθμός υπάρχει, αλλά ανήκει σε **άλλο** επώνυμο.
 * - `stale-number` — ο έλεγχος αφορά αριθμό που η επαφή **δεν** δηλώνει πια.
 */
export type RegistryCheckJudgment =
  | { readonly state: 'not-checked' }
  | { readonly state: 'verified'; readonly grades: RegistryGrades; readonly checkedAt: string }
  | { readonly state: 'name-mismatch'; readonly checkedAt: string }
  | { readonly state: 'stale-number'; readonly checkedAt: string };

/** Τι έμαθε η **τελευταία** ερώτηση αυτής της κλήσης (το GET δεν ρωτά ⇒ `not-asked`). */
export type RegistryCheckAttempt =
  | { readonly kind: 'not-asked' }
  | { readonly kind: 'asked' }
  | { readonly kind: 'absent' }
  | { readonly kind: 'ambiguous' }
  | { readonly kind: 'layout-changed' }
  | { readonly kind: 'unavailable'; readonly reason: RegistryCheckUnavailableReason };

/** Ό,τι παίρνει η οθόνη. */
export interface RegistryCheckReport {
  readonly judgment: RegistryCheckJudgment;
  readonly attempt: RegistryCheckAttempt;
  /** Ανοιχτός ο αυτόματος έλεγχος; Κλειστός ⇒ η οθόνη δείχνει μόνο τον σύνδεσμο χειροκίνητης αναζήτησης. */
  readonly lookupEnabled: boolean;
}

/**
 * ADR-915 §40.7 Φ3 — **τι τάξη κρατά ένας επαγγελματίας, και ΠΟΙΟΣ το λέει**: η απάντηση της αρχής (`registry`, μόνο
 * όταν ο έλεγχος κρίθηκε `verified`) **υπερισχύει** της δήλωσης (`declared`). Απούσα κατηγορία = «δεν ξέρουμε», ποτέ
 * «δεν την έχει» — το ρητό «Όχι» το γράφει μόνο η αρχή (`'none'`).
 */
export interface LicenceStanding {
  readonly grades: Readonly<Partial<Record<LicenceGradeScope, RegistryScopeAnswer>>>;
  readonly source: 'registry' | 'declared';
  /** Πότε ρωτήθηκε το μητρώο — `null` για δήλωση. */
  readonly checkedAt: string | null;
}
