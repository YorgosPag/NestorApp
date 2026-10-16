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
 * ⛔ **Κανένας επινοημένος κωδικός ESCO** (ίδιος κανόνας με το `occupation-families.ts`): URI μόνο όσα ήδη επαλήθευσε η
 *    γέφυρα ρόλων (`PROJECT_ROLE_BRIDGE`, εισάγονται)· τα υπόλοιπα `null` με λόγο — ποτέ σιωπηλή παράλειψη.
 * ⛔ **Καμία ετικέτα εδώ**: οι λέξεις ζουν στα locales (`document-registry.json`, N.11).
 *
 * @module config/document-validity/document-issuers
 * @see ADR-915 §18 — Στάδιο 1: εκδότης και υπόχρεος
 */

import { PROJECT_ROLE_BRIDGE } from '@/config/profession-bridge.config';

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

/** Μητρώα όπου η **εγγραφή** είναι το ίδιο το προσόν. */
export type IssuerRegistry = 'ypen-energy-inspectors';

export interface IssuerQualificationSpec {
  /** ESCO occupation URI — **μόνο** επαληθευμένο (εισάγεται από τη γέφυρα ρόλων). `null` = δεν υπάρχει/δεν επαληθεύτηκε. */
  readonly escoUri: string | null;
  /** Το μητρώο στο οποίο πρέπει να είναι εγγεγραμμένος. `null` = αρκεί η ειδικότητα με δικαίωμα υπογραφής. */
  readonly registry: IssuerRegistry | null;
}

export const ISSUER_QUALIFICATION_SPECS: Readonly<Record<IssuerQualification, IssuerQualificationSpec>> = {
  'civil-engineer': { escoUri: PROJECT_ROLE_BRIDGE.structural_engineer.escoUri, registry: null },
  architect: { escoUri: PROJECT_ROLE_BRIDGE.architect.escoUri, registry: null },
  'surveyor-engineer': { escoUri: PROJECT_ROLE_BRIDGE.surveyor.escoUri, registry: null },
  // Το ESCO έχει «πολεοδόμο» (2164), αλλά το URI δεν επαληθεύτηκε στο `system/esco_cache` ⇒ `null`, όχι μαντεψιά.
  'spatial-planner': { escoUri: null, registry: null },
  // Ελληνικοί τίτλοι σπουδών (υπομηχανικός · πτυχιούχος ΤΕΙ/ΑΤΕΙ) χωρίς ισοδύναμο στο ESCO.
  'civil-sub-engineer': { escoUri: null, registry: null },
  'civil-engineer-tei': { escoUri: null, registry: null },
  // Ο ενεργειακός επιθεωρητής δεν έχει URI ESCO (γέφυρα ρόλων: `energy_inspector.escoUri === null`)· το προσόν του είναι
  // η εγγραφή στο Μητρώο Ενεργειακών Επιθεωρητών της ΕΥΕΠΕΝ (buildingcert.gr).
  'energy-inspector-registered': { escoUri: PROJECT_ROLE_BRIDGE.energy_inspector.escoUri, registry: 'ypen-energy-inspectors' },
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
