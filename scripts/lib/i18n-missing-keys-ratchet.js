#!/usr/bin/env node
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

module.exports = { judgeAgainstBaseline, collectMissingKeys };
