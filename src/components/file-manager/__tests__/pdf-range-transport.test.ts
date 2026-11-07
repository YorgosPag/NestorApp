/**
 * ADR-923 §5.15.2 (Θ.2α-1) — κομμάτια PDF με ανανεώσιμη άδεια.
 *
 * 🔴 Τι φυλάει: (α) ποτέ σιωπηλή πλήρης λήψη (200 αντί για 206)· (β) η λήξη της άδειας των 15′ δεν σταματά την ανάγνωση·
 *    (γ) δέκα κομμάτια στη λήξη ⇒ ΜΙΑ ανανέωση· (δ) αποτυχία κομματιού ⇒ ρητό σφάλμα, όχι αιώνια αναμονή του pdf.js·
 *    (ε) το URL (η άδεια) δεν εμφανίζεται ποτέ σε μήνυμα σφάλματος.
 */

/* global describe, it, expect, jest, beforeEach */

import type { PDFDataRangeTransport } from 'pdfjs-dist';

import {
  fetchPdfRange,
  LICENSE_RENEW_MARGIN_MS,
  openLicensedPdfTransport,
  PdfLicenseLease,
  PdfRangeError,
  type PdfReadLicense,
} from '../pdf-range-transport';

const TOTAL = 1_000_000;
/** Το «σήμα» της άδειας μέσα στο URL — δεν πρέπει να εμφανιστεί ποτέ σε μήνυμα σφάλματος. */
const LICENSE_MARK = 'sig-mark-7f3a';

function license(n: number, expiresAt: number): PdfReadLicense {
  return { url: `https://storage.googleapis.com/b/edition.pdf?n=${n}&Signature=${LICENSE_MARK}`, expiresAt };
}

function partial(begin: number, end: number): Response {
  return {
    status: 206,
    headers: { get: (name: string) => (name === 'Content-Range' ? `bytes ${begin}-${end}/${TOTAL}` : null) },
    arrayBuffer: async () => new Uint8Array(end - begin + 1).buffer,
  } as unknown as Response;
}

function status(code: number): Response {
  return { status: code, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) } as unknown as Response;
}

function rangeOf(init: RequestInit | undefined): [number, number] {
  const header = (init?.headers as Record<string, string>).Range;
  const [, begin, end] = /bytes=(\d+)-(\d+)/.exec(header) ?? [];
  return [Number(begin), Number(end)];
}

/** Ο κάδος: 206 για κάθε άδεια εκτός από όσες έχουν «λήξει». */
function bucket(expiredUrls: Set<string> = new Set()) {
  return jest.fn(async (url: string, init?: RequestInit) => {
    if (expiredUrls.has(url)) return status(403);
    const [begin, end] = rangeOf(init);
    return partial(begin, end);
  });
}

const clockAt = (now: number) => ({ now: () => now });

describe('pdf-range-transport', () => {
  beforeEach(() => {
    global.fetch = bucket() as unknown as typeof fetch;
  });

  describe('Α — το κομμάτι', () => {
    it('🔴 Α1: ζητά ακριβώς [begin, end) με Range και χωρίς cookie', async () => {
      const lease = new PdfLicenseLease(async () => license(1, Date.now() + 900_000), new AbortController().signal);
      const range = await fetchPdfRange(lease, 100, 200, new AbortController().signal);
      const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
      expect(rangeOf(init)).toEqual([100, 199]);
      expect(init.credentials).toBe('omit');
      expect(range.bytes.byteLength).toBe(100);
      expect(range.total).toBe(TOTAL);
    });

    it('🔴 Α2: 200 (ολόκληρο αρχείο) ⇒ σφάλμα, ποτέ σιωπηλή πλήρης λήψη', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(status(200));
      const lease = new PdfLicenseLease(async () => license(1, Date.now() + 900_000), new AbortController().signal);
      await expect(fetchPdfRange(lease, 0, 10, new AbortController().signal)).rejects.toMatchObject({ reason: 'not-partial' });
    });

    it('✅ Α3: Content-Range που δεν ξεκινά από το begin ⇒ σφάλμα', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(partial(0, 9));
      const lease = new PdfLicenseLease(async () => license(1, Date.now() + 900_000), new AbortController().signal);
      await expect(fetchPdfRange(lease, 5, 15, new AbortController().signal)).rejects.toMatchObject({ reason: 'content-range' });
    });

    it('🔴 Α4: το μήνυμα σφάλματος δεν περιέχει ποτέ την άδεια', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(status(500));
      const lease = new PdfLicenseLease(async () => license(1, Date.now() + 900_000), new AbortController().signal);
      const error = await fetchPdfRange(lease, 0, 10, new AbortController().signal).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PdfRangeError);
      expect(String((error as Error).message)).not.toContain(LICENSE_MARK);
    });
  });

  describe('Β — η άδεια', () => {
    it('🔴 Β1: 403 (ληγμένη) ⇒ μία ανανέωση και επανάληψη με τη ΝΕΑ άδεια', async () => {
      const first = license(1, Date.now() + 900_000);
      const second = license(2, Date.now() + 900_000);
      global.fetch = bucket(new Set([first.url])) as unknown as typeof fetch;
      const issue = jest.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
      const lease = new PdfLicenseLease(issue, new AbortController().signal);
      await fetchPdfRange(lease, 0, 10, new AbortController().signal);
      expect(issue).toHaveBeenCalledTimes(2);
      expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe(second.url);
    });

    it('✅ Β2: δεύτερο 403 ⇒ σφάλμα (καμία ατέρμονη ανανέωση)', async () => {
      global.fetch = jest.fn(async () => status(403)) as unknown as typeof fetch;
      const lease = new PdfLicenseLease(async () => license(1, Date.now() + 900_000), new AbortController().signal);
      await expect(fetchPdfRange(lease, 0, 10, new AbortController().signal)).rejects.toMatchObject({ reason: 'http', status: 403 });
    });

    it('🔴 Β3: λίγο πριν τη λήξη ⇒ προληπτική ανανέωση, χωρίς να περιμένει 403', async () => {
      let now = 0;
      const issue = jest.fn(async () => license(1, now + 900_000));
      const lease = new PdfLicenseLease(issue, new AbortController().signal, { now: () => now });
      await lease.current();
      now = 900_000 - LICENSE_RENEW_MARGIN_MS;
      await lease.current();
      expect(issue).toHaveBeenCalledTimes(2);
    });

    it('🔴 Β4: δέκα κομμάτια στη λήξη ⇒ ΜΙΑ ανανέωση (single-flight)', async () => {
      const issue = jest.fn(async () => license(1, 900_000));
      const lease = new PdfLicenseLease(issue, new AbortController().signal, clockAt(0));
      await Promise.all(Array.from({ length: 10 }, () => lease.current()));
      expect(issue).toHaveBeenCalledTimes(1);
    });

    it('✅ Β5: απόρριψη από την πόρτα κρίσης (αποσυρμένη έκδοση) ⇒ σφάλμα «license»', async () => {
      const lease = new PdfLicenseLease(async () => { throw new Error('404'); }, new AbortController().signal);
      await expect(lease.current()).rejects.toMatchObject({ reason: 'license' });
    });
  });

  describe('Γ — το transport του pdf.js', () => {
    class FakeRangeTransport {
      readonly received: Array<[number, Uint8Array | null]> = [];
      constructor(readonly length: number, readonly initialData: Uint8Array | null) {}
      onDataRange(begin: number, chunk: Uint8Array | null): void { this.received.push([begin, chunk]); }
      requestDataRange(): void { /* η υποκλάση */ }
      abort(): void { /* η υποκλάση */ }
    }
    const Base = FakeRangeTransport as unknown as typeof PDFDataRangeTransport;
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    it('🔴 Γ1: μήκος από την Content-Range του πρώτου κομματιού + αρχικά δεδομένα', async () => {
      const { transport } = await openLicensedPdfTransport(Base, async () => license(1, Date.now() + 900_000), jest.fn());
      expect(transport.length).toBe(TOTAL);
      expect(transport.initialData?.byteLength).toBeGreaterThan(0);
    });

    it('🔴 Γ2: requestDataRange ⇒ onDataRange(begin, bytes)', async () => {
      const { transport } = await openLicensedPdfTransport(Base, async () => license(1, Date.now() + 900_000), jest.fn());
      transport.requestDataRange(500_000, 600_000);
      await flush();
      const received = (transport as unknown as FakeRangeTransport).received;
      expect(received).toHaveLength(1);
      expect(received[0][0]).toBe(500_000);
      expect(received[0][1]?.byteLength).toBe(100_000);
    });

    it('🔴 Γ3: αποτυχία κομματιού ⇒ onFailure (το pdf.js αλλιώς θα περίμενε για πάντα)', async () => {
      const onFailure = jest.fn();
      const { transport } = await openLicensedPdfTransport(Base, async () => license(1, Date.now() + 900_000), onFailure);
      (global.fetch as jest.Mock).mockResolvedValueOnce(status(500));
      transport.requestDataRange(0, 10);
      await flush();
      expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({ reason: 'http', status: 500 }));
    });

    it('✅ Γ4: μετά το dispose κανένα δεδομένο και κανένα σφάλμα', async () => {
      const onFailure = jest.fn();
      const { transport, dispose } = await openLicensedPdfTransport(Base, async () => license(1, Date.now() + 900_000), onFailure);
      dispose();
      transport.requestDataRange(0, 10);
      await flush();
      expect((transport as unknown as FakeRangeTransport).received).toHaveLength(0);
      expect(onFailure).not.toHaveBeenCalled();
    });
  });
});
