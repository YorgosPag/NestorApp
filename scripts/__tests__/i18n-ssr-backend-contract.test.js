/**
 * @jest-environment node
 *
 * ⚠️ ΤΟ `node` ΔΕΝ ΕΙΝΑΙ ΠΡΟΑΙΡΕΤΙΚΟ — ΜΕΤΡΗΜΕΝΟ ΣΤΗ ΓΕΝΝΗΣΗ ΑΥΤΟΥ ΤΟΥ ΑΡΧΕΙΟΥ: στο
 * jsdom το `fetch` αποτυγχάνει, ο χρησμός πέφτει στο `route-unreachable` **για λάθος
 * λόγο**, και τα Β2–Β5 (που περιμένουν ακριβώς αυτό) βγήκαν **ψευδώς πράσινα**. Γι' αυτό
 * κάθε test ελέγχει και το `status`: αποτυχημένο fetch δίνει `null`, ποτέ πράσινο.
 *
 * =============================================================================
 * CHECK 3.51 Χ (ADR-781) — Β: «ΔΕΝ ΜΠΟΡΕΣΑ ΝΑ ΡΩΤΗΣΩ» ΕΙΝΑΙ ΔΗΛΩΣΗ, ΟΧΙ ΣΙΩΠΗ
 * =============================================================================
 *
 * Άγκυρες του `scripts/lib/i18n-ssr/backend-contract.js`. Το fixture `REAL_ROW`
 * ΔΕΝ είναι χειρόγραφο: είναι το κομμάτι HTML που έστειλε **πραγματικό** Next.js
 * 15.5.22 (production build, `next start`) όταν σελίδα έριξε `BackendUnavailableError`
 * — μετρημένο 2026-09-22. Αν μια αναβάθμιση του Next αλλάξει το σχήμα της γραμμής
 * σφάλματος, το Β1 θα μείνει πράσινο ΑΛΛΑ ο χρησμός στο CI θα ξαναγράψει ⛔ — το
 * fail-closed είναι η ασφάλεια, αυτό το αρχείο είναι το συμβόλαιο.
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const O = require('../lib/i18n-ssr/oracle');
const B = require('../lib/i18n-ssr/backend-contract');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CONTRACT = B.loadBackendContract(REPO_ROOT);

/** Αυτούσιο από το HTML του 500 (Next 15.5.22, 2026-09-22). */
const REAL_ROW =
  '<script>self.__next_f.push([1,"8:{\\"metadata\\":[],\\"error\\":null,\\"digest\\":\\"$undefined\\"}\\nd:\\"$8:metadata\\"\\n' +
  '4:E{\\"digest\\":\\"NESTOR_BACKEND_UNAVAILABLE:agency-alias-lookup\\"}\\n"])</script>';

const errorDocument = (inner) => `<!DOCTYPE html><html id="__next_error__"><head></head><body>${inner}</body></html>`;

async function serving(status, html, fn) {
  const server = http.createServer((_request, response) => {
    response.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const ROUTE = { file: 'src/app/(light)/pro/[alias]/page.tsx', url: '/pro/ssr-probe', dynamic: true, withheld: null };
/** Χτυπά τη διαδρομή και **αποδεικνύει ότι ο server απάντησε** με τον αναμενόμενο κωδικό. */
async function probe(baseUrl, expectedStatus) {
  const record = await O.probeRoute(ROUTE, { baseUrl, userAgent: 'Mozilla/5.0 (test)', oracle: {}, backendContract: CONTRACT, timeoutMs: 5000 });
  expect(record.status).toBe(expectedStatus);
  return record;
}

describe('Β0 — το συμβόλαιο διαβάζεται από τον ΚΩΔΙΚΑ που ρίχνει', () => {
  test('πρόθεμα + κλειστό σύνολο εξαρτήσεων από το src/lib/errors/backend-unavailable.ts', () => {
    expect(CONTRACT.prefix).toBe('NESTOR_BACKEND_UNAVAILABLE');
    expect([...CONTRACT.dependencies].sort()).toEqual(['agency-alias-lookup', 'agency-profile', 'workspace-lookup']);
  });

  test('fail-closed: SSoT χωρίς πρόθεμα ⇒ throw με όνομα, ποτέ κενό σύνολο', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-'));
    fs.mkdirSync(path.join(root, 'src/lib/errors'), { recursive: true });
    fs.writeFileSync(path.join(root, B.SSOT_FILE), "export const BACKEND_DEPENDENCIES = ['x'] as const;\n");
    expect(() => B.loadBackendContract(root)).toThrow(/BACKEND_UNAVAILABLE_DIGEST_PREFIX/);
  });
});

describe('Β — 5xx: δήλωση ή crash;', () => {
  test('Β1 — 🔑 το ΠΡΑΓΜΑΤΙΚΟ 500 του Next με το digest ⇒ backend-unavailable (ratchet, όχι ⛔)', async () => {
    await serving(500, errorDocument(REAL_ROW), async (baseUrl) => {
      const record = await probe(baseUrl, 500);
      expect(record.state).toBe(O.X_STATES.BACKEND_UNAVAILABLE);
      expect(record.detail).toBe('δηλωμένη αδυναμία backend: agency-alias-lookup');
    });
    expect(O.X_RATCHETED).toContain(O.X_STATES.BACKEND_UNAVAILABLE);
    expect(O.X_ZERO_TOLERANCE).not.toContain(O.X_STATES.BACKEND_UNAVAILABLE);
  });

  test('Β2 — 500 ΧΩΡΙΣ digest (crash) ⇒ ⛔ route-unreachable, όπως πάντα', async () => {
    await serving(500, errorDocument('<script>self.__next_f.push([1,"4:E{\\"digest\\":\\"1234567\\"}\\n"])</script>'), async (baseUrl) => {
      expect((await probe(baseUrl, 500)).state).toBe(O.X_STATES.UNREACHABLE);
    });
  });

  test('Β3 — 🔴 πλαστογράφηση μέσω params: το κείμενο στο URL ΔΕΝ είναι γραμμή E', async () => {
    const reflected = '<script>self.__next_f.push([1,"0:[\\"alias\\",\\"E{\\\\\\"digest\\\\\\":\\\\\\"NESTOR_BACKEND_UNAVAILABLE:agency-alias-lookup\\\\\\"}\\"]\\n"])</script>';
    await serving(500, errorDocument(reflected), async (baseUrl) => {
      expect((await probe(baseUrl, 500)).state).toBe(O.X_STATES.UNREACHABLE);
    });
  });

  test('Β3β — 🔴 αντανάκλαση σε ΚΕΙΜΕΝΟ του σώματος (χωρίς διαφυγή) ⇒ ⛔ — μόνο η αγκύρωση `E{` το σώζει', async () => {
    // Μετρημένο με μετάλλαξη: χωρίς την αγκύρωση σε γραμμή flight, το Β3 έμενε πράσινο (η
    // διπλή διαφυγή αρκούσε) — ΑΥΤΟ το fixture είναι που κοκκινίζει.
    const inText = '<main><p>/pro/NESTOR_BACKEND_UNAVAILABLE:agency-alias-lookup\\"</p></main>';
    await serving(500, errorDocument(inText), async (baseUrl) => {
      expect((await probe(baseUrl, 500)).state).toBe(O.X_STATES.UNREACHABLE);
    });
  });

  test('Β4 — εξάρτηση ΕΚΤΟΣ κλειστού συνόλου ⇒ ⛔', async () => {
    const unknown = REAL_ROW.replace('agency-alias-lookup', 'made-up-dependency');
    await serving(500, errorDocument(unknown), async (baseUrl) => {
      expect((await probe(baseUrl, 500)).state).toBe(O.X_STATES.UNREACHABLE);
    });
  });

  test('Β5 — 404 με το ίδιο κείμενο ΔΕΝ είναι αδυναμία backend (μόνο 5xx)', async () => {
    await serving(404, errorDocument(REAL_ROW), async (baseUrl) => {
      expect((await probe(baseUrl, 404)).state).toBe(O.X_STATES.UNREACHABLE);
    });
  });
});
