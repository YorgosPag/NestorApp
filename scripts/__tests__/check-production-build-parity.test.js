/**
 * @jest-environment node
 *
 * =============================================================================
 * CHECK 3.57 (ADR-788) — αυτοέλεγχος: «χτίζουν όλοι τον ίδιο server;»
 * =============================================================================
 *
 * 🔴 Η ΒΑΘΜΟΝΟΜΗΣΗ ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΟ, ΟΧΙ ΔΙΑΚΟΣΜΗΣΗ.
 * Μια πύλη που γεννιέται πράσινη δεν έχει αποδείξει τίποτα. Το `Π1` τρέχει την
 * πύλη πάνω στον **ΠΡΑΓΜΑΤΙΚΟ** κώδικα του commit `76235be6` — τη μέρα που ο
 * ΧΡΗΣΜΟΣ έχτιζε δεύτερο server με **1 από τις 20** μεταβλητές — και απαιτεί
 * ⛔. Χωρίς αυτό, το «✅ σήμερα» θα μπορούσε να σημαίνει «δεν κοιτάζω τίποτα».
 *
 * ⚠️ **ΚΑΡΦΩΜΕΝΟ commit, ΠΟΤΕ `HEAD`**: το `HEAD` μετακινείται και η άγκυρα θα
 * αυτοακυρωνόταν σιωπηλά (μάθημα CHECK 3.41). Το `gitShow` **σκάει** σε κενή
 * απάντηση, αντί να βάψει το test πράσινο με άδειο περιεχόμενο.
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const P = require('../lib/build-parity/parity');
const GATE = require('../check-production-build-parity');

const REPO_ROOT = path.join(__dirname, '..', '..');

/** ⚠️ Καρφωμένο. Η ημέρα που ο ΧΡΗΣΜΟΣ έχτιζε δεύτερο server. */
const BEFORE = '76235be6';

function gitShow(ref, file) {
  const out = execFileSync('git', ['show', `${ref}:${file}`], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (!out || out.trim() === '') throw new Error(`git show ${ref}:${file} → ΚΕΝΟ (η άγκυρα δεν αποδεικνύει τίποτα)`);
  return out;
}

/** Μίνι-repo από **πραγματικά** αρχεία. Οι μεταλλάξεις γίνονται στις ΕΙΣΟΔΟΥΣ. */
function miniRepo(files, registryGates) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-'));
  fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    const target = path.join(dir, '.github', 'workflows', name);
    fs.writeFileSync(target, body, 'utf8');
  }
  fs.writeFileSync(path.join(dir, '.ci-gate-tiers.json'), JSON.stringify({ gates: registryGates }, null, 2), 'utf8');
  return dir;
}

const LIVE_DOCKER = () => gitShow(BEFORE, '.github/workflows/docker-build.yml');
const TIER1 = [{ file: 'docker-build.yml', name: 'T1', tier: 1, why: 'παραγωγή' }];

// ===========================================================================
// Μ0 — ο παρονομαστής στο ΠΡΑΓΜΑΤΙΚΟ δέντρο
// ===========================================================================

describe('Μ0 — η πύλη βλέπει τον αληθινό κόσμο', () => {
  test('Μ0.1 — υπάρχει ΑΚΡΙΒΩΣ μία κανονική κλήση, και είναι Tier 1', () => {
    const measured = GATE.measure();
    expect(measured.canonical).not.toBeNull();
    expect(measured.byState[P.STATES.CANONICAL]).toBe(1);
    expect(measured.tier1).toContain(measured.canonical.file);
  });

  test('Μ0.2 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η κανονική κλήση έχει ΔΕΚΑΔΕΣ μεταβλητές', () => {
    // 🔴 Αν το `stepEnv` σπάσει και επιστρέψει `{}`, ΚΑΘΕ σύγκριση περνά κενή
    //    και η πύλη γίνεται μονίμως πράσινη χωρίς να αλλάξει καμία γραμμή κρίσης.
    const measured = GATE.measure();
    expect(Object.keys(measured.canonical.env).length).toBeGreaterThanOrEqual(15);
    expect(measured.canonical.env.NODE_OPTIONS).toContain('max-old-space-size');
  });

  test('Μ0.3 — σήμερα η πύλη είναι ΠΡΑΣΙΝΗ (καμία μπλοκάρουσα κατάσταση)', () => {
    const measured = GATE.measure();
    for (const state of P.BLOCKING) expect([state, measured.byState[state]]).toEqual([state, 0]);
  });
});

// ===========================================================================
// Π — ΒΑΘΜΟΝΟΜΗΣΗ ΣΕ ΠΡΑΓΜΑΤΙΚΟ ΙΣΤΟΡΙΚΟ
// ===========================================================================

describe('Π — η πύλη ΠΙΑΝΕΙ το περιστατικό που τη γέννησε', () => {
  test('Π1 — 🔴 ο ΧΡΗΣΜΟΣ του 76235be6 έχτιζε με 1/20 μεταβλητές ⇒ ⛔ env-drift', () => {
    const dir = miniRepo(
      {
        'docker-build.yml': LIVE_DOCKER(),
        'i18n-shell-slice.yml': gitShow(BEFORE, '.github/workflows/i18n-shell-slice.yml'),
      },
      TIER1,
    );
    const measured = GATE.measure(dir);
    const offender = measured.records.find((record) => record.file === 'i18n-shell-slice.yml');
    expect(offender).toBeDefined();
    expect(offender.state).toBe(P.STATES.DRIFT);
    // …και ονομάζει ΠΟΣΕΣ λείπουν: ένα «drift» χωρίς αριθμό δεν καθοδηγεί
    expect(offender.detail).toMatch(/λείπουν 19\/20/);
    expect(offender.detail).toContain('NEXT_PUBLIC_FIREBASE_API_KEY');
  });

  test('Π2 — και το bundle-ratchet του ΙΔΙΟΥ commit ήταν ήδη σε ισοτιμία', () => {
    // Ο παρονομαστής του Π1: αν ΟΛΑ έβγαιναν drift, η πύλη θα ήταν απλώς θορυβώδης.
    const dir = miniRepo(
      {
        'docker-build.yml': LIVE_DOCKER(),
        'bundle-ratchet.yml': gitShow(BEFORE, '.github/workflows/bundle-ratchet.yml'),
      },
      TIER1,
    );
    const measured = GATE.measure(dir);
    const sibling = measured.records.find((record) => record.file === 'bundle-ratchet.yml');
    expect(sibling.state).toBe(P.STATES.REDUNDANT);
  });
});

// ===========================================================================
// Κ — τα συμβόλαια
// ===========================================================================

describe('Κ — συμβόλαια της πύλης', () => {
  test('Κ1 — η αυθεντία βγαίνει από το ΜΗΤΡΩΟ, όχι από όνομα αρχείου', () => {
    // Ίδια αρχεία, ΑΛΛΟ tier ⇒ άλλη κανονική κλήση. Αν η πύλη έψαχνε
    // «docker-build.yml» ως συμβολοσειρά, αυτό θα έμενε ίδιο.
    const dir = miniRepo(
      { 'docker-build.yml': LIVE_DOCKER(), 'bundle-ratchet.yml': gitShow(BEFORE, '.github/workflows/bundle-ratchet.yml') },
      [{ file: 'bundle-ratchet.yml', name: 'T1', tier: 1, why: 'δοκιμή' }],
    );
    const measured = GATE.measure(dir);
    expect(measured.canonical.file).toBe('bundle-ratchet.yml');
  });

  test('Κ2 — fail-closed: καμία Tier 1 κλήση ⇒ ΔΕΝ αποφαίνεται «καθαρό»', () => {
    const dir = miniRepo(
      { 'bundle-ratchet.yml': gitShow(BEFORE, '.github/workflows/bundle-ratchet.yml') },
      [{ file: 'docker-build.yml', name: 'T1', tier: 1, why: 'λείπει' }],
    );
    const measured = GATE.measure(dir);
    expect(measured.canonical).toBeNull();
    expect(measured.byState[P.STATES.DRIFT]).toBe(1);
  });

  test('Κ3 — ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ: άγνωστη κατάσταση ⇒ throw ΜΕ ΟΝΟΜΑ', () => {
    expect(() => P.census([{ file: 'x.yml', state: 'φανταστική' }]))
      .toThrow(/άγνωστη κατάσταση "φανταστική"/);
  });

  test('Κ4 — το 🔶 περιττό build ΔΕΝ μπλοκάρει (αλλιώς μονίμως κόκκινο ⇒ SKIP_)', () => {
    expect(P.COUNTED).toContain(P.STATES.REDUNDANT);
    expect(P.BLOCKING).not.toContain(P.STATES.REDUNDANT);
    for (const state of P.BLOCKING) expect(P.COUNTED).not.toContain(state);
  });

  test('Κ5 — ΣΧΟΛΙΟ που αναφέρει build:ci ΔΕΝ είναι κλήση build', () => {
    // Το ίδιο μάθημα με το `Κ7β` του CHECK 3.50: ένα σχόλιο που τεκμηριώνει τη
    // βλάβη δεν είναι η βλάβη. Εδώ το φυλάει ο αναγνώστης του ADR-757.
    const dir = miniRepo(
      {
        'docker-build.yml': LIVE_DOCKER(),
        'innocent.yml': ['name: T3 innocent', 'on: [push]', 'jobs:', '  x:', '    runs-on: ubuntu-latest', '    steps:', '      # ΜΗΝ καλέσεις pnpm run build:ci εδώ', '      - run: echo hi', ''].join('\n'),
      },
      TIER1,
    );
    const measured = GATE.measure(dir);
    expect(measured.records.map((record) => record.file)).toEqual(['docker-build.yml']);
  });

  test('Κ6 — ΜΕΤΡΗΜΕΝΟ ψευδώς θετικό: `npm run build:tokens` ΔΕΝ είναι cross-env build', () => {
    // Το προφανές κριτήριο «ψάξε για npm run build» έδινε 1 εύρημα / 1 ψευδώς
    // θετικό = 100%, στο ssot-discover.yml:466 μέσα σε echo περίληψης.
    const dir = miniRepo(
      {
        'docker-build.yml': LIVE_DOCKER(),
        'tokens.yml': ['name: T3 tokens', 'on: [push]', 'jobs:', '  x:', '    runs-on: ubuntu-latest', '    steps:', '      - run: npm run build:tokens', ''].join('\n'),
      },
      TIER1,
    );
    const measured = GATE.measure(dir);
    expect(measured.byState[P.STATES.CROSS_ENV]).toBe(0);
  });

  test('Κ6β — αλλά το ΣΚΕΤΟ `pnpm run build` ΕΙΝΑΙ (σβήνει το NODE_OPTIONS)', () => {
    const dir = miniRepo(
      {
        'docker-build.yml': LIVE_DOCKER(),
        'legacy.yml': ['name: T3 legacy', 'on: [push]', 'jobs:', '  x:', '    runs-on: ubuntu-latest', '    steps:', '      - run: pnpm run build', ''].join('\n'),
      },
      TIER1,
    );
    const measured = GATE.measure(dir);
    expect(measured.byState[P.STATES.CROSS_ENV]).toBe(1);
  });

  test('Κ7 — build κρυμμένο σε ΤΟΠΙΚΗ σύνθετη ενέργεια ⇒ ⛔ unanalyzable, ποτέ σιωπή', () => {
    const dir = miniRepo({ 'docker-build.yml': LIVE_DOCKER() }, TIER1);
    fs.mkdirSync(path.join(dir, '.github', 'actions', 'sneaky'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, '.github', 'actions', 'sneaky', 'action.yml'),
      ['name: sneaky', 'runs:', '  using: composite', '  steps:', '    - run: pnpm run build:ci', '      shell: bash', ''].join('\n'),
      'utf8',
    );
    const measured = GATE.measure(dir);
    expect(measured.byState[P.STATES.OPAQUE]).toBe(1);
  });

  test('Κ8 — ίδια ονόματα, ΑΛΛΗ τιμή ⇒ ⛔ env-value-drift (το περιστατικό 8192)', () => {
    const canonical = LIVE_DOCKER();
    const twin = canonical
      .replace(/^name:.*$/m, 'name: T2 twin')
      .replace("NODE_OPTIONS: '--max-old-space-size=12288'", "NODE_OPTIONS: '--max-old-space-size=8192'");
    const dir = miniRepo({ 'docker-build.yml': canonical, 'twin.yml': twin }, TIER1);
    const measured = GATE.measure(dir);
    const offender = measured.records.find((record) => record.file === 'twin.yml');
    expect(offender.state).toBe(P.STATES.VALUE_DRIFT);
    expect(offender.detail).toContain('NODE_OPTIONS');
  });

  test('Κ9 — ο σημερινός ΧΡΗΣΜΟΣ ΔΕΝ είναι πια καλών build (η θεραπεία, όχι ο ισχυρισμός)', () => {
    const measured = GATE.measure();
    expect(measured.records.map((record) => record.file)).not.toContain('i18n-ssr-oracle.yml');
    expect(measured.records.map((record) => record.file)).not.toContain('i18n-shell-slice.yml');
  });
});
