/**
 * @jest-environment node
 *
 * =============================================================================
 * CHECK 3.51 Χ — TA GOLDEN ΔΕΔΟΜΕΝΑ (ADR-875 §10)
 * =============================================================================
 *
 * Ο κατάλογος (`golden-catalog.js`) είναι CommonJS χωρίς εξαρτήσεις, γιατί ο χρησμός
 * δεν έχει `node_modules`. Άρα κρατά ΑΝΤΙΓΡΑΦΑ (πρόθεμα ids, ονόματα μυστικών) και
 * ΙΣΧΥΡΙΣΜΟΥΣ (ποιο πρότυπο διαβάζει τι στον server). Εδώ **εκτελούνται** απέναντι
 * στις αυθεντίες του `src/` και στο πραγματικό `src/app`.
 * =============================================================================
 */

import * as fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as path from 'node:path';

import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';

import { WITNESS_COLLECTIONS } from '../lib/emulator/golden-witnesses';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const GC = require('../lib/i18n-ssr/golden-catalog');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const GB = require('../lib/i18n-ssr/golden-bindings');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const O = require('../lib/i18n-ssr/oracle');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ID = require('../lib/i18n-ssr/identity');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withServer } = require('./i18n-ssr-probe-fixture');

interface EntitySpec { tier: string; prefix: string | null }
interface Route { file: string; url: string; template: string; dynamic: boolean }

const ROOT = path.join(__dirname, '..', '..');
const ENTITIES = GC.GOLDEN_ENTITIES as Record<string, EntitySpec>;
const TEMPLATES = GC.GOLDEN_TEMPLATES as Record<string, string[]>;
const PUBLIC = GC.GOLDEN_PUBLIC_TEMPLATES as readonly string[];
const PERSONA = { class: 'organization:company_admin', email: 'a@b.local', workspaceSegment: 'alpha-techniki' };

const validGolden = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(ENTITIES).map(([entity, spec]) => [
      entity,
      spec.prefix ? `${spec.prefix}_g${entity}` : spec.tier === GC.GOLDEN_TIERS.VALUE ? 'profit_and_loss' : `t.${entity}-1_x`,
    ]),
  );

const workspaceDynamicTemplates = (): string[] =>
  (O.enumerateRoutes(ROOT) as Route[])
    .map((route) => route.template)
    .filter((template) => template.startsWith('/o/[workspace]/') && template.slice('/o/[workspace]'.length).includes('['))
    .sort();

// ===========================================================================
// Γ — Ο ΚΑΤΑΛΟΓΟΣ ΣΥΜΦΩΝΕΙ ΜΕ ΤΙΣ ΑΥΘΕΝΤΙΕΣ
// ===========================================================================

describe('Γ — ο κατάλογος golden απέναντι στο src/', () => {
  test('Γ1 — ΑΚΡΙΒΩΣ τα δυναμικά πρότυπα /o του enumerateRoutes + οι δημόσιες πόρτες: κανένα άκριτο, κανένα μπαγιάτικο', () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual([...workspaceDynamicTemplates(), ...PUBLIC].sort());
    expect(() => GB.assertCatalogMatchesRoutes(O.enumerateRoutes(ROOT))).not.toThrow();
  });

  test('Γ1γ — ADR-876: οι δημόσιες πόρτες με token είναι ΕΚΤΟΣ χώρου και κρίνονται ΑΝΩΝΥΜΑ', () => {
    // 🔴 Η άγκυρα του ευρήματος: η πύλη προμηθευτή και το check-in ζούσαν στο `/o/[workspace]`
    //    και ο χρησμός τα έκρινε με συνεδρία μέλους — θεατή που ο παραλήπτης ΔΕΝ είναι ποτέ.
    expect([...PUBLIC].sort()).toEqual(['/attendance/check-in/[token]', '/vendor/quote/[token]']);
    const expanded = ID.expandForPersonas(
      (O.enumerateRoutes(ROOT) as Route[]).filter((route) => PUBLIC.includes(route.template)),
      [PERSONA],
      validGolden(),
    ) as Array<Route & { persona?: string; fetchUrl?: string }>;
    expect(expanded.map((route) => [route.url, route.persona, route.dynamic])).toEqual([
      ['/attendance/check-in/golden-attendanceToken', undefined, false],
      ['/vendor/quote/golden-vendorToken', undefined, false],
    ]);
    expect(expanded.every((route) => !route.fetchUrl?.includes('golden-'))).toBe(true);
  });

  test('Γ1δ — `[workspace]` χωρίς persona ⇒ άρνηση (δημόσια πόρτα δεν ζει σε χώρο)', () => {
    expect(() => GB.bindRoute({ template: '/o/[workspace]/projects/[id]' }, null, validGolden())).toThrow(/χωρίς persona/);
  });

  test('Γ1β — κάθε πρότυπο δίνει ΜΙΑ οντότητα ανά δυναμικό τμήμα, και μόνο γνωστές οντότητες', () => {
    for (const [template, entities] of Object.entries(TEMPLATES)) {
      const dynamic = template.split('/').filter((segment) => segment.startsWith('[') && segment !== '[workspace]');
      expect([template, entities.length]).toEqual([template, dynamic.length]);
      for (const entity of entities) expect([template, entity in ENTITIES]).toEqual([template, true]);
    }
  });

  test('Γ2 — τα προθέματα = ENTERPRISE_ID_PREFIXES (αντίγραφο που ΕΛΕΓΧΕΤΑΙ)', () => {
    const authority: Record<string, string> = {
      project: ENTERPRISE_ID_PREFIXES.PROJECT,
      rfq: ENTERPRISE_ID_PREFIXES.RFQ,
      purchaseOrder: ENTERPRISE_ID_PREFIXES.PURCHASE_ORDER,
      contact: ENTERPRISE_ID_PREFIXES.CONTACT,
      building: ENTERPRISE_ID_PREFIXES.BUILDING,
      property: ENTERPRISE_ID_PREFIXES.PROPERTY,
      parking: ENTERPRISE_ID_PREFIXES.PARKING,
      storage: ENTERPRISE_ID_PREFIXES.STORAGE,
      lead: ENTERPRISE_ID_PREFIXES.OPPORTUNITY,
      task: ENTERPRISE_ID_PREFIXES.TASK,
      obligation: ENTERPRISE_ID_PREFIXES.OBLIGATION,
      invoice: ENTERPRISE_ID_PREFIXES.INVOICE_ACC,
      ownerProperty: ENTERPRISE_ID_PREFIXES.OWNER_PROPERTY,
      quote: ENTERPRISE_ID_PREFIXES.QUOTE,
    };
    const prefixed = Object.fromEntries(Object.entries(ENTITIES).filter(([, spec]) => spec.prefix).map(([entity, spec]) => [entity, spec.prefix]));
    expect(prefixed).toEqual(authority);
  });

  test('Γ2β — η τιμή του [type] ΕΙΝΑΙ μέλος του ReportType (κλειστό σύνολο του src/)', () => {
    const reports = fs.readFileSync(path.join(ROOT, 'src', 'subapps', 'accounting', 'types', 'reports.ts'), 'utf8');
    const union = reports.slice(reports.indexOf('export type ReportType ='), reports.indexOf(';', reports.indexOf('export type ReportType =')));
    expect(union).toContain(`| '${GC.GOLDEN_VALUES.reportType}'`);
  });

  test('Γ8 — οι μάρτυρες του σπορέα = ΑΚΡΙΒΩΣ η βαθμίδα witness του καταλόγου', () => {
    const witnessTier = Object.entries(ENTITIES).filter(([, spec]) => spec.tier === GC.GOLDEN_TIERS.WITNESS).map(([entity]) => entity);
    expect(Object.keys(WITNESS_COLLECTIONS).sort()).toEqual(witnessTier.sort());
  });

  test('Γ7 — τα εφήμερα μυστικά είναι ονόματα του environment-contract, και το workflow τα γεννά', () => {
    const contract = fs.readFileSync(path.join(ROOT, 'src', 'config', 'environment-contract.ts'), 'utf8');
    const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'i18n-ssr-oracle.yml'), 'utf8');
    for (const secret of GC.GOLDEN_EPHEMERAL_SECRETS as string[]) {
      expect([secret, contract.includes(`name: '${secret}'`)]).toEqual([secret, true]);
      expect([secret, workflow.includes(`-e ${secret}`)]).toEqual([secret, true]);
    }
  });
});

// ===========================================================================
// Γ3-Γ5 — ΤΟ MANIFEST ΚΑΙ ΤΟ ΔΕΣΙΜΟ (fail-closed)
// ===========================================================================

describe('Γ — manifest golden + δέσιμο', () => {
  test('Γ3 — έγκυρο golden διαβάζεται', () => {
    expect(Object.keys(GB.parseGolden({ entities: validGolden() })).sort()).toEqual(Object.keys(ENTITIES).sort());
  });

  // Το μήνυμα ΟΝΟΜΑΖΕΙ την αιτία: «λείπει το project» και «άκυρο id» είναι άλλη διόρθωση.
  test.each([
    ['λείπει οντότητα', (g: Record<string, string>) => { delete g.project; }, /χωρίς οντότητα: project/],
    ['άγνωστη οντότητα', (g: Record<string, string>) => { g.spaceship = 'x'; }, /άγνωστη οντότητα: spaceship/],
    ['id χωρίς το πρόθεμα του SSoT', (g: Record<string, string>) => { g.project = 'rfq_abc'; }, /project: το id δεν έχει το πρόθεμα «proj_»/],
    ['id που δεν είναι τμήμα URL', (g: Record<string, string>) => { g.contact = 'cont_../../admin'; }, /contact: μη έγκυρο id/],
    ['id με κενό', (g: Record<string, string>) => { g.building = 'bldg_a b'; }, /building: μη έγκυρο id/],
  ])('Γ3β — %s ⇒ άρνηση που ΟΝΟΜΑΖΕΙ την αιτία', (_label, mutate, reason) => {
    const golden = validGolden();
    mutate(golden);
    expect(() => GB.parseGolden({ entities: golden })).toThrow(reason);
  });

  test('Γ4 — ΟΛΑ τα τμήματα γεμάτα ⇒ dynamic:false· ταυτότητα ΣΤΑΘΕΡΗ, αίτημα με τα ΠΡΑΓΜΑΤΙΚΑ ids', () => {
    const golden = validGolden();
    const route = { file: 'x', url: 'x', template: '/o/[workspace]/projects/[id]/procurement/po/[poId]', dynamic: true };
    const bound = GB.bindRoute(route, PERSONA, golden);
    expect(bound).toEqual({
      url: '/o/alpha-techniki/projects/golden-project/procurement/po/golden-purchaseOrder',
      fetchUrl: `/o/alpha-techniki/projects/${golden.project}/procurement/po/${golden.purchaseOrder}`,
      dynamic: false,
    });
  });

  test('Γ4β — πρότυπο ΕΚΤΟΣ καταλόγου ⇒ μένει ssr-probe και 🔶 (φαίνεται, δεν κρύβεται)', () => {
    const route = { file: 'x', url: 'x', template: '/o/[workspace]/nowhere/[id]', dynamic: true };
    expect(GB.bindRoute(route, PERSONA, validGolden())).toMatchObject({ url: '/o/alpha-techniki/nowhere/ssr-probe', dynamic: true });
  });

  test('Γ4γ — μπαγιάτικος κατάλογος (πρότυπο που δεν υπάρχει) ⇒ άρνηση', () => {
    const routes = (O.enumerateRoutes(ROOT) as Route[]).filter((route) => route.template !== '/o/[workspace]/crm/leads/[id]');
    expect(() => GB.assertCatalogMatchesRoutes(routes)).toThrow(/μπαγιάτικος κατάλογος.*crm\/leads/);
  });

  test('Γ4δ — τα ids ΣΒΗΝΟΝΤΑΙ από κάθε detail (στόχος ανακατεύθυνσης σταθερός ανά run)', () => {
    const golden = validGolden();
    const detail = `→ /o/alpha-techniki/projects?projectId=${golden.project}&po=${encodeURIComponent(golden.purchaseOrder)}`;
    expect(GB.maskGoldenIds(detail, golden)).toBe('→ /o/alpha-techniki/projects?projectId=golden-project&po=golden-purchaseOrder');
  });

  test('Γ9 — ο probe ΖΗΤΑ το fetchUrl (πραγματικά ids) αλλά ΚΑΤΑΓΡΑΦΕΙ τη σταθερή ταυτότητα', async () => {
    const golden = validGolden();
    const template = '/o/[workspace]/procurement/rfqs/[id]';
    const route = { file: 'x', url: 'x', template, dynamic: true, withheld: null, persona: PERSONA.class, ...GB.bindRoute({ template }, PERSONA, golden) };
    const requested: string[] = [];
    const record = await withServer(
      (request: IncomingMessage, response: ServerResponse) => {
        requested.push(request.url ?? '');
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end('<!DOCTYPE html><html><body><header>Αλλαγή θέματος</header><p>Περιεχόμενο σελίδας</p></body></html>');
      },
      (baseUrl: string) =>
        O.probeRoute(route, {
          baseUrl,
          userAgent: 'Mozilla/5.0 (test)',
          timeoutMs: 5000,
          sessions: new Map([[PERSONA.class, '__session=x']]),
          oracle: { universe: new Set(['a.b']), shellControls: new Set(['Αλλαγή θέματος']), pageControls: new Set(['Περιεχόμενο σελίδας']) },
        }),
    );
    expect(requested).toEqual([`/o/alpha-techniki/procurement/rfqs/${golden.rfq}`]);
    expect(record.route).toBe(`/o/alpha-techniki/procurement/rfqs/golden-rfq@${PERSONA.class}`);
    expect(JSON.stringify(record)).not.toContain(golden.rfq);
  });

  test('Γ5 — manifest v1 (χωρίς golden) ⇒ άρνηση· v2 χωρίς golden ⇒ άρνηση', () => {
    const base = { projectId: 'demo-x', authEmulatorHost: '127.0.0.1:9099', personas: [PERSONA] };
    expect(() => ID.parsePersonaManifest(JSON.stringify({ ...base, schema: 'i18n-ssr-personas/v1' }))).toThrow(/άγνωστο σχήμα/);
    expect(() => ID.parsePersonaManifest(JSON.stringify({ ...base, schema: ID.MANIFEST_SCHEMA }))).toThrow(/golden/);
    const golden = validGolden();
    expect(ID.parsePersonaManifest(JSON.stringify({ ...base, schema: ID.MANIFEST_SCHEMA, golden: { entities: golden } })).golden).toEqual(golden);
  });
});

// ===========================================================================
// Γ6 — Η ΒΑΘΜΙΔΑ ΠΡΟΚΥΠΤΕΙ ΑΠΟ ΤΟΝ ΚΩΔΙΚΑ: ό,τι διαβάζει ο server ⇒ `api`
// ===========================================================================

/** Αρχείο που αγγίζει δεδομένα στον server (όχι client). */
const DATA_ACCESS = /import\s+'server-only'|from\s+'@\/(server|services)\/|from\s+'@\/subapps\/[^']+\/services\/|firebaseAdmin/;
const isClient = (source: string): boolean => /^\s*['"]use client['"]/m.test(source);

function resolveImport(specifier: string, fromFile: string): string | null {
  const base = specifier.startsWith('@/') ? path.join(ROOT, 'src', specifier.slice(2)) : specifier.startsWith('.') ? path.join(path.dirname(fromFile), specifier) : null;
  if (!base) return null;
  const hit = ['.tsx', '.ts', '/index.tsx', '/index.ts'].map((ext) => base + ext).find((candidate) => fs.existsSync(candidate));
  return hit ?? null;
}

/** Server αρχείο που διαβάζει δεδομένα — το ίδιο, ή ΕΝΑ επίπεδο server component που εισάγει. */
function readsOnServer(file: string): boolean {
  const source = fs.readFileSync(file, 'utf8');
  if (isClient(source)) return false;
  if (DATA_ACCESS.test(source)) return true;
  for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
    const target = resolveImport(match[1], file);
    if (!target || !/\.tsx$/.test(target)) continue;
    const child = fs.readFileSync(target, 'utf8');
    if (!isClient(child) && DATA_ACCESS.test(child)) return true;
  }
  return false;
}

/** Τα params που αποδομεί το αρχείο: `const { id, token: raw } = await params`. */
function destructuredParams(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  const names: string[] = [];
  for (const match of source.matchAll(/const\s*\{([^}]*)\}\s*=\s*await\s+params/g)) {
    for (const part of match[1].split(',')) {
      const name = part.split(':')[0].trim();
      if (name) names.push(name);
    }
  }
  return names;
}

/** page.tsx + κάθε layout.tsx από το `[workspace]` μέχρι τη σελίδα. */
function serverChain(pageFile: string): string[] {
  const workspaceDir = path.join(ROOT, 'src', 'app', '(app)', 'o', '[workspace]');
  const chain = [pageFile];
  for (let dir = path.dirname(pageFile); dir.startsWith(workspaceDir) && dir !== workspaceDir; dir = path.dirname(dir)) {
    const layout = path.join(dir, 'layout.tsx');
    if (fs.existsSync(layout)) chain.push(layout);
  }
  return chain;
}

describe('Γ6 — ό,τι διαβάζει ο SERVER σπέρνεται από το API της εικόνας', () => {
  const routes = (O.enumerateRoutes(ROOT) as Route[]).filter((route) => route.template in TEMPLATES);

  test('Γ6 — κάθε param που αποδομεί server αρχείο με πρόσβαση σε δεδομένα ⇒ οντότητα βαθμίδας api', () => {
    const offenders: string[] = [];
    for (const route of routes) {
      const dynamic = route.template.split('/').filter((segment) => segment.startsWith('[') && segment !== '[workspace]');
      for (const file of serverChain(path.join(ROOT, route.file))) {
        if (!readsOnServer(file)) continue;
        for (const name of destructuredParams(file)) {
          const position = dynamic.indexOf(`[${name}]`);
          if (position < 0) continue;
          const entity = TEMPLATES[route.template][position];
          if (ENTITIES[entity].tier !== GC.GOLDEN_TIERS.API) offenders.push(`${route.template} · ${path.relative(ROOT, file)} · [${name}] → ${entity}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('Γ6β — ο ανιχνευτής ΔΕΝ είναι τυφλός: τα τρία γνωστά server reads ΤΑ ΒΡΙΣΚΕΙ', () => {
    const found = new Set<string>();
    for (const route of routes) {
      for (const file of serverChain(path.join(ROOT, route.file))) {
        if (readsOnServer(file)) destructuredParams(file).forEach((name) => found.add(`${path.relative(ROOT, file).split(path.sep).join('/')}#${name}`));
      }
    }
    expect([...found]).toEqual(
      expect.arrayContaining([
        'src/app/(app)/o/[workspace]/projects/[id]/procurement/layout.tsx#id',
        'src/app/(app)/o/[workspace]/procurement/purchase-orders/[id]/page.tsx#id',
        'src/app/(auth)/vendor/quote/[token]/page.tsx#token',
      ]),
    );
  });
});
