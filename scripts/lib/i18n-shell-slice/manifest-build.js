#!/usr/bin/env node
/**
 * ADR-744 — η σειριοποίηση του σχεδίου σε manifest, και η αντίστροφη.
 *
 * Βγήκε από το `plan.js` (N.7.1): το σχέδιο **υπολογίζει**, αυτό εδώ **γράφει** ό,τι υπολογίστηκε
 * σε σφραγισμένη μορφή (`inputsSha256`). Το `plan.js` κάνει re-export για τους καταναλωτές του.
 */

'use strict';

const { stableStringify, sha256 } = require('./slice-build');

/**
 * The resolved key set, serialized.
 *
 * THIS IS WHAT MAKES THE CHEAP GATE EXACT. Rebuilding the shell closure costs
 * ~19s (13.877 modules parsed), which no pre-commit hook can spend. With the
 * wants written down, a locale edit is verified by re-pruning the SAME key set
 * out of the SAME files — no graph, ~50ms, and the answer is not an
 * approximation of the generator's, it is the generator's.
 */
function serializeWants(wants, { withProvenance = false } = {}) {
  const out = {};
  for (const namespace of [...wants.keys()].sort()) {
    const want = wants.get(namespace);
    out[namespace] = {
      keys: [...want.keys].sort(),
      prefixes: [...want.prefixes].sort(),
      whole: want.whole,
    };
    // 🔑 ADR-744 §23 — Η ΠΡΟΕΛΕΥΣΗ ΖΕΙ ΜΟΝΟ ΕΚΕΙ ΠΟΥ ΤΗ ΔΙΑΒΑΖΕΙ ΠΥΛΗ, ΚΑΙ ΕΙΝΑΙ
    // ΜΕΤΡΗΜΕΝΗ ΑΠΟΦΑΣΗ: γραμμένη **και** στα route plans κόστιζε **15.083 bytes**
    // επιπλέον σε κάθε αναπαραγωγή, και **κανένας καταναλωτής δεν τη ρωτούσε** — το
    // κατάστιχο διαδρομών κρίνει **σελίδες**, όχι namespaces. Δεδομένα που κανείς δεν
    // διαβάζει είναι η άλλη όψη του «`0` σημαίνει ότι κανείς δεν κοίταξε».
    // ⚠️ ΤΑΞΙΝΟΜΗΜΕΝΟ, ΠΑΝΤΑ: το manifest σφραγίζεται με sha256 (`inputsSha256`) και μια
    // σειρά που εξαρτάται από τη διάσχιση του γράφου θα έκανε το ίδιο δέντρο να παράγει
    // δύο αποτυπώματα — δηλαδή «μπαγιάτικο» χωρίς καμία αλλαγή.
    if (withProvenance) out[namespace].from = [...want.from].sort();
  }
  return out;
}

/** Inverse of {@link serializeWants} — the gate feeds this straight to buildSlices(). */
function hydrateWants(serialized) {
  const wants = new Map();
  for (const [namespace, want] of Object.entries(serialized)) {
    wants.set(namespace, {
      keys: new Set(want.keys),
      prefixes: new Set(want.prefixes),
      whole: Boolean(want.whole),
      from: new Set(want.from ?? []),
    });
  }
  return wants;
}

/**
 * 🔴 ADR-744 §20 (Β2β) — **ΤΟ ΚΕΝΟ ΠΟΥ ΑΦΗΝΕ ΤΟ LAYER 1 ΝΑ ΛΕΕΙ «ΚΑΘΑΡΟ».**
 *
 * ΜΕΤΡΗΜΕΝΟ 2026-08-30: με τα 20 νέα κλειδιά του ADR-832 **μέσα** στα locales και το
 * `routes/offers__mandate__new.el.json` **χωρίς κανένα από αυτά**, το
 * `node scripts/check-i18n-shell-slice.js` τύπωσε **`✅ CHECK 3.34 OK`**.
 *
 * Γιατί: το `checkLocaleDrift` ξανακλαδεύει από τα σημερινά locales **μόνο το
 * κέλυφος** (`manifest.wants`), ενώ τα route slices κρίνονταν **μόνο** με sha256
 * έναντι του manifest — δηλαδή η κατάσταση «**συνεπές αλλά μπαγιάτικο**» περνούσε
 * καθαρή. Το manifest **δεν κρατούσε καθόλου** τα `wants` των διαδρομών, άρα το
 * Layer 1 ήταν **δομικά ανίκανο** να ρωτήσει. Μια επεξεργασία μετάφρασης που αλλάζει
 * route slice ήταν **αόρατη σε κάθε commit** — έμενε μόνο το CI.
 *
 * 🔑 Η ΘΕΡΑΠΕΙΑ ΕΙΝΑΙ ΔΕΔΟΜΕΝΑ, ΟΧΙ ΝΕΑ ΜΗΧΑΝΗ: γράφοντας εδώ τα `wants` κάθε
 * διαδρομής, ο ελεγκτής ξαναχτίζει το slice της με το **ίδιο** `buildSlices` που
 * χρησιμοποιεί για το κέλυφος — **χωρίς γράφο**, άρα χωρίς κόστος στο pre-commit.
 * Ίδιο ερώτημα, ίδια μηχανή, δύο καταναλωτές (ADR-749).
 */
function serializeRouteWants(routes) {
  const out = {};
  for (const route of [...routes].sort((a, b) => a.id.localeCompare(b.id))) {
    out[route.id] = { page: route.page, wants: serializeWants(route.wants) };
  }
  return out;
}

/**
 * 🔴 ADR-744 §21 — **ΤΟ ΤΕΛΕΥΤΑΙΟ ΣΥΝΟΛΟ ΕΙΣΟΔΩΝ ΠΟΥ ΚΑΝΕΙΣ ΔΕΝ ΚΑΤΑΚΕΡΜΑΤΙΖΕ.**
 *
 * ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (2026-08-30, μετρημένο ζωντανά): το `MandateCatalogContent.tsx` άλλαξε
 * ανάμεσα στο `generate` και στο `commit` — και **δύο** route artifacts βγήκαν εκτός
 * συγχρονισμού **χωρίς καμία πύλη να μιλήσει στο pre-commit**. Αιτία: το αρχείο **δεν
 * είναι shell module**, άρα δεν υπάρχει στο `manifest.shellFiles`, άρα το
 * `checkStagedShellFiles` το προσπερνούσε με `continue`.
 *
 * 🏆 Η ΑΡΧΗ ΕΙΝΑΙ ΤΟΥ **BAZEL**, ΚΑΙ ΤΗΝ ΕΦΑΡΜΟΖΑΜΕ ΣΤΑ ΜΙΣΑ: ένα παραγόμενο αρχείο
 * είναι **action με δηλωμένο σύνολο εισόδων**· αν αλλάξει είσοδος, η έξοδος είναι
 * μπαγιάτικη **εξ ορισμού** — κανείς δεν χρειάζεται να θυμηθεί τίποτα. Το
 * `manifest.shellFiles` **ήταν ήδη** αυτή η ιδέα, αλλά μόνο για τις **502** εισόδους του
 * κελύφους· οι **509** της ένωσης των κλειστοτήτων διαδρομών δεν είχαν **καμία**.
 *
 * 🔑 **Η ΕΝΩΣΗ, ΟΧΙ ΑΝΑ ΔΙΑΔΡΟΜΗ — ΜΕΤΡΗΜΕΝΗ ΑΠΟΦΑΣΗ**: το αποτύπωμα είναι **τοπικό στο
 * αρχείο** (`fingerprintShellFile` βλέπει εισαγωγές + επιφάνεια i18n του ΙΔΙΟΥ αρχείου),
 * οπότε η ανά-διαδρομή επανάληψη αγοράζει **μόνο ωραιότερο μήνυμα**: 3.156 ζεύγη έναντι
 * 289 εγγραφών, δηλαδή manifest **+164%** αντί **+15%**. Απορρίφθηκε με τη μέτρηση.
 *
 * ⚠️ ΑΦΑΙΡΟΥΝΤΑΙ ΟΣΑ ΕΙΝΑΙ ΗΔΗ ΚΕΛΥΦΟΣ (220 από τα 509): ίδιο αρχείο ⇒ **ίδιο**
 * αποτύπωμα, άρα δεύτερη εγγραφή θα ήταν διπλότυπο που μπορεί να **αποκλίνει**.
 * Ο ελεγκτής ρωτά πρώτα το `shellFiles` και μετά αυτό — ένα αρχείο, μία απάντηση.
 */
function serializeRouteFiles(routes, shellFiles) {
  const out = {};
  for (const route of routes) {
    for (const [relFile, analysis] of route.perFile || []) {
      if (relFile in shellFiles) continue;
      out[relFile] = analysis.fingerprint;
    }
  }
  return Object.fromEntries(Object.keys(out).sort().map(file => [file, out[file]]));
}

/**
 * 🔴 ADR-744 §31 — τα barrels που ο walk του κελύφους ή μιας διαδρομής **ΔΙΑΒΑΖΕΙ** (`resolveOrigin`)
 * αλλά δεν γίνονται μέλη. Αλλαγή re-export εκεί αλλάζει την κλειστότητα χωρίς καμία εγγραφή —
 * το docstring του ελεγκτή το δήλωνε ως όριο του Layer 1· μετρήθηκε (234) και κλείνει εδώ.
 * ⚠️ Χωριστός πίνακας, ΟΧΙ μέσα στο `shellFiles`: εκείνο σημαίνει «μέλος του κελύφους» για άλλες
 * πύλες· ένα barrel που απλώς προωθεί δεν είναι μέλος. Ίδιο αρχείο σε δύο πίνακες ⇒ μένει στον πρώτο.
 */
function serializeConsultedFiles(plan, routes, recorded) {
  const out = {};
  for (const source of [plan, ...routes]) {
    for (const [relFile, analysis] of source.consulted || []) {
      if (!recorded.some(table => relFile in table)) out[relFile] = analysis.fingerprint;
    }
  }
  return Object.fromEntries(Object.keys(out).sort().map(file => [file, out[file]]));
}

/**
 * 🔴 ADR-744 §28 — οι άλυτοι specifiers **ΚΑΘΕ** κλειστότητας που παράγει artifact.
 *
 * ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (ADR-777 §8.95, 2026-10-13): το `e11193d8` δέσμευσε
 * `import { ListingEnergyCost } from './ListingEnergyCost'` **πριν** δεσμευτεί το αρχείο.
 * Ο γεννήτορας-στο-ευρετήριο είδε άλυτη εισαγωγή στη διαδρομή `listing/[id]` και την
 * **πέταξε** — εδώ ταξίδευαν μόνο του κελύφους. Όταν το αρχείο ήρθε (`05fa9f35`), δεν ήταν
 * ούτε στο `routeFiles` ούτε στα άλυτα ⇒ το Layer 1 είπε `✅ OK` πάνω σε route slice χωρίς
 * τα κλειδιά του, και πήγε έτσι στην παραγωγή.
 *
 * ⚠️ ΕΝΩΣΗ, ΟΧΙ ΑΝΑ ΔΙΑΔΡΟΜΗ: η ερώτηση του D είναι «λύνει νέο αρχείο κάποιον άλυτο
 * specifier;» — η απάντηση δεν εξαρτάται από το ποια διαδρομή τον είχε (ίδια λογική με
 * το `serializeRouteFiles`).
 */
function unionOfUnresolved(plan, routes, lazy = null) {
  const all = new Set(plan.closure.unresolvedSpecs);
  for (const route of routes) for (const spec of route.unresolvedSpecs || []) all.add(spec);
  // ADR-744 §31 — ΚΑΙ οι τεμπέλικες κλειστότητες: ίδια ερώτηση, τρίτο σύνολο (ως τώρα πετιόταν).
  for (const spec of (lazy && lazy.unresolvedSpecs) || []) all.add(spec);
  return [...all].sort();
}

/**
 * @param {Map<string,string>} [args.signedOnly] artifacts που **υπογράφονται** αλλά δεν
 *   είναι slice (ADR-744 §27: ο χάρτης τεμπέλικων διαδρομών). Χωριστά από το `artifacts`
 *   επειδή το `stats.sliceBytes` μετρά **κείμενο που ταξιδεύει** — ένας πίνακας ονομάτων
 *   μέσα του θα έκανε τον αριθμό να λέει κάτι που δεν μετρά.
 */
function buildManifest({ config, plan, artifacts, slices, routes = [], signedOnly = new Map(), globalInputs = {}, lazy = null }) {
  const shellFiles = {};
  for (const [file, analysis] of plan.perFile) shellFiles[file] = analysis.fingerprint;
  const routeFiles = serializeRouteFiles(routes, shellFiles);

  const body = {
    generator: 'scripts/generate-i18n-shell-slice.js',
    adr: 'ADR-744',
    languages: config.languages,
    shellRoots: plan.rootsRel,
    guaranteedNamespaces: Object.keys(config.guaranteedNamespaces).sort(),
    namespaces: Object.keys(slices.resources[config.languages[0]] || {}).sort(),
    stats: {
      shellFiles: plan.closure.files.length,
      dynamicBoundaries: plan.closure.dynamicBoundaries.length,
      routeBoundaries: plan.closure.routeBoundaries.length,
      matchedKeys: slices.matchedKeys,
      sliceBytes: [...artifacts.values()].reduce((sum, text) => sum + Buffer.byteLength(text, 'utf8'), 0),
    },
    artifacts: Object.fromEntries([...artifacts, ...signedOnly].map(([file, text]) => [file, sha256(text)])),
    boundaries: { dynamic: plan.closure.dynamicBoundaries, route: plan.closure.routeBoundaries },
    // 🔴 ADR-744 §28 — Η ΕΝΩΣΗ κελύφους + διαδρομών, ΟΧΙ μόνο το κέλυφος. Ίδιο σχήμα με
    // το §21 στο ΑΛΛΟ σύνολο: ο έλεγχος D ρωτούσε σωστά, αλλά για τα μισά δεδομένα.
    unresolvedSpecs: unionOfUnresolved(plan, routes, lazy),
    // Shell keys no locale defines, in any namespace the call site declares.
    // Reported, never fatal: CHECK 3.8 owns missing keys, this gate owns freshness.
    unresolvableKeys: slices.unresolvableKeys,
    wants: serializeWants(plan.wants, { withProvenance: true }),
    // ADR-744 §20 (Β2β) — τα `wants` ΚΑΘΕ δηλωμένης διαδρομής, ώστε το Layer 1 να
    // μπορεί να ρωτήσει «είναι ακόμη αυτό που λένε τα locales;» χωρίς γράφο.
    routes: serializeRouteWants(routes),
    shellFiles,
    // ADR-744 §21 — και τα αποτυπώματα των ΠΗΓΩΝ τους, ώστε να μπορεί να ρωτήσει
    // «άλλαξε module που τροφοδοτεί διαδρομή;» — το κενό που άφησε το §20.
    routeFiles,
    // ADR-744 §31 — και τα barrels που οι walks ΔΙΑΒΑΖΟΥΝ χωρίς να είναι μέλη (βλ. `serializeConsultedFiles`).
    consultedFiles: serializeConsultedFiles(plan, routes, [shellFiles, routeFiles]),
    // 🔴 ADR-744 §30 — και οι ΚΑΘΟΛΙΚΕΣ είσοδοι (config · σταθερές · aliases · toolchain), ώστε
    // το `inputsSha256` να είναι ΟΝΤΩΣ αποτύπωμα εισόδων — ως τώρα σφράγιζε μόνο τις ανά αρχείο.
    globalInputs,
  };
  return { ...body, inputsSha256: sha256(stableStringify(body)) };
}

module.exports = {
  serializeWants,
  hydrateWants,
  serializeRouteWants,
  serializeRouteFiles,
  serializeConsultedFiles,
  unionOfUnresolved,
  buildManifest,
};
