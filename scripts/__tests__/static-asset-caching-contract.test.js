/**
 * @fileoverview **Άγκυρα ADR-860 §Ε2** — «ένα asset που ΔΕΝ υπάρχει φεύγει ως αληθινό 404,
 * και κανένας κανόνας δεν το σφραγίζει `immutable`;»
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ
 *
 * 2026-09-14, παραγωγή: `GET /_next/static/chunks/doesnotexist.js` → `200` + HTML +
 * `Cache-Control: public, max-age=31536000, immutable`. Ο browser κρατούσε μια αποτυχία
 * φόρτωσης κώδικα **για ένα χρόνο**. Δύο διορθώσεις στο `next.config.js`, που αυτή η
 * άγκυρα κρατά ζωντανές:
 *
 *   Κ1  το `afterFiles` στέλνει το `/_next/static/*` που λείπει στο `/api/static-asset-miss`·
 *   Κ2  κανένα `beforeFiles` δεν αγγίζει το `/_next/static/*` (θα έκλεβε και τα υπαρκτά)·
 *   Κ3  κανένας κανόνας `headers()` με `immutable` δεν ταιριάζει σε `/_next/static/*`,
 *       `*.js` ή `*.css`·
 *   Κ4  ο προορισμός υπάρχει και απαντά `404` + `no-store` + `nosniff`.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΕΚΤΕΛΕΙ ΤΟ CONFIG — ΔΕΝ ΤΟ ΔΙΑΒΑΖΕΙ
 *
 * Ίδια μέθοδος με το `firebase-emulator-destination.test.js`: το `next.config.js` φορτώνεται
 * σε **ξεχωριστή διεργασία** με `NODE_ENV=production` (το `headers()` διακλαδώνεται σε dev),
 * περνώντας **και** από το `withSentryConfig`. Ό,τι κρίνεται εδώ είναι ό,τι θα δει το Next.
 *
 * 🔑 **Το ταίριασμα γίνεται με τον matcher ΤΟΥ ΙΔΙΟΥ ΤΟΥ NEXT** (`getPathMatch`), όχι με δική
 * μας regex — αλλιώς θα ρωτούσαμε τον κριτή αν είναι σωστός.
 *
 * 🔑 **Παρονομαστής**: αν το config επέστρεφε **κανέναν** κανόνα, το Κ3 θα περνούσε κενό. Γι'
 * αυτό η Λ1 απαιτεί να υπάρχει τουλάχιστον ένας κανόνας `headers()` και ένα `afterFiles`.
 *
 * @jest-environment node
 * @see docs/centralized-systems/reference/adrs/ADR-860-deploy-skew-resilience.md
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { getPathMatch } = require('next/dist/shared/lib/router/utils/path-match');

const ROOT = path.join(__dirname, '..', '..');
const CONFIG_PATH = path.join(ROOT, 'next.config.js');
const MISS_ROUTE = path.join(ROOT, 'src', 'app', 'api', 'static-asset-miss', 'route.ts');
const MISS_DESTINATION = '/api/static-asset-miss';

/** Διαδρομές που **ΠΟΤΕ** δεν επιτρέπεται να σφραγιστούν `immutable` από κανόνα διαδρομής. */
const PROBE_PATHS = [
  '/_next/static/chunks/doesnotexist.0000000000000000.js',
  '/_next/static/css/doesnotexist.css',
  '/_next/static/chunks/app/(light)/listing/%5Bid%5D/page-0000.js',
  '/react-bugfix-guards.js',
  '/some/unhashed/stylesheet.css',
];

/** Εκτελεί το config σε δική του διεργασία και επιστρέφει `{ headers, rewrites }` ως JSON. */
function resolveProductionRouting() {
  const script = [
    'const c = require(process.argv[1]);',
    'const cfg = typeof c === "function" ? c("phase-production-server", {}) : (c && c.default ? c.default : c);',
    'Promise.all([cfg.headers(), cfg.rewrites()])',
    '  .then(([headers, rewrites]) => process.stdout.write(JSON.stringify({ headers, rewrites })))',
    '  .catch((e) => { process.stderr.write(String(e && e.stack || e)); process.exit(1); });',
  ].join('\n');

  const output = execFileSync(process.execPath, ['-e', script, CONFIG_PATH], {
    env: { ...process.env, NODE_ENV: 'production' },
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(output);
}

function isImmutableRule(rule) {
  return rule.headers.some(
    (h) => h.key.toLowerCase() === 'cache-control' && /\bimmutable\b/.test(h.value),
  );
}

function matches(source, pathname) {
  return getPathMatch(source)(pathname) !== false;
}

describe('ADR-860 §Ε2 — static asset miss: αληθινό 404, ποτέ σφραγισμένο', () => {
  let routing;

  beforeAll(() => {
    routing = resolveProductionRouting();
  });

  test('Λ1 — παρονομαστής: το config επιστρέφει κανόνες (αλλιώς το Κ3 θα περνούσε κενό)', () => {
    expect(Array.isArray(routing.headers)).toBe(true);
    expect(routing.headers.length).toBeGreaterThan(0);
    expect(Array.isArray(routing.rewrites.afterFiles)).toBe(true);
    expect(routing.rewrites.afterFiles.length).toBeGreaterThan(0);
  });

  test('Κ1 — το afterFiles στέλνει κάθε /_next/static/* που λείπει στο static-asset-miss', () => {
    const missRules = routing.rewrites.afterFiles.filter((r) => r.destination.startsWith(MISS_DESTINATION));
    expect(missRules).toHaveLength(1);
    for (const probe of PROBE_PATHS.filter((p) => p.startsWith('/_next/static/'))) {
      expect(matches(missRules[0].source, probe)).toBe(true);
    }
  });

  test('Κ2 — κανένα beforeFiles δεν αγγίζει το /_next/static/* (θα έκλεβε τα αρχεία που ΥΠΑΡΧΟΥΝ)', () => {
    const beforeFiles = routing.rewrites.beforeFiles ?? [];
    const stealing = beforeFiles.filter((r) => matches(r.source, PROBE_PATHS[0]));
    expect(stealing).toEqual([]);
  });

  test('Κ3 — κανένας κανόνας headers() με immutable δεν ταιριάζει σε static/js/css διαδρομή', () => {
    const offenders = [];
    for (const rule of routing.headers.filter(isImmutableRule)) {
      for (const probe of PROBE_PATHS) {
        if (matches(rule.source, probe)) offenders.push(`${rule.source} ⇒ ${probe}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('Κ4 — ο προορισμός υπάρχει και απαντά 404 + no-store + nosniff', () => {
    expect(fs.existsSync(MISS_ROUTE)).toBe(true);
    const source = fs.readFileSync(MISS_ROUTE, 'utf8');
    expect(source).toMatch(/status:\s*404/);
    expect(source).toMatch(/'Cache-Control':\s*'no-store'/);
    expect(source).toMatch(/'X-Content-Type-Options':\s*'nosniff'/);
    expect(source).toMatch(/export const GET\s*=/);
  });
});
