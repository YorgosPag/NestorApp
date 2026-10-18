/**
 * ADR-912 §12.16 — η προφόρτωση του επόμενου PDF είναι το ΙΔΙΟ αίτημα που ζητά ο θεατής.
 */

/* global describe, it, expect, jest, beforeEach */

import { __resetPdfBytesCacheForTests, loadPdfBytes, preloadPdfBytes } from '../pdf-bytes-cache';

const TARGET = { url: '/api/download?fileId=f1', credentials: 'same-origin' as const };

function okResponse(bytes: number[]) {
  return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(bytes).buffer } as unknown as Response;
}

describe('pdf-bytes-cache', () => {
  beforeEach(() => {
    __resetPdfBytesCacheForTests();
    global.fetch = jest.fn(async () => okResponse([1, 2, 3])) as unknown as typeof fetch;
  });

  it('🔴 Β1 — προφόρτωση + άνοιγμα ⇒ ΜΙΑ λήψη', async () => {
    preloadPdfBytes(TARGET);
    const bytes = await loadPdfBytes(TARGET);
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('🔴 Β2 — κάθε ανάγνωση παίρνει ΔΙΚΟ της αντίγραφο (το pdf.js αποσπά τον buffer που του δίνεται)', async () => {
    const first = await loadPdfBytes(TARGET);
    first.fill(0); // ό,τι κάνει ο καταναλωτής στο δικό του αντίγραφο (το pdf.js το αποσπά) δεν αγγίζει τη μνήμη
    expect(Array.from(await loadPdfBytes(TARGET))).toEqual([1, 2, 3]);
  });

  it('✅ Β3 — αποτυχημένη λήψη δεν μένει στη μνήμη: το άνοιγμα ξαναδοκιμάζει', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(loadPdfBytes(TARGET)).rejects.toThrow('HTTP 503');
    expect(Array.from(await loadPdfBytes(TARGET))).toEqual([1, 2, 3]);
  });
});
