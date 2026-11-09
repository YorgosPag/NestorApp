/**
 * @jest-environment node
 *
 * Tests — Outbound Fetch (ADR-738 · ADR-835 §22 · ADR-934 Μ-β1)
 *
 * Κάθε τεστ περιγράφει τι θα έκανε ένας τρίτος που **δεν** συνεργάζεται: δηλώνει ψέματα στο `content-length`, στέλνει
 * ατελείωτη ροή, ανακατευθύνει σε ιδιωτική διεύθυνση, ή απλώς δεν ακούει στο 443.
 */

jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));

import { lookup } from 'node:dns/promises';

import { fetchGuardedDocument, fetchGuardedStream, OutboundBodyError } from '../outbound-fetch';

const mockLookup = lookup as unknown as jest.Mock;
const mockFetch = jest.fn();

/** Ροή που στέλνει `chunks` κομμάτια των `size` bytes και καταγράφει αν ακυρώθηκε. */
function chunkedBody(chunks: number, size: number): { readonly body: ReadableStream<Uint8Array>; readonly cancelled: () => boolean } {
  let sent = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= chunks) return controller.close();
      sent += 1;
      controller.enqueue(new Uint8Array(size).fill(7));
    },
    cancel() {
      cancelled = true;
    },
  });
  return { body, cancelled: () => cancelled };
}

/**
 * Πηγή που **δεν** έχει τελειώσει όταν ο καλών παίρνει το σώμα (800 bytes σε 100 κομμάτια, κάτω από κάθε όριο εδώ):
 * μόνο σε ανοιχτή πηγή φαίνεται αν η ακύρωση **φτάνει** στη σύνδεση. Μία πηγή του ενός κομματιού την κλείνει ήδη η
 * προανάγνωση της ροής (highWaterMark), και η ακύρωση κλειστής ροής δεν καλεί ποτέ το `cancel` της.
 */
const openSource = (): ReturnType<typeof chunkedBody> => chunkedBody(100, 8);

async function drain(stream: ReadableStream<Uint8Array>): Promise<number> {
  const reader = stream.getReader();
  let total = 0;
  for (let next = await reader.read(); !next.done; next = await reader.read()) total += next.value.byteLength;
  return total;
}

const calledUrls = (): string[] => mockFetch.mock.calls.map(([url]) => String(url));

/**
 * Το συμβόλαιο του `fetchGuardedStream`: ο καλών **διαβάζει ή ακυρώνει** το σώμα — μόνο τότε σβήνουν τα χρονόμετρα
 * (αδράνεια + πράξη) και κλείνει η σύνδεση. Τεστ που το αφήνει ανέγγιχτο κρατά ζωντανούς timers (μετρημένο: ο worker
 * του jest δεν τερμάτιζε). Ελέγχει και ότι η ακύρωση **φτάνει** στη σύνδεση της πηγής.
 */
async function releaseBody(result: Awaited<ReturnType<typeof fetchGuardedStream>>, source: { readonly cancelled: () => boolean }): Promise<void> {
  if (!result.ok || result.notModified) throw new Error('αναμενόταν σώμα');
  await result.body.cancel();
  expect(source.cancelled()).toBe(true);
}

beforeEach(() => {
  mockLookup.mockReset();
  mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe('fetchGuardedStream — όριο μέσα στη ροή', () => {
  it('κόβει τη ροή μόλις ξεπεραστεί το όριο, χωρίς δηλωμένο content-length', async () => {
    const source = chunkedBody(100, 1024);
    mockFetch.mockResolvedValue(new Response(source.body, { status: 200 }));

    const result = await fetchGuardedStream('https://cdn.example/big.bin', { maxBytes: 4096 });
    if (!result.ok || result.notModified) throw new Error('αναμενόταν σώμα');

    await expect(drain(result.body)).rejects.toEqual(new OutboundBodyError('too_large'));
    expect(source.cancelled()).toBe(true);
  });

  it('αρνείται πριν διαβάσει όταν ο τρίτος **δηλώνει** περισσότερα', async () => {
    const source = chunkedBody(1, 10);
    mockFetch.mockResolvedValue(new Response(source.body, { status: 200, headers: { 'content-length': '999999' } }));

    const result = await fetchGuardedStream('https://cdn.example/a.pdf', { maxBytes: 1000 });

    expect(result).toEqual({ ok: false, rejection: 'too_large', status: 200 });
  });

  it('ψευδώς μικρό content-length δεν σώζει τον τρίτο: μετράει ό,τι διαβάζεται', async () => {
    const source = chunkedBody(10, 1000);
    mockFetch.mockResolvedValue(new Response(source.body, { status: 200, headers: { 'content-length': '10' } }));

    const result = await fetchGuardedStream('https://cdn.example/a.pdf', { maxBytes: 2500 });
    if (!result.ok || result.notModified) throw new Error('αναμενόταν σώμα');

    await expect(drain(result.body)).rejects.toBeInstanceOf(OutboundBodyError);
  });

  it('επιστρέφει όλα τα bytes όταν χωρούν, με τα validators', async () => {
    const source = chunkedBody(3, 100);
    mockFetch.mockResolvedValue(
      new Response(source.body, { status: 200, headers: { etag: '"v1"', 'last-modified': 'Mon, 09 Nov 2026 10:00:00 GMT', 'content-type': 'application/pdf' } }),
    );

    const result = await fetchGuardedStream('https://cdn.example/a.pdf', { maxBytes: 1000 });
    if (!result.ok || result.notModified) throw new Error('αναμενόταν σώμα');

    expect(await drain(result.body)).toBe(300);
    expect(result).toMatchObject({ etag: '"v1"', lastModified: 'Mon, 09 Nov 2026 10:00:00 GMT', contentType: 'application/pdf', transport: 'secure' });
  });

  it('304 με conditional GET ⇒ notModified, και στέλνει τα validators', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 304 }));

    const result = await fetchGuardedStream('https://cdn.example/a.pdf', { maxBytes: 1000, ifNoneMatch: '"v1"', ifModifiedSince: 'x' });

    expect(result).toEqual({ ok: true, notModified: true, status: 304, transport: 'secure' });
    const [, init] = mockFetch.mock.calls[0] as [URL, RequestInit];
    expect(init.headers).toMatchObject({ 'if-none-match': '"v1"', 'if-modified-since': 'x' });
  });
});

describe('fetchGuardedStream — αναβάθμιση http → https', () => {
  it('https-only (προεπιλογή): το http απορρίπτεται χωρίς αίτημα', async () => {
    const result = await fetchGuardedStream('http://cdn.example/a.pdf', { maxBytes: 1000 });

    expect(result).toEqual({ ok: false, rejection: 'scheme_not_https', status: null });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('η αναβάθμιση πετυχαίνει ⇒ ένα αίτημα, με https, `secure`', async () => {
    const source = openSource();
    mockFetch.mockResolvedValue(new Response(source.body, { status: 200 }));

    const result = await fetchGuardedStream('http://cdn.example/a.pdf', { maxBytes: 1000, scheme: 'https-upgrade' });

    expect(calledUrls()).toEqual(['https://cdn.example/a.pdf']);
    expect(result).toMatchObject({ ok: true, transport: 'secure' });
    await releaseBody(result, source);
  });

  it('το https αποτυγχάνει στη μεταφορά ⇒ γυρίζει στο http, `insecure`', async () => {
    const source = openSource();
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(new Response(source.body, { status: 200 }));

    const result = await fetchGuardedStream('http://cdn.example/a.pdf', { maxBytes: 1000, scheme: 'https-upgrade' });

    expect(calledUrls()).toEqual(['https://cdn.example/a.pdf', 'http://cdn.example/a.pdf']);
    expect(result).toMatchObject({ ok: true, transport: 'insecure' });
    await releaseBody(result, source);
  });

  it('το https δίνει 404 ⇒ γυρίζει στο http (όπως ο Chrome)', async () => {
    const source = openSource();
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response(source.body, { status: 200 }));

    const result = await fetchGuardedStream('http://cdn.example/a.pdf', { maxBytes: 1000, scheme: 'https-upgrade' });

    expect(result).toMatchObject({ ok: true, transport: 'insecure' });
    await releaseBody(result, source);
  });

  it('η διεύθυνση είναι ιδιωτική ⇒ **δεν** ξαναδοκιμάζει με http', async () => {
    mockLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);

    const result = await fetchGuardedStream('http://intranet.example/a.pdf', { maxBytes: 1000, scheme: 'https-upgrade' });

    expect(result).toEqual({ ok: false, rejection: 'address_not_public', status: null });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('ανακατεύθυνση https → http ⇒ `insecure`', async () => {
    const source = openSource();
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://mirror.example/a.pdf' } }))
      .mockResolvedValueOnce(new Response(source.body, { status: 200 }));

    const result = await fetchGuardedStream('https://cdn.example/a.pdf', { maxBytes: 1000, maxRedirects: 3, scheme: 'https-upgrade' });

    expect(result).toMatchObject({ ok: true, transport: 'insecure' });
    await releaseBody(result, source);
  });
});

describe('επανέλεγχος σε κάθε άλμα', () => {
  it('ανακατεύθυνση σε ιδιωτική IP ⇒ απόρριψη, χωρίς δεύτερο αίτημα', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/admin' } }));

    const result = await fetchGuardedStream('https://cdn.example/a.pdf', { maxBytes: 1000, maxRedirects: 3 });

    expect(result).toEqual({ ok: false, rejection: 'address_not_public', status: null });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('περισσότερες ανακατευθύνσεις από το όριο ⇒ too_many_redirects', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://cdn.example/loop' } }));

    const result = await fetchGuardedStream('https://cdn.example/a.pdf', { maxBytes: 1000, maxRedirects: 2 });

    expect(result).toEqual({ ok: false, rejection: 'too_many_redirects', status: null });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

describe('fetchGuardedDocument — ίδια συμπεριφορά, πλέον με όριο σε ροή', () => {
  it('επιστρέφει το κείμενο', async () => {
    mockFetch.mockResolvedValue(new Response('BEGIN:VCALENDAR', { status: 200, headers: { 'content-type': 'text/calendar' } }));

    const result = await fetchGuardedDocument('https://ota.example/feed.ics', { maxBytes: 1000 });

    expect(result).toMatchObject({ ok: true, notModified: false, body: 'BEGIN:VCALENDAR', contentType: 'text/calendar' });
  });

  it('σώμα πάνω από το όριο χωρίς content-length ⇒ too_large', async () => {
    mockFetch.mockResolvedValue(new Response(chunkedBody(50, 1024).body, { status: 200 }));

    const result = await fetchGuardedDocument('https://ota.example/feed.ics', { maxBytes: 4096 });

    expect(result).toEqual({ ok: false, rejection: 'too_large', status: 200 });
  });

  it('το http μένει απορριπτέο για τα έγγραφα', async () => {
    const result = await fetchGuardedDocument('http://ota.example/feed.ics');

    expect(result).toEqual({ ok: false, rejection: 'scheme_not_https', status: null });
  });
});
