/**
 * ADR-736 §5.2 — **η σκανδάλη της αυτόματης επίλυσης.**
 *
 * Το χαρακτηριστικό υπόσχεται μία πρόταση: «δώσε τα υπόβαθρα μαζί με το `.dxf` και θα
 * συνδεθούν μόνα τους». Ο host είναι ο ρητός ιδιοκτήτης αυτής της υπόσχεσης. Αυτά τα τεστ
 * ελέγχουν το **σήμα**, όχι τη λογική ταύτισης (εκείνη ζει καθαρή στο
 * `dxf-external-reference-match.test.ts`).
 *
 * 🔴 **Η μη-προφανής περίπτωση — και ο λόγος που υπάρχει το αρχείο.** Το effect κρεμόταν από
 * `[canResolve, references.length, resolve]` και **δεν** συνδρομούσε στον κατάλογο. Άρα η
 * προσφορά αρχείων από μόνη της δεν ξυπνούσε τίποτα: αν το πλήθος αναφορών έτυχε να είναι
 * **ίδιο** πριν και μετά την εισαγωγή (10 → 10 — δηλαδή η ίδια κάτοψη ξανά, η πιο συνηθισμένη
 * δοκιμή), τα αρχεία έμεναν στον κατάλογο για πάντα και η παλέτα έλεγε «0 από 10». Το τεστ
 * «ξυπνά ΑΚΟΜΑ ΚΑΙ ΟΤΑΝ το πλήθος αναφορών ΔΕΝ αλλάζει» είναι το μοναδικό που πέφτει με τον
 * παλιό κώδικα — τα υπόλοιπα περνούσαν κανονικά και γι' αυτό το σφάλμα έζησε.
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { ExternalReferencesAutoResolveHost } from '../ExternalReferencesAutoResolveHost';
import {
  offerExternalReferenceCandidates,
  peekExternalReferenceCandidates,
} from '../../../stores/ExternalReferenceCandidatesStore';
import type { ExternalReferenceResolutionResult } from '../../../hooks/useExternalReferenceResolution';
import type { DxfExternalReference } from '../../../types/dxf-external-reference';

const resolveSpy = jest.fn<Promise<void>, [readonly File[]]>(async () => {});

/** Ό,τι διαβάζει ο host από το hook — τα υπόλοιπα πεδία δεν τα αγγίζει. */
let hookState: Pick<
  ExternalReferenceResolutionResult,
  'references' | 'canResolve' | 'isResolving'
> = { references: [], canResolve: true, isResolving: false };

jest.mock('../../../hooks/useExternalReferenceResolution', () => ({
  useExternalReferenceResolution: () => ({ ...hookState, resolve: resolveSpy }),
}));

/** Ελάχιστη αναφορά — ο host μετρά μόνο το πλήθος, ποτέ το περιεχόμενο. */
const reference = (id: string): DxfExternalReference =>
  ({ id, basename: `${id}.jpg`, kind: 'raster', status: 'missing' }) as DxfExternalReference;

const withReferences = (count: number): readonly DxfExternalReference[] =>
  Array.from({ length: count }, (_, i) => reference(`H${i}`));

const fileNamed = (name: string): File => new File(['x'], name, { type: 'image/jpeg' });

beforeEach(() => {
  resolveSpy.mockClear();
  offerExternalReferenceCandidates([]);
  hookState = { references: [], canResolve: true, isResolving: false };
});

describe('ExternalReferencesAutoResolveHost — πότε ΞΥΠΝΑ', () => {
  it('🔴 ξυπνά ΑΚΟΜΑ ΚΑΙ ΟΤΑΝ το πλήθος αναφορών ΔΕΝ αλλάζει (10 → 10)', async () => {
    // Η σκηνή έχει ΗΔΗ 10 αναφορές όταν ο host γεννιέται — ο κατάλογος είναι άδειος, οπότε το
    // πρώτο πέρασμα σωστά δεν κάνει τίποτα.
    hookState = { references: withReferences(10), canResolve: true, isResolving: false };
    const { rerender } = render(<ExternalReferencesAutoResolveHost />);
    expect(resolveSpy).not.toHaveBeenCalled();

    // Ο χρήστης εισάγει ΤΟ ΙΔΙΟ σχέδιο ξανά, με τα υπόβαθρα. Νέα σκηνή, ίδιο πλήθος: το μόνο
    // πράγμα που άλλαξε στον κόσμο είναι ο κατάλογος. Αν αυτό δεν είναι σήμα, δεν είναι τίποτα.
    act(() => offerExternalReferenceCandidates([fileNamed('a.jpg'), fileNamed('b.jpg')]));
    rerender(<ExternalReferencesAutoResolveHost />);

    await waitFor(() => expect(resolveSpy).toHaveBeenCalledTimes(1));
    expect(resolveSpy.mock.calls[0][0].map((f) => f.name)).toEqual(['a.jpg', 'b.jpg']);
  });

  it('ξυπνά όταν η σκηνή φτάνει ΜΕΤΑ τα αρχεία (0 → 10)', async () => {
    act(() => offerExternalReferenceCandidates([fileNamed('a.jpg')]));
    const { rerender } = render(<ExternalReferencesAutoResolveHost />);
    expect(resolveSpy).not.toHaveBeenCalled(); // καμία σκηνή ⇒ τίποτα να επιλυθεί

    hookState = { references: withReferences(10), canResolve: true, isResolving: false };
    rerender(<ExternalReferencesAutoResolveHost />);

    await waitFor(() => expect(resolveSpy).toHaveBeenCalledTimes(1));
  });

  it('καταναλώνει ΜΙΑ φορά — ο κατάλογος αδειάζει και δεν ξανατρέχει σε re-render', async () => {
    hookState = { references: withReferences(3), canResolve: true, isResolving: false };
    act(() => offerExternalReferenceCandidates([fileNamed('a.jpg')]));
    const { rerender } = render(<ExternalReferencesAutoResolveHost />);

    await waitFor(() => expect(resolveSpy).toHaveBeenCalledTimes(1));
    expect(peekExternalReferenceCandidates()).toHaveLength(0);

    rerender(<ExternalReferencesAutoResolveHost />);
    rerender(<ExternalReferencesAutoResolveHost />);
    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });
});

describe('ExternalReferencesAutoResolveHost — πότε ΔΕΝ αγγίζει τον κατάλογο', () => {
  it('χωρίς εταιρεία (canResolve=false) τα αρχεία ΜΕΝΟΥΝ — δεν καταναλώνονται στο κενό', () => {
    hookState = { references: withReferences(10), canResolve: false, isResolving: false };
    act(() => offerExternalReferenceCandidates([fileNamed('a.jpg')]));
    render(<ExternalReferencesAutoResolveHost />);

    expect(resolveSpy).not.toHaveBeenCalled();
    // Κρίσιμο: αν τα «έτρωγε» εδώ, ο χρήστης θα έχανε τα αρχεία του χωρίς καμία ένδειξη.
    expect(peekExternalReferenceCandidates()).toHaveLength(1);
  });

  it('ενόσω τρέχει ήδη επίλυση δεν ξεκινά δεύτερη', () => {
    hookState = { references: withReferences(10), canResolve: true, isResolving: true };
    act(() => offerExternalReferenceCandidates([fileNamed('a.jpg')]));
    render(<ExternalReferencesAutoResolveHost />);

    expect(resolveSpy).not.toHaveBeenCalled();
    expect(peekExternalReferenceCandidates()).toHaveLength(1);
  });

  it('άδειος κατάλογος ⇒ καμία κλήση, όσες φορές κι αν ξαναδοθεί σκηνή', () => {
    hookState = { references: withReferences(10), canResolve: true, isResolving: false };
    const { rerender } = render(<ExternalReferencesAutoResolveHost />);
    hookState = { references: withReferences(11), canResolve: true, isResolving: false };
    rerender(<ExternalReferencesAutoResolveHost />);

    expect(resolveSpy).not.toHaveBeenCalled();
  });
});
