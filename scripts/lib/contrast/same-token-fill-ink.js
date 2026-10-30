/**
 * ADR-770 — **γέμισμα και μελάνι από το ΙΔΙΟ token κατάστασης** (`bg-X` + `text-X`, χωρίς διαφάνεια).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ΤΟ ΜΕΤΡΗΜΕΝΟ ΓΕΓΟΝΟΣ
 * ═══════════════════════════════════════════════════════════════════════════════
 * Στον browser (PO-0001, 2026-10-27) η ετικέτα «Πρόχειρο» είχε `color` = `background-color` =
 * `rgb(36,99,235)` ⇒ **1,00:1**, κείμενο ανύπαρκτο. Αιτία: `getStatusColor(x,'bg')` + `getStatusColor(x,'text')`
 * δίνουν **την ίδια** `--status-*` ως γέμισμα και ως μελάνι. Ως τις 2026-10-10 οι κλάσεις `bg-[hsl(var(--status-*))]`
 * δεν παράγονταν (παρεμβολή στο `design-system.ts`) ⇒ το λάθος ήταν **κρυμμένο** κάτω από διαφανές φόντο· η
 * διόρθωση εκείνης της μέρας το έκανε ορατό σε ~12 σημεία ταυτόχρονα.
 *
 * 🔑 **ΓΙΑΤΙ ΜΗΔΕΝΙΚΗ ΑΝΟΧΗ, ΧΩΡΙΣ BASELINE.** Ένα χρώμα πάνω στον εαυτό του είναι 1,00:1 σε **κάθε** θέμα και
 * **κάθε** επιφάνεια — δεν υπάρχει νόμιμη περίπτωση, δεν χρειάζεται καν μέτρηση. Ίδια κατηγορία με το
 * `glued-class.js`. Το δέντρο είναι στο **0** από 2026-10-29 — εκτός από **1** ρητά δηλωμένο (`DECLARED_OPEN_SITES`).
 *
 * ⚠️ **ΚΑΙ ΜΕ ΔΙΑΦΑΝΕΙΑ ΔΕΝ ΓΙΝΕΤΑΙ ΣΩΣΤΟ** — μετρημένο από το `globals.css` (2026-10-29): `--status-success` ως
 * μελάνι πάνω σε `--status-success/15` δίνει **1,80:1** (φωτεινό), `--status-purple` στο σκοτεινό **2,28:1**.
 * Το `/NN` εξαιρείται εδώ μόνο επειδή δεν είναι **αόρατο**· το σωστό ζεύγος είναι πάντα ρόλος:
 *   · συμπαγές  → `<Badge variant>` (γέμισμα `--status-*` + μελάνι `SOLID_FILL_INK`, ADR-854 §3)
 *   · απαλό     → `--bg-X` + `--text-X` (`colors.bg.X` + `colors.text.X`): 5,78–7,84:1 και στα δύο θέματα.
 * (Material 3 `container`/`on-container` · Atlassian Lozenge subtle/bold · Primer `StateLabel` — ποτέ το ίδιο token.)
 *
 * 🔑 **ΓΙΑΤΙ AST.** Το script ±200 χαρακτήρων της 2026-10-28 έβγαζε ψευδώς θετικά (γειτονικά στοιχεία). Η μονάδα
 * εδώ είναι **ένα** στοιχείο: ίδιο `className`, ίδιο `cn(...)`, ίδια συμβολοσειρά, ίδια ιδιότητα αντικειμένου,
 * ίδιο `return`. Τα `const` του αρχείου λύνονται (`const bg = getStatusColor(s,'bg')`). Επιπλέον: παιδί JSX με
 * `text-X` μέσα σε γονέα με συμπαγές `bg-X` (το μελάνι **κληρονομεί** την επιφάνεια του γονέα).
 *
 * ΤΙ ΚΡΙΝΕΤΑΙ ΚΑΙ ΤΙ ΟΧΙ:
 *   · `bg-[hsl(var(--status-X))]` αυτούσιο ΧΩΡΙΣ `/NN` + μελάνι X ⇒ ⛔ (1,00:1).
 *   · `${getStatusColor(x,'bg')}/NN` (συνθετική κλάση) + μελάνι X ⇒ ⛔. Το Tailwind σαρώνει ΚΕΙΜΕΝΟ: η συνθετική
 *     κλάση δεν υπάρχει αυτούσια πουθενά (μετρημένο 2026-10-29: καμία από τις 6 του `src/`) ⇒ δεν παράγεται ⇒ διάφανο
 *     φόντο, μελάνι `--status-*` πάνω στην κάρτα (success 2,02:1). Κι αν παραγόταν, ≤4,48:1 στο φωτεινό (βλ. πάνω).
 *   · `bg-[hsl(var(--status-X))]/NN` αυτούσιο + μελάνι X ⇒ εκτός εμβέλειας **αυτού** του κανόνα: είναι ΟΡΑΤΟ
 *     (όχι 1,00:1) αλλά χαμηλής αντίθεσης — καταγεγραμμένο ως ξεχωριστή εκκρεμότητα (pending «👻′»).
 *
 * ΔΗΛΩΜΕΝΑ ΟΡΙΑ (όχι σιωπηλά):
 *   · `getStatusColor(α,'bg')` + `getStatusColor(β,'text')` κρίνονται με το **κείμενο** των ορισμάτων — το
 *     `'pending'` και το `'info'` λύνονται στο ίδιο token αλλά εδώ δεν ταυτίζονται. Η αντιστοίχιση ζει **μόνο**
 *     στο `src/lib/design-system.ts`· αντίγραφό της εδώ θα ήταν δεύτερη αλήθεια.
 *   · Οι κλάδοι ενός `a ? x : y` ενώνονται (σπάνιο ψευδώς θετικό: `bg-X` στον έναν κλάδο, `text-X` στον άλλο).
 *   · Δεν περνά όρια αρχείου (prop που κουβαλά κλάσεις σε άλλο component).
 *
 * @module scripts/lib/contrast/same-token-fill-ink
 * @see ADR-770 · ADR-854 §3 · ADR-327 changelog 2026-10-28/29
 */

'use strict';

const ts = require('typescript');

/** Προθέματα κατάστασης (`hover:`, `dark:`) κρατιούνται: `hover:bg-X` + `text-X` = αόρατο ΣΤΟ hover. */
const FILL_RE = /(?<![\w-])((?:[a-z-]+:)*)bg-\[hsl\(var\(--status-([a-z]+)\)\)\](?!\/)/g;
const INK_RE = /(?<![\w-])((?:[a-z-]+:)*)text-\[hsl\(var\(--status-([a-z]+)\)\)\](?!\/)/g;
const CLASS_CALLS = new Set(['cn', 'clsx', 'cx', 'twMerge', 'designSystem.cn']);
const PREFILTER = /--status-|getStatusColor/;

const emptyMarks = () => ({ fill: new Set(), ink: new Set() });
function addAll(target, source) {
  source.fill.forEach((m) => target.fill.add(m));
  source.ink.forEach((m) => target.ink.add(m));
}

/**
 * Τα tokens που είναι ΚΑΙ γέμισμα ΚΑΙ μελάνι. Σημάδι = `πρόθεμα|token`· μελάνι χωρίς πρόθεμα ισχύει σε κάθε κατάσταση.
 */
function collisions(marks) {
  const out = new Set();
  for (const fill of marks.fill) {
    const [prefix, token] = fill.split('|');
    if (marks.ink.has(fill) || marks.ink.has(`|${token}`)) out.add(prefix ? `${prefix}${token}` : token);
  }
  return [...out];
}

/**
 * @param {string} source
 * @param {string} [fileName]
 * @returns {{ line: number, kind: string, tokens: string[], text: string }[]}
 */
function findSameTokenFillInk(source, fileName = 'file.tsx') {
  if (!PREFILTER.test(source)) return [];
  const kind = /\.[jt]sx$/.test(fileName) || !/\.[jt]s$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);

  /** `const` τιμών (όχι συναρτήσεων) του αρχείου — για `cn(fill, ink)` με μεταβλητές. */
  const constants = new Map();
  (function collect(node) {
    if (
      ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
      !ts.isArrowFunction(node.initializer) && !ts.isFunctionExpression(node.initializer) &&
      !constants.has(node.name.text)
    ) constants.set(node.name.text, node.initializer);
    ts.forEachChild(node, (child) => { collect(child); });
  })(sf);

  function marksOf(node, depth = 0, resolving = new Set()) {
    const marks = emptyMarks();
    if (!node || depth > 4) return marks;
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      for (const m of node.text.matchAll(FILL_RE)) marks.fill.add(`${m[1]}|${m[2]}`);
      for (const m of node.text.matchAll(INK_RE)) marks.ink.add(`${m[1]}|${m[2]}`);
      return marks;
    }
    if (ts.isCallExpression(node) && /(^|\.)getStatusColor$/.test(node.expression.getText(sf))) {
      const [status, variant] = node.arguments;
      if (status && variant && ts.isStringLiteralLike(variant)) {
        const mark = `|getStatusColor(${status.getText(sf)})`;
        if (variant.text === 'bg') marks.fill.add(mark);
        if (variant.text === 'text') marks.ink.add(mark);
      }
      return marks;
    }
    if (ts.isIdentifier(node) && constants.has(node.text) && !resolving.has(node.text)) {
      return marksOf(constants.get(node.text), depth + 1, new Set(resolving).add(node.text));
    }
    // Όρια μονάδας: κάθε στοιχείο JSX κρίνεται μόνο του· ένα αντικείμενο είναι ΠΙΝΑΚΑΣ (κάθε ιδιότητα δική της
    // μονάδα — αλλιώς ο ίδιος ο `STATUS_COLOR_CLASSES` θα ήταν «στοιχείο» με bg+text)· μια συνάρτηση έχει δικά της `return`.
    if (
      ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node) ||
      ts.isObjectLiteralExpression(node) || ts.isFunctionLike(node)
    ) return marks;
    // ⚠️ `ts.forEachChild` ΣΤΑΜΑΤΑ όταν το callback επιστρέψει truthy — γι' αυτό το σώμα με άγκιστρα.
    ts.forEachChild(node, (child) => { addAll(marks, marksOf(child, depth, resolving)); });
    return marks;
  }

  const hits = [];
  const seenLines = new Set();
  function report(node, unit, marks) {
    const tokens = collisions(marks);
    if (tokens.length === 0) return;
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    if (seenLines.has(line)) return;
    seenLines.add(line);
    hits.push({ line, kind: unit, tokens, text: node.getText(sf).replace(/\s+/g, ' ').slice(0, 160) });
  }

  function classMarksOfElement(element) {
    const attributes = (ts.isJsxElement(element) ? element.openingElement : element).attributes;
    const marks = emptyMarks();
    for (const attribute of attributes.properties) {
      if (ts.isJsxAttribute(attribute) && attribute.initializer && /^(className|class)$/.test(attribute.name.getText(sf))) {
        addAll(marks, marksOf(attribute.initializer));
      }
    }
    return marks;
  }

  function visit(node, parentFill) {
    let fillBelow = parentFill;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const own = classMarksOfElement(node);
      report(node, 'jsx-element', own);
      if (parentFill && own.fill.size === 0) {
        const inherited = emptyMarks();
        parentFill.forEach((m) => inherited.fill.add(m));
        own.ink.forEach((m) => inherited.ink.add(m));
        report(node, 'jsx-inherited', inherited);
      }
      if (own.fill.size > 0) fillBelow = own.fill;
    } else if (ts.isCallExpression(node) && CLASS_CALLS.has(node.expression.getText(sf))) {
      report(node, 'class-call', marksOf(node));
    } else if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
      report(node, 'literal', marksOf(node));
    } else if (ts.isPropertyAssignment(node)) {
      report(node, 'object-property', marksOf(node.initializer));
    } else if (ts.isReturnStatement(node) && node.expression) {
      report(node, 'return', marksOf(node.expression));
    } else if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
      report(node.body, 'return', marksOf(node.body)); // `() => [fill, ink].join(' ')` = σιωπηρό return
    } else if (ts.isVariableDeclaration(node) && node.initializer && constants.get(node.name.getText(sf)) === node.initializer) {
      report(node, 'const', marksOf(node.initializer));
    }
    ts.forEachChild(node, (child) => { visit(child, fillBelow); });
  }
  visit(sf, null);
  return hits.sort((a, b) => a.line - b.line);
}

/**
 * Σημεία που μένουν ΣΚΟΠΙΜΑ ανοιχτά, με **ακριβές** πλήθος ανά αρχείο (ίδιο σχήμα με `DECLARED_EMPHASIS_TERNARIES`):
 * λιγότερα ⇒ σβήσε τη γραμμή · περισσότερα ⇒ ⛔. ΟΧΙ baseline: κάθε γραμμή έχει όνομα και λόγο.
 */
const DECLARED_OPEN_SITES = Object.freeze({
  // 2026-10-29: το αρχείο ήταν αλλαγμένο από ΑΛΛΗ συνεδρία (ΙΚΑ QR) την ώρα της διόρθωσης ⇒ δεν αγγίχθηκε.
  // Θεραπεία: `<Badge variant={getStatusBadgeVariant('active')}>` (pending «👻′»).
  'src/components/projects/ika/components/QrCodePanel.tsx': 1,
});

/**
 * @param {Map<string, {line:number}[]>} found  αρχείο (σχετικό, με `/`) → ευρήματα
 * @param {Record<string, number>} [declared]
 * @returns {string[]} περιγραφές παραβιάσεων· κενό = καθαρό
 */
function sameTokenViolations(found, declared = DECLARED_OPEN_SITES) {
  const out = [];
  for (const [file, hits] of found) {
    const allowed = declared[file] || 0;
    if (hits.length > allowed) {
      for (const h of hits) out.push(`${file}:${h.line} [${h.kind}] {${h.tokens.join(',')}} ${h.text}`);
    }
  }
  for (const [file, allowed] of Object.entries(declared)) {
    const now = (found.get(file) || []).length;
    if (now < allowed) out.push(`${file}: δηλωμένα ${allowed}, βρέθηκαν ${now} — μίκρυνε τη δήλωση στο DECLARED_OPEN_SITES`);
  }
  return out;
}

module.exports = { findSameTokenFillInk, sameTokenViolations, DECLARED_OPEN_SITES, FILL_RE, INK_RE };
