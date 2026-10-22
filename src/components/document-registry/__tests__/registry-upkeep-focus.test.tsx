/**
 * @fileoverview ADR-915 §37.6 — **η εστίαση δεν πέφτει ποτέ στο `<body>`** όταν η απόφαση αντικαθιστά το κουμπί (WCAG 2.4.3).
 *
 * 🔴 Μετρημένο στον browser (2026-10-21, 390 px, πληκτρολόγιο): «Επιβεβαίωση» με Enter ⇒ `document.activeElement === body`.
 *    Δύο αιτίες: `disabled` στο εστιασμένο κουμπί σε πτήση (ο Chrome πετά την εστίαση) + αντικατάσταση του κουμπιού.
 * 🔑 Η σειρά του hook αναπαράγεται με `rerender`: `busy` ⇒ (νέα απόφαση **και** `busy: false` μαζί, αφού το hook κάνει
 *    `await revalidate()` πριν σβήσει το `busyKey`).
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { RegistryUpkeepDecision } from '../RegistryUpkeepDecision';
import { UPKEEP_EXEMPTION_KEYS, UPKEEP_KEYS } from '../upkeep-labels';
import {
  UPKEEP_EXEMPTION_REASONS,
  type UpkeepDeclaration,
  type UpkeepItem,
} from '@/lib/document-validity/property-upkeep';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const PROPOSED = { verdict: 'proposed', reason: 'in-use', propertyClass: 'residential', phase: 'ready' } as const;
const DECIDED: UpkeepDeclaration = {
  propertyId: 'p1', documentKind: 'electrical-installation', decision: 'required', exemptionReason: null,
  proposalAtDecision: PROPOSED, declaredByUid: 'user_1', declaredAt: '2026-10-21T09:00:00.000Z',
};
const itemOf = (declaration: UpkeepDeclaration | null): UpkeepItem =>
  ({ propertyId: 'p1', documentKind: 'electrical-installation', proposal: PROPOSED, declaration });

const onSubmit = jest.fn<Promise<boolean>, [unknown]>();
const view = (declaration: UpkeepDeclaration | null, busy: boolean) => (
  <>
    <button type="button">έξω</button>
    <RegistryUpkeepDecision item={itemOf(declaration)} busy={busy} onSubmit={onSubmit} />
  </>
);
const button = (name: string) => screen.getByRole('button', { name });

beforeEach(() => onSubmit.mockReset().mockResolvedValue(true));

describe('RegistryUpkeepDecision — η εστίαση μετά την πράξη', () => {
  it('σε πτήση το κουμπί ΜΕΝΕΙ εστιασμένο (`aria-disabled`, όχι `disabled`)', async () => {
    const { rerender } = render(view(null, false));
    await userEvent.click(button(UPKEEP_KEYS.confirm));
    rerender(view(null, true));
    const saving = button(UPKEEP_KEYS.saving);
    expect(saving).not.toBeDisabled();
    expect(saving).toHaveAttribute('aria-disabled', 'true');
    expect(saving).toHaveFocus();
  });

  it('«Επιβεβαίωση» ⇒ η εστίαση πάει στην «Αναίρεση»· «Αναίρεση» ⇒ πίσω στην «Επιβεβαίωση»', async () => {
    const { rerender } = render(view(null, false));
    await userEvent.click(button(UPKEEP_KEYS.confirm));
    rerender(view(null, true));
    rerender(view(DECIDED, false));
    expect(button(UPKEEP_KEYS.reask)).toHaveFocus();
    await userEvent.click(button(UPKEEP_KEYS.reask));
    rerender(view(DECIDED, true));
    rerender(view(null, false));
    expect(button(UPKEEP_KEYS.confirm)).toHaveFocus();
  });

  it('σε πτήση δεύτερο πάτημα ΔΕΝ στέλνει (το κουμπί δεν είναι `disabled` πια)', async () => {
    render(view(null, true));
    await userEvent.click(button(UPKEEP_KEYS.saving));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('«Δεν ισχύει» ⇒ ο πρώτος λόγος· «Ακύρωση» ⇒ πίσω στο «Δεν ισχύει»', async () => {
    render(view(null, false));
    await userEvent.click(button(UPKEEP_KEYS.exempt));
    const first = await screen.findByRole('radio', { name: UPKEEP_EXEMPTION_KEYS[UPKEEP_EXEMPTION_REASONS[0]] });
    expect(first).toHaveFocus();
    await userEvent.click(button(UPKEEP_KEYS.cancel));
    expect(button(UPKEEP_KEYS.exempt)).toHaveFocus();
  });

  it('«Δεν ισχύει» + λόγος + αποθήκευση ⇒ η φόρμα φεύγει και η εστίαση πάει στην «Αναίρεση» (νέος κόμβος, όχι ο ίδιος)', async () => {
    let resolve: (saved: boolean) => void = () => undefined;
    onSubmit.mockReturnValueOnce(new Promise<boolean>((done) => { resolve = done; }));
    const { rerender } = render(view(null, false));
    await userEvent.click(button(UPKEEP_KEYS.exempt));
    await userEvent.click(await screen.findByRole('radio', { name: UPKEEP_EXEMPTION_KEYS[UPKEEP_EXEMPTION_REASONS[0]] }));
    await userEvent.click(button(UPKEEP_KEYS.saveExempt));
    rerender(view(null, true));
    // Το hook: `await revalidate()` ⇒ νέα απόφαση, ΜΕΤΑ `busy: false`, ΜΕΤΑ επιστρέφει `true`.
    rerender(view({ ...DECIDED, decision: 'not-required', exemptionReason: UPKEEP_EXEMPTION_REASONS[0] }, false));
    await act(async () => resolve(true));
    expect(button(UPKEEP_KEYS.reask)).toHaveFocus();
  });

  it('ο άνθρωπος πήγε αλλού όσο περίμενε ⇒ η εστίαση ΔΕΝ του κλέβεται', async () => {
    const { rerender } = render(view(null, false));
    await userEvent.click(button(UPKEEP_KEYS.confirm));
    rerender(view(null, true));
    button('έξω').focus();
    rerender(view(DECIDED, false));
    expect(button('έξω')).toHaveFocus();
  });
});
