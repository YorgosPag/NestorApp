/**
 * @jest-environment node
 *
 * =============================================================================
 * CHECK 3.55 (ADR-785) — ΟΙ ΑΓΚΥΡΕΣ
 * =============================================================================
 *
 * ⚠️ **ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΕΙΝΑΙ ΣΤΙΣ ΕΙΣΟΔΟΥΣ, ΟΧΙ ΣΤΗΝ ΠΥΛΗ** (πρότυπο CHECK 3.44):
 * κάθε `Μ` φτιάχνει μίνι-repo από **πραγματικά σχήματα του δέντρου** και αλλάζει
 * **μία** γραμμή. Ο βοηθός `miniRepo` **ουρλιάζει** αν η μετάλλαξη δεν άλλαξε
 * τίποτα — μια μετάλλαξη που δεν αλλάζει συμπεριφορά δεν αποδεικνύει τίποτα
 * (μάθημα CHECK 3.40 `Μ6`).
 *
 * ⚠️ Το `Π1` βαθμονομεί σε **ΠΡΑΓΜΑΤΙΚΟ ΙΣΤΟΡΙΚΟ** με **καρφωμένο** commit — ποτέ
 * `HEAD`: το `HEAD` μετακινείται και η άγκυρα θα αυτοακυρωνόταν σιωπηλά
 * (μάθημα CHECK 3.41). Είναι η έκδοση του αρχείου που **όντως έριξε** το CI.
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const J = require('../lib/prerender/judge');
const { analyzeModule } = require('../lib/prerender/analyze-module');
const RT = require('../lib/prerender/route-tree');

const REPO = path.resolve(__dirname, '..', '..');
const GIT = process.platform === 'win32' ? 'C:/Program Files/Git/cmd/git.exe' : 'git';

/** Το commit που περιέχει την έκδοση η οποία ΕΡΙΞΕ το `docker-build.yml`. */
const PINNED = '90b4c13e';

// ─── Βοηθοί ──────────────────────────────────────────────────────────────────

function gitShow(rev, file) {
  const out = execFileSync(GIT, ['show', `${rev}:${file}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (!out || out.trim() === '') throw new Error(`gitShow κενό για ${rev}:${file} — η άγκυρα δεν έχει είσοδο`);
  return out;
}

const TSCONFIG = JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] } } }, null, 2);

/**
 * Μίνι-repo στον δίσκο. `files` = { 'src/app/x/page.tsx': '…' }.
 * @returns {{root: string, judge: () => object, cleanup: () => void}}
 */
function miniRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-gate-'));
  fs.writeFileSync(path.join(root, 'tsconfig.base.json'), TSCONFIG);
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return {
    root,
    judge: () => J.judgeAll(root),
    /**
     * ⚠️ Ουρλιάζει αν η μετάλλαξη δεν άλλαξε τίποτα.
     *
     * 🔑 **Ο κανόνας ζει στο `./_mutate` (2026-08-30)**, μαζί με άλλα έξι σημεία. Προσωρινό
     * δέντρο ⇒ καμία επαναφορά ⇒ καλείται ο **καθαρός** κανόνας.
     *
     * 🔴 **ΚΑΙ ΕΔΩ Η ΣΗΜΑΣΙΟΛΟΓΙΑ ΕΓΙΝΕ ΡΗΤΗ**: το παλιό `split(from).join(to)` άλλαζε
     * **ΟΛΕΣ** τις εμφανίσεις — σωστό για αυτές τις άγκυρες *(που σπέρνουν το ίδιο μοτίβο σε
     * πολλές διαδρομές)*, αλλά **πουθενά γραμμένο**. Ο κοινός κανόνας απαγορεύει την ασάφεια
     * εκ κατασκευής, οπότε το «όλες» **δηλώνεται** (`all: true`) αντί να συμβαίνει σιωπηλά.
     * Χωρίς τη δήλωση θα ούρλιαζε — και θα είχε δίκιο.
     */
    mutate(rel, from, to) {
      const abs = path.join(root, rel);
      fs.writeFileSync(abs, mutateText(fs.readFileSync(abs, 'utf8'), from, to, { all: true, label: rel }));
    },
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

const { mutateText } = require('./_mutate');

function statesOf(result) {
  return Object.fromEntries(result.records.map(r => [r.file, r.state]));
}

const HOOK_PAGE = `'use client';
import { useSearchParams } from 'next/navigation';
export default function Page() {
  const p = useSearchParams();
  return <main>{p.get('x')}</main>;
}
`;

const WRAPPED_PAGE = `'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
function Body() {
  const p = useSearchParams();
  return <span>{p.get('x')}</span>;
}
export default function Page() {
  return <main><Suspense fallback={null}><Body /></Suspense></main>;
}
`;

// ─── Μ0: το πραγματικό δέντρο ────────────────────────────────────────────────

describe('Μ0 — το ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  let result;
  beforeAll(() => { result = J.judgeAll(REPO); });

  it('καμία ρίζα δεν είναι μη-προαποδόσιμη (η παραγωγή μπορεί να φύγει)', () => {
    const blocked = result.records.filter(r => J.ZERO_TOLERANCE.includes(r.state));
    expect(blocked.map(r => `${r.state} ${r.file}`)).toEqual([]);
  });

  it('η λογιστική κλείνει — κάθε ρίζα σε ακριβώς έναν κάδο', () => {
    const summed = Object.values(result.census).reduce((a, b) => a + b, 0);
    expect(summed).toBe(result.records.length);
    expect(result.records.length).toBeGreaterThan(100);
  });

  it('ΚΑΘΕ κατάσταση του κλειστού συνόλου υπάρχει στην απογραφή, ακόμη και στο μηδέν', () => {
    for (const state of J.ALL_STATES) expect(result.census).toHaveProperty(state);
  });

  it('το /auth/action φρουρείται πλέον από ΔΙΚΟ ΤΟΥ όριο (όχι από loading.tsx)', () => {
    const record = result.records.find(r => r.file.endsWith('(auth)/auth/action/page.tsx'));
    expect(record.state).toBe(J.STATES.INLINE_GUARDED);
    expect(record.hostileInClosure).toBe(true);
  });
});

// ─── Π: βαθμονόμηση σε πραγματικό ιστορικό ───────────────────────────────────

describe('Π — βαθμονόμηση στο commit που ΕΡΙΞΕ την παραγωγή', () => {
  it('Π1: η ιστορική έκδοση του /auth/action ΜΠΛΟΚΑΡΕΤΑΙ, και ονομάζεται', () => {
    const historical = gitShow(PINNED, 'src/app/(auth)/auth/action/page.tsx');
    const repo = miniRepo({
      'src/app/(auth)/layout.tsx': `'use client';\nexport default function L({ children }) { return <div>{children}</div>; }\n`,
      'src/app/(auth)/auth/action/page.tsx': historical,
    });
    try {
      const { records } = repo.judge();
      const page = records.find(r => r.file.endsWith('action/page.tsx'));
      expect(page.state).toBe(J.STATES.BAILOUT);
      expect(page.hits[0].api).toBe('useSearchParams');
      expect(page.url).toBe('/auth/action');
    } finally {
      repo.cleanup();
    }
  });

  // ⚠️ Η ΕΡΩΤΗΣΗ ΕΙΝΑΙ Η ΕΤΥΜΗΓΟΡΙΑ, ΟΧΙ ΤΟ ΚΕΙΜΕΝΟ. Η πρώτη γραφή αυτού του
  // test έψαχνε τη συμβολοσειρά «useSearchParams» και **κοκκίνιζε στο σχόλιο**
  // που τεκμηριώνει τη διόρθωση — δηλαδή τιμωρούσε την τεκμηρίωση της θεραπείας
  // (ίδιο σχήμα με το `Κ7β` της CHECK 3.50: σχόλιο που περιγράφει τη βλάβη δεν
  // είναι η βλάβη).
  it('Π2: η ΣΗΜΕΡΙΝΗ έκδοση του ίδιου αρχείου κρίνεται φρουρημένη', () => {
    const current = fs.readFileSync(path.join(REPO, 'src/app/(auth)/auth/action/page.tsx'), 'utf8');
    const repo = miniRepo({
      'src/auth/components/AuthActionContent.tsx': fs.readFileSync(
        path.join(REPO, 'src/auth/components/AuthActionContent.tsx'), 'utf8'),
      'src/auth/index.ts': `export { AuthActionContent } from './components/AuthActionContent';\n`,
      'src/core/states/index.ts': `export function StaticPageLoading() { return <p>...</p>; }\n`,
      'src/app/(auth)/auth/action/page.tsx': current,
    });
    try {
      const page = repo.judge().records[0];
      expect(page.state).toBe(J.STATES.INLINE_GUARDED);
      // …και ο περίπατος ΟΝΤΩΣ έφτασε στο hook — αλλιώς θα ήταν κενή απόδειξη.
      expect(page.hostileInClosure).toBe(true);
    } finally {
      repo.cleanup();
    }
  });

  it('Π3: το πρότυπο που ήδη υπήρχε στο δέντρο (oauth/consent) κρίνεται ΣΩΣΤΑ', () => {
    const consent = fs.readFileSync(path.join(REPO, 'src/app/(auth)/oauth/consent/page.tsx'), 'utf8');
    const repo = miniRepo({ 'src/app/(auth)/oauth/consent/page.tsx': consent });
    try {
      const page = repo.judge().records[0];
      expect(page.state).toBe(J.STATES.INLINE_GUARDED);
      expect(page.hostileInClosure).toBe(true);
    } finally {
      repo.cleanup();
    }
  });
});

// ─── Κ: το συμβόλαιο ─────────────────────────────────────────────────────────

describe('Κ — το συμβόλαιο της πύλης', () => {
  it('Κ1: loading.tsx σε ΠΡΟΓΟΝΟ τμήμα φρουρεί τη σελίδα', () => {
    const repo = miniRepo({
      'src/app/(app)/loading.tsx': `export default function L() { return <p>...</p>; }\n`,
      'src/app/(app)/deep/nested/page.tsx': HOOK_PAGE,
    });
    try {
      const states = statesOf(repo.judge());
      expect(states['src/app/(app)/deep/nested/page.tsx']).toBe(J.STATES.GUARDED);
    } finally {
      repo.cleanup();
    }
  });

  it('Κ2: loading.tsx ΔΕΝ φρουρεί το layout του ΙΔΙΟΥ τμήματος (τεκμηρίωση Next)', () => {
    const repo = miniRepo({
      'src/app/(app)/loading.tsx': `export default function L() { return <p>...</p>; }\n`,
      'src/app/(app)/layout.tsx': `'use client';
import { useSearchParams } from 'next/navigation';
export default function Layout({ children }) {
  const p = useSearchParams();
  return <div>{p.get('x')}{children}</div>;
}
`,
      'src/app/(app)/page.tsx': `export default function Page() { return <main>ok</main>; }\n`,
    });
    try {
      const states = statesOf(repo.judge());
      expect(states['src/app/(app)/layout.tsx']).toBe(J.STATES.BAILOUT);
      // …ενώ η ΣΕΛΙΔΑ του ίδιου τμήματος φρουρείται κανονικά.
      expect(states['src/app/(app)/page.tsx']).toBe(J.STATES.GUARDED);
    } finally {
      repo.cleanup();
    }
  });

  it('Κ3: <Suspense> γύρω από το εσωτερικό component φρουρεί', () => {
    const repo = miniRepo({ 'src/app/(x)/p/page.tsx': WRAPPED_PAGE });
    try {
      expect(repo.judge().records[0].state).toBe(J.STATES.INLINE_GUARDED);
    } finally {
      repo.cleanup();
    }
  });

  it('Κ4: <Suspense> ΠΑΡΩΝ αλλά γύρω από ΑΛΛΟ πράγμα ⇒ ΠΑΡΑΒΙΑΣΗ (το αφελές κριτήριο πέφτει)', () => {
    const repo = miniRepo({
      'src/app/(x)/p/page.tsx': `'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
function Other() { return <b>other</b>; }
export default function Page() {
  const p = useSearchParams();
  return <main><Suspense fallback={null}><Other /></Suspense>{p.get('x')}</main>;
}
`,
    });
    try {
      expect(repo.judge().records[0].state).toBe(J.STATES.BAILOUT);
    } finally {
      repo.cleanup();
    }
  });

  it('Κ5: το hook μέσα στο `fallback` ΔΕΝ είναι φρουρημένο', () => {
    const repo = miniRepo({
      'src/app/(x)/p/page.tsx': `'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
function Peek() { const p = useSearchParams(); return <i>{p.get('x')}</i>; }
function Body() { return <b>body</b>; }
export default function Page() {
  return <main><Suspense fallback={<Peek />}><Body /></Suspense></main>;
}
`,
    });
    try {
      expect(repo.judge().records[0].state).toBe(J.STATES.BAILOUT);
    } finally {
      repo.cleanup();
    }
  });

  it('Κ6: next/dynamic ΧΩΡΙΣ ssr:false ΔΕΝ είναι φρουρός (ADR-744 §14.2)', () => {
    const repo = miniRepo({
      'src/components/Late.tsx': `'use client';
import { useSearchParams } from 'next/navigation';
export default function Late() { const p = useSearchParams(); return <i>{p.get('x')}</i>; }
`,
      'src/app/(x)/p/page.tsx': `'use client';
import dynamic from 'next/dynamic';
const Late = dynamic(() => import('@/components/Late'), { loading: () => null });
export default function Page() { return <main><Late /></main>; }
`,
    });
    try {
      expect(repo.judge().records[0].state).toBe(J.STATES.BAILOUT);
    } finally {
      repo.cleanup();
    }
  });

  it('Κ7: next/dynamic ΜΕ ssr:false ΕΙΝΑΙ φρουρός', () => {
    const repo = miniRepo({
      'src/components/Late.tsx': `'use client';
import { useSearchParams } from 'next/navigation';
export default function Late() { const p = useSearchParams(); return <i>{p.get('x')}</i>; }
`,
      'src/app/(x)/p/page.tsx': `'use client';
import dynamic from 'next/dynamic';
const Late = dynamic(() => import('@/components/Late'), { ssr: false });
export default function Page() { return <main><Late /></main>; }
`,
    });
    try {
      expect(repo.judge().records[0].state).toBe(J.STATES.CLEAN);
    } finally {
      repo.cleanup();
    }
  });

  it('Κ8: ΜΕΤΑΒΑΤΙΚΟ — το hook σε εισαγμένο παιδί, αφρούρητο ⇒ ΠΑΡΑΒΙΑΣΗ', () => {
    const repo = miniRepo({
      'src/components/Deep.tsx': `'use client';
import { useSearchParams } from 'next/navigation';
export function Deep() { const p = useSearchParams(); return <i>{p.get('x')}</i>; }
`,
      'src/components/Mid.tsx': `'use client';
import { Deep } from '@/components/Deep';
export function Mid() { return <span><Deep /></span>; }
`,
      'src/app/(x)/p/page.tsx': `'use client';
import { Mid } from '@/components/Mid';
export default function Page() { return <main><Mid /></main>; }
`,
    });
    try {
      const page = repo.judge().records[0];
      expect(page.state).toBe(J.STATES.BAILOUT);
      expect(page.hits[0].file).toBe('src/components/Deep.tsx');
    } finally {
      repo.cleanup();
    }
  });

  it('Κ9: force-dynamic ⇒ ονομασμένη κατάσταση, ΟΧΙ σιωπηλό «καθαρό»', () => {
    const repo = miniRepo({
      'src/app/(x)/p/page.tsx': `export const dynamic = 'force-dynamic';\n${HOOK_PAGE}`,
    });
    try {
      expect(repo.judge().records[0].state).toBe(J.STATES.OPTED_OUT);
    } finally {
      repo.cleanup();
    }
  });

  it('Κ10: layout που τυλίγει το {children} σε <Suspense> φρουρεί τις σελίδες του', () => {
    const repo = miniRepo({
      'src/app/(x)/layout.tsx': `'use client';
import { Suspense } from 'react';
export default function L({ children }) { return <div><Suspense fallback={null}>{children}</Suspense></div>; }
`,
      'src/app/(x)/p/page.tsx': HOOK_PAGE,
    });
    try {
      expect(repo.judge().records.find(r => r.file.endsWith('p/page.tsx')).state).toBe(J.STATES.GUARDED);
    } finally {
      repo.cleanup();
    }
  });

  it('Κ11: ανεπίλυτη ακμή απόδοσης ΜΕΤΡΙΕΤΑΙ ΜΕ ΟΝΟΜΑ, δεν πέφτει σιωπηλά', () => {
    const repo = miniRepo({
      'src/app/(x)/p/page.tsx': `'use client';
import { Whatever } from 'some-external-package';
export default function Page() { return <main><Whatever /></main>; }
`,
    });
    try {
      const page = repo.judge().records[0];
      expect(page.unresolved).toBe(1);
      expect(page.unresolvedNames).toEqual(['src/app/(x)/p/page.tsx:Whatever']);
    } finally {
      repo.cleanup();
    }
  });

  it('Κ12: η κλειστή λογιστική ΠΕΤΑΕΙ σε άγνωστη κατάσταση', () => {
    expect(() => J.assertClosed([{ file: 'x', state: 'φανταστική' }])).toThrow(/άγνωστη κατάσταση/);
  });

  it('Κ13: ο ΠΑΡΟΝΟΜΑΣΤΗΣ ξεχωρίζει «φρουρημένο» από «τίποτα να φρουρήσει»', () => {
    const repo = miniRepo({
      'src/app/(app)/loading.tsx': `export default function L() { return <p>...</p>; }\n`,
      'src/app/(app)/hot/page.tsx': HOOK_PAGE,
      'src/app/(app)/cold/page.tsx': `export default function Page() { return <main>ok</main>; }\n`,
    });
    try {
      const byFile = Object.fromEntries(repo.judge().records.map(r => [r.file, r]));
      expect(byFile['src/app/(app)/hot/page.tsx'].hostileInClosure).toBe(true);
      expect(byFile['src/app/(app)/cold/page.tsx'].hostileInClosure).toBe(false);
      // …και οι ΔΥΟ είναι «guarded-by-route» — γι' αυτό ο παρονομαστής χρειάζεται.
      expect(byFile['src/app/(app)/hot/page.tsx'].state).toBe(J.STATES.GUARDED);
      expect(byFile['src/app/(app)/cold/page.tsx'].state).toBe(J.STATES.GUARDED);
    } finally {
      repo.cleanup();
    }
  });

  it('Κ14: το `not-found.tsx` κρίνεται κι αυτό (πρόκειται για προαποδιδόμενη ρίζα)', () => {
    const repo = miniRepo({ 'src/app/not-found.tsx': HOOK_PAGE });
    try {
      const record = repo.judge().records[0];
      expect(record.kind).toBe('not-found');
      expect(record.state).toBe(J.STATES.BAILOUT);
    } finally {
      repo.cleanup();
    }
  });
});

// ─── Μ: μεταλλάξεις ΣΤΙΣ ΕΙΣΟΔΟΥΣ ────────────────────────────────────────────

describe('Μ — μεταλλάξεις στις ΕΙΣΟΔΟΥΣ (μία γραμμή η καθεμία)', () => {
  const run = (files, mutation) => {
    const repo = miniRepo(files);
    try {
      const before = repo.judge();
      mutation(repo);
      const after = repo.judge();
      return { before, after };
    } finally {
      repo.cleanup();
    }
  };

  it('Μ1: αφαίρεση του <Suspense> ⇒ πράσινο → ΚΟΚΚΙΝΟ', () => {
    const { before, after } = run({ 'src/app/(x)/p/page.tsx': WRAPPED_PAGE }, repo => {
      repo.mutate('src/app/(x)/p/page.tsx', '<Suspense fallback={null}><Body /></Suspense>', '<Body />');
    });
    expect(before.records[0].state).toBe(J.STATES.INLINE_GUARDED);
    expect(after.records[0].state).toBe(J.STATES.BAILOUT);
  });

  it('Μ2: ΔΙΑΓΡΑΦΗ του loading.tsx ⇒ οι φρουρημένες πέφτουν (το φορτίο των 17)', () => {
    const files = {
      'src/app/(app)/loading.tsx': `export default function L() { return <p>...</p>; }\n`,
      'src/app/(app)/a/page.tsx': HOOK_PAGE,
      'src/app/(app)/b/page.tsx': HOOK_PAGE,
    };
    const repo = miniRepo(files);
    try {
      expect(repo.judge().census[J.STATES.BAILOUT]).toBe(0);
      fs.unlinkSync(path.join(repo.root, 'src/app/(app)/loading.tsx'));
      expect(repo.judge().census[J.STATES.BAILOUT]).toBe(2);
    } finally {
      repo.cleanup();
    }
  });

  it('Μ3: το hook μετακομίζει ΜΕΣΑ στο default export ⇒ ΚΟΚΚΙΝΟ', () => {
    const { before, after } = run({ 'src/app/(x)/p/page.tsx': WRAPPED_PAGE }, repo => {
      repo.mutate(
        'src/app/(x)/p/page.tsx',
        'export default function Page() {\n  return <main>',
        'export default function Page() {\n  useSearchParams();\n  return <main>'
      );
    });
    expect(before.records[0].state).toBe(J.STATES.INLINE_GUARDED);
    expect(after.records[0].state).toBe(J.STATES.BAILOUT);
  });

  it('Μ4: ssr:false → ssr:true ⇒ ΚΟΚΚΙΝΟ', () => {
    const files = {
      'src/components/Late.tsx': `'use client';
import { useSearchParams } from 'next/navigation';
export default function Late() { const p = useSearchParams(); return <i>{p.get('x')}</i>; }
`,
      'src/app/(x)/p/page.tsx': `'use client';
import dynamic from 'next/dynamic';
const Late = dynamic(() => import('@/components/Late'), { ssr: false });
export default function Page() { return <main><Late /></main>; }
`,
    };
    const { before, after } = run(files, repo => {
      repo.mutate('src/app/(x)/p/page.tsx', '{ ssr: false }', '{ ssr: true }');
    });
    expect(before.records[0].state).toBe(J.STATES.CLEAN);
    expect(after.records[0].state).toBe(J.STATES.BAILOUT);
  });

  it('Μ5: ΨΕΥΔΩΝΥΜΟ εισαγωγής — το κριτήριο είναι ΔΕΣΜΕΥΣΗ, όχι όνομα', () => {
    const repo = miniRepo({
      'src/app/(x)/p/page.tsx': `'use client';
import { useSearchParams as useSP } from 'next/navigation';
export default function Page() { const p = useSP(); return <main>{p.get('x')}</main>; }
`,
    });
    try {
      expect(repo.judge().records[0].state).toBe(J.STATES.BAILOUT);
    } finally {
      repo.cleanup();
    }
  });

  it('Μ6: <Suspenseish> ΔΕΝ είναι <Suspense> (καμία χαλάρωση σε πρόθεμα)', () => {
    const { before, after } = run({ 'src/app/(x)/p/page.tsx': WRAPPED_PAGE }, repo => {
      repo.mutate('src/app/(x)/p/page.tsx', '<Suspense fallback={null}>', '<Suspenseish fallback={null}>');
      repo.mutate('src/app/(x)/p/page.tsx', '</Suspense>', '</Suspenseish>');
    });
    expect(before.records[0].state).toBe(J.STATES.INLINE_GUARDED);
    expect(after.records[0].state).toBe(J.STATES.BAILOUT);
  });

  it('Μ7: το `{children}` βγαίνει ΕΞΩ από το <Suspense> του layout ⇒ ΚΟΚΚΙΝΟ', () => {
    const files = {
      'src/app/(x)/layout.tsx': `'use client';
import { Suspense } from 'react';
export default function L({ children }) { return <div><Suspense fallback={null}>{children}</Suspense></div>; }
`,
      'src/app/(x)/p/page.tsx': HOOK_PAGE,
    };
    const { before, after } = run(files, repo => {
      repo.mutate(
        'src/app/(x)/layout.tsx',
        '<Suspense fallback={null}>{children}</Suspense>',
        '<Suspense fallback={null}><i /></Suspense>{children}'
      );
    });
    const pageOf = result => result.records.find(r => r.file.endsWith('p/page.tsx')).state;
    expect(pageOf(before)).toBe(J.STATES.GUARDED);
    expect(pageOf(after)).toBe(J.STATES.BAILOUT);
  });

  it('Μ8: αφαίρεση του force-dynamic ⇒ η ίδια σελίδα γίνεται ΚΟΚΚΙΝΗ', () => {
    const { before, after } = run(
      { 'src/app/(x)/p/page.tsx': `export const dynamic = 'force-dynamic';\n${HOOK_PAGE}` },
      repo => repo.mutate('src/app/(x)/p/page.tsx', `export const dynamic = 'force-dynamic';\n`, '')
    );
    expect(before.records[0].state).toBe(J.STATES.OPTED_OUT);
    expect(after.records[0].state).toBe(J.STATES.BAILOUT);
  });
});

// ─── Α: ο αναλυτής ───────────────────────────────────────────────────────────

describe('Α — ο αναλυτής ενός αρχείου', () => {
  it('Α1: ξεχωρίζει ΚΛΗΣΗ από ΑΠΟΔΟΣΗ', () => {
    const mod = analyzeModule('x.tsx', WRAPPED_PAGE);
    expect([...mod.locals.get('Body').calls]).toContain('useSearchParams');
    expect(mod.locals.get('Page').renders.map(r => r.name)).toContain('Body');
  });

  it('Α2: το βάθος <Suspense> σημειώνεται στη σωστή ακμή', () => {
    const mod = analyzeModule('x.tsx', WRAPPED_PAGE);
    const edge = mod.locals.get('Page').renders.find(r => r.name === 'Body');
    expect(edge.guarded).toBe(true);
    expect(mod.locals.get('Page').renders.find(r => r.name === 'Suspense').guarded).toBe(false);
  });

  it('Α3: το `{children}` κάτω από όριο σημειώνεται', () => {
    const mod = analyzeModule('layout.tsx', `'use client';
import { Suspense } from 'react';
export default function L({ children }) { return <div><Suspense fallback={null}>{children}</Suspense></div>; }
`);
    expect(RT.layoutWrapsChildren(mod)).toBe(true);
  });

  it('Α4: `{children}` ΕΚΤΟΣ ορίου ΔΕΝ σημειώνεται', () => {
    const mod = analyzeModule('layout.tsx', `'use client';
import { Suspense } from 'react';
export default function L({ children }) { return <div>{children}<Suspense fallback={null}><i /></Suspense></div>; }
`);
    expect(RT.layoutWrapsChildren(mod)).toBe(false);
  });
});
