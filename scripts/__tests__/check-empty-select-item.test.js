/**
 * CHECK 3.48 — **η πύλη του κενού `SelectItem`** (ADR-778).
 *
 *   Μ0      — το ΠΡΑΓΜΑΤΙΚΟ δέντρο είναι πράσινο σήμερα (αλλιώς το zero-tolerance είναι ευχή)
 *   Π1..Π3  — ΑΠΟΔΕΙΞΗ σε **πραγματικό ιστορικό κώδικα**, με **καρφωμένο** commit
 *   Μ1..Μ6  — μία μετάλλαξη ανά μορφή της νάρκης, στις **ΕΙΣΟΔΟΥΣ** και όχι στην πύλη
 *   Κ1..Κ7  — το συμβόλαιο: εμβέλεια, δηλωμένα κενά, κλειστή λογιστική
 *
 * 🔴 **Το commit είναι ΚΑΡΦΩΜΕΝΟ, ποτέ `HEAD`.** Το `HEAD` μετακινείται και τα Π θα
 * αυτοακυρώνονταν σιωπηλά (μάθημα CHECK 3.41/3.42/3.45). Και το `gitShow` **σκάει** σε κενή
 * απάντηση: στα Windows το `git` απαντά «*exists on disk, but not in HEAD*» και ένα σιωπηλό
 * `null` θα έβαφε πράσινο ένα test που δεν εκτέλεσε τίποτα.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const GATE = path.join(REPO, 'scripts', 'check-empty-select-item.js');

/**
 * 🔴 ΚΑΡΦΩΜΕΝΟ commit — το τελευταίο στο οποίο τα δύο αρχεία είχαν **ζωντανή** τη νάρκη.
 * Και τα δύο διορθώθηκαν στο §60· εδώ ελέγχεται ότι η πύλη θα τα είχε σταματήσει.
 */
const PINNED = '8318b50d';
const HISTORICAL = [
  { file: 'src/subapps/dxf-viewer/bim-3d/panels/Floor3DPanelTab.tsx', line: 179 },
  { file: 'src/subapps/dxf-viewer/ui/components/bim-schedule/ScheduleFilterBar.tsx', line: 193 },
];

let workdir;
beforeAll(() => {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-3-48-'));
});
afterAll(() => {
  fs.rmSync(workdir, { recursive: true, force: true });
});

/** Το περιεχόμενο ενός αρχείου σε **καρφωμένη** αναθεώρηση. Σκάει σε κενή απάντηση. */
function gitShow(rev, repoPath) {
  const posix = repoPath.split(path.sep).join('/');
  const out = execFileSync('git', ['show', `${rev}:${posix}`], {
    cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  if (!out || out.trim() === '') {
    throw new Error(`Το \`git show ${rev}:${posix}\` δεν επέστρεψε τίποτα — το test δεν εκτέλεσε κώδικα.`);
  }
  return out;
}

/** Γράφει προσωρινό `.tsx` και **εκτελεί** την πύλη πάνω του. */
function runGateOn(name, source) {
  const target = path.join(workdir, name);
  fs.writeFileSync(target, source, 'utf8');
  try {
    const stdout = execFileSync('node', [GATE, target], { cwd: REPO, encoding: 'utf8' });
    return { blocked: false, stdout };
  } catch (err) {
    return { blocked: true, stdout: String(err.stdout ?? '') };
  }
}

/** Ένα ελάχιστο, **έγκυρο** αρχείο γύρω από μία δήλωση item. */
function fileWith(itemJsx) {
  return [
    "import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';",
    "import { SelectItem } from '@/components/ui/select';",
    "import * as SelectPrimitive from '@radix-ui/react-select';",
    'export function Probe({ rest, id }: { rest: object; id: string }) {',
    `  return <>${itemJsx}</>;`,
    '}',
    'void SELECT_CLEAR_VALUE; void SelectItem; void SelectPrimitive;',
  ].join('\n');
}

// ── Μ0 ───────────────────────────────────────────────────────────────────────

describe('Μ0 — η βάση', () => {
  it('το πραγματικό `src/` είναι ΠΡΑΣΙΝΟ σήμερα — το zero-tolerance είναι εφικτό, όχι ευχή', () => {
    // Χωρίς αυτό, ένα zero-tolerance χωρίς baseline θα ήταν πρόταση και όχι μηχανισμός: κάθε
    // επόμενο commit θα μπλοκαριζόταν από χρέος που κανείς δεν ζήτησε να πληρώσει τώρα.
    const out = execFileSync('node', [GATE, '--all'], { cwd: REPO, encoding: 'utf8' });
    expect(out).toContain('CHECK 3.48');
  });
});

// ── Π1..Π3 — απόδειξη σε πραγματικό ιστορικό ─────────────────────────────────

describe('Π — η πύλη πιάνει τις ΠΡΑΓΜΑΤΙΚΕΣ νάρκες του §59/§60', () => {
  it.each(HISTORICAL)('Π: μπλοκάρει το $file στη γραμμή $line', ({ file, line }) => {
    const source = gitShow(PINNED, file);
    // Η νάρκη πρέπει να **υπάρχει** στην ιστορική εκδοχή· αλλιώς το test δοκιμάζει κενό αρχείο.
    expect(source).toContain('<SelectItem value="">');
    const { blocked, stdout } = runGateOn(path.basename(file), source);
    expect(blocked).toBe(true);
    expect(stdout).toContain(`:${line}`);
    expect(stdout).toContain('[literal-empty]');
  });

  it('Π3: η ΣΗΜΕΡΙΝΗ εκδοχή των ίδιων αρχείων περνά — η διόρθωση του §60 είναι πραγματική', () => {
    for (const { file } of HISTORICAL) {
      const source = fs.readFileSync(path.join(REPO, file), 'utf8');
      expect(runGateOn(`now-${path.basename(file)}`, source).blocked).toBe(false);
    }
  });
});

// ── Μ1..Μ6 — μεταλλάξεις στις ΕΙΣΟΔΟΥΣ ───────────────────────────────────────

describe('Μ1..Μ6 — κάθε μορφή της νάρκης, μία-μία', () => {
  const BLOCKING = [
    ['Μ1: κυριολεκτικό κενό', '<SelectItem value="">Καμία</SelectItem>', 'literal-empty'],
    ['Μ2: κενό σε μονά', "<SelectItem value={''}>Καμία</SelectItem>", 'expression-empty'],
    ['Μ3: κενό σε διπλά', '<SelectItem value={""}>Καμία</SelectItem>', 'expression-empty'],
    ['Μ4: κενό template', '<SelectItem value={``}>Καμία</SelectItem>', 'expression-empty'],
    ['Μ5: ΚΑΝΕΝΑ value', '<SelectItem>Καμία</SelectItem>', 'missing-value'],
  ];

  it.each(BLOCKING)('%s ⇒ ΜΠΛΟΚ [%s]', (_name, jsx, state) => {
    const { blocked, stdout } = runGateOn('mutation.tsx', fileWith(jsx));
    expect(blocked).toBe(true);
    expect(stdout).toContain(`[${state}]`);
  });

  it('Μ6: `{...rest}` χωρίς `value` ⇒ ΔΕΝ μπλοκάρει — δηλωμένο κενό, όχι σιωπηλή ανοχή', () => {
    // Ένα spread **μπορεί** να φέρνει το `value`, και ο AST δεν το ξέρει. Ψευδώς θετικό εδώ θα
    // έσπαγε κάθε νόμιμο wrapper — και θα έσπρωχνε τον επόμενο να προσθέσει escape hatch.
    const { blocked } = runGateOn('spread.tsx', fileWith('<SelectItem {...rest}>Κάτι</SelectItem>'));
    expect(blocked).toBe(false);
  });
});

// ── Κ1..Κ7 — το συμβόλαιο ────────────────────────────────────────────────────

describe('Κ — το συμβόλαιο της πύλης', () => {
  it('Κ1: το σεντινέλι είναι ΚΑΘΑΡΟ — η ονομασμένη θεραπεία δεν μπλοκάρεται ποτέ', () => {
    const jsx = '<SelectItem value={SELECT_CLEAR_VALUE}>Καμία επιλογή</SelectItem>';
    expect(runGateOn('sentinel.tsx', fileWith(jsx)).blocked).toBe(false);
  });

  it('Κ2: 🔴 `SelectPrimitive.Item value=""` ΜΠΛΟΚΑΡΕΤΑΙ — η ωμή διαδρομή είναι η ΧΕΙΡΟΤΕΡΗ', () => {
    // Παρακάμπτει **και** τον τύπο **και** τον έλεγχο χρόνου εκτέλεσης του wrapper. Μια πύλη που
    // κοιτούσε μόνο το `SelectItem` θα άφηνε ακριβώς τη μορφή που κανείς άλλος δεν βλέπει.
    const jsx = '<SelectPrimitive.Item value="">Καμία</SelectPrimitive.Item>';
    const { blocked, stdout } = runGateOn('primitive.tsx', fileWith(jsx));
    expect(blocked).toBe(true);
    expect(stdout).toContain('[literal-empty]');
  });

  it('Κ3: άσχετο component με `value=""` ΔΕΝ μπλοκάρεται — η εμβέλεια είναι το Radix Select', () => {
    const source = fileWith('<input value="" readOnly /><option value="">Όλα</option>');
    expect(runGateOn('scope.tsx', source).blocked).toBe(false);
  });

  it('Κ4: `value={id}` ⇒ ανεπίλυτο, ΟΧΙ παραβίαση — το δηλωμένο κενό, με όνομα', () => {
    const { blocked } = runGateOn('dynamic.tsx', fileWith('<SelectItem value={id}>X</SelectItem>'));
    expect(blocked).toBe(false);
  });

  it('Κ5: 🔴 η λογιστική ΚΛΕΙΝΕΙ — κάθε `SelectItem` του δέντρου κατατάσσεται σε ακριβώς έναν κάδο', () => {
    const out = execFileSync('node', [GATE, '--report'], { cwd: REPO, encoding: 'utf8' });
    const rows = [...out.matchAll(/^\s+[⛔🔶✅]\s+(\S+)\s+(\d+)$/gmu)]
      .map(([, state, count]) => ({ state, count: Number(count) }));
    const total = Number(/ΣΥΝΟΛΟ\s+(\d+)/u.exec(out)?.[1] ?? -1);

    // Επτά κάδοι, ονομασμένοι, και το άθροισμά τους **είναι** το σύνολο. Ένας κάδος που
    // δηλώνεται αλλά δεν αθροίζεται είναι φρουρός χωρίς απόδειξη ζωής (ADR-749 §5).
    expect(rows).toHaveLength(7);
    expect(rows.reduce((acc, r) => acc + r.count, 0)).toBe(total);
    expect(total).toBeGreaterThan(0);
  });

  it('Κ6: η αναφορά ονομάζει και τους ΤΡΕΙΣ μπλοκάροντες κάδους, ακόμη κι όταν είναι μηδέν', () => {
    const out = execFileSync('node', [GATE, '--report'], { cwd: REPO, encoding: 'utf8' });
    // Ένας κάδος με 0 που **δεν** τυπώνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος», και
    // ένας που τυπώνεται ως 0 διαβάζεται ως «κοίταξα και δεν βρήκα». Η διαφορά είναι όλη η
    // αξία του «0» (μάθημα N.11/N.12: «0 = κανείς δεν κοίταξε»).
    for (const state of ['literal-empty', 'expression-empty', 'missing-value']) {
      expect(out).toContain(state);
    }
  });

  it('Κ7: το `gitShow` ΣΚΑΕΙ σε ανύπαρκτη διαδρομή — ποτέ σιωπηλά πράσινο test', () => {
    expect(() => gitShow(PINNED, 'src/δεν/υπαρχει.tsx')).toThrow();
  });
});
