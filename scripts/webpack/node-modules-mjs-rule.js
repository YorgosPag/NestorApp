/**
 * =============================================================================
 * Ο ΚΑΝΟΝΑΣ webpack ΓΙΑ ΤΑ `.mjs` ΤΟΥ `node_modules` (client, production)
 * =============================================================================
 *
 * Γιατί υπάρχει: το `pdfjs-dist` (`.mjs`) χωρίς `type: 'javascript/auto'` ρίχνει
 * «Object.defineProperty called on non-object» (ESM strict interop) — ο κανόνας τα
 * αναλύει ως «χαλαρό» JavaScript.
 *
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (ADR-929 Φ0.6, 2026-11-11, μετρημένο ζωντανά στο nestorconstruct.gr):
 *    ο κανόνας ίσχυε για **ΚΑΘΕ** `.mjs` — και για όσα ζητούνται ως **URL**
 *    (`new URL('x.mjs', import.meta.url)`), που το webpack ορίζει ως `asset/resource`.
 *    Ο κανόνας μας έρχεται **μετά** τους προεπιλεγμένους ⇒ ο τύπος του κερδίζει ⇒ το URL
 *    έλυνε σε **module JS** αντί για κείμενο. Το `onnxruntime-web` 1.30 κάνει ακριβώς αυτό
 *    για το ίδιο του το αρχείο (`ort.wasm.bundle.min.mjs`) στην εκκίνηση ⇒
 *    `new r.U(r(488244))` πάνω στο αντικείμενο `{ InferenceSession, … }` ⇒
 *    `TypeError: e.replace is not a function` ⇒ ο Worker του OCR πέθαινε **πριν** γράψει
 *    ακροατή, ως `unhandledrejection` που δεν φτάνει ποτέ στον πελάτη — το πάνελ έμενε
 *    για πάντα στο «Προετοιμασία ανάγνωσης…».
 *
 * 🔑 Η διόρθωση είναι **στενή**: `dependency: { not: ['url'] }`. Τα `import` μένουν
 *    `javascript/auto` (pdfjs αμετάβλητο)· τα URL ξαναγίνονται assets, όπως ορίζει το webpack.
 *    ΜΗΝ το λύσεις με εξαίρεση για ένα πακέτο: η κλάση είναι «URL προς `.mjs`», όχι το ORT.
 *
 * ⚓ Άγκυρα: `scripts/__tests__/node-modules-mjs-rule.test.js` — **εκτελεί** το webpack του
 *    Next και τρέχει το bundle (ΜΕ τον κανόνα ⇒ κείμενο-URL · χωρίς το `dependency` ⇒ το
 *    ίδιο `e.replace` της παραγωγής).
 */

/** Ο κανόνας όπως μπαίνει στο `config.module.rules` (μόνο client). */
function nodeModulesMjsRule() {
  return {
    test: /\.mjs$/,
    include: /node_modules/,
    dependency: { not: ['url'] },
    type: 'javascript/auto',
  };
}

module.exports = { nodeModulesMjsRule };
