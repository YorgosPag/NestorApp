/**
 * @fileoverview **«ΕΠΟΜΕΝΟ ΒΗΜΑ»** — τι κάνει ο άνθρωπος για ένα έγγραφο που έληξε, λήγει ή λείπει (ADR-915 §24).
 * @related config/document-validity/document-issuers.ts (ο εκδότης) · lib/document-validity/document-registry.ts (η
 *   κατάσταση) · components/document-registry/RegistryNextStep.tsx (η οθόνη)
 * @module lib/document-validity/document-next-step
 *
 * 🔑 **Οι ενέργειες ΠΑΡΑΓΟΝΤΑΙ από τον εκδότη του είδους** — καμία λίστα ανά είδος: νέο είδος με εκδότη ⇒ αποκτά
 *    ενέργεια χωρίς να το θυμηθεί κανείς. Επαγγελματίας ⇒ «Βρες» (Zillow/Houzz «find a pro», ήδη φιλτραρισμένο στο
 *    **προσόν**)· αρχή ⇒ «Πώς εκδίδεται» (ο υπόχρεος το βγάζει μόνος του, την ίδια μέρα).
 * 🔑 **Καθαρό, χωρίς React και χωρίς I/O**: ο ίδιος πυρήνας ρωτιέται από τον διακομιστή (ποια ακίνητα χρειάζονται
 *    περιοχή) και από την οθόνη — και αργότερα από τα έγγραφα ακινήτου και τη λίστα υπόθεσης (§18.5, μία πηγή).
 * ⚠️ **Καμία ενέργεια σε `valid` / `superseded` / `expiry-unknown`**: το πρώτο δεν θέλει τίποτα, το δεύτερο ανανεώθηκε
 *    ήδη, και το τρίτο θέλει **ανάγνωση** της λήξης (ανέβασμα/γεγονότα), όχι νέο έγγραφο.
 * 🛑 Η «Ανάθεση σε γνωστό» και το «Ζήτησέ το από τον υπόχρεο» **δεν** ζουν εδώ ακόμα: χρειάζονται αποθηκευμένο αίτημα
 *    προς εξωτερικό μέρος (Στάδιο 2β.2, §23.5) — ένα κουμπί χωρίς αυτό θα ήταν νεκρό.
 */

import type { AuthorityService } from '@/config/document-validity/document-issuers';
import { documentKindSpec, type DocumentKind } from '@/config/document-validity/document-validity';
import type { RegistryRowState } from '@/lib/document-validity/document-registry';

/** Οι καταστάσεις που ζητούν νέο έγγραφο — όσες δείχνει η οθόνη ως «ανανέωσε» ή «λείπει». */
export const NEXT_STEP_STATES = ['expired', 'expiring', 'missing'] as const satisfies readonly RegistryRowState[];

/** Μία ενέργεια — κλειστή ένωση· κάθε μέλος κουβαλά ό,τι χρειάζεται η οθόνη για να τη δείξει. */
export type DocumentNextStep =
  | { readonly kind: 'find-professional'; readonly documentKind: DocumentKind }
  | { readonly kind: 'self-service'; readonly service: AuthorityService };

function needsNewDocument(state: RegistryRowState): boolean {
  return (NEXT_STEP_STATES as readonly RegistryRowState[]).includes(state);
}

/** Τι κάνει ο άνθρωπος τώρα για αυτό το είδος σε αυτή την κατάσταση — κενό όταν δεν χρειάζεται τίποτα. */
export function documentNextSteps(kind: DocumentKind, state: RegistryRowState): readonly DocumentNextStep[] {
  if (!needsNewDocument(state)) return [];
  const { issuer } = documentKindSpec(kind);
  return issuer.kind === 'professional'
    ? [{ kind: 'find-professional', documentKind: kind }]
    : [{ kind: 'self-service', service: issuer.service }];
}

/** Χρειάζεται αυτή η γραμμή αναζήτηση επαγγελματία; — για να ζητήσει ο διακομιστής περιοχή **μόνο** όπου θα δειχτεί. */
export function needsProfessionalSearch(kind: DocumentKind, state: RegistryRowState): boolean {
  return documentNextSteps(kind, state).some((step) => step.kind === 'find-professional');
}
