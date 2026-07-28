/**
 * memory-identity.test.js — presubmit anchors για το SSoT ταυτότητας του auto-memory.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ο φάκελος `memory/` **δεν είναι git-tracked** — δεν υπάρχει
 * `git checkout` να γυρίσει πίσω μια λάθος μαζική εγγραφή σε 451 αρχεία. Το μόνο
 * δίχτυ είναι να αποδεικνύεται η λογική ΠΡΙΝ αγγίξει δίσκο. Κάθε test εδώ δοκιμάζει
 * και το ΘΕΤΙΚΟ και το ΑΡΝΗΤΙΚΟ σκέλος: ένα gate που δεν αποδείχθηκε ότι κοκκινίζει
 * δεν είναι gate, είναι σχόλιο (CLAUDE.md, ADR-587 §6.1).
 *
 * Τρέξιμο: npm run test:memory-identity
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const NORMALIZER = path.join(REPO, 'scripts', 'memory-normalize-ids.js');
const HEALTH = path.join(REPO, 'scripts', 'memory-health.js');

const store = require('../lib/memory/memory-store');
const graph = require('../lib/memory/memory-graph');

// ── fixtures ────────────────────────────────────────────────────────────────

let dir;

/** Γράφει fixture memory. `eol` εκτίθεται επίτηδες: 14/451 πραγματικά αρχεία είναι CRLF. */
function writeMemory(slug, { name, description = 'μια επαρκώς μεγάλη περιγραφή γεγονότος', body = '', extra = '', eol = '\n' }) {
  const lines = ['---', `name: ${name}`, `description: ${description}`, 'type: reference'];
  if (extra) lines.push(extra);
  lines.push('---', '', body, '');
  fs.writeFileSync(path.join(dir, `${slug}.md`), lines.join(eol), 'utf8');
}

const run = (script, args) => {
  try {
    return {
      code: 0,
      out: execFileSync('node', [script, ...args], {
        cwd: REPO,
        env: { ...process.env, CLAUDE_MEMORY_DIR: dir },
        encoding: 'utf8',
      }),
    };
  } catch (err) {
    return { code: err.status, out: `${err.stdout || ''}${err.stderr || ''}` };
  }
};

const runNormalizer = (args) => run(NORMALIZER, args);

const nameOf = (slug) =>
  store.readField(fs.readFileSync(path.join(dir, `${slug}.md`), 'utf8'), 'name');

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memtest-'));
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '# Index\n', 'utf8');
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

// ── 1. ταυτότητα: normalizeId / canonicalName ───────────────────────────────

describe('normalizeId — το πρόθεμα τύπου φεύγει και από τα ΔΥΟ σκέλη', () => {
  it('εξισώνει filename και name με/χωρίς πρόθεμα', () => {
    expect(graph.normalizeId('feedback_3d_mirror_2d_ssot')).toBe('3d_mirror_2d_ssot');
    expect(graph.normalizeId('3d-mirror-2d-ssot')).toBe('3d_mirror_2d_ssot');
    expect(graph.normalizeId('feedback-3d-mirror-2d-ssot')).toBe('3d_mirror_2d_ssot');
  });

  it('ΔΕΝ ισοπεδώνει διαφορετικά memories (αρνητικό)', () => {
    expect(graph.normalizeId('reference_alpha')).not.toBe(graph.normalizeId('reference_beta'));
  });

  it('δεν κόβει πρόθεμα που δεν είναι τύπος', () => {
    expect(graph.normalizeId('projectile_x')).toBe('projectile_x');
  });

  it('canonicalName = filename με παύλες', () => {
    expect(graph.canonicalName('reference_grip_size_default_ssot')).toBe(
      'reference-grip-size-default-ssot',
    );
  });
});

// ── 2. CRLF: η παγίδα που εξαφάνιζε αρχεία σιωπηλά ──────────────────────────

describe('frontmatter parsing — CRLF ισότιμο με LF', () => {
  it.each([['LF', '\n'], ['CRLF', '\r\n']])('διαβάζει %s', (_label, eol) => {
    writeMemory('reference_eol_case', { name: 'ελεύθερος τίτλος', eol });
    expect(nameOf('reference_eol_case')).toBe('ελεύθερος τίτλος');
  });

  it('η εγγραφή ΔΙΑΤΗΡΕΙ CRLF (δεν κάνει σιωπηλή μετατροπή γραμμών)', () => {
    writeMemory('reference_eol_keep', { name: 'παλιός τίτλος', eol: '\r\n' });
    runNormalizer(['--write']);
    const raw = fs.readFileSync(path.join(dir, 'reference_eol_keep.md'), 'utf8');
    expect(raw).toContain('\r\n');
    expect(raw).not.toMatch(/[^\r]\n/);
    expect(nameOf('reference_eol_keep')).toBe('reference-eol-keep');
  });

  it('επιστρέφει null όταν ΔΕΝ υπάρχει frontmatter (όχι σιωπηλό κενό)', () => {
    expect(store.splitFrontmatter('σκέτο σώμα χωρίς frontmatter')).toBeNull();
    expect(store.readField('σκέτο σώμα', 'name')).toBeNull();
  });
});

// ── 3. setField: μόνο frontmatter, ποτέ σώμα ────────────────────────────────

describe('setField — αγγίζει ΜΟΝΟ το frontmatter', () => {
  it('δεν πειράζει `name:` που ζει σε παράδειγμα τεκμηρίωσης στο σώμα', () => {
    writeMemory('reference_body_guard', {
      name: 'παλιός τίτλος',
      body: 'Παράδειγμα:\n```yaml\nname: μην-με-αγγίξεις\n```',
    });
    runNormalizer(['--write']);
    const raw = fs.readFileSync(path.join(dir, 'reference_body_guard.md'), 'utf8');
    expect(raw).toContain('name: μην-με-αγγίξεις');
    expect(nameOf('reference_body_guard')).toBe('reference-body-guard');
  });

  it('διατηρεί τα πεδία που γράφει το σύστημα auto-memory', () => {
    writeMemory('reference_keep_fields', {
      name: 'παλιός τίτλος',
      extra: 'originSessionId: abc-123',
    });
    runNormalizer(['--write']);
    const raw = fs.readFileSync(path.join(dir, 'reference_keep_fields.md'), 'utf8');
    expect(raw).toContain('originSessionId: abc-123');
    expect(raw).toContain('type: reference');
  });

  it('επιστρέφει null αν το πεδίο δεν υπάρχει — δεν εφευρίσκει πεδία (αρνητικό)', () => {
    expect(store.setField('---\nname: x\n---\n', 'verify', 'grep -q x')).toBeNull();
  });
});

// ── 4. Η ΑΠΟΔΕΙΞΗ: alias-only δείκτης μπλοκάρει την εγγραφή ─────────────────

describe('απόδειξη ασφάλειας δεικτών', () => {
  it('ΠΡΑΣΙΝΟ: δείκτης που λύνεται μέσω filename επιβιώνει της μετονομασίας', () => {
    writeMemory('reference_target', { name: 'Κάποιος Ελεύθερος Τίτλος' });
    writeMemory('reference_source', { name: 'Άλλος Τίτλος', body: '[[reference_target]]' });
    const { code, out } = runNormalizer(['--write']);
    expect(code).toBe(0);
    expect(out).toContain('0 regressions');
    expect(nameOf('reference_target')).toBe('reference-target');
  });

  it('🔴 ΚΟΚΚΙΝΟ: δείκτης που λύνεται ΜΟΝΟ μέσω ελεύθερου τίτλου μπλοκάρει το --write', () => {
    writeMemory('reference_target', { name: 'Ζήτα Μοναδικός Τίτλος' });
    writeMemory('reference_source', { name: 'Πηγή', body: '[[Ζήτα Μοναδικός Τίτλος]]' });
    const { code, out } = runNormalizer(['--write']);
    expect(code).toBe(1);
    expect(out).toContain('REGRESSIONS');
    // Και το κρίσιμο: ΤΙΠΟΤΑ δεν γράφτηκε στον δίσκο.
    expect(nameOf('reference_target')).toBe('Ζήτα Μοναδικός Τίτλος');
    expect(nameOf('reference_source')).toBe('Πηγή');
  });

  it('🔴 ΚΟΚΚΙΝΟ: ανιχνεύει δείκτη που θα άλλαζε ΠΡΟΟΡΙΣΜΟ (χειρότερο από νεκρό)', () => {
    // `reference_alpha` έχει τίτλο που δείχνει στο ΑΛΛΟ αρχείο· μετά τη
    // μετονομασία ο δείκτης [[beta]] θα άλλαζε σιωπηλά προορισμό.
    writeMemory('reference_alpha', { name: 'beta' });
    writeMemory('reference_beta', { name: 'Κάτι Άλλο' });
    writeMemory('reference_src', { name: 'Πηγή', body: '[[beta]]' });
    const { code, out } = runNormalizer(['--write']);
    expect(code).toBe(1);
    expect(out).toMatch(/REGRESSIONS/);
  });

  it('idempotent: δεύτερη εκτέλεση δεν έχει τίποτα να αλλάξει', () => {
    writeMemory('reference_idem', { name: 'Τίτλος' });
    expect(runNormalizer(['--write']).code).toBe(0);
    const { out } = runNormalizer([]);
    expect(out).toContain('0 αρχεία προς αλλαγή');
  });
});

// ── 5. executable provenance: το gate ΠΡΕΠΕΙ να μπορεί να κοκκινίσει ────────

describe('--verify (executable provenance)', () => {
  /** Γράφει memory με `verify:` σε top-level frontmatter (η κανονική θέση). */
  const withVerify = (slug, cmd) =>
    fs.writeFileSync(
      path.join(dir, `${slug}.md`),
      ['---', `name: ${slug.replace(/_/g, '-')}`, 'description: fixture με επαρκές μήκος περιγραφής', `verify: "${cmd}"`, 'type: reference', '---', '', 'σώμα', ''].join('\n'),
      'utf8',
    );

  it('✅ ΠΡΑΣΙΝΟ: αληθής ισχυρισμός περνά, exit 0', () => {
    withVerify('reference_true_claim', 'node -e "process.exit(0)"');
    const { code, out } = run(HEALTH, ['--verify']);
    expect(code).toBe(0);
    expect(out).toContain('0 ΑΠΟΔΕΔΕΙΓΜΕΝΑ ΨΕΥΔΗ');
  });

  it('🔴 ΚΟΚΚΙΝΟ: ψευδής ισχυρισμός → ❌ + exit 1', () => {
    withVerify('reference_false_claim', 'node -e "process.exit(3)"');
    const { code, out } = run(HEALTH, ['--verify']);
    expect(code).toBe(1);
    expect(out).toContain('❌ reference_false_claim');
    expect(out).toContain('1 ΑΠΟΔΕΔΕΙΓΜΕΝΑ ΨΕΥΔΗ');
  });

  it('αγνοεί `verify:` που ζει στο ΣΩΜΑ (παράδειγμα τεκμηρίωσης, όχι assertion)', () => {
    fs.writeFileSync(
      path.join(dir, 'reference_doc_example.md'),
      ['---', 'name: reference-doc-example', 'description: fixture με επαρκές μήκος περιγραφής', 'type: reference', '---', '', 'Παράδειγμα:', '```yaml', 'verify: "node -e \\"process.exit(3)\\""', '```', ''].join('\n'),
      'utf8',
    );
    const { code, out } = run(HEALTH, ['--verify']);
    expect(code).toBe(0);
    expect(out).toContain('0 memories με');
  });
});

// ── 6. όριο ευρετηρίου: η σιωπηλή αποκοπή αποκτά σήμα ───────────────────────

describe('όριο μεγέθους ευρετηρίου', () => {
  const { INDEX_SOFT_LIMIT: SOFT, INDEX_HARD_LIMIT: HARD } = store;

  /**
   * Γράφει ευρετήριο ΑΚΡΙΒΩΣ n bytes. Γεμίζει με ελληνικά (2 bytes/χαρ. σε UTF-8)
   * επίτηδες: αν κάποιος μετρήσει `.length` αντί για bytes, τα tests κοκκινίζουν.
   */
  const writeIndex = (bytes, head = '# Index\n') => {
    const headBytes = Buffer.byteLength(head);
    const fill = 'μ'.repeat(Math.floor((bytes - headBytes) / 2));
    const raw = head + fill + ' '.repeat(bytes - headBytes - Buffer.byteLength(fill));
    fs.writeFileSync(path.join(dir, 'MEMORY.md'), raw, 'utf8');
    expect(Buffer.byteLength(raw)).toBe(bytes); // το fixture αποδεικνύει τον εαυτό του
  };

  it('τα δύο όρια είναι ΤΑ ΟΡΙΑ ΤΟΥ HARNESS σε bytes (17.1 KB / 24.4 KB)', () => {
    expect(SOFT).toBe(Math.floor(17.1 * 1024));
    expect(HARD).toBe(Math.floor(24.4 * 1024));
    expect(SOFT).toBeLessThan(HARD);
  });

  it.each([
    ['ok', 1_000, false],
    ['warn', Math.ceil(SOFT * 0.9) + 10, false],
    ['over', SOFT + 1, true],
    ['critical', HARD + 1, true],
  ])('classifyIndexSize: %s στα %i bytes → blocking=%s', (level, bytes, blocking) => {
    const c = store.classifyIndexSize(bytes);
    expect(c.level).toBe(level);
    expect(c.blocking).toBe(blocking);
  });

  it('το περιθώριο μετράει από το SOFT όριο και γίνεται αρνητικό στην υπέρβαση', () => {
    expect(store.classifyIndexSize(SOFT - 500).margin).toBe(500);
    expect(store.classifyIndexSize(SOFT + 500).margin).toBe(-500);
  });

  it('✅ ΠΡΑΣΙΝΟ: ευρετήριο εντός ορίου → exit 0 + περιθώριο στην αναφορά', () => {
    writeIndex(1_000);
    const { code, out } = run(HEALTH, []);
    expect(code).toBe(0);
    expect(out).toContain('✅');
    expect(out).toContain(`${SOFT} bytes`);
    expect(out).not.toContain('ΜΠΛΟΚ');
  });

  it('⚠️ ΠΡΟΕΙΔΟΠΟΙΗΣΗ: ≥90% του ορίου → σήμα, αλλά ΔΕΝ μπλοκάρει (exit 0)', () => {
    writeIndex(Math.ceil(SOFT * 0.9) + 10);
    const { code, out } = run(HEALTH, []);
    expect(code).toBe(0);
    expect(out).toContain('περιθώριο');
    expect(out).not.toContain('ΜΠΛΟΚ');
  });

  it('🔴 ΚΟΚΚΙΝΟ: 1 byte πάνω από το όριο → exit 1 + αιτία', () => {
    writeIndex(SOFT + 1);
    const { code, out } = run(HEALTH, []);
    expect(code).toBe(1);
    expect(out).toContain('ΥΠΕΡΒΑΣΗ');
    expect(out).toMatch(/ΜΠΛΟΚ.*ευρετήριο/);
  });

  it('🔴 ΚΟΚΚΙΝΟ: πάνω από το hard όριο → δηλώνει ρητά ότι ΑΠΟΚΟΠΤΕΤΑΙ ΗΔΗ', () => {
    writeIndex(HARD + 1);
    const { code, out } = run(HEALTH, []);
    expect(code).toBe(1);
    expect(out).toContain('ΑΠΟΚΟΠΤΕΤΑΙ');
  });

  it('🔴 η αιτία φαίνεται ΚΑΙ στα modes χωρίς αναφορά (--json)', () => {
    writeIndex(SOFT + 1);
    const { code, out } = run(HEALTH, ['--json']);
    expect(code).toBe(1);
    expect(out).toMatch(/ΜΠΛΟΚ.*ευρετήριο/);
  });

  it('το verdict γίνεται 🔴 ακόμα κι όταν ΟΛΑ τα άλλα είναι τέλεια', () => {
    // Το memory είναι ΣΥΝΔΕΔΕΜΕΝΟ από το ευρετήριο: 100% προσβάσιμα, 0 typos.
    // Χωρίς αυτό, το 🔴 θα ερχόταν από τα απρόσιτα και το test δεν θα απεδείκνυε τίποτα.
    // Και είναι **hub**: αλλιώς κοκκινίζει και το σχήμα, και το «ΜΟΝΗ αιτία» πέφτει.
    writeMemory('reference_solo_hub', { name: 'reference-solo-hub' });
    writeIndex(SOFT + 1, '# Index\n- [[reference_solo_hub]]\n');
    const { code, out } = run(HEALTH, []);
    expect(out).toContain('Προσβάσιμα (BFS)       : 1  (100%)');
    expect(out).toContain('🔴 ΝΟΣΕΙ');
    expect(code).toBe(1);
    // ...και η ΜΟΝΗ αιτία είναι το ευρετήριο.
    expect(out).toMatch(/ΜΠΛΟΚ: ευρετήριο[^·]*$/m);
  });
});

// ── 7. presubmit gate (CHECK 3.31) ──────────────────────────────────────────

/**
 * ΣΧΗΜΑ ευρετηρίου — γιατί χωριστό gate από το ΜΕΓΕΘΟΣ:
 * το μέγεθος χτυπά αφού γεμίσει (και σε στέλνει σε νέο γύρο συμπύκνωσης)· το σχήμα
 * δεν το αφήνει να γεμίσει. Ένα ευρετήριο 1 KB με 40 μεμονωμένα memories περνά κάθε
 * έλεγχο όγκου και είναι ήδη στον δρόμο προς το όριο — γι' αυτό ελέγχεται ΞΕΧΩΡΙΣΤΑ.
 */
describe('σχήμα ευρετηρίου — μόνο hubs', () => {
  const index = (...links) =>
    fs.writeFileSync(
      path.join(dir, 'MEMORY.md'),
      `# Index\n${links.map((l) => `- [x](${l}.md)\n`).join('')}`,
      'utf8',
    );

  it('✅ ΠΡΑΣΙΝΟ: μόνο hubs → exit 0 + το δηλώνει ρητά', () => {
    writeMemory('reference_alpha_hub', { name: 'reference-alpha-hub' });
    writeMemory('feedback_beta_hub', { name: 'feedback-beta-hub' });
    index('reference_alpha_hub', 'feedback_beta_hub');
    const { code, out } = run(HEALTH, []);
    expect(code).toBe(0);
    expect(out).toContain('σχήμα: μόνο hubs');
    expect(out).not.toContain('ΜΠΛΟΚ');
  });

  it('🔴 ΚΟΚΚΙΝΟ: ΕΝΑ μεμονωμένο memory στη ρίζα → exit 1 + το κατονομάζει', () => {
    writeMemory('reference_alpha_hub', { name: 'reference-alpha-hub' });
    writeMemory('reference_loose_fact', { name: 'reference-loose-fact' });
    index('reference_alpha_hub', 'reference_loose_fact');
    const { code, out } = run(HEALTH, []);
    expect(code).toBe(1);
    expect(out).toContain('reference_loose_fact');
    expect(out).toMatch(/ΜΠΛΟΚ.*μεμονωμένα/);
  });

  it('🔴 μικρό ευρετήριο ΔΕΝ αθωώνει το σχήμα (το μέγεθος περνά, το σχήμα κόβει)', () => {
    writeMemory('reference_loose_fact', { name: 'reference-loose-fact' });
    index('reference_loose_fact');
    const { code, out } = run(HEALTH, []);
    expect(fs.statSync(path.join(dir, 'MEMORY.md')).size).toBeLessThan(store.INDEX_SOFT_LIMIT);
    expect(code).toBe(1);
    expect(out).not.toContain('ΥΠΕΡΒΑΣΗ'); // δεν είναι θέμα όγκου
  });

  it('οι δύο εξαιρέσεις (συμβόλαιο + WIP) δεν κοκκινίζουν — είναι by design', () => {
    writeMemory('reference_memory_health_contract', { name: 'reference-memory-health-contract' });
    writeMemory('project_active_handoff_state', { name: 'project-active-handoff-state' });
    index('reference_memory_health_contract', 'project_active_handoff_state');
    expect(run(HEALTH, []).code).toBe(0);
  });
});

describe('--gate (presubmit, CHECK 3.31)', () => {
  const { INDEX_SOFT_LIMIT: SOFT, INDEX_HARD_LIMIT: HARD } = store;
  const fillIndex = (bytes) =>
    fs.writeFileSync(path.join(dir, 'MEMORY.md'), 'μ'.repeat(Math.ceil(bytes / 2)), 'utf8');

  it('✅ ΠΡΑΣΙΝΟ: εντός ορίου → exit 0, μία γραμμή', () => {
    fillIndex(1_000);
    const { code, out } = run(HEALTH, ['--gate']);
    expect(code).toBe(0);
    expect(out).toContain('✅ memory gate');
  });

  it('🔴 ΚΟΚΚΙΝΟ: πάνω από soft → exit 1 + θεραπεία', () => {
    fillIndex(SOFT + 500);
    const { code, out } = run(HEALTH, ['--gate']);
    expect(code).toBe(1);
    expect(out).toContain('🚫 ΕΥΡΕΤΗΡΙΟ ΜΝΗΜΗΣ');
    expect(out).toContain('Θεραπεία');
    expect(out).not.toContain('ΑΠΟΚΟΠΤΕΤΑΙ ΗΔΗ'); // soft ≠ critical
  });

  it('🔴 ΚΟΚΚΙΝΟ: πάνω από hard → λέει ρητά ότι αποκόπτεται ΗΔΗ', () => {
    fillIndex(HARD + 500);
    const { code, out } = run(HEALTH, ['--gate']);
    expect(code).toBe(1);
    expect(out).toContain('ΑΠΟΚΟΠΤΕΤΑΙ ΗΔΗ');
  });

  it('🔴 ΚΟΚΚΙΝΟ: μεμονωμένο memory στη ρίζα → exit 1 ΚΑΙ στο presubmit', () => {
    // Το ευρετήριο είναι μικρό: αν το gate κοίταζε μόνο bytes, θα περνούσε.
    fs.writeFileSync(path.join(dir, 'MEMORY.md'), '# Index\n- [x](reference_loose_fact.md)\n', 'utf8');
    writeMemory('reference_loose_fact', { name: 'reference-loose-fact' });
    const { code, out } = run(HEALTH, ['--gate']);
    expect(code).toBe(1);
    expect(out).toContain('🚫 ΣΧΗΜΑ ΕΥΡΕΤΗΡΙΟΥ');
    expect(out).toContain('reference_loose_fact');
  });

  it('✅ το ίδιο ευρετήριο με hub αντί για μεμονωμένο → exit 0', () => {
    fs.writeFileSync(path.join(dir, 'MEMORY.md'), '# Index\n- [x](reference_alpha_hub.md)\n', 'utf8');
    writeMemory('reference_alpha_hub', { name: 'reference-alpha-hub' });
    expect(run(HEALTH, ['--gate']).code).toBe(0);
  });

  /**
   * Ο φάκελος memory ΔΕΝ είναι git-tracked → σε CI/άλλο μηχάνημα λείπει.
   * Skip, ΟΧΙ fail: αλλιώς το gate κοκκινίζει παντού και το παρακάμπτουν μόνιμα.
   */
  it('⏭️ SKIP: χωρίς φάκελο → exit 0, δεν μπλοκάρει (CI-safe)', () => {
    const missing = path.join(os.tmpdir(), 'memtest-does-not-exist-12345');
    expect(fs.existsSync(missing)).toBe(false);
    const { code, out } = (() => {
      try {
        return {
          code: 0,
          out: execFileSync('node', [HEALTH, '--gate'], {
            cwd: REPO,
            env: { ...process.env, CLAUDE_MEMORY_DIR: missing },
            encoding: 'utf8',
          }),
        };
      } catch (err) {
        return { code: err.status, out: `${err.stdout || ''}${err.stderr || ''}` };
      }
    })();
    expect(code).toBe(0);
    expect(out).toContain('skip');
  });

  it('🔴 --full: γράφος σπασμένος (απρόσιτα >25%) → exit 1', () => {
    writeMemory('reference_orphan_a', { name: 'reference-orphan-a' });
    writeMemory('reference_orphan_b', { name: 'reference-orphan-b' });
    fs.writeFileSync(path.join(dir, 'MEMORY.md'), '# Index\n', 'utf8');
    const { code, out } = run(HEALTH, ['--gate', '--full']);
    expect(code).toBe(1);
    expect(out).toContain('ΓΡΑΦΟΣ ΜΝΗΜΗΣ');
  });

  it('το φθηνό gate ΔΕΝ κοιτά τον γράφο (γι αυτό τρέχει σε κάθε commit)', () => {
    writeMemory('reference_orphan_a', { name: 'reference-orphan-a' }); // 100% απρόσιτο
    fs.writeFileSync(path.join(dir, 'MEMORY.md'), '# Index\n', 'utf8');
    expect(run(HEALTH, ['--gate']).code).toBe(0); // ...και όμως περνά: μόνο μέγεθος
    expect(run(HEALTH, ['--gate', '--full']).code).toBe(1);
  });

  /** Presubmit ΔΕΝ εκτελεί εντολές του χρήστη. Ούτε σε --full. */
  it('🔒 ΠΟΤΕ δεν εκτελεί `verify:` — ούτε ψευδές assertion δεν το κοκκινίζει', () => {
    fs.writeFileSync(
      path.join(dir, 'reference_liar_hub.md'),
      ['---', 'name: reference-liar-hub', 'description: fixture με επαρκές μήκος περιγραφής', 'verify: "node -e \\"process.exit(3)\\""', 'type: reference', '---', '', 'σώμα', ''].join('\n'),
      'utf8',
    );
    fs.writeFileSync(path.join(dir, 'MEMORY.md'), '# Index\n- [[reference_liar_hub]]\n', 'utf8');
    expect(run(HEALTH, ['--gate', '--full']).code).toBe(0);
    expect(run(HEALTH, ['--verify']).code).toBe(1); // το ίδιο fixture, με ρητό --verify
  });
});

// ── 8. φίλτρο διακριτότητας (memory-suggest-verify) ─────────────────────────

/**
 * Ένα `verify:` που θα περνούσε ούτως ή άλλως δεν αποδεικνύει τίποτα — είναι
 * **θόρυβος που μοιάζει με κάλυψη**. Το φίλτρο είναι όλη η επιφάνεια ρίσκου.
 */
describe('isDistinctive — τι αξίζει να γίνει verify', () => {
  const { isDistinctive, backtickedTokens } = require('../memory-suggest-verify');

  it.each([
    ['GRIP_SIZE_DEFAULT', true, 'CONSTANT_CASE ≥8'],
    ['MAX_BEVEL_FRACTION', true, 'CONSTANT_CASE ≥8'],
    ['resolveRegionLoopTolWorld', true, 'camelCase ≥16'],
    ['BimToThreeConverter', true, 'PascalCase ≥16'],
  ])('δέχεται %s (%s)', (id, want) => expect(isDistinctive(id)).toBe(want));

  it.each([
    ['A_B', 'CONSTANT_CASE αλλά <8 χαρακτήρες'],
    ['getName', 'camelCase αλλά <16'],
    ['useState', 'camelCase <16'],
    ['foo', 'ούτε καν camelCase'],
    ['src/some/path.ts', 'διαδρομή, όχι identifier'],
    ['UPPERCASE', 'χωρίς underscore → δεν είναι CONSTANT_CASE'],
  ])('🔴 απορρίπτει %s (%s)', (id) => expect(isDistinctive(id)).toBe(false));

  /**
   * ΤΟ ΚΡΙΣΙΜΟ: αυτά περνούν ΟΛΑ τα φίλτρα σχήματος/μήκους — μόνο το blacklist τα
   * κόβει. Αν το blacklist πεθάνει, ΑΥΤΑ τα tests κοκκινίζουν (mutation-verified).
   */
  it.each([
    ['NODE_ENV', 'CONSTANT_CASE ακριβώς 8 — υπάρχει παντού'],
    ['MAX_SAFE_INTEGER', 'CONSTANT_CASE 16'],
    ['addEventListener', 'camelCase 16 — DOM API σε εκατοντάδες αρχεία'],
    ['getBoundingClientRect', 'camelCase 21 — DOM API'],
    ['requestAnimationFrame', 'camelCase 21 — DOM API'],
  ])('🔒 blacklist ΖΩΝΤΑΝΟ: κόβει %s (%s)', (id) => {
    expect(id.length >= 8).toBe(true); // περνά το μήκος...
    expect(isDistinctive(id)).toBe(false); // ...και όμως απορρίπτεται
  });

  it('backtickedTokens παίρνει ΜΟΝΟ ό,τι είναι σε backticks', () => {
    const t = backtickedTokens('κείμενο `FOO_BAR` και `file.ts` αλλά όχι BAZ_QUX');
    expect(t).toEqual(['FOO_BAR', 'file.ts']);
  });
});

// ── 9. reachability BFS ─────────────────────────────────────────────────────

describe('computeReachability', () => {
  it('μετράει βάθος σωστά και εκθέτει τα απρόσιτα', () => {
    writeMemory('reference_a', { name: 'reference-a', body: '[[reference_b]]' });
    writeMemory('reference_b', { name: 'reference-b', body: '' });
    writeMemory('reference_orphan', { name: 'reference-orphan', body: '' });
    fs.writeFileSync(path.join(dir, 'MEMORY.md'), '# Index\n- [[reference_a]]\n', 'utf8');

    const slugs = new Set(['reference_a', 'reference_b', 'reference_orphan']);
    const read = (s) => fs.readFileSync(path.join(dir, `${s}.md`), 'utf8');
    const alias = graph.buildAliasMap(slugs, (s) => store.readField(read(s), 'name'));
    const { depth } = graph.computeReachability(
      fs.readFileSync(path.join(dir, 'MEMORY.md'), 'utf8'),
      alias,
      read,
    );

    expect(depth.get('reference_a')).toBe(1);
    expect(depth.get('reference_b')).toBe(2);
    expect(depth.has('reference_orphan')).toBe(false);
  });

  it('extractLinks πιάνει και wikilink και markdown link, όχι σκέτο κείμενο', () => {
    const links = graph.extractLinks('δες [[alpha]] και [κείμενο](beta.md) αλλά όχι gamma');
    expect([...links].sort()).toEqual(['alpha', 'beta']);
  });
});
