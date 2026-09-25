/**
 * @fileoverview ΑΓΚΥΡΑ — **«Δημιουργία & αντιγραφή»: η χειρονομία δεν χάνεται στο `await`**
 * (ADR-315 Α11 · `lib/share-utils.ts` `copyDeferredText`).
 *
 *   Κ1 · υπάρχει Promise-`ClipboardItem` ⇒ `clipboard.write` καλείται **συγχρόνως**, πριν λυθεί το κείμενο.
 *   Κ2 · δεν υπάρχει `ClipboardItem` (Firefox) ⇒ `await` + `writeText`.
 *   Κ3 · ο browser αρνείται το Promise-item ⇒ πέφτει στο `writeText`.
 *   Κ4 · απέτυχε η **δημιουργία** ⇒ η απόρριψη διαδίδεται (δεν είναι «απέτυχε η αντιγραφή»).
 *
 * @jest-environment jsdom
 */

import { copyDeferredText } from '../share-utils';

class FakeClipboardItem {
  static supports = (): boolean => true;
  constructor(public readonly items: Record<string, Promise<Blob>>) {}
}

function setup({ withItem, write }: { withItem: boolean; write?: jest.Mock }) {
  const writeText = jest.fn().mockResolvedValue(undefined);
  const clipboardWrite = write ?? jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText, write: clipboardWrite } });
  const scope = globalThis as { ClipboardItem?: unknown };
  if (withItem) scope.ClipboardItem = FakeClipboardItem;
  else delete scope.ClipboardItem;
  return { writeText, clipboardWrite };
}

function deferred() {
  let resolve: (value: string) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('copyDeferredText (ADR-315 Α11)', () => {
  it('Κ1 · γράφει ΣΥΓΧΡΟΝΩΣ με Promise-ClipboardItem — πριν λυθεί ο σύνδεσμος', async () => {
    const { clipboardWrite, writeText } = setup({ withItem: true });
    const url = deferred();

    const done = copyDeferredText(url.promise);
    expect(clipboardWrite).toHaveBeenCalledTimes(1);
    url.resolve('https://nestorconstruct.gr/shared/abc');

    await expect(done).resolves.toBe(true);
    const item = (clipboardWrite.mock.calls[0]?.[0] as FakeClipboardItem[])[0];
    await expect(item?.items['text/plain']?.then((blob) => blob.text())).resolves.toBe('https://nestorconstruct.gr/shared/abc');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('Κ2 · χωρίς ClipboardItem ⇒ await + writeText', async () => {
    const { writeText } = setup({ withItem: false });

    await expect(copyDeferredText(Promise.resolve('u'))).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('u');
  });

  it('Κ3 · άρνηση του Promise-item ⇒ writeText', async () => {
    const { writeText } = setup({ withItem: true, write: jest.fn().mockRejectedValue(new Error('NotAllowedError')) });

    await expect(copyDeferredText(Promise.resolve('u'))).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('u');
  });

  it('Κ4 · απέτυχε η δημιουργία ⇒ η απόρριψη διαδίδεται', async () => {
    setup({ withItem: true, write: jest.fn((items: FakeClipboardItem[]) => items[0]?.items['text/plain']) });

    await expect(copyDeferredText(Promise.reject(new Error('forbidden')))).rejects.toThrow('forbidden');
  });
});
