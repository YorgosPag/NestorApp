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

import { ELECTRICAL_INSTALLER_ESCO_URIS } from '@/config/electrical-installer-occupations';
import { PROJECT_ROLE_BRIDGE } from '@/config/profession-bridge.config';
import type { ProfessionalLicence } from '@/config/professional-licences';
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
  // ΥΔΕ: υπογράφει ηλεκτρολόγος εγκαταστάτης — ειδικότητα ISCO 7411 που ελέγχει εσωτερική ηλεκτρική εγκατάσταση, με
  // άδεια της Περιφερειακής Ενότητας (ADR-915 §32). Η λίστα ζει μία φορά (`electrical-installer-occupations.ts`).
  'electrical-installer': { kind: 'occupation', escoUris: ELECTRICAL_INSTALLER_ESCO_URIS },
};

/** Δημόσιες αρχές που εκδίδουν έγγραφα του μητρώου. */
export const ISSUER_AUTHORITIES = ['aade', 'efka'] as const;
export type IssuerAuthority = (typeof ISSUER_AUTHORITIES)[number];

/**
 * Οι **ψηφιακές υπηρεσίες** από όπου ο υπόχρεος εκδίδει μόνος του ένα έγγραφο (ADR-915 §24 — «Πώς εκδίδεται»).
 * Μία ανά έγγραφο, όχι ανά αρχή: η ΑΑΔΕ βγάζει τη φορολογική ενημερότητα και το πιστοποιητικό ΕΝΦΙΑ από **άλλη**
 * εφαρμογή του myAADE. Η διαδρομή μέσα στην πύλη ζει στα locales (N.11)· εδώ μόνο αρχή, είσοδος και πηγή.
 */
export const AUTHORITY_SERVICES = ['aade-tax-clearance', 'aade-enfia-certificate', 'efka-insurance-clearance'] as const;
export type AuthorityService = (typeof AUTHORITY_SERVICES)[number];

export interface AuthorityServiceSpec {
  readonly authority: IssuerAuthority;
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
    entryUrl: 'https://myaade.gov.gr',
    verifiedAt: '2026-10-16',
    pathSource: 'ΑΑΔΕ, βίντεο οδηγιών (iefimerida.gr 15/05/2024): Εφαρμογές → Φορολογικές Υπηρεσίες → Ενημερότητα',
  },
  'aade-enfia-certificate': {
    authority: 'aade',
    entryUrl: 'https://myaade.gov.gr',
    verifiedAt: '2026-10-16',
    pathSource: 'ΑΑΔΕ, δελτίο τύπου 31.05.2023 (ν.5036/2023): myAADE · Περιουσιολόγιο (Ε9/ΕΝΦΙΑ)',
  },
  'efka-insurance-clearance': {
    authority: 'efka',
    entryUrl: 'https://www.e-efka.gov.gr/el/elektronikes-yperesies/apodeiktiko-asphalistikes-enemerotetas',
    verifiedAt: '2026-10-16',
    pathSource: 'e-ΕΦΚΑ, σελίδα ηλεκτρονικής υπηρεσίας: σύνδεση με κωδικούς Taxisnet',
  },
};

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
    }
  | { readonly kind: 'authority'; readonly service: AuthorityService };

/** Η αρχή ενός εκδότη-αρχής — από την υπηρεσία του, η μία πηγή. */
export function issuerAuthorityOf(issuer: Extract<DocumentIssuer, { kind: 'authority' }>): IssuerAuthority {
  return AUTHORITY_SERVICE_SPECS[issuer.service].authority;
}
