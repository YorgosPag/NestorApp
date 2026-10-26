/**
 * ADR-920 Β4.9 — **η ενότητα «Τοπογραφικό»** στην οθόνη «Βελτίωσε την αγγελία σου».
 *
 *   Κ1  ο καταχωρητής την κρεμά ΜΟΝΟ σε γη (Δ1), με την ίδια προβολή που διαβάζει ο αγοραστής
 *   Κ2  ο κάτοχος: πόρτα του φακέλου όταν υπάρχει φάκελος · `null` χωρίς — η αγγελία είναι η ίδια ταυτότητα
 *   Κ3  η ενότητα δίνει στο πάνελ την κάρτα που δημοσιεύεται ΤΩΡΑ (ζωντανή ανάγνωση της δημόσιας αγγελίας)
 */

import { render, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { placeKnowledgeFromOwnerProperty, projectableFromOwnerProperty } from '@/lib/owner-property/owner-property-projection';
import { projectListingShape } from '@/services/listings/public-listing-projection';
import type { OwnerProperty } from '@/types/owner-property';

import { applicableImproveSections } from '../improve-sections';
import { useOwnerImproveSubjects } from '../owner-improve-subject';
import { TerrainImproveSection } from '../TerrainImproveSection';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key, isNamespaceReady: true }) }));

const CARD = { survey: { surveyorName: 'Τοπογράφος Α.Ε.', surveyedOn: '2026-09-01' } } as const;
const lookup: { current: unknown } = { current: { state: 'loading' } };
jest.mock('@/services/realtime/hooks/usePublicListings', () => ({ usePublicListing: () => lookup.current }));

/** Το πάνελ (πίσω από όριο φόρτωσης) — εδώ μετράει ΤΙ του δίνεται, όχι πώς ζωγραφίζει. */
const received: { target: unknown; published: unknown }[] = [];
jest.mock('next/dynamic', () => () => (props: { target: unknown; published: unknown }) => {
  received.push({ target: props.target, published: props.published });
  return <p>panel</p>;
});

const AT = '2026-10-26T09:00:00.000Z';
const listingOf = (owner: OwnerProperty) =>
  projectListingShape(projectableFromOwnerProperty(owner, AT), placeKnowledgeFromOwnerProperty(owner, AT), AT);

describe('TerrainImproveSection', () => {
  it('Κ1 μόνο σε γη', () => {
    expect(applicableImproveSections(listingOf(validOwnerProperty({ type: 'plot' })))).toContain('terrain');
    expect(applicableImproveSections(listingOf(validOwnerProperty({ type: 'apartment' })))).not.toContain('terrain');
  });

  it('Κ2 πόρτα του φακέλου με φάκελο · null χωρίς', () => {
    const withDossier = renderHook(() => useOwnerImproveSubjects(validOwnerProperty({ type: 'plot', dossierId: 'dos_1' })));
    expect(withDossier.result.current.terrain).toStrictEqual({
      target: { kind: 'owner-property', ownerPropertyId: 'ownp_a' },
      listingId: 'ownp_a',
    });
    const without = renderHook(() => useOwnerImproveSubjects(validOwnerProperty({ type: 'plot', dossierId: null })));
    expect(without.result.current.terrain.target).toBeNull();
  });

  it('Κ3 το πάνελ παίρνει την κάρτα που δημοσιεύεται τώρα', () => {
    received.length = 0;
    lookup.current = { state: 'found', listing: { terrain: { provenance: 'declared', value: CARD } } };
    render(<TerrainImproveSection subject={{ target: null, listingId: 'ownp_a' }} />);
    expect(screen.getByText('objective-value:improve.sections.terrain.lead')).toBeInTheDocument();
    expect(received.at(-1)?.published).toBe(CARD);

    lookup.current = { state: 'absent' };
    render(<TerrainImproveSection subject={{ target: null, listingId: 'ownp_a' }} />);
    expect(received.at(-1)?.published).toBeNull();
  });
});
