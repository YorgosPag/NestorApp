/**
 * @fileoverview ADR-915 §26 — **ο ΕΝΑΣ υπεύθυνος** στη σελίδα «Λήξεις εγγράφων», όπως τον βλέπει ο άνθρωπος: ποιος και
 *   γιατί · οι συνιδιοκτήτες · «ένα έγγραφο για όλο το ακίνητο» · ορισμός **αισιόδοξα** · επαναφορά σε αποτυχία.
 *
 * 🔴 **Διαβάζει ΑΠΟΔΟΣΗ**: αληθινά `DocumentRegistryContent` + `useObligorDesignation`· ψεύτικα μόνο το δίκτυο
 *    (`saveObligorDesignation`), το δικαίωμα και τα μηνύματα. Το `t` επιστρέφει το κλειδί (+ παραμέτρους).
 */

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DocumentRegistryContent } from '../DocumentRegistryContent';
import {
  LEAD_BASIS_KEYS,
  LEAD_KEYS,
  LEAD_PICKER_ERROR_KEYS,
  LEAD_PICKER_KEYS,
  LEAD_UNDESIGNATED_KEYS,
  OBLIGOR_LABEL_KEYS,
} from '../document-registry-labels';
import type { ObligorLead } from '@/lib/document-validity/obligor-lead';
import { fixtureResponse } from '@/lib/document-validity/__tests__/registry-fixture';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import type { ObligorDesignationSave } from '@/services/document-registry/document-registry.client';

const revalidate = jest.fn(async () => undefined);
let registry: DocumentRegistryResponse;
jest.mock('@/hooks/document-registry/useDocumentRegistry', () => ({
  useDocumentRegistry: () => ({ view: { state: 'ready', registry }, reload: jest.fn(), revalidate }),
}));

const save = jest.fn(async (..._args: unknown[]): Promise<ObligorDesignationSave> => ({ kind: 'saved' }));
jest.mock('@/services/document-registry/document-registry.client', () => ({
  saveObligorDesignation: (...args: unknown[]) => save(...args),
}));

let verdict = 'granted-by-role';
jest.mock('@/auth/hooks/useCapability', () => ({ useCapability: () => ({ verdict }) }));

const notifyError = jest.fn();
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ error: notifyError, success: jest.fn() }) }));

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

/** Το p6 (κενό ΠΕΑ) με δύο αγοραστές και τον υπεύθυνο που δίνεται. */
function coOwned(obligorLead: ObligorLead, ownerShares: Record<string, number> = { cont_alpha: 60, cont_gamma: 40 }): DocumentRegistryResponse {
  const base = fixtureResponse();
  return {
    ...base,
    properties: { ...base.properties, p6: { ...base.properties.p6, ownerContactIds: ['cont_alpha', 'cont_gamma'], obligorLead, ownerShares } },
  };
}

const MAJORITY: ObligorLead = { kind: 'designated', contactId: 'cont_alpha', basis: 'majority-share', sharePct: 60, staleContactId: null };
const cell = () => within(screen.getByText('Συνθετικό Ζ6').closest('article') as HTMLElement).getByText(OBLIGOR_LABEL_KEYS.owner).closest('dd') as HTMLElement;

beforeEach(() => {
  verdict = 'granted-by-role';
  save.mockClear();
  revalidate.mockClear();
  notifyError.mockClear();
});

describe('ADR-915 §26 — ο υπεύθυνος πάνω στη γραμμή', () => {
  it('πλειοψηφία ⇒ ο υπεύθυνος ΠΡΩΤΟΣ με τον λόγο, ο άλλος ως συνιδιοκτήτης, και «ένα έγγραφο για όλο το ακίνητο»', () => {
    registry = coOwned(MAJORITY);
    render(<DocumentRegistryContent />);
    const dd = cell();
    expect(within(dd).getAllByRole('link')[0].textContent).toBe('Συνθετικός Άλφα');
    expect(within(dd).getByText((text) => text.startsWith(LEAD_KEYS.role) && text.includes(LEAD_BASIS_KEYS['majority-share']))).toBeTruthy();
    const coOwners = within(dd).getByRole('list', { name: LEAD_KEYS.coOwners });
    expect(within(coOwners).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Συνθετικός Γάμμα']);
    expect(within(dd).getByText(LEAD_KEYS.onePerProperty)).toBeTruthy();
    expect(within(dd).getByRole('button', { name: LEAD_PICKER_KEYS.change })).toBeTruthy();
  });

  it('κανείς με πλειοψηφία ⇒ το ΛΕΕΙ, ζητά ορισμό — και ΚΑΝΕΝΑΣ δεν παρουσιάζεται ως υπεύθυνος', () => {
    registry = coOwned({ kind: 'undesignated', reason: 'no-majority', staleContactId: null }, { cont_alpha: 50, cont_gamma: 50 });
    render(<DocumentRegistryContent />);
    const dd = cell();
    expect(within(dd).getByText(LEAD_UNDESIGNATED_KEYS['no-majority'])).toBeTruthy();
    expect(within(dd).queryByText((text) => text.startsWith(LEAD_KEYS.role))).toBeNull();
    expect(within(dd).getByText(LEAD_KEYS.onePerPropertyUndesignated)).toBeTruthy();
    expect(within(dd).getByRole('button', { name: LEAD_PICKER_KEYS.set })).toBeTruthy();
  });

  it('παλιά επιλογή που δεν ισχύει ⇒ ονομάζεται', () => {
    registry = coOwned({ ...MAJORITY, staleContactId: 'cont_delta' });
    render(<DocumentRegistryContent />);
    expect(within(cell()).getByText(`${LEAD_KEYS.stale} {"name":"Συνθετικός Δέλτα"}`)).toBeTruthy();
  });

  it('χωρίς δικαίωμα επεξεργασίας ακινήτου ⇒ ο υπεύθυνος λέγεται, το κουμπί ΟΧΙ', () => {
    verdict = 'denied-permission';
    registry = coOwned(MAJORITY);
    render(<DocumentRegistryContent />);
    expect(within(cell()).queryByRole('button', { name: LEAD_PICKER_KEYS.change })).toBeNull();
  });
});

describe('ADR-915 §26 — ορισμός από την οθόνη', () => {
  async function chooseGamma(): Promise<void> {
    const user = userEvent.setup();
    await user.click(within(cell()).getByRole('button', { name: LEAD_PICKER_KEYS.change }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: /Συνθετικός Γάμμα/ }));
    await user.click(within(dialog).getByRole('button', { name: LEAD_PICKER_KEYS.save }));
  }

  it('αισιόδοξα: ο Γάμμα φαίνεται υπεύθυνος ΑΜΕΣΩΣ («Αποθηκεύεται…»), μετά ξαναδιαβάζεται το μητρώο', async () => {
    registry = coOwned(MAJORITY);
    let resolve: (value: ObligorDesignationSave) => void = () => undefined;
    save.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<DocumentRegistryContent />);
    await chooseGamma();
    expect(save).toHaveBeenCalledWith('p6', 'cont_gamma');
    expect(within(cell()).getAllByRole('link')[0].textContent).toBe('Συνθετικός Γάμμα');
    expect(within(cell()).getByText((text) => text.includes(LEAD_BASIS_KEYS.explicit))).toBeTruthy();
    expect(within(cell()).getByRole('status').textContent).toBe(LEAD_KEYS.saving);
    await act(async () => { resolve({ kind: 'saved' }); });
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(within(cell()).queryByRole('status')).toBeNull();
  });

  it('άρνηση του διακομιστή ⇒ η γραμμή γυρίζει πίσω ΚΑΙ ο άνθρωπος μαθαίνει γιατί', async () => {
    registry = coOwned(MAJORITY);
    save.mockResolvedValueOnce({ kind: 'failed', code: 'NOT_AN_OWNER' });
    render(<DocumentRegistryContent />);
    await chooseGamma();
    expect(await screen.findByRole('button', { name: LEAD_PICKER_KEYS.change })).toBeTruthy();
    expect(within(cell()).getAllByRole('link')[0].textContent).toBe('Συνθετικός Άλφα');
    expect(notifyError).toHaveBeenCalledWith(LEAD_PICKER_ERROR_KEYS.NOT_AN_OWNER);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it('«Αυτόματη επιλογή» ⇒ σβήνει τη ρητή επιλογή (`null`)', async () => {
    registry = coOwned({ ...MAJORITY, contactId: 'cont_gamma', basis: 'explicit', sharePct: 40 });
    render(<DocumentRegistryContent />);
    const user = userEvent.setup();
    await user.click(within(cell()).getByRole('button', { name: LEAD_PICKER_KEYS.change }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: LEAD_PICKER_KEYS.save }).hasAttribute('disabled')).toBe(true);
    await user.click(within(dialog).getByRole('radio', { name: new RegExp(LEAD_PICKER_KEYS.automatic) }));
    await user.click(within(dialog).getByRole('button', { name: LEAD_PICKER_KEYS.save }));
    expect(save).toHaveBeenCalledWith('p6', null);
  });
});
