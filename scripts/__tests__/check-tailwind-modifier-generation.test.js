/**
 * CHECK 3.116 (ADR-940) — η πύλη του σιωπηλά πεταμένου modifier.
 *
 * Η σουίτα **εκτελεί** τη μηχανή του Tailwind του repo (όχι mock): ένα mock του `getClassOrder` θα έκρινε
 * τη δική μας υπόθεση για τον compiler, δηλαδή ακριβώς τη «δεύτερη αλήθεια» που η πύλη υπάρχει για να μην έχει.
 *
 *   Π  — βαθμονόμηση σε ΠΡΑΓΜΑΤΙΚΟ ιστορικό: `0de6dc9e` (πριν τη διόρθωση) ⇒ 7 · `aec900e2` (μετά) ⇒ 0.
 *        ⚠️ ΚΑΡΦΩΜΕΝΑ commits, ΠΟΤΕ `HEAD`· το `gitShow` ΣΚΑΕΙ σε κενή απάντηση.
 *   Μ  — μεταλλάξεις στην ΕΙΣΟΔΟ: κάθε μορφή, μία-μία (κόκκινο / πράσινο / εκτός εμβέλειας).
 *   Κ  — το συμβόλαιο: fail-closed, κλειστή λογιστική, εμβέλεια = content του build χωρίς tests.
 *   Ξ  — το ξεχασμένο αρχείο (ADR-940 §9): εκτός `content` ΧΩΡΙΣ δηλωμένη εξαίρεση ⇒ ⛔· μετάλλαξη σε μίνι-repo.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const { loadTailwindEngine } = require('../lib/tailwind/engine');
const { judgeText, splitModifier, STATES } = require('../lib/tailwind/modifier-generation');
const { measure, inScope, isForgotten, collectForgotten } = require('../check-tailwind-modifier-generation');

/** Πριν και μετά τη διόρθωση `/12 → /10` (ADR-770 §11). */
const BEFORE = '0de6dc9e';
const AFTER = 'aec900e2';
const FIXED_FILES = {
  'src/components/dashboard/NavigationCard.tsx': [46, 61, 66, 71],
  'src/components/dashboard/QuickActionsStrip.tsx': [35],
  'src/design-system/stat-tone.ts': [53, 57],
};

function gitShow(rev, repoPath) {
  const out = execFileSync('git', ['show', `${rev}:${repoPath}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (!out || out.trim() === '') throw new Error(`Το \`git show ${rev}:${repoPath}\` δεν επέστρεψε τίποτα — το test δεν εκτέλεσε κώδικα.`);
  return out;
}

let engine;
beforeAll(() => { engine = loadTailwindEngine(REPO); });

const dropped = (text) => judgeText(text, engine).candidates.filter((c) => c.state === STATES.DROPPED);
const stateOf = (cls) => {
  const hit = judgeText(`<div className="${cls}" />`, engine).candidates.find((c) => c.token === cls);
  return hit ? hit.state : 'no-candidate';
};

describe('Π — οι ΠΡΑΓΜΑΤΙΚΟΙ πεταμένοι modifiers του ADR-770 §11', () => {
  it.each(Object.entries(FIXED_FILES))('%s: μπλοκ ΠΡΙΝ τη διόρθωση, στις σωστές γραμμές', (file, lines) => {
    const hits = dropped(gitShow(BEFORE, file));
    expect(hits.map((h) => h.line).sort((a, b) => a - b)).toEqual(lines);
    for (const h of hits) expect(h.modifier).toBe('12');
  });

  it.each(Object.keys(FIXED_FILES))('%s: καθαρό ΜΕΤΑ τη διόρθωση', (file) => {
    expect(dropped(gitShow(AFTER, file))).toEqual([]);
  });
});

describe('Μ — μεταλλάξεις, μία-μία', () => {
  it.each([
    ['bg-[hsl(var(--hue-purple))]/12', STATES.DROPPED],
    ['bg-primary/12', STATES.DROPPED],
    ['group-hover/card:bg-primary/12', STATES.DROPPED],
    ['text-sm/13', STATES.DROPPED],
    ['bg-[hsl(var(--hue-purple))]/10', STATES.GENERATED],
    ['bg-primary/[0.12]', STATES.GENERATED],
    ['hover:bg-primary/20', STATES.GENERATED],
    ['w-1/12', STATES.GENERATED],
    ['text-sm/7', STATES.GENERATED],
  ])('%s → %s', (cls, state) => {
    expect(stateOf(cls)).toBe(state);
  });

  it.each(['group/card', 'peer/menu-button', 'grid/tile'])(
    '%s — ονομασμένη ομάδα / πρόζα: ΔΕΝ είναι modifier τιμής, δεν κρίνεται',
    (cls) => { expect(stateOf(cls)).toBe('no-candidate'); },
  );

  it('ο modifier ΔΕΝ ψάχνεται μέσα σε αυθαίρετη τιμή ούτε στις παραλλαγές', () => {
    expect(splitModifier('bg-[rgb(0_0_0/0.5)]')).toBeNull();
    expect(splitModifier('group-hover/card:bg-primary')).toBeNull();
    expect(splitModifier('dark:hover:bg-primary/12')).toEqual({ base: 'dark:hover:bg-primary', modifier: '12' });
  });
});

describe('Κ — το συμβόλαιο της πύλης', () => {
  it('Κ1: config που δεν φορτώνεται ⇒ ΣΚΑΕΙ (fail-closed), ποτέ «καθαρό»', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-gate-'));
    try {
      expect(() => loadTailwindEngine(empty)).toThrow(/fail-closed/);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it('Κ2: εμβέλεια = content του build (ΟΛΟ το src/), χωρίς tests', () => {
    const accept = inScope(engine);
    expect(accept('src/components/dashboard/NavigationCard.tsx')).toBe(true);
    expect(accept('src/design-system/stat-tone.ts')).toBe(true);
    expect(accept('src/utils/contactFormUtils.ts')).toBe(true);
    expect(accept('src/components/__tests__/x.test.tsx')).toBe(false);
    expect(accept('scripts/not-in-src.js')).toBe(false);
  });

  it('Κ3: κλειστή λογιστική — κάθε υποψήφια σε ΕΝΑΝ κάδο, και το μπλοκ φέρει αρχείο:γραμμή', () => {
    const files = { 'a.tsx': 'const a = "bg-primary/12 bg-primary/10 w-1/12";\nconst b = "x/12";' };
    const input = { read: (f) => (f in files ? files[f] : null) };
    const m = measure(Object.keys(files), { input, engine });
    const summed = Object.values(m.ledger).reduce((s, n) => s + n, 0);
    expect(summed).toBe(m.total);
    expect(m.ledger[STATES.DROPPED]).toBe(1);
    expect(m.blocked[0]).toMatchObject({ file: 'a.tsx', line: 1, token: 'bg-primary/12' });
  });

  it('Κ4: το `gitShow` ΣΚΑΕΙ σε ανύπαρκτη διαδρομή — ποτέ σιωπηλά πράσινο test', () => {
    expect(() => gitShow(BEFORE, 'src/δεν/υπαρχει.tsx')).toThrow();
  });
});

/**
 * Ξ — το δεύτερο κριτήριο: το ΞΕΧΑΣΜΕΝΟ αρχείο (ADR-940 §9). Κλάση σε αρχείο εκτός `content` δεν παράγεται ΠΟΤΕ·
 * κάθε αρχείο του `src/` είτε σαρώνεται είτε ταιριάζει σε ΔΗΛΩΜΕΝΗ εξαίρεση `!…`.
 * Οι μεταλλάξεις τρέχουν σε μίνι-repo με ΠΡΑΓΜΑΤΙΚΟ `tailwind.config.ts` (η μηχανή εκτελείται, όχι mock).
 */
describe('Ξ — το ξεχασμένο αρχείο', () => {
  /** Το ιστορικό σφάλμα: τα `.tsx` του design-system + αρχεία κλάσεων του `lib`/`config`/`constants`. */
  const ONCE_FORGOTTEN = [
    'src/design-system/components/ListCard/ListCard.tsx',
    'src/design-system/primitives/Card/CardSelectionIndicator.tsx',
    'src/lib/status-helpers.ts',
    'src/config/study-groups-config.ts',
    'src/constants/contacts.ts',
  ];

  it('Ξ1: με το config του repo, τα ΠΑΛΑΙ ξεχασμένα σαρώνονται και τίποτα δεν είναι ξεχασμένο', () => {
    const forgotten = isForgotten(engine);
    for (const f of ONCE_FORGOTTEN) {
      expect(engine.isContentFile(f)).toBe(true);
      expect(forgotten(f)).toBe(false);
    }
  });

  it('Ξ2: τα tests είναι ΔΗΛΩΜΕΝΑ εκτός (εξαίρεση `!…`), όχι ξεχασμένα', () => {
    for (const f of ['src/components/__tests__/x.test.tsx', 'src/lib/a.spec.ts', 'src/hooks/__tests__/h.tsx']) {
      expect(engine.isContentFile(f)).toBe(false);
      expect(engine.isExcludedFile(f)).toBe(true);
      expect(isForgotten(engine)(f)).toBe(false);
    }
  });

  describe('μετάλλαξη: config που ΣΤΕΝΕΥΕΙ ξανά σε λίστα φακέλων', () => {
    let root;
    let narrow;
    beforeAll(() => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-forgotten-'));
      fs.writeFileSync(path.join(root, 'tailwind.config.ts'), `export default {
  content: ['./src/components/**/*.{ts,tsx}', './src/design-system/**/*.ts', '!./src/**/__tests__/**'],
  theme: { extend: {} },
};
`);
      narrow = loadTailwindEngine(root);
    });
    afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

    it.each([
      ['src/design-system/components/ListCard/ListCard.tsx', true],
      ['src/lib/status-helpers.ts', true],
      ['src/components/Button.tsx', false],
      ['src/components/__tests__/Button.test.tsx', false],
      ['scripts/tool.js', false],
      ['src/lib/data.json', false],
    ])('%s → ξεχασμένο: %s', (rel, expected) => {
      expect(isForgotten(narrow)(rel)).toBe(expected);
    });

    it('η πλήρης σάρωση μαζεύει ΜΟΝΟ τα ξεχασμένα, από την είσοδο της πύλης', () => {
      const tree = ['src/components/Button.tsx', 'src/lib/status-helpers.ts',
        'src/components/__tests__/Button.test.tsx', 'src/design-system/primitives/Card/CardIcon.tsx'];
      const input = { files: (_roots, { accept }) => tree.filter(accept), rel: (f) => f };
      expect(collectForgotten(input, narrow)).toEqual(['src/lib/status-helpers.ts', 'src/design-system/primitives/Card/CardIcon.tsx']);
    });
  });
});
