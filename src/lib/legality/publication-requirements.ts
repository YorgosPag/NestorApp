/**
 * =============================================================================
 * Οι απαιτήσεις εγγράφων της δημοσίευσης αγγελίας (ADR-915 Φ2 · ADR-838 §4.5)
 * =============================================================================
 *
 * **Παραγωγός**, όχι κατάλογος: ο πίνακας νομιμότητας (`LEGALITY_OFFER_MATRIX`) **ήδη** λέει ποια διάθεση σηκώνει ποια
 * αξίωση, και το `LegalityClaimKindSpec` ποιο έγγραφο τη στηρίζει και αν η απουσία της μπλοκάρει. Εδώ τα δύο
 * διαβάζονται ως «η αγγελία θέλει αυτό το έγγραφο σε ισχύ **όσο είναι δημοσιευμένη**».
 *
 * - κελί `raised`     ⇒ απαίτηση με τη διάταξη
 * - κελί `unresolved` ⇒ απαίτηση με **την ερώτηση** — το άγνωστο δηλώνεται, δεν σβήνει (ίδιο δόγμα με τον πίνακα)
 * - κελί `not-raised` ⇒ τίποτα
 * - `blocks-publication` ⇒ `block`· αλλιώς `warn` — **ADR-915 Α1**: η αγγελία με ληγμένο ΠΕΑ μένει και λέει «έληξε».
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 *
 * @module lib/legality/publication-requirements
 */

import { documentKindSpec, type DocumentKind } from '@/config/document-validity/document-validity';
import type { DocumentRequirement, RequirementBasis } from '@/lib/document-validity/document-requirement';
import type { OfferKind } from '@/types/property-offers';
import { LEGALITY_CLAIM_KINDS, legalityKindSpec, type LegalityClaimKind } from './legality-claim';
import { legalityRelevanceFor } from './legality-offer-matrix';

export interface PublicationRequirementsInput {
  readonly listingId: string;
  readonly propertyId: string;
  /** Οι διαθέσεις της αγγελίας (πώληση, μίσθωση…). */
  readonly offerKinds: readonly OfferKind[];
}

/** Η βάση της απαίτησης για όλες τις διαθέσεις: μία `raised` αρκεί· αλλιώς η πρώτη ανοιχτή ερώτηση· αλλιώς τίποτα. */
function basisAcross(offerKinds: readonly OfferKind[], kind: LegalityClaimKind): RequirementBasis | null {
  const cells = offerKinds.map((offerKind) => legalityRelevanceFor(offerKind, kind));
  const raised = cells.find((cell) => cell.relevance === 'raised');
  if (raised?.relevance === 'raised') return { kind: 'statute', statute: raised.statute };
  const open = cells.find((cell) => cell.relevance === 'unresolved');
  return open?.relevance === 'unresolved' ? { kind: 'unresolved', question: open.question } : null;
}

function requirementFor(
  input: PublicationRequirementsInput,
  kind: LegalityClaimKind,
  documentKind: DocumentKind,
): DocumentRequirement | null {
  const basis = basisAcross(input.offerKinds, kind);
  if (basis === null) return null;
  // ADR-915 Φ4δ Ε7 — «λείπει» μόνο όπου ο ΝΟΜΟΣ θέλει το έγγραφο στην αγγελία (`advertisingDisclosure`) ΚΑΙ η διάθεση
  // το θέτει. Ανοιχτή ερώτηση (`unresolved`) ⇒ ποτέ: δεν ισχυριζόμαστε υποχρέωση που δεν ξέρουμε ότι υπάρχει.
  const presence = basis.kind === 'statute' && documentKindSpec(documentKind).advertisingDisclosure !== null ? 'required' : 'tracked';
  return {
    documentKind,
    subject: { propertyId: input.propertyId, party: null },
    process: { kind: 'listing-publication', listingId: input.listingId },
    neededOn: { kind: 'continuous' },
    policy: legalityKindSpec(kind).publication === 'blocks-publication' ? 'block' : 'warn',
    // Για διαδικασία που τρέχει διαρκώς, «λήγει» = «ώρα να ξεκινήσει η ανανέωση» (ADR-915 Φ5 · `renewalLeadDays`).
    warnWindowDays: documentKindSpec(documentKind).renewalLeadDays ?? 0,
    basis,
    presence,
    // Η αγγελία δεν έχει έλεγχο επαγγελματία: το έγγραφο το βρίσκει μόνο το ακίνητο (αρχείο ή δήλωση).
    attestation: null,
  };
}

/** Οι απαιτήσεις μίας αγγελίας — μία ανά είδος αξίωσης που στηρίζεται σε έγγραφο και τίθεται από κάποια διάθεση. */
export function publicationRequirements(input: PublicationRequirementsInput): readonly DocumentRequirement[] {
  return LEGALITY_CLAIM_KINDS.flatMap((kind): DocumentRequirement[] => {
    const documentKind = legalityKindSpec(kind).documentKind;
    const requirement = documentKind === null ? null : requirementFor(input, kind, documentKind);
    return requirement === null ? [] : [requirement];
  });
}
