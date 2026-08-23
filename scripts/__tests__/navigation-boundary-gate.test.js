/**
 * ΑΓΚΥΡΕΣ — CHECK 3.61, η πύλη του συνόρου πλοήγησης (ADR-787 §5.3 ν)
 *
 * ⚠️ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΠΡΩΤΑ**: κάθε ομάδα που ισχυρίζεται «δεν βρήκε παράβαση»
 * συνοδεύεται από άγκυρα που αποδεικνύει ότι ο σαρωτής **κοίταξε** — αλλιώς το
 * πράσινο σημαίνει «κανείς δεν κοίταξε», το σχήμα που αυτό το repo έχει πληρώσει
 * οκτώ φορές.
 *
 * @jest-environment node
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const {
  GATE_STATES,
  MIGRATED_SYMBOLS,
  RAW_IMPORT_OWNERS,
  UNMIGRATED_SYMBOLS,
  classifySymbol,
  isRawImportOwner,
} = require('../lib/navigation-boundary/contract.js');
const { BLOCKING, MIN_REASON, collectSourceFiles, judgeFile, judgeOwners, sweep } =
  require('../lib/navigation-boundary/gate.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OWNER = 'src/lib/workspace/navigation.tsx';
const NOT_OWNER = 'src/components/whatever/Thing.tsx';

const judge = (text, file = NOT_OWNER) => judgeFile(file, text).state;

// ═══════════════════════════════════════════════════════════════════════════
// Μ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η πύλη κοιτάζει πραγματικό δέντρο και είναι πράσινη
// ═══════════════════════════════════════════════════════════════════════════

describe('Μ0 — ο παρονομαστής', () => {
  const result = sweep(REPO_ROOT);

  it('Μ0α: ο σαρωτής βρίσκει ΠΡΑΓΜΑΤΙΚΟ πληθυσμό, όχι κενό δέντρο', () => {
    expect(result.population).toBeGreaterThan(1000);
    expect(collectSourceFiles(path.join(REPO_ROOT, 'src')).length).toBe(result.population);
  });

  it('Μ0β: υπάρχουν αρχεία ΣΤΟ ΣΥΝΟΡΟ — αλλιώς το «καμία παράβαση» είναι κενό', () => {
    expect(result.fileTally[GATE_STATES.AT_BOUNDARY]).toBeGreaterThan(0);
    expect(result.fileTally[GATE_STATES.OWNER]).toBe(Object.keys(RAW_IMPORT_OWNERS).length);
  });

  it('Μ0γ: το πραγματικό δέντρο είναι ΚΑΘΑΡΟ (zero-tolerance εφικτό, μετρημένο)', () => {
    expect(result.violations).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Κ — ΤΟ ΚΡΙΤΗΡΙΟ
// ═══════════════════════════════════════════════════════════════════════════

describe('Κ — το κριτήριο της παράκαμψης', () => {
  it('Κ1: ωμό default `next/link` ΠΙΑΝΕΤΑΙ', () => {
    expect(judge("import Link from 'next/link';")).toBe(GATE_STATES.BOUNDARY_BYPASS);
  });

  it('Κ2: ωμό `useRouter` από `next/navigation` ΠΙΑΝΕΤΑΙ', () => {
    expect(judge("import { useRouter } from 'next/navigation';")).toBe(GATE_STATES.BOUNDARY_BYPASS);
  });

  it('Κ3: 🔴 ΔΙΠΛΑ εισαγωγικά — η μορφή που ο grep έχασε σε 3 αρχεία', () => {
    expect(judge('import Link from "next/link"')).toBe(GATE_STATES.BOUNDARY_BYPASS);
  });

  it('Κ4: ΜΕΤΟΝΟΜΑΣΜΕΝΟ default (`NextLink`) ΠΙΑΝΕΤΑΙ — το σύμβολο, όχι το όνομα', () => {
    expect(judge("import NextLink from 'next/link';")).toBe(GATE_STATES.BOUNDARY_BYPASS);
  });

  it('Κ5: ΜΕΤΟΝΟΜΑΣΜΕΝΟ named (`useRouter as useNav`) ΠΙΑΝΕΤΑΙ', () => {
    expect(judge("import { useRouter as useNav } from 'next/navigation';")).toBe(
      GATE_STATES.BOUNDARY_BYPASS,
    );
  });

  it('Κ6: ο ΠΑΡΟΝΟΜΑΣΤΗΣ — μη μεταναστεύσιμο σύμβολο ΔΕΝ είναι παράβαση', () => {
    expect(judge("import { useSearchParams } from 'next/navigation';")).toBe(
      GATE_STATES.UNMIGRATABLE_ONLY,
    );
    expect(judge("import { redirect, notFound } from 'next/navigation';")).toBe(
      GATE_STATES.UNMIGRATABLE_ONLY,
    );
  });

  it('Κ7: ΜΕΙΚΤΗ εισαγωγή — το μεταναστεύσιμο κερδίζει', () => {
    expect(judge("import { useRouter, useSearchParams } from 'next/navigation';")).toBe(
      GATE_STATES.BOUNDARY_BYPASS,
    );
  });

  it('Κ8: 🔴 ΠΡΟΖΑ ΔΕΝ ΕΙΝΑΙ ΒΛΑΒΗ — σχόλιο που αναφέρει το ωμό Next περνά', () => {
    // Η παγίδα `Κ7β` του CHECK 3.50: το ΙΔΙΟ το σύνορο τεκμηριώνει γιατί τυλίγει
    // το `next/link`. Regex θα κοκκίνιζε πάνω στη ΘΕΡΑΠΕΙΑ.
    const prose = [
      '/**',
      " * Τυλίγει το `next/link` και το `useRouter` του 'next/navigation'.",
      ' */',
      "import { Link } from '@/lib/workspace/navigation';",
    ].join('\n');
    expect(judge(prose)).toBe(GATE_STATES.AT_BOUNDARY);
  });

  it('Κ9: `import type` ΔΕΝ είναι παράβαση — ο τύπος σβήνεται στη μεταγλώττιση', () => {
    // ⚠️ ΤΟ ΣΥΜΒΟΛΟ ΠΡΕΠΕΙ ΝΑ ΕΙΝΑΙ **ΜΕΤΑΝΑΣΤΕΥΣΙΜΟ**. Η πρώτη γραφή δοκίμαζε
    //    `ReadonlyURLSearchParams`, που είναι ΗΔΗ στα UNMIGRATED — δηλαδή προορισμός
    //    όπου η διαφορά ΔΕΝ ΦΑΙΝΕΤΑΙ, και η μετάλλαξη «αγνόησε το isTypeOnly»
    //    έμενε ΠΡΑΣΙΝΗ. Κάθε κλάδος οφείλει να ασκείται εκεί που κρίνεται.
    expect(judge("import type { useRouter } from 'next/navigation';")).toBe(
      GATE_STATES.UNMIGRATABLE_ONLY,
    );
    expect(judge("import { type usePathname } from 'next/navigation';")).toBe(
      GATE_STATES.UNMIGRATABLE_ONLY,
    );
    // ο ΠΑΡΟΝΟΜΑΣΤΗΣ: το ίδιο σύμβολο ΧΩΡΙΣ `type` ΕΙΝΑΙ παράβαση
    expect(judge("import { useRouter } from 'next/navigation';")).toBe(GATE_STATES.BOUNDARY_BYPASS);
  });

  it('Κ10: ο ΔΗΛΩΜΕΝΟΣ ιδιοκτήτης ΔΕΝ καταγγέλλεται', () => {
    expect(judge("import Link from 'next/link';", OWNER)).toBe(GATE_STATES.OWNER);
    expect(isRawImportOwner(OWNER)).toBe(true);
  });

  it('Κ11: αρχείο που δεν αναφέρει καν ωμό Next είναι ο ΜΕΓΑΛΟΣ παρονομαστής', () => {
    expect(judge('export const x = 1;')).toBe(GATE_STATES.NOT_A_NAVIGATION_FILE);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Σ — ΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΤΩΝ ΙΔΙΟΚΤΗΤΩΝ
// ═══════════════════════════════════════════════════════════════════════════

describe('Σ — το κλειστό σύνολο', () => {
  it('Σ1: κάθε δηλωμένος ιδιοκτήτης ΥΠΑΡΧΕΙ και φέρει ΛΟΓΟ', () => {
    expect(judgeOwners(REPO_ROOT)).toEqual([]);
    for (const [rel, reason] of Object.entries(RAW_IMPORT_OWNERS)) {
      expect(fs.existsSync(path.join(REPO_ROOT, rel))).toBe(true);
      expect(reason.trim().length).toBeGreaterThanOrEqual(MIN_REASON);
    }
  });

  it('Σ2: ΟΡΦΑΝΗ δήλωση πιάνεται — αλλιώς το σύνολο σαπίζει σιωπηλά', () => {
    const verdicts = judgeOwners(path.join(REPO_ROOT, 'scripts')); // λάθος ρίζα ⇒ κανένα αρχείο
    expect(verdicts.length).toBe(Object.keys(RAW_IMPORT_OWNERS).length);
    expect(verdicts.every((v) => v.state === GATE_STATES.ORPHAN_OWNER)).toBe(true);
  });

  it('Σ3: 🔴 Η ΑΓΚΥΡΑ ΤΟΥ ΣΥΝΟΡΟΥ ΕΙΝΑΙ ΝΟΜΙΜΟΣ ΙΔΙΟΚΤΗΤΗΣ ΧΩΡΙΣ ΝΑ ΕΙΣΑΓΕΙ', () => {
    // Κάνει `jest.mock('next/navigation')`. Κριτήριο ορφανότητας «εισάγει» θα την
    // κατήγγελλε ως νεκρή δήλωση — φρουρός που κοκκινίζει σε ΣΩΣΤΟ κώδικα είναι
    // ο δρόμος προς το `SKIP_`.
    const anchor = 'src/lib/workspace/__tests__/navigation.test.tsx';
    expect(isRawImportOwner(anchor)).toBe(true);
    const text = fs.readFileSync(path.join(REPO_ROOT, anchor), 'utf8');
    expect(text).toContain("jest.mock('next/navigation'");
    expect(text).not.toMatch(/^import .*from 'next\/navigation'/m);
    expect(judgeOwners(REPO_ROOT)).toEqual([]);
  });

  it('Σ3β: 🔴 ΔΗΛΩΣΗ ΧΩΡΙΣ ΛΟΓΟ ΠΙΑΝΕΤΑΙ — ο κλάδος ΑΣΚΕΙΤΑΙ, δεν υποτίθεται', () => {
    // Γεννήθηκε από μετάλλαξη που ΕΜΕΙΝΕ ΠΡΑΣΙΝΗ (`MIN_REASON = 0`): κανένας
    // πραγματικός ιδιοκτήτης δεν έχει κοντό λόγο, άρα ο φρουρός ήταν ΑΔΡΑΝΗΣ.
    const short = judgeOwners(REPO_ROOT, { [OWNER]: 'ok' });
    expect(short).toHaveLength(1);
    expect(short[0].state).toBe(GATE_STATES.REASONLESS_OWNER);

    // ο ΠΑΡΟΝΟΜΑΣΤΗΣ: λόγος ακριβώς στο όριο ΠΕΡΝΑ
    expect(judgeOwners(REPO_ROOT, { [OWNER]: 'x'.repeat(MIN_REASON) })).toEqual([]);
  });

  it('Σ3γ: 🔴 Η ΛΟΓΙΣΤΙΚΗ ΔΗΛΩΣΕΩΝ ΚΛΕΙΝΕΙ ΚΑΙ ΟΤΑΝ ΥΠΑΡΧΕΙ ΕΛΑΤΤΩΜΑ', () => {
    // Η αφαίρεση `declared − flagged` ήταν αδρανής όσο το `flagged` ήταν κενό.
    const injected = { [OWNER]: 'ok', 'src/does/not/exist.tsx': 'a'.repeat(MIN_REASON) };
    const { ownerTally, declared, violations } = sweep(REPO_ROOT, injected);
    expect(declared).toBe(2);
    expect(ownerTally[GATE_STATES.REASONLESS_OWNER]).toBe(1);
    expect(ownerTally[GATE_STATES.ORPHAN_OWNER]).toBe(1);
    expect(ownerTally[GATE_STATES.OWNER]).toBe(0);
    expect(Object.values(ownerTally).reduce((a, b) => a + b, 0)).toBe(declared);
    expect(violations.length).toBeGreaterThanOrEqual(2);
  }, 60000);

  it('Σ4: το ΛΕΞΙΛΟΓΙΟ είναι εξαντλητικό — άγνωστο σύμβολο ΡΙΧΝΕΙ', () => {
    expect(() => classifySymbol('useFutureNextApi')).toThrow(/ΑΓΝΩΣΤΟ σύμβολο/);
    for (const name of Object.keys(MIGRATED_SYMBOLS)) expect(classifySymbol(name)).toBe('migrate');
    for (const name of Object.keys(UNMIGRATED_SYMBOLS)) expect(classifySymbol(name)).toBe('keep');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Λ — Η ΛΟΓΙΣΤΙΚΗ
// ═══════════════════════════════════════════════════════════════════════════

describe('Λ — κλειστή λογιστική fail-closed', () => {
  it('Λ1: 🔴 ΔΥΟ ΚΑΤΑΣΤΙΧΑ — αρχεία και δηλώσεις κλείνουν ΞΕΧΩΡΙΣΤΑ', () => {
    // Γεννήθηκε από ΠΡΑΓΜΑΤΙΚΟ ελάττωμα: ένα κοινό κατάστιχο ΔΙΠΛΟΜΕΤΡΟΥΣΕ —
    // ιδιοκτήτης χωρίς λόγο είναι ΚΑΙ αρχείο `owner` ΚΑΙ δήλωση `reasonless-owner`.
    const { fileTally, ownerTally, population, declared } = sweep(REPO_ROOT);
    expect(Object.values(fileTally).reduce((a, b) => a + b, 0)).toBe(population);
    expect(Object.values(ownerTally).reduce((a, b) => a + b, 0)).toBe(declared);
    expect(declared).toBe(Object.keys(RAW_IMPORT_OWNERS).length);
  });

  it('Λ2: ΚΑΘΕ κατάσταση του λεξιλογίου ανήκει σε ΑΚΡΙΒΩΣ ένα κατάστιχο', () => {
    const { fileTally, ownerTally } = sweep(REPO_ROOT);
    for (const state of Object.values(GATE_STATES)) {
      const homes = [fileTally, ownerTally].filter((t) => Object.hasOwn(t, state)).length;
      expect(homes).toBeGreaterThanOrEqual(1);
    }
    // Ο `owner` είναι ΣΚΟΠΙΜΑ και στα δύο: το αρχείο ΚΑΙ η δήλωσή του.
    expect(Object.hasOwn(fileTally, GATE_STATES.OWNER)).toBe(true);
    expect(Object.hasOwn(ownerTally, GATE_STATES.OWNER)).toBe(true);
  });

  it('Λ3: οι ΜΠΛΟΚΑΡΟΥΣΕΣ καταστάσεις είναι ακριβώς οι τρεις, και όλες τίθενται', () => {
    expect([...BLOCKING].sort()).toEqual(
      [GATE_STATES.BOUNDARY_BYPASS, GATE_STATES.ORPHAN_OWNER, GATE_STATES.REASONLESS_OWNER].sort(),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Ι — ΙΣΟΔΥΝΑΜΙΑ: δύο όργανα, ένα δέντρο
// ═══════════════════════════════════════════════════════════════════════════

describe('Ι — ο codemod και η πύλη ΔΕΝ επιτρέπεται να διαφωνήσουν', () => {
  it('Ι1: 🔴 ΙΔΙΟΣ ΠΑΡΟΝΟΜΑΣΤΗΣ ΜΕ ΤΟ CODEMOD — το ts-morph τραβούσε 4.878 node_modules', () => {
    // ⚠️ ΤΡΕΧΕΙ ΤΟ **ΠΡΑΓΜΑΤΙΚΟ ΕΚΤΕΛΕΣΙΜΟ**, δεν αντιγράφει τη ρύθμισή του. Δύο
    //    προηγούμενες γραφές απέτυχαν ως άγκυρες:
    //      (α) σύγκριση `sweep()` με `collectSourceFiles()` — δύο όψεις του ΙΔΙΟΥ
    //          κώδικα, άρα ο παρονομαστής μετακινούνταν ΜΑΖΙ με τη μετάλλαξη
    //          (το σφάλμα ADR-790 §9.1)·
    //      (β) αντίγραφο του ts-morph setup — αν το codemod άλλαζε ρύθμιση, το
    //          test θα έμενε πράσινο πάνω στην απόκλιση (πρότυπο `Ν3`, CHECK 3.31:
    //          η άγκυρα οφείλει να καλεί το CLI, όχι τη συνάρτηση).
    //
    // Η διαφωνία ΔΕΝ ήταν αισθητική: το `project.save()` γράφει ό,τι τροποποιήθηκε,
    // οπότε αρχείο εξάρτησης που θα ταξινομούνταν `rewritten` θα ΓΡΑΦΟΤΑΝ.
    const out = execFileSync(process.execPath, ['scripts/migrate-navigation-boundary.mjs'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    const match = /\(πληθυσμός:\s*(\d+)\)/.exec(out);
    expect(match).not.toBeNull(); // ⚠️ κενή απάντηση ⇒ ΣΚΑΕΙ, ποτέ σιωπηλό πράσινο
    expect(Number(match[1])).toBe(sweep(REPO_ROOT).population);
  }, 180000);

  it('Ι2: το ΣΥΜΒΟΛΑΙΟ είναι ΕΝΑ — η πύλη δεν κρατά δικό της αντίγραφο', () => {
    const gateSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'navigation-boundary', 'gate.js'), 'utf8');
    expect(gateSource).toContain("require('./contract.js')");
    // ⚠️ Καμία δική της λίστα συμβόλων ή ιδιοκτητών.
    expect(gateSource).not.toMatch(/const\s+(MIGRATED_SYMBOLS|RAW_IMPORT_OWNERS)\s*=/);
  });
});
