/**
 * Κενό υποκατάστατο των `node:fs` / `node:path` **μόνο** για το
 * `@gltf-transform/core`, **μόνο** στο πακέτο του περιηγητή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΝΕΚΡΟΣ ΚΛΑΔΟΣ, ΟΧΙ ΚΡΥΨΙΜΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `@gltf-transform/core` δημοσιεύει **ένα** entry (`dist/index.js` — δεν έχει
 * subpath exports), οπότε το `import { PlatformIO }` σέρνει μαζί και την κλάση
 * `NodeIO`. Ο constructor της καλεί `init()`, που κάνει:
 *
 *     Promise.all([import("node:fs"), import("node:path")])
 *
 * Το webpack **επεξεργάζεται** κάθε δυναμικό `import()` κατά το χτίσιμο του module
 * — πριν από οποιοδήποτε tree-shaking — και το `node:` scheme δεν το χειρίζεται
 * κανένα plugin ⇒ `UnhandledSchemeError`, δηλαδή **αποτυχία ολόκληρου του build**.
 *
 * 🔑 **Ο κλάδος είναι ΝΕΚΡΟΣ, με γραμμένη απόδειξη**: το `gltf-memory-io.ts` δεν
 * κατασκευάζει **ποτέ** `NodeIO` — χρησιμοποιεί `PlatformIO` και ένα `readURI` που
 * **πάντα πετά**, και η κεφαλίδα του εξηγεί ότι αυτό είναι **ασφάλεια** (ADR-845
 * §6.1/§6.2: ένα `.glb` με `"uri": "../../.env"` δοσμένο σε `NodeIO` θα ήταν
 * ανάγνωση αυθαίρετου αρχείου). Άρα εδώ δεν κρύβουμε εξάρτηση που χρειάζεται
 * κάποιος — δίνουμε σώμα σε κώδικα που **δεν επιτρέπεται** να τρέξει.
 *
 * ⚠️ **ΓΙΑΤΙ ΟΧΙ `resolve.fallback: { fs: false }`**: υπάρχει ήδη (για το pdfjs) και
 * **δεν πιάνει** — το `resolve.alias`/`fallback` δεν εφαρμόζεται σε αιτήματα με
 * scheme. Το `node:fs` απορρίπτεται νωρίτερα, στον `NormalModuleFactory`.
 *
 * ⚠️ **ΓΙΑΤΙ ΟΧΙ ΚΑΘΟΛΙΚΟ `/^node:/` REPLACEMENT**: θα σιωπούσε **κάθε** μελλοντική
 * διαρροή Node builtin στον πελάτη — ακριβώς το «0 = κανείς δεν κοίταξε» που
 * καταγγέλλει ο N.11/N.12. Ο αντικαταστάτης είναι δεμένος στο `context` του
 * `@gltf-transform`: οπουδήποτε αλλού, το `node:fs` **οφείλει** να σκάει.
 *
 * ⛔ **ΜΗΝ το εισάγεις από κώδικα εφαρμογής.** Είναι αποκλειστικά στόχος του
 * `NormalModuleReplacementPlugin` στο `next.config.js`.
 */

// Το `NodeIO.init()` κάνει destructure `fs.promises` και κρατά το `path` ως module.
// Δίνονται ρητά ώστε, αν ΠΟΤΕ κατασκευαστεί `NodeIO` στον περιηγητή, η αποτυχία να
// είναι **ονομαστική** τη στιγμή της χρήσης — ποτέ `undefined is not a function`.
const refuse = () => {
  throw new Error(
    '[gltf-node-io-void] NodeIO is not available in the browser bundle. ' +
      'Use MemoryIO (src/services/listings/gltf-memory-io.ts) — ADR-845 §6.2.',
  );
};

module.exports = {
  // `node:fs` → το `NodeIO` αγγίζει μόνο το `.promises`
  promises: new Proxy({}, { get: refuse }),
  // `node:path` → `resolve` / `dirname` / `join`
  resolve: refuse,
  dirname: refuse,
  join: refuse,
  default: {},
};
