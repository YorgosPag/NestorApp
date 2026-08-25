/**
 * ΡΙΖΕΣ-ΟΡΓΑΝΑ — «ποιο σύμβολο του `src/` το κρατά ζωντανό ένα ΕΡΓΑΛΕΙΟ, όχι η εφαρμογή;»
 * (ADR-806 · CHECK 3.30)
 *
 * 🔴 ΤΟ ΠΡΟΒΛΗΜΑ, ΜΕΤΡΗΜΕΝΟ ΠΡΙΝ ΓΡΑΦΤΕΙ ΓΡΑΜΜΗ: το `isEntryFile` ορίζει ρίζες
 * ΑΠΟΚΛΕΙΣΤΙΚΑ μέσα στο `src/` (Next pages · API routes · middleware · workers). Άρα
 * σύμβολο που το καταναλώνει ΜΟΝΟ script είναι **δομικά αδύνατο** να φανεί ζωντανό.
 * Μετρημένο: **13** σύμβολα του viewer ζητούνται από `scripts/`, και **5 ήταν ήδη
 * θαμμένα στη `.barrel-deadcode-baseline.json` ως «νεκρά»** — `SYSTEM_MATERIALS_SEED`
 * (`npm run seed:bim-materials`) · `SYSTEM_BLOCK_PROVENANCE` (`seed:block-library`) ·
 * `TEXTURE_RESOLUTION`·`TEXTURE_PROVIDER`·`isOwnScanTexture` (`download-bim-textures`).
 * *Η baseline δεν ήταν ανεκτό χρέος — ήταν **ψέμα**, και η εκστρατεία καθαρισμού που
 * θα την εμπιστευόταν θα έσπαγε τρία npm scripts.*
 *
 * 🔑 ΔΕΝ ΕΙΝΑΙ ΕΞΑΙΡΕΣΗ — ΕΙΝΑΙ ΔΙΟΡΘΩΣΗ ΤΟΥ ΠΑΡΟΝΟΜΑΣΤΗ. Μια εξαίρεση λέει «είναι
 * νεκρό αλλά το ανεχόμαστε»· εδώ το σύμβολο **δεν είναι νεκρό**. Η δήλωση δεν σβήνει
 * ετυμηγορία, **προσθέτει ρίζα** — και μετά η ετυμηγορία βγαίνει σωστή μόνη της.
 *
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ (ερευνήθηκε 2026-08-25):
 *   • **Chromium** — σύμβαση `…ForTesting()` με presubmit έλεγχο ονόματος. Το όνομα
 *     επιβιώνει **για πάντα** αφού διαγραφεί το test· κανείς δεν ρωτά αν ο καταναλωτής
 *     υπάρχει ακόμη.
 *   • **Angular** — πρόθεμα `ɵ` («public στο bundle, private στο συμβόλαιο»). Ίδιο κενό.
 *   • **TypeScript** — `/** @internal *​/` + `--stripInternal`. Ίδιο κενό.
 *   • **knip / ts-prune** — `ignore` · `// ts-prune-ignore-next`: **σιωπηλό mute**, χωρίς
 *     λόγο, χωρίς απόδειξη καταναλωτή, χωρίς ανίχνευση ορφανού.
 *   Και τα τέσσερα απαντούν «μην το μετράς». **ΚΑΝΕΝΑ δεν αποδεικνύει ότι ο ισχυριζόμενος
 *   καταναλωτής (α) υπάρχει, (β) όντως το ζητά, (γ) εκτελείται από κάποιον.** Εδώ και τα
 *   τρία είναι ⛔ καταστάσεις.
 *
 * ⚠️ ΤΟ (γ) ΕΧΕΙ ΠΛΗΘΥΣΜΟ, ΔΕΝ ΕΙΝΑΙ ΘΕΩΡΙΑ: το `download-bim-textures.ts` **δεν
 * αναφέρεται σε κανένα npm script, σε κανένα workflow, σε κανένα άλλο script** — κρατά
 * τρία σύμβολα ζωντανά και δεν το τρέχει κανείς. Γι' αυτό υπάρχει η ρητή κατάσταση
 * `root-manual`: *εργαλείο συντήρησης είναι νόμιμο, αλλά ΟΝΟΜΑΖΕΤΑΙ*.
 */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { resolveSpecifier, readTsPathAliases, toPosix } = require('./resolve-specifier');

const DECLARATIONS = '.instrument-roots.json';
const MIN_REASON = 40;

/**
 * ⚠️ ΔΥΟ ΑΝΕΞΑΡΤΗΤΕΣ ΑΣΘΕΝΕΙΕΣ, ΠΟΤΕ ΕΝΑ ΟΝΟΜΑ (μάθημα CHECK 3.41).
 * Η πρώτη γραφή είχε ΕΝΑ `inert-root` και για τις δύο — και μια μετάλλαξη που έσβηνε
 * τον έναν έλεγχο έβγαινε **ΠΡΑΣΙΝΗ**, γιατί το άλλο μονοπάτι έγραφε την ίδια κατάσταση.
 * Έχουν ΔΙΑΦΟΡΕΤΙΚΗ θεραπεία: `inert` ⇒ σβήσε τη γραμμή· `unrun` ⇒ σύνδεσέ το ή δήλωσε
 * `manual`. Ένα όνομα θα έλεγε στον άνθρωπο λάθος πράγμα στις μισές περιπτώσεις.
 */
const STATES = {
  ORPHAN: 'orphan-root',
  REASONLESS: 'reasonless-root',
  INERT: 'inert-root',
  UNRUN: 'unrun-root',
  UNREADABLE: 'unreadable-root',
  UNPROVABLE: 'unprovable-claim',
  WIRED: 'root-wired',
  MANUAL: 'root-manual',
};
const BLOCKING = [STATES.ORPHAN, STATES.REASONLESS, STATES.INERT, STATES.UNRUN,
  STATES.UNREADABLE, STATES.UNPROVABLE];

/**
 * Τα σύμβολα που ΟΡΙΖΕΙ ένα module — για να επαληθευτεί ένας ρητός ισχυρισμός `provides`.
 * ⚠️ parse-only (`ts.createSourceFile`), ΠΟΤΕ `ts.Program` (N.17).
 */
function exportedNames(abs) {
  const src = fs.readFileSync(abs, 'utf8');
  const sf = ts.createSourceFile(abs, src, ts.ScriptTarget.Latest, true);
  const names = new Set();
  ts.forEachChild(sf, (n) => {
    const exported = n.modifiers && n.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (exported && ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name)) names.add(d.name.text);
    } else if (exported && n.name && ts.isIdentifier(n.name)) {
      names.add(n.name.text);
    } else if (ts.isExportDeclaration(n) && n.exportClause && ts.isNamedExports(n.exportClause)) {
      for (const e of n.exportClause.elements) names.add(e.name.text);
    }
  });
  return names;
}

/** Κάθε script που ονομάζεται από `package.json` ή από workflow — και ό,τι ΕΚΕΙΝΑ καλούν. */
function wiredScripts(projectRoot) {
  const seeds = new Set();
  const addFrom = (text) => {
    for (const m of text.matchAll(/scripts\/[A-Za-z0-9_\-./]+\.(?:js|mjs|cjs|ts)/g)) seeds.add(m[0]);
  };
  try { addFrom(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')); } catch { /* ignore */ }
  const wfDir = path.join(projectRoot, '.github', 'workflows');
  if (fs.existsSync(wfDir)) {
    for (const f of fs.readdirSync(wfDir)) {
      if (!/\.ya?ml$/.test(f)) continue;
      try { addFrom(fs.readFileSync(path.join(wfDir, f), 'utf8')); } catch { /* ignore */ }
    }
  }
  // Κλείσιμο: ένα ονομασμένο script μπορεί να καλεί άλλο (π.χ. `run-*.js` → `lib/*-setup.js`).
  // ⚠️ Χωρίς αυτό το βήμα το `census-setup.js` θα έβγαινε «μη συνδεδεμένο» ενώ το τρέχει
  // το `text-measure:census` μέσω του `run-text-measure-census.js` — δηλαδή η πύλη θα
  // ζητούσε ψεύτικη δήλωση `manual` για όργανο που ΟΝΤΩΣ εκτελεί το npm.
  const seen = new Set();
  const queue = [...seeds];
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    let text;
    try { text = fs.readFileSync(path.join(projectRoot, rel), 'utf8'); } catch { continue; }
    const found = new Set();
    for (const m of text.matchAll(/scripts\/[A-Za-z0-9_\-./]+\.(?:js|mjs|cjs|ts)/g)) found.add(m[0]);
    const dir = path.posix.dirname(rel);
    for (const m of text.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)|from\s+['"](\.[^'"]+)['"]/g)) {
      const spec = m[1] || m[2];
      for (const ext of ['', '.js', '.mjs', '.cjs', '.ts', '/index.js']) {
        const cand = toPosix(path.posix.normalize(path.posix.join(dir, spec + ext)));
        if (cand.startsWith('scripts/') && fs.existsSync(path.join(projectRoot, cand))) { found.add(cand); break; }
      }
    }
    for (const f of found) if (!seen.has(f)) queue.push(f);
  }
  return seen;
}

/** Οι εισαγωγές ενός οργάνου που δείχνουν μέσα στο `src/`, ΠΡΟ-ΛΥΜΕΝΕΣ. */
function importsIntoSrc(projectRoot, rel, ctx) {
  const abs = path.join(projectRoot, rel);
  const src = fs.readFileSync(abs, 'utf8');
  const out = [];
  const push = (spec, names, kind) => {
    let r;
    try { r = resolveSpecifier(spec, abs, ctx); } catch { r = null; }
    if (!r || !r.file) return;
    const target = toPosix(path.relative(projectRoot, r.file));
    if (!target.startsWith('src/')) return;
    out.push({ from: rel, targetFile: target, names, kind });
  };

  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true);
  ts.forEachChild(sf, (n) => {
    if (!ts.isImportDeclaration(n) || !ts.isStringLiteral(n.moduleSpecifier)) return;
    const spec = n.moduleSpecifier.text;
    const nb = n.importClause && n.importClause.namedBindings;
    if (nb && ts.isNamedImports(nb)) push(spec, nb.elements.map((e) => (e.propertyName ? e.propertyName.text : e.name.text)), 'named');
    else if (nb && ts.isNamespaceImport(nb)) push(spec, [], 'namespace');
    else if (n.importClause && n.importClause.name) push(spec, ['default'], 'named');
    else push(spec, [], 'side-effect');
  });

  // CommonJS — τα όργανα είναι συχνά `.js`
  for (const m of src.matchAll(/(?:const|let|var)\s*(\{[^}]*\}|[A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const names = m[1].startsWith('{')
      ? m[1].slice(1, -1).split(',').map((s) => s.split(':')[0].trim()).filter(Boolean)
      : [];
    push(m[2], names, names.length ? 'named' : 'namespace');
  }
  return out;
}

/**
 * Διαβάζει τις δηλώσεις και επιστρέφει ΚΛΕΙΣΤΗ λογιστική + τις προ-λυμένες ρίζες.
 * ⚠️ Απουσία αρχείου δηλώσεων ⇒ μηδέν ρίζες, ΠΟΤΕ σφάλμα: η πύλη πρέπει να τρέχει
 * και σε δέντρο που δεν έχει ακόμη δηλώσει τίποτα.
 */
function loadInstrumentRoots({ projectRoot }) {
  const file = path.join(projectRoot, DECLARATIONS);
  const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, 0]));
  const findings = [];
  const externalRoots = [];
  if (!fs.existsSync(file)) return { externalRoots, findings, tally, declared: 0, blocking: [] };

  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const roots = Array.isArray(raw.roots) ? raw.roots : [];
  const aliases = readTsPathAliases(projectRoot);
  // ⚠️ Ο `resolveSpecifier` ΑΠΑΙΤΕΙ `fileSet` (κάνει `fileSet.has(...)`): χωρίς αυτό σκάει
  // με «Cannot read properties of undefined». Το χτίζουμε από το ΙΔΙΟ `collectSourceFiles`
  // που τροφοδοτεί τον γράφο, ώστε «λύνεται» εδώ και «υπάρχει στον γράφο» να σημαίνουν
  // το ίδιο πράγμα — αλλιώς η ρίζα θα έδειχνε σε module που η πύλη δεν εξετάζει.
  const { collectSourceFiles } = require('./scan-config');
  const fileSet = new Set(collectSourceFiles(projectRoot, ['src']).map(toPosix));
  const ctx = { projectRoot, aliases, fileSet };
  const wired = wiredScripts(projectRoot);

  for (const entry of roots) {
    const rel = toPosix(String(entry.file || ''));
    const reason = String(entry.reason || '');
    const record = (state, detail) => { tally[state]++; findings.push({ state, file: rel, detail }); };

    if (!rel || !fs.existsSync(path.join(projectRoot, rel))) {
      record(STATES.ORPHAN, `δηλωμένο όργανο που ΔΕΝ ΥΠΑΡΧΕΙ — σβήσε τη γραμμή: ${rel || '(κενό)'}`);
      continue;
    }
    if (reason.trim().length < MIN_REASON) {
      record(STATES.REASONLESS, `λόγος ${reason.trim().length}/${MIN_REASON} χαρακτήρες — γράψε ΓΙΑΤΙ το `
        + 'σύμβολο ζει εκτός εφαρμογής');
      continue;
    }
    let imports;
    try { imports = importsIntoSrc(projectRoot, rel, ctx); }
    catch (e) { record(STATES.UNREADABLE, `δεν διαβάζεται: ${e.message}`); continue; }

    // 🔑 ΡΗΤΟΣ ΙΣΧΥΡΙΣΜΟΣ για ΥΠΟΛΟΓΙΣΜΕΝΟ μονοπάτι — και ΕΠΑΛΗΘΕΥΕΤΑΙ.
    // Το `census-setup.js` κάνει `require(path.join(REPO_ROOT, …))`: δομικά αόρατο σε ΚΑΘΕ
    // στατικό resolver (και του knip). Εκεί το όργανο ΔΗΛΩΝΕΙ τι φτάνει — αλλά ο ισχυρισμός
    // δεν γίνεται δεκτός: το module πρέπει να ΥΠΑΡΧΕΙ και να ΕΞΑΓΕΙ το σύμβολο, αλλιώς ⛔.
    // *Αυτό ακριβώς λείπει από το `ForTesting` του Chromium και το `@internal` της TS: εκεί
    // ο ισχυρισμός δεν ελέγχεται ποτέ, άρα επιβιώνει αφού πεθάνει ο καταναλωτής.*
    let claimBroken = false;
    for (const claim of entry.provides || []) {
      const mrel = toPosix(String(claim.module || ''));
      const mabs = path.join(projectRoot, mrel);
      if (!mrel.startsWith('src/') || !fs.existsSync(mabs)) {
        record(STATES.UNPROVABLE, `ισχυρίζεται ότι φτάνει «${mrel}», που ΔΕΝ ΥΠΑΡΧΕΙ στο src/`);
        claimBroken = true; break;
      }
      let have;
      try { have = exportedNames(mabs); }
      catch (e) { record(STATES.UNPROVABLE, `το «${mrel}» δεν διαβάζεται: ${e.message}`); claimBroken = true; break; }
      const missing = (claim.symbols || []).filter((s) => !have.has(s));
      if (missing.length) {
        record(STATES.UNPROVABLE, `το «${mrel}» ΔΕΝ εξάγει: ${missing.join(', ')} — ο ισχυρισμός σάπισε`);
        claimBroken = true; break;
      }
      imports.push({ from: rel, targetFile: mrel, names: [...(claim.symbols || [])], kind: 'named' });
    }
    if (claimBroken) continue;

    if (imports.length === 0) {
      record(STATES.INERT, 'το δηλωμένο όργανο ΔΕΝ εισάγει τίποτα από το `src/` — η δήλωση '
        + 'δεν κρατά τίποτα ζωντανό (αδρανής φρουρός, ADR-749 §5)');
      continue;
    }
    externalRoots.push(...imports);
    if (entry.manual === true) {
      record(STATES.MANUAL, `εργαλείο ΧΕΙΡΟΚΙΝΗΤΟ — δεν το τρέχει npm/CI· κρατά ${imports.length} module(s)`);
    } else if (wired.has(rel)) {
      record(STATES.WIRED, `${imports.length} module(s) του src/`);
    } else {
      record(STATES.UNRUN, 'δεν αναφέρεται σε package.json / workflow / άλλο script, και ΔΕΝ είναι '
        + 'δηλωμένο `"manual": true` — όργανο που δεν το τρέχει κανείς δεν είναι λόγος ζωής');
    }
  }

  const sum = Object.values(tally).reduce((a, b) => a + b, 0);
  if (sum !== roots.length) throw new Error(`ΣΠΑΣΜΕΝΗ ΛΟΓΙΣΤΙΚΗ ριζών-οργάνων: ${sum} ≠ ${roots.length}`);
  return {
    externalRoots, findings, tally, declared: roots.length,
    blocking: findings.filter((f) => BLOCKING.includes(f.state)),
  };
}

module.exports = { loadInstrumentRoots, wiredScripts, importsIntoSrc, STATES, BLOCKING, DECLARATIONS, MIN_REASON };
