/**
 * ΑΓΚΥΡΕΣ — ο δείκτης ADR προσθέτει χωρίς να καταστρέφει (ADR-814)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΚΥΝΗΓΟΥΝ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο γεννήτορας δήλωνε στην κεφαλίδα του παραγόμενου αρχείου «AUTO-GENERATED —
 * Do not edit manually!» και **κάποιος τον επεξεργαζόταν χειροκίνητα επί μήνες**.
 * Μετρημένο εκτελώντας τον σε αντίγραφο: **0** γραμμές χάνονταν, **79** ADR
 * κερδίζονταν, αλλά **83** κελιά συρρικνώνονταν και **169.937 χαρακτήρες**
 * επιμελημένης γνώσης εξαφανίζονταν. Πλήρης στην κάλυψη, καταστροφικός στο
 * περιεχόμενο — γι' αυτό η προφύλαξη ήταν «μην τον τρέχεις», που άφηνε τον
 * δείκτη να παλιώνει **για πάντα**.
 *
 * **Δ** — η ΔΙΑΤΗΡΗΣΗ: το επιμελημένο κελί επιβιώνει, το φτωχό ανανεώνεται.
 * **Φ** — ο ΦΡΟΥΡΟΣ: ο δείκτης δεν επιτρέπεται να μικρύνει σιωπηλά.
 * **Π** — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: υπάρχει όντως επιμελημένο περιεχόμενο να φυλαχθεί.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const GEN = path.join(REPO, 'docs', 'centralized-systems', 'reference', 'scripts', 'generate-adr-index.cjs');
const INDEX = path.join(REPO, 'docs', 'centralized-systems', 'reference', 'adr-index.md');

const {
  readDecisions,
  chooseDecision,
} = require('../../docs/centralized-systems/reference/scripts/lib/preserve-decisions.cjs');

const ROW = (id, cell) => `| **${id}** | ${cell} | ✅ IMPLEMENTED | 2026-01-01 | X | [📄](./adrs/${id}.md) |`;

// ═══════════════════════════════════════════════════════════════════════════
// Π — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// ═══════════════════════════════════════════════════════════════════════════

describe('Π — ο παρονομαστής: υπάρχει επιμελημένο περιεχόμενο', () => {
  const current = fs.readFileSync(INDEX, 'utf8');
  const cells = readDecisions(current);

  test('Π1 — ο δείκτης περιέχει εκατοντάδες γραμμές ADR', () => {
    // Χωρίς αυτό, κάθε άγκυρα από κάτω θα ήταν πράσινη επειδή δεν κοίταξε τίποτα.
    expect(cells.size).toBeGreaterThan(500);
  });

  test('Π2 — υπάρχουν ΟΝΤΩΣ πλούσια, χειρόγραφα κελιά (>1000 χαρακτήρες)', () => {
    // Αν όλα ήταν τίτλοι, ο διατηρητής θα ήταν φρουρός χωρίς πληθυσμό
    // (ADR-749 §5 μετρά 606 τέτοιους) και η αφαίρεσή του δεν θα φαινόταν.
    const rich = [...cells.values()].filter((c) => c.length > 1000);
    expect(rich.length).toBeGreaterThan(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Δ — Η ΔΙΑΤΗΡΗΣΗ
// ═══════════════════════════════════════════════════════════════════════════

describe('Δ — προσθέτει χωρίς να καταστρέφει', () => {
  test('Δ1 — διαβάζει το κελί «Decision» και από τους ΔΥΟ πίνακες', () => {
    // Ο συγκεντρωτικός έχει 6 στήλες, οι ανά κατηγορία 4· ένα ADR ζει και στους δύο
    // και μόνο ο ένας μπορεί να έχει επιμεληθεί.
    const md = [
      '| **ADR-001** | φτωχό | ✅ | 2026-01-01 | X | [📄](./a.md) |',
      '| **ADR-001** | ΠΟΛΥ πιο πλούσια περιγραφή με λεπτομέρειες | ✅ | [View](./a.md) |',
    ].join('\n');
    expect(readDecisions(md).get('ADR-001')).toBe('ΠΟΛΥ πιο πλούσια περιγραφή με λεπτομέρειες');
  });

  test('Δ2 — το ΠΛΟΥΣΙΟΤΕΡΟ κελί κερδίζει τον τίτλο', () => {
    const preserved = new Map([['ADR-001', 'μια πολύ αναλυτική, επιμελημένη περιγραφή']]);
    const r = chooseDecision('ADR-001', 'Σύντομος τίτλος', preserved);
    expect(r.preserved).toBe(true);
    expect(r.text).toBe('μια πολύ αναλυτική, επιμελημένη περιγραφή');
  });

  test('Δ3 — ΦΤΩΧΟΤΕΡΟ κελί ΔΕΝ μπλοκάρει την ανανέωση από το ADR', () => {
    // Αλλιώς ο δείκτης παύει να μαθαίνει από τα ADR και παγώνει οριστικά.
    const preserved = new Map([['ADR-001', 'παλιό']]);
    const r = chooseDecision('ADR-001', 'Νέος, πληρέστερος τίτλος του ADR', preserved);
    expect(r.preserved).toBe(false);
    expect(r.text).toBe('Νέος, πληρέστερος τίτλος του ADR');
  });

  test('Δ4 — ΤΑΥΤΟΣΗΜΟ κελί ΔΕΝ μετριέται ως «διατηρημένο»', () => {
    // 575 από τα 659 είναι ταυτόσημα· αν μετριούνταν, ο αριθμός του χρέους θα
    // φούσκωνε ×7 και θα έπαυε να δείχνει πού πρέπει να κοιτάξει άνθρωπος.
    const preserved = new Map([['ADR-001', 'Ίδιος τίτλος']]);
    expect(chooseDecision('ADR-001', 'Ίδιος τίτλος', preserved).preserved).toBe(false);
  });

  test('Δ5 — ΑΓΝΩΣΤΟ ADR παίρνει τον τίτλο του, χωρίς να σκάει', () => {
    const r = chooseDecision('ADR-999', 'Ολοκαίνουργιο', new Map());
    expect(r.preserved).toBe(false);
    expect(r.text).toBe('Ολοκαίνουργιο');
  });

  test('Δ6 — κενό κελί ΔΕΝ καταγράφεται ως επιμελημένο', () => {
    expect(readDecisions('| **ADR-001** |   | ✅ | [View](./a.md) |').has('ADR-001')).toBe(false);
  });

  test('Δ7 — ΧΩΡΙΣ υπάρχοντα δείκτη δουλεύει (πρώτη γέννηση)', () => {
    expect(readDecisions('').size).toBe(0);
    expect(chooseDecision('ADR-001', 'Τίτλος', readDecisions('')).text).toBe('Τίτλος');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Φ — Ο ΦΡΟΥΡΟΣ ΣΥΡΡΙΚΝΩΣΗΣ (τρέχει το ΠΡΑΓΜΑΤΙΚΟ CLI)
// ═══════════════════════════════════════════════════════════════════════════

describe('Φ — ο δείκτης δεν μικραίνει σιωπηλά', () => {
  /**
   * ⚠️ Τρέχει το **πραγματικό** CLI σε αντίγραφο του δέντρου. Μια δοκιμή που
   * καλούσε μόνο τη συνάρτηση θα έμενε πράσινη με τον φρουρό **αποσυνδεδεμένο**
   * (μάθημα `Ν3` του CHECK 3.31 και `Ν2` του 3.61).
   */
  let sandbox;
  beforeAll(() => {
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-index-'));
    const ref = path.join(sandbox, 'reference');
    fs.mkdirSync(path.join(ref, 'scripts', 'lib'), { recursive: true });
    fs.mkdirSync(path.join(ref, 'adrs'), { recursive: true });
    fs.copyFileSync(GEN, path.join(ref, 'scripts', 'generate-adr-index.cjs'));
    fs.copyFileSync(
      path.join(REPO, 'docs/centralized-systems/reference/scripts/lib/preserve-decisions.cjs'),
      path.join(ref, 'scripts', 'lib', 'preserve-decisions.cjs'),
    );
    fs.writeFileSync(
      path.join(ref, 'adrs', 'ADR-001-alpha.md'),
      '# ADR-001: Άλφα\n\n**Status**: ✅ IMPLEMENTED\n**Date**: 2026-01-01\n',
    );
  });

  const run = (extraArgs) => {
    const gen = path.join(sandbox, 'reference', 'scripts', 'generate-adr-index.cjs');
    try {
      execFileSync('node', [gen].concat(extraArgs || []), { encoding: 'utf8', stdio: 'pipe' });
      return { code: 0 };
    } catch (e) {
      return { code: e.status, err: String(e.stderr || '') };
    }
  };

  test('Φ0 — ΠΑΡΟΝΟΜΑΣΤΗΣ: σε καθαρό δέντρο ο γεννήτορας ΠΕΤΥΧΑΙΝΕΙ', () => {
    // Χωρίς αυτό, ένα «απέτυχε» παρακάτω δεν ξεχωρίζει από «είναι σπασμένος».
    expect(run().code).toBe(0);
  });

  /** Σπέρνει επιμελημένο κελί για το ADR-001 στον υπάρχοντα δείκτη. */
  const CURATED = 'ΕΠΙΜΕΛΗΜΕΝΗ ΠΕΡΙΓΡΑΦΗ — ' + 'λεπτομέρεια '.repeat(40).trim();
  const seedCurated = () => {
    const idx = path.join(sandbox, 'reference', 'adr-index.md');
    const seeded = fs
      .readFileSync(idx, 'utf8')
      .split('\n')
      .map((l) => (/^\|\s*\*\*ADR-001\*\*/.test(l)
        ? l.replace(/^(\|\s*\*\*ADR-001\*\*\s*\|)[^|]*\|/, `$1 ${CURATED} |`)
        : l))
      .join('\n');
    fs.writeFileSync(idx, seeded, 'utf8');
    return seeded;
  };

  test('Φ1 — ΑΡΝΕΙΤΑΙ όταν ένα ADR χάνει την περιγραφή του', () => {
    // Η ΠΡΑΓΜΑΤΙΚΗ απώλεια: το ADR σβήνεται από τον δίσκο ⇒ η γραμμή του
    // εξαφανίζεται ⇒ η επιμελημένη περιγραφή χάνεται. Είναι η ακραία μορφή του
    // «έχασε την περιγραφή του», και το ερώτημα που ο φρουρός υπάρχει να απαντά.
    expect(run().code).toBe(0);
    expect(seedCurated()).toContain(CURATED);
    fs.unlinkSync(path.join(sandbox, 'reference', 'adrs', 'ADR-001-alpha.md'));
    const r = run();
    expect(r.code).not.toBe(0);
    expect(r.err).toContain('ΑΡΝΗΣΗ');
  });

  test('Φ2 — το μήνυμα δίνει ΟΝΟΜΑ, όχι μόνο αριθμό', () => {
    // 🔴 Ένας φρουρός που λέει «χάθηκαν N χαρακτήρες» στέλνει τον άνθρωπο να
    // ψάξει· ένας που λέει «ADR-001: 505 → 0» του δείχνει πού. Ίδια αρχή με το
    // ratchet κατά ταυτότητα του CHECK 3.60.
    const r = run();
    expect(r.err).toContain('ADR-001');
    expect(r.err).toContain('χαρακτήρες');
    expect(r.err).not.toContain('bytes');
  });

  test('Φ2β — ΔΕΝ πυροδοτεί σε κοσμητική διαφορά κενών', () => {
    // 🔴 Η ΠΡΩΤΗ ΓΡΑΦΗ ΤΟΥ ΦΡΟΥΡΟΥ (μέγεθος αρχείου) πυροδοτούσε για **2
    // χαρακτήρες** — ένα κενό που το `trim()` έκοψε. Φρουρός που κοκκινίζει σε
    // κοσμητική διαφορά μαθαίνει τον επόμενο να γράφει `--allow-shrink` από
    // συνήθεια, και τότε παύει να φυλάει οτιδήποτε (CHECK 3.39).
    fs.writeFileSync(
      path.join(sandbox, 'reference', 'adrs', 'ADR-001-alpha.md'),
      '# ADR-001: Άλφα\n\n**Status**: ✅ IMPLEMENTED\n**Date**: 2026-01-01\n',
    );
    expect(run().code).toBe(0);
    // κελί με ΚΕΝΟ στο τέλος — ακριβώς η περίπτωση που έσπαγε
    const idx = path.join(sandbox, 'reference', 'adr-index.md');
    const withTrailing = fs
      .readFileSync(idx, 'utf8')
      .split('\n')
      .map((l) => (/^\|\s*\*\*ADR-001\*\*/.test(l)
        ? l.replace(/^(\|\s*\*\*ADR-001\*\*\s*\|)[^|]*\|/, `$1 ${CURATED}   |`)
        : l))
      .join('\n');
    fs.writeFileSync(idx, withTrailing, 'utf8');
    expect(run().code).toBe(0);
  });

  test('Φ3 — `--allow-shrink` επιτρέπει τη ΡΗΤΗ πράξη ανθρώπου', () => {
    fs.unlinkSync(path.join(sandbox, 'reference', 'adrs', 'ADR-001-alpha.md'));
    expect(run().code).not.toBe(0);
    expect(run(['--allow-shrink']).code).toBe(0);
    // επαναφορά για τα επόμενα
    fs.writeFileSync(
      path.join(sandbox, 'reference', 'adrs', 'ADR-001-alpha.md'),
      '# ADR-001: Άλφα\n\n**Status**: ✅ IMPLEMENTED\n**Date**: 2026-01-01\n',
    );
  });

  test('Φ5 — ΤΟ ΕΠΙΜΕΛΗΜΕΝΟ ΚΕΛΙ ΕΠΙΒΙΩΝΕΙ ΜΕΣΑ ΑΠΟ ΤΟ ΠΡΑΓΜΑΤΙΚΟ CLI', () => {
    // 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΕΛΕΙΠΕ. Οι `Δ` δοκιμάζουν τη **συνάρτηση**· αυτή δοκιμάζει
    // ότι ο γεννήτορας **την καλεί**. Μια μετάλλαξη που ξαναέγραφε `adr.title`
    // στον συγκεντρωτικό πίνακα έμεινε **ΠΡΑΣΙΝΗ** χωρίς αυτήν: ο διατηρητής
    // δούλευε τέλεια και **κανείς δεν τον ρωτούσε** — φρουρός αποσυνδεδεμένος,
    // το ίδιο σχήμα με το `Ν3` του CHECK 3.31.
    //
    // ⚠️ Το πλούσιο κελί πρέπει να είναι ΜΑΚΡΥΤΕΡΟ από τον τίτλο, αλλιώς ο
    // κανόνας σωστά προτιμά τον τίτλο και η άγκυρα θα δοκίμαζε άλλο πράγμα.
    const idx = path.join(sandbox, 'reference', 'adr-index.md');
    expect(run().code).toBe(0);
    expect(seedCurated()).toContain(CURATED);

    expect(run().code).toBe(0);
    const after = fs.readFileSync(idx, 'utf8');
    // ΚΑΙ ΣΤΟΥΣ ΔΥΟ πίνακες — ο συγκεντρωτικός (6 στήλες) και ο ανά κατηγορία (4).
    const rows = after.split('\n').filter((l) => /^\|\s*\*\*ADR-001\*\*/.test(l));
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row).toContain(CURATED);
    }
  });

  test('Φ4 — ΙΔΕΜΠΟΤΗΣ: δεύτερη εκτέλεση δίνει ταυτόσημο αρχείο (N.7.2 #3)', () => {
    const idx = path.join(sandbox, 'reference', 'adr-index.md');
    expect(run().code).toBe(0);
    const first = fs.readFileSync(idx, 'utf8');
    expect(run().code).toBe(0);
    // ⚠️ Η ημερομηνία «Last Updated» είναι η ΜΟΝΗ νόμιμη διαφορά μέσα στην ίδια
    // μέρα δεν αλλάζει· τη σβήνουμε ρητά ώστε το test να μη σπάει τα μεσάνυχτα.
    const norm = (s) => s.replace(/Last Updated: [0-9-]+/, 'Last Updated: X');
    expect(norm(fs.readFileSync(idx, 'utf8'))).toBe(norm(first));
  });
});
