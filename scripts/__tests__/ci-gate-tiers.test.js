/**
 * CHECK 3.37 / ADR-757 — Η πύλη που φυλάει τις πύλες.
 *
 * ΔΟΜΗ ΤΩΝ TESTS (η ίδια με τα CHECK 3.34/3.36):
 *   Μ0  — το ΖΩΝΤΑΝΟ δέντρο περνά καθαρό (αγκύρωση παλινδρόμησης)
 *   Μ1..Μ9 — μία ΜΕΤΑΛΛΑΞΗ ανά ρητή κατάσταση· αν η πύλη δεν την πιάσει, δεν είναι πύλη
 *   Π   — ο αναγνώστης YAML είναι ΑΥΣΤΗΡΟΣ (η παγίδα «φάντασμα από σχόλιο», ADR-752)
 *   Κ   — ο πυρήνας κατάστασης: σταθερό κόκκινο ⇒ ΚΑΜΙΑ ειδοποίηση (το αντι-πλημμύρα anchor)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const meta = require('../lib/ci/workflow-meta');
const { auditGateTiers } = require('../lib/ci/gate-registry');
const { parseState, projectGateStatus, diffState, renderBody } = require('../lib/ci/health-state');

const REPO_ROOT = path.join(__dirname, '..', '..');

// ─── Εργαλεία fixture ─────────────────────────────────────────────────────────

const AGGREGATOR = `name: 🚑 CI Health Report

on:
  workflow_run:
    workflows:
      - "T1 🚀 Prod Gate"
    types: [completed]
  schedule:
    - cron: '0 5 * * *'
`;

const BASE_REGISTRY = {
  namePrefix: 'T{tier} ',
  aggregator: { file: 'ci-health-report.yml', name: '🚑 CI Health Report', why: 'ο συγκεντρωτής' },
  tiers: {
    1: { label: 'ΠΑΡΑΓΩΓΗ', policy: 'alert', meaning: 'παραγωγή' },
    2: { label: 'ΟΡΘΟΤΗΤΑ', policy: 'digest', meaning: 'ορθότητα' },
  },
  gates: [
    { file: 'prod.yml', name: 'T1 🚀 Prod Gate', tier: 1, why: 'φράζει την παραγωγή' },
    { file: 'lint.yml', name: 'T2 🧹 Lint Gate', tier: 2, why: 'ορθότητα' },
  ],
};

/**
 * Χτίζει ένα πλήρες, ΚΑΘΑΡΟ δέντρο και εφαρμόζει πάνω του μία μετάλλαξη.
 * @param {(ctx:{dir:string, workflows:string, registry:any, write:(f:string,name:string)=>void, rm:(f:string)=>void}) => void} [mutate]
 */
function tree(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-tiers-'));
  const workflows = path.join(dir, '.github', 'workflows');
  fs.mkdirSync(workflows, { recursive: true });

  const registry = JSON.parse(JSON.stringify(BASE_REGISTRY));
  const write = (file, name) => fs.writeFileSync(path.join(workflows, file), `name: ${name}\n\non:\n  push:\n`);
  const rm = (file) => fs.rmSync(path.join(workflows, file));

  fs.writeFileSync(path.join(workflows, 'ci-health-report.yml'), AGGREGATOR);
  for (const gate of registry.gates) write(gate.file, gate.name);

  if (mutate) mutate({ dir, workflows, registry, write, rm });

  const registryPath = path.join(dir, '.ci-gate-tiers.json');
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  return auditGateTiers({ workflowsDir: workflows, registryPath });
}

const states = (result) => result.findings.map((f) => f.state).sort();

// ─── Μ0 — το ζωντανό δέντρο ───────────────────────────────────────────────────

describe('Μ0 — ζωντανό δέντρο', () => {
  test('το πραγματικό repo δεν έχει ούτε ένα εύρημα', () => {
    const { findings } = auditGateTiers({ repoRoot: REPO_ROOT });
    expect(findings).toEqual([]);
  });

  test('κάθε ενεργό workflow αρχείο έχει εγγραφή — καμία εξαίρεση πλην του συγκεντρωτή', () => {
    const dir = path.join(REPO_ROOT, '.github', 'workflows');
    const { registry } = auditGateTiers({ repoRoot: REPO_ROOT });
    const known = new Set([...registry.gates.map((g) => g.file), registry.aggregator.file]);
    expect(meta.listWorkflowFiles(dir).filter((f) => !known.has(f))).toEqual([]);
  });

  test('υπάρχει ακριβώς ένα Tier 1 και είναι το build της παραγωγής', () => {
    const { registry } = auditGateTiers({ repoRoot: REPO_ROOT });
    const tier1 = registry.gates.filter((g) => g.tier === 1);
    expect(tier1).toHaveLength(1);
    expect(tier1[0].file).toBe('docker-build.yml');
  });

  test('το fixture βασικό δέντρο είναι καθαρό (αλλιώς οι μεταλλάξεις δεν αποδεικνύουν τίποτα)', () => {
    expect(tree().findings).toEqual([]);
  });
});

// ─── Μ1..Μ9 — μία μετάλλαξη ανά ρητή κατάσταση ────────────────────────────────

describe('μεταλλάξεις — κάθε ρητή κατάσταση πιάνεται', () => {
  test('Μ1 unregistered — νέο workflow χωρίς εγγραφή μητρώου', () => {
    const result = tree(({ write }) => write('newborn.yml', 'T2 🆕 Newborn'));
    expect(states(result)).toContain('unregistered');
  });

  test('Μ2 orphan-registry — εγγραφή χωρίς αρχείο', () => {
    const result = tree(({ rm }) => rm('lint.yml'));
    expect(states(result)).toContain('orphan-registry');
  });

  test('Μ3 name-drift — το αρχείο μετονομάστηκε, το μητρώο όχι', () => {
    const result = tree(({ write }) => write('lint.yml', 'T2 🧹 Lint Gate ΜΕΤΟΝΟΜΑΣΜΕΝΟ'));
    expect(states(result)).toContain('name-drift');
  });

  test('Μ4 tier-prefix-drift — όνομα χωρίς το πρόθεμα του tier του', () => {
    const result = tree(({ registry, write }) => {
      registry.gates[1].name = '🧹 Lint Gate';
      write('lint.yml', '🧹 Lint Gate');
    });
    expect(states(result)).toContain('tier-prefix-drift');
  });

  test('Μ5 unwatched-tier1 — ΤΟ ΑΡΧΙΚΟ ΣΦΑΛΜΑ: η πύλη παραγωγής εκτός λίστας', () => {
    const result = tree(({ registry, write }) => {
      registry.gates[0].name = 'T1 🚀 Prod Gate ΑΛΛΟ';
      write('prod.yml', 'T1 🚀 Prod Gate ΑΛΛΟ');
    });
    // Ο συγκεντρωτής παρακολουθεί ακόμα το παλιό όνομα ⇒ και τα δύο σκέλη ανάβουν.
    expect(states(result)).toEqual(expect.arrayContaining(['unwatched-tier1', 'ghost-watch']));
  });

  test('Μ6 ghost-watch — ο συγκεντρωτής παρακολουθεί ανύπαρκτο όνομα', () => {
    const result = tree(({ workflows }) => {
      fs.writeFileSync(
        path.join(workflows, 'ci-health-report.yml'),
        AGGREGATOR.replace('- "T1 🚀 Prod Gate"', '- "T1 🚀 Prod Gate"\n      - "T1 👻 Φάντασμα"')
      );
    });
    expect(states(result)).toContain('ghost-watch');
  });

  test('Μ7 watch-not-tier1 — Tier 2 με σκανδάλη ανά τρέξιμο (σπατάλη runner)', () => {
    const result = tree(({ workflows }) => {
      fs.writeFileSync(
        path.join(workflows, 'ci-health-report.yml'),
        AGGREGATOR.replace('- "T1 🚀 Prod Gate"', '- "T1 🚀 Prod Gate"\n      - "T2 🧹 Lint Gate"')
      );
    });
    expect(states(result)).toContain('watch-not-tier1');
  });

  test('Μ8 invalid-entry — tier εκτός 1..3, `why` κενό, διπλό αρχείο', () => {
    expect(states(tree(({ registry }) => { registry.gates[1].tier = 7; }))).toContain('invalid-entry');
    expect(states(tree(({ registry }) => { registry.gates[1].why = '  '; }))).toContain('invalid-entry');
    expect(states(tree(({ registry }) => { registry.gates.push({ ...registry.gates[1] }); }))).toContain('invalid-entry');
  });

  test('Μ9 no-tier1 — ιεράρχηση χωρίς κορυφή', () => {
    const result = tree(({ registry, rm }) => {
      registry.gates = registry.gates.filter((g) => g.tier !== 1);
      rm('prod.yml');
    });
    expect(states(result)).toContain('no-tier1');
  });

  test('σπασμένο σχήμα μητρώου αναφέρεται ΜΟΝΟ του — χωρίς παράγωγο θόρυβο δίσκου', () => {
    const result = tree(({ registry }) => { registry.gates[1].tier = 7; });
    expect(new Set(states(result))).toEqual(new Set(['invalid-entry']));
  });
});

// ─── Π — ο αναγνώστης YAML ────────────────────────────────────────────────────

describe('αναγνώστης workflow — αυστηρός εξ ορισμού', () => {
  const withFile = (content, fn) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-meta-'));
    const file = path.join(dir, 'w.yml');
    fs.writeFileSync(file, content);
    return fn(file);
  };

  test('διαβάζει όνομα με emoji και παρενθέσεις', () => {
    expect(withFile('name: T2 🧬 jscpd Clone Ratchet (CHECK 3.28)\n', meta.readWorkflowName)).toBe(
      'T2 🧬 jscpd Clone Ratchet (CHECK 3.28)'
    );
  });

  test('🔴 ΔΕΝ διαβάζει όνομα από ΣΧΟΛΙΟ (η παγίδα του ADR-752)', () => {
    const content = '# name: T9 👻 Ψεύτικο\nname: T2 ✅ Αληθινό\n';
    expect(withFile(content, meta.readWorkflowName)).toBe('T2 ✅ Αληθινό');
  });

  test('🔴 ΔΕΝ βάζει στη λίστα παρακολούθησης στοιχείο γραμμένο μέσα σε σχόλιο', () => {
    const content = [
      'name: 🚑 Agg',
      'on:',
      '  workflow_run:',
      '    workflows:',
      '      - "T1 Πραγματικό"',
      '      # - "T1 Σχολιασμένο"',
      '    types: [completed]',
      '',
    ].join('\n');
    expect(withFile(content, meta.readWorkflowRunWatchList)).toEqual(['T1 Πραγματικό']);
  });

  test('η ένταξη γίνεται με ΕΣΟΧΗ: `workflows:` άλλου μπλοκ δεν μετράει', () => {
    const content = [
      'name: 🚑 Agg',
      'on:',
      '  workflow_run:',
      '    workflows:',
      '      - "T1 Σωστό"',
      'jobs:',
      '  build:',
      '    workflows:',
      '      - "T1 Λάθος μπλοκ"',
      '',
    ].join('\n');
    expect(withFile(content, meta.readWorkflowRunWatchList)).toEqual(['T1 Σωστό']);
  });

  test('workflow χωρίς `workflow_run` επιστρέφει κενή λίστα, δεν πετάει', () => {
    expect(withFile('name: X\non:\n  push:\n    branches: [main]\n', meta.readWorkflowRunWatchList)).toEqual([]);
  });

  test('workflow χωρίς `name:` ΠΕΤΑΕΙ — απαρακολούθητο εξ ορισμού', () => {
    expect(() => withFile('on:\n  push:\n', meta.readWorkflowName)).toThrow(/name/);
  });

  test('`#` μέσα σε τιμή με εισαγωγικά διατηρείται· εκτός εισαγωγικών κόβεται', () => {
    expect(meta.scalar('"A # B"')).toBe('A # B');
    expect(meta.scalar('A # σχόλιο')).toBe('A');
  });

  test('τα .disabled αρχεία δεν είναι ενεργά workflows', () => {
    const dir = path.join(REPO_ROOT, '.github', 'workflows');
    expect(meta.listWorkflowFiles(dir).some((f) => f.endsWith('.disabled'))).toBe(false);
  });
});

// ─── Κ — ο πυρήνας κατάστασης ─────────────────────────────────────────────────

const run = (n, conclusion, sha, at) => ({
  conclusion,
  run_number: n,
  html_url: `https://x/${n}`,
  head_sha: sha,
  updated_at: at,
  actor: { login: 'YorgosPag' },
});

describe('πυρήνας κατάστασης — προβολή, όχι συσσώρευση', () => {
  test('κόκκινη πύλη: ανεβαίνει στο ΠΡΩΤΟ συνεχόμενο κόκκινο (culprit attribution)', () => {
    const status = projectGateStatus([
      run(9, 'failure', 'ccccccccdd', '2026-08-05T10:00:00Z'),
      run(8, 'failure', 'bbbbbbbbdd', '2026-08-04T10:00:00Z'),
      run(7, 'success', 'aaaaaaaadd', '2026-08-03T10:00:00Z'),
      run(6, 'failure', '99999999dd', '2026-08-02T10:00:00Z'),
    ]);
    expect(status.sha).toBe('cccccccc');
    expect(status.sinceSha).toBe('bbbbbbbb'); // ΟΧΙ το παλιότερο άσχετο κόκκινο
  });

  test('πράσινη πύλη δεν έχει `sinceSha`', () => {
    expect(projectGateStatus([run(2, 'success', 'aaaaaaaadd', 'τ')]).sinceSha).toBeUndefined();
  });

  test('πύλη χωρίς τρεξίματα = ρητά «άγνωστη», όχι σιωπηλή παράλειψη', () => {
    expect(projectGateStatus([]).conclusion).toBe('unknown');
  });

  test('🔴 ΣΤΑΘΕΡΟ ΚΟΚΚΙΝΟ ⇒ ΚΑΜΙΑ ΜΕΤΑΒΑΣΗ ⇒ ΚΑΜΙΑ ΕΙΔΟΠΟΙΗΣΗ (το αντι-πλημμύρα anchor)', () => {
    const state = { gates: { A: { tier: 2, conclusion: 'failure' } } };
    expect(diffState(state, state)).toEqual({ broke: [], fixed: [] });
  });

  test('πράσινο→κόκκινο = έσπασε · κόκκινο→πράσινο = αποκαταστάθηκε', () => {
    const previous = { gates: { A: { tier: 1, conclusion: 'success' }, B: { tier: 2, conclusion: 'failure' } } };
    const next = { gates: { A: { tier: 1, conclusion: 'failure' }, B: { tier: 2, conclusion: 'success' } } };
    const { broke, fixed } = diffState(previous, next);
    expect(broke.map((g) => g.name)).toEqual(['A']);
    expect(fixed.map((g) => g.name)).toEqual(['B']);
  });

  test('άγνωστη προηγούμενη κατάσταση + κόκκινο = «έσπασε» (η σιωπή θα ήταν αόρατη αποτυχία)', () => {
    const { broke } = diffState({ gates: {} }, { gates: { A: { tier: 1, conclusion: 'failure' } } });
    expect(broke).toHaveLength(1);
  });

  test('η κατάσταση επιβιώνει γύρο σώματος issue (render → parse)', () => {
    const state = { version: 1, updatedAt: '2026-08-05T05:00:00Z', gates: { 'T1 🚀 P': { tier: 1, file: 'p.yml', conclusion: 'failure', sinceSha: 'deadbeef' } } };
    const parsed = parseState(renderBody(state, BASE_REGISTRY));
    expect(parsed.gates['T1 🚀 P'].sinceSha).toBe('deadbeef');
  });

  test('κατεστραμμένο σώμα ⇒ κενή κατάσταση, όχι κατάρρευση', () => {
    expect(parseState('<!-- ci-health-state {σκουπίδια -->').gates).toEqual({});
    expect(parseState('').gates).toEqual({});
    expect(parseState(undefined).gates).toEqual({});
  });

  test('το σώμα δείχνει κάθε tier του μητρώου, με το πλήθος κόκκινων', () => {
    const state = {
      version: 1,
      updatedAt: 'τ',
      gates: { 'T1 🚀 Prod Gate': { tier: 1, conclusion: 'failure' }, 'T2 🧹 Lint Gate': { tier: 2, conclusion: 'success' } },
    };
    const body = renderBody(state, BASE_REGISTRY);
    expect(body).toContain('Tier 1 — ΠΑΡΑΓΩΓΗ (1/1 κόκκινες)');
    expect(body).toContain('Tier 2 — ΟΡΘΟΤΗΤΑ (0/1 κόκκινες)');
  });
});
