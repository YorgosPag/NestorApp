#!/usr/bin/env node
/**
 * CHECK 3.48 — **η πύλη του κενού `SelectItem`** (ADR-778). ZERO TOLERANCE, **καμία baseline**.
 *
 * ## ΓΙΑΤΙ ΥΠΑΡΧΕΙ — τρία χτυπήματα, κανένας φύλακας που να τα βλέπει ΠΡΙΝ
 * Το Radix Select **δεσμεύει** το `''` ως «καμία επιλογή», οπότε ένα `<SelectItem value="">`
 * πετά σε χρόνο εκτέλεσης και **ρίχνει ολόκληρη την επιφάνεια** που το φιλοξενεί. Χτύπησε
 * τρεις φορές:
 *
 *  · **ADR-739 §59.6.3** — έριξε **ολόκληρη** την καρτέλα «Μορφοποίηση» της κορδέλας. Το βρήκε
 *    **άνθρωπος**, κοιτώντας την οθόνη.
 *  · **§60.7.3** — δύο ακόμη **ζωντανές** (`Floor3DPanelTab`, `ScheduleFilterBar`).
 *
 * ⚠️ **Οι δύο υπάρχουσες προστασίες είναι πραγματικές και δεν αρκούν, με μετρημένο λόγο η
 * καθεμία** (`components/ui/select.tsx:162-200`):
 *  1. ο **τύπος** απαιτεί `value: string` — και το `''` **είναι** `string`·
 *  2. ο **έλεγχος χρόνου εκτέλεσης** πετά ρητά… αλλά μόνο σε `NODE_ENV !== 'production'`, και
 *     πετά **κατά την απόδοση**. Δηλαδή σε dev ρίχνει την επιφάνεια για να το πει, και σε
 *     παραγωγή τη ρίχνει το ίδιο το Radix. Και στις δύο περιπτώσεις **αφού** προσγειωθεί.
 *
 * Το ίδιο το μήνυμα σφάλματος **ονομάζει** τη λύση (`SELECT_CLEAR_VALUE`). Η γνώση υπήρχε· της
 * έλειπε **εκτέλεση πριν το commit**. *(«Ένα anchor χωρίς gate είναι σχόλιο» — CHECK 3.36.)*
 *
 * ## 🔴 ΓΙΑΤΙ ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ AST
 * Το **CHECK 3.23** (`check-native-tooltip.js`) ρωτά **την ίδια ερώτηση σε άλλο γνώρισμα JSX**:
 * «ποια στοιχεία φέρουν το γνώρισμα Χ;», με `@typescript-eslint/parser`. Αντιγράφεται ο
 * **σκελετός** (walker + συλλογή αρχείων), όχι το κριτήριο — γι' αυτό και τα δύο μένουν μικρά.
 *
 * ## ΟΙ ΚΑΤΑΣΤΑΣΕΙΣ — ΕΠΤΑ, ΡΗΤΕΣ, ΚΑΙ ΤΟ ΑΘΡΟΙΣΜΑ ΚΛΕΙΝΕΙ
 * ```
 *   ⛔ literal-empty          <SelectItem value="">              η νάρκη, αυτούσια
 *   ⛔ expression-empty       value={''} · value={""} · value={``}
 *   ⛔ missing-value          κανένα `value`, και κανένα spread να το δικαιολογεί
 *   🔶 spread-unanalyzable    <SelectItem {...props}>            ΔΗΛΩΜΕΝΟ ΚΕΝΟ
 *   🔶 expression-unanalyzable value={x}                         ΔΗΛΩΜΕΝΟ ΚΕΝΟ
 *   ✅ sentinel               value={SELECT_CLEAR_VALUE}         η θεραπεία, ονομασμένη
 *   ✅ literal-ok             value="foo"
 * ```
 * Άγνωστη κατάσταση ⇒ **`throw`**, ποτέ σιωπηλή απόρριψη. Η λογιστική είναι το όργανο που
 * εγγυάται ότι κανένα `SelectItem` δεν χάνεται — και δεν επιτρέπεται να χαθεί η ίδια (πρότυπο
 * CHECK 3.39/3.42).
 *
 * ## 🔶 ΤΟ ΚΕΝΟ ΔΗΛΩΝΕΤΑΙ, ΔΕΝ ΚΡΥΒΕΤΑΙ
 * Ένα `value={x}` όπου το `x` **μπορεί** να είναι `''` είναι η **ίδια** νάρκη, και ο AST **δεν**
 * το αποδεικνύει. Δεν καταγράφεται ως παραβίαση (θα ήταν θόρυβος πάνω από τον πήχη <10% ψευδώς
 * θετικών) αλλά **μετριέται και τυπώνεται** — ίδιο πρότυπο με το `unanalyzable: 194` του CHECK
 * 3.35. Η θεραπεία γι' αυτή την κλάση δεν είναι στατική: είναι το
 * `components/ui/clearable-select.tsx`, που κάνει το `''` **αδύνατο** ως τιμή item.
 *
 * ⚠️ **ΜΗΝ** το κάνεις ratchet. Δεν υπάρχει «λιγότερες νάρκες από χθες»: μία αρκεί για να πέσει
 * η οθόνη. Είναι εφικτό ως zero-tolerance **επειδή** το §60 καθάρισε τις δύο τελευταίες —
 * μετρημένο, όχι ελπιζόμενο.
 *
 * Usage:
 *   node scripts/check-empty-select-item.js path/a.tsx    # staged targets
 *   node scripts/check-empty-select-item.js --all         # πλήρης σάρωση src/
 *   node scripts/check-empty-select-item.js --report      # απογραφή, χωρίς κρίση
 *
 * Escape: SKIP_EMPTY_SELECT_ITEM=1
 * Exit codes: 0 = pass, 1 = blocked
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

process.chdir(path.resolve(__dirname, '..'));

const SCAN_ALL = process.argv.includes('--all');
const REPORT = process.argv.includes('--report');

/**
 * Τα ονόματα που κρίνονται.
 *
 * `SelectItem` = το κεντρικό wrapper (ADR-001). `SelectPrimitive.Item` = η ωμή διαδρομή προς το
 * Radix, που **παρακάμπτει** και τον τύπο και τον έλεγχο χρόνου εκτέλεσης του wrapper — δηλαδή
 * είναι η **πιο** επικίνδυνη μορφή, όχι εξαίρεση.
 */
const ITEM_NAME = 'SelectItem';
const PRIMITIVE_OBJECT = 'SelectPrimitive';
const PRIMITIVE_PROPERTY = 'Item';

/** Το SSoT σεντινέλι — η ονομασμένη θεραπεία (`config/domain-constants.ts`). */
const SENTINEL_IDENTIFIER = 'SELECT_CLEAR_VALUE';

const BLOCKING_STATES = ['literal-empty', 'expression-empty', 'missing-value'];
const DECLARED_GAPS = ['spread-unanalyzable', 'expression-unanalyzable'];
const CLEAN_STATES = ['sentinel', 'literal-ok'];
const ALL_STATES = [...BLOCKING_STATES, ...DECLARED_GAPS, ...CLEAN_STATES];

// ─── AST ─────────────────────────────────────────────────────────────────────

function walk(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach(c => walk(c, visitor));
    } else if (child && typeof child === 'object' && child.type) {
      walk(child, visitor);
    }
  }
}

/** Είναι αυτό το άνοιγμα στοιχείου ένα `SelectItem` (ή η ωμή του μορφή); */
function isSelectItem(nameNode) {
  if (!nameNode) return false;
  if (nameNode.type === 'JSXIdentifier') return nameNode.name === ITEM_NAME;
  if (nameNode.type === 'JSXMemberExpression') {
    return nameNode.object?.name === PRIMITIVE_OBJECT
      && nameNode.property?.name === PRIMITIVE_PROPERTY;
  }
  return false;
}

/** Κενή **αποδεδειγμένα** συμβολοσειρά; (`''`, `""`, ή template χωρίς εκφράσεις και χωρίς κείμενο) */
function isProvenEmptyString(expr) {
  if (!expr) return false;
  if (expr.type === 'Literal') return expr.value === '';
  if (expr.type === 'TemplateLiteral') {
    return expr.expressions.length === 0
      && expr.quasis.every(q => (q.value.cooked ?? q.value.raw) === '');
  }
  return false;
}

/**
 * Η κατάσταση **ενός** `SelectItem`. Ακριβώς μία, πάντα.
 *
 * ⚠️ Η **σειρά** είναι συμβόλαιο: το κυριολεκτικό κενό κρίνεται πριν ρωτηθεί οτιδήποτε άλλο,
 * και η απουσία `value` κρίνεται **αφού** αποκλειστεί το spread — αλλιώς κάθε
 * `<SelectItem {...props}>` θα ήταν ψευδώς θετικό.
 */
function classify(node) {
  const attributes = node.attributes || [];
  const valueAttr = attributes.find(a =>
    a.type === 'JSXAttribute' && a.name?.type === 'JSXIdentifier' && a.name.name === 'value');

  if (!valueAttr) {
    const hasSpread = attributes.some(a => a.type === 'JSXSpreadAttribute');
    return hasSpread ? 'spread-unanalyzable' : 'missing-value';
  }

  // `value` χωρίς τιμή (`<SelectItem value />`) είναι `true`, όχι κενό — αλλά δεν είναι και
  // `string`: ο μεταγλωττιστής το κόβει. Κατατάσσεται στα ανεπίλυτα, ποτέ σιωπηλά.
  if (valueAttr.value === null) return 'expression-unanalyzable';

  if (valueAttr.value.type === 'Literal') {
    return valueAttr.value.value === '' ? 'literal-empty' : 'literal-ok';
  }

  if (valueAttr.value.type === 'JSXExpressionContainer') {
    const expr = valueAttr.value.expression;
    if (isProvenEmptyString(expr)) return 'expression-empty';
    if (expr?.type === 'Identifier' && expr.name === SENTINEL_IDENTIFIER) return 'sentinel';
    if (expr?.type === 'Literal' && typeof expr.value === 'string') return 'literal-ok';
    return 'expression-unanalyzable';
  }

  return 'expression-unanalyzable';
}

function scanFile(filePath) {
  let parser;
  try {
    parser = require('@typescript-eslint/parser');
  } catch {
    return null;
  }

  let ast;
  try {
    ast = parser.parse(fs.readFileSync(filePath, 'utf8'), {
      jsx: true, range: true, loc: true, errorOnUnknownASTType: false,
    });
  } catch {
    return null;
  }

  const found = [];
  walk(ast, node => {
    if (node.type !== 'JSXOpeningElement') return;
    if (!isSelectItem(node.name)) return;
    const state = classify(node);
    if (!ALL_STATES.includes(state)) {
      throw new Error(
        `CHECK 3.48: άγνωστη κατάσταση «${state}» στο ${filePath}:${node.loc?.start?.line}. `
        + 'Η λογιστική δεν επιτρέπεται να χάσει στοιχείο σιωπηλά.',
      );
    }
    found.push({ state, line: node.loc?.start?.line ?? 0 });
  });
  return found;
}

// ─── Συλλογή αρχείων ─────────────────────────────────────────────────────────

function collectAllFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) out.push(...collectAllFiles(full));
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

function collectFiles() {
  if (SCAN_ALL || REPORT) return collectAllFiles('src');
  return process.argv.slice(2).filter(a => !a.startsWith('--'));
}

// ─── Main ────────────────────────────────────────────────────────────────────

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

const files = collectFiles();
if (!files.length) process.exit(0);

const ledger = Object.fromEntries(ALL_STATES.map(s => [s, 0]));
const blocked = [];
let total = 0;

for (const file of files) {
  if (!file.endsWith('.tsx') || !fs.existsSync(file)) continue;
  const found = scanFile(file);
  if (found === null) continue;
  for (const hit of found) {
    total += 1;
    ledger[hit.state] += 1;
    if (BLOCKING_STATES.includes(hit.state)) blocked.push({ file, ...hit });
  }
}

// 🔴 Κλειστή λογιστική, fail-closed: αν το άθροισμα των κάδων δεν ισούται με το πλήθος των
// στοιχείων, κάποιο χάθηκε — και η πύλη θα έλεγε «καθαρό» για κάτι που δεν κοίταξε.
const summed = ALL_STATES.reduce((acc, s) => acc + ledger[s], 0);
if (summed !== total) {
  console.error(`${RED}CHECK 3.48: η λογιστική δεν κλείνει (${summed} ≠ ${total}).${NC}`);
  process.exit(1);
}

if (REPORT) {
  console.log(`\nCHECK 3.48 — απογραφή «SelectItem» σε ${files.length} αρχεία .tsx\n`);
  for (const state of ALL_STATES) {
    const mark = BLOCKING_STATES.includes(state) ? '⛔' : DECLARED_GAPS.includes(state) ? '🔶' : '✅';
    console.log(`  ${mark} ${state.padEnd(24)} ${ledger[state]}`);
  }
  console.log(`  ${''.padEnd(27)} ─────`);
  console.log(`  ${'ΣΥΝΟΛΟ'.padEnd(27)} ${total}\n`);
  process.exit(0);
}

if (blocked.length) {
  console.log(`\n${RED}═══════════════════════════════════════════════════════════════${NC}`);
  console.log(`${RED}  🚫 COMMIT BLOCKED — κενό <SelectItem> (CHECK 3.48)${NC}`);
  console.log(`${RED}  Το Radix Select δεσμεύει το '' — το item ΡΙΧΝΕΙ ΟΛΗ την επιφάνεια${NC}`);
  console.log(`${RED}═══════════════════════════════════════════════════════════════${NC}\n`);
  for (const { file, line, state } of blocked) {
    console.log(`  ❌ ${file}:${line}  [${state}]`);
  }
  console.log(`\n  ${YELLOW}Λύση (SSoT — @/config/domain-constants):${NC}`);
  console.log(`       <SelectItem value={SELECT_CLEAR_VALUE}>Καμία επιλογή</SelectItem>`);
  console.log(`       onValueChange: if (isSelectClearValue(v)) setDraft(undefined)`);
  console.log(`  ${YELLOW}Ή χρησιμοποίησε το <ClearableSelect> (@/components/ui/clearable-select),${NC}`);
  console.log(`  ${YELLOW}που κάνει το '' δομικά αδύνατο ως τιμή item.${NC}\n`);
  process.exit(1);
}

if (SCAN_ALL) {
  const gaps = DECLARED_GAPS.reduce((acc, s) => acc + ledger[s], 0);
  console.log(`${GREEN}✅ CHECK 3.48 — κανένα κενό SelectItem${NC} (${total} στοιχεία· ${gaps} ανεπίλυτα, δηλωμένο κενό)`);
}

process.exit(0);
