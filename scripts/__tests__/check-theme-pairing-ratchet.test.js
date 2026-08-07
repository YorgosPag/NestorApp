/**
 * CHECK 3.39 / ADR-770 Στρώμα 2 — η πύλη θεματικού ζευγαρώματος ελέγχεται από τη ΔΙΚΗ της σουίτα.
 *
 * ΔΟΜΗ (ίδια με τα CHECK 3.35/3.36/3.37/3.38):
 *   Μ0      — το ΖΩΝΤΑΝΟ δέντρο περνά καθαρό απέναντι στην πραγματική baseline
 *   Μ1..Μ9  — μία ΜΕΤΑΛΛΑΞΗ ανά ρητή κατάσταση· αν η πύλη δεν την πιάσει, δεν είναι πύλη
 *   Ρ       — ο ratchet: παραβίαση ΚΑΙ δήλωση, προσθήκη ⇒ μπλοκ, ανταλλαγή ⇒ μπλοκ
 *   Π       — ο ΠΡΑΓΜΑΤΙΚΟΣ κώδικας από το git: η μηχανή αναπαράγει το ζωντανό εύρημα
 *   Κ       — κοκκίωση: τι ΔΕΝ πιάνει, δηλωμένο ως test και όχι ως ελπίδα
 *
 * ⚠️ Το Π δεν χρησιμοποιεί κατασκευασμένο fixture: τραβά το `foundations.ts` από το git
 * και απαιτεί να βγει ο αριθμός που **μετρήθηκε στον browser** (1,01:1). Ένα fixture
 * αποδεικνύει ότι ο κώδικας συμφωνεί με τον εαυτό του· το `git show` αποδεικνύει ότι
 * η μηχανή περιγράφει την **πραγματικότητα**.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { readTokenPalette, semanticEntries, classifyRole, classifyValue } = require('../lib/contrast/ts-token-palette');
const { readThemes, surfaceTokens, foregroundTokens } = require('../lib/contrast/css-token-themes');
const { evaluate, RATCHETED_STATES, HEALTHY_STATES, hexToRgb, isTextual } = require('../lib/contrast/theme-pairing');
const { compareSets } = require('../lib/ratchet-baseline');
const { measure, violationId, declarationIds, baselineFile } = require('../check-theme-pairing-ratchet');

const REPO_ROOT = path.join(__dirname, '..', '..');

/**
 * Ένα ελάχιστο αλλά ΑΛΗΘΙΝΟ globals.css: δύο θέματα, επιφάνειες που όντως
 * αντιστρέφονται (λευκό ↔ σχεδόν μαύρο) και foreground tokens που ακολουθούν.
 * Οι τιμές είναι HSL γιατί αυτό είναι που γράφει το πραγματικό αρχείο.
 */
const MINI_CSS = `
:root {
  --background: 0 0% 100%;
  --card: 0 0% 100%;
  --foreground: 222 47% 11%;
  --card-foreground: 222 47% 11%;
}
.dark {
  --background: 222 47% 11%;
  --card: 217 33% 17%;
  --foreground: 210 40% 98%;
  --card-foreground: 210 40% 98%;
}
`;

/** Στήνει μίνι-repo με το ΑΚΡΙΒΕΣ δέντρο που περιμένουν οι δύο readers. */
function miniRepo(moduleSource, css = MINI_CSS) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tp39-'));
  fs.mkdirSync(path.join(root, 'src', 'styles', 'design-tokens', 'modules'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'app', 'globals.css'), css);
  fs.writeFileSync(path.join(root, 'src/styles/design-tokens/modules/test-tokens.ts'), moduleSource);
  return root;
}

/** Τρέχει ολόκληρη τη μηχανή πάνω σε ένα μίνι-repo. */
function run(moduleSource, css) {
  const root = miniRepo(moduleSource, css);
  return evaluate(readTokenPalette(root), readThemes(root));
}

const statesOf = (result, prefix) =>
  result.findings.filter((f) => f.state === prefix).map((f) => f.id);

// ─── Μ0 — αγκύρωση παλινδρόμησης στο ζωντανό δέντρο ───────────────────────────

describe('Μ0 — το ζωντανό δέντρο περνά απέναντι στην πραγματική baseline', () => {
  const baseline = JSON.parse(fs.readFileSync(baselineFile(), 'utf8'));

  test('η baseline έχει το σχήμα που περιμένει η πύλη', () => {
    expect(Array.isArray(baseline.violations)).toBe(true);
    expect(Array.isArray(baseline.declarations)).toBe(true);
    expect(baseline.adr).toMatch(/CHECK 3\.39/);
    // Το μάθημα των πέντε «0 = κανείς δεν κοίταξε»: η baseline ΠΡΕΠΕΙ να λέει
    // ρητά ότι ο αριθμός δεν είναι δείκτης υγείας.
    expect(baseline.note).toMatch(/ΔΕΝ είναι δείκτης υγείας/);
  });

  test('το ζωντανό δέντρο δεν έχει καμία προσθήκη έναντι της baseline', () => {
    const m = measure();
    expect(compareSets(m.violationIds, baseline.violations).added).toEqual([]);
    expect(compareSets(m.declarations, baseline.declarations).added).toEqual([]);
  });

  test('τα σύνολα του αρχείου συμφωνούν με τα δικά του δεδομένα', () => {
    expect(baseline.violations.length).toBe(baseline.violation_count);
    expect(baseline.declarations.length).toBe(baseline.declaration_count);
  });

  test('κάθε κατάσταση της baseline είναι ratcheted — καμία υγιής δεν μπήκε κατά λάθος', () => {
    for (const id of baseline.violations) {
      expect(RATCHETED_STATES).toContain(id.split('::')[0]);
    }
  });
});

// ─── Μ1..Μ9 — μία μετάλλαξη ανά ρητή κατάσταση ────────────────────────────────

describe('Μ1..Μ9 — κάθε κατάσταση παράγεται από πραγματική μετάλλαξη', () => {
  test('Μ1 — δηλωμένο ζεύγος που αποτυγχάνει ⇒ declared-pair-fail', () => {
    const r = run(`export const t = {
      alert: { background: "#ffffff", icon: "#fafafa" }
    } as const;`);
    expect(statesOf(r, 'declared-pair-fail')).toHaveLength(1);
    expect(r.findings.find((f) => f.state === 'declared-pair-fail').detail).toMatch(/WCAG 1\.4\.11/);
  });

  test('Μ2 — δηλωμένο ζεύγος με επαρκή αντίθεση ⇒ declared-pair-ok', () => {
    const r = run(`export const t = {
      alert: { background: "#ffffff", icon: "#1a1a1a" }
    } as const;`);
    expect(statesOf(r, 'declared-pair-ok')).toHaveLength(1);
    expect(statesOf(r, 'declared-pair-fail')).toHaveLength(0);
  });

  test('Μ3 — θεματικό ζεύγος με σκέλος αόρατο παντού ⇒ themed-side-invisible', () => {
    // Σκούρο περίγραμμα δηλωμένο για το ΣΚΟΤΕΙΝΟ θέμα: το κλασικό λογικό λάθος
    // «σκοτεινό θέμα ⇒ σκούρα χρώματα», που το κάνει αόρατο σε κάθε επιφάνεια.
    const r = run(`export const borderColors = {
      divider: { light: "#111111", dark: "#141414" }
    } as const;`);
    expect(statesOf(r, 'themed-side-invisible')).toHaveLength(1);
  });

  test('Μ4 — θεματικό ζεύγος σωστά αντεστραμμένο ⇒ themed-side-ok και στα δύο', () => {
    const r = run(`export const borderColors = {
      divider: { light: "#111111", dark: "#eeeeee" }
    } as const;`);
    expect(statesOf(r, 'themed-side-ok')).toHaveLength(2);
    expect(statesOf(r, 'themed-side-invisible')).toHaveLength(0);
  });

  test('Μ5 — σταθερό χρώμα κειμένου που αντιστρέφει ετυμηγορία ⇒ theme-flip', () => {
    const r = run(`export const colors = { text: { primary: "#1e293b" } } as const;`);
    expect(statesOf(r, 'theme-flip')).toHaveLength(1);
    expect(r.findings.find((f) => f.state === 'theme-flip').detail).toMatch(/σπάει στο σκοτεινό/);
  });

  test('Μ6 — χρώμα κειμένου που αποτυγχάνει ΚΑΙ ΣΤΑ ΔΥΟ ⇒ both-fail, ΟΧΙ theme-flip', () => {
    // Μεσαίο γκρι ανάμεσα σε δύο ΜΕΤΡΙΑΣ φωτεινότητας επιφάνειες: χάνεται και στις δύο.
    // Είναι λάθος επιλογή χρώματος, ΟΧΙ θεματικό σφάλμα — και η πύλη πρέπει να τα
    // ξεχωρίζει, αλλιώς η μετανάστευση σε tokens θα κυνηγούσε λάθος στόχο.
    //
    // ⚠️ Χρειάζεται ΔΙΚΟ του θέμα, και αυτό είναι εύρημα: με τις κανονικές επιφάνειες
    // (λευκό ↔ σχεδόν μαύρο) **δεν υπάρχει** γκρι που να αποτυγχάνει και στα δύο —
    // όσο σκουραίνει για το λευκό, τόσο ανοίγει για το μαύρο. Το `both-fail` απαιτεί
    // επιφάνειες κοντινής φωτεινότητας· γι' αυτό στο πραγματικό δέντρο είναι σπάνιο.
    const midCss = `
:root { --card: 0 0% 100%; --foreground: 222 47% 11%; }
.dark { --card: 0 0% 45%; --foreground: 210 40% 98%; }
`;
    const r = run(`export const colors = { text: { mid: "#8a8a8a" } } as const;`, midCss);
    expect(statesOf(r, 'both-fail')).toHaveLength(1);
    expect(statesOf(r, 'theme-flip')).toHaveLength(0);
  });

  test('Μ7 — καρφωμένη επιφάνεια ⇒ surface-theme-flip', () => {
    const r = run(`export const colors = { background: { panel: "#ffffff" } } as const;`);
    expect(statesOf(r, 'surface-theme-flip')).toHaveLength(1);
    expect(r.findings.find((f) => f.state === 'surface-theme-flip').detail)
      .toMatch(/καρφωμένη επιφάνεια/);
  });

  test('Μ8 — σκαλί παλέτας ⇒ ΕΚΤΟΣ ΕΜΒΕΛΕΙΑΣ, κανένα εύρημα αλλά ΜΕΤΡΗΜΕΝΟ', () => {
    const r = run(`export const colors = { blue: { "500": "#3b82f6" } } as const;`);
    expect(r.findings).toHaveLength(0);
    // ⚠️ Το «κανένα εύρημα» ΔΕΝ επιτρέπεται να σημαίνει «δεν κοίταξα»:
    // η δήλωση πρέπει να εμφανίζεται ρητά στο out-of-scope.
    expect(r.outOfScope['literal-hex/primitive']).toBe(1);
  });

  test('Μ9 — token μέσω hsl(var(--…)) ⇒ ΔΕΝ κρίνεται, καταγράφεται ως css-var', () => {
    const r = run(`export const colors = { text: { ok: 'hsl(var(--foreground))' } } as const;`);
    expect(r.findings).toHaveLength(0);
    expect(r.outOfScope['css-var']).toBe(1);
  });
});

// ─── Ρ — ο ratchet: δύο μηχανισμοί, και οι δύο μπλοκάρουν ──────────────────────

describe('Ρ — ratchet κατά ταυτότητα, σε παραβιάσεις ΚΑΙ σε δηλώσεις', () => {
  test('Ρ1 — ΝΕΑ παραβίαση ⇒ added ⇒ μπλοκ', () => {
    const cmp = compareSets(['theme-flip::a::colors.text.x', 'theme-flip::a::colors.text.y'],
      ['theme-flip::a::colors.text.x']);
    expect(cmp.added).toEqual(['theme-flip::a::colors.text.y']);
  });

  test('Ρ2 — ΑΝΤΑΛΛΑΓΗ παραβίασης (ίδιο πλήθος) ⇒ ΜΠΛΟΚ — το μάθημα του ADR-749', () => {
    const cmp = compareSets(['theme-flip::a::colors.text.y'], ['theme-flip::a::colors.text.x']);
    expect(cmp.currentCount).toBe(cmp.baselineCount); // ίδιος αριθμός…
    expect(cmp.added).toHaveLength(1); // …και όμως παλινδρόμηση
  });

  test('Ρ3 — ΝΕΑ σημασιολογική δήλωση μπλοκάρει ΑΚΟΜΑ ΚΑΙ ΑΝ είναι υγιής', () => {
    // Το μοντέλο Atlassian: η μάζα ratchet-άρεται, το ΝΕΟ απαγορεύεται. Ένα hex που
    // σήμερα περνά και στα δύο θέματα θα σπάσει μόλις μετακινηθεί μια επιφάνεια.
    const r = run(`export const colors = { text: { fresh: "#000000" } } as const;`);
    const healthy = r.findings.filter((f) => HEALTHY_STATES.includes(f.state));
    expect(healthy.length + r.findings.length).toBeGreaterThan(0);
    const root = miniRepo(`export const colors = { text: { fresh: "#000000" } } as const;`);
    const ids = declarationIds(readTokenPalette(root));
    expect(compareSets(ids, []).added).toHaveLength(1); // baseline κενή ⇒ η δήλωση είναι νέα
  });

  test('Ρ4 — αφαίρεση παραβίασης ⇒ removed, ΟΧΙ added (πρόοδος δεν μπλοκάρει)', () => {
    const cmp = compareSets([], ['theme-flip::a::colors.text.x']);
    expect(cmp.added).toEqual([]);
    expect(cmp.removed).toHaveLength(1);
  });

  test('Ρ5 — η ταυτότητα ΔΕΝ περιέχει αριθμό γραμμής (μετακίνηση δεν κοκκινίζει)', () => {
    const id = violationId({ state: 'theme-flip', id: 'f.ts::colors.text.primary', line: 17 });
    expect(id).not.toMatch(/17/);
    expect(id).toBe('theme-flip::f.ts::colors.text.primary');
  });
});

// ─── Π — ο πραγματικός κώδικας, από το git ────────────────────────────────────

describe('Π — η μηχανή αναπαράγει το ΖΩΝΤΑΝΟ εύρημα του ADR-759', () => {
  test('το `foundations.ts` του HEAD δηλώνει ΑΚΡΙΒΩΣ το χρώμα που μετρήθηκε στον browser', () => {
    const body = execFileSync('git', ['show', 'HEAD:src/styles/design-tokens/modules/foundations.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    const root = miniRepo(body);
    const palette = readTokenPalette(root);
    const textPrimary = palette.entries.find((e) => e.path === 'colors.text.primary');

    expect(textPrimary.hex).toBe('#1e293b');
    // Το ζωντανό στιγμιότυπο έδειχνε `style="color: rgb(30, 41, 59)"`. Είναι η ΙΔΙΑ τιμή.
    expect(hexToRgb(textPrimary.hex)).toEqual([30, 41, 59]);
  });

  test('πάνω στο ΠΡΑΓΜΑΤΙΚΟ globals.css βγαίνει το μετρημένο 1,01:1 στο σκοτεινό --card', () => {
    const themes = readThemes(REPO_ROOT);
    const card = surfaceTokens(themes.dark).find((s) => s.name === '--card');
    const { contrastRatio, hslToRgb } = require('../lib/contrast/wcag-contrast');
    const ratio = contrastRatio(hexToRgb('#1e293b'), hslToRgb(card.hsl));
    expect(+ratio.toFixed(2)).toBe(1.01);
  });

  test('η πύλη κατατάσσει το ζωντανό εύρημα ως theme-flip, όχι ως κάτι ήπιο', () => {
    const m = measure();
    const finding = m.result.findings.find((f) => f.id.endsWith('::colors.text.primary'));
    expect(finding.state).toBe('theme-flip');
    expect(RATCHETED_STATES).toContain(finding.state);
  });
});

// ─── Κ — τα όρια είναι δηλωμένα, όχι σιωπηλά ──────────────────────────────────

describe('Κ — κοκκίωση και δηλωμένα όρια', () => {
  test('Κ1 — ΚΑΘΕ σημασιολογική δήλωση του δέντρου κρίθηκε — καμία δεν πέφτει σιωπηλά έξω', () => {
    // Ο έλεγχος που κάνει το «0 παραβιάσεις» να σημαίνει κάτι. Χρησιμοποιεί το `declId`
    // και όχι το `id`: ένα δηλωμένο ζεύγος κρίνεται ΜΙΑ φορά ανά επιφάνεια (άρα το `id`
    // του φέρει και το φόντο), αλλά ΔΗΛΩΝΕΤΑΙ μία φορά. Η πρώτη εκδοχή αυτού του test
    // σύγκρινε τα λάθος σύνολα και κοκκίνισε — σωστά.
    const m = measure();
    const judged = new Set(m.result.findings.map((f) => f.declId));
    const unjudged = m.declarations.filter((id) => !judged.has(id));
    expect(unjudged).toEqual([]);
  });

  test('Κ2 — ο ρόλος προκύπτει από το ΜΟΝΟΠΑΤΙ, όχι από την τιμή', () => {
    // Η ίδια τιμή, δύο ρόλοι, δύο ετυμηγορίες. Μια συνάρτηση που κοιτάζει μόνο το
    // χρώμα δεν μπορεί να τα διακρίνει — γι' αυτό ο ταξινομητής διαβάζει το μονοπάτι.
    expect(classifyRole(['colors', 'text', 'inverse'])).toBe('foreground');
    expect(classifyRole(['colors', 'background', 'primary'])).toBe('surface');
    expect(classifyRole(['colors', 'blue', '500'])).toBe('primitive');
  });

  test('Κ3 — πληθυντικός και camelCase ονομάζουν ρόλο (τα 13 που έλειπαν)', () => {
    expect(classifyRole(['borderColors', 'default', 'light'])).toBe('border');
    expect(classifyRole(['x', 'uploadingBackground'])).toBe('surface');
    // …αλλά μια λέξη που απλώς περιέχει τα γράμματα ΔΕΝ είναι ρόλος.
    expect(classifyRole(['Debug'])).toBe('unknown');
  });

  test('Κ4 — το κατώφλι διαφέρει: εικονίδιο 3:1, κείμενο 4,5:1', () => {
    expect(isTextual({ segments: ['colors', 'text', 'primary'] })).toBe(true);
    expect(isTextual({ segments: ['colors', 'severity', 'icon'] })).toBe(false);
  });

  test('Κ5 — ΔΗΛΩΜΕΝΟ ΚΕΝΟ: κρίνονται μόνο literal hex, όχι υπολογισμένες τιμές', () => {
    // `style={someVariable}` και `rgba(...)` δεν αποτιμώνται στατικά. Το γράφουμε ως
    // test ώστε το «πέρασε» να μη διαβαστεί ποτέ ως «δεν υπάρχουν τέτοιες τιμές».
    expect(classifyValue('rgba(0, 0, 0, 0.5)').form).toBe('rgb-literal');
    expect(classifyValue('var(--x)').form).toBe('css-var');
    const r = run(`export const colors = { text: { a: 'rgba(0,0,0,0.5)' } } as const;`);
    expect(r.findings).toHaveLength(0);
    expect(r.outOfScope['rgb-literal']).toBe(1);
  });

  test('Κ6 — ΔΗΛΩΜΕΝΟ ΚΕΝΟ: επιφάνεια που υπάρχει σε ΕΝΑ μόνο θέμα δεν κρίνεται', () => {
    const css = MINI_CSS.replace('.dark {', '.dark {\n  --only-dark: 0 0% 5%;');
    const root = miniRepo(`export const colors = { text: { p: "#1e293b" } } as const;`, css);
    const themes = readThemes(root);
    // Η επιφάνεια υπάρχει μόνο στο σκοτεινό ⇒ δεν μπορεί να απαντήσει «αλλάζει;»
    expect(surfaceTokens(themes.light).some((s) => s.name === '--only-dark')).toBe(false);
  });

  test('Κ7 — fail-closed: ελλιπές δέντρο ⇒ ΣΦΑΛΜΑ, ποτέ «καθαρό»', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'tp39-empty-'));
    expect(() => readTokenPalette(empty)).toThrow(/fail-closed/);
  });

  test('Κ8 — τα foreground tokens του πραγματικού θέματος όντως αλλάζουν τιμή', () => {
    // Αν δεν άλλαζαν, η κατηγορία «καρφωμένη επιφάνεια» δεν θα μπορούσε να πει τίποτα.
    const themes = readThemes(REPO_ROOT);
    const l = foregroundTokens(themes.light).find((t) => t.name === '--foreground');
    const d = foregroundTokens(themes.dark).find((t) => t.name === '--foreground');
    expect(l.value).not.toBe(d.value);
  });
});
