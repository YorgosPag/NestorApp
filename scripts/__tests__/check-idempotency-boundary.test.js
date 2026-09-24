/**
 * CHECK 3.92 — άγκυρες της πύλης του συνόρου ιδεμποτίας (ADR-872). Η πύλη **εκτελείται** πάνω σε δέντρα-fixtures
 * και πάνω στο πραγματικό δέντρο — ποτέ έλεγχος του κειμένου της.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { measure } = require('../check-idempotency-boundary');

const MIDDLEWARE = `
export function withAuth(handler, options) {
  return async (request) => {
    if (anon) return runIdempotently(request, 'anon', options.idempotency, () => handler(request));
    return runIdempotently(request, uid, options.idempotency, () => handler(request));
  };
}`;
const PERSONAL = `export function withPersonalOrOrgAuth(handler) { return (r) => runIdempotently(r, u, undefined, () => handler(r)); }`;
// ADR-876 §5 — η δημόσια πόρτα της πύλης προμηθευτή: τρίτη ρίζα (principal = ο σύνδεσμος).
const VENDOR_DOOR = `export function withVendorLinkDoor(options, handler) { return (r) => runIdempotently(r, link, options.idempotency, () => handler(r)); }`;

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-gate-'));
  const all = {
    'src/lib/auth/middleware.ts': MIDDLEWARE,
    'src/lib/auth/personal-scope-middleware.ts': PERSONAL,
    'src/server/vendor-portal/vendor-link-door.ts': VENDOR_DOOR,
    ...files,
  };
  for (const [file, text] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

describe('CHECK 3.92 — Κ3: routes εκτός συνόρου (σύνορα ΥΠΟΛΟΓΙΣΜΕΝΑ)', () => {
  it('Π1 route που καλεί `withAuth` ⇒ μέσα', () => {
    const root = tree({ 'src/app/api/a/route.ts': 'export const POST = withAuth(async () => ok());' });
    expect(measure(root).outside).toStrictEqual([]);
  });

  it('Π2 🔑 factory ΔΥΟ επιπέδων (route → projectRoute → runGuarded → withAuth) ⇒ μέσα, χωρίς λίστα', () => {
    const root = tree({
      // ⚠️ Η εξαρτώμενη σαρώνεται ΠΡΩΤΗ (αλφαβητικά): ένα μόνο πέρασμα θα την έχανε — άρα δοκιμάζεται το σταθερό σημείο.
      'src/lib/api/a-project.ts': 'export const projectRoute = (spec) => runGuarded(spec.handler);',
      'src/lib/api/z-guarded.ts': 'export function runGuarded(h) { return withAuth(h); }',
      'src/app/api/b/route.ts': 'export const PATCH = projectRoute({ handler });',
    });
    expect(measure(root).outside).toStrictEqual([]);
  });

  it('Π3 έλεγχος ταυτότητας ΜΕΣΑ στον handler ⇒ εκτός (δεν περνά από το σύνορο)', () => {
    const root = tree({ 'src/app/api/c/route.ts': 'export async function POST(req) { await getAuthContext(req); return ok(); }' });
    expect(measure(root).outside).toStrictEqual(['src/app/api/c/route.ts']);
  });

  it('Π4 εξαγόμενο `POST` σε κοινό αρχείο ΔΕΝ γίνεται σύνορο (θα κάλυπτε ψευδώς)', () => {
    const root = tree({
      'src/lib/api/shared.ts': 'export const POST = withAuth(async () => ok());',
      'src/app/api/d/route.ts': 'export async function DELETE(req) { return POST(req); }',
    });
    expect(measure(root).outside).toStrictEqual(['src/app/api/d/route.ts']);
  });

  it('Π5 route μόνο ανάγνωσης (GET) δεν μετράει', () => {
    const root = tree({ 'src/app/api/e/route.ts': 'export async function GET() { return ok(); }' });
    expect(measure(root).outside).toStrictEqual([]);
  });
});

describe('CHECK 3.92 — Κ1: `natural` μόνο με λόγο', () => {
  const route = (policy) => tree({ 'src/app/api/f/route.ts': `export const PUT = withAuth(h, { idempotency: ${policy} });` });

  it.each([
    ["{ mode: 'natural' }"],
    ["{ mode: 'natural', why: '' }"],
    ["{ mode: 'natural', why: 'επειδή' }"],
  ])('Ν1 %s ⇒ ⛔', (policy) => {
    expect(measure(route(policy)).zeroTol.map((v) => v.gate)).toStrictEqual(['Κ1']);
  });

  it('Ν2 λόγος με περιεχόμενο ⇒ καθαρό', () => {
    expect(measure(route("{ mode: 'natural', why: 'set boolean — η επανάληψη γράφει την ίδια τιμή' }")).zeroTol).toStrictEqual([]);
  });
});

describe('CHECK 3.92 — Κ2: οι ρίζες καλούν το στρώμα', () => {
  it('Ρ1 `withAuth` με ΕΝΑ κλάδο προστατευμένο (ο ανώνυμος ξεχάστηκε) ⇒ ⛔', () => {
    const root = tree({ 'src/lib/auth/middleware.ts': 'export function withAuth(h) { return (r) => runIdempotently(r, u, undefined, () => h(r)); }' });
    const k2 = measure(root).zeroTol.filter((v) => v.gate === 'Κ2');
    expect(k2).toHaveLength(1);
    expect(k2[0].detail).toContain('1/2');
  });

  it('Ρ2 ρίζα που χάθηκε ⇒ ⛔ (ποτέ «καθαρό» επειδή δεν βρέθηκε αρχείο)', () => {
    const root = tree({});
    fs.rmSync(path.join(root, 'src/lib/auth/personal-scope-middleware.ts'));
    expect(measure(root).zeroTol.map((v) => v.gate)).toStrictEqual(['Κ2']);
  });
});

describe('CHECK 3.92 — το πραγματικό δέντρο', () => {
  it('Δ1 μηδέν ⛔, και τα σύνορα βρέθηκαν (κενή σάρωση = σπασμένη άγκυρα, όχι καθαρό δέντρο)', () => {
    const m = measure();
    expect(m.zeroTol).toStrictEqual([]);
    expect(m.boundaries.length).toBeGreaterThanOrEqual(10);
    expect(m.boundaries).toEqual(expect.arrayContaining(['withAuth', 'withPersonalOrOrgAuth', 'withNetworkDoor', 'runGuarded']));
    // ADR-876 §5 — η δημόσια πόρτα της πύλης προμηθευτή είναι ρίζα, και τα τρία routes της είναι ΜΕΣΑ.
    expect(m.boundaries).toContain('withVendorLinkDoor');
    expect(m.outside.filter((f) => f.startsWith('src/app/api/vendor/'))).toEqual([]);
  });

  it('Δ2 η baseline ταιριάζει ΑΚΡΙΒΩΣ με τη μέτρηση (το ratchet δεν κρύβει ανταλλαγή)', () => {
    const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '.idempotency-boundary-baseline.json'), 'utf8'));
    expect(measure().outside.filter((f) => !baseline.outside.includes(f))).toStrictEqual([]);
  });
});
