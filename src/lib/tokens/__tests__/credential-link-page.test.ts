/**
 * @fileoverview Η ΑΓΚΥΡΑ ΤΗΣ ΚΛΑΣΗΣ «ΔΙΕΥΘΥΝΣΗ = ΔΙΑΠΙΣΤΕΥΤΗΡΙΟ» (ADR-876).
 * @related lib/tokens/credential-link-page · lib/workspace/workspace-scope · subapps/procurement/services/vendor-portal-links
 *
 * 🔴 **Τα ευρήματα που κλειδώνει** (μετρημένα 2026-09-23):
 *   Ε1/Ε2 — η πύλη προμηθευτή και το check-in παρουσιών ζούσαν στο `/o/[workspace]` ⇒ ο
 *           παραλήπτης (χωρίς λογαριασμό) έπεφτε στο `/login`. Καμία δοκιμή δεν το ρωτούσε.
 *   Ε3    — ο σύνδεσμος άρνησης έδειχνε σε διαδρομή ΧΩΡΙΣ σελίδα.
 *   Ε6    — 11 σελίδες με token, δηλώσεις γραμμένες με το χέρι: `no-referrer` στις 4,
 *           τίποτα στις 2 `'use client'`.
 *
 * ⚠️ Ο κατάλογος διαδρομών είναι το `enumerateRoutes` του χρησμού 3.51 — το ΙΔΙΟ που διαβάζει
 *    και το `route-catalogue-anchor`. Δεύτερος walker του `src/app` θα μπορούσε να διαφωνήσει.
 */

import fs from 'fs';
import path from 'path';

import { CREDENTIAL_LINK_PAGE_METADATA } from '../credential-link-page';
import { isInsideWorkspace } from '@/lib/workspace/workspace-scope';

interface OracleRoute {
  readonly file: string;
  readonly template: string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const oracle = require('scripts/lib/i18n-ssr/oracle') as { enumerateRoutes(root: string): OracleRoute[] };

const ROOT = path.join(__dirname, '..', '..', '..', '..');
const APP_DIR = path.join(ROOT, 'src', 'app');
const TOKEN_SEGMENT = '[token]';

const read = (file: string): string => fs.readFileSync(file, 'utf8');
const tokenRoutes = (): OracleRoute[] =>
  oracle.enumerateRoutes(ROOT).filter((route) => route.template.split('/').includes(TOKEN_SEGMENT));

/** Η σελίδα **ή** ένα layout-πρόγονος μέσα στο `src/app` — εκεί όπου server αρχείο μπορεί να δηλώσει. */
function declarers(pageFile: string): string[] {
  const out = [pageFile];
  for (let dir = path.dirname(pageFile); dir.startsWith(APP_DIR) && dir !== APP_DIR; dir = path.dirname(dir)) {
    const layout = path.join(dir, 'layout.tsx');
    if (fs.existsSync(layout)) out.push(layout);
  }
  return out.filter((file) => !/^\s*['"]use client['"]/.test(read(file)));
}

const FORCE_DYNAMIC = /export const dynamic = 'force-dynamic'/;
const USES_SSOT = /export const metadata: Metadata = CREDENTIAL_LINK_PAGE_METADATA;/;

describe('ADR-876 — σελίδες όπου η διεύθυνση είναι διαπιστευτήριο', () => {
  test('Π0 — ο ανιχνευτής ΔΕΝ είναι τυφλός: βρίσκει τις γνωστές σελίδες', () => {
    const templates = tokenRoutes().map((route) => route.template);
    expect(templates).toEqual(
      expect.arrayContaining(['/mandate/[token]', '/attendance/check-in/[token]', '/shared/[token]', '/invite/[token]']),
    );
    // 11 → 10: η `/vendor/quote/[token]` αποσύρθηκε στη Φ7 (ADR-876 §5) — το διαπιστευτήριο ζει στο fragment.
    expect(templates.length).toBeGreaterThanOrEqual(10);
  });

  test('Π1 — 🔴 ΚΑΜΙΑ σελίδα με token ΜΕΣΑ στον χώρο: ο παραλήπτης δεν έχει λογαριασμό', () => {
    const inside = tokenRoutes().filter((route) => route.template.startsWith('/o/') || isInsideWorkspace(route.template));
    expect(inside.map((route) => route.template)).toEqual([]);
  });

  test('Π2 — ΚΑΘΕ σελίδα με token παίρνει τις δηλώσεις από το ΕΝΑ SSoT (σελίδα ή layout-πρόγονος)', () => {
    const missing: string[] = [];
    for (const route of tokenRoutes()) {
      const sources = declarers(path.join(ROOT, route.file)).map(read);
      if (!sources.some((source) => USES_SSOT.test(source))) missing.push(`${route.template} · metadata`);
      if (!sources.some((source) => FORCE_DYNAMIC.test(source))) missing.push(`${route.template} · force-dynamic`);
    }
    expect(missing).toEqual([]);
  });

  test('Π3 — ΚΑΝΕΝΑ χειρόγραφο αντίγραφο: `no-referrer` γράφεται ΜΟΝΟ στο SSoT', () => {
    const copies = tokenRoutes()
      .flatMap((route) => declarers(path.join(ROOT, route.file)))
      // Μόνο ΚΩΔΙΚΑΣ (γραμμή που αρχίζει με το κλειδί) — η τεκμηρίωση που εξηγεί το γιατί δεν είναι αντίγραφο.
      .filter((file) => /^\s*referrer:\s*'no-referrer'/m.test(read(file)));
    expect(copies).toEqual([]);
  });

  test('Π4 — το SSoT λέει ό,τι υπόσχεται', () => {
    expect(CREDENTIAL_LINK_PAGE_METADATA).toEqual({ robots: { index: false, follow: false }, referrer: 'no-referrer' });
  });
});

describe('ADR-876 Ε3 — ο σύνδεσμος άρνησης οδηγεί σε ΣΕΛΙΔΑ, και δεν αρνείται μόνος του', () => {
  const ORIGIN = 'https://nestor.example';
  const saved = process.env.NEXT_PUBLIC_APP_URL;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = ORIGIN;
  });
  afterAll(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = saved;
  });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const links = (): typeof import('@/subapps/procurement/services/vendor-portal-links') => require('@/subapps/procurement/services/vendor-portal-links');

  test('Α1 — η άρνηση = η ΙΔΙΑ σελίδα της πύλης, με πρόθεση στο fragment', () => {
    const decline = new URL(links().vendorDeclineUrl('t.a-1_b'));
    const portal = new URL(links().vendorPortalUrl('t.a-1_b'));
    expect(decline.pathname).toBe(portal.pathname);
    expect(decline.pathname).toBe('/vendor/quote');
    expect(links().readVendorPortalFragment(decline.hash)).toEqual({ token: 't.a-1_b', intent: 'decline' });
  });

  test('Α2 — η σελίδα της πύλης ΥΠΑΡΧΕΙ στον δίσκο, εκτός χώρου· καμία σελίδα `…/decline`', () => {
    const templates = oracle.enumerateRoutes(ROOT).map((route) => route.template);
    expect(templates).toContain('/vendor/quote');
    expect(templates).not.toContain('/vendor/quote/[token]/decline');
    expect(isInsideWorkspace('/vendor/quote')).toBe(false);
  });

  // Φ7: η ΜΟΝΗ είσοδος πρόθεσης είναι το fragment (η ανακατεύθυνση `?intent=` της παλιάς σελίδας αποσύρθηκε).
  test.each([
    ['σκουπίδι', '#t=x&intent=delete'],
    ['κεφαλαία', '#t=x&intent=DECLINE'],
    ['κενό', '#t=x&intent='],
    ['απουσία', '#t=x'],
  ])('Α3 — %s ⇒ καμία πρόθεση, το διαπιστευτήριο μένει', (_label, hash) => {
    expect(links().readVendorPortalFragment(hash)).toEqual({ token: 'x', intent: null });
  });

  test('Α4 — οι σελίδες της πύλης ΔΕΝ γράφουν: η άρνηση φεύγει μόνο από POST (Safe Links ανοίγουν κάθε GET)', () => {
    const page = read(path.join(APP_DIR, '(auth)', 'vendor', 'quote', 'page.tsx'));
    expect(page).not.toMatch(/markInvite|markUsed|revokeVendor|runTransaction|getAdminFirestore|resolveVendorInvite/);
  });
});

/**
 * 🔑 **ADR-876 §5 — «ένας σύνδεσμος = ένα διαπιστευτήριο» και το διαπιστευτήριο ΕΚΤΟΣ διεύθυνσης.**
 *
 * Κ-α το έγγραφο πρόσκλησης (που διαβάζει κάθε μέλος) δεν έχει πεδίο `token` ·
 * Κ-β ο σύνδεσμος του email κουβαλά το διαπιστευτήριο ΜΟΝΟ στο fragment (ποτέ σε διαδρομή/query) ·
 * Κ-γ κανένα αίτημα του client δεν βάζει το διαπιστευτήριο σε URL — μόνο `Authorization` ·
 * Κ-δ η σελίδα `/vendor/quote` (χωρίς `[token]`) φοράει κι αυτή τις δηλώσεις σελίδας-διαπιστευτηρίου ·
 * Κ-ε κανένα δημόσιο API της πύλης δεν ζει κάτω από `[token]` ·
 * Κ-ζ (Φ7) ΜΙΑ μορφή διεύθυνσης: καμία σελίδα της πύλης με το διαπιστευτήριο σε διαδρομή.
 */
describe('ADR-876 §5 — το διαπιστευτήριο εκτός διεύθυνσης και εκτός εγγράφου πρόσκλησης', () => {
  const ORIGIN = 'https://nestor.example';
  const saved = process.env.NEXT_PUBLIC_APP_URL;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = ORIGIN;
  });
  afterAll(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = saved;
  });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const links = (): typeof import('@/subapps/procurement/services/vendor-portal-links') => require('@/subapps/procurement/services/vendor-portal-links');
  const PORTAL_DIR = path.join(APP_DIR, '(auth)', 'vendor', 'quote');

  test('Κ-α — το `VendorInvite` ΔΕΝ δηλώνει πεδίο `token`', () => {
    const source = read(path.join(ROOT, 'src', 'subapps', 'procurement', 'types', 'vendor-invite.ts'));
    const body = source.slice(source.indexOf('export interface VendorInvite {'));
    expect(body.slice(0, body.indexOf('\n}'))).not.toMatch(/^\s*token\s*:/m);
  });

  test('Κ-β — το διαπιστευτήριο ΜΟΝΟ στο fragment', () => {
    const SECRET_LIKE = 'CRED.value-1_x';
    const url = new URL(links().vendorDeclineUrl(SECRET_LIKE));
    expect(url.pathname).not.toContain(SECRET_LIKE);
    expect(url.search).toBe('');
    expect(links().readVendorPortalFragment(url.hash).token).toBe(SECRET_LIKE);
  });

  test('Κ-γ — κανένα αίτημα του client με το διαπιστευτήριο σε URL', () => {
    const clientFiles = fs.readdirSync(PORTAL_DIR).filter((f) => /\.tsx?$/.test(f)).map((f) => read(path.join(PORTAL_DIR, f)));
    for (const source of clientFiles) {
      expect(source).not.toMatch(/\/api\/vendor\/quote\/\$\{/);
      expect(source).not.toMatch(/encodeURIComponent\(token\)/);
    }
    expect(read(path.join(PORTAL_DIR, 'vendor-portal-api.ts'))).toMatch(/Authorization: `Bearer \$\{token\}`/);
  });

  test('Κ-δ — η `/vendor/quote` φοράει SSoT metadata + force-dynamic', () => {
    const page = read(path.join(PORTAL_DIR, 'page.tsx'));
    expect(page).toMatch(USES_SSOT);
    expect(page).toMatch(FORCE_DYNAMIC);
  });

  test('Κ-ε — κανένα δημόσιο API της πύλης κάτω από `[token]`', () => {
    const apiTemplates = fs.existsSync(path.join(APP_DIR, 'api', 'vendor', 'quote', TOKEN_SEGMENT));
    expect(apiTemplates).toBe(false);
  });

  test('Κ-ζ — Φ7: η πύλη έχει ΜΙΑ διεύθυνση — καμία σελίδα κάτω από `/vendor/quote/<δυναμικό>`', () => {
    const templates = oracle.enumerateRoutes(ROOT).map((route) => route.template);
    expect(templates.filter((template) => template.startsWith('/vendor/quote/'))).toEqual([]);
    expect(templates).toContain('/vendor/quote');
  });
});
