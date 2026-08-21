#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

/**
 * i18next CLDR plural suffixes: ένα κλειδί που καλείται ως `t('foo', { count })`
 * ορίζεται στο locale ως `foo_one` / `foo_other` (κ.λπ.), **ΟΧΙ** ως σκέτο `foo`.
 */
const I18NEXT_PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other', '_plural'];

/**
 * Υπάρχει το κλειδί; — **Η ΜΟΝΗ ΑΠΑΝΤΗΣΗ** (ADR-777 §8.41).
 *
 * 🔴 ΗΤΑΝ ΔΥΟ, ΚΑΙ ΔΕΝ ΔΙΑΦΩΝΟΥΣΑΝ ΣΤΗ ΜΟΡΦΗ ΑΛΛΑ ΣΤΟ ΚΡΙΤΗΡΙΟ: η πύλη ήταν
 * plural-aware, ο γεννήτορας της baseline **όχι**. Ένα κλειδί ορισμένο μόνο ως
 * `foo_other` μετριόταν **υπαρκτό** από τη μία μηχανή και **λείπον** από την άλλη
 * ⇒ φουσκωμένη baseline ⇒ σιωπηλή χαλάρωση του ratchet, στην ίδια κατεύθυνση με
 * το compat. Το έπιασε ο **N.18 / jscpd** — όχι σκέψη: οι δύο υλοποιήσεις έμοιαζαν
 * αρκετά ώστε ένας άνθρωπος να τις προσπεράσει, και **αρκετά διαφορετικές ώστε να
 * δίνουν άλλο αριθμό**.
 */
function keyExists(obj, dottedKey) {
  if (!obj) return false;
  const parts = String(dottedKey).split('.');
  const last = parts.pop();
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return false;
    if (!(part in current)) return false;
    current = current[part];
  }
  if (current === null || current === undefined || typeof current !== 'object') return false;
  if (last in current) return true;
  return I18NEXT_PLURAL_SUFFIXES.some((sfx) => `${last}${sfx}` in current);
}

/** Φορτωτής locale με cache — ένας, ώστε οι δύο καταναλωτές να διαβάζουν το ίδιο. */
function makeLocaleReader(localeDir) {
  const cache = new Map();
  return function loadLocaleJson(namespace) {
    if (cache.has(namespace)) return cache.get(namespace);
    const filePath = path.join(localeDir, `${namespace}.json`);
    let data = null;
    try {
      if (fs.existsSync(filePath)) data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      data = null;
    }
    cache.set(namespace, data);
    return data;
  };
}

/**
 * Η ΚΑΛΩΔΙΩΣΗ, ΜΙΑ ΦΟΡΑ.
 *
 * 🔑 Ο τελευταίος κλώνος που έμεινε μετά την ενοποίηση της μέτρησης ήταν το **στήσιμο**
 * — ίδιο `DEPS` γραμμένο σε δύο αρχεία. Το έπιασε ο N.18 (jscpd), και δεν είναι
 * αισθητική: αν αύριο η πύλη μάθει νέα πηγή (π.χ. δεύτερη γλώσσα) και ο γεννήτορας
 * όχι, η baseline ξαναγίνεται «άλλη μηχανή» — **τρίτη φορά το ίδιο σχήμα** στο ίδιο
 * commit (compat · plural · καλωδίωση).
 *
 * ⚠️ Το ADR-280 compat ΔΕΝ είναι λεπτομέρεια: το runtime hook φορτώνει
 * `declared + splits` και ψάχνει το κλειδί σε ΟΛΑ (`useTranslation.ts`). Πύλη που
 * δεν ρωτά το ίδιο, αναφέρει «λείπει» για κλειδιά που η εφαρμογή **λύνει** — και ο
 * μόνος τρόπος να την ικανοποιήσεις θα ήταν να ΑΝΤΙΓΡΑΨΕΙΣ τα κλειδιά πίσω στο
 * γονικό namespace, ακυρώνοντας τη διάσπαση του ADR-280.
 *
 * @param {string} repoRoot
 * @param {object} extract  το `scripts/lib/i18n-namespace-extract` SSoT
 */
function makeDeps(repoRoot, extract) {
  return {
    bundles: extract.loadNamespaceBundles(repoRoot),
    compat: extract.loadCompatNamespaces(repoRoot),
    loadLocale: makeLocaleReader(path.join(repoRoot, 'src', 'i18n', 'locales', 'el')),
    extractNamespaces: extract.extractNamespaces,
    extractTCalls: extract.extractTCalls,
    extractExplicitTCalls: extract.extractExplicitTCalls,
    withCompatNamespaces: extract.withCompatNamespaces,
    keyExists,
  };
}

/**
 * Η κρίση του ratchet της CHECK 3.8, **κατά κάδο** (ADR-777 §8.41).
 *
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ MODULE. Το `check-i18n-missing-keys.js` είναι **CLI**: το σώμα
 * του σαρώνει και τελειώνει με `process.exit()`. Ένα `module.exports` εκεί μέσα
 * σημαίνει ότι κάθε `require()` — δηλαδή κάθε test — θα **σκότωνε τον runner**.
 * Η κρίση («παλινδρόμησε;») είναι ούτως ή άλλως άλλη ευθύνη από τη σάρωση.
 *
 * 🔴 ΔΥΟ ΚΑΔΟΙ, ΟΧΙ ΕΝΑΣ ΑΡΙΘΜΟΣ. Με άθροισμα, η **ανταλλαγή** περνά αθόρυβα:
 * διορθώνεις ένα σκέτο κλειδί, προσθέτεις ένα ρητό `ns:key`, το σύνολο δεν
 * κουνιέται — και το ρητό ξαναγίνεται αόρατο, δηλαδή ακριβώς η βλάβη που η
 * επέκταση υπάρχει για να κλείσει (δόγμα ADR-749: **ταυτότητα, όχι πλήθος**).
 *
 * ⚠️ ΔΕΧΕΤΑΙ ΤΟ ΠΑΛΙΟ ΣΧΗΜΑ (σκέτος αριθμός): τότε ο αριθμός είναι το επιτρεπόμενο
 * των **σκέτων** και τα ρητά ξεκινούν από **μηδενική ανοχή** — μια μπαγιάτικη
 * baseline δεν επιτρέπεται να δώσει σιωπηλή άδεια σε ό,τι δεν είχε ποτέ μετρηθεί.
 */

/**
 * @param {Array<{key:string,line:number,bucket:'bare'|'explicit'}>} missingKeys
 * @param {number|{bare:number,explicit:number}} rawBaseline
 */
function judgeAgainstBaseline(missingKeys, rawBaseline) {
  const allow = typeof rawBaseline === 'number'
    ? { bare: rawBaseline, explicit: 0 }
    : { bare: (rawBaseline && rawBaseline.bare) || 0, explicit: (rawBaseline && rawBaseline.explicit) || 0 };
  const of = (b) => missingKeys.filter(k => k.bucket === b);
  const current = { bare: of('bare').length, explicit: of('explicit').length };
  const blocked = current.bare > allow.bare || current.explicit > allow.explicit;
  const overflow = [...of('bare').slice(allow.bare), ...of('explicit').slice(allow.explicit)];
  return { allow, current, blocked, overflow };
}

/**
 * ΤΟ ΜΟΝΑΔΙΚΟ ΣΗΜΕΙΟ ΠΟΥ ΑΠΑΝΤΑ «ΠΟΙΑ ΚΛΕΙΔΙΑ ΛΕΙΠΟΥΝ ΑΠΟ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ;»
 *
 * 🔴 ΓΙΑΤΙ ΕΝΑ ΚΑΙ ΟΧΙ ΔΥΟ ΚΛΗΣΕΙΣ. Η πύλη και ο γεννήτορας της baseline έκαναν
 * **την ίδια** μέτρηση σε δύο θέσεις, και απέκλιναν: ο γεννήτορας δεν εφάρμοζε
 * `withCompatNamespaces` και είχε δικό του `extractTCalls` ⇒ **114 έναντι 6** στο
 * ίδιο δέντρο την ίδια μέρα, δηλαδή baseline φουσκωμένη ⇒ **χαλάρωση** (αρχείο
 * μπορούσε να κερδίσει παραβιάσεις και να περάσει).
 *
 * ⚠️ ΤΟ ΕΠΙΑΣΕ ΜΕΤΑΛΛΑΞΗ, ΟΧΙ ΣΚΕΨΗ. Πρώτη γραφή: δύο κλήσεις + άγκυρα που έκρινε
 * το **κείμενο** του γεννήτορα («αναφέρει `withCompatNamespaces`;»). Η μετάλλαξη
 * `Μ6` έσβησε τη **χρήση** κρατώντας την εισαγωγή και η άγκυρα έμεινε **πράσινη**.
 * Μια πύλη που ελέγχει λέξεις αντί για συμπεριφορά είναι σχόλιο με assertions.
 *
 * 🔑 Το ρητό `t('ns:key')` κρίνεται **μόνο** στο namespace που ονομάζει: εκεί ο
 * προγραμματιστής έχει ήδη απαντήσει, και το `src/i18n/config.ts` δεν ορίζει
 * `fallbackNS`, άρα δεν υπάρχει δεύτερη ευκαιρία.
 *
 * @param {string} content
 * @param {{bundles: Map, compat: Map, loadLocale: (ns: string) => object|null,
 *          extractNamespaces: Function, extractTCalls: Function,
 *          extractExplicitTCalls: Function, withCompatNamespaces: Function,
 *          keyExists: Function}} deps
 * @returns {?{missingKeys: Array<{key:string,index:number,bucket:string}>,
 *            namespaces: string[]}}  null όταν το αρχείο δεν δηλώνει namespace
 */
function collectMissingKeys(content, deps) {
  const declared = deps.extractNamespaces(content, deps.bundles);
  if (declared.length === 0) return null;
  const namespaces = deps.withCompatNamespaces(declared, deps.compat);

  const tCalls = deps.extractTCalls(content);
  const explicitCalls = deps.extractExplicitTCalls(content);
  if (tCalls.length === 0 && explicitCalls.length === 0) return null;

  const missingKeys = [];
  for (const { ns, key, index } of explicitCalls) {
    const json = deps.loadLocale(ns);
    if (json && deps.keyExists(json, key)) continue;
    missingKeys.push({ key: ns + ':' + key, index, bucket: 'explicit' });
  }
  for (const { key, index } of tCalls) {
    const found = namespaces.some(ns => {
      const json = deps.loadLocale(ns);
      return Boolean(json) && deps.keyExists(json, key);
    });
    if (!found) missingKeys.push({ key, index, bucket: 'bare' });
  }
  return { missingKeys, namespaces };
}

module.exports = {
  judgeAgainstBaseline,
  collectMissingKeys,
  makeDeps,
  keyExists,
  makeLocaleReader,
  I18NEXT_PLURAL_SUFFIXES,
};
