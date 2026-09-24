/**
 * @fileoverview ΑΓΚΥΡΑ — **φύλλο κοινοποίησης στην αφή, αντιγραφή στο ποντίκι, και η ακύρωση δεν είναι αντιγραφή**
 * (ADR-777 §8.78 · `lib/share-utils.ts` `shareOrCopyLink`).
 *
 *   Κ1 · αφή + API ⇒ φύλλο του λειτουργικού, καμία αντιγραφή.
 *   Κ2 · «Άκυρο» στο φύλλο (`AbortError`) ⇒ `cancelled`, ΚΑΜΙΑ αντιγραφή.
 *   Κ3 · άρνηση του φύλλου (όχι ακύρωση) ⇒ αντιγραφή.
 *   Κ4 · ποντίκι ⇒ αντιγραφή ακόμη κι αν υπάρχει το API (Google Maps «Copy link»).
 *   Κ5 · `canShare` λέει όχι ⇒ αντιγραφή.
 *   Κ6 · το πρόχειρο αρνείται ⇒ `failed`.
 *
 * @jest-environment jsdom
 */

import { shareOrCopyLink } from '../share-utils';

const DATA = { title: 'Διαμέρισμα', url: 'https://nestorconstruct.gr/search/results?selected=pl_1' };

function setup({ coarse, share, canShare, writeText }: {
  coarse: boolean;
  share?: jest.Mock;
  canShare?: (data: unknown) => boolean;
  writeText?: jest.Mock;
}) {
  const clipboardWrite = writeText ?? jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: coarse && query === '(pointer: coarse)' }),
  });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboardWrite } });
  if (share) Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  else delete (navigator as { share?: unknown }).share;
  if (canShare) Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });
  else delete (navigator as { canShare?: unknown }).canShare;
  return clipboardWrite;
}

describe('shareOrCopyLink (ADR-777 §8.78)', () => {
  it('Κ1 · αφή + API ⇒ φύλλο του λειτουργικού, καμία αντιγραφή', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    const write = setup({ coarse: true, share });
    await expect(shareOrCopyLink(DATA)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: DATA.title, url: DATA.url });
    expect(write).not.toHaveBeenCalled();
  });

  it('Κ2 · «Άκυρο» ⇒ cancelled, ΚΑΜΙΑ αντιγραφή (όχι «αντιγράφηκε» σε κάποιον που είπε όχι)', async () => {
    const share = jest.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'));
    const write = setup({ coarse: true, share });
    await expect(shareOrCopyLink(DATA)).resolves.toBe('cancelled');
    expect(write).not.toHaveBeenCalled();
  });

  it('Κ3 · άρνηση του φύλλου (όχι ακύρωση) ⇒ αντιγραφή', async () => {
    const share = jest.fn().mockRejectedValue(new DOMException('policy', 'NotAllowedError'));
    const write = setup({ coarse: true, share });
    await expect(shareOrCopyLink(DATA)).resolves.toBe('copied');
    expect(write).toHaveBeenCalledWith(DATA.url);
  });

  it('Κ4 · ποντίκι ⇒ αντιγραφή με ένα κλικ, ακόμη κι αν υπάρχει το API', async () => {
    const share = jest.fn();
    const write = setup({ coarse: false, share });
    await expect(shareOrCopyLink(DATA)).resolves.toBe('copied');
    expect(share).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith(DATA.url);
  });

  it('Κ5 · το canShare λέει όχι ⇒ αντιγραφή', async () => {
    const share = jest.fn();
    const write = setup({ coarse: true, share, canShare: () => false });
    await expect(shareOrCopyLink(DATA)).resolves.toBe('copied');
    expect(share).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalled();
  });

  it('Κ6 · το πρόχειρο αρνείται ⇒ failed', async () => {
    setup({ coarse: false, writeText: jest.fn().mockRejectedValue(new Error('denied')) });
    await expect(shareOrCopyLink(DATA)).resolves.toBe('failed');
  });
});
