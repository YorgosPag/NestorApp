/**
 * =============================================================================
 * Άδειες επαγγελματιών — ό,τι έχει κάποιος **ΕΠΙΠΛΕΟΝ** από το επάγγελμά του (ADR-915 §21 · ADR-841 Α9)
 * =============================================================================
 *
 * **Δεδομένα, ποτέ λογική.**
 *
 * 🔑 **ΑΔΕΙΑ ≠ ΕΠΑΓΓΕΛΜΑ.** Ο ενεργειακός επιθεωρητής δεν είναι ειδικότητα: είναι μηχανικός *(αριθμός ΤΕΕ, δηλωμένος
 *    στα `credentials` της βιτρίνας)* με **επιπλέον** άδεια του ΥΠΕΝ. Γι' αυτό η άδεια ζει σε δικό της πεδίο της βιτρίνας
 *    (`PublicShowcase.licences`), ανεξάρτητα από το ISCO/ESCO — όπως το Houzz κρατά το «Verified License» χωριστά από την
 *    κατηγορία του επαγγελματία.
 * 🔑 **Η αρχή ΠΑΡΑΓΕΤΑΙ από την άδεια**, ποτέ δεν τη στέλνει ο πελάτης (ίδιο ιδίωμα με το `credentialFor`).
 * 🔑 **Δηλωμένο ≠ επαληθευμένο** (ADR-798 §7): καμία σύνδεση με το μητρώο σήμερα. Το `registryLookupUrl` δίνει στον
 *    πελάτη τον δρόμο να το ελέγξει ο ίδιος — ο ψεύτικος αριθμός **εκθέτει** αυτόν που τον έγραψε (ADR-841 Α9.2).
 * ⛔ **Καμία ετικέτα εδώ** — κλειδιά i18n (N.11), στο ίδιο namespace με τη βιτρίνα (`property-market`).
 *
 * @module config/professional-licences
 * @see ADR-915 §21 — Στάδιο 2α: άδειες στη βιτρίνα
 * @see ADR-915 §34 — Φ1δ: άδεια ηλεκτρολόγου εγκαταστάτη ανά Περιφερειακή Ενότητα
 */

import { ELECTRICAL_INSTALLER_ESCO_URIS } from '@/config/electrical-installer-occupations';
import type { RegistryAuthorityId } from '@/constants/professional-registries';

/** Η ρίζα του λεξιλογίου (CHECK 3.73). Νέα άδεια (π.χ. ελεγκτής δόμησης) = νέα γραμμή εδώ + στον πίνακα. */
export const PROFESSIONAL_LICENCES = ['energy-inspector', 'electrical-installer'] as const;
export type ProfessionalLicence = (typeof PROFESSIONAL_LICENCES)[number];

// ── Τάξεις ανά κατηγορία (ADR-915 §40.7) ─────────────────────────────────────────────────────────────────────────────

/**
 * **Οι κατηγορίες μιας άδειας με τάξεις** — η ρίζα (CHECK 3.73). Σήμερα οι τρεις του Μητρώου Ενεργειακών Επιθεωρητών
 * (ΥΠΕΝ/ΣΕΝΕ/17806/1085 άρθ. 2 παρ. 1): Κτιρίων · Συστημάτων Θέρμανσης · Συστημάτων Κλιματισμού. Νέα άδεια με τάξεις
 * (π.χ. οι ομάδες του ηλεκτρολόγου) = νέες γραμμές εδώ, και δηλώνει **ποιες** ισχύουν στο δικό της `gradeScheme`.
 */
export const LICENCE_GRADE_SCOPES = ['buildings', 'heating', 'cooling'] as const;
export type LicenceGradeScope = (typeof LICENCE_GRADE_SCOPES)[number];

/** **Οι τάξεις** — Α΄ και Β΄ (ΦΕΚ Β΄ 1228/2025). ⛔ Γ΄ ΔΕΝ υπάρχει στο ισχύον κείμενο (το ν.4409/2016 άρθ. 52 αντικαταστάθηκε). */
export const LICENCE_GRADES = ['A', 'B'] as const;
export type LicenceGrade = (typeof LICENCE_GRADES)[number];

/**
 * Οι τάξεις μιας άδειας, ανά κατηγορία. 🔑 **Απούσα κατηγορία = «δεν δηλώθηκε»**, ποτέ «δεν την έχει» (ADR-798 §7): η
 * σιωπή δεν είναι άρνηση. Οι τάξεις είναι **ανεξάρτητες** ανά κατηγορία (FAQ ΕΥΕΠΕΝ Γ5: Β΄ Κτιρίων ≠ Β΄ Θέρμανσης).
 */
export type LicenceGrades = Readonly<Partial<Record<LicenceGradeScope, LicenceGrade>>>;

/**
 * **Τι επιτρέπει μια τάξη** — ως δεδομένα, ποτέ αριθμός μέσα σε κριτή.
 * - `unrestricted` — «σε όλα τα κτήρια / κτηριακές μονάδες χωρίς περιορισμό».
 * - `area-cap` — κτίρια ή κτιριακές μονάδες κάθε χρήσης, συνολικής επιφάνειας **έως και** `maxAreaSqm`.
 * - `residential-power-cap` — **μόνο** κτίρια κατοικίας, με ισχύ **κάτω** των `belowPowerKw`.
 */
export type LicenceGradeEntitlement =
  | { readonly kind: 'unrestricted' }
  | { readonly kind: 'area-cap'; readonly maxAreaSqm: number }
  | { readonly kind: 'residential-power-cap'; readonly belowPowerKw: number };

export interface LicenceGradeScheme {
  /** Η διάταξη, αυτολεξεί (εξαίρεση N.11, όπως το `statute`). */
  readonly statute: string;
  /** Πότε διαβάστηκε το κείμενο από άνθρωπο (ISO ημέρα) — όπως το `verifiedAt` του καταλόγου εγγράφων. */
  readonly verifiedAt: string;
  /** Ποιες κατηγορίες έχει **αυτή** η άδεια, με τη σειρά που δείχνονται. */
  readonly scopes: readonly LicenceGradeScope[];
  /** Τι επιτρέπει κάθε τάξη σε κάθε κατηγορία της. */
  readonly entitlements: Readonly<Partial<Record<LicenceGradeScope, Readonly<Record<LicenceGrade, LicenceGradeEntitlement>>>>>;
}

/** Οι λέξεις των κατηγοριών — κλειδιά i18n (`property-market`), ο ίδιος τύπος κλειδιού με το `nameKey` της άδειας. */
export const LICENCE_GRADE_SCOPE_PRESENTATION: Readonly<Record<LicenceGradeScope, { readonly nameKey: string }>> = {
  buildings: { nameKey: 'property-market:licences.grades.scopes.buildings.name' },
  heating: { nameKey: 'property-market:licences.grades.scopes.heating.name' },
  cooling: { nameKey: 'property-market:licences.grades.scopes.cooling.name' },
};

/** Οι λέξεις των τάξεων — «Α΄ τάξη» · «Β΄ τάξη». */
export const LICENCE_GRADE_PRESENTATION: Readonly<Record<LicenceGrade, { readonly nameKey: string }>> = {
  A: { nameKey: 'property-market:licences.grades.values.A.name' },
  B: { nameKey: 'property-market:licences.grades.values.B.name' },
};

/**
 * Το ρητό **«Όχι»** του μητρώου για μια κατηγορία (ADR-915 §40.7 Φ2) — λέξη της **αρχής**, ποτέ δήλωση ανθρώπου (ο
 * άνθρωπος δηλώνει τάξη ή σιωπά). Ίδιος πίνακας λέξεων με τις τάξεις, ώστε το Ιστορικό να τη λύνει με τον ίδιο κατάλογο.
 */
export const REGISTRY_SCOPE_NONE_PRESENTATION: { readonly nameKey: string } = {
  nameKey: 'property-market:licences.grades.values.none.name',
};

/**
 * **Πόσο «φρέσκος» μένει ένας έλεγχος στο μητρώο** (ADR-915 §40.7): μετά, η οθόνη λέει την ηλικία του και προτείνει
 * επανέλεγχο πριν από ανάθεση. Η τάξη αλλάζει σπάνια (αναβάθμιση Α΄→Β΄ με 30 επιθεωρήσεις, FAQ Β3) αλλά η εγγραφή
 * μπορεί να ανασταλεί· 180 ημέρες = ένας έλεγχος ανά εξάμηνο ανά επιθεωρητή, ποτέ αυτόματα (Α1.6).
 */
export const REGISTRY_CHECK_FRESH_DAYS = 180;

/**
 * ΥΠΕΝ/ΣΕΝΕ/17806/1085 (ΦΕΚ Β΄ 1228/12.03.2025) άρθ. 1 παρ. 4–5 — ίδιο στις FAQ του buildingcert.gr (Γ2), έρευνα
 * 2026-11-14 (ADR-915 §40.7). Β΄ = «Α΄ καθώς επίσης και Β΄» ⇒ καλύπτει τα πάντα.
 */
const ENERGY_INSPECTOR_GRADES: LicenceGradeScheme = {
  statute: 'ΥΠΕΝ/ΣΕΝΕ/17806/1085 (ΦΕΚ Β΄ 1228/2025) άρθ. 1 παρ. 4–5',
  verifiedAt: '2026-11-14',
  scopes: LICENCE_GRADE_SCOPES,
  entitlements: {
    buildings: { A: { kind: 'area-cap', maxAreaSqm: 250 }, B: { kind: 'unrestricted' } },
    heating: { A: { kind: 'residential-power-cap', belowPowerKw: 150 }, B: { kind: 'unrestricted' } },
    cooling: { A: { kind: 'residential-power-cap', belowPowerKw: 150 }, B: { kind: 'unrestricted' } },
  },
};

export interface ProfessionalLicenceSpec {
  /**
   * Ποιο μητρώο κρατά την άδεια. Εθνική αρχή ⇒ αρκεί ο αριθμός· αρχή **με παραρτήματα** (`regional-authority`) ⇒ ο
   * εκδότης (Περιφερειακή Ενότητα) δηλώνεται **πάντα** δίπλα στον αριθμό (ADR-841 Α9.1 · ADR-915 §34).
   */
  readonly authority: RegistryAuthorityId;
  /** Η διάταξη, αυτολεξεί (εξαίρεση N.11 όπως το `statute` του καταλόγου εγγράφων). */
  readonly statute: string;
  /**
   * Η δημόσια σελίδα του μητρώου, όπου ο καθένας ελέγχει έναν αριθμό — `null` = **δεν υπάρχει** δημόσια αναζήτηση
   * (ελέγχθηκε, με ημερομηνία στο σχόλιο της γραμμής). Ποτέ σύνδεσμος σε σελίδα που δεν απαντά στο ερώτημα.
   */
  readonly registryLookupUrl: string | null;
  /** Κλειδί i18n του ονόματος της άδειας (πλήρες, με namespace — ο τεμαχιστής του CHECK 3.34 το λύνει στατικά). */
  readonly nameKey: string;
  /**
   * 🔑 **Η ειδικότητα ΕΙΝΑΙ η άδεια** (ADR-915 §34 Λ3): ειδικότητες ESCO των οποίων η εγγραφή στην **ίδια** αρχή είναι
   * αυτή ακριβώς η άδεια — ο ηλεκτρολόγος 7411 με αριθμό Περιφέρειας **δεν** τη δηλώνει δεύτερη φορά. Κενό = η άδεια
   * αποδεικνύεται **μόνο** ρητά (ο επιθεωρητής είναι μηχανικός ΤΕΕ — η εγγραφή του στο ΤΕΕ δεν είναι η άδεια ΥΠΕΝ).
   */
  readonly heldThroughOccupations: readonly string[];
  /** Οι τάξεις ανά κατηγορία που κρατά το μητρώο για αυτή την άδεια — `null` = η άδεια δεν έχει τάξεις. */
  readonly gradeScheme: LicenceGradeScheme | null;
}

export const PROFESSIONAL_LICENCE_SPECS: Readonly<Record<ProfessionalLicence, ProfessionalLicenceSpec>> = {
  // Μητρώο Ενεργειακών Επιθεωρητών της ΕΥΕΠΕΝ (buildingcert.gr): εγγραφή με αύξοντα αριθμό, που αναγράφεται στην άδεια
  // του επιθεωρητή και στο ΠΕΑ που εκδίδει (έρευνα 2026-10-16, ADR-915 §21).
  // 🔑 Η ΔΗΜΟΣΙΑ αναζήτηση (περιοχή · προσωπικά στοιχεία), ΧΩΡΙΣ Taxisnet — επαληθευμένο 2026-11-14 (ADR-915 §39.6).
  //    Η αρχική σελίδα οδηγούσε στην είσοδο ΓΓΠΣ: σωστό για τον ίδιο τον επιθεωρητή, ψευδές για το «δημόσιο μητρώο».
  'energy-inspector': {
    authority: 'ypen',
    statute: 'ν.4122/2013 · ν.4409/2016 άρθ. 52 · ΥΠΕΝ/ΣΕΝΕ/17806/1085 (ΦΕΚ Β΄ 1228/2025)',
    registryLookupUrl: 'https://www.buildingcert.gr/inspectors/startValues.view',
    nameKey: 'property-market:licences.energyInspector.name',
    heldThroughOccupations: [],
    gradeScheme: ENERGY_INSPECTOR_GRADES,
  },
  // Άδεια ηλεκτρολόγου εγκαταστάτη (Α' ειδικότητα, ομάδες 1–4 — ΟΛΕΣ εκδίδουν ΥΔΕ, π.δ. 108/2013 άρθ. 4) ή βεβαίωση
  // αναγγελίας μηχανικού/πτυχιούχου (άρθ. 10): την εκδίδει η υπηρεσία της Περιφέρειας «του τόπου επαγγελματικής
  // εγκατάστασης» (ν.3982/2011 άρθ. 5) ⇒ αρχή ανά Περιφερειακή Ενότητα. Το Ενιαίο Μητρώο (άρθ. 9) τηρείται στη ΓΓ
  // Βιομηχανίας χωρίς δημόσια αναζήτηση (έρευνα 2026-10-18· μόνο αρχεία ανά έτος σε ορισμένες ΠΕ) ⇒ `null`.
  'electrical-installer': {
    authority: 'regional-authority',
    statute: 'ν.3982/2011 · π.δ. 108/2013',
    registryLookupUrl: null,
    nameKey: 'property-market:licences.electricalInstaller.name',
    heldThroughOccupations: ELECTRICAL_INSTALLER_ESCO_URIS,
    // Οι ομάδες 1–4 του π.δ. 108/2013 ΕΙΝΑΙ τάξεις — δεν μοντελοποιούνται ακόμη (καμία απόφαση δεν τις ζητά).
    gradeScheme: null,
  },
};

/** *«Ξέρει το σύστημα αυτή την άδεια;»* — ο φρουρός της εισόδου (σώμα αιτήματος · παλιό έγγραφο Firestore). */
export function isProfessionalLicence(value: unknown): value is ProfessionalLicence {
  return typeof value === 'string' && (PROFESSIONAL_LICENCES as readonly string[]).includes(value);
}

export function isLicenceGradeScope(value: unknown): value is LicenceGradeScope {
  return typeof value === 'string' && (LICENCE_GRADE_SCOPES as readonly string[]).includes(value);
}

export function isLicenceGrade(value: unknown): value is LicenceGrade {
  return typeof value === 'string' && (LICENCE_GRADES as readonly string[]).includes(value);
}

/**
 * **Πού αναζητά κανείς έναν αριθμό αυτού του μητρώου;** (ADR-915 §39.6) — **παράγεται** από τις άδειες που κρατά η αρχή,
 * ποτέ δεύτερος κατάλογος διευθύνσεων. Καμία ή **περισσότερες από μία** διαφορετικές σελίδες ⇒ `null`: σύνδεσμος που
 * ίσως δεν απαντά στο ερώτημα δεν δίνεται (ίδιος κανόνας με το `registryLookupUrl`).
 * Το ζητά η φόρμα δήλωσης ιδιότητας της πρόσκλησης: «δεν θυμάστε τον αριθμό; αναζήτηση στο μητρώο».
 */
export function registryAuthorityLookupUrl(authority: RegistryAuthorityId): string | null {
  const urls = new Set<string>();
  for (const licence of PROFESSIONAL_LICENCES) {
    const spec = PROFESSIONAL_LICENCE_SPECS[licence];
    if (spec.authority === authority && spec.registryLookupUrl !== null) urls.add(spec.registryLookupUrl);
  }
  return urls.size === 1 ? [...urls][0] : null;
}
