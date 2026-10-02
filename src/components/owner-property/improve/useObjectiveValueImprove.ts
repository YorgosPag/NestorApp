'use client';

/**
 * @fileoverview **Η κατάσταση της ενότητας «Αντικειμενική αξία»** (ADR-898 Φ3β-2 · Φ3β-3) — για ιδιώτη ΚΑΙ γραφείο:
 * αλήθεια του listener + αισιόδοξη επικάλυψη → η αγγελία όπως θα τη δει ο αγοραστής → ερωτήσεις.
 * @related `lib/objective-value/objective-value-improve-subject.ts` (το συμβόλαιο του κατόχου) ·
 *   `hooks/listings/useListingPreview.ts` (η βάση από τον server) · `lib/async/field-patch-queue.ts` (αποθήκευση ανά
 *   απάντηση) · `lib/objective-value/objective-value-improve.ts` (τι ρωτάμε, με ποια σειρά)
 * @module components/owner-property/improve/useObjectiveValueImprove
 *
 * 🔑 **Καμία δεύτερη αλήθεια.** Οι δηλώσεις = `applyObjectiveValuePatch(έγγραφο του listener, επικάλυψη)` — η ίδια
 * συνάρτηση με τον server. Η αγγελία = η προβολή **του server** (σχήμα + γεγονότα δημοσίευσης) με τις δηλώσεις
 * απλωμένες από τις **ίδιες** συναρτήσεις της προβολής (`withObjectiveValueDeclarations`). Ο υπολογισμός =
 * `listingObjectiveValue` — ο ίδιος με τη δημόσια αγγελία. Τίποτα δεν αποθηκεύεται εκτός από δηλώσεις (ADR-889 §10.2).
 *
 * 🔴 **Ως τη Φ3β-3 η βάση χτιζόταν στον browser** (`projectListingShape`) — που γράφει `constructionYear: null`. Όπου η
 * δημόσια αγγελία είχε έτος (δημόσια εγγραφή), η οθόνη έχανε την προσέγγιση της άδειας και έλεγε «τι λείπει» αντί για
 * εύρος. Για το γραφείο ο τόπος θέλει αναγνώσεις κτιρίου/έργου — αδύνατο στον browser.
 */

import { useMemo } from 'react';

import { useListingPreview, type ListingPreviewState } from '@/hooks/listings/useListingPreview';
import { useValueZoneAt, type ValueZoneLookup } from '@/hooks/market/useValueZoneAt';
import { useFieldPatchQueue, type FieldPatchQueueHandle } from '@/hooks/useFieldPatchQueue';
import { marketDayOf } from '@/lib/listings/listing-stats';
import { valueZonePointOf, type ValueZoneVerdict } from '@/lib/market/value-zone-at-point';
import { listingObjectiveValue, type ListingObjectiveValue } from '@/lib/objective-value/listing-objective-value';
import {
  applyObjectiveValuePatch,
  readObjectiveValueDeclarations,
  type ObjectiveValueDeclarations,
  type ObjectiveValueDeclarationsPatch,
} from '@/lib/objective-value/objective-value-declarations';
import { objectiveValueImprovement, type ObjectiveValueImprovement } from '@/lib/objective-value/objective-value-improve';
import type {
  ObjectiveValueImproveSubject,
  ObjectiveValueWriteRejection,
} from '@/lib/objective-value/objective-value-improve-subject';
import { withObjectiveValueDeclarations } from '@/services/listings/public-listing-objective-value';
import type { PublicListing } from '@/types/public-listing';

type ImproveSave = FieldPatchQueueHandle<ObjectiveValueDeclarationsPatch, ObjectiveValueWriteRejection>;

export type ImproveZone =
  | Exclude<ValueZoneLookup, { readonly kind: 'answered' }>
  | {
      readonly kind: 'answered';
      /** Τι βλέπει ο αγοραστής (σέβεται την απόκρυψη). */
      readonly buyerView: ListingObjectiveValue;
      /** Τι ρωτάμε τον κάτοχο (πάντα σαν εμφανής: βελτιώνει και όταν κρύβει). */
      readonly improvement: ObjectiveValueImprovement;
      /** Η ετυμηγορία ζώνης — οι υποψήφιοι δρόμοι της ερώτησης «μέτωπο». */
      readonly verdict: ValueZoneVerdict;
    };

export interface ObjectiveValueImproveState {
  readonly declarations: ObjectiveValueDeclarations;
  readonly zone: ImproveZone;
  readonly save: ImproveSave;
  readonly today: string;
}

/** Η αγγελία του αγοραστή (`listing`, πίσω από την πύλη) και η απύλωτη βάση του κατόχου (`basis`, από τον server). */
interface ImproveListings {
  readonly listing: PublicListing;
  readonly basis: PublicListing;
}

function zoneOf(lookup: ValueZoneLookup, { listing, basis }: ImproveListings, declarations: ObjectiveValueDeclarations, today: string): ImproveZone {
  if (lookup.kind !== 'answered') return lookup;
  return {
    kind: 'answered',
    buyerView: listingObjectiveValue(listing, lookup.verdict, today),
    // Ο κάτοχος βελτιώνει και όταν κρύβει ⇒ οι ερωτήσεις πάνω στην εμφανή εκδοχή της **απύλωτης** βάσης: πάνω στην
    // πυλωμένη αγγελία το μικτό ανά όροφο θα είχε ήδη χαθεί (ADR-898 Φ3β-3β).
    improvement: objectiveValueImprovement(withObjectiveValueDeclarations(basis, { ...declarations, display: 'shown' }), lookup.verdict, today),
    verdict: lookup.verdict,
  };
}

const IMPRECISE: ValueZoneLookup = { kind: 'answered', verdict: { kind: 'imprecise' } };
const LOADING: ValueZoneLookup = { kind: 'loading' };
const FAILED: ValueZoneLookup = { kind: 'failed' };

/** Η ζώνη, αφού υπάρχει βάση: θέση που δεν είναι η ίδια η διεύθυνση ⇒ γνωστή ετυμηγορία χωρίς δίκτυο. */
function lookupOf(preview: ListingPreviewState, listing: PublicListing | null, zone: ValueZoneLookup): ValueZoneLookup {
  if (preview.kind === 'loading') return LOADING;
  if (preview.kind === 'failed' || listing === null) return FAILED;
  return valueZonePointOf(listing.position) === null ? IMPRECISE : zone;
}

export function useObjectiveValueImprove(subject: ObjectiveValueImproveSubject): ObjectiveValueImproveState {
  const today = marketDayOf(Date.now());
  const save: ImproveSave = useFieldPatchQueue(subject.write, subject.revision);
  const { overlay } = save;
  const declarations = useMemo(() => {
    const truth = readObjectiveValueDeclarations(subject.declarations);
    return overlay === null ? truth : applyObjectiveValuePatch(truth, overlay);
  }, [subject.declarations, overlay]);
  const preview = useListingPreview(subject.id, subject.revision);
  const listing = useMemo(
    () => (preview.kind === 'ready' ? withObjectiveValueDeclarations(preview.listing, declarations) : null),
    [preview, declarations],
  );
  const zoneLookup = useValueZoneAt(listing === null ? null : valueZonePointOf(listing.position));
  const resolved = lookupOf(preview, listing, zoneLookup);
  const zone = useMemo(
    () => (listing === null || preview.kind !== 'ready' ? resolved : zoneOf(resolved, { listing, basis: preview.listing }, declarations, today)),
    [resolved, listing, preview, declarations, today],
  );
  return { declarations, zone, save, today };
}
