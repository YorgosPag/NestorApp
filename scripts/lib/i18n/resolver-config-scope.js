/**
 * =============================================================================
 * CHECK 3.13 (ADR-279 §5 · ADR-280 §11.8 Β3β) — «ΠΟΙΑ αρχεία ρυθμίσεων ΦΤΑΝΟΥΝ στον resolver;»
 * =============================================================================
 *
 * 🔴 **Η ΚΛΑΣΗ, ΜΕΤΡΗΜΕΝΗ (2026-10-30).** Η εμβέλεια της πύλης ήταν **κατά φάκελο** (`src/config/**`, `modal-select`,
 * `dropdown-*`: 186 αρχεία), ενώ ο resolver (`translateFieldValue`) φτάνει σε **14**. Για να πρασινίσουν τα
 * υπόλοιπα, η λίστα `SERVICE_FORM_NAMESPACES` **φούσκωσε**: το `dxf-viewer` μπήκε για 60 κλειδιά του
 * `desktop-navigation.ts` (το διαβάζει το `SmartActionFactory`, **όχι** ο resolver) και του DXF `encoding.ts`.
 * Κόστος σε χρόνο εκτέλεσης: το `useTranslation(SERVICE_FORM_NAMESPACES)` των `ServiceForm*` φόρτωνε γι' αυτά
 * **και τα 6** compat splits (594,5 KB) σε Επαφές · Κτίρια · Έργα · Ακίνητα · Ρυθμίσεις. Μια πύλη που ρωτά για
 * αρχεία που ο κρινόμενος **δεν βλέπει** δεν είναι αυστηρή· **παράγει** λάθος κώδικα.
 *
 * 🔑 **Η ΕΜΒΕΛΕΙΑ ΠΑΡΑΓΕΤΑΙ, ΔΕΝ ΓΡΑΦΕΤΑΙ.** Τρία βήματα, πάνω στον on-demand γράφο (ADR-744 §31):
 *   1. **renderers** — όσοι εισάγουν το ίδιο το αρχείο του resolver·
 *   2. **καταναλωτές** — όσοι εισάγουν σύμβολο που **δηλώνεται** σε renderer (και μέσα από barrel: `resolveOrigin`)·
 *   3. **εμβέλεια** — τα αρχεία ρυθμίσεων που εισάγει στατικά ένας καταναλωτής, και ό,τι εισάγουν αυτά **μέσα** στο
 *      πεδίο ρυθμίσεων (`isConfigLabelScope`). Υπερ-προσέγγιση με πρόθεση: ο καταναλωτής που ζευγαρώνει config με
 *      renderer (`ContactFormConfigProvider`) φέρνει και τα configs των αδελφών renderers — ποτέ λιγότερα.
 * Νέος καταναλωτής ⇒ τα configs του μπαίνουν **μόνα** τους. Καμία χειρόγραφη λίστα.
 *
 * ⛔ **FAIL-CLOSED.** Μηδέν renderers ή μηδέν καταναλωτές ⇒ `throw`: μια άδεια εμβέλεια θα ήταν το «`0` = κανείς δεν
 * κοίταξε». Κάθε ανάγνωση από την **είσοδο** της πύλης (ADR-924), ποτέ από `fs`.
 *
 * @module scripts/lib/i18n/resolver-config-scope
 */

'use strict';

const path = require('node:path');

const MG = require('../module-graph');
const { TS_PATH_ALIAS_CONFIG } = require('../i18n-shell-slice/global-inputs');
const { isConfigLabelScope } = require('./config-label-keys');

const RESOLVER_FILE = 'src/components/generic/i18n/translate-field-value.ts';
const PRODUCTION_SOURCE = (rel) => /\.(ts|tsx)$/.test(rel) && !/(__tests__|\.test\.|\.spec\.|\.stories\.|\.d\.ts$)/.test(rel);

function openGraph(input) {
  const root = MG.toPosix(path.resolve(input.root));
  const files = input.files(['src'], { accept: PRODUCTION_SOURCE }).map(MG.toPosix);
  // Μετρημένο: το κόστος είναι η ΑΝΑΓΝΩΣΗ (~21.600 αρχεία, ~5″), όχι το parse — κάθε κείμενο διαβάζεται μία φορά.
  const texts = new Map();
  const readText = (abs) => {
    if (!texts.has(abs)) texts.set(abs, input.read(abs));
    return texts.get(abs);
  };
  const graph = MG.createOnDemandGraph({
    projectRoot: root,
    // Το tsconfig κι αυτό από την ΕΙΣΟΔΟ (ADR-924 · άγκυρα Δ1 του `gate-input.test.js` — το έπιασε στην πρώτη εκτέλεση).
    aliases: MG.readTsPathAliases(root, TS_PATH_ALIAS_CONFIG, (abs) => input.read(abs)),
    files,
    readText,
    onParseError: () => {},
  });
  return { root, files, graph, resolve: MG.createResolver(graph), rel: (abs) => MG.toPosix(path.relative(root, abs)) };
}

/** Φτάνει αυτή η εισαγωγή σε ΔΗΛΩΣΗ μέσα σε κάποιο από τα `targets`; (απευθείας ή μέσα από αλυσίδα re-export) */
function reaches(ctx, from, imp, targets) {
  const target = ctx.resolve(imp.spec, from);
  if (target.kind !== 'internal') return false;
  if (targets.has(target.file)) return true;
  return (imp.names || []).some((n) => {
    const origin = MG.resolveOrigin(ctx.graph, ctx.resolve, target.file, n.imported);
    return !origin.opaque && targets.has(origin.file);
  });
}

/** Όσοι εισάγουν κάτι από τα `targets`. Φίλτρο κειμένου πρώτα (`needles`): parse μόνο όσων τα αναφέρουν. */
function importersOf(ctx, targets, needles) {
  const out = new Set();
  for (const file of ctx.files) {
    if (targets.has(file)) continue;
    const text = ctx.graph.readText(file);
    if (!text || !needles.some((needle) => text.includes(needle))) continue;
    const mod = ctx.graph.modules.get(file);
    if (mod && mod.imports.some((imp) => reaches(ctx, file, imp, targets))) out.add(file);
  }
  return out;
}

/** Τα αρχεία ρυθμίσεων που εισάγουν οι καταναλωτές, και η στατική τους κλειστότητα ΜΕΣΑ στο πεδίο ρυθμίσεων. */
function configClosure(ctx, consumers) {
  const seen = new Set();
  const stack = [];
  const visit = (from, imp) => {
    if (imp.kind === 'dynamic') return;
    const target = ctx.resolve(imp.spec, from);
    if (target.kind === 'internal' && isConfigLabelScope(ctx.rel(target.file))) stack.push(target.file);
  };
  for (const consumer of consumers) (ctx.graph.modules.get(consumer)?.imports || []).forEach((imp) => visit(consumer, imp));
  while (stack.length > 0) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    (ctx.graph.modules.get(file)?.imports || []).forEach((imp) => visit(file, imp));
  }
  return seen;
}

const baseNameOf = (abs) => path.basename(abs).replace(/\.(ts|tsx)$/, '');

/**
 * @returns {{files: string[], renderers: string[], consumers: string[]}} — σχετικά posix μονοπάτια, ταξινομημένα.
 */
function resolverConfigScope(input) {
  const ctx = openGraph(input);
  const resolver = MG.toPosix(path.join(ctx.root, RESOLVER_FILE));
  const renderers = importersOf(ctx, new Set([resolver]), [baseNameOf(resolver)]);
  if (renderers.size === 0) throw new Error(`CHECK 3.13 — κανείς δεν εισάγει το ${RESOLVER_FILE}: η εμβέλεια δεν μπορεί να παραχθεί`);
  const consumers = importersOf(ctx, renderers, [...renderers].map(baseNameOf));
  if (consumers.size === 0) throw new Error('CHECK 3.13 — κανείς δεν εισάγει renderer του resolver: η εμβέλεια δεν μπορεί να παραχθεί');
  const sorted = (set) => [...set].map(ctx.rel).sort();
  return { files: sorted(configClosure(ctx, consumers)), renderers: sorted(renderers), consumers: sorted(consumers) };
}

module.exports = { RESOLVER_FILE, resolverConfigScope };
