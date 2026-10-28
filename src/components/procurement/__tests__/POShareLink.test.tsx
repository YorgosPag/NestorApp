/**
 * ADR-923 §5.11 «3γ» Α15 — the share link is shown whatever the clipboard does.
 *
 *   Κ1 · the clipboard NEVER settles (tab without focus) ⇒ the link still appears in the field,
 *        and the copy started synchronously, inside the click (before the server answered).
 *   Κ2 · copy succeeds ⇒ «copied» toast; the clipboard refuses ⇒ warning, link still shown.
 *   Κ3 · creation fails ⇒ the dialog says so — not a clipboard warning.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const notifications = { success: jest.fn(), warning: jest.fn() };
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => notifications }));

const mockCreateShare = jest.fn();
jest.mock('@/services/procurement/procurement-mutation-gateway', () => ({
  createPurchaseOrderShareWithPolicy: (...a: unknown[]) => mockCreateShare(...a),
}));

const mockCopyDeferred = jest.fn();
jest.mock('@/lib/share-utils', () => ({
  copyDeferredText: (text: Promise<string>) => mockCopyDeferred(text),
  copyToClipboard: jest.fn(async () => true),
}));

type Kids = { children?: React.ReactNode };
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: Kids & { open?: boolean }) => (open ? <section>{children}</section> : null),
  DialogContent: ({ children }: Kids) => <section>{children}</section>,
  DialogHeader: ({ children }: Kids) => <header>{children}</header>,
  DialogTitle: ({ children }: Kids) => <h2>{children}</h2>,
  DialogDescription: ({ children }: Kids) => <p>{children}</p>,
}));

import { POShareLinkButton } from '../POShareLink';

const URL_OF_SHARE = 'https://nestorconstruct.gr/shared/po/abc123';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockCreateShare.mockReset();
  mockCopyDeferred.mockReset();
  notifications.success.mockReset();
  notifications.warning.mockReset();
});

describe('POShareLinkButton (ADR-923 «3γ» Α15)', () => {
  it('Κ1 · clipboard never settles ⇒ the link is still shown; copy started inside the click', async () => {
    const share = deferred<{ url: string; expiresAt: string }>();
    mockCreateShare.mockReturnValue(share.promise);
    mockCopyDeferred.mockReturnValue(new Promise<boolean>(() => undefined)); // never settles

    render(<POShareLinkButton poId="po_1" />);
    fireEvent.click(screen.getByRole('button', { name: /share.createLink/ }));
    expect(mockCopyDeferred).toHaveBeenCalledTimes(1); // synchronous — the server has not answered yet

    await act(async () => { share.resolve({ url: URL_OF_SHARE, expiresAt: new Date(Date.now() + 7 * 864e5).toISOString() }); });
    expect(screen.getByRole('textbox', { name: 'share.linkLabel' })).toHaveValue(URL_OF_SHARE);
    expect(screen.getByRole('button', { name: /share.createLink/ })).not.toBeDisabled();
  });

  it('Κ2 · copy outcome is a toast — success or warning — never blocking the link', async () => {
    mockCreateShare.mockResolvedValue({ url: URL_OF_SHARE, expiresAt: new Date().toISOString() });
    mockCopyDeferred.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    render(<POShareLinkButton poId="po_1" />);

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /share.createLink/ })); });
    expect(notifications.success).toHaveBeenCalledWith('share.copied');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /share.createLink/ })); });
    expect(notifications.warning).toHaveBeenCalledWith('share.copyFailed');
    expect(screen.getByRole('textbox', { name: 'share.linkLabel' })).toHaveValue(URL_OF_SHARE);
  });

  it('Κ3 · creation failure is shown in the dialog, not reported as a clipboard failure', async () => {
    mockCreateShare.mockRejectedValue(new Error('403'));
    mockCopyDeferred.mockImplementation((text: Promise<string>) => text.then(() => true));
    render(<POShareLinkButton poId="po_1" />);

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /share.createLink/ })); });
    expect(screen.getByRole('alert')).toHaveTextContent('share.createFailed');
    expect(notifications.warning).not.toHaveBeenCalled();
    expect(notifications.success).not.toHaveBeenCalled();
  });
});
