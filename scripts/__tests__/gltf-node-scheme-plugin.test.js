/**
 * @jest-environment node
 *
 * ⚠️ **`node`, ΟΧΙ το προεπιλεγμένο `jsdom`**: αυτό το test **εκτελεί webpack**, και το
 * jsdom αποκρύπτει Node globals που ο compiler χρειάζεται — μια αποτυχία εκεί θα φαινόταν
 * σαν αποτυχία **του plugin**, δηλαδή θα κατηγορούσε λάθος ένοχο.
 */

/**
 * ⚓ ΑΓΚΥΡΑ — «φεύγει το `node:fs` από το πακέτο του περιηγητή, ΚΑΙ ΜΟΝΟ εκεί που πρέπει;»
 *
 * @related ADR-845 §6.2 · CHECK 3.54 (πύλη εκτέλεσης των αγκυρών)
 *
 * 🔴 **ΕΚΤΕΛΕΙ webpack, δεν το περιγράφει.** Η προηγούμενη εκδοχή αυτής της διόρθωσης
 * χρησιμοποιούσε `NormalModuleReplacementPlugin` — ένα test που απλώς κοίταζε «υπάρχει
 * plugin;» θα ήταν **πράσινο** και το build θα έσκαγε: το callback του **καλείται**
 * κανονικά και η ανάθεσή του **αγνοείται** για αιτήματα με scheme. Μόνο μια πραγματική
 * μεταγλώττιση ξεχωρίζει τα δύο.
 *
 * ⚠️ Χρησιμοποιεί το webpack **που ψήνει το Next**, όχι ένα δεύτερο από το npm: μια
 * διαφορετική έκδοση θα απαντούσε για μηχανή που **κανείς δεν εκτελεί** (N.12 · ADR-749).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  GltfNodeSchemePlugin,
  ALLOWED_CONTEXT,
  VOID_MODULE,
} = require('../webpack/gltf-node-scheme-plugin');

const ROOT = path.resolve(__dirname, '..', '..');

/** Το `dist/index.js` του `@gltf-transform/core`, όπως το βλέπει το pnpm store. */
function gltfCoreEntry() {
  const resolved = require.resolve('@gltf-transform/core', { paths: [ROOT] });
  return resolved.split(path.sep).join('/');
}

/** Το webpack του Next — η μηχανή που τρέχει πραγματικά στο `next build`. */
function nextWebpack() {
  const compiled = require.resolve('next/dist/compiled/webpack/webpack.js', { paths: [ROOT] });
  const mod = require(compiled);
  mod.init();
  return mod.webpack;
}

function compile(entrySource, { withPlugin }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gltf-scheme-'));
  const entry = path.join(dir, 'entry.mjs');
  fs.writeFileSync(entry, entrySource, 'utf8');

  const webpack = nextWebpack();

  return new Promise((resolve, reject) => {
    webpack(
      {
        mode: 'development',
        devtool: false,
        target: 'web',
        entry,
        output: { path: path.join(dir, 'out'), filename: 'b.js' },
        plugins: withPlugin ? [new GltfNodeSchemePlugin()] : [],
      },
      (err, stats) => {
        if (err) return reject(err);
        const messages = (stats.toJson({ errors: true }).errors || []).map(
          (e) => e.message || String(e),
        );
        resolve({
          all: messages,
          scheme: messages.filter((m) => /UnhandledSchemeError/.test(m)),
        });
      },
    );
  });
}

const TIMEOUT = 120000;

describe('⚓ ADR-845 §6.2 — το `node:fs` του @gltf-transform έξω από τον περιηγητή', () => {
  describe('Α — ο φρουρός του context ξέρει ΚΑΙ τους δύο διαχωριστές', () => {
    const posix =
      '/x/node_modules/.pnpm/@gltf-transform+core@4.5.0/node_modules/@gltf-transform/core/dist';
    const win32 = [
      'C:', 'Nestor_Pagonis', 'node_modules', '.pnpm', '@gltf-transform+core@4.5.0',
      'node_modules', '@gltf-transform', 'core', 'dist',
    ].join(String.fromCharCode(92));

    it('Α1 — δέχεται POSIX context', () => {
      expect(ALLOWED_CONTEXT.test(posix)).toBe(true);
    });

    // 🔴 Η ΡΙΖΑ ΜΙΑΣ ΑΠΟΤΥΧΙΑΣ ΠΟΥ ΦΑΙΝΕΤΑΙ ΜΟΝΟ ΤΟΠΙΚΑ: με φρουρό μόνο για `/`, το CI
    //    (Linux) περνά πράσινο και το `next build` στα Windows σκάει.
    it('Α2 — δέχεται Windows context', () => {
      expect(ALLOWED_CONTEXT.test(win32)).toBe(true);
    });

    it('Α3 — ΔΕΝ δέχεται δικό μας κώδικα', () => {
      expect(ALLOWED_CONTEXT.test('/x/src/services/listings')).toBe(false);
    });

    it('Α4 — ΔΕΝ δέχεται άλλο πακέτο', () => {
      expect(ALLOWED_CONTEXT.test('/x/node_modules/other/dist')).toBe(false);
    });
  });

  describe('Β — το κενό module υπάρχει και είναι φορτώσιμο', () => {
    it('Β1 — το αρχείο υπάρχει', () => {
      expect(fs.existsSync(VOID_MODULE)).toBe(true);
    });

    it('Β2 — το `node:path` που χρειάζεται το NodeIO αρνείται ΟΝΟΜΑΣΤΙΚΑ', () => {
      const stub = require(VOID_MODULE);
      expect(() => stub.resolve('a', 'b')).toThrow(/NodeIO is not available/);
    });
  });

  describe('Γ — ΕΚΤΕΛΕΣΜΕΝΟ webpack, και οι δύο κατευθύνσεις', () => {
    const importsGltf = `import { PlatformIO } from '${gltfCoreEntry()}';
globalThis.__k = PlatformIO;
`;
    const importsNodeFs = `const m = await import('node:fs');
globalThis.__o = m;
`;

    // 🔑 Χωρίς αυτό, τα Γ2/Γ3 θα ήταν πράσινα ακόμη κι αν το plugin δεν έκανε τίποτα.
    it(
      'Γ1 — ΧΩΡΙΣ το plugin το build ΣΚΑΕΙ (η άγκυρα βλέπει κάτι)',
      async () => {
        const out = await compile(importsGltf, { withPlugin: false });
        expect(out.scheme.length).toBeGreaterThan(0);
      },
      TIMEOUT,
    );

    it(
      'Γ2 — ΜΕ το plugin το @gltf-transform χτίζεται ΚΑΘΑΡΑ',
      async () => {
        const out = await compile(importsGltf, { withPlugin: true });
        expect(out.all).toEqual([]);
      },
      TIMEOUT,
    );

    it(
      'Γ3 — ΜΕ το plugin, ΔΙΚΟ ΜΑΣ `node:fs` εξακολουθεί να ΣΚΑΕΙ',
      async () => {
        const out = await compile(importsNodeFs, { withPlugin: true });
        expect(out.scheme.length).toBeGreaterThan(0);
      },
      TIMEOUT,
    );
  });
});
