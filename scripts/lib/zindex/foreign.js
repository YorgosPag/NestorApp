/**
 * ΤΟ ΣΥΝΟΡΟ ΤΩΝ ΤΡΙΤΩΝ — το **δεύτερο κατάστιχο** του CHECK 3.50 (ADR-780 Φάση Β).
 *
 * ΤΟ ΕΡΩΤΗΜΑ: «επιτρέπεται σε ξένο κώδικα να ξεπεράσει την κλίμακά μας;»
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΗΝ ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ (μετρημένο, όχι φιλόδοξο)
 * ───────────────────────────────────────────────────────────────────────────────
 * Η βιομηχανία **τεκμηριώνει** τους τρίτους· δεν τους **μετράει**:
 *   • Material UI: `theme.zIndex` για override ανά component — και η ίδια η τεκμηρίωση
 *     αποθαρρύνει την αλλαγή μεμονωμένης τιμής («if you change one, you likely need to
 *     change them all»). Καμία εγγύηση ότι κάποιος θα θυμηθεί το επόμενο πακέτο.
 *   • «Systems for z-index» (CSS-Tricks), το κανονικό κείμενο του χώρου: αν έχεις τρίτο
 *     που δεν αλλάζει, «**plug that into the map**» — δηλαδή **χειρόγραφη καταχώριση**
 *     που κανείς δεν επαληθεύει.
 *   • Το `isolation: isolate` προτείνεται ευρέως ως ο καθαρός φράχτης — αλλά ως **οδηγία
 *     σε άρθρο**, όχι ως έλεγχος.
 * Και οι τρεις έχουν το ίδιο ελάττωμα: είναι **ανάθεση σε άνθρωπο**. Στο ίδιο αποθετήριο
 * αυτό το σχήμα έχει ήδη αποτύχει μετρημένα — δύο χειρόγραφες λίστες namespace που είχαν
 * **αποκλίνει κατά 63** (CHECK 3.34) και ένας συγκεντρωτής CI που άκουγε **18** ενώ το
 * δέντρο είχε **26** (CHECK 3.37).
 *
 * Εδώ το μητρώο συγκρίνεται με **απογραφή του ίδιου του `node_modules`**:
 *   • νέο πακέτο με z-index ≥ κατώφλι          ⇒ ⛔ `foreign-undeclared`
 *   • `npm update` που ανεβάζει τον αριθμό      ⇒ ⛔ `foreign-drifted`
 *   • δήλωση για πακέτο που έφυγε               ⇒ ⛔ `foreign-orphan-declaration`
 *   • δηλωμένο δάμασμα που **δεν υπάρχει** στο CSS ⇒ ⛔ `foreign-unverified`
 *   • δηλωμένο «δεν φορτώνεται» που **φορτώθηκε**  ⇒ ⛔ `foreign-reachable`
 *   • δικός μας κανόνας που **νικά** το δάμασμα    ⇒ ⛔ `foreign-clamp-overridden`
 *
 * ⚠️ ΔΗΛΩΜΕΝΟ ΟΡΙΟ: η απογραφή ανοίγει τα **άμεσα runtime dependencies** του
 * `package.json` (και τα ένθετα `node_modules` τους). Ένα **έμμεσο** πακέτο που δεν το
 * φέρνει κανένα άμεσο δεν σαρώνεται. Πλήρης σάρωση όλου του `node_modules` μετρήθηκε
 * απαγορευτική· ο περιορισμός γράφεται εδώ ώστε το «0» να μη διαβαστεί ως «καθαρό».
 *
 * @module scripts/lib/zindex/foreign
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { GLOBAL_LAYER_FLOOR, PROJECT_ROOT } = require('./scale');

const REGISTRY_FILE = '.zindex-foreign.json';

/** Καθεμία **ρητή**. Δεν υπάρχει «άλλο» — δες `assertForeignClosed`. */
const FOREIGN_STATES = Object.freeze({
  CLAMPED: 'foreign-clamped',
  CONTAINED: 'foreign-contained',
  UNREACHABLE: 'foreign-unreachable',
  DEV_ONLY: 'foreign-dev-only',
  ACKNOWLEDGED: 'foreign-acknowledged',
  UNDECLARED: 'foreign-undeclared',
  DRIFTED: 'foreign-drifted',
  ORPHAN_DECLARATION: 'foreign-orphan-declaration',
  UNVERIFIED: 'foreign-unverified',
  REACHABLE: 'foreign-reachable',
  CLAMP_OVERRIDDEN: 'foreign-clamp-overridden',
});

/** Οι καταστάσεις που **μπλοκάρουν** χωρίς baseline. Το σύνορο δεν έχει ratchet. */
const FOREIGN_ZERO_TOLERANCE = Object.freeze([
  FOREIGN_STATES.UNDECLARED,
  FOREIGN_STATES.DRIFTED,
  FOREIGN_STATES.ORPHAN_DECLARATION,
  FOREIGN_STATES.UNVERIFIED,
  FOREIGN_STATES.REACHABLE,
  FOREIGN_STATES.CLAMP_OVERRIDDEN,
]);

const SCANNABLE = /\.(css|js|mjs|cjs)$/;
const MAX_WALK_DEPTH = 7;
const toPosix = (p) => p.split(path.sep).join('/');

// ---------------------------------------------------------------------------
// Η ΑΠΟΓΡΑΦΗ — τι δηλώνει το ίδιο το node_modules
// ---------------------------------------------------------------------------

/**
 * ⚠️ ΤΟ ΙΔΙΟ ΜΟΤΙΒΟ ΠΙΑΝΕΙ **ΚΑΙ** CSS **ΚΑΙ** JS. Δεν είναι χαλαρότητα: το `sonner`
 * γράφει `z-index: 999999999` σε `styles.css` **και** στο `dist/index.js` (τα στυλ του
 * εγχέονται ως `<style>` από JS), και το `@react-aria/overlays` το γράφει **μόνο** ως
 * `zIndex: 100000` σε αντικείμενο JS. Πύλη που διαβάζει μόνο `.css` θα έλεγε «καθαρό»
 * για το μισό οικοσύστημα — το ίδιο σφάλμα με τις τρεις διαλέκτους του πρώτου
 * καταστίχου, μια στάθμη πιο έξω.
 */
const FOREIGN_PATTERN = /z-?index\s*:\s*['"]?(\d{4,})/gi;

function walkPackage(dir, depth, onFile) {
  if (depth > MAX_WALK_DEPTH) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === '.bin') continue;
      walkPackage(full, depth + 1, onFile);
    } else if (SCANNABLE.test(entry.name)) {
      onFile(full);
    }
  }
}

/**
 * Ο πλήρης κατάλογος των πακέτων που δηλώνουν καθολική στρώση, με τη **μέγιστη** τιμή
 * τους και ένα αποδεικτικό αρχείο. Αυθεντία των πακέτων = το `package.json`, ποτέ
 * χειρόγραφη λίστα (μια λίστα εδώ θα ήταν ακριβώς ό,τι το μητρώο υπάρχει για να ελέγχει).
 */
function censusNodeModules(repoRoot = PROJECT_ROOT, floor = GLOBAL_LAYER_FLOOR) {
  const pkgJson = path.join(repoRoot, 'package.json');
  const deps = Object.keys(JSON.parse(fs.readFileSync(pkgJson, 'utf8')).dependencies || {});
  const modulesRoot = path.join(repoRoot, 'node_modules');
  if (!fs.existsSync(modulesRoot)) {
    throw new Error(
      'CHECK 3.50 / σύνορο: δεν υπάρχει node_modules — η απογραφή δεν μπορεί να τρέξει και '
      + 'μια πύλη που δεν βρήκε την αυθεντία της δεν επιτρέπεται να απαντήσει «καθαρό».',
    );
  }

  const census = new Map();
  for (const dep of deps) {
    const dir = path.join(modulesRoot, ...dep.split('/'));
    if (!fs.existsSync(dir)) continue;
    walkPackage(dir, 0, (full) => {
      let text;
      try {
        text = fs.readFileSync(full, 'utf8');
      } catch {
        return;
      }
      FOREIGN_PATTERN.lastIndex = 0;
      let m;
      while ((m = FOREIGN_PATTERN.exec(text)) !== null) {
        const value = Number(m[1]);
        if (value < floor) continue;
        const prev = census.get(dep);
        if (!prev || value > prev.max) {
          census.set(dep, { pkg: dep, max: value, evidenceFile: toPosix(path.relative(repoRoot, full)) });
        }
      }
    });
  }
  return census;
}

// ---------------------------------------------------------------------------
// ΤΟ ΣΥΝΟΡΟ ΜΑΣ — τι κάνουμε γι' αυτό, διαβασμένο από το ΙΔΙΟ το CSS
// ---------------------------------------------------------------------------

/** Απογυμνωμένοι κανόνες `{ selector, decls }` — αρκετά για να απαντηθεί «υπάρχει;». */
function parseRules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const selector = m[1].trim().replace(/\s+/g, ' ');
    if (!selector || selector.startsWith('@')) continue;
    rules.push({ selector, body: m[2] });
  }
  return rules;
}

const hasIsolation = (body) => /(^|;)\s*isolation\s*:\s*isolate\b/.test(body);
const zIndexOf = (body) => {
  const m = body.match(/(^|;)\s*z-index\s*:\s*([^;]+)/);
  return m ? m[2].trim() : null;
};

/** Οι δηλώσεις του συνόρου: `{ selector → { role, important, isolated } }`. */
function readBoundary(repoRoot, boundaryFile) {
  const full = path.join(repoRoot, boundaryFile);
  if (!fs.existsSync(full)) {
    throw new Error(`CHECK 3.50 / σύνορο: λείπει το ${boundaryFile} — το μητρώο δείχνει στο κενό`);
  }
  const map = new Map();
  for (const rule of parseRules(fs.readFileSync(full, 'utf8'))) {
    const z = zIndexOf(rule.body);
    const entry = map.get(rule.selector) || { role: null, important: false, isolated: false };
    if (z) {
      const varMatch = z.match(/var\(\s*--z-index-([a-z0-9-]+)/i);
      entry.role = varMatch ? varMatch[1] : `ΩΜΟ:${z}`;
      entry.important = /!\s*important/i.test(z);
    }
    if (hasIsolation(rule.body)) entry.isolated = true;
    map.set(rule.selector, entry);
  }
  return map;
}

/**
 * Δικοί μας κανόνες **εκτός** συνόρου που δηλώνουν `z-index !important` πάνω σε
 * δηλωμένο ξένο επιλογέα.
 *
 * 🔑 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το σύνορο εισάγεται **πρώτο**, και το Tailwind 3.4 **δεν** εκπέμπει
 * εγγενή cascade layers· άρα κρίνει ειδικότητα → σειρά πηγής. Ακριβώς αυτό συνέβαινε
 * πριν το ADR-780 Φάση Β: ο περιορισμός του `sonner` ζούσε στον **πιο ειδικό**
 * `[data-sonner-toaster][data-position="top-right"]`, οπότε η στρώση εξαρτιόταν από τη
 * **θέση** του toaster. Χωρίς αυτόν τον έλεγχο, η επόμενη τέτοια δήλωση θα ήταν πάλι
 * αόρατη — και το σύνορο θα ήταν πράσινο πάνω στην παράκαμψή του.
 */
function findCompetingRules(repoRoot, boundaryFile, selectorTokens, listCssFiles) {
  const competing = [];
  for (const file of listCssFiles(repoRoot)) {
    if (file === boundaryFile) continue;
    const full = path.join(repoRoot, file);
    if (!fs.existsSync(full)) continue;
    const css = fs.readFileSync(full, 'utf8');
    if (!selectorTokens.some((tok) => css.includes(tok))) continue;
    for (const rule of parseRules(css)) {
      const z = zIndexOf(rule.body);
      if (!z || !/!\s*important/i.test(z)) continue;
      const hit = selectorTokens.find((tok) => rule.selector.includes(tok));
      if (hit) competing.push({ file, selector: rule.selector, value: z, token: hit });
    }
  }
  return competing;
}

// ---------------------------------------------------------------------------
// Η ΚΡΙΣΗ
// ---------------------------------------------------------------------------

function readRegistry(repoRoot = PROJECT_ROOT) {
  const full = path.join(repoRoot, REGISTRY_FILE);
  if (!fs.existsSync(full)) {
    throw new Error(`CHECK 3.50 / σύνορο: λείπει το ${REGISTRY_FILE} — καμία δήλωση, καμία κρίση`);
  }
  const json = JSON.parse(fs.readFileSync(full, 'utf8'));
  if (!json.packages || typeof json.packages !== 'object') {
    throw new Error(`${REGISTRY_FILE}: λείπει η ρίζα "packages"`);
  }
  return json;
}

/** Κάθε `measure` απαιτεί **λόγο** — πρότυπο CHECK 3.35: δεν αρκεί να δηλώσεις, πρέπει να πεις γιατί. */
function assertMeasureShape(pkg, measure) {
  if (!measure.why || String(measure.why).trim().length < 12) {
    throw new Error(`${REGISTRY_FILE} ▸ ${pkg}: μέτρο "${measure.kind}" χωρίς λόγο ("why")`);
  }
}

/**
 * Κρίνει **ένα** μέτρο. Επιστρέφει `{ state, detail, effectiveRole }`.
 * Καμία διαδρομή δεν επιστρέφει `undefined`· άγνωστο `kind` ⇒ `throw` με όνομα.
 */
function judgeMeasure(pkg, measure, ctx) {
  assertMeasureShape(pkg, measure);
  const { boundary, srcSymbols, roleByName } = ctx;

  if (measure.kind === 'clamp') {
    const rule = boundary.get(measure.selector);
    if (!rule || !rule.role) {
      return {
        state: FOREIGN_STATES.UNVERIFIED,
        detail: `δηλώνει clamp στο "${measure.selector}" — καμία δήλωση z-index στο σύνορο`,
      };
    }
    if (rule.role !== measure.role) {
      return {
        state: FOREIGN_STATES.UNVERIFIED,
        detail: `δηλώνει ρόλο "${measure.role}" — το σύνορο γράφει "${rule.role}"`,
      };
    }
    if (!roleByName.has(measure.role)) {
      return {
        state: FOREIGN_STATES.UNVERIFIED,
        detail: `ο ρόλος "${measure.role}" δεν υπάρχει στην κλίμακα`,
      };
    }
    if (!rule.important) {
      return {
        state: FOREIGN_STATES.UNVERIFIED,
        detail: `το clamp στο "${measure.selector}" δεν είναι !important — ο τρίτος το νικά`,
      };
    }
    return {
      state: FOREIGN_STATES.CLAMPED,
      detail: `${measure.selector} → --z-index-${measure.role} (${roleByName.get(measure.role)})`,
      effectiveRole: measure.role,
    };
  }

  if (measure.kind === 'contain') {
    const rule = boundary.get(measure.selector);
    if (!rule || !rule.isolated) {
      return {
        state: FOREIGN_STATES.UNVERIFIED,
        detail: `δηλώνει περιορισμό στο "${measure.selector}" — κανένα isolation:isolate στο σύνορο`,
      };
    }
    return { state: FOREIGN_STATES.CONTAINED, detail: `${measure.selector} { isolation: isolate }` };
  }

  if (measure.kind === 'unreachable') {
    const present = measure.evidence.filter((symbol) => srcSymbols.has(symbol));
    if (present.length) {
      return {
        state: FOREIGN_STATES.REACHABLE,
        detail: `δηλώθηκε ανενεργό, αλλά το src/ περιέχει: ${present.join(', ')}`,
      };
    }
    return { state: FOREIGN_STATES.UNREACHABLE, detail: `κανένα από: ${measure.evidence.join(', ')}` };
  }

  if (measure.kind === 'dev-only') {
    return { state: FOREIGN_STATES.DEV_ONLY, detail: measure.why };
  }

  if (measure.kind === 'acknowledge') {
    const band = roleByName.get(measure.withinRole);
    if (band === undefined) {
      return {
        state: FOREIGN_STATES.UNVERIFIED,
        detail: `ο ρόλος-ζώνη "${measure.withinRole}" δεν υπάρχει στην κλίμακα`,
      };
    }
    if (ctx.observedMax > band) {
      return {
        state: FOREIGN_STATES.UNVERIFIED,
        detail: `${ctx.observedMax} ξεπερνά τη δηλωμένη ζώνη "${measure.withinRole}" (${band})`,
      };
    }
    return {
      state: FOREIGN_STATES.ACKNOWLEDGED,
      detail: `${ctx.observedMax} ≤ ${measure.withinRole} (${band})`,
      effectiveRole: measure.withinRole,
    };
  }

  throw new Error(`${REGISTRY_FILE} ▸ ${pkg}: άγνωστο μέτρο "${measure.kind}"`);
}

/** Η **αυστηρότερη** ετυμηγορία ενός πακέτου κερδίζει — ποτέ «η πρώτη που ταιριάζει». */
function collapse(results) {
  const blocking = results.find((r) => FOREIGN_ZERO_TOLERANCE.includes(r.state));
  return blocking || results[0];
}

/**
 * @param {object} options
 * @param {boolean} options.withCensus Να ανοιχτεί το `node_modules` (~6s);
 *
 * ⚠️ ΤΟ `withCensus:false` ΔΕΝ ΕΙΝΑΙ «ΓΡΗΓΟΡΗ ΕΚΔΟΧΗ» — ΕΙΝΑΙ **ΛΙΓΟΤΕΡΕΣ ΕΡΩΤΗΣΕΙΣ**.
 * Χωρίς απογραφή, οι τρεις καταστάσεις που τη χρειάζονται (`undeclared`, `drifted`,
 * `orphan-declaration`) **δεν μπορούν να τεθούν**, και ο καλών είναι υποχρεωμένος να το
 * **τυπώσει**: ένα «0 παραβιάσεις» που σημαίνει «δεν κοίταξα» είναι το σχήμα που όλο το
 * ADR-749/ADR-780 υπάρχει για να κυνηγά. Οι υπόλοιπες κρίσεις (δάμασμα υπάρχει στο CSS;
 * η ξένη διαδρομή είναι ανενεργή;) είναι φθηνές και τρέχουν **πάντα**.
 */
function evaluateForeign(repoRoot, roles, deps, options = {}) {
  const withCensus = options.withCensus !== false;
  const { listCssFiles, findSymbolsInSrc } = deps;
  const registry = readRegistry(repoRoot);
  const boundaryFile = registry.boundaryStylesheet;
  const boundary = readBoundary(repoRoot, boundaryFile);
  // Το κλειδί βγαίνει από το **ίδιο** το `cssVar` της κλίμακας, όχι από δεύτερη
  // υλοποίηση του kebab-case: μια δεύτερη γραμματική εδώ θα ήταν το σχήμα ADR-749.
  const roleByName = new Map(roles.map((r) => [r.cssVar.replace('--z-index-', ''), r.value]));
  const census = withCensus
    ? censusNodeModules(repoRoot, registry.floor ?? GLOBAL_LAYER_FLOOR)
    : new Map(Object.entries(registry.packages).map(
      ([pkg, e]) => [pkg, { pkg, max: e.observedMax, evidenceFile: '(χωρίς απογραφή)' }],
    ));

  const evidence = [];
  for (const entry of Object.values(registry.packages)) {
    for (const measure of entry.measures || []) if (measure.evidence) evidence.push(...measure.evidence);
  }
  const srcSymbols = findSymbolsInSrc(repoRoot, [...new Set(evidence)]);

  const findings = [];
  const declared = new Set(Object.keys(registry.packages));

  for (const [pkg, hit] of census) {
    const entry = registry.packages[pkg];
    if (!entry) {
      findings.push({
        pkg,
        observed: hit.max,
        state: FOREIGN_STATES.UNDECLARED,
        detail: `z-index ${hit.max} στο ${hit.evidenceFile} — καμία δήλωση στο ${REGISTRY_FILE}`,
      });
      continue;
    }
    declared.delete(pkg);
    if (entry.observedMax !== hit.max) {
      findings.push({
        pkg,
        observed: hit.max,
        state: FOREIGN_STATES.DRIFTED,
        detail: `το μητρώο λέει ${entry.observedMax}, το node_modules λέει ${hit.max} (${hit.evidenceFile})`,
      });
      continue;
    }
    const ctx = { boundary, srcSymbols, roleByName, observedMax: hit.max };
    const results = entry.measures.map((measure) => judgeMeasure(pkg, measure, ctx));
    const verdict = collapse(results);
    findings.push({ pkg, observed: hit.max, state: verdict.state, detail: verdict.detail });
  }

  for (const pkg of declared) {
    findings.push({
      pkg,
      observed: registry.packages[pkg].observedMax,
      state: FOREIGN_STATES.ORPHAN_DECLARATION,
      detail: 'δηλωμένο στο μητρώο αλλά η απογραφή δεν το βρίσκει — δήλωση που σαπίζει',
    });
  }

  // ⚠️ ΜΟΝΟ τα μέτρα `clamp`. Ένα δικό μας `z-index` πάνω στη ρίζα ενός **περιορισμένου**
  // πακέτου είναι απολύτως νόμιμο — αποφασίζει πού ζωγραφίζεται η ΔΙΚΗ ΜΑΣ επιφάνεια, όχι
  // τι κάνει η βιβλιοθήκη μέσα της, και το `isolation` δεν το αφορά. Η πρώτη γραφή τα
  // μάζευε όλα και κατήγγειλε το υπαρκτό `.rmg-gantt-chart { z-index: 20 !important }` του
  // `globals.css` (μετρημένο 2026-08-09) — φρουρός που πυροδοτεί σε σωστό κώδικα είναι
  // θόρυβος, και ο θόρυβος είναι ο δρόμος προς το `SKIP_`.
  const tokens = [];
  for (const entry of Object.values(registry.packages)) {
    for (const measure of entry.measures || []) {
      if (measure.kind === 'clamp' && measure.selector) tokens.push(measure.selector);
    }
  }
  for (const c of findCompetingRules(repoRoot, boundaryFile, tokens, listCssFiles)) {
    findings.push({
      pkg: c.token,
      observed: 0,
      state: FOREIGN_STATES.CLAMP_OVERRIDDEN,
      detail: `${c.file} → "${c.selector}" { z-index: ${c.value} } νικά το σύνορο`,
    });
  }

  findings.sort((a, b) => a.pkg.localeCompare(b.pkg));
  return { findings, census: assertForeignClosed(findings), registry, censusRan: withCensus };
}

/** ⛔ ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ, FAIL-CLOSED — άγνωστη κατάσταση ⇒ `throw` **με όνομα**. */
function assertForeignClosed(findings) {
  const known = new Set(Object.values(FOREIGN_STATES));
  const census = {};
  for (const state of known) census[state] = 0;
  for (const f of findings) {
    if (!known.has(f.state)) {
      throw new Error(`CHECK 3.50 / σύνορο: άγνωστη κατάσταση "${f.state}" για το ${f.pkg}`);
    }
    census[f.state] += 1;
  }
  const total = Object.values(census).reduce((a, b) => a + b, 0);
  if (total !== findings.length) {
    throw new Error(`CHECK 3.50 / σύνορο: η λογιστική δεν κλείνει — ${total} ≠ ${findings.length}`);
  }
  return census;
}

module.exports = {
  REGISTRY_FILE,
  FOREIGN_STATES,
  FOREIGN_ZERO_TOLERANCE,
  FOREIGN_PATTERN,
  censusNodeModules,
  parseRules,
  readBoundary,
  readRegistry,
  findCompetingRules,
  judgeMeasure,
  evaluateForeign,
  assertForeignClosed,
};
