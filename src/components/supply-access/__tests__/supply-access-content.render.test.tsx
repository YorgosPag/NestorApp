/**
 * **Η οθόνη του αγοραστή στις δύο πόρτες** (ADR-923 §5.12 Σ2 · Σ3): στοιχεία πριν από κουμπιά, χωρίς γραφείο καμία αποδοχή,
 * και ο αριθμός πελάτη υπάρχει μόνο στην πόρτα του συνδέσμου.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { AcceptancePreview } from '@/types/conveyance-case';
import { SupplyAccessContent, type SupplyAccessDoor, type SupplyAccessView } from '../SupplyAccessContent';

const redeem = jest.fn(async () => ({ kind: 'done', status: 'accepted' }));
const request = jest.fn(async () => ({ kind: 'done', status: 'requested' }));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/services/catalog/supply-api.client', () => ({
  redeemSupplyInvitationFromScreen: (...args: unknown[]) => redeem(...(args as [])),
  requestSupplyAccessFromScreen: (...args: unknown[]) => request(...(args as [])),
}));
jest.mock('@/components/conveyance/acting/ActingWorkspaceField', () => ({ ActingWorkspaceField: () => <p>acting-field</p> }));
jest.mock('@/components/workspace-invite/SwitchAccount', () => ({ SwitchAccountButton: () => null }));
jest.mock('@/lib/workspace/navigation', () => ({ Link: ({ children }: { readonly children: React.ReactNode }) => <a href="/">{children}</a> }));

const previewView = (acceptance: AcceptancePreview | null): SupplyAccessView => ({
  kind: 'preview',
  preview: { supplierName: 'Aries' },
  token: 'token-1',
  respond: { kind: 'ready' },
  switchAccountHref: '/login',
  acceptance,
});

const OFFICE: AcceptancePreview = { kind: 'office', office: { companyId: 'comp-buyer', name: 'Γραφείο' } };

const renderDoor = (door: SupplyAccessDoor, acceptance: AcceptancePreview | null) =>
  render(<SupplyAccessContent door={door} view={previewView(acceptance)} />);

beforeEach(() => {
  redeem.mockClear();
  request.mockClear();
});

describe('πόρτα α', () => {
  it('αποδοχή ή άρνηση, χωρίς αριθμό πελάτη', () => {
    renderDoor('invitation', OFFICE);
    expect(screen.getByText('catalog:supply.access.accept')).toBeTruthy();
    expect(screen.getByText('catalog:supply.access.decline')).toBeTruthy();
    expect(screen.queryByLabelText('catalog:supply.access.customerRefLabel')).toBeNull();
  });

  it('🔴 χωρίς γραφείο: καμία αποδοχή, αλλά η άρνηση μένει', () => {
    renderDoor('invitation', { kind: 'personal-provisional' });
    expect(screen.queryByText('catalog:supply.access.accept')).toBeNull();
    expect(screen.getByText('catalog:supply.access.officeRequired')).toBeTruthy();
    expect(screen.getByText('catalog:supply.access.decline')).toBeTruthy();
  });

  it('η αποδοχή στέλνει το token και λέει τι έγινε', async () => {
    renderDoor('invitation', OFFICE);
    fireEvent.click(screen.getByText('catalog:supply.access.accept'));
    await waitFor(() => expect(screen.getByText('catalog:supply.access.acceptedTitle')).toBeTruthy());
    expect(redeem).toHaveBeenCalledWith('token-1', 'accept', {});
  });
});

describe('πόρτα β', () => {
  it('το αίτημα κουβαλά τον αριθμό πελάτη, χωρίς κουμπί άρνησης', async () => {
    renderDoor('link', OFFICE);
    expect(screen.queryByText('catalog:supply.access.decline')).toBeNull();
    fireEvent.change(screen.getByLabelText('catalog:supply.access.customerRefLabel'), { target: { value: 'R-77' } });
    fireEvent.click(screen.getByText('catalog:supply.access.request'));
    await waitFor(() => expect(screen.getByText('catalog:supply.access.requestedTitle')).toBeTruthy());
    expect(request).toHaveBeenCalledWith('token-1', 'R-77', {});
  });

  it('🔴 χωρίς γραφείο: ούτε πεδίο, ούτε κουμπί', () => {
    renderDoor('link', { kind: 'personal-provisional' });
    expect(screen.queryByText('catalog:supply.access.request')).toBeNull();
    expect(screen.queryByLabelText('catalog:supply.access.customerRefLabel')).toBeNull();
  });
});

it('🔴 άγνωστα γραφεία: η πράξη δεν στέλνεται', () => {
  renderDoor('invitation', { kind: 'unknown' });
  fireEvent.click(screen.getByText('catalog:supply.access.accept'));
  expect(redeem).not.toHaveBeenCalled();
});

it('όψη που δεν δίνεται: ο λόγος με το όνομά του', () => {
  render(<SupplyAccessContent door="link" view={{ kind: 'refused', reason: 'revoked' }} />);
  expect(screen.getByText('catalog:supply.refusals.revoked')).toBeTruthy();
});
