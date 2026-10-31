/**
 * CHECK 3.13 (ADR-279 §5 · ADR-280 §11.8 Β3β) — η εμβέλεια της πύλης ΠΑΡΑΓΕΤΑΙ: «ποια configs φτάνουν στον resolver;»
 *
 * 🔴 Η κλάση: εμβέλεια-φάκελος (186 αρχεία) αντί για 14 ⇒ το `SERVICE_FORM_NAMESPACES` φούσκωσε με `dxf-viewer` για
 * κλειδιά που ο resolver δεν βλέπει ποτέ ⇒ 594,5 KB σε κάθε service form. Εδώ κρίνεται η μηχανή σε μίνι-repo με
 * ΑΛΗΘΙΝΟ γράφο (aliases από `tsconfig.base.json`, barrel, δυναμική εισαγωγή, test αρχείο).
 *
 * Μεταλλάξεις (με επαναφορά στο ίδιο tool call): Μ1 χωρίς `resolveOrigin` (barrel) ⇒ Ε1 · Μ2 ακολουθεί και δυναμικά
 * ⇒ Ε2 · Μ3 χωρίς fail-closed ⇒ Ε3 · Μ4 η πύλη κρίνει τα σταδιοποιημένα χωρίς φίλτρο εμβέλειας ⇒ Ε4.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { resolverConfigScope } = require('../lib/i18n/resolver-config-scope');
const { commitInput } = require('../lib/gate-input');
const gate = require('../check-i18n-resolver-reachability');

const NL = '\n';
const roots = [];

function miniRepo(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'resolver-scope-'));
  roots.push(root);
  const files = {
    'tsconfig.base.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }),
    'src/components/generic/i18n/translate-field-value.ts':
      `export const SERVICE_FORM_NAMESPACES = ['alpha'] as const;${NL}export function translateFieldValue(v: string) { return v; }${NL}`,
    'src/components/generic/ServiceFormRenderer.tsx':
      `import { translateFieldValue } from './i18n/translate-field-value';${NL}export function ServiceFormRenderer() { return translateFieldValue('a.b'); }${NL}`,
    'src/components/generic/index.ts': `export { ServiceFormRenderer } from './ServiceFormRenderer';${NL}`,
    'src/components/Provider.ts': `import { ServiceFormRenderer } from '@/components/generic';${NL}`
      + `import { sections } from '@/config/service-config';${NL}`
      + `export const pair = { sections, renderer: ServiceFormRenderer, later: () => import('@/config/lazy-config-page') };${NL}`,
    'src/config/service-config.ts': `import { FIELDS } from '@/config/vocab/fields';${NL}import { helper } from '@/components/helper';${NL}`
      + `export const sections = [{ title: 'alpha.ok.title', label: FIELDS }, helper];${NL}`,
    'src/config/vocab/fields.ts': `export const FIELDS = { label: 'alpha.ok.label' };${NL}`,
    'src/components/helper.ts': `import { X } from '@/config/behind-component';${NL}export const helper = X;${NL}`,
    'src/config/behind-component.ts': `export const X = { label: 'beta.only.here' };${NL}`,
    'src/config/lazy-config-page.ts': `export const L = { label: 'beta.only.lazy' };${NL}`,
    'src/config/unrelated.ts': `export const U = { label: 'beta.only.unrelated' };${NL}`,
    'src/components/__tests__/renderer.test.ts': `import { ServiceFormRenderer } from '@/components/generic';${NL}`
      + `import { U } from '@/config/unrelated';${NL}export const t = [ServiceFormRenderer, U];${NL}`,
    'src/i18n/locales/el/alpha.json': JSON.stringify({ ok: { title: 'Τίτλος', label: 'Ετικέτα' } }),
    'src/i18n/locales/el/beta.json': JSON.stringify({ only: { here: 'x', lazy: 'y', unrelated: 'z' } }),
    ...overrides,
  };
  for (const [rel, body] of Object.entries(files)) {
    if (body === null) continue;
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body, 'utf8');
  }
  return root;
}

afterAll(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

describe('resolverConfigScope — παραγόμενη εμβέλεια', () => {
  test('Ε1 — renderer → καταναλωτής ΜΕΣΑ από barrel → τα configs του και η κλειστότητά τους στο πεδίο ρυθμίσεων', () => {
    const scope = resolverConfigScope(commitInput(miniRepo(), []));
    expect(scope.renderers).toEqual(['src/components/generic/ServiceFormRenderer.tsx']);
    expect(scope.consumers).toEqual(['src/components/Provider.ts']);
    expect(scope.files).toEqual(['src/config/service-config.ts', 'src/config/vocab/fields.ts']);
  });

  test('Ε2 — ΕΚΤΟΣ: config χωρίς καταναλωτή · πίσω από δυναμικό import · πίσω από μη-config · από test αρχείο', () => {
    const { files } = resolverConfigScope(commitInput(miniRepo(), []));
    for (const out of ['src/config/unrelated.ts', 'src/config/lazy-config-page.ts', 'src/config/behind-component.ts']) {
      expect(files).not.toContain(out);
    }
  });

  test('Ε3 — fail-closed: χωρίς renderer ή χωρίς καταναλωτή ⇒ throw, ποτέ άδεια (πράσινη) εμβέλεια', () => {
    const noRenderer = miniRepo({ 'src/components/generic/ServiceFormRenderer.tsx': `export function ServiceFormRenderer() { return 1; }${NL}` });
    expect(() => resolverConfigScope(commitInput(noRenderer, []))).toThrow(/κανείς δεν εισάγει το/);
    const noConsumer = miniRepo({ 'src/components/Provider.ts': `export const nothing = 1;${NL}` });
    expect(() => resolverConfigScope(commitInput(noConsumer, []))).toThrow(/renderer του resolver/);
  });
});

describe('CHECK 3.13 — η πύλη κρίνει ΜΟΝΟ ό,τι φτάνει στον resolver', () => {
  const silence = () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  };
  afterEach(() => jest.restoreAllMocks());

  test('Ε4 — κλειδί που ο resolver δεν φτάνει: σε config ΕΚΤΟΣ εμβέλειας ⇒ πράσινο· ΜΕΣΑ ⇒ κόκκινο', () => {
    silence();
    const root = miniRepo();
    expect(gate.run([path.join(root, 'src/config/unrelated.ts')], commitInput(root, []))).toBe(0);
    const bad = miniRepo({ 'src/config/vocab/fields.ts': `export const FIELDS = { label: 'beta.only.here' };${NL}` });
    expect(gate.run([path.join(bad, 'src/config/vocab/fields.ts')], commitInput(bad, []))).toBe(1);
  });

  test('Ε5 — `--all` κρίνει όλη την παραγόμενη εμβέλεια (και μόνο αυτή)', () => {
    silence();
    expect(gate.run(['--all'], commitInput(miniRepo(), []))).toBe(0);
    const bad = miniRepo({ 'src/config/service-config.ts': `export const sections = [{ title: 'beta.only.here' }];${NL}` });
    expect(gate.run(['--all'], commitInput(bad, []))).toBe(1);
  });
});
