/**
 * @fileoverview ADR-915 §35 — **«Μόνιμες υποχρεώσεις»** στη σελίδα «Λήξεις εγγράφων», όπως τις βλέπει ο άνθρωπος: η
 *   πρόταση με τον λόγο της · «Επιβεβαίωση» · «Δεν ισχύει» μόνο με λόγο · «Αναίρεση» · η άρνηση του διακομιστή · χωρίς
 *   δικαίωμα ⇒ μόνο ανάγνωση · και μετά την επιβεβαίωση, το κενό «λείπει» με τη μόνιμη υποχρέωση στο «ποιος το ζητά».
 *
 * 🔴 **Διαβάζει ΑΠΟΔΟΣΗ**: αληθινά `DocumentRegistryContent` · ο πυρήνας · το hook · τα κουμπιά. Ψεύτικα μόνο το δίκτυο
 *    (`saveUpkeepDeclaration`), το δικαίωμα και τα μηνύματα. Το `t` επιστρέφει το κλειδί (+ παραμέτρους).
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DocumentRegistryContent } from '../DocumentRegistryContent';
import { REGISTRY_KEYS } from '../document-registry-labels';
import {
  UPKEEP_DECISION_KEYS,
  UPKEEP_ERROR_KEYS,
  UPKEEP_EXEMPTION_KEYS,
  UPKEEP_KEYS,
  UPKEEP_PROPOSAL_KEYS,
} from '../upkeep-labels';
import { fixtureResponse } from '@/lib/document-validity/__tests__/registry-fixture';
import {
  upkeepRequirementsOf,
  type UpkeepDeclaration,
  type UpkeepItem,
} from '@/lib/document-validity/property-upkeep';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import type { ObligorDesignationSave } from '@/services/document-registry/document-registry.client';

const revalidate = jest.fn(async () => undefined);
let registry: DocumentRegistryResponse;
jest.mock('@/hooks/document-registry/useDocumentRegistry', () => ({
  useDocumentRegistry: () => ({ view: { state: 'ready', registry }, reload: jest.fn(), revalidate }),
}));

const save = jest.fn(async (..._args: unknown[]): Promise<ObligorDesignationSave> => ({ kind: 'saved' }));
jest.mock('@/services/document-registry/document-registry.client', () => ({
  saveUpkeepDeclaration: (...args: unknown[]) => save(...args),
}));

let verdict = 'granted-by-role';
jest.mock('@/auth/hooks/useCapability', () => ({ useCapability: () => ({ verdict }) }));

const notifySuccess = jest.fn();
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ error: jest.fn(), success: notifySuccess }) }));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

const YDE = 'electrical-installation' as const;
const PROPOSED = { verdict: 'proposed', reason: 'in-use', propertyClass: 'residential', phase: 'ready' } as const;

function decided(over: Partial<UpkeepDeclaration> = {}): UpkeepDeclaration {
  return {
    propertyId: 'p1', documentKind: YDE, decision: 'required', exemptionReason: null, proposalAtDecision: PROPOSED,
    declaredByUid: 'user_1', declaredAt: '2026-10-18T09:00:00.000Z', ...over,
  };
}

/** Το μητρώο με μία ενότητα (p1 · ΥΔΕ): εκκρεμής, ή αποφασισμένη — τότε **και** η απαίτηση, από τον ΑΛΗΘΙΝΟ παραγωγό. */
function withUpkeep(declaration: UpkeepDeclaration | null): DocumentRegistryResponse {
  const item: UpkeepItem = { propertyId: 'p1', documentKind: YDE, proposal: PROPOSED, declaration };
  const requirements = declaration === null ? [] : upkeepRequirementsOf([declaration]);
  return fixtureResponse({ upkeep: [item] }, [], requirements);
}

const panel = () => screen.getByRole('region', { name: new RegExp(UPKEEP_KEYS.title) });
const button = (name: string) => within(panel()).queryByRole('button', { name });

beforeEach(() => {
  verdict = 'granted-by-role';
  save.mockReset().mockResolvedValue({ kind: 'saved' });
  revalidate.mockClear();
  notifySuccess.mockClear();
});

describe('πριν την απόφαση', () => {
  it('η πρόταση λέει ΓΙΑΤΙ, μετρά ό,τι περιμένει, δείχνει τη διάταξη — και ΚΑΝΕΝΑ «λείπει» στις γραμμές', () => {
    registry = withUpkeep(null);
    render(<DocumentRegistryContent />);
    expect(within(panel()).getByText(UPKEEP_PROPOSAL_KEYS['in-use'])).toBeInTheDocument();
    expect(within(panel()).getByText(`${UPKEEP_KEYS.pending} {"count":1}`)).toBeInTheDocument();
    expect(within(panel()).getByText(new RegExp(`^${UPKEEP_KEYS.statute}`))).toBeInTheDocument();
    expect(registry.rows.filter((row) => row.kind === 'gap')).toEqual([]);
  });

  it('«Επιβεβαίωση» ⇒ στέλνει ΑΚΡΙΒΩΣ την απόφαση (χωρίς πρόταση από τον πελάτη) + `revalidate` + μήνυμα', async () => {
    registry = withUpkeep(null);
    render(<DocumentRegistryContent />);
    await userEvent.click(button(UPKEEP_KEYS.confirm)!);
    expect(save).toHaveBeenCalledWith({ propertyId: 'p1', documentKind: YDE, decision: 'required', exemptionReason: null });
    await waitFor(() => expect(revalidate).toHaveBeenCalled());
    expect(notifySuccess).toHaveBeenCalledWith(UPKEEP_KEYS.saved);
  });

  it('«Δεν ισχύει» ⇒ λόγος ΥΠΟΧΡΕΩΤΙΚΟΣ (κανένας προεπιλεγμένος)· με λόγο ⇒ στέλνει την εξαίρεση', async () => {
    registry = withUpkeep(null);
    render(<DocumentRegistryContent />);
    await userEvent.click(button(UPKEEP_KEYS.exempt)!);
    // Η φόρμα έρχεται όταν είναι έτοιμο το chunk (μετάβαση, §37.7) — ως τότε μένει το «Δεν ισχύει», όχι κενό.
    expect(await within(panel()).findByRole('group', { name: UPKEEP_KEYS.exemptLegend })).toBeInTheDocument();
    expect(button(UPKEEP_KEYS.saveExempt)).toBeDisabled();
    await userEvent.click(within(panel()).getByRole('radio', { name: UPKEEP_EXEMPTION_KEYS['not-connected'] }));
    await userEvent.click(button(UPKEEP_KEYS.saveExempt)!);
    expect(save).toHaveBeenCalledWith({ propertyId: 'p1', documentKind: YDE, decision: 'not-required', exemptionReason: 'not-connected' });
  });

  it('άρνηση του διακομιστή ⇒ ο λόγος της, δίπλα στο ακίνητο', async () => {
    save.mockResolvedValueOnce({ kind: 'failed', code: 'NOT_STANDING_OBLIGATION' });
    registry = withUpkeep(null);
    render(<DocumentRegistryContent />);
    await userEvent.click(button(UPKEEP_KEYS.confirm)!);
    expect(await within(panel()).findByRole('alert')).toHaveTextContent(UPKEEP_ERROR_KEYS['not-standing']);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it('χωρίς δικαίωμα ⇒ η πρόταση φαίνεται, κανένα κουμπί', () => {
    verdict = 'denied';
    registry = withUpkeep(null);
    render(<DocumentRegistryContent />);
    expect(within(panel()).getByText(UPKEEP_PROPOSAL_KEYS['in-use'])).toBeInTheDocument();
    expect(within(panel()).queryAllByRole('button')).toEqual([]);
  });

  it('καμία πρόταση, καμία απόφαση ⇒ καμία ενότητα (κανένα άδειο πλαίσιο)', () => {
    registry = fixtureResponse();
    render(<DocumentRegistryContent />);
    expect(screen.queryByRole('region', { name: new RegExp(UPKEEP_KEYS.title) })).toBeNull();
  });
});

describe('μετά την απόφαση', () => {
  it('επιβεβαιωμένη ⇒ το κενό «λείπει» ζητείται από τη μόνιμη υποχρέωση, με το πότε επιβεβαιώθηκε· «Αναίρεση» στέλνει `null`', async () => {
    registry = withUpkeep(decided());
    render(<DocumentRegistryContent />);
    const gap = screen.getAllByRole('article').find((article) => within(article).queryByText('document-registry:dependents.property-upkeep'));
    expect(gap).toBeDefined();
    expect(within(gap!).getByText(new RegExp(`^${REGISTRY_KEYS.upkeepDeclaredOn}`))).toBeInTheDocument();
    expect(within(panel()).getByText(UPKEEP_DECISION_KEYS.required)).toBeInTheDocument();
    await userEvent.click(button(UPKEEP_KEYS.reask)!);
    expect(save).toHaveBeenCalledWith({ propertyId: 'p1', documentKind: YDE, decision: null, exemptionReason: null });
  });

  it('εξαίρεση ΑΝΤΙΘΕΤΑ στην πρόταση ⇒ ο λόγος + «αντίθετα με την πρόταση της εφαρμογής», και κανένα κενό', () => {
    registry = withUpkeep(decided({ decision: 'not-required', exemptionReason: 'no-own-supply' }));
    render(<DocumentRegistryContent />);
    expect(within(panel()).getByText(UPKEEP_EXEMPTION_KEYS['no-own-supply'])).toBeInTheDocument();
    expect(within(panel()).getByText(UPKEEP_KEYS.overrode)).toBeInTheDocument();
    expect(registry.rows.filter((row) => row.kind === 'gap')).toEqual([]);
  });
});
