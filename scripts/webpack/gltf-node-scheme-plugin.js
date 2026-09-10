/**
 * webpack plugin: λύνει το `node:fs` / `node:path` σε **κενό** module — αλλά **ΜΟΝΟ**
 * όταν το ζητά το `@gltf-transform/core`, και **ΜΟΝΟ** στο πακέτο του περιηγητή.
 *
 * Το «γιατί» ζει ολόκληρο στο {@link ./gltf-node-io-void.js}. Εδώ ζει το «πώς», και
 * το «πώς» έχει **δύο** μετρημένες παγίδες:
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΠΑΓΙΔΑ 1 — ΤΟ `NormalModuleReplacementPlugin` **ΔΕΝ ΔΟΥΛΕΥΕΙ** ΓΙΑ SCHEMES
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Είναι η πρώτη λύση που προτείνει κάθε αναζήτηση για `UnhandledSchemeError`, και
 * **μετρήθηκε ότι αποτυγχάνει σιωπηλά** (2026-09-10, webpack του Next 15.5.22):
 * το callback **ΚΑΛΕΙΤΑΙ** κανονικά, με σωστό `request` και σωστό `context` — αλλά η
 * ανάθεση στο `resource.request` **αγνοείται**, γιατί το webpack έχει ήδη δρομολογήσει
 * το αίτημα ως *scheme module*. Δοκιμάστηκαν **τρεις** παραλλαγές:
 *
 * | # | Προσέγγιση | Αποτέλεσμα |
 * |---|---|---|
 * | Α | `NormalModuleReplacementPlugin` + αφαίρεση `node:` + `resolve.fallback:false` | ❌ `UnhandledSchemeError` |
 * | Β | `NormalModuleReplacementPlugin` + αφαίρεση `node:` + `resolve.alias` | ❌ `UnhandledSchemeError` |
 * | Γ | `normalModuleFactory.hooks.resolveForScheme.for('node')` | ✅ καθαρό |
 *
 * ⛔ **ΜΗΝ το «απλοποιήσεις» πίσω σε `NormalModuleReplacementPlugin`.** Θα φαίνεται
 * σωστό, το callback θα τρέχει, και το build θα σκάει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΠΑΓΙΔΑ 2 — Ο ΦΡΟΥΡΟΣ ΤΟΥ `context` ΠΡΕΠΕΙ ΝΑ ΔΕΧΕΤΑΙ **ΚΑΙ** `\` **ΚΑΙ** `/`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `resolveData.context` έρχεται με τους διαχωριστές **του λειτουργικού**: σε Linux
 * *(CI · Netcup)* `/`, σε τοπικό `next build` στα Windows `\`. Ένας φρουρός μόνο με `/`
 * περνά **πράσινος στο CI** και αφήνει το τοπικό production build να σκάει — δηλαδή
 * ακριβώς το είδος διαφοράς που εμφανίζεται μόνο όταν τη χρειάζεσαι.
 *
 * ⚠️ **ΓΙΑΤΙ ΟΧΙ ΚΑΘΟΛΙΚΟ `/^node:/`**: θα σιωπούσε **κάθε** μελλοντική διαρροή Node
 * builtin στον πελάτη — το «0 = κανείς δεν κοίταξε» του N.11/N.12. Έξω από το
 * `@gltf-transform`, το `node:fs` **οφείλει** να ρίχνει το build.
 */

const path = require('path');

/** Το κενό module. Ένα, κοινό — ποτέ δεύτερο αντίγραφο (N.18). */
const VOID_MODULE = path.resolve(__dirname, 'gltf-node-io-void.js');

/** Ποια builtins αντικαθίστανται. Ό,τι ζητήσει άλλο builtin **οφείλει** να σκάσει. */
const REPLACED = /^node:(fs|path)$/;

/**
 * Ποιος επιτρέπεται να τα ζητήσει. Δέχεται **και τους δύο** διαχωριστές — δες Παγίδα 2.
 * Εξάγεται ώστε η άγκυρα να ελέγχει **αυτό** το regex, όχι αντίγραφό του.
 */
const ALLOWED_CONTEXT = /[\\/]@gltf-transform[\\/]/;

class GltfNodeSchemePlugin {
  apply(compiler) {
    compiler.hooks.normalModuleFactory.tap('GltfNodeSchemePlugin', (factory) => {
      factory.hooks.resolveForScheme
        .for('node')
        .tap('GltfNodeSchemePlugin', (resourceData, resolveData) => {
          if (!REPLACED.test(resourceData.resource)) return;
          if (!ALLOWED_CONTEXT.test((resolveData && resolveData.context) || '')) return;

          resourceData.path = VOID_MODULE;
          resourceData.query = '';
          resourceData.fragment = '';
          resourceData.resource = VOID_MODULE;

          // `true` ⇒ «το χειρίστηκα»· χωρίς αυτό το webpack συνεχίζει στο σφάλμα.
          return true;
        });
    });
  }
}

module.exports = { GltfNodeSchemePlugin, VOID_MODULE, REPLACED, ALLOWED_CONTEXT };
