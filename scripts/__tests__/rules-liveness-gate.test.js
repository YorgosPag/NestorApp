/**
 * CHECK 3.96 — η πύλη της ζωντανής σύνδεσης (ADR-894 §10.7).
 *
 * | Άγκυρα | Τι φυλά |
 * |---|---|
 * | Α1–Α5 | ο κανόνας της απαίτησης: `&&` αρκεί ένας · `||` χρειάζεται όλους · `!` ποτέ · μέθοδος ≠ κλήση · σταθερό σημείο |
 * | Δ1–Δ3 | η δομή: `{database}` δεν είναι μπλοκ · αριθμός γραμμής του ΠΗΓΑΙΟΥ · το εσωτερικό `match` |
 * | Ζ | το ΖΩΝΤΑΝΟ δέντρο: 0 ευρήματα ΚΑΙ ο πληθυσμός που μετρήθηκε (όχι «πράσινο επειδή δεν είδε τίποτα») |
 * | Μ1–Μ5 🔴 | μεταλλάξεις που ΕΚΤΕΛΟΥΝ την πύλη πάνω στους πραγματικούς κανόνες |
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { parse, requires, tokenize, guardedFunctions } = require('../lib/rules-liveness/liveness.js');
const { readRulesStructure } = require('../lib/rules-liveness/rules-structure.js');
const { sweep } = require('../lib/rules-liveness/gate.js');
const { GATE_STATES } = require('../lib/rules-liveness/contract.js');

const ROOT = path.resolve(__dirname, '..', '..');
const real = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const P = 'signInIsLive';
const req = (expr, guarded = new Map()) => requires(parse(tokenize(expr)), P, guarded);

/** Σάρωση με ΕΝΑ αρχείο πειραγμένο — το άλλο πραγματικό. */
function sweepWith(file, mutate) {
  return sweep(ROOT, (f) => (f === file ? mutate(real(f)) : real(f)));
}
const statesOf = (result) => result.violations.map((v) => v.state);

describe('Α — ο κανόνας της απαίτησης', () => {
  it('Α1 — `&&`: αρκεί ένας κλάδος να απαιτεί', () => {
    expect(req(`request.auth != null && ${P}()`)).toBe(true);
  });
  it('Α2 🔴 `||`: ΚΑΘΕ κλάδος πρέπει να απαιτεί', () => {
    expect(req(`request.auth.uid == x || ${P}()`)).toBe(false);
    expect(req(`(${P}() && a) || (b && ${P}())`)).toBe(true);
  });
  it('Α3 — `!` ποτέ δεν απαιτεί', () => {
    expect(req(`!${P}()`)).toBe(false);
  });
  it('Α4 — μέθοδος με το ίδιο όνομα ΔΕΝ είναι κλήση του κατηγορήματος', () => {
    expect(req(`request.auth.token.${P}()`)).toBe(false);
  });
  it('Α5 — σταθερό σημείο: α → β → κατηγόρημα', () => {
    const guarded = guardedFunctions([
      { name: 'a', expr: 'b() && x == 1' },
      { name: 'b', expr: `request.auth != null && ${P}()` },
      { name: 'c', expr: 'request.auth.uid == y' },
    ], P);
    expect([...guarded]).toEqual([['a', true], ['b', true], ['c', false]]);
  });
});

describe('Δ — η δομή του αρχείου', () => {
  const source = [
    'service cloud.firestore {',
    '  match /databases/{database}/documents {',
    "    function f() { return x == '}'; } // }",
    '    match /a/{id} {',
    '      allow read: if true;',
    '    }',
    '  }',
    '}',
  ].join('\n');

  it('Δ1 — το `{database}` και το `}` σε συμβολοσειρά/σχόλιο δεν σπάνε τη δομή', () => {
    const { functions, allows } = readRulesStructure(source);
    expect(functions.map((fn) => fn.name)).toEqual(['f']);
    expect(allows).toHaveLength(1);
  });
  it('Δ2 — αριθμός γραμμής του ΠΗΓΑΙΟΥ (τα σχόλια δεν τον μετακινούν)', () => {
    expect(readRulesStructure(source).allows[0].line).toBe(5);
  });
  it('Δ3 — το εσωτερικό `match` της δήλωσης', () => {
    expect(readRulesStructure(source).allows[0].matchPath).toBe('/a/{id}');
  });
});

describe('Ζ — το ζωντανό δέντρο', () => {
  // Μετρήθηκε 2026-10-03: 759 (2026-09-30) + 2 (`a228f670` ADR-901 Φ1) + 3 (`c715669a` ownership) + 2 (`3972a48a`
  // ADR-862 Φ1) — η πύλη έμεινε κόκκινη από τότε — + 2 (ADR-901 Φ3, `engagement_invitations`: read/write `if false`) + 2 (ADR-901 Φ4.4, `conveyance_contributions`: read/write `if false`) + 2 (ADR-900 §8 #2 2β.4, `public_units`: read `if true` δηλωμένο στο συμβόλαιο + write `if false`) + 2 (ADR-901 Φ4.5, `conveyance_document_requests`: read/write `if false`) + 3 (ADR-901 §14.8, `conveyance_view_signals`: get του κατόχου με `isAuthenticated` + list `if false` + create/update/delete `if false`). Νέο `allow` ⇒ νέα μέτρηση **με** τη σύνθεσή της, ποτέ σκέτος αριθμός.
  it('Ζ 🔑 0 ευρήματα — ΚΑΙ ο πληθυσμός είναι αυτός που μετρήθηκε (777 + 71 allow)', () => {
    const result = sweep(ROOT);
    expect(result.violations).toEqual([]);
    expect(result.perFile.map((f) => f.allows)).toEqual([777, 71]);
    expect(result.tally[GATE_STATES.COVERED]).toBeGreaterThan(600);
    expect(result.claimName).toBe('revokedSignIns');
  });
});

describe('Μ 🔴 — μεταλλάξεις που ΕΚΤΕΛΟΥΝ την πύλη', () => {
  it('Μ1 — ρίζα «απλοποιημένη» σε σκέτο `request.auth != null` ⇒ ακάλυπτα (και ό,τι κρέμεται)', () => {
    const result = sweepWith('firestore.rules', (s) => s.replace('return request.auth != null && signInIsLive();', 'return request.auth != null;'));
    expect(result.tally[GATE_STATES.UNCOVERED_ALLOW]).toBeGreaterThan(400);
  });
  it('Μ2 — επαναφορά του σκέτου `request.auth.uid == createdBy` ⇒ τα 26 της λογιστικής', () => {
    const result = sweepWith('firestore.rules', (s) => s
      .replace('((isOwner(createdBy) && belongsToCompany(companyId)) || isCompanyAdminOfCompany(companyId))', '(request.auth.uid == createdBy || isCompanyAdminOfCompany(companyId))')
      .replace('return (isOwner(createdBy) && belongsToCompany(companyId)) || isCompanyAdminOfCompany(companyId);', 'return request.auth.uid == createdBy || isCompanyAdminOfCompany(companyId);'));
    expect(result.tally[GATE_STATES.UNCOVERED_ALLOW]).toBe(26);
  });
  it('Μ3 — κατηγόρημα που ρωτά ΑΛΛΟ claim ⇒ claim-mismatch (Storage)', () => {
    const result = sweepWith('storage.rules', (s) => s.replace("get('revokedSignIns', [])", "get('revoked', [])"));
    expect(statesOf(result)).toContain(GATE_STATES.CLAIM_MISMATCH);
  });
  it('Μ4 — νέο `if true` εκτός κλειστού συνόλου ⇒ undeclared-public', () => {
    const result = sweepWith('storage.rules', (s) => s.replace('allow read: if isInternalUserOfCompany(companyId);', 'allow read: if true;'));
    expect(statesOf(result)).toContain(GATE_STATES.UNDECLARED_PUBLIC);
  });
  it('Μ5 — το κατηγόρημα λείπει ⇒ missing-predicate', () => {
    const result = sweepWith('storage.rules', (s) => s.replace('function signInIsLive()', 'function somethingElse()'));
    expect(statesOf(result)).toContain(GATE_STATES.MISSING_PREDICATE);
  });
});
