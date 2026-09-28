/**
 * ADR-884 Φ2στ-γ Γ2 — η κάτοψη αλλάζει παράγωγο χωρίς να αναβοσβήσει: η παλιά εικόνα μένει ώσπου η νέα να αποκωδικοποιηθεί.
 */

import { act, renderHook } from '@testing-library/react';

import { useDecodedImageUrl } from '../useDecodedImageUrl';

describe('useDecodedImageUrl', () => {
  const realDecode = HTMLImageElement.prototype.decode;
  let release: () => void = () => undefined;
  let fail = false;

  beforeEach(() => {
    fail = false;
    HTMLImageElement.prototype.decode = function decode() {
      return new Promise<void>((resolve, reject) => { release = () => (fail ? reject(new Error('404')) : resolve()); });
    };
  });
  afterAll(() => { HTMLImageElement.prototype.decode = realDecode; });

  it('πρώτη διεύθυνση: αμέσως · νέα διεύθυνση: η ΠΑΛΙΑ ώσπου να αποκωδικοποιηθεί η νέα', async () => {
    const { result, rerender } = renderHook(({ url }) => useDecodedImageUrl(url), { initialProps: { url: 'w1024' } });
    expect(result.current).toBe('w1024');
    rerender({ url: 'w2048' });
    expect(result.current).toBe('w1024');
    await act(async () => { release(); });
    expect(result.current).toBe('w2048');
  });

  it('σφάλμα αποκωδικοποίησης ⇒ περνά η νέα (ποτέ «κολλημένη» παλιά εικόνα)', async () => {
    const { result, rerender } = renderHook(({ url }) => useDecodedImageUrl(url), { initialProps: { url: 'a' } });
    rerender({ url: 'b' });
    fail = true;
    await act(async () => { release(); });
    expect(result.current).toBe('b');
  });

  it('`null` ⇒ `null` αμέσως', () => {
    const { result, rerender } = renderHook(({ url }: { url: string | null }) => useDecodedImageUrl(url), { initialProps: { url: 'a' as string | null } });
    rerender({ url: null });
    expect(result.current).toBeNull();
  });
});
