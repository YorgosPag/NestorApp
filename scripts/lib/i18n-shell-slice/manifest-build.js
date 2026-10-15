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
 * @param {Map<string,string>} [args.signedOnly] artifacts που **υπογράφονται** αλλά δεν
 *   είναι slice (ADR-744 §27: ο χάρτης τεμπέλικων διαδρομών). Χωριστά από το `artifacts`
 *   επειδή το `stats.sliceBytes` μετρά **κείμενο που ταξιδεύει** — ένας πίνακας ονομάτων
 *   μέσα του θα έκανε τον αριθμό να λέει κάτι που δεν μετρά.
 *
 * 🔴 ADR-744 §32.11 (Β6) — ΟΙ ΠΙΝΑΚΕΣ ΕΙΣΟΔΩΝ ΑΠΟΣΥΡΘΗΚΑΝ: `shellFiles` (map αποτυπωμάτων),
 * `routeFiles`, `consultedFiles` (§21/§31) και `unresolvedSpecs` (§28) υπήρχαν μόνο για τους
 * ελέγχους C/D, που ρωτούσαν «άλλαξε είσοδος;». Ο G ρωτά την ΕΞΟΔΟ (early cutoff) και ξαναβρίσκει
 * τις εισόδους από τον ίδιο τον walk γονέα + commit, άρα η καταγραφή τους εδώ ήταν διπλότυπο που
 * μπορούσε να αποκλίνει. Μένει μόνο η λίστα ΜΕΛΩΝ του κελύφους (`shellMembers`), επειδή είναι
 * ΕΞΟΔΟΣ: τη διαβάζει το CHECK 3.51. ⚠️ Νέο όνομα επίτηδες — `Object.keys` σε πίνακα θα έδινε
 * σιωπηλά δείκτες σε όποιον έμεινε στο παλιό σχήμα.
 *
 * 🔴 ADR-744 §32.12 — ΚΑΙ Η ΤΟΠΟΛΟΓΙΑ ΒΓΗΚΕ (`shellMembers`, `boundaries`, `stats.shellFiles/
 * dynamicBoundaries/routeBoundaries`). ΜΕΤΡΗΜΕΝΟ: 25 από τα 45 σωστά κόκκινα του G (200 commits) άλλαζαν
 * ΜΟΝΟ αυτά — καμία γραμμή που ταξιδεύει στον browser. Τα μέλη τα διάβαζε μόνο το CHECK 3.51 Layer 1
 * (το Layer 2 του ήδη τα ξαναϋπολογίζει)· τα όρια και οι μετρητές μόνο γραμμές log. Δεσμευμένο παράγωγο
 * που δεν ταξιδεύει = cache εισόδου πύλης μέσα στο VCS (Bazel: οι έξοδοι ΠΟΤΕ στο VCS, η τοπολογία
 * είναι `query`). Τα μέλη τα δίνει πλέον το `shell-members.js`, από τον ίδιο walk, με επαληθεύσιμο ίχνος.
 * Μένουν όσα ΕΧΟΥΝ καταναλωτή-πύλη ή runtime: `wants` (+ `from` για την απογραφή), `matchedKeys`, artifacts.
 */
function buildManifest({ config, plan, artifacts, slices, routes = [], signedOnly = new Map(), globalInputs = {} }) {
  const body = {
    generator: 'scripts/generate-i18n-shell-slice.js',
    adr: 'ADR-744',
    languages: config.languages,
    shellRoots: plan.rootsRel,
    guaranteedNamespaces: Object.keys(config.guaranteedNamespaces).sort(),
    namespaces: Object.keys(slices.resources[config.languages[0]] || {}).sort(),
    stats: {
      matchedKeys: slices.matchedKeys,
      sliceBytes: [...artifacts.values()].reduce((sum, text) => sum + Buffer.byteLength(text, 'utf8'), 0),
    },
    artifacts: Object.fromEntries([...artifacts, ...signedOnly].map(([file, text]) => [file, sha256(text)])),
    // Shell keys no locale defines, in any namespace the call site declares.
    // Reported, never fatal: CHECK 3.8 owns missing keys, this gate owns freshness.
    unresolvableKeys: slices.unresolvableKeys,
    wants: serializeWants(plan.wants, { withProvenance: true }),
    // ADR-744 §20 (Β2β) — τα `wants` ΚΑΘΕ δηλωμένης διαδρομής, ώστε το Layer 1 να
    // μπορεί να ρωτήσει «είναι ακόμη αυτό που λένε τα locales;» χωρίς γράφο.
    routes: serializeRouteWants(routes),
    // 🔴 ADR-744 §30 — και οι ΚΑΘΟΛΙΚΕΣ είσοδοι (config · σταθερές · aliases · toolchain), ώστε
    // το `inputsSha256` να είναι ΟΝΤΩΣ αποτύπωμα εισόδων — ως τώρα σφράγιζε μόνο τις ανά αρχείο.
    globalInputs,
  };
  return { ...body, inputsSha256: sha256(stableStringify(body)) };
}

/**
 * 🔴 ADR-744 §32 Β5 — **Η ΕΞΟΔΟΣ ΤΟΥ ΚΕΛΥΦΟΥΣ, ΟΠΩΣ ΤΗ ΓΡΑΦΕΙ ΤΟ MANIFEST** — ό,τι συγκρίνει το early cutoff.
 *
 * Το Layer 2 συγκρίνει το manifest byte-προς-byte, και το manifest ΔΕΝ είναι μόνο slices: γράφει και
 * γεγονότα κλειστότητας (μέλη, όρια, μετρητές, προέλευση). Αν το G έκρινε μόνο slice + `wants`, μια νέα
 * ακμή χωρίς νέο κλειδί θα έδινε πράσινο pre-commit και **κόκκινο CI** — το «μόνιμο κόκκινο στο Layer 2»
 * που απέρριψε το §31.1. Άρα εδώ μπαίνει ΚΑΘΕ πεδίο που παράγει η κλειστότητα του κελύφους, ΕΚΤΟΣ:
 *   · `globalInputs` (έλεγχος E) · `sliceBytes` / `inputsSha256` (παράγωγα των παραπάνω + των διαδρομών).
 * ⚠️ ΜΙΑ συνάρτηση για τις δύο πλευρές (φρέσκο και δεσμευμένο): δύο προβολές θα απέκλιναν.
 * ADR-744 §32.12 — μέλη/όρια/μετρητές τοπολογίας δεν είναι πια στο manifest, άρα ούτε εδώ: η προβολή
 * μένει ΑΚΡΙΒΩΣ ό,τι σφραγίζει το Layer 2, τίποτα παραπάνω (ένα πεδίο εδώ που δεν γράφεται = μόνιμο `null`).
 *
 * @param {object} manifest
 * @param {string[]} artifactPaths  τα artifacts του κελύφους (slices ανά γλώσσα + `whole`)
 */
function shellProjection(manifest, artifactPaths) {
  const stats = manifest.stats || {};
  return {
    languages: manifest.languages,
    shellRoots: manifest.shellRoots,
    guaranteedNamespaces: manifest.guaranteedNamespaces,
    namespaces: manifest.namespaces,
    stats: { matchedKeys: stats.matchedKeys },
    unresolvableKeys: manifest.unresolvableKeys,
    wants: manifest.wants,
    artifacts: Object.fromEntries(artifactPaths.map(rel => [rel, (manifest.artifacts || {})[rel] ?? null])),
  };
}

/** Η έξοδος **μίας** διαδρομής στο manifest: η γραμμή της + το sha του artifact της. */
function routeProjection(manifest, id, artifactPath) {
  return {
    route: (manifest.routes || {})[id] ?? null,
    artifact: (manifest.artifacts || {})[artifactPath] ?? null,
  };
}

module.exports = {
  serializeWants,
  hydrateWants,
  serializeRouteWants,
  buildManifest,
  shellProjection,
  routeProjection,
};
