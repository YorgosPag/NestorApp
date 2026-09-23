/**
 * @jest-environment node
 *
 * =============================================================================
 * CHECK 3.51 Χ — Ο ΧΡΗΣΜΟΣ ΜΕ ΤΑΥΤΟΤΗΤΑ (ADR-875 · golden tenant)
 * =============================================================================
 *
 * ⚠️ `node`, ΟΧΙ jsdom: στο jsdom το `fetch` αποτυγχάνει και ο χρησμός πέφτει σε
 * `route-unreachable` **για λάθος λόγο** (βλ. `i18n-ssr-probe-fixture.js`).
 *
 * ⚠️ **TypeScript, ΕΠΙΤΗΔΕΣ**: οι άγκυρες Τ1-Τ3 **εκτελούν** τις αυθεντίες του
 * `src/` (και του καταλόγου persona σε TS). Ο χρησμός δεν μπορεί να τις φορτώσει
 * — δεν έχει `node_modules` — άρα κρατά αντίγραφα· εδώ αποδεικνύεται ότι συμφωνούν.
 * =============================================================================
 */

import { WORKSPACE_PATH_PREFIX } from '@/lib/workspace/workspace-path';
import { AUTH_ROUTES } from '@/lib/routes/authRoutes';
import { SESSION_COOKIE_CONFIG } from '@/lib/auth/security-policy';
import { classifyIdentityClaims } from '@/lib/auth/identity-claims';
import { PERSONAL_WORKSPACE_SURFACE } from '@/lib/workspace/personal-workspace-surface';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { ORACLE_REPRESENTATIVES, PERSONAS, oracleClassOf } from '../lib/emulator/personas';

// Τα JS modules του χρησμού (CommonJS, χωρίς τύπους).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ID = require('../lib/i18n-ssr/identity');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const O = require('../lib/i18n-ssr/oracle');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withServer } = require('./i18n-ssr-probe-fixture');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const GC = require('../lib/i18n-ssr/golden-catalog');

interface ProbeRecord {
  route: string;
  state: string;
  status: number | null;
  detail?: string;
  persona?: string;
}

interface OracleRoute {
  file: string;
  url: string;
  template?: string;
  fetchUrl?: string;
  dynamic: boolean;
  withheld: null;
  persona?: string;
}

const UA = 'Mozilla/5.0 (test)';
const ORG_ADMIN = 'organization:company_admin';
const SECRET_COOKIE = '__session=SECRET-THAT-MUST-NOT-LEAK'; // ASCII: τιμή κεφαλίδας HTTP

/** Ένα έγκυρο id ανά οντότητα του καταλόγου — με το πρόθεμά της, όπου έχει. */
const GOLDEN_FIXTURE: Record<string, string> = Object.fromEntries(
  Object.entries(GC.GOLDEN_ENTITIES as Record<string, { tier: string; prefix: string | null }>).map(([entity, spec]) => [
    entity,
    spec.prefix ? `${spec.prefix}_fixture${entity}` : spec.tier === 'value' ? 'profit_and_loss' : `tok-${entity}.sig_1`,
  ]),
);

const MANIFEST = {
  schema: 'i18n-ssr-personas/v2',
  projectId: 'demo-nestor-oracle',
  authEmulatorHost: '127.0.0.1:9099',
  personas: [{ class: ORG_ADMIN, email: 'admin.civil@alpha.local', workspaceSegment: 'alpha-techniki' }],
  golden: { entities: GOLDEN_FIXTURE },
};

const WORKSPACE_ROUTE: OracleRoute = {
  file: 'src/app/(app)/o/[workspace]/projects/page.tsx',
  url: '/o/ssr-probe/projects',
  template: '/o/[workspace]/projects',
  dynamic: true,
  withheld: null,
};

/** Κέλυφος + σελίδα που ΑΠΟΔΕΙΚΝΥΟΥΝ τον εαυτό τους — «clean» όταν δεν υπάρχει δείκτης. */
const ORACLE = {
  universe: new Set(['pages.home']),
  shellControls: new Set(['Αλλαγή θέματος']),
  pageControls: new Set(['Περιεχόμενο σελίδας']),
};
const page = (inner: string): string =>
  `<!DOCTYPE html><html><head><title>Nestor</title></head><body><header><span>Αλλαγή θέματος</span></header>${inner}</body></html>`;
const softRedirect = (target: string): string =>
  page(`<main><!--$!--><template data-dgst="NEXT_REDIRECT;replace;${target};307;"></template><section role="status">…</section></main>`);

const personaRoute = (): OracleRoute => ID.expandForPersonas([WORKSPACE_ROUTE], MANIFEST.personas)[0];

async function probeAs(route: OracleRoute, body: string, sessions: Map<string, string>) {
  const seenCookies: Array<string | undefined> = [];
  const record: ProbeRecord = await withServer(
    (request: IncomingMessage, response: ServerResponse) => {
      seenCookies.push(request.headers.cookie);
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(body);
    },
    (baseUrl: string) => O.probeRoute(route, { baseUrl, userAgent: UA, oracle: ORACLE, timeoutMs: 5000, sessions }),
  );
  return { record, seenCookies };
}

// ===========================================================================
// Τ — ΟΙ ΑΓΚΥΡΕΣ ΣΤΙΣ ΑΥΘΕΝΤΙΕΣ (τα αντίγραφα του χρησμού ΣΥΜΦΩΝΟΥΝ)
// ===========================================================================

describe('Τ — ο χρησμός κρατά αντίγραφα αυθεντιών· εδώ ΕΚΤΕΛΟΥΝΤΑΙ', () => {
  test('Τ1 — πρόθεμα χώρου · σύνδεση · cookie · πόρτα συνεδρίας = οι αυθεντίες του src/', () => {
    expect(ID.IDENTITY_CONTRACT.workspacePrefix).toBe(WORKSPACE_PATH_PREFIX);
    expect(ID.IDENTITY_CONTRACT.loginPath).toBe(AUTH_ROUTES.login);
    expect(ID.IDENTITY_CONTRACT.sessionCookie).toBe(SESSION_COOKIE_CONFIG.NAME);
    const endpoint = path.join(__dirname, '..', '..', 'src', 'app', ...ID.IDENTITY_CONTRACT.sessionEndpoint.split('/').filter(Boolean), 'route.ts');
    expect(fs.readFileSync(endpoint, 'utf8')).toMatch(/export const POST\b/);
  });

  test('Τ2 — oracleClassOf ≡ classifyIdentityClaims σε ΟΛΟ τον κατάλογο ADR-798', () => {
    for (const person of PERSONAS) {
      const verdict = classifyIdentityClaims({ companyId: person.companyId, globalRole: person.globalRole });
      expect(verdict.kind).not.toBe('rejected');
      const authority = verdict.kind === 'rejected' ? 'rejected' : `${verdict.kind}:${verdict.globalRole}`;
      expect([person.email, oracleClassOf(person)]).toEqual([person.email, authority]);
    }
  });

  test('Τ3 — ΚΑΛΥΨΗ ΕΚ ΚΑΤΑΣΚΕΥΗΣ: κάθε κλάση οργανισμού έχει ΑΚΡΙΒΩΣ έναν εκπρόσωπο', () => {
    const orgClasses = new Set(PERSONAS.filter((person) => person.companyId).map(oracleClassOf));
    const representatives = ORACLE_REPRESENTATIVES.map((email) => PERSONAS.find((person) => person.email === email));
    expect(representatives.every(Boolean)).toBe(true);
    const represented = representatives.map((person) => oracleClassOf(person!));
    expect(new Set(represented).size).toBe(represented.length);
    expect([...orgClasses].sort()).toEqual([...represented].sort());
    // Ο ιδιωτικός χώρος δεν προσφέρει καμία `/o/me/**` σελίδα ⇒ κανένας προσωπικός
    // εκπρόσωπος. Τη μέρα που θα προσφέρει, αυτή η γραμμή κοκκινίζει — σκόπιμα.
    expect(Object.keys(PERSONAL_WORKSPACE_SURFACE)).toEqual([]);
    expect(representatives.every((person) => Boolean(person!.companyId))).toBe(true);
  });
});

// ===========================================================================
// Ε — ΤΟ MANIFEST ΚΑΙ Ο ΦΡΟΥΡΟΣ HERMETIC (fail-closed)
// ===========================================================================

describe('Ε — manifest + φρουρός hermetic', () => {
  test('Ε1 — έγκυρο manifest διαβάζεται', () => {
    expect(ID.parsePersonaManifest(JSON.stringify(MANIFEST)).personas).toHaveLength(1);
  });

  test.each([
    ['μηδέν persona', { ...MANIFEST, personas: [] }],
    ['άγνωστο σχήμα', { ...MANIFEST, schema: 'v0' }],
    ['διπλή κλάση', { ...MANIFEST, personas: [MANIFEST.personas[0], MANIFEST.personas[0]] }],
    ['τμήμα που δεν είναι τμήμα', { ...MANIFEST, personas: [{ ...MANIFEST.personas[0], workspaceSegment: '../admin' }] }],
  ])('Ε2 — %s ⇒ άρνηση', (_label, manifest) => {
    expect(() => ID.parsePersonaManifest(JSON.stringify(manifest))).toThrow(/ADR-875/);
  });

  test('Ε3 — project ΠΑΡΑΓΩΓΗΣ ⇒ άρνηση ΠΡΙΝ από οποιοδήποτε αίτημα', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    try {
      const production = { ...MANIFEST, projectId: 'pagonis-87766' };
      await expect(
        ID.mintSession({ manifest: production, persona: MANIFEST.personas[0], baseUrl: 'http://127.0.0.1:1', userAgent: UA, credential: 'x' }),
      ).rejects.toThrow(/ΔΕΝ είναι demo-\*/);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test('Ε4 — emulator ΕΚΤΟΣ loopback ⇒ άρνηση', () => {
    expect(() => ID.assertHermetic({ ...MANIFEST, authEmulatorHost: 'emulator.example.com:9099' })).toThrow(/loopback/);
    expect(() => ID.assertHermetic(MANIFEST)).not.toThrow();
  });
});

// ===========================================================================
// Σ — Η ΣΥΝΕΔΡΙΑ: κόβεται από την ΕΙΚΟΝΑ, δεν γίνεται ποτέ δεδομένο
// ===========================================================================

describe('Σ — κοπή συνεδρίας', () => {
  test('Σ1 — emulator → πόρτα της εικόνας → __session (και ΜΟΝΟ η τιμή)', async () => {
    const hits: string[] = [];
    await withServer(
      (request: IncomingMessage, response: ServerResponse) => {
        hits.push(`${request.method} ${request.url}`);
        if (request.url?.includes('accounts:signInWithPassword')) {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ idToken: 'ID-TOKEN' }));
          return;
        }
        response.writeHead(200, { 'set-cookie': '__session=VALUE; Path=/; HttpOnly; SameSite=Lax', 'content-type': 'application/json' });
        response.end('{"success":true}');
      },
      async (baseUrl: string) => {
        const manifest = { ...MANIFEST, authEmulatorHost: baseUrl.replace('http://', '') };
        const cookie = await ID.mintSession({ manifest, persona: MANIFEST.personas[0], baseUrl, userAgent: UA, credential: 'c' });
        expect(cookie).toBe('__session=VALUE');
      },
    );
    expect(hits).toEqual([
      'POST /identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=hermetic',
      'POST /api/auth/session',
    ]);
  });

  test('Σ2 — η εικόνα ΔΕΝ έκοψε συνεδρία ⇒ άρνηση, χωρίς το token στο μήνυμα', async () => {
    await withServer(
      (request: IncomingMessage, response: ServerResponse) => {
        const signIn = request.url?.includes('accounts:signInWithPassword');
        response.writeHead(signIn ? 200 : 401, { 'content-type': 'application/json' });
        response.end(signIn ? JSON.stringify({ idToken: 'ID-TOKEN-SECRET' }) : '{}');
      },
      async (baseUrl: string) => {
        const manifest = { ...MANIFEST, authEmulatorHost: baseUrl.replace('http://', '') };
        const minting = ID.mintSession({ manifest, persona: MANIFEST.personas[0], baseUrl, userAgent: UA, credential: 'c' });
        await expect(minting).rejects.toThrow(/ΔΕΝ έκοψε συνεδρία.*HTTP 401/);
        await expect(minting).rejects.not.toThrow(/ID-TOKEN-SECRET/);
      },
    );
  });

  test('Σ3 — χωρίς manifest ΣΤΟ CI ⇒ άρνηση· τοπικά ⇒ ΔΗΛΩΜΕΝΑ ανώνυμος', async () => {
    await expect(ID.prepareIdentity([WORKSPACE_ROUTE], { baseUrl: 'x', userAgent: UA, env: { CI: 'true' } })).rejects.toThrow(/απαιτεί ταυτότητα/);
    const local = await ID.prepareIdentity([WORKSPACE_ROUTE], { baseUrl: 'x', userAgent: UA, env: {} });
    expect(local.routes).toEqual([WORKSPACE_ROUTE]);
    expect(local.notice).toMatch(/ΑΝΩΝΥΜΟΣ/);
  });

  test('Σ4 — αποτυχία κοπής ⇒ η κλάση ΛΕΙΠΕΙ από τα sessions και ΟΝΟΜΑΖΕΤΑΙ στα failures', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adr875-'));
    const file = path.join(dir, 'personas.json');
    fs.writeFileSync(file, JSON.stringify({ ...MANIFEST, authEmulatorHost: '127.0.0.1:1' }));
    try {
      const env = { I18N_SSR_ORACLE_PERSONAS: file, DEMO_SEED_PASSWORD: 'c' };
      const prepared = await ID.prepareIdentity([WORKSPACE_ROUTE], { baseUrl: 'http://127.0.0.1:1', userAgent: UA, env });
      expect(prepared.sessions.size).toBe(0);
      expect(prepared.failures.has(ORG_ADMIN)).toBe(true);
      expect(prepared.routes.map((route: OracleRoute) => ID.routeIdOf(route))).toEqual([`/o/alpha-techniki/projects@${ORG_ADMIN}`]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ===========================================================================
// Π — Η ΣΑΡΩΣΗ ΑΝΑ PERSONA
// ===========================================================================

describe('Π — ο χρησμός κρίνει ΩΣ persona', () => {
  test('Π1 — το [workspace] γεμίζει από το manifest· το dynamic ΞΑΝΑΫΠΟΛΟΓΙΖΕΤΑΙ', () => {
    const nested = {
      ...WORKSPACE_ROUTE,
      file: 'src/app/(app)/o/[workspace]/projects/[id]/page.tsx',
      url: '/o/ssr-probe/projects/ssr-probe',
      template: '/o/[workspace]/projects/[id]',
    };
    const outside = { file: 'src/app/(light)/search/page.tsx', url: '/search', dynamic: false, withheld: null };
    const [flat, deep, untouched] = ID.expandForPersonas([WORKSPACE_ROUTE, nested, outside], MANIFEST.personas);
    expect([flat.url, flat.dynamic, flat.persona]).toEqual(['/o/alpha-techniki/projects', false, ORG_ADMIN]);
    expect([deep.url, deep.dynamic]).toEqual(['/o/alpha-techniki/projects/ssr-probe', true]);
    expect(untouched).toBe(outside);
  });

  test('Π2 — «περιέχει /o/» ΔΕΝ είναι διαδρομή χώρου: μόνο το ΠΡΩΤΟ τμήμα μετρά', () => {
    expect(ID.isWorkspaceRoute({ url: '/docs/o/ssr-probe' })).toBe(false);
    expect(ID.isWorkspaceRoute({ url: '/o/ssr-probe' })).toBe(true);
  });

  test('Π3 — με συνεδρία: το cookie ΣΤΑΛΘΗΚΕ, αλλά ΔΕΝ υπάρχει πουθενά στην εγγραφή', async () => {
    const { record, seenCookies } = await probeAs(personaRoute(), page('<p>Περιεχόμενο σελίδας</p>'), new Map([[ORG_ADMIN, SECRET_COOKIE]]));
    expect(seenCookies).toEqual([SECRET_COOKIE]);
    expect(record.state).toBe(O.X_STATES.CLEAN);
    expect(record.route).toBe(`/o/alpha-techniki/projects@${ORG_ADMIN}`);
    expect(JSON.stringify(record)).not.toContain('SECRET-THAT-MUST-NOT-LEAK');
  });

  test('Π4 — 🔴 ΧΩΡΙΣ συνεδρία ⇒ ⛔ identity-unproven, και ΚΑΝΕΝΑ ανώνυμο αίτημα', async () => {
    const { record, seenCookies } = await probeAs(personaRoute(), page('<p>Περιεχόμενο σελίδας</p>'), new Map());
    expect(seenCookies).toEqual([]);
    expect(record.state).toBe(O.X_STATES.IDENTITY_UNPROVEN);
    expect(O.X_ZERO_TOLERANCE).toContain(record.state);
  });

  test('Π5 — 🔴 συνεδρία που η εικόνα ΔΕΝ τίμησε (→ /login) ⇒ ⛔, ΟΧΙ 🔴 route-redirected', async () => {
    const { record } = await probeAs(personaRoute(), softRedirect('/login'), new Map([[ORG_ADMIN, SECRET_COOKIE]]));
    expect(record.state).toBe(O.X_STATES.IDENTITY_UNPROVEN);
    expect(record.detail).toContain(ORG_ADMIN);
  });

  test('Π6 — ανακατεύθυνση ΑΛΛΟΥ (όχι σύνδεση) υπό συνεδρία ⇒ μένει 🔴 route-redirected', async () => {
    const { record } = await probeAs(personaRoute(), softRedirect('/o/alpha-techniki/account/profile'), new Map([[ORG_ADMIN, SECRET_COOKIE]]));
    expect(record.state).toBe(O.X_STATES.REDIRECTED);
  });

  test('Π7 — ΑΝΩΝΥΜΗ διαδρομή → /login μένει route-redirected (καμία αλλαγή συμπεριφοράς)', async () => {
    const { record } = await probeAs(WORKSPACE_ROUTE, softRedirect('/login'), new Map());
    expect(record.state).toBe(O.X_STATES.REDIRECTED);
    expect(record.route).toBe('/o/ssr-probe/projects');
  });

  test('Π8 — ο isLoginRedirect ΔΕΝ πιάνει /login-help ή /logins', () => {
    expect(ID.isLoginRedirect('/login')).toBe(true);
    expect(ID.isLoginRedirect('/login?next=%2Fx')).toBe(true);
    expect(ID.isLoginRedirect('/login-help')).toBe(false);
    expect(ID.isLoginRedirect('/logins')).toBe(false);
  });
});
