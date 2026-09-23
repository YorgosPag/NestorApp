/**
 * @jest-environment node
 *
 * Άγκυρα — **Ο ΑΝΩΝΥΜΟΣ ΓΥΡΝΑ ΕΚΕΙ ΠΟΥ ΖΗΤΗΣΕ, ΟΧΙ ΣΤΟ ΤΑΜΠΛΟ** (ADR-848 §9 #3 · ADR-875 §14)
 *
 * Το layout του `/o/[workspace]` δεν βλέπει τη διαδρομή του αιτήματος· τη φέρνει το
 * middleware ως κεφαλίδα αιτήματος, και ο φρουρός ζητά `loginHrefForRequest()`.
 *
 * | # | ισχυρισμός | η μετάλλαξη που το σπάει |
 * |---|---|---|
 * | Δ1 | ο writer βάζει `pathname + search` και **γράφει πάνω** σε πλαστή τιμή | `append` αντί `set` · μόνο `pathname` |
 * | Δ2 | το **πραγματικό** middleware προωθεί την κεφαλίδα στο αίτημα | `NextResponse.next()` χωρίς `request.headers` |
 * | Δ3 | ο reader δίνει `/login?next=<διαδρομή>` — και σκέτο `/login` χωρίς κεφαλίδα | ωμό `AUTH_ROUTES.login` |
 * | Δ4 | ο reader **δεν** ανοίγει ανακατεύθυνση προς ξένο origin | παράκαμψη του `loginHref` |
 * | Δ5 | κανένας φρουρός διακομιστή κάτω από `/o/[workspace]` δεν στέλνει σε σκέτη σύνδεση | επιστροφή στο `redirect(AUTH_ROUTES.login, …)` |
 *
 * ⚠️ Το Δ2 διαβάζει το `x-middleware-request-*` — τη μεταφορά που **καταναλώνει** το
 *    Next για να ξαναχτίσει το αίτημα. Αναβάθμιση που την αλλάζει ⇒ κόκκινο εδώ,
 *    όχι σιωπηλή απώλεια της επιστροφής στην παραγωγή. Τη ζωντανή απόδειξη τη δίνει
 *    ο δίδυμος του χρησμού (CHECK 3.51 Χ, `guard-return-lost`).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { REQUEST_PATH_HEADER, withRequestPath } from '../request-path';

const mockHeaderValue: { current: string | null } = { current: null };

jest.mock('server-only', () => ({}));
jest.mock('next/headers', () => ({
  headers: async () => new Headers(mockHeaderValue.current === null ? {} : { [REQUEST_PATH_HEADER]: mockHeaderValue.current }),
}));

describe('Δ1 — ο writer', () => {
  it('βάζει pathname + search, και γράφει ΠΑΝΩ σε ό,τι έστειλε ο πελάτης', async () => {
    const { NextRequest } = await import('next/server');
    const request = new NextRequest('https://nestorconstruct.gr/o/acme/projects/p1?tab=files', {
      headers: { [REQUEST_PATH_HEADER]: '//evil.example' },
    });

    const forwarded = withRequestPath(request);

    expect(forwarded.get(REQUEST_PATH_HEADER)).toBe('/o/acme/projects/p1?tab=files');
    // Αντίγραφο, όχι μετάλλαξη του αιτήματος.
    expect(request.headers.get(REQUEST_PATH_HEADER)).toBe('//evil.example');
  });
});

describe('Δ2 — το πραγματικό middleware', () => {
  it('προωθεί τη διαδρομή ως κεφαλίδα ΑΙΤΗΜΑΤΟΣ (όχι απόκρισης)', async () => {
    const { NextRequest } = await import('next/server');
    const { middleware } = await import('@/middleware');

    const response = middleware(new NextRequest('https://nestorconstruct.gr/o/acme/contacts?q=x', {
      headers: { 'user-agent': 'Mozilla/5.0', [REQUEST_PATH_HEADER]: '/spoofed' },
    }));

    expect(response.headers.get('x-middleware-override-headers')).toContain(REQUEST_PATH_HEADER);
    expect(response.headers.get(`x-middleware-request-${REQUEST_PATH_HEADER}`)).toBe('/o/acme/contacts?q=x');
    // Η απόκριση προς τον φυλλομετρητή ΔΕΝ φέρει τη διαδρομή.
    expect(response.headers.get(REQUEST_PATH_HEADER)).toBeNull();
  });
});

describe('Δ3/Δ4 — ο reader του διακομιστή', () => {
  afterEach(() => {
    mockHeaderValue.current = null;
  });

  it('Δ3: σύνδεση ΜΕ επιστροφή στη διαδρομή του αιτήματος', async () => {
    mockHeaderValue.current = '/o/acme/projects/p1?tab=files';
    const { loginHrefForRequest } = await import('@/server/auth/login-return');

    const href = await loginHrefForRequest();
    const parsed = new URL(href, 'https://x.invalid');

    expect(parsed.pathname).toBe('/login');
    expect(parsed.searchParams.get('next')).toBe('/o/acme/projects/p1?tab=files');
  });

  it('Δ3: χωρίς κεφαλίδα ⇒ σκέτο /login, ποτέ σφάλμα', async () => {
    const { loginHrefForRequest } = await import('@/server/auth/login-return');
    expect(await loginHrefForRequest()).toBe('/login');
  });

  it('Δ4: ξένο origin στην κεφαλίδα ⇒ σκέτο /login (ο φρουρός του ADR-848 κρίνει)', async () => {
    mockHeaderValue.current = '//evil.example/steal';
    const { loginHrefForRequest } = await import('@/server/auth/login-return');
    expect(await loginHrefForRequest()).toBe('/login');
  });
});

describe('Δ5 — η κλάση, όχι το δείγμα', () => {
  const ROOT = path.join(__dirname, '..', '..', '..', 'app', '(app)', 'o', '[workspace]');

  function serverFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return serverFiles(full);
      if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\./.test(entry.name)) return [];
      const text = fs.readFileSync(full, 'utf8');
      return /^\s*['"]use client['"]/m.test(text) ? [] : [full];
    });
  }

  it('κανένας φρουρός διακομιστή δεν στέλνει σε σύνδεση ΧΩΡΙΣ επιστροφή', () => {
    const files = serverFiles(ROOT);
    // Φράχτης ενάντια στο κενό σύμπαν: «0 παραβάσεις σε 0 αρχεία» δεν είναι απόδειξη.
    //    Μετρημένο 2026-09-23: 41 αρχεία διακομιστή· οι δύο γνωστοί φρουροί ΟΝΟΜΑΣΤΙΚΑ μέσα.
    expect(files.length).toBeGreaterThan(30);
    expect(files.map((file) => path.relative(ROOT, file).split(path.sep).join('/'))).toEqual(
      expect.arrayContaining(['layout.tsx', 'procurement/analytics/page.tsx']),
    );

    const offenders = files.filter((file) => /redirect\(\s*AUTH_ROUTES\.login\b/.test(fs.readFileSync(file, 'utf8')));
    expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([]);

    const layout = fs.readFileSync(path.join(ROOT, 'layout.tsx'), 'utf8');
    expect(layout).toMatch(/redirect\(await loginHrefForRequest\(\), workspace\)/);
  });
});
