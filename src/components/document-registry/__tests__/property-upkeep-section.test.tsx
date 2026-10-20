/**
 * @fileoverview ADR-915 §36 — **«Μόνιμες υποχρεώσεις του ακινήτου»** στην καρτέλα του ακινήτου, όπως τις βλέπει ο
 *   άνθρωπος: η πρόταση από τη γέννηση · «Επιβεβαίωση» από την καρτέλα με το ΙΔΙΟ `PUT` · ανανέωση χωρίς «φορτώνει» ·
 *   σιωπή για οικόπεδο και αποσυρμένο · «η πρόταση άλλαξε από τότε» · βλάβη που ΛΕΓΕΤΑΙ.
 *
 * 🔴 **Διαβάζει ΑΠΟΔΟΣΗ**: αληθινά `PropertyUpkeepSection` · `usePropertyUpkeep` · `useUpkeepDeclaration` · η κοινή ενότητα
 *    και τα κουμπιά. Ψεύτικα μόνο το δίκτυο (`fetchPropertyUpkeep` · `saveUpkeepDeclaration`), η ταυτότητα, το δικαίωμα.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { PropertyUpkeepSection } from '../PropertyUpkeepSection';
import { REGISTRY_KEYS } from '../document-registry-labels';
import { UPKEEP_KEYS, UPKEEP_PROPOSAL_KEYS, UPKEEP_SECTION_TITLE_KEYS } from '../upkeep-labels';
import type { UpkeepDeclaration, UpkeepItem, UpkeepProposal } from '@/lib/document-validity/property-upkeep';
import type { ObligorDesignationSave, PropertyUpkeepLoad } from '@/services/document-registry/document-registry.client';

const load = jest.fn(async (_propertyId: string): Promise<PropertyUpkeepLoad> => ({ kind: 'ready', items: [] }));
const save = jest.fn(async (..._args: unknown[]): Promise<ObligorDesignationSave> => ({ kind: 'saved' }));
jest.mock('@/services/document-registry/document-registry.client', () => ({
  fetchPropertyUpkeep: (propertyId: string) => load(propertyId),
  saveUpkeepDeclaration: (...args: unknown[]) => save(...args),
}));

jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'user_1' }, loading: false }) }));

let verdict = 'granted-by-role';
jest.mock('@/auth/hooks/useCapability', () => ({ useCapability: () => ({ verdict }) }));

jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ error: jest.fn(), success: jest.fn() }) }));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

const YDE = 'electrical-installation' as const;
const UNDECLARED: UpkeepProposal = { verdict: 'proposed', reason: 'phase-undeclared', propertyClass: 'residential', phase: null };
const IN_USE: UpkeepProposal = { verdict: 'proposed', reason: 'in-use', propertyClass: 'residential', phase: 'ready' };

const item = (proposal: UpkeepProposal, declaration: UpkeepDeclaration | null = null): UpkeepItem =>
  ({ propertyId: 'prop_1', documentKind: YDE, proposal, declaration });
const decided = (proposalAtDecision: UpkeepProposal): UpkeepDeclaration => ({
  propertyId: 'prop_1', documentKind: YDE, decision: 'required', exemptionReason: null, proposalAtDecision,
  declaredByUid: 'user_1', declaredAt: '2026-10-20T09:00:00.000Z',
});

const section = () => screen.findByRole('region', { name: new RegExp(UPKEEP_SECTION_TITLE_KEYS.property) });

beforeEach(() => {
  verdict = 'granted-by-role';
  load.mockReset().mockResolvedValue({ kind: 'ready', items: [item(UNDECLARED)] });
  save.mockReset().mockResolvedValue({ kind: 'saved' });
});

describe('η καρτέλα του ακινήτου', () => {
  it('νέο ακίνητο ⇒ η πρόταση με τον λόγο της, χωρίς γραμμή «Ακίνητο» (η καρτέλα ΕΙΝΑΙ το ακίνητο)', async () => {
    render(<PropertyUpkeepSection propertyId="prop_1" />);
    const region = await section();
    expect(load).toHaveBeenCalledWith('prop_1');
    expect(within(region).getByText(UPKEEP_PROPOSAL_KEYS['phase-undeclared'])).toBeInTheDocument();
    expect(within(region).queryByText(REGISTRY_KEYS.property)).toBeNull();
    expect(within(region).getByText(new RegExp(`${UPKEEP_KEYS.pending}.*"count":1`))).toBeInTheDocument();
  });

  it('«Επιβεβαίωση» από την καρτέλα ⇒ το ΙΔΙΟ `PUT`, και η ενότητα ανανεώνεται ΧΩΡΙΣ να χαθεί', async () => {
    render(<PropertyUpkeepSection propertyId="prop_1" />);
    const region = await section();
    load.mockResolvedValueOnce({ kind: 'ready', items: [item(UNDECLARED, decided(UNDECLARED))] });
    await userEvent.click(within(region).getByRole('button', { name: UPKEEP_KEYS.confirm }));
    expect(save).toHaveBeenCalledWith({ propertyId: 'prop_1', documentKind: YDE, decision: 'required', exemptionReason: null });
    await waitFor(() => expect(within(region).getByRole('button', { name: UPKEEP_KEYS.reask })).toBeInTheDocument());
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('«η πρόταση άλλαξε από τότε» — όταν η φάση άλλαξε μετά την απόφαση· η απόφαση ΜΕΝΕΙ', async () => {
    load.mockResolvedValue({ kind: 'ready', items: [item(IN_USE, decided(UNDECLARED))] });
    render(<PropertyUpkeepSection propertyId="prop_1" />);
    const region = await section();
    expect(within(region).getByText(UPKEEP_KEYS.proposalChanged)).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: UPKEEP_KEYS.reask })).toBeInTheDocument();
  });

  it('χωρίς δικαίωμα ⇒ μόνο ανάγνωση', async () => {
    verdict = 'denied';
    render(<PropertyUpkeepSection propertyId="prop_1" />);
    const region = await section();
    expect(within(region).queryByRole('button')).toBeNull();
  });

  it.each([
    ['οικόπεδο (κενή λίστα)', { kind: 'ready', items: [] }],
    ['αποσυρμένο · ξένο (άρνηση)', { kind: 'unavailable' }],
  ] as const)('%s ⇒ η ενότητα ΣΙΩΠΑ', async (_case, answer) => {
    load.mockResolvedValue(answer);
    const { container } = render(<PropertyUpkeepSection propertyId="prop_1" />);
    await waitFor(() => expect(load).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('βλάβη ⇒ το ΛΕΕΙ (ποτέ σιωπηλή απουσία που μοιάζει με «τίποτα να αποφασιστεί»)', async () => {
    load.mockResolvedValue({ kind: 'failed' });
    render(<PropertyUpkeepSection propertyId="prop_1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(UPKEEP_KEYS.loadFailed);
  });
});
