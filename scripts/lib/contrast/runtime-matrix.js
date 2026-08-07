/**
 * Ο ΚΡΙΤΗΣ του Στρώματος 2β (ADR-770 §13) — μεταφράζει το στιγμιότυπο του browser σε
 * είσοδο για την **ΥΠΑΡΧΟΥΣΑ** μηχανή του CHECK 3.39.
 *
 * 🔑 Η ΚΕΝΤΡΙΚΗ ΑΡΧΗ: το 2β **δεν είναι νέα μηχανή κρίσης — είναι νέα ΠΗΓΗ ΤΙΜΩΝ**.
 * Το κριτήριο («αλλάζει η ετυμηγορία ανάμεσα στα δύο θέματα;»), τα κατώφλια, η
 * ταξινόμηση ρόλων, η αναγνώριση ζεύγους και οι εννέα καταστάσεις ζουν **μία φορά**,
 * στα `theme-pairing.js` / `ts-token-palette.js`. Εδώ αλλάζει μόνο η **προέλευση** των
 * αριθμών: αντί για parsed hex του AST, **υπολογισμένα rgb** από τον browser.
 *
 * Γι' αυτό το 2β κλείνει τα ρητά όρια **Κ5–Κ7** του 2α αντί να τα ξανα-δηλώνει:
 *   · `rgba()` / `hsl()` literal        — ο browser τα λύνει, το regex του AST όχι
 *   · `hsl(var(--x))` και indirection    — ο AST τα λέει `css-var`, «εκτός εμβέλειας»
 *   · `color-mix()` / υπολογισμένα       — ίδιο
 *
 * ΤΡΕΙΣ ΝΕΕΣ ΚΑΤΑΣΤΑΣΕΙΣ, που κανένα στατικό εργαλείο **δεν μπορεί** να παράγει:
 *
 *   1. `dangling-var` — η δήλωση δείχνει σε custom property που **δεν ορίζεται πουθενά**.
 *      Το declaration γίνεται *invalid at computed-value time*, οπότε το στοιχείο βάφεται
 *      με το **κληρονομημένο** χρώμα: όχι λάθος χρώμα, **αυθαίρετο**. Μετρήθηκε
 *      2026-08-07: **18 δηλώσεις**, **11 ονόματα** (`--color-bg-primary`,
 *      `--color-text-tertiary`, `--radius-sm`, `--spacing-4`, …) — ολόκληρο το
 *      `layoutUtilities.cssVars.*` ζητά τη σύμβαση ονομασίας μιας **παλαιότερης** έκδοσης
 *      του generator, ενώ το τρέχον `variables.css` παράγει άλλα ονόματα
 *      (`--color-text-muted`, `--border-radius-sm`). Αόρατο σε AST εξ ορισμού: το
 *      ερώτημα «υπάρχει αυτό το var;» απαντιέται μόνο από το **φορτωμένο** CSS.
 *
 *   2. `ast-runtime-divergence` — ο AST διάβασε **άλλο** χρώμα από αυτό που βάφει ο
 *      browser για την **ίδια** δήλωση. Σημαίνει ότι κάτι μεσολαβεί (re-export που
 *      σκιάζει, `as const` που παραπλανά, τιμή που ξαναγράφεται). Η ερώτηση «η δήλωση
 *      που διάβασε το εργαλείο είναι η τιμή που είδε ο χρήστης;» **δεν** υπάρχει σε
 *      Material 3, Leonardo ή Atlassian — και είναι η προϋπόθεση για να σημαίνει κάτι
 *      οποιαδήποτε στατική μέτρηση.
 *
 *   3. `translucent-invisible` — ημιδιαφανής δήλωση (α<1) που, **συνθεμένη πάνω σε κάθε
 *      επιφάνεια** του θέματός της, δεν φτάνει το κατώφλι σε καμία. Το άλφα είναι ο λόγος
 *      που το 2α δεν μπορούσε να τις κρίνει: το χρώμα τους **δεν είναι ένα** — είναι ένα
 *      ανά φόντο.
 *
 * ⚠️ ΤΙ ΔΕΝ ΑΠΑΝΤΑ ΑΥΤΟ ΤΟ ΣΤΡΩΜΑ (ρητά, ώστε το «0» να μη σημαίνει «δεν κοίταξα»):
 *   · Τη **σύνθεση προγόνων σε πραγματικές σελίδες**. Μετρήθηκε ότι χωρίς
 *     αυθεντικοποίηση οι λίστες δεδομένων βάφουν **μόνο** το sidebar (ταυτόσημα 33
 *     στοιχεία σε 4 διαδρομές), άρα μια σάρωση διαδρομών θα μέτραγε το ίδιο πράγμα
 *     τέσσερις φορές. Το όργανο για αυτό υπάρχει και είναι βαθμονομημένο:
 *     `runtime-contrast-sweep.js` — **διαγνωστικό**, όχι πύλη.
 *   · Τις **style factories** (`layoutUtilities.dxf.colors.backgroundColor(x)`): δεν
 *     έχουν τιμή χωρίς ορίσματα. Το πλήθος τους καταγράφεται στο στιγμιότυπο.
 *   · Τα **χρώματα από δεδομένα χρήστη** (`entry.color`, `brandColor`): κανένα token δεν
 *     τα λύνει· θέλουν αυτόματο on-color, ξεχωριστό ερώτημα.
 *
 * @module scripts/lib/contrast/runtime-matrix
 */

'use strict';

const {
  parseComputedColor, toHex, contrastRatio, hslToRgb, compositeOver,
} = require('./wcag-contrast');
const { surfaceTokens, foregroundTokens, describeValue } = require('./css-token-themes');
const { derivePairs, classifyRole, classifyValue } = require('./ts-token-palette');
const { evaluate, thresholdFor, RATCHETED_STATES } = require('./theme-pairing');

/** Πηγή που δηλώνεται όταν μια δήλωση δεν γεφυρώνεται σε αρχείο AST. */
const RUNTIME_SOURCE = '(runtime)';

/** Οι νέες καταστάσεις του 2β. Ratchet — 18 `dangling-var` υπάρχουν ήδη (§12.5). */
const RUNTIME_RATCHETED_STATES = [
  'dangling-var',
  'ast-runtime-divergence',
  'translucent-invisible',
];

/** Οι καταστάσεις που μετρώνται έναντι baseline: οι εννέα του 3.39 **και** οι τρεις νέες. */
const ALL_RATCHETED_STATES = [...RATCHETED_STATES, ...RUNTIME_RATCHETED_STATES];

/**
 * Χτίσε το `palette` που περιμένει το `evaluate()`, από τα **υπολογισμένα** χρώματα.
 *
 * Η γεφύρωση με το AST γίνεται στο **μονοπάτι** (`colors.text.primary`), που τα δύο
 * στρώματα παράγουν ταυτόσημα εξ επιλογής. Ό,τι δεν γεφυρώνεται είναι **νέα** δήλωση
 * που ο AST δεν μπορούσε να δει — και είναι ακριβώς ο λόγος ύπαρξης του στρώματος.
 *
 * @param {object[]} declarations `{path, raw, computed, state}` του browser
 * @param {object} astPalette έξοδος του `readTokenPalette` (για file/line)
 */
function buildRuntimePalette(declarations, astPalette, aliases = []) {
  const astByPath = new Map(astPalette.entries.map((e) => [e.path, e]));

  /**
   * ΨΕΥΔΩΝΥΜΑ EXPORT — η δεύτερη αιτία αποτυχίας γεφύρωσης, και είναι νόμιμος κώδικας:
   *     `export const portalComponents = portalComponentsExtended;`
   * Ο AST βλέπει το object literal κάτω από το **ένα** όνομα· το `import *` του browser
   * το βλέπει και κάτω από το **άλλο**. Χωρίς αυτή την αντιστοίχιση, μια ολόκληρη
   * οικογένεια δηλώσεων εμφανιζόταν ως `bridge: 'none'` — δηλαδή αόρατη και στη
   * σύγκριση AST↔runtime, που είναι ο ίδιος ο μηχανισμός βαθμονόμησης.
   *
   * Τα ψευδώνυμα δεν μαντεύονται: το harness τα **μετρά** (ταυτότητα αντικειμένου) και
   * τα στέλνει μαζί με το στιγμιότυπο.
   */
  const rootAlias = new Map();
  for (const a of aliases) {
    const from = a.canonical.split('.')[0];
    const to = a.path.split('.')[0];
    if (from !== to) rootAlias.set(from, to);
  }
  const resolveAst = (p) => {
    const direct = astByPath.get(p);
    if (direct) return direct;
    const segments = p.split('.');
    const other = rootAlias.get(segments[0]);
    if (!other) return undefined;
    return astByPath.get([other, ...segments.slice(1)].join('.'));
  };

  /**
   * ΓΕΦΥΡΩΣΗ ΑΝΑ EXPORT — γιατί χρειάζεται, μετρημένο.
   *
   * 🔴 Μόνο **43%** (112/258) των δηλώσεων που λύνει ο browser υπάρχουν στο AST. Η αιτία
   * δεν είναι σφάλμα του AST reader: ο κώδικας γράφει **αναφορές**, όχι literals —
   *     `backgroundColor: colors.background.primary`
   *     `color: colors.text.inverse`
   *     `backgroundColor: semanticColors.status.warning`
   * — και το `walkObject` δέχεται μόνο `isStringLiteral`. Άρα το Στρώμα 2α είδε τη
   * **ρίζα** της βλάβης αλλά όχι τη **ΔΙΑΔΟΣΗ** της: 146 δηλώσεις κληρονομούν το ίδιο
   * μονοθεματικό hex μέσω αναφοράς, και καμία δεν μετρήθηκε ποτέ. Αυτός είναι ο λόγος
   * που οι 35 παραβιάσεις του 2α γίνονται 134 εδώ.
   *
   * Το αρχείο πάντως είναι γνωστό: το `mapControlPointTokens.base.backgroundColor` δεν
   * υπάρχει στο AST, αλλά το `mapControlPointTokens.base.width` υπάρχει — και ζει στο
   * ίδιο module. Χωρίς αυτή τη γεφύρωση κάθε τέτοιο εύρημα θα τυπωνόταν `(runtime):0`,
   * δηλαδή **σωστό αλλά μη-ενεργήσιμο**.
   */
  const fileByExport = new Map();
  for (const e of astPalette.entries) {
    const root = e.segments[0];
    if (!fileByExport.has(root)) fileByExport.set(root, e.file);
  }
  // Το ψευδώνυμο κληρονομεί το αρχείο του πραγματικού export.
  for (const [from, to] of rootAlias) {
    if (!fileByExport.has(from) && fileByExport.has(to)) fileByExport.set(from, fileByExport.get(to));
  }

  const entries = [];
  const translucent = [];

  for (const d of declarations) {
    if (d.state !== 'color') continue;
    const parsed = parseComputedColor(d.computed);
    if (!parsed) continue;

    const ast = resolveAst(d.path);
    const segments = d.path.split('.');
    const exportFile = fileByExport.get(segments[0]) || null;
    const base = {
      file: ast ? ast.file : (exportFile || RUNTIME_SOURCE),
      line: ast ? ast.line : 0,
      /** Πόσο ασφαλής είναι η αντιστοίχιση με τον πηγαίο κώδικα — τρεις ρητές τιμές. */
      bridge: ast ? 'exact' : exportFile ? 'export' : 'none',
      path: d.path,
      key: segments[segments.length - 1],
      segments,
      role: classifyRole(segments),
      raw: d.raw,
      astHex: ast && ast.form === 'literal-hex' ? ast.hex : null,
    };

    // Πλήρως διαφανές: δεν βάφει τίποτα, άρα δεν μπορεί να είναι αναγνώσιμο ή όχι.
    if (parsed.alpha === 0) continue;

    if (parsed.alpha < 1) {
      translucent.push({ ...base, rgb: parsed.rgb, alpha: parsed.alpha });
      continue;
    }
    entries.push({ ...base, form: 'literal-hex', hex: toHex(parsed.rgb) });
  }

  return { source: RUNTIME_SOURCE, files: [], entries, translucent, ...derivePairs(entries) };
}

/**
 * Μετέτρεψε τα custom properties του browser σε `themes` της μορφής που περιμένουν τα
 * `surfaceTokens` / `foregroundTokens` — δηλαδή `Map<name, rawValue>`.
 *
 * Οι τιμές είναι **υπολογισμένες**, οπότε ένα `--x: var(--y)` έχει ήδη λυθεί: το
 * δηλωμένο όριο του `css-token-themes` («ένα `var()` δεν επιλύεται εδώ — αναφέρεται ως
 * `indirect`») **παύει να ισχύει** σε αυτή τη διαδρομή. Αυτό είναι κέρδος, όχι σύμπτωση.
 */
function buildRuntimeThemes(snapshots) {
  const toMap = (props) => new Map(Object.entries(props));
  return { light: toMap(snapshots.light.customProperties), dark: toMap(snapshots.dark.customProperties) };
}

/** Ένα `var(--x)` του οποίου το `--x` δεν ορίζεται σε **κανένα** θέμα. */
function findDanglingVars(snapshots) {
  const defined = new Set([
    ...Object.keys(snapshots.light.customProperties),
    ...Object.keys(snapshots.dark.customProperties),
  ]);
  const findings = [];
  for (const d of snapshots.light.declarations) {
    if (d.state !== 'not-a-color') continue;
    const referenced = [...String(d.raw).matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((m) => m[1]);
    const missing = referenced.filter((name) => !defined.has(name));
    if (!missing.length) continue;
    findings.push({
      state: 'dangling-var',
      file: RUNTIME_SOURCE,
      line: 0,
      id: `${d.path}::${missing.join(',')}`,
      declId: d.path,
      detail:
        `${d.path} = ${d.raw} — το ${missing.join(', ')} δεν ορίζεται σε κανένα θέμα, `
        + 'άρα το declaration είναι άκυρο και το στοιχείο κληρονομεί αυθαίρετο χρώμα',
      missing,
    });
  }
  return findings;
}

/** Ο AST διάβασε άλλο χρώμα από αυτό που βάφει ο browser για την ίδια δήλωση. */
function findAstDivergence(palette) {
  const findings = [];
  for (const e of palette.entries) {
    if (!e.astHex) continue;
    // Το AST hex μπορεί να είναι σύντομης μορφής (`#fff`); κανονικοποιείται μέσω
    // classifyValue → hexToRgb θα ήταν κύκλος, οπότε συγκρίνουμε 6ψήφια μορφή.
    const astLong = e.astHex.length === 4
      ? '#' + e.astHex.slice(1).split('').map((c) => c + c).join('')
      : e.astHex.slice(0, 7);
    if (astLong.toLowerCase() === e.hex.toLowerCase()) continue;
    findings.push({
      state: 'ast-runtime-divergence',
      file: e.file,
      line: e.line,
      id: `${e.file}::${e.path}`,
      declId: `${e.file}::${e.path}`,
      detail: `${e.path}: ο AST διάβασε ${e.astHex}, ο browser βάφει ${e.hex}`,
    });
  }
  return findings;
}

/**
 * Ημιδιαφανείς δηλώσεις: το χρώμα τους **δεν είναι ένα**, είναι ένα ανά φόντο. Άρα
 * συνθέτονται πάνω σε **κάθε** επιφάνεια του κάθε θέματος και η ετυμηγορία είναι
 * «αόρατη παντού» (`translucent-invisible`) ή «στέκει κάπου» (`translucent-ok`).
 *
 * Το κατώφλι έρχεται από την **ίδια** `thresholdFor` του 3.39 — όχι από νέο αριθμό εδώ.
 */
function evaluateTranslucent(palette, themes) {
  const findings = [];
  const surfaces = { light: surfaceTokens(themes.light), dark: surfaceTokens(themes.dark) };
  const foregrounds = { light: foregroundTokens(themes.light), dark: foregroundTokens(themes.dark) };

  for (const t of palette.translucent) {
    if (!['foreground', 'border', 'surface'].includes(t.role)) continue;
    const { min, rule } = thresholdFor(t);
    let failing = 0;
    let total = 0;
    let best = 0;

    for (const theme of ['light', 'dark']) {
      for (const s of surfaces[theme]) {
        const base = hslToRgb(s.hsl);
        if (t.role === 'surface') {
          /**
           * ⚠️ ΗΜΙΔΙΑΦΑΝΗΣ **ΕΠΙΦΑΝΕΙΑ** — η ερώτηση αντιστρέφεται, όπως στην ομάδα Γ2.
           * Ένα `rgba(0,0,0,0.5)` overlay δεν είναι αόρατο από μόνο του: συνθέτεται
           * πάνω στην υποκείμενη επιφάνεια και **πάνω του** μπαίνει το θεματικό
           * χρώμα κειμένου. Αυτό είναι το modal backdrop, δηλαδή ένα από τα
           * συχνότερα σημεία όπου το κείμενο χάνεται στην πράξη.
           *
           * Η πρώτη υλοποίηση αυτής της συνάρτησης έκρινε **μόνο** foreground/border
           * και παρέλειπε **9 από τις 12** ημιδιαφανείς — ακριβώς το σφάλμα που το
           * test `Κ1` του Στρώματος 2α υπάρχει για να μην επαναληφθεί, επαναλαμβανόμενο
           * σε άλλο αρχείο. Άγκυρα εδώ: `Ρ5`.
           */
          const composited = compositeOver(t.rgb, base, t.alpha);
          for (const fg of foregrounds[theme]) {
            const ratio = contrastRatio(hslToRgb(fg.hsl), composited);
            total++;
            if (ratio < min) failing++;
            if (ratio > best) best = ratio;
          }
        } else {
          const composited = compositeOver(t.rgb, base, t.alpha);
          const ratio = contrastRatio(composited, base);
          total++;
          if (ratio < min) failing++;
          if (ratio > best) best = ratio;
        }
      }
    }
    if (!total) continue;

    const against = t.role === 'surface' ? 'θεματικά χρώματα κειμένου' : 'επιφάνειες';
    findings.push({
      state: failing === total ? 'translucent-invisible' : 'translucent-ok',
      file: t.file,
      line: t.line,
      id: `${t.file}::${t.path}`,
      declId: `${t.file}::${t.path}`,
      detail:
        `${t.path} = ${t.raw} (α=${t.alpha}, ρόλος ${t.role}) συνθεμένο: αποτυγχάνει σε `
        + `${failing}/${total} ${against} των δύο θεμάτων, καλύτερο ${best.toFixed(2)}:1, `
        + `απαιτείται ${min}:1 (${rule})`,
      failing,
      surfaces: total,
    });
  }
  return findings;
}

/**
 * Έλεγχοι ακεραιότητας του στιγμιότυπου. **Fail-closed**: ένα στιγμιότυπο που δεν
 * μπορεί να απαντήσει την ερώτηση πρέπει να **σκάει**, όχι να αναφέρει «καθαρό».
 * Το `themeVerified` είναι ο λόγος: το «`dark: false` αμέσως μετά τη φόρτωση» είναι
 * race, και ένας αριθμός από λάθος θέμα είναι χειρότερος από κανέναν αριθμό.
 */
function assertSnapshotUsable(snapshots) {
  for (const theme of ['light', 'dark']) {
    const s = snapshots[theme];
    if (!s) throw new Error(`runtime-matrix: λείπει το στιγμιότυπο "${theme}" — fail-closed.`);
    if (s.theme !== theme) throw new Error(`runtime-matrix: το στιγμιότυπο "${theme}" δηλώνει "${s.theme}".`);
    if (!s.themeVerified) {
      throw new Error(
        `runtime-matrix: το θέμα "${theme}" ΔΕΝ επαληθεύτηκε στον browser — race, όχι μέτρηση.`,
      );
    }
    if (!Array.isArray(s.declarations) || !s.declarations.length) {
      throw new Error(`runtime-matrix: το στιγμιότυπο "${theme}" δεν έχει δηλώσεις — fail-closed.`);
    }
    if (s.unreadableStylesheets) {
      throw new Error(
        `runtime-matrix: ${s.unreadableStylesheets} stylesheets δεν διαβάστηκαν (cross-origin) — `
        + 'η απαρίθμηση των custom properties θα ήταν ελλιπής.',
      );
    }
  }
  // Και τα δύο στιγμιότυπα ΠΡΕΠΕΙ να έχουν τις ίδιες δηλώσεις: αλλιώς συγκρίνουμε
  // διαφορετικά σύνολα και το «αλλάζει η ετυμηγορία;» χάνει το νόημά του.
  const l = snapshots.light.declarations.map((d) => d.path).join('|');
  const dk = snapshots.dark.declarations.map((d) => d.path).join('|');
  if (l !== dk) throw new Error('runtime-matrix: τα δύο στιγμιότυπα δεν έχουν τις ίδιες δηλώσεις.');
}

/**
 * Το πλήρες αποτέλεσμα του Στρώματος 2β.
 *
 * @param {{light:object, dark:object}} snapshots έξοδος του `window.__contrastMatrix`
 * @param {object} astPalette έξοδος του `readTokenPalette` — για γεφύρωση file/line
 */
function evaluateRuntimeMatrix(snapshots, astPalette) {
  assertSnapshotUsable(snapshots);
  const themes = buildRuntimeThemes(snapshots);
  const palette = buildRuntimePalette(snapshots.light.declarations, astPalette, snapshots.light.aliases || []);

  const shared = evaluate(palette, themes);
  const findings = [
    ...shared.findings,
    ...findDanglingVars(snapshots),
    ...findAstDivergence(palette),
    ...evaluateTranslucent(palette, themes),
  ];

  const byState = {};
  for (const f of findings) byState[f.state] = (byState[f.state] || 0) + 1;

  const snap = snapshots.light;

  /**
   * ΠΛΗΡΗΣ ΛΟΓΙΣΤΙΚΗ — κάθε δήλωση ανήκει σε **ακριβώς μία** κατηγορία: κρίθηκε, ή
   * είναι δηλωμένα ακάλυπτη. Ο έλεγχος `Ρ4` επιβάλλει ότι το άθροισμα κλείνει.
   *
   * ⚠️ Ο λόγος που υπάρχει: η πρώτη εκτέλεση έκρινε **3 από τις 12** ημιδιαφανείς και
   * παρέλειπε **9 σιωπηλά** (ρόλος `unknown`) — δηλαδή αναπαρήγαγε ακριβώς το σφάλμα
   * που το test `Κ1` του 2α υπάρχει για να μην ξανασυμβεί. Ένας αριθμός χωρίς
   * λογιστική είναι ισχυρισμός, όχι μέτρηση.
   */
  const judgedDeclIds = new Set(findings.map((f) => f.declId));
  const roleless = (list) => list.filter((e) => !['foreground', 'surface', 'border'].includes(e.role));

  // Κάθε δήλωση με σημασιολογικό ρόλο ΠΡΕΠΕΙ να έχει παραγάγει εύρημα. Ό,τι δεν έχει,
  // ονομάζεται εδώ — δεν εξαφανίζεται σε ένα άθροισμα που κλείνει.
  const judgeableIds = [...palette.entries, ...palette.translucent]
    .filter((e) => ['foreground', 'surface', 'border'].includes(e.role))
    .map((e) => `${e.file}::${e.path}`);
  const judgeableUnjudgedIds = [...new Set(judgeableIds.filter((id) => !judgedDeclIds.has(id)))].sort();
  const fullyTransparent = snap.declarations.filter((d) => {
    if (d.state !== 'color') return false;
    const p = parseComputedColor(d.computed);
    return p !== null && p.alpha === 0;
  }).length;
  const unparseable = snap.declarations.filter(
    (d) => d.state === 'color' && parseComputedColor(d.computed) === null,
  ).length;

  return {
    findings,
    byState,
    outOfScope: shared.outOfScope,
    judgeableUnjudgedIds,
    /** Ό,τι το στρώμα **δεν** έκρινε, με αριθμούς — ποτέ σιωπηλά. */
    unjudged: {
      // δεν είναι χρώμα / δεν βάφει τίποτα
      notAColor: snap.declarations.filter((d) => d.state === 'not-a-color').length,
      contextDependent: snap.declarations.filter((d) => d.state === 'disagreement').length,
      fullyTransparent,
      unparseableComputed: unparseable,
      // είναι χρώμα, αλλά δεν ισχυρίζεται σημασιολογικό ρόλο (`colors.blue.500`)
      opaqueWithoutRole: roleless(palette.entries).length,
      translucentWithoutRole: roleless(palette.translucent).length,
      // δεν έχει τιμή χωρίς συμφραζόμενα
      styleFactories: snap.skipped.functions.length,
      nonColorStrings: snap.skipped.nonColorStrings,
      cssUnsafeValues: snap.skipped.cssUnsafe.length,
      truncatedAtDepth: snap.skipped.truncatedAtDepth.length,
      aliasedPaths: snap.aliases.length,
    },
    /**
     * Η ποιότητα της αντιστοίχισης με τον πηγαίο κώδικα. ⚠️ Το `ast-runtime-divergence`
     * μπορεί να συγκρίνει **μόνο** τις `exact` — γι' αυτό ο αριθμός του διαβάζεται
     * **πάντα** μαζί με αυτό εδώ. «0 αποκλίσεις από 112 συγκρίσιμα» είναι μέτρηση·
     * «0 αποκλίσεις» χωρίς παρονομαστή θα ήταν άλλη εμφάνιση του «0 = δεν κοίταξα».
     */
    bridge: [...palette.entries, ...palette.translucent].reduce(
      (a, e) => ((a[e.bridge] = (a[e.bridge] || 0) + 1), a),
      {},
    ),
    counts: {
      declarations: snap.declarations.length,
      resolvedColors: palette.entries.length,
      translucent: palette.translucent.length,
      judgedDeclarations: judgedDeclIds.size,
      customProperties: Object.keys(snap.customProperties).length,
      surfacesLight: surfaceTokens(themes.light).length,
      surfacesDark: surfaceTokens(themes.dark).length,
    },
  };
}

/**
 * Η λογιστική ταυτότητα του στρώματος, ως **συνάρτηση** ώστε να μπορεί να ελεγχθεί:
 *
 *   δηλώσεις = κρίσιμα(αδιαφανή+ημιδιαφανή με ρόλο) + κάθε ρητά ακάλυπτη κατηγορία
 *
 * Επιστρέφει `{ balanced, expected, actual, breakdown }`. Αν δεν κλείνει, υπάρχει
 * σιωπηλή απόρριψη — και αυτή είναι η μόνη αστοχία που κρύβει βλάβες αντί να τις δείχνει.
 */
function auditCoverage(result) {
  const u = result.unjudged;
  const judgeable =
    (result.counts.resolvedColors - u.opaqueWithoutRole)
    + (result.counts.translucent - u.translucentWithoutRole);
  const accountedFor =
    judgeable
    + u.opaqueWithoutRole + u.translucentWithoutRole
    + u.notAColor + u.contextDependent + u.fullyTransparent + u.unparseableComputed;

  /**
   * 🔴 Ο ΑΥΣΤΗΡΟΣ ΕΛΕΓΧΟΣ: δεν αρκεί να **αθροίζονται** οι κατηγορίες — πρέπει κάθε
   * δήλωση που χαρακτηρίστηκε κρίσιμη να έχει **όντως** παραχθεί εύρημα.
   *
   * ⚠️ Ο λόγος είναι μετρημένος: η αθροιστική εκδοχή έδινε `balanced: true` ενώ **9 από
   * τις 12** ημιδιαφανείς δεν κρίνονταν (είχαν ρόλο `surface`, και η πρώτη
   * `evaluateTranslucent` δεχόταν μόνο foreground/border). Ένα άθροισμα που κλείνει
   * χωρίς να ρωτά «ποιος κρίθηκε» είναι λογιστική που επικυρώνει τον εαυτό της.
   */
  const missing = result.judgeableUnjudgedIds || [];
  return {
    balanced: accountedFor === result.counts.declarations && missing.length === 0,
    sumBalanced: accountedFor === result.counts.declarations,
    everyJudgeableJudged: missing.length === 0,
    unjudgedJudgeable: missing,
    expected: result.counts.declarations,
    actual: accountedFor,
    breakdown: { judgeable, judged: result.counts.judgedDeclarations, ...u },
  };
}

module.exports = {
  evaluateRuntimeMatrix,
  auditCoverage,
  buildRuntimePalette,
  buildRuntimeThemes,
  findDanglingVars,
  findAstDivergence,
  evaluateTranslucent,
  assertSnapshotUsable,
  describeValue,
  classifyValue,
  RUNTIME_RATCHETED_STATES,
  ALL_RATCHETED_STATES,
  RUNTIME_SOURCE,
};
