/**
 * =============================================================================
 * Ισχύς εγγράφων — ο ΕΝΑΣ κατάλογος κανόνων (ADR-915 Φ1)
 * =============================================================================
 *
 * **«Πόσο ισχύει αυτό το είδος εγγράφου;»** — μία απάντηση ανά είδος, με την πηγή της.
 *
 * 🔴 **Γιατί υπάρχει**: η ισχύς του ΠΕΑ ήταν δηλωμένη **δύο φορές με άλλη μονάδα** — `120` μήνες στην αγγελία
 * (`lib/energy-certificate`) και `3650` ημέρες στη μεταβίβαση (`config/conveyance-checklist`). Για έκδοση 2026-07-16 η
 * αγγελία έλεγε «ισχύει ως 2036-07-16» και η μεταβίβαση «ως 2036-07-13»: **τρεις μέρες** όπου το ίδιο έγγραφο ήταν σε
 * ισχύ στη μία οθόνη και ληγμένο στην άλλη. Ο νόμος μετρά **έτη** ⇒ μήνες ημερολογίου, ποτέ ημέρες.
 *
 * 🔑 **Εδώ ζουν τα είδη που παρακολουθεί το μητρώο λήξεων** (σελίδα, ειδοποιήσεις, «τι σταματά») — όσα ρωτούν
 * περισσότερες διαδικασίες (αγγελία + μεταβίβαση + νομιμότητα) **και** όσα έχουν τεκμηριωμένη διάρκεια (ADR-915 §14).
 * Ένα έγγραφο χωρίς τεκμηριωμένη διάρκεια κρατά τον κανόνα στη γραμμή του καταλόγου — ίδιο σχήμα, μία πηγή.
 *
 * ⚠️ **`unverified` ΔΕΝ είναι «δεν λήγει»**: σημαίνει «έχει περιορισμένη ισχύ, αλλά τη διάρκεια δεν την επαληθεύσαμε με
 * πηγή». Η απάντηση νομιμότητας το λέει `expiry-unknown`, ποτέ «σε ισχύ».
 *
 * @module config/document-validity/document-validity
 * @see ADR-915 — Μητρώο λήξεων εγγράφων + αλυσίδα απαιτήσεων
 */

import type { EvidenceMatcher } from '@/config/conveyance-checklist/types';
import type { DocumentIssuer, DocumentObligor } from '@/config/document-validity/document-issuers';
import type { PropertyClass } from '@/constants/property-types';

/**
 * Κανόνας ισχύος ενός είδους εγγράφου:
 * - `none`       — δεν λήγει (τίτλοι, άδειες, σχέδια)
 * - `months`     — λήγει N μήνες ημερολογίου μετά την έκδοση (ο νόμος λέει «έτη»)
 * - `days`       — λήγει N ημέρες μετά την έκδοση (ο νόμος λέει «ημέρες»)
 * - `act_day`    — εκδίδεται την ημέρα της πράξης (π.χ. πιστοποιητικό βαρών)
 * - `unverified` — περιορισμένη ισχύς, διάρκεια **ΜΗ** επαληθευμένη
 * - `printed`    — η λήξη είναι **τυπωμένη στο έγγραφο** και εξαρτάται από ό,τι μόνο εκείνο ξέρει (οφειλές, κύκλος
 *                  ΕΝΦΙΑ)· ο νόμος δίνει **όρια**: `floor` = εγγυημένη ελάχιστη (`null` = καμία εγγύηση), `ceiling` =
 *                  ανώτατη. Πρακτική Procore/ACC (η ημερομηνία ζει στο έγγραφο) + έλεγχος ορίων (ADR-915 §14).
 */
export type DocumentValidityRule =
  | { readonly kind: 'none' }
  | { readonly kind: 'months'; readonly months: number }
  | { readonly kind: 'days'; readonly days: number }
  | { readonly kind: 'act_day' }
  | { readonly kind: 'unverified' }
  | { readonly kind: 'printed'; readonly floor: ValidityBound | null; readonly ceiling: ValidityCeiling };

/**
 * Ένα νόμιμο όριο λήξης, μετρημένο από την έκδοση:
 * - `months`       — N μήνες ημερολογίου
 * - `end-of-month` — η τελευταία ημέρα του μήνα έκδοσης
 * - `end-of-year`  — 31/12 του έτους έκδοσης
 * - `enfia-cycle`  — έκδοση **πριν** την πρώτη κεντρική έκδοση ΕΝΦΙΑ του έτους ⇒ η παραμονή της· μετά ⇒ 31/12· έτος
 *                    χωρίς γνωστή κεντρική έκδοση ({@link ENFIA_CENTRAL_ISSUANCE}) ⇒ άγνωστο, ποτέ μαντεψιά
 */
export type ValidityBound =
  | { readonly kind: 'months'; readonly months: number }
  | { readonly kind: 'end-of-month' }
  | { readonly kind: 'end-of-year' }
  | { readonly kind: 'enfia-cycle' };

/**
 * Το **ανώτατο** όριο ενός κανόνα `printed`: ένα {@link ValidityBound}, ή μήνες που εξαρτώνται από **δύο** γεγονότα του
 * ίδιου του εγγράφου — **πότε** εκδόθηκε (ποιο καθεστώς ίσχυε) και **σε ποια κατηγορία** το κατέταξε ο εκδότης
 * ({@link DOCUMENT_CLASSIFICATIONS}). Μόνο ανώτατο, ποτέ κατώτατο: με άγνωστη κατηγορία ισχύει το **μέγιστο** του
 * καθεστώτος — ό,τι ο νόμος επιτρέπει για κάποια κατηγορία· για κατώτατο αυτό θα ήταν εγγύηση που δεν υπάρχει.
 */
export type ValidityCeiling =
  | ValidityBound
  | { readonly kind: 'classified-months'; readonly regimes: readonly ValidityRegime[] };

/** Ένα νομικό καθεστώς διαρκειών: από ποια ημέρα έκδοσης ισχύει, και μήνες ανά κατηγορία. */
export interface ValidityRegime {
  /** Πρώτη ημέρα έκδοσης (`YYYY-MM-DD`) που ακολουθεί το καθεστώς· `null` = ό,τι εκδόθηκε πριν από κάθε άλλο. */
  readonly from: string | null;
  readonly months: Readonly<Record<DocumentClassification, number>>;
  /** Η διάταξη, αυτολεξεί (εξαίρεση N.11, όπως το `statute` του είδους). */
  readonly statute: string;
}

/**
 * **Η κατάταξη που γράφει ο ΕΚΔΟΤΗΣ πάνω στο έγγραφο**, ανά είδος — γεγονός του εγγράφου, ποτέ του ακινήτου.
 *
 * 🔴 **Γιατί όχι ο τύπος του ακινήτου** (ADR-915 §32): το ΦΕΚ Β' 4654/2021, Παράρτημα ΙΙ παρ. 1, αυτολεξεί: «Η κατάταξη
 * ΕΗΕ σε κατηγορία Α, Β και Γ […] γίνεται με ευθύνη του συντάκτη της ΥΔΕ». Ο τύπος ακινήτου θα έκανε λάθος: η αποθήκη
 * κατοικίας είναι Α (Α5) ενώ το `PROPERTY_TYPE_CLASS` λέει `commercial`· το καφέ άνω των 50 ατόμων είναι Γ (2 έτη).
 * Ο τύπος ακινήτου είναι μόνο **υπόδειξη** στη δήλωση.
 *
 * Οι κωδικοί είναι λατινικοί (`C` = Γ)· η ετικέτα ζει στα locales (N.11).
 */
export const DOCUMENT_CLASSIFICATIONS = {
  'electrical-installation': ['A', 'B', 'C'],
} as const;
type ClassifiedDocumentKind = keyof typeof DOCUMENT_CLASSIFICATIONS;
export type DocumentClassification = (typeof DOCUMENT_CLASSIFICATIONS)[ClassifiedDocumentKind][number];

/**
 * Τακτικός επανέλεγχος εσωτερικής ηλεκτρικής εγκατάστασης — **μέγιστο** διάστημα ανά κατηγορία (ADR-915 §32).
 *
 * - **Από 08.10.2021** (έναρξη ισχύος, άρθρο 7 παρ. 1 — δημοσίευση ΦΕΚ Β' 4654/08.10.2021): άρθρο 4 παρ. 5 + Παράρτημα
 *   ΙΙ, αυτολεξεί: «Α. ΕΗΕ σε κατοικίες και ανάλογους χώρους, με μέγιστο χρονικό διάστημα τακτικού επανελέγχου δέκα (10)
 *   χρόνια» · «Β. ΕΗΕ σε επαγγελματικούς χώρους, […] πέντε (5) χρόνια» · «Γ. ΕΗΕ σε χώρους ψυχαγωγίας και συνάθροισης
 *   κοινού και υπαίθριες επαγγελματικές ΕΗΕ, […] δύο (2) χρόνια». Διαβασμένο από τις σελίδες του ΦΕΚ (2026-10-18).
 * - **Πριν**: άρθρο 6 παρ. 1–2 — οι ΥΔΕ που υποβλήθηκαν πριν, **ή** εκδόθηκαν ως 9 μήνες πριν και υποβλήθηκαν μετά,
 *   κρατούν «τα προβλεπόμενα κατά την έκδοσή τους χρονικά διαστήματα επανελέγχου» ⇒ κρίνει η **έκδοση**. Παλιό καθεστώς
 *   (ΥΑ Φ.7.5/1816/88/2004, Β' 470, άρθρο 5): «τουλάχιστον κάθε 14 χρόνια για τις κατοικίες και σε χρονικά διαστήματα
 *   από 1 έως 7 χρόνια για επαγγελματικούς χώρους» — ⚠️ από απάντηση υπουργείου στη Βουλή, **όχι** από το ΦΕΚ του 2004·
 *   οι κατηγορίες εκείνου του καθεστώτος δεν είναι οι Α/Β/Γ ⇒ Β και Γ παίρνουν το μέγιστο των επαγγελματικών (7 έτη).
 */
export const ELECTRICAL_REINSPECTION_REGIMES: readonly ValidityRegime[] = [
  { from: '2021-10-08', months: { A: 120, B: 60, C: 24 }, statute: 'ΥΑ 101195/17.9.2021 (ΦΕΚ Β\' 4654/2021) άρθρο 4 παρ. 5 · Παράρτημα ΙΙ' },
  { from: null, months: { A: 168, B: 84, C: 84 }, statute: 'ΥΑ Φ.7.5/1816/88/2004 (ΦΕΚ Β\' 470) άρθρο 5 · άρθρο 6 παρ. 1–2 ΥΑ 101195/2021' },
];

/**
 * Η **πρώτη κεντρική έκδοση** της πράξης προσδιορισμού ΕΝΦΙΑ ανά έτος (Α.1085/2023 άρθρο 1 παρ. 6α: το πιστοποιητικό
 * που εκδόθηκε πριν από αυτήν ισχύει **μέχρι** αυτήν). Δεδομένα με πηγή — έτος χωρίς γραμμή = «δεν ξέρουμε».
 * ⚠️ Το «μέχρι την ημερομηνία» δεν λέει αν η ημέρα της έκδοσης είναι μέσα ⇒ το κατώτατο κρατά την **παραμονή**.
 */
export const ENFIA_CENTRAL_ISSUANCE: Readonly<Record<number, string>> = {
  // ΑΑΔΕ, δελτίο τύπου 08.04.2024: «Ολοκληρώθηκε εχθές το βράδυ η ανάρτηση 7.159.164 εκκαθαριστικών σημειωμάτων του
  // ΕΝΦΙΑ» (aade.gr/sites/default/files/2024-04/dt_08.04.2024.pdf) ⇒ 07/04.
  2024: '2024-04-07',
  // ΑΑΔΕ, δελτίο τύπου 09.03.2025: «Ολοκληρώθηκε το απόγευμα της Κυριακής 9/3 η ανάρτηση των εκκαθαριστικών ΕΝΦΙΑ για
  // το έτος 2025» (aade.gr/sites/default/files/2025-03/dt_09.03.2025..pdf).
  2025: '2025-03-09',
  // ΑΑΔΕ, δελτίο τύπου 15.03.2026 «Αναρτήθηκαν τα εκκαθαριστικά ΕΝΦΙΑ 2026» (aade.gr/sites/default/files/2026-03/dt_15.03.2026.pdf)
  2026: '2026-03-15',
};

/**
 * Ως πότε (`MM-DD`) είναι **αναμενόμενο** να μην έχει γίνει ακόμη η κεντρική έκδοση του έτους. Μετά, έτος χωρίς γραμμή
 * σημαίνει «ξεχάσαμε να την καταχωρίσουμε», όχι «δεν έγινε»: κάθε πιστοποιητικό του έτους δείχνει σιωπηλά «άγνωστη
 * λήξη». Βαθμονόμηση από τον πίνακα: η αργότερη κεντρική έκδοση ήταν 07/04 (2024) ⇒ τέλος Απριλίου.
 */
export const ENFIA_CENTRAL_ISSUANCE_EXPECTED_BY = '04-30';

/** Τα είδη εγγράφων που παρακολουθεί το μητρώο λήξεων. Κλειστό σύνολο — νέο είδος δεν μεταγλωττίζεται χωρίς κανόνα με πηγή. */
export const DOCUMENT_KINDS = [
  'energy-certificate',
  'building-identity',
  'tax-clearance',
  'insurance-clearance',
  'enfia-certificate',
  'electrical-installation',
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

function isClassifiedKind(kind: DocumentKind): kind is ClassifiedDocumentKind {
  return Object.prototype.hasOwnProperty.call(DOCUMENT_CLASSIFICATIONS, kind);
}

/** Οι κατηγορίες που δέχεται ένα είδος — κενό = το είδος δεν κατατάσσεται. */
export function classificationsOf(kind: DocumentKind): readonly DocumentClassification[] {
  return isClassifiedKind(kind) ? DOCUMENT_CLASSIFICATIONS[kind] : [];
}

/** *«Είναι αυτή η τιμή κατηγορία αυτού του είδους;»* — ο φρουρός του ανεκτικού αναγνώστη και της δήλωσης. */
export function isClassificationOf(kind: DocumentKind, value: unknown): value is DocumentClassification {
  return typeof value === 'string' && (classificationsOf(kind) as readonly string[]).includes(value);
}

/**
 * ADR-915 §33 — **υπόδειξη** κατηγορίας από την κλάση του ακινήτου, για την προεπιλογή του διαλόγου δήλωσης. ⚠️ ΠΟΤΕ
 * αλήθεια: την κατηγορία τη γράφει ο εκδότης (Παράρτημα ΙΙ παρ. 1)· αποθήκη κατοικίας = Α ενώ η κλάση της λέει
 * `commercial`, καφέ άνω των 50 ατόμων = Γ. Ο διακομιστής **δεν** τη διαβάζει. `null` = καμία υπόδειξη.
 */
const DOCUMENT_CLASSIFICATION_HINTS: Readonly<
  Record<ClassifiedDocumentKind, Readonly<Record<PropertyClass, DocumentClassification | null>>>
> = {
  // Α «κατοικίες και ανάλογους χώρους» · Β «επαγγελματικούς χώρους» · οικόπεδο: καμία εσωτερική εγκατάσταση.
  'electrical-installation': { residential: 'A', commercial: 'B', land: null },
};

/** Η υπόδειξη για αυτό το είδος σε ακίνητο αυτής της κλάσης — `null` όταν το είδος δεν κατατάσσεται ή δεν ξέρουμε. */
export function classificationHintOf(kind: DocumentKind, propertyClass: PropertyClass | null): DocumentClassification | null {
  if (propertyClass === null || !isClassifiedKind(kind)) return null;
  return DOCUMENT_CLASSIFICATION_HINTS[kind][propertyClass];
}

export interface DocumentKindSpec {
  readonly rule: DocumentValidityRule;
  /** Η διάταξη, αυτολεξεί όπως παραπέμπεται (όχι κείμενο διεπαφής — ίδια εξαίρεση N.11 με το `LegalityClaimKindSpec.statute`). */
  readonly statute: string;
  /**
   * Πόσες ημέρες πριν τη λήξη πρέπει να ξεκινήσει η ανανέωση (επιθεωρητής, ραντεβού, έκδοση). `null` = δεν λήγει ή δεν
   * ξέρουμε πόσο θέλει. Το διαβάζουν οι ειδοποιήσεις (ADR-915 Φ5): η προειδοποίηση έρχεται όταν **προλαβαίνεις**.
   */
  readonly renewalLeadDays: number | null;
  /** Πότε επαλήθευσε τον κανόνα επαγγελματίας. `null` = από δευτερογενείς πηγές — το UI το δηλώνει. */
  readonly verifiedAt: string | null;
  /**
   * Ο νόμος απαιτεί η **αγγελία** να αναγράφει αυτό το έγγραφο ⇒ αγγελία **χωρίς** αυτό = «λείπει» (ADR-915 Φ4δ Ε7).
   * `null` = η αγγελία μπορεί να το δείξει, δεν οφείλει — η απουσία του δεν είναι κενό. Διάταξη αυτολεξεί (εξαίρεση N.11).
   */
  readonly advertisingDisclosure: { readonly statute: string } | null;
  /** Ποιος το **εκδίδει** — προσόν, όχι επάγγελμα (ADR-915 §18, `document-issuers.ts`). */
  readonly issuer: DocumentIssuer;
  /** Ποιος **οφείλει να το φέρει** — ουδέτερα ως προς τη διαδικασία (στη μεταβίβαση: ο πωλητής). */
  readonly obligor: DocumentObligor;
  /**
   * Η **δημόσια** σελίδα όπου ο καθένας ελέγχει την ισχύ αυτού του εγγράφου στην αρχή που το τηρεί — σύνδεσμος, **ποτέ**
   * scraping (ίδιο δόγμα με το `registryLookupUrl` των αδειών, ADR-798 §7). `null` = καμία επαληθευμένη σελίδα.
   */
  readonly publicLookup: { readonly url: string; readonly verifiedAt: string } | null;
  /**
   * **Από πού ανεβαίνει**, για είδος που **δεν** το ζητά ο κατάλογος μεταβίβασης (ADR-915 §32 — η ΥΔΕ). Τα είδη του
   * καταλόγου δηλώνουν τα entry points τους **στη γραμμή τους** και εδώ `null`: ΕΝΑΣ ιδιοκτήτης ανά είδος (άγκυρα
   * `document-kind-of-file.test.ts`), αλλιώς οι δύο λίστες θα απέκλιναν σιωπηλά.
   */
  readonly standaloneEvidence: readonly EvidenceMatcher[] | null;
  /**
   * ADR-915 §35 — **μόνιμη υποχρέωση του ακινήτου**: ο νόμος θέλει αυτό το έγγραφο σε ισχύ **όσο ζει** το ακίνητο, όχι
   * μόνο όσο κρατά μια πράξη. `proposedFor` = οι κλάσεις όπου η εφαρμογή **προτείνει** τη δήλωση — **ποτέ** απαίτηση
   * μόνη της: την υποχρέωση την επιβεβαιώνει άνθρωπος, με ίχνος (`property-upkeep`).
   * `null` = το έγγραφο γεννιέται από πράξη (ΠΕΑ: πώληση · μίσθωση · αγγελία, ν.4122/2013 άρθρο 12 — τις καλύπτουν ήδη
   * η μεταβίβαση και η αγγελία· βεβαιώσεις: ανά συμβόλαιο). Διάταξη αυτολεξεί (εξαίρεση N.11).
   */
  readonly standingObligation: {
    readonly statute: string;
    readonly proposedFor: readonly PropertyClass[];
  } | null;
}

export const DOCUMENT_KIND_SPECS: Readonly<Record<DocumentKind, DocumentKindSpec>> = {
  // 10 έτη από την έκδοση (ορισμός ν.4122/2013 όπως τροποποιήθηκε με ν.4409/2016)· λήγει νωρίτερα με ριζική ανακαίνιση.
  // Ανανέωση = νέα επιθεώρηση από ενεργειακό επιθεωρητή ⇒ εβδομάδες, όχι μέρες.
  'energy-certificate': {
    rule: { kind: 'months', months: 120 },
    statute: 'ν.4122/2013 · ν.4409/2016',
    renewalLeadDays: 60,
    verifiedAt: null,
    // Η ενεργειακή κατηγορία αναγράφεται σε ΚΑΘΕ εμπορική αγγελία πώλησης/μίσθωσης (ΥΠΕΝ, από 1/1/2021· έρευνα
    // 2026-10-15). Το άρθρο 12 αντικαταστάθηκε από το άρθρο 65 ν.4685/2020 — η αρίθμηση παραγράφου ΔΕΝ επαληθεύτηκε.
    advertisingDisclosure: { statute: 'ν.4122/2013 άρθρο 12 (άρθρο 65 ν.4685/2020)' },
    // Εκδίδει ενεργειακός επιθεωρητής εγγεγραμμένος στο Μητρώο της ΕΥΕΠΕΝ (buildingcert.gr) — έρευνα 2026-10-16, §18.
    issuer: {
      kind: 'professional',
      qualifications: ['energy-inspector-registered'],
      appointedBy: 'owner',
      statute: 'ν.4122/2013 (Μητρώο Ενεργειακών Επιθεωρητών)',
      verifiedAt: null,
    },
    obligor: 'owner',
    publicLookup: null,
    standaloneEvidence: null,
    standingObligation: null,
  },
  // Άρθρο 83 παρ. 6 Ν.4495/2017, αυτολεξεί: «Οι ανωτέρω βεβαιώσεις των μηχανικών έχουν ισχύ δύο (2) μηνών από την
  // υπογραφή τους» (έρευνα 2026-10-16, ADR-915 §13). ⚠️ Η έρευνα της 2026-10-14 δεν το είχε βρει και ο κανόνας ήταν
  // `unverified`. Πηγή: κωδικοποιημένο κείμενο (lawspot · taxheaven), όχι ΦΕΚ ⇒ `verifiedAt: null`.
  'building-identity': {
    rule: { kind: 'months', months: 2 },
    statute: 'άρθρο 83 παρ. 6 Ν.4495/2017',
    // Εκτίμηση πρακτικής (νέα αυτοψία + υπογραφή μηχανικού), ΟΧΙ διάταξη — απόφαση Giorgio 2026-10-16 (ADR-915 §13).
    renewalLeadDays: 14,
    verifiedAt: null,
    // `disclosed-only` στη νομιμότητα (ADR-777 §7 #4): ζητείται στη μεταβίβαση, όχι στην αγγελία.
    advertisingDisclosure: null,
    // Απόφαση Δ.Ε. ΤΕΕ (ειδικότητες της ομάδας έργου για το Πιστοποιητικό Πληρότητας, που περιλαμβάνει τη βεβαίωση του
    // άρθρου 83 παρ. 1): Πολιτικός · Αρχιτέκτων · Αγρονόμος Τοπογράφος · Χωροταξίας-Πολεοδομίας · Πολιτικός
    // Υπομηχανικός · Πτυχ. Πολιτικός ΤΕΙ/ΑΤΕΙ. Ο εξουσιοδοτημένος μηχανικός ορίζεται από τον ιδιοκτήτη (έρευνα 2026-10-16).
    issuer: {
      kind: 'professional',
      qualifications: [
        'civil-engineer', 'architect', 'surveyor-engineer', 'spatial-planner', 'civil-sub-engineer', 'civil-engineer-tei',
      ],
      appointedBy: 'owner',
      statute: 'άρθρο 83 παρ. 1 Ν.4495/2017 · απόφαση Δ.Ε. ΤΕΕ',
      verifiedAt: null,
    },
    obligor: 'owner',
    publicLookup: null,
    standaloneEvidence: null,
    standingObligation: null,
  },
  // Τα τρία παρακάτω εκδίδονται ηλεκτρονικά (myAADE · e-ΕΦΚΑ) την ίδια μέρα ⇒ η ανανέωση θέλει μέρες, όχι εβδομάδες:
  // `renewalLeadDays: 7` = εκτίμηση πρακτικής, όχι διάταξη. Πηγές = κωδικοποιημένα κείμενα, όχι ΦΕΚ ⇒ `verifiedAt: null`.
  // Η αγγελία δεν τα αναγράφει ⇒ `advertisingDisclosure: null`.
  //
  // 2 μήνες χωρίς βεβαιωμένες οφειλές · 1 μήνας με μη ληξιπρόθεσμες / σε αναστολή / σε ρύθμιση (Α.1162/2023 άρθρο 5).
  'tax-clearance': {
    rule: { kind: 'printed', floor: { kind: 'months', months: 1 }, ceiling: { kind: 'months', months: 2 } },
    statute: 'άρθρο 12 Ν.4987/2022 · Α.1162/2023 άρθρο 5',
    renewalLeadDays: 7,
    verifiedAt: null,
    advertisingDisclosure: null,
    issuer: { kind: 'authority', service: 'aade-tax-clearance' },
    obligor: 'owner',
    publicLookup: null,
    standaloneEvidence: null,
    standingObligation: null,
  },
  // ΑΑΕ: 6 μήνες χωρίς οφειλή · 2 μήνες με ρύθμιση που τηρείται · έως το τέλος του μήνα έκδοσης με αρρύθμιστη οφειλή ή
  // βεβαίωση οφειλής (ΥΑ 15435/913/2020 άρθρο 6 παρ. 1 α΄–γ΄, ΦΕΚ Β' 1559 — αυτολεξεί, ADR-915 §16) ⇒ το τέλος του μήνα
  // είναι το εγγυημένο κατώτατο. Ποιος τη χρειάζεται: γεγονός `seller_insurance_liable` (άρθρο 1 περ. 6 · άρθρο 2 αρ. 7).
  'insurance-clearance': {
    rule: { kind: 'printed', floor: { kind: 'end-of-month' }, ceiling: { kind: 'months', months: 6 } },
    statute: 'ΥΑ 15435/913/2020 άρθρο 6 · άρθρο 25 Ν.4611/2019',
    renewalLeadDays: 7,
    verifiedAt: null,
    advertisingDisclosure: null,
    issuer: { kind: 'authority', service: 'efka-insurance-clearance' },
    obligor: 'owner',
    publicLookup: null,
    standaloneEvidence: null,
    standingObligation: null,
  },
  // Έως την πρώτη κεντρική έκδοση ΕΝΦΙΑ του έτους (αν εκδόθηκε πριν από αυτήν) · αλλιώς ως 31/12 του έτους έκδοσης
  // (Α.1085/2023 άρθρο 1 παρ. 6). ⚠️ Αποβιώσαντες / νομικά πρόσωπα σε διακοπή (Α.1082/2024): ισχύει ως τη μνημόνευση
  // σε συμβόλαιο, όποια ημερομηνία κι αν τυπώνει — ο ελεγκτής το βλέπει ως ασυμφωνία, δεν κρύβεται.
  'enfia-certificate': {
    rule: { kind: 'printed', floor: { kind: 'enfia-cycle' }, ceiling: { kind: 'end-of-year' } },
    statute: 'ν.5036/2023 · Α.1085/2023 άρθρο 1 παρ. 6',
    renewalLeadDays: 7,
    verifiedAt: null,
    advertisingDisclosure: null,
    issuer: { kind: 'authority', service: 'aade-enfia-certificate' },
    obligor: 'owner',
    publicLookup: null,
    standaloneEvidence: null,
    standingObligation: null,
  },
  // ΥΔΕ — Υπεύθυνη Δήλωση Ηλεκτρολόγου Εγκαταστάτη (ADR-915 §32). Λήγει η ΥΔΕ, ΟΧΙ το ηλεκτρολογικό σχέδιο (συνημμένο
  // της, δεν λήγει). Το υπόδειγμα (Παράρτημα Ι) **τυπώνει** «ΕΠΟΜΕΝΟΣ ΤΑΚΤΙΚΟΣ ΕΠΑΝΕΛΕΓΧΟΣ — μέχρι:» ⇒ `printed`.
  // `floor: null`: ο συντάκτης μπορεί να ορίσει **μικρότερο** διάστημα «για λόγους ασφαλείας», με αιτιολόγηση (Παράρτημα
  // ΙΙ παρ. 4) ⇒ ο νόμος δεν εγγυάται κανένα κατώτατο, και η μικρότερη τυπωμένη ΔΕΝ είναι ασυμφωνία.
  // Η αγγελία και ο συμβολαιογράφος δεν τη ζητούν ⇒ `advertisingDisclosure: null`, καμία γραμμή καταλόγου μεταβίβασης.
  // Νέα ΥΔΕ πριν τη λήξη (έκτακτος έλεγχος, άρθρο 4 παρ. 4γ): αλλαγή κατηγορίας/χρήσης (30 ημέρες) · αλλαγή ιδιοκτήτη ή
  // καταναλωτή **μόνο** στις Β και Γ · τροποποίηση πίνακα/γείωσης · ατύχημα · πλημμύρα, πυρκαγιά, σεισμός.
  'electrical-installation': {
    rule: { kind: 'printed', floor: null, ceiling: { kind: 'classified-months', regimes: ELECTRICAL_REINSPECTION_REGIMES } },
    statute: 'ΥΑ 101195/17.9.2021 (ΦΕΚ Β\' 4654/2021) άρθρο 4 · Παράρτημα Ι · Παράρτημα ΙΙ · άρθρο 6',
    // Εκτίμηση πρακτικής (εύρεση ηλεκτρολόγου, έλεγχος, μετρήσεις, ηλεκτρονική υποβολή), ΟΧΙ διάταξη.
    renewalLeadDays: 30,
    // Διαβασμένο από τις σελίδες του ΦΕΚ, όχι από επαγγελματία· το παλιό καθεστώς από δευτερογενή πηγή ⇒ `null`.
    verifiedAt: null,
    advertisingDisclosure: null,
    // Υπογράφει «αδειούχος ηλεκτρολόγος εγκαταστάτης» (Παράρτημα Ι: «ΑΡ. ΑΔΕΙΑΣ / ΒΕΒ. ΑΝΑΓΓΕΛΙΑΣ · ΕΚΔΟΥΣΑ ΑΡΧΗ ·
    // ΕΙΔΙΚΟΤΗΤΑ / ΟΜΑΔΑ»)· η άδεια εκδίδεται ανά Περιφερειακή Ενότητα (ν.3982/2011 · π.δ. 108/2013). «Έχω ενημερώσει
    // τον ιδιοκτήτη και τον καταναλωτή για την υποχρέωση τακτικού επανελέγχου» (δήλωση 5) ⇒ υπόχρεος ο ιδιοκτήτης.
    issuer: {
      kind: 'professional',
      qualifications: ['electrical-installer'],
      appointedBy: 'owner',
      statute: 'ν.3982/2011 · π.δ. 108/2013',
      verifiedAt: null,
    },
    obligor: 'owner',
    // ΔΕΔΔΗΕ: «μπορεί να αναζητηθεί η καταληκτική ημερομηνία ισχύος μιας Υ.Δ.Ε.» με τα 11 πρώτα ψηφία του αριθμού παροχής.
    publicLookup: { url: 'https://apps.deddie.gr/LicensedElectricianCertification/', verifiedAt: '2026-10-18' },
    // Έγγραφο ΤΟΥ ΑΚΙΝΗΤΟΥ: η ΥΔΕ αφορά την παροχή της μονάδας. Το `yde-declaration` της επαφής (persona
    // `construction_worker`) είναι το αρχείο του ηλεκτρολόγου για τη δουλειά του — άλλο επίπεδο, δεν παρακολουθείται.
    standaloneEvidence: [{ level: 'property', entryPointIds: ['unit-yde-declaration'] }],
    // Ο τακτικός επανέλεγχος βαραίνει την εγκατάσταση **όσο υπάρχει**, όχι μια πράξη (άρθρο 4 παρ. 5 · Παράρτημα ΙΙ:
    // «μέγιστο χρονικό διάστημα τακτικού επανελέγχου»). Οικόπεδο: καμία εσωτερική εγκατάσταση ⇒ καμία πρόταση.
    standingObligation: {
      statute: 'ΥΑ 101195/17.9.2021 (ΦΕΚ Β\' 4654/2021) άρθρο 4 παρ. 5 · Παράρτημα ΙΙ',
      proposedFor: ['residential', 'commercial'],
    },
  },
};

/**
 * ADR-915 §35 — τα είδη που ο νόμος θέλει **μόνιμα** στο ακίνητο: **παράγωγο** του `standingObligation`, ποτέ δεύτερη
 * λίστα. Σειρά = σειρά του καταλόγου (σταθερή στην οθόνη).
 */
export const STANDING_OBLIGATION_KINDS: readonly DocumentKind[] = DOCUMENT_KINDS.filter(
  (kind) => DOCUMENT_KIND_SPECS[kind].standingObligation !== null,
);

/** Οι κανόνες αυτού του είδους — η μία πόρτα (ο τύπος κάνει αδύνατο να ζητηθεί είδος που δεν υπάρχει). */
export function documentKindSpec(kind: DocumentKind): DocumentKindSpec {
  return DOCUMENT_KIND_SPECS[kind];
}
