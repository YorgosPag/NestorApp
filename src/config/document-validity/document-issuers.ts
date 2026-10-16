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
};

/** Δημόσιες αρχές που εκδίδουν έγγραφα του μητρώου. */
export const ISSUER_AUTHORITIES = ['aade', 'efka'] as const;
export type IssuerAuthority = (typeof ISSUER_AUTHORITIES)[number];

/**
 * Ποιος **εκδίδει** ένα είδος εγγράφου:
 * - `professional` — επαγγελματίας με **ένα από** τα προσόντα (any-of)· τον **ορίζει** ο `appointedBy` (π.χ. «ο
 *                    εξουσιοδοτημένος μηχανικός ορίζεται από τον ιδιοκτήτη»). `statute` = η πηγή της λίστας, αυτολεξεί.
 * - `authority`    — δημόσια αρχή· `online-self-service` ⇒ το παίρνει ο ίδιος ο υπόχρεος, την ίδια μέρα, χωρίς
 *                    επαγγελματία (μπορεί να βοηθήσει λογιστής — Στάδιο 2, όχι προσόν).
 */
export type DocumentIssuer =
  | {
      readonly kind: 'professional';
      readonly qualifications: readonly IssuerQualification[];
      readonly appointedBy: DocumentObligor;
      readonly statute: string;
      readonly verifiedAt: string | null;
    }
  | { readonly kind: 'authority'; readonly authority: IssuerAuthority; readonly channel: 'online-self-service' };
