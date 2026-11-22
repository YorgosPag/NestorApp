/**
 * =============================================================================
 * Εκδότες εγγράφων — «ποιος το βγάζει» και «ποιος οφείλει να το φέρει» (ADR-915 §18)
 * =============================================================================
 *
 * **Δεδομένα, ποτέ λογική.** Κάθε είδος του μητρώου λήξεων δηλώνει στο `DOCUMENT_KIND_SPECS` τον εκδότη και τον υπόχρεό
 * του **με αναφορά σε αυτό το λεξιλόγιο** — ο κατάλογος μεταβίβασης, η σελίδα λήξεων και (Στάδιο 2) το «Επόμενο βήμα»
 * ρωτούν την ίδια απάντηση.
 *
 * 🔑 **ΠΡΟΣΟΝ ≠ ΕΠΑΓΓΕΛΜΑ**: το ΠΕΑ δεν το βγάζει «ο μηχανικός» αλλά ο ενεργειακός επιθεωρητής **εγγεγραμμένος στο
 *    μητρώο** ΥΠΕΝ/ΕΥΕΠΕΝ (buildingcert.gr)· τη βεβαίωση του άρθρου 83 δεν τη βγάζει κάθε μηχανικός αλλά οι ειδικότητες
 *    που όρισε η Δ.Ε. του ΤΕΕ (ο μηχανολόγος **δεν** είναι μέσα). Ένας κατάλογος «βρες μηχανικό» φιλτραρισμένος με
 *    επάγγελμα θα έδειχνε ανθρώπους που **δεν μπορούν** να το υπογράψουν — γι' αυτό το λεξιλόγιο είναι προσόντα.
 * ⛔ **Κανένας επινοημένος κωδικός ESCO** (ίδιος κανόνας με το `occupation-families.ts`): URI μόνο όσα επαλήθευσε η
 *    γέφυρα ρόλων (`PROJECT_ROLE_BRIDGE`, εισάγονται) ή το `system/esco_cache` (με ημερομηνία δίπλα)· τίτλος χωρίς
 *    ισοδύναμο = κενός πίνακας με λόγο — ποτέ σιωπηλή παράλειψη.
 * 🔑 **Άδεια ≠ επάγγελμα** (ADR-915 §21): ο ενεργειακός επιθεωρητής αποδεικνύεται με άδεια (`professional-licences.ts`).
 * ⛔ **Καμία ετικέτα εδώ**: οι λέξεις ζουν στα locales (`document-registry.json`, N.11).
 *
 * @module config/document-validity/document-issuers
 * @see ADR-915 §18 — Στάδιο 1: εκδότης και υπόχρεος
 */

import { PROJECT_ROLE_BRIDGE } from '@/config/profession-bridge.config';
import { PROFESSIONAL_LICENCE_SPECS, type LicenceGradeScope, type ProfessionalLicence } from '@/config/professional-licences';
import type { RegistryAuthorityId } from '@/constants/professional-registries';
import { escoOccupationUri } from '@/lib/esco/esco-uri';

/**
 * Ποιος **οφείλει** να φέρει το έγγραφο, ουδέτερα ως προς τη διαδικασία: στη μεταβίβαση ο ιδιοκτήτης είναι ο πωλητής,
 * στην αγγελία ο εντολέας. Κλειστό σύνολο — νέος υπόχρεος (μισθωτής, διαχειριστής) προστίθεται εδώ, με ετικέτα.
 */
export const DOCUMENT_OBLIGORS = ['owner'] as const;
export type DocumentObligor = (typeof DOCUMENT_OBLIGORS)[number];

/** Τα προσόντα που επιτρέπουν σε επαγγελματία να εκδώσει έγγραφο του μητρώου. */
export const ISSUER_QUALIFICATIONS = [
  'civil-engineer',
  'architect',
  'surveyor-engineer',
  'spatial-planner',
  'civil-sub-engineer',
  'civil-engineer-tei',
  'energy-inspector-registered',
  'electrical-installer',
] as const;
export type IssuerQualification = (typeof ISSUER_QUALIFICATIONS)[number];

/**
 * Πώς **αποδεικνύεται** ένα προσόν στη βιτρίνα του επαγγελματία (ADR-915 §21):
 * - `occupation` — ειδικότητα: **κάποιο** από τα URI ESCO στα `credentials` (any-of). Κενός πίνακας = ο τίτλος δεν έχει
 *                  ισοδύναμο στο ESCO ⇒ **δεν** αναζητείται, και αυτό είναι δηλωμένο, όχι σιωπηλό.
 * - `licence`    — άδεια **επιπλέον** του επαγγέλματος (`config/professional-licences.ts`), δηλωμένη με αριθμό μητρώου.
 */
export type IssuerQualificationSpec =
  | { readonly kind: 'occupation'; readonly escoUris: readonly string[] }
  | { readonly kind: 'licence'; readonly licence: ProfessionalLicence };

/** Το URI που ήδη επαλήθευσε η γέφυρα ρόλων — **εισάγεται**, δεν ξαναγράφεται. */
function bridgedUris(role: 'structural_engineer' | 'architect' | 'surveyor'): readonly string[] {
  const uri = PROJECT_ROLE_BRIDGE[role].escoUri;
  return uri === null ? [] : [uri];
}

export const ISSUER_QUALIFICATION_SPECS: Readonly<Record<IssuerQualification, IssuerQualificationSpec>> = {
  'civil-engineer': { kind: 'occupation', escoUris: bridgedUris('structural_engineer') },
  architect: { kind: 'occupation', escoUris: bridgedUris('architect') },
  'surveyor-engineer': { kind: 'occupation', escoUris: bridgedUris('surveyor') },
  // «Μηχανικός Χωροταξίας, Πολεοδομίας και Ανάπτυξης» = δύο επαγγέλματα ESCO (ISCO 2164), επαληθευμένα στο
  // `system/esco_cache/occupations` 2026-10-16: «μηχανικός χωροταξίας και ανάπτυξης» · «μηχανικός πολεοδομίας».
  // ⛔ ΟΧΙ ο «συγκοινωνιολόγος μηχανικός» (ίδιο ISCO, άλλη ειδικότητα — εκτός απόφασης ΤΕΕ).
  'spatial-planner': {
    kind: 'occupation',
    escoUris: [
      escoOccupationUri('44508e7b-f56b-4bfb-9cd6-879838aecd94'),
      escoOccupationUri('e14548c8-c2b9-4ef8-8670-d5967d7ad804'),
    ],
  },
  // Ελληνικοί τίτλοι σπουδών (υπομηχανικός · πτυχιούχος ΤΕΙ/ΑΤΕΙ) χωρίς ισοδύναμο στο ESCO ⇒ δεν αναζητούνται.
  'civil-sub-engineer': { kind: 'occupation', escoUris: [] },
  'civil-engineer-tei': { kind: 'occupation', escoUris: [] },
  // Ο ενεργειακός επιθεωρητής είναι μηχανικός με ΕΠΙΠΛΕΟΝ άδεια του Μητρώου της ΕΥΕΠΕΝ (buildingcert.gr) — άδεια, όχι
  // επάγγελμα (ADR-915 §21).
  'energy-inspector-registered': { kind: 'licence', licence: 'energy-inspector' },
  // ΥΔΕ: υπογράφει όποιος έχει άδεια ηλεκτρολόγου εγκαταστάτη ή βεβαίωση αναγγελίας της Περιφερειακής Ενότητας
  // (π.δ. 108/2013 άρθ. 12: «οφείλουν να διαθέτουν αντίστοιχη άδεια») — άδεια, όχι ειδικότητα (ADR-915 §34). Ο
  // ηλεκτρολόγος 7411 με εγγραφή Περιφέρειας την έχει ΗΔΗ (`heldThroughOccupations`)· ο μηχανικός ΤΕΕ τη δηλώνει.
  'electrical-installer': { kind: 'licence', licence: 'electrical-installer' },
};

/**
 * Η δημόσια σελίδα όπου ελέγχεται ο αριθμός ενός προσόντος — `null` για ειδικότητα **ή** για άδεια χωρίς δημόσιο μητρώο
 * (ηλεκτρολόγος εγκαταστάτης, ADR-915 §34). Η **μία** απάντηση για τη γραμμή ανάθεσης (§27) και τη σελίδα του συνδέσμου
 * (§28) — δύο αντίγραφα του `spec.kind === 'licence'` θα έδειχναν σύνδεσμο χωρίς προορισμό.
 */
export function qualificationLookupUrl(qualification: IssuerQualification): string | null {
  const spec = ISSUER_QUALIFICATION_SPECS[qualification];
  return spec.kind === 'licence' ? PROFESSIONAL_LICENCE_SPECS[spec.licence].registryLookupUrl : null;
}

/**
 * **Σε ποιο μητρώο** δηλώνει τον αριθμό του ο κάτοχος ενός προσόντος (ADR-862 §5.3.11 · ADR-915 §39): άδεια ⇒ η αρχή
 * της άδειας (ενεργειακός επιθεωρητής ⇒ ΥΠΕΝ)· ειδικότητα ⇒ `null` (καμία δηλωμένη αρχή στο λεξιλόγιο — δεν μαντεύεται).
 * Ο **ένας** δρόμος «ποιότητα → άδεια → αρχή»: ο άνθρωπος **δεν** διαλέγει μητρώο, δηλώνει μόνο αριθμό.
 */
export function qualificationRegistryAuthority(qualification: IssuerQualification): RegistryAuthorityId | null {
  const spec = ISSUER_QUALIFICATION_SPECS[qualification];
  return spec.kind === 'licence' ? PROFESSIONAL_LICENCE_SPECS[spec.licence].authority : null;
}

/** Δημόσιες αρχές που εκδίδουν (ή δημοσιεύουν) έγγραφα — `ypen`: το δημόσιο αρχείο πράξεων e-Άδειες (ADR-949 Α-1). */
export const ISSUER_AUTHORITIES = ['aade', 'efka', 'ypen'] as const;
export type IssuerAuthority = (typeof ISSUER_AUTHORITIES)[number];

/**
 * Οι **ψηφιακές υπηρεσίες** από όπου ο υπόχρεος παίρνει μόνος του ένα έγγραφο (ADR-915 §24 — «Πώς εκδίδεται» ·
 * ADR-949 Α-1 — «ποιο έγγραφο, από πού» στον υπολογιστή αντικειμενικής). Μία ανά έγγραφο, όχι ανά αρχή: η ΑΑΔΕ βγάζει
 * τη φορολογική ενημερότητα, το πιστοποιητικό ΕΝΦΙΑ, το Ε9 και την πράξη προσδιορισμού ΕΝΦΙΑ από **άλλες** ενέργειες.
 * Η διαδρομή μέσα στην πύλη ζει στα locales (N.11)· εδώ μόνο αρχή, είσοδος, πράξη και πηγή.
 * ⚠️ **Κανένα κόστος/χρόνος εδώ**: η ΑΑΔΕ δεν γράφει στη σελίδα της ούτε «δωρεάν» ούτε «άμεσα» (ανάγνωση 2026-11-22) —
 * ό,τι δεν το λέει η πηγή, δεν το λέμε εμείς (ADR-949 §8).
 */
export const AUTHORITY_SERVICES = [
  'aade-tax-clearance',
  'aade-enfia-certificate',
  'efka-insurance-clearance',
  'aade-e9',
  'aade-enfia-assessment',
  'ypen-e-adeies-search',
] as const;
export type AuthorityService = (typeof AUTHORITY_SERVICES)[number];

/**
 * Τι κάνει ο άνθρωπος στην υπηρεσία: `issue` — εκδίδει/εκτυπώνει το δικό του έγγραφο · `lookup` — **αναζητά** ένα
 * ήδη εκδοθέν έγγραφο σε δημόσιο αρχείο (e-Άδειες: με το κλειδί που τυπώνεται στο ίδιο το έγγραφο). Η ετικέτα του
 * κουμπιού ακολουθεί την πράξη — «Έκδοση από ΥΠΕΝ» θα ήταν ψέμα.
 */
export type AuthorityServiceAction = 'issue' | 'lookup';

/** Οι επίσημοι τομείς εισόδου — `gov.gr` και το δημόσιο αρχείο αδειών του ΥΠΕΝ. Κλειστή λίστα, όχι «οτιδήποτε .gr». */
export const OFFICIAL_ENTRY_HOST_SUFFIXES = ['.gov.gr', '.ypen.gr'] as const;

export interface AuthorityServiceSpec {
  readonly authority: IssuerAuthority;
  readonly action: AuthorityServiceAction;
  /**
   * Η **επίσημη** είσοδος — ποτέ βαθύς σύνδεσμος σε εφαρμογή που αλλάζει όνομα. ⚠️ Η ΑΑΔΕ γράφει στις οδηγίες
   * ασφαλείας της: σύνδεση στο myAADE **μόνο** από το `myaade.gov.gr` ή το `www.aade.gr` — άρα αυτό δείχνουμε.
   */
  readonly entryUrl: string;
  /** Πότε ελέγχθηκε ότι η είσοδος απαντά (HTTP 200) και η διαδρομή ισχύει. */
  readonly verifiedAt: string;
  /** Από πού προέρχεται η διαδρομή του locale — πηγή, όχι κείμενο διεπαφής (εξαίρεση N.11, όπως το `statute`). */
  readonly pathSource: string;
}

export const AUTHORITY_SERVICE_SPECS: Readonly<Record<AuthorityService, AuthorityServiceSpec>> = {
  'aade-tax-clearance': {
    authority: 'aade',
    action: 'issue',
    entryUrl: 'https://myaade.gov.gr',
    verifiedAt: '2026-10-16',
    pathSource: 'ΑΑΔΕ, βίντεο οδηγιών (iefimerida.gr 15/05/2024): Εφαρμογές → Φορολογικές Υπηρεσίες → Ενημερότητα',
  },
  'aade-enfia-certificate': {
    authority: 'aade',
    action: 'issue',
    entryUrl: 'https://myaade.gov.gr',
    verifiedAt: '2026-10-16',
    pathSource: 'ΑΑΔΕ, δελτίο τύπου 31.05.2023 (ν.5036/2023): myAADE · Περιουσιολόγιο (Ε9/ΕΝΦΙΑ)',
  },
  'efka-insurance-clearance': {
    authority: 'efka',
    action: 'issue',
    entryUrl: 'https://www.e-efka.gov.gr/el/elektronikes-yperesies/apodeiktiko-asphalistikes-enemerotetas',
    verifiedAt: '2026-10-16',
    pathSource: 'e-ΕΦΚΑ, σελίδα ηλεκτρονικής υπηρεσίας: σύνδεση με κωδικούς Taxisnet',
  },
  // ADR-949 Α-1 — aade.gr/dilosi-e9-enfia (HTTP 200, 2026-11-22), βήμα Α.11.
  'aade-e9': {
    authority: 'aade',
    action: 'issue',
    entryUrl: 'https://myaade.gov.gr',
    verifiedAt: '2026-11-22',
    pathSource: 'aade.gr/dilosi-e9-enfia, Α.11: «Από τις διαθέσιμες ενέργειες μπορείτε να εκτυπώσετε … τις υποβληθείσες δηλώσεις Ε9»',
  },
  'aade-enfia-assessment': {
    authority: 'aade',
    action: 'issue',
    entryUrl: 'https://myaade.gov.gr',
    verifiedAt: '2026-11-22',
    pathSource: 'aade.gr/dilosi-e9-enfia, Β: «Εκτύπωσης … πράξης Διοικητικού/Διορθωτικού προσδιορισμού φόρου ΕΝΦΙΑ για τα έτη 2014 και επόμενα»',
  },
  // Η «Ιστοσελίδα αναζήτησης e-Άδειες» όπως τη συνδέει το ΤΕΕ (web.tee.gr/e-adeies, 2026-11-22). Τα ψηφιακά έγγραφα
  // τυπώνουν άλλη διεύθυνση (`apps.tee.gr/…/searchDocFile`, ανακατευθύνει στο services.tee.gr) — δεν τη δείχνουμε.
  'ypen-e-adeies-search': {
    authority: 'ypen',
    action: 'lookup',
    entryUrl: 'https://eadeies.ypen.gr/adeiapublic/faces/main',
    verifiedAt: '2026-11-22',
    pathSource: 'web.tee.gr/e-adeies: σύνδεσμος «Ιστοσελίδα αναζήτησης e-Άδειες»',
  },
};

/** Είναι η είσοδος επίσημη; — η ΜΙΑ απάντηση για τις αναλλοίωτες (https + τομέας της {@link OFFICIAL_ENTRY_HOST_SUFFIXES}). */
export function isOfficialEntryUrl(entryUrl: string): boolean {
  if (!entryUrl.startsWith('https://')) return false;
  const host = new URL(entryUrl).hostname;
  return OFFICIAL_ENTRY_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * Ποιος **εκδίδει** ένα είδος εγγράφου:
 * - `professional` — επαγγελματίας με **ένα από** τα προσόντα (any-of)· τον **ορίζει** ο `appointedBy` (π.χ. «ο
 *                    εξουσιοδοτημένος μηχανικός ορίζεται από τον ιδιοκτήτη»). `statute` = η πηγή της λίστας, αυτολεξεί.
 * - `authority`    — δημόσια αρχή, μέσα από **μία** ψηφιακή υπηρεσία ({@link AUTHORITY_SERVICE_SPECS}): το παίρνει ο ίδιος
 *                    ο υπόχρεος, την ίδια μέρα, χωρίς επαγγελματία. Η αρχή **παράγεται** από την υπηρεσία
 *                    ({@link issuerAuthorityOf}) — δύο πεδία θα μπορούσαν να διαφωνήσουν.
 */
export type DocumentIssuer =
  | {
      readonly kind: 'professional';
      readonly qualifications: readonly IssuerQualification[];
      readonly appointedBy: DocumentObligor;
      readonly statute: string;
      readonly verifiedAt: string | null;
      /**
       * ADR-915 §40.7 Φ3 — **ποια κατηγορία τάξης** της άδειας-προσόντος κρίνει αν ο επαγγελματίας **επιτρέπεται** να
       * εκδώσει αυτό το έγγραφο για **αυτό** το ακίνητο (ΠΕΑ ⇒ «Κτίρια»: Α΄ έως 250 τ.μ.). Τα όρια ζουν **μόνο** στο
       * `gradeScheme.entitlements` της άδειας. `null` = καμία τάξη δεν περιορίζει την έκδοση (ή δεν μοντελοποιείται).
       */
      readonly licenceGradeScope: LicenceGradeScope | null;
    }
  | { readonly kind: 'authority'; readonly service: AuthorityService };

/** Η αρχή ενός εκδότη-αρχής — από την υπηρεσία του, η μία πηγή. */
export function issuerAuthorityOf(issuer: Extract<DocumentIssuer, { kind: 'authority' }>): IssuerAuthority {
  return AUTHORITY_SERVICE_SPECS[issuer.service].authority;
}
