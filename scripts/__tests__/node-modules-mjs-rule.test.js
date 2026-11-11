/**
 * @jest-environment node
 *
 * ⚠️ **`node`, ΟΧΙ `jsdom`**: εκτελεί webpack (ίδιος λόγος με το `gltf-node-scheme-plugin.test.js`).
 */

/**
 * ⚓ ΑΓΚΥΡΑ — «ένα `new URL('x.mjs', import.meta.url)` μέσα στο `node_modules` δίνει ΚΕΙΜΕΝΟ-URL;»
 *
 * @related ADR-929 Φ0.6 · `scripts/webpack/node-modules-mjs-rule.js` · CHECK 3.54 (πύλη εκτέλεσης των αγκυρών)
 *
 * 🔴 Το περιστατικό: ο κανόνας `.mjs` (για το pdfjs) έκανε το URL του `onnxruntime-web` προς το ίδιο του το αρχείο
 *    **module JS** ⇒ `TypeError: e.replace is not a function` στην εκκίνηση του Worker του OCR ⇒ Worker νεκρός σιωπηλά
 *    στην παραγωγή (το dev τρέχει Turbopack και **δεν** το αναπαράγει). Αυτή η άγκυρα αναπαράγει το **ίδιο** σχήμα σε
 *    δείγμα: πακέτο στο `node_modules` που αναφέρεται στον εαυτό του με URL, με το `javascript.url: 'relative'` του Next.
 *
 * 🔑 **ΕΚΤΕΛΕΙ το bundle**, δεν κοιτάζει ρυθμίσεις: το Δ1 αποδεικνύει ότι χωρίς το `dependency` η άγκυρα **βλέπει** το
 *    σφάλμα της παραγωγής — αλλιώς ένα πράσινο Δ2 δεν θα σήμαινε τίποτα.
 * ⚠️ Το webpack **του Next**, όχι δεύτερο από το npm (N.12 · ADR-749).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const { nodeModulesMjsRule } = require('../webpack/node-modules-mjs-rule');

const ROOT = path.resolve(__dirname, '..', '..');
const TIMEOUT = 120000;

/** Το webpack του Next — η μηχανή που τρέχει πραγματικά στο `next build`. */
function nextWebpack() {
  const compiled = require.resolve('next/dist/compiled/webpack/webpack.js', { paths: [ROOT] });
  const mod = require(compiled);
  mod.init();
  return mod.webpack;
}

/** Δείγμα: `node_modules/selfref/index.mjs` που ζητά το ίδιο του το αρχείο ως URL — το σχήμα του ORT 1.30. */
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mjs-url-'));
  const pkg = path.join(dir, 'node_modules', 'selfref');
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, 'index.mjs'), "export const href = new URL('./index.mjs', import.meta.url).href;\n", 'utf8');
  const entry = path.join(dir, 'entry.mjs');
  fs.writeFileSync(entry, `import { href } from './node_modules/selfref/index.mjs';\nglobalThis.__href = href;\n`, 'utf8');
  return { dir, entry };
}

/** Μεταγλωττίζει με τον δοσμένο κανόνα και **εκτελεί** το bundle· επιστρέφει το `href` ή το σφάλμα. */
function compileAndRun(rule) {
  const { dir, entry } = fixture();
  const webpack = nextWebpack();
  return new Promise((resolve, reject) => {
    webpack(
      {
        mode: 'development',
        devtool: false,
        target: 'web',
        entry,
        output: { path: path.join(dir, 'out'), filename: 'b.js', publicPath: '/_next/' },
        // Όπως το Next για τον client: τα `new URL(…, import.meta.url)` γίνονται σχετικά (`__webpack_require__.U`).
        module: { parser: { javascript: { url: 'relative' } }, rules: [rule] },
      },
      (err, stats) => {
        if (err) return reject(err);
        const errors = stats.toJson({ errors: true }).errors || [];
        if (errors.length > 0) return reject(new Error(errors.map((e) => e.message || String(e)).join('\n')));
        const sandbox = { URL, console };
        sandbox.self = sandbox;
        try {
          vm.runInNewContext(fs.readFileSync(path.join(dir, 'out', 'b.js'), 'utf8'), sandbox);
          resolve({ href: sandbox.__href, error: null });
        } catch (error) {
          resolve({ href: undefined, error: String(error && error.message) });
        }
      },
    );
  });
}

describe('⚓ ADR-929 Φ0.6 — URL προς `.mjs` του node_modules = κείμενο, όχι module', () => {
  it('Α — ο κανόνας εξαιρεί ρητά τα URL (και μένει για τα import του pdfjs)', () => {
    const rule = nodeModulesMjsRule();
    expect(rule.dependency).toEqual({ not: ['url'] });
    expect(rule.type).toBe('javascript/auto');
    expect(rule.test.test('pdf.mjs')).toBe(true);
  });

  it(
    'Δ1 — ΧΩΡΙΣ το `dependency` ⇒ το σφάλμα της παραγωγής (η άγκυρα βλέπει κάτι)',
    async () => {
      const { dependency: _omitted, ...broken } = nodeModulesMjsRule();
      const out = await compileAndRun(broken);
      expect(out.error).toMatch(/replace is not a function/);
    },
    TIMEOUT,
  );

  it(
    'Δ2 — ΜΕ τον κανόνα ⇒ κείμενο-URL προς asset `.mjs`',
    async () => {
      const out = await compileAndRun(nodeModulesMjsRule());
      expect(out.error).toBeNull();
      expect(typeof out.href).toBe('string');
      expect(out.href).toMatch(/\.mjs$/);
    },
    TIMEOUT,
  );
});
