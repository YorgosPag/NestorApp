/**
 * @fileoverview ΑΓΚΥΡΑ — **ο κατάλογος `/pro` ανοιχτός «για» ακίνητο του ιδιώτη** (ADR-945 §7.6).
 * @related components/mandate/agency-issuance-quote-context.tsx · components/mandate/MyPropertyFilter.tsx
 *
 *   Π1 · διακόπτης ΚΛΕΙΣΤΟΣ ⇒ σκέτα παιδιά: καμία ανάγνωση αιτήματος, κανένα πλαίσιο (ούτε με πλαίσιο στη διεύθυνση).
 *   Π2 · διακόπτης ανοιχτός, διεύθυνση χωρίς πλαίσιο (ή μισό) ⇒ σκέτα παιδιά.
 *   Π3 · διακόπτης ανοιχτός + πλαίσιο ⇒ ΜΙΑ ανάγνωση για το ακίνητο/έγγραφο της διεύθυνσης.
 *   Ζ1 · «για» ακίνητο ⇒ η περιοχή ΤΟΥ ακινήτου προεπιλέγεται ΜΙΑ φορά, από τον ίδιο κριτή (`ownerPropertyWhere`).
 *   Ζ2 · ο άνθρωπος την αφαιρεί ⇒ ΔΕΝ ξαναγυρίζει.
 *   Ζ3 · ρητή περιοχή στη διεύθυνση νικά · ακίνητο χωρίς αποδείξιμη περιοχή ⇒ καμία μαντεψιά · χωρίς πλαίσιο ⇒ τίποτα.
 *
 * Συνθετικά δεδομένα — κανένα δεδομένο πελάτη.
 */

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import type { IssuanceContext } from '@/lib/agency/issuance-context-query';
import type { ShowcaseWhere } from '@/types/agency-coverage';

import { AgencyIssuanceQuoteProvider, useAgencyIssuanceQuote, type AgencyIssuanceQuoteApi } from '../agency-issuance-quote-context';
import { MyPropertyFilter } from '../MyPropertyFilter';

let mockFlagOn = false;
jest.mock('@/config/feature-flags', () => ({ isAppFeatureEnabled: () => mockFlagOn }));

let mockSearch = '';
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(mockSearch) }));

jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'uid_owner' } }) }));
jest.mock('@/auth', () => ({ useAuthOptional: () => ({ user: { uid: 'uid_owner' } }) }));

const mockUseIssuanceRequest = jest.fn((_propertyId: string, _kind: string) => ({
  view: { state: 'loading' as const },
  revalidate: async () => undefined,
}));
jest.mock('@/hooks/document-registry/useIssuanceRequest', () => ({
  useIssuanceRequest: (propertyId: string, kind: string) => mockUseIssuanceRequest(propertyId, kind),
}));
jest.mock('@/hooks/document-registry/useIssuanceRequestAction', () => ({
  useIssuanceRequestAction: () => ({ submit: async () => true, busyKey: null, error: null }),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, isNamespaceReady: true }),
}));

/** Δύο ακίνητα: το `ownp_a` με αποδείξιμη περιοχή, το `ownp_b` χωρίς. Ο κριτής απαντά ανά δηλωμένη θέση. */
const PLACE_A = { kind: 'declared', marker: 'a' } as const;
const PLACE_B = { kind: 'declared', marker: 'b' } as const;
const AREA_A: ShowcaseWhere = { adminId: 'municipality:9186' };
jest.mock('@/services/realtime/hooks/useMyOwnerProperties', () => ({
  useMyOwnerProperties: () => ({
    state: 'ready',
    properties: [
      { id: 'ownp_a', title: 'Διαμέρισμα Α', place: PLACE_A },
      { id: 'ownp_b', title: 'Οικόπεδο Β', place: PLACE_B },
    ],
  }),
}));
jest.mock('@/lib/agency/owner-property-where', () => ({
  ownerPropertyWhere: (place: { marker: string }) => (place.marker === 'a' ? AREA_A : null),
}));
jest.mock('@/hooks/useAdminFootprints', () => ({ useAdminFootprints: () => ({ entries: new Map(), isLoading: false }) }));
jest.mock('@/hooks/useAdministrativeHierarchy', () => ({
  lineageIdsOf: () => [],
  useAdministrativeHierarchy: () => ({ findById: () => null }),
}));

const CONTEXT_A: IssuanceContext = { propertyId: 'ownp_a', documentKind: 'energy-certificate' };
const QUERY_A = 'forProperty=ownp_a&forDocument=energy-certificate';

let seen: AgencyIssuanceQuoteApi | null = null;
function Probe(): React.ReactElement {
  seen = useAgencyIssuanceQuote();
  return <p>probe</p>;
}

beforeEach(() => {
  mockFlagOn = false;
  mockSearch = '';
  seen = null;
  mockUseIssuanceRequest.mockClear();
});

describe('ADR-945 §7.6 — ο πάροχος του `/pro`', () => {
  it('Π1 · διακόπτης ΚΛΕΙΣΤΟΣ ⇒ σκέτα παιδιά, καμία ανάγνωση — ακόμη και με πλαίσιο στη διεύθυνση', () => {
    mockSearch = QUERY_A;
    render(<AgencyIssuanceQuoteProvider><Probe /></AgencyIssuanceQuoteProvider>);
    expect(seen).toBeNull();
    expect(mockUseIssuanceRequest).not.toHaveBeenCalled();
  });

  it('Π2 · ανοιχτός, χωρίς πλαίσιο ή με ΜΙΣΟ πλαίσιο ⇒ σκέτα παιδιά', () => {
    mockFlagOn = true;
    for (const search of ['', 'forProperty=ownp_a', 'forDocument=energy-certificate', 'forProperty=ownp_a&forDocument=nope']) {
      mockSearch = search;
      render(<AgencyIssuanceQuoteProvider><Probe /></AgencyIssuanceQuoteProvider>);
      expect(seen).toBeNull();
    }
    expect(mockUseIssuanceRequest).not.toHaveBeenCalled();
  });

  it('Π3 · ανοιχτός + πλαίσιο ⇒ ΜΙΑ ανάγνωση για το ακίνητο και το έγγραφο της διεύθυνσης', () => {
    mockFlagOn = true;
    mockSearch = QUERY_A;
    render(<AgencyIssuanceQuoteProvider><Probe /></AgencyIssuanceQuoteProvider>);
    expect(seen?.context).toEqual(CONTEXT_A);
    expect(seen?.signedIn).toBe(true);
    expect(new Set(mockUseIssuanceRequest.mock.calls.map((call) => call.join('|')))).toEqual(new Set(['ownp_a|energy-certificate']));
  });
});

/** Ο κατάλογος όπως τον βλέπει το φίλτρο: πάροχος (με τη διεύθυνση) + «Το ακίνητό μου». */
function Directory({ where, onPick }: { readonly where: ShowcaseWhere | null; readonly onPick: (where: ShowcaseWhere) => void }) {
  return (
    <AgencyIssuanceQuoteProvider>
      <MyPropertyFilter where={where} onPick={onPick} />
    </AgencyIssuanceQuoteProvider>
  );
}

describe('ADR-945 §7.6 — η περιοχή του ακινήτου ως προεπιλογή', () => {
  beforeEach(() => {
    mockFlagOn = true;
  });

  it('Ζ1 · «για» ακίνητο ⇒ η περιοχή ΤΟΥ ακινήτου, ΜΙΑ φορά, από τον ίδιο κριτή', () => {
    mockSearch = QUERY_A;
    const onPick = jest.fn();
    const view = render(<Directory where={null} onPick={onPick} />);
    view.rerender(<Directory where={null} onPick={onPick} />);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(AREA_A);
  });

  it('Ζ2 · ο άνθρωπος αφαιρεί την περιοχή ⇒ ΔΕΝ ξαναγυρίζει', () => {
    mockSearch = QUERY_A;
    const onPick = jest.fn();
    const view = render(<Directory where={null} onPick={onPick} />);
    view.rerender(<Directory where={AREA_A} onPick={onPick} />);
    view.rerender(<Directory where={null} onPick={onPick} />);
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('Ζ3 · ρητή περιοχή νικά · ακίνητο χωρίς περιοχή ⇒ καμία μαντεψιά · χωρίς πλαίσιο ⇒ τίποτα', () => {
    const onPick = jest.fn();
    mockSearch = QUERY_A;
    render(<Directory where={{ adminId: 'municipality:1' }} onPick={onPick} />);
    mockSearch = 'forProperty=ownp_b&forDocument=energy-certificate';
    render(<Directory where={null} onPick={onPick} />);
    mockSearch = '';
    render(<Directory where={null} onPick={onPick} />);
    expect(onPick).not.toHaveBeenCalled();
  });
});
