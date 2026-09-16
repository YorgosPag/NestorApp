const { withSentryConfig } = require('@sentry/nextjs');

/**
 * [DEV] Κατάλογος build ανά στιγμιότυπο — λύνει τη σύγκρουση δύο `next dev` στο ΙΔΙΟ working tree.
 *
 * Πριν το Next 16, `next dev` και `next build` γράφουν και οι δύο μέσα στο ίδιο `.next`. Δύο dev
 * servers στον ίδιο φάκελο ξαναγράφουν ο ένας τα chunks του άλλου: ο δεύτερος κερδίζει, ο πρώτος
 * μένει με μανιφέστο που δεν υπάρχει και απαντά 500 —
 *   ENOENT: … open '.next/server/app/(light)/search/results/page/app-build-manifest.json'
 * Το working tree μοιράζεται με άλλους agents, οπότε «τρέχε ΕΝΑΝ server» είναι ανάθεση σε άνθρωπο,
 * όχι εγγύηση· έχει ήδη αποτύχει δύο φορές. Με ξεχωριστό distDir η σύγκρουση γίνεται αδύνατη.
 *
 * Χρήση:  NEXT_DIST_DIR=.next-3100 npx next dev --turbopack --port 3100
 * Χωρίς τη μεταβλητή η συμπεριφορά είναι **αμετάβλητη** (`.next`) — Docker/CI/standalone ανέπαφα.
 *
 * ⚠️ Ο φρουρός δεν είναι πολυτέλεια: το Next **καθαρίζει** τον κατάλογο build. Ένα `NEXT_DIST_DIR=src`
 * από τυπογραφικό θα έσβηνε πηγαίο κώδικα. Δεκτά μόνο ονόματα που ξεκινούν με `.next`.
 */
const DIST_DIR_PATTERN = /^\.next[A-Za-z0-9._-]*$/;
const resolveDistDir = () => {
  const requested = process.env.NEXT_DIST_DIR;
  if (!requested) return '.next';
  if (!DIST_DIR_PATTERN.test(requested)) {
    throw new Error(
      `[next.config] NEXT_DIST_DIR="${requested}" απορρίφθηκε. Το Next καθαρίζει τον κατάλογο build, ` +
        `οπότε δεκτά είναι μόνο ονόματα που ταιριάζουν στο ${DIST_DIR_PATTERN} (π.χ. ".next-3100").`
    );
  }
  return requested;
};

/** @type {import('next').NextConfig} */
// Vercel rebuild trigger: 2026-03-23
const nextConfig = {
  // ══════════════════════════════════════════════════════════════════════════
  // 🔴 Ο ΠΕΛΑΤΗΣ ΜΙΛΟΥΣΕ ΣΤΗΝ **ΠΑΡΑΓΩΓΗ** ΕΝΩ ΤΟ SCRIPT ΕΛΕΓΕ «EMULATOR»
  //
  // Το `dev:emulator` έθετε `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` **μόνο στο
  // process**. Το Next/Turbopack ενσωματώνει στο client bundle τα `NEXT_PUBLIC_*`
  // που **γνωρίζει** (από `.env*` ή από αυτό εδώ το κλειδί)· μια μεταβλητή που
  // υπάρχει μόνο στο process **δεν ενσωματώνεται** — μένει runtime lookup πάνω στο
  // `next/dist/build/polyfills/process.js`, που στον browser είναι **κενό**.
  //
  // Μετρημένο στο ίδιο bundle (2026-08-25): `NEXT_PUBLIC_FIREBASE_PROJECT_ID` και
  // `NEXT_PUBLIC_FIREBASE_API_KEY` ήταν **απόντα ως ονόματα** (⇒ έγιναν inline,
  // ζουν στο `.env`), ενώ το `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` ήταν **παρόν ως
  // όνομα** ⇒ `undefined === 'true'` ⇒ **false, πάντα**.
  //
  // 🔴 Συνέπεια: ο Admin SDK (server) πήγαινε στον emulator, ο **client** στην
  // παραγωγή. Το σύμπτωμα έφτανε ως «**Μη έγκυρα στοιχεία σύνδεσης**» — λάθος
  // **προορισμού** μεταμφιεσμένο σε λάθος **διαπιστευτηρίων**.
  //
  // ⚠️ Και ο φρουρός του `src/lib/firebase.ts` ήταν **ΑΔΡΑΝΗΣ**: το `connectEmulatorOrReport`
  // τυπώνει ✅/⚠️ **μέσα** στο `if` — που δεν αλήθευε ποτέ. Δεν σιωπούσε επειδή
  // πέτυχε· σιωπούσε επειδή **δεν εκτελέστηκε**.
  //
  // 🔑 ΜΙΑ ΠΗΓΗ: το `FIREBASE_AUTH_EMULATOR_HOST` είναι η μεταβλητή που **ήδη**
  // στρέφει τον Admin SDK (αυτόματη ανίχνευση). Παράγοντας το client flag από
  // **αυτήν**, η απόκλιση server/client γίνεται **δομικά αδύνατη** αντί για
  // ανιχνεύσιμη (ADR-749). Δεύτερος διακόπτης θα ήταν δεύτερη αλήθεια.
  //
  // ⛔ ΜΗΝ ξαναβάλεις `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` στο npm script:
  //    δεν είναι πια ο διακόπτης, και θα ξαναγεννούσε τις δύο αλήθειες.
  // ══════════════════════════════════════════════════════════════════════════
  env: {
    NEXT_PUBLIC_USE_FIREBASE_EMULATOR: String(Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST)),
  },

  // [COOLIFY] Standalone output: self-contained Node server for Docker deployment.
  // Creates .next/standalone with only necessary files — smaller image, no full node_modules.
  output: 'standalone',

  distDir: resolveDistDir(),

  // [FAST] FAST DEV MODE - Skip checks για άμεσο startup
  typescript: {
    // Skip type checking για ταχύτητα
    ignoreBuildErrors: true,
  },
  // [ENTERPRISE] Skip ESLint during build - Fix pre-existing errors in second phase
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable strict mode για λιγότερα re-renders
  reactStrictMode: false,

  // [OK] ENTERPRISE FIX: Disable Next.js dev indicators/overlay that blocks click events
  devIndicators: false,

  // [OK] NEXT.JS 15: Moved from experimental to root level
  // [ADR-312 Phase 7.4] @resvg/resvg-js ships platform-specific native binaries
  // (e.g. @resvg/resvg-js-win32-x64-msvc) as optional deps — Turbopack/webpack
  // cannot resolve them statically. Marking the package external makes Next.js
  // delegate the require() to Node.js at runtime, which picks the right
  // binary for the running platform. Without this, the DXF thumbnail
  // self-heal (services/floorplans/dxf-thumbnail-selfheal.ts) fails with
  // "could not resolve @resvg/resvg-js-win32-x64-msvc into a module".
  // rimraf: added as direct dependency to suppress transitive resolution warnings
  // from Turbopack (previously unavailable in nested pnpm structure).
  // ⚠️ Το '@mapbox/node-pre-gyp' αφαιρέθηκε 2026-08-25 (ADR-598 G2): έφυγε από το δέντρο μαζί με
  // το node-canvas (19fbc2cc) — επαληθεύτηκε ότι ΔΕΝ υπάρχει στο node_modules. Μια εγγραφή εδώ
  // για πακέτο που δεν υπάρχει είναι ακίνδυνη αλλά ψευδής: λέει «αυτό δεν το κάνουμε bundle»
  // για κάτι που δεν υπάρχει να γίνει bundle.
  serverExternalPackages: ['@resvg/resvg-js', 'rimraf', '@napi-rs/canvas', 'pdfjs-dist'],

  // [OK] NEXT.JS 15: Fix workspace root detection (multiple lockfiles)
  outputFileTracingRoot: __dirname,

  // pdfjs-dist: removed from transpilePackages (conflicts with serverExternalPackages).
  // Server-side: loaded natively from node_modules via serverExternalPackages.
  // Client-side: pdfjs-dist v4 ships proper ESM — no transpilation needed.
  transpilePackages: [],

  // =========================================================================
  // [TURBOPACK] ENTERPRISE TURBOPACK CONFIGURATION (Next.js 15.5+)
  // =========================================================================
  // Reference: https://nextjs.org/docs/app/api-reference/next-config-js/turbopack
  // Pattern used by: Vercel, Microsoft, Google enterprise applications
  // NOTE: This config is used when running `next dev --turbopack`
  //       Webpack config below is used for production builds
  turbopack: {
    // Turbopack resolves Node.js built-in modules automatically
    // No need for explicit fallbacks - Turbopack handles this natively
    // Path aliases are read from tsconfig.json automatically
  },

  // [ENTERPRISE] PERFORMANCE OPTIMIZATIONS - Fortune 500 Standard
  experimental: {
    // [COOLIFY] Disable webpack build worker: prevents forking a separate Node.js
    // worker process for webpack compilation. On low-RAM VPS builds, the extra
    // fork doubles peak heap usage and triggers OOM killer (exit 137).
    webpackBuildWorker: false,
    // [ENTERPRISE] Optimized imports - Prevents barrel export overhead
    // These packages have heavy barrel exports that slow down dev compilation
    optimizePackageImports: [
      // Icon libraries (heavy barrel exports)
      'lucide-react',
      '@heroicons/react',
      // Radix UI components
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-menubar',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
      // React Aria (heavy barrel exports)
      '@react-aria/color',
      '@react-aria/dialog',
      '@react-aria/interactions',
      '@react-aria/overlays',
      '@react-stately/color',
      // Other heavy packages
      'date-fns',
      'recharts',
      'react-hook-form',
      'zod',
      'firebase',
      'firebase-admin',
      'class-variance-authority',
      // Utility libraries (imported everywhere)
      'clsx',
      'tailwind-merge',
      // Carousel / Panels / Date picker
      'embla-carousel',
      'embla-carousel-react',
      'react-day-picker',
      'react-resizable-panels',
      // Notifications / AI (pdfjs-dist excluded: conflicts with serverExternalPackages)
      'sonner',
      'openai',
      '@sentry/nextjs',
    ],
  },

  // [BUNDLE] BUNDLE OPTIMIZATION
  // =========================================================================
  // [WEBPACK] WEBPACK-ONLY CONFIGURATION - PRODUCTION BUILDS ONLY
  // =========================================================================
  // ENTERPRISE PATTERN: Separate bundler configs for dev vs production
  // - Development: Turbopack (fast, native ESM support)
  // - Production: Webpack (optimized, with plugins)
  // This eliminates "Webpack is configured while Turbopack is not" warning
  // Pattern: Vercel, Microsoft Azure DevOps, Google Cloud Build
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // [ENTERPRISE] Skip all webpack customizations in development
    // Turbopack handles these natively - no configuration needed
    if (dev) {
      return config;
    }

    // =========================================================================
    // PRODUCTION-ONLY CONFIGURATIONS BELOW
    // =========================================================================

    // [TEST-HARNESS] Replace heavy harnesses with empty stubs in production.
    // Prevents the entire DXF viewer / 3D tree from entering the production bundle.
    // In dev (Turbopack), the real files are used normally — no impact on dev server.
    //
    // ⚠️ Ο ΚΛΕΙΔΙ ΕΝΟΣ webpack alias ΕΙΝΑΙ ΑΠΟΛΥΤΟ ΜΟΝΟΠΑΤΙ: αν δεν δείχνει σε
    // υπαρκτό αρχείο, ΔΕΝ ταιριάζει ποτέ και το stub ΔΕΝ εφαρμόζεται — σιωπηλά.
    // Συνέβη: το harness μετακόμισε στο route group `(bare)` (ADR-777 §8.12) και
    // οι γραμμές έμειναν στην παλιά διαδρομή ⇒ ΟΛΟ το DXF viewer tree έμπαινε στο
    // production bundle με το σχόλιο από πάνω να λέει το αντίθετο
    // (μετρημένο: bundle 42,79 → 45,13 MB). Γι' αυτό η απουσία ΣΚΑΕΙ εδώ:
    // ένα alias που αστοχεί χωρίς να το πει είναι το «0 = κανείς δεν κοίταξε».
    //
    // 🔴 ΠΙΝΑΚΑΣ, ΟΧΙ ΤΡΙΑ ΑΝΤΙΓΡΑΦΑ (N.0.2 · CHECK 3.28) — ΚΑΙ ΤΟ ΚΕΝΟ ΚΟΣΤΙΣΕ
    //    ΤΟ DEPLOY. Ως τις 2026-09-10 φρουρό είχε **μόνο** το `dxf-canvas`, ενώ
    //    **τρία** harness σέρνουν το ίδιο δέντρο. Τα άλλα δύο έμπαιναν ολόκληρα
    //    στην παραγωγή, και το κενό το κατήγγειλε το `dxf-perf` μόλις το ADR-845
    //    (Φ4.2β) πρόσθεσε το `@gltf-transform/core` στον lazy γράφο του viewer:
    //    `UnhandledSchemeError: node:fs` — δηλαδή **ΑΠΟΤΥΧΙΑ ΤΟΥ BUILD**, όχι
    //    απλώς φουσκωμένο bundle. Το `nestorconstruct.gr` έμεινε στον κώδικα της
    //    06/09 για δύο pushes.
    //
    // ⚠️ **Ο runtime `notFound()` του `page.tsx` ΔΕΝ κόβει τίποτα**: το `import`
    //    είναι στατικό, άρα το webpack χτίζει το δέντρο ούτως ή άλλως. Ο φρουρός
    //    της διαδρομής και ο φρουρός του bundle είναι **δύο** ερωτήσεις.
    const path = require('path');
    const fs = require('fs');

    // `enabled: true` ⇒ ΜΗΝ αντικαταστήσεις — το build ζήτησε ρητά αυτό το harness.
    const harnessStubs = [
      { dir: 'src/app/(bare)/test-harness/dxf-canvas', name: 'DxfCanvasHarness', enabled: false },
      { dir: 'src/app/(app)/test-harness/bim-3d', name: 'Bim3DHarness', enabled: false },
      // ⚠️ ADR-726 §13.5 — το κριτήριο Φ5 απαιτεί μέτρηση σε **production build**,
      //    οπότε αυτό το harness ΠΡΕΠΕΙ να επιβιώνει όταν ζητηθεί ρητά. Ο διακόπτης
      //    είναι ο **ίδιος** που διαβάζει το `isPerfHarnessRouteEnabled()`: δύο
      //    απαντήσεις στο «υπάρχει αυτή η σελίδα;» θα έδιναν σελίδα που αποδίδεται
      //    και component που επιστρέφει `null`.
      {
        dir: 'src/app/(app)/test-harness/dxf-perf',
        name: 'DxfPerfHarness',
        enabled: process.env.ENABLE_PERF_HARNESS === '1',
      },
    ];

    for (const harness of harnessStubs) {
      const harnessDir = path.resolve(__dirname, harness.dir);
      const harnessSrc = path.join(harnessDir, `${harness.name}.tsx`);
      const harnessStub = path.join(harnessDir, `${harness.name}.prod.ts`);

      // 🔑 Ο έλεγχος τρέχει **και όταν `enabled`**: μια μετακίνηση αρχείου πρέπει να
      //    καταγγέλλεται ανεξάρτητα από το αν εφαρμόζεται σήμερα το alias.
      for (const target of [harnessSrc, harnessStub]) {
        if (!fs.existsSync(target)) {
          throw new Error(
            `[TEST-HARNESS] Το alias του ${harness.name} δείχνει σε ανύπαρκτο αρχείο:\n` +
            `  ${target}\n` +
            `Αν το harness μετακινήθηκε, ενημέρωσε ΕΔΩ τη διαδρομή. Χωρίς αυτό το alias ` +
            `αστοχεί σιωπηλά και ολόκληρο το δέντρο του harness μπαίνει στο production bundle.`
          );
        }
      }

      if (!harness.enabled) config.resolve.alias[harnessSrc] = harnessStub;
    }

    // [COOLIFY] Sequential compilation to prevent OOM on VPS (8GB RAM).
    // Next.js spawns N workers (N = CPU count = 4 on Netcup VPS 1000 G12).
    // Each worker has its own V8 heap → 4 × ~2GB = ~8GB peak.
    // parallelism:1 → sequential → peak ~2-3GB, safe on 8GB+4GB swap.
    config.parallelism = 1;

    // [LOCAL-MEASUREMENT] Opt-in kill switch for the webpack FILESYSTEM cache
    // (ADR-726 Φ5, 2026-07-30). The pack cache for this project exceeds 11GB on
    // disk — a local `next build` on a nearly-full disk dies with ENOSPC while
    // WRITING CACHE, never reaching output. Set NEXT_DISABLE_FS_CACHE=1 to build
    // with the in-memory cache only (~2GB of .next instead of ~13GB; every build
    // is cold, ~25min). Unset ⇒ zero behaviour change (CI/Netcup unaffected).
    if (process.env.NEXT_DISABLE_FS_CACHE === '1') {
      config.cache = { type: 'memory' };
    }

    // [CI-OOM] Disable filesystem cache in CI — PackFileCache serializes large
    // strings (180KB+) and holds them in heap during build, adding ~1-2GB peak.
    // On CI runners (7GB RAM) the heap already hits 9GB live; cache pushes it over.
    if (process.env.CI) {
      config.cache = false;
    }

    // [CRITICAL] Disable module concatenation on server bundles to prevent
    // TDZ errors ("Cannot access 'f' before initialization").
    // Module concatenation inlines modules into a single scope, which can
    // reorder class/const declarations and cause TDZ violations in API routes.
    if (isServer) {
      config.optimization.concatenateModules = false;
    }

    // =========================================================================
    // [ADR-845 §6.2] `node:fs` ΕΞΩ ΑΠΟ ΤΟ ΠΑΚΕΤΟ ΤΟΥ ΠΕΡΙΗΓΗΤΗ — ΧΕΙΡΟΥΡΓΙΚΑ
    // =========================================================================
    //
    // 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (2026-09-09, δύο pushes κόκκινα, παραγωγή παγωμένη στις 06/09):
    //    `Module build failed: UnhandledSchemeError: Reading from "node:fs"`.
    //    Αλυσίδα: `@gltf-transform/core` → `gltf-memory-io` → `gltf-model-measure`
    //    → `publish-model-to-property` → `PublishModelDialog` → ο DXF viewer.
    //
    // 🔑 Ο viewer είναι **νόμιμα** στο πακέτο του περιηγητή (`/o/[workspace]/dxf/viewer`,
    //    `lazyRoutes`, `preloadRoutes`) — δεν είναι διαρροή harness, είναι το προϊόν.
    //    Και ο πελάτης **οφείλει** να μετρά τη γεωμετρία: η **κλειστή λογιστική** του
    //    ADR-845 §6.2.1 θέλει **δύο ανεξάρτητους** αριθμούς (πελάτης δηλώνει, διακομιστής
    //    ξαναμετρά· άγκυρα Α-6). Μεταφορά της μέτρησης στον διακομιστή θα «διόρθωνε» το
    //    build **καταστρέφοντας** τον έλεγχο — θα έμενε ένας αριθμός και μια ταυτολογία.
    //
    // ⇒ Άρα το `@gltf-transform/core` **μένει**. Αυτό που φεύγει είναι ο **νεκρός** του
    //   κλάδος: το `NodeIO`, που **ποτέ** δεν κατασκευάζεται εδώ (το `gltf-memory-io.ts`
    //   χρησιμοποιεί `PlatformIO` με `readURI` που πάντα πετά — και είναι ΑΣΦΑΛΕΙΑ, §6.1).
    //
    // ⚠️ **ΤΟ `resolve.fallback` ΠΑΡΑΚΑΤΩ ΔΕΝ ΤΟ ΠΙΑΝΕΙ** (και έχει ήδη `fs: false`):
    //    αιτήματα **με scheme** δεν περνούν από alias/fallback. **Ούτε** το
    //    `NormalModuleReplacementPlugin` τα πιάνει — μετρημένο, το callback καλείται και
    //    αγνοείται. Ο **μόνος** δρόμος είναι το `resolveForScheme`: το «πώς» και οι τρεις
    //    μετρημένες παραλλαγές ζουν στο `scripts/webpack/gltf-node-scheme-plugin.js`.
    //
    // ⚠️ **ΔΕΜΕΝΟ ΣΤΟ `context`, ΠΟΤΕ ΚΑΘΟΛΙΚΟ `/^node:/`**: ένας καθολικός
    //    αντικαταστάτης θα σιωπούσε **κάθε** μελλοντική διαρροή Node builtin στον
    //    πελάτη — το κλασικό «0 = κανείς δεν κοίταξε» (N.11 · N.12). Οπουδήποτε έξω
    //    από το `@gltf-transform`, το `node:fs` **οφείλει** να ρίχνει το build.
    //
    // ⚓ Άγκυρα: `scripts/__tests__/gltf-node-scheme-plugin.test.js` — **εκτελεί** webpack
    //    και ελέγχει **και τις δύο** κατευθύνσεις (επιτρέπεται εδώ / σκάει αλλού).
    if (!isServer) {
      const {
        GltfNodeSchemePlugin,
      } = require('./scripts/webpack/gltf-node-scheme-plugin');

      config.plugins.push(new GltfNodeSchemePlugin());
    }

    // [ENTERPRISE] pdf.js configuration for Next.js (production)
    // Fixes ESM compatibility issues with pdfjs-dist

    // Resolve fallbacks for browser-only modules (needed by pdfjs-dist)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      fs: false,
      http: false,
      https: false,
      url: false,
    };

    // [ENTERPRISE] Fix ESM compatibility for .mjs files (pdfjs-dist)
    // This prevents "Object.defineProperty called on non-object" error
    if (!isServer) {
      config.module.rules.push({
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto',
      });
    }

    // [ENTERPRISE] Copy PDF worker to public folder
    // =========================================================================
    // PDF files exist in public/ (committed to git) for development
    // CopyPlugin ensures latest version from node_modules for production builds
    // Pattern: Vercel, Google Cloud Build - hermetic production builds
    if (!isServer) {
      const path = require('path');
      const CopyPlugin = require('copy-webpack-plugin');

      // [ENTERPRISE] Copy pdf.js files to public
      // Uses the version from react-pdf's pdfjs-dist dependency
      const pdfjsDistPath = path.dirname(require.resolve('pdfjs-dist/package.json'));

      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: path.join(pdfjsDistPath, 'build/pdf.min.mjs'),
              to: path.join(__dirname, 'public/pdf.min.mjs'),
            },
            {
              from: path.join(pdfjsDistPath, 'build/pdf.worker.min.mjs'),
              to: path.join(__dirname, 'public/pdf.worker.min.mjs'),
            },
            // [ADR-344 Phase 8] Hunspell dictionaries (el_GR MPL-1.1 + en_US MIT).
            // The spell-check Web Worker fetches these at runtime via
            // /static/dxf/dictionaries/{lang}/*. Shipped as data assets,
            // not bundled into JS chunks — dictionary load stays lazy and out of
            // the initial bundle. Note: dictionary-en npm is NOT imported in the
            // worker (node:fs/promises not available in browser/worker context);
            // the .aff/.dic files are served statically instead.
            // NOTE: public/_next/ is forbidden by Next.js (conflicts with /_next route).
            {
              from: path.join(
                __dirname,
                'src/subapps/dxf-viewer/text-engine/spell/dictionaries/el_GR',
              ),
              to: path.join(__dirname, 'public/static/dxf/dictionaries/el_GR'),
              filter: (resourcePath) =>
                resourcePath.endsWith('.aff') || resourcePath.endsWith('.dic'),
            },
            {
              from: path.join(
                __dirname,
                'src/subapps/dxf-viewer/text-engine/spell/dictionaries/en_US',
              ),
              to: path.join(__dirname, 'public/static/dxf/dictionaries/en_US'),
              filter: (resourcePath) =>
                resourcePath.endsWith('.aff') || resourcePath.endsWith('.dic'),
            },
          ],
        })
      );
    }

    // Tree shaking — applies to both client and server
    if (!dev) {
      config.optimization.usedExports = true;
    }

    // Minification optimizations — applies to both client and server
    if (!dev) {
      config.optimization.minimizer = config.optimization.minimizer.map(minimizer => {
        if (minimizer.constructor.name === 'TerserPlugin') {
          minimizer.options.terserOptions = {
            ...minimizer.options.terserOptions,
            compress: {
              ...minimizer.options.terserOptions.compress,
              drop_console: true, // Remove console.log από production
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info', 'console.debug'],
            },
            mangle: {
              safari10: true,
            },
          };
        }
        return minimizer;
      });
    }

    // [ADR-863 / CHECK 3.84] ΑΠΟΓΡΑΦΗ ΕΠΙΦΑΝΕΙΩΝ ΔΙΑΝΟΜΗΣ — ΜΟΝΟ client, ΜΟΝΟ όταν ζητηθεί.
    //
    // «Ποια npm πακέτα φτάνουν ΠΡΑΓΜΑΤΙΚΑ στον browser;» Ό,τι κατεβαίνει είναι ΑΝΤΙΓΡΑΦΟ ⇒ η
    // άδεια απαιτεί το κείμενό της να ταξιδέψει μαζί (ADR-863). Μετρημένο 2026-09-16: κανένα
    // υπάρχον εργαλείο δεν το απαντά — ο bundle-analyzer μετρά ΜΟΝΟ bytes, ο dependency-cruiser
    // αποκλείει ρητά το node_modules, το knip ανακατεύει client+server στον ίδιο γράφο.
    //
    // ⚠️ ΞΕΧΩΡΙΣΤΗ ΜΕΤΑΒΛΗΤΗ ΑΠΟ ΤΟ `ANALYZE`, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ: εκείνο τρέχει
    //    `analyzerMode: 'server'`, δηλαδή ανοίγει διαδραστικό παράθυρο και ΔΕΝ αφήνει κανένα
    //    αρχείο — άχρηστο για script, και θα κρέμαγε το CI περιμένοντας άνθρωπο.
    //
    // ⚠️ `!isServer`: η webpack() καλείται ΔΥΟ φορές. Χωρίς αυτόν τον φρουρό θα μετρούσαμε το
    //    server bundle και θα δηλώναμε «φτάνουν στον browser» πακέτα που δεν φτάνουν ποτέ.
    //
    // Καμία νέα εξάρτηση (το webpack-bundle-analyzer είναι ήδη εδώ), κανένα δεύτερο build:
    // προσκολλάται στο build που ΗΔΗ τρέχει στο `.github/workflows/bundle-ratchet.yml`.
    if (process.env.THIRD_PARTY_STATS === 'true' && !isServer) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'disabled',
          generateStatsFile: true,
          statsFilename: require('path').join(__dirname, '.next', 'third-party-stats.json'),
          // Μόνο ό,τι χρειάζεται η απογραφή: διαδρομές modules. Το `source: false` κρατά το
          // αρχείο σε δεκάδες MB αντί για εκατοντάδες.
          statsOptions: { modules: true, chunks: true, source: false, reasons: false, assets: false },
        })
      );
    }

    // [ENTERPRISE] Bundle analyzer for production analysis
    // Usage: ANALYZE=true pnpm build
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'server',
          openAnalyzer: true,
        })
      );
    }

    return config;
  },

  // [IMAGE] IMAGE OPTIMIZATION
  images: {
    // Domains για external images
    domains: ['images.unsplash.com', 'via.placeholder.com'],
    // Image formats
    formats: ['image/avif', 'image/webp'],
    // Quality settings
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Enable optimization
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // [COMPRESS] COMPRESSION
  compress: true,

  // [CACHE] HEADERS για caching — Edge Request Optimization
  // DEV: no-cache headers ώστε ο browser να μην κρατάει παλιά modules
  // PROD: aggressive caching για performance
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';

    // Development: prevent ALL browser caching
    if (isDev) {
      return [
        {
          source: '/(.*)',
          headers: [
            { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
            { key: 'Pragma', value: 'no-cache' },
            { key: 'Expires', value: '0' },
          ],
        },
      ];
    }

    // Production: optimized caching
    //
    // 🔴 ADR-860 §Ε2 — ΚΑΝΕΝΑΣ ΚΑΝΟΝΑΣ `immutable` ΓΙΑ `/_next/static` Ή `*.js` / `*.css`.
    //
    // Υπήρχαν τρεις (`/_next/static/(.*)`, `/(.*).js`, `/(.*).css`) και ήταν **επιβλαβείς**:
    // οι κανόνες `headers()` ταιριάζουν με **διαδρομή**, πριν και ανεξάρτητα από το status
    // (`resolve-routes.js:508` → `router-server.js:329`). Ένα chunk που **δεν υπάρχει** έπαιρνε
    // κι αυτό `immutable` για ένα χρόνο — μετρημένο στην παραγωγή 2026-09-14: `200` + HTML +
    // `max-age=31536000, immutable`. Ο browser κρατούσε την αποτυχία για ένα χρόνο.
    //
    // ✅ Για τα αρχεία που **υπάρχουν** δεν χάνεται τίποτα: το ίδιο το Next βάζει
    // `public, max-age=31536000, immutable` **μόνο** σε πραγματικό `nextStaticFolder`
    // (`router-server.js:366`). Το «δεν υπάρχει» το χειρίζεται το `afterFiles` του `rewrites()`.
    //
    // ⛔ ΜΗΝ τους επαναφέρεις «για απόδοση». Άγκυρα: `scripts/__tests__/static-asset-caching-contract.test.js`.
    return [
      // ── Service worker: always revalidate ──
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      // ── Public assets: fonts (1 year), images (1 week) ──
      {
        source: '/fonts/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/images/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
        ],
      },
      // ── PDF worker: rarely changes (1 month) ──
      {
        source: '/pdf.worker.min.mjs',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' },
        ],
      },
      {
        source: '/pdf.min.mjs',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' },
        ],
      },
      // ── robots.txt: revalidate daily ──
      {
        source: '/robots.txt',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ];
  },

  // [PWA] PWA MANIFEST + [ADR-738] OAuth discovery
  //
  // 🔑 ADR-860 §Ε2 — ΣΧΗΜΑ `{ beforeFiles, afterFiles, fallback }` ΚΑΙ ΟΧΙ ΣΚΕΤΟΣ ΠΙΝΑΚΑΣ.
  // Ο σκέτος πίνακας κανονικοποιείται **ολόκληρος** σε `afterFiles` (`load-custom-routes.js:412`),
  // άρα οι υπάρχοντες κανόνες συμπεριφέρονται **ταυτόσημα**. Το σχήμα χρειάζεται μόνο για να
  // είναι ρητή η θέση του κανόνα static-miss.
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: '/manifest.json',
          destination: '/api/manifest',
        },

        // ── ADR-738: OAuth 2.1 / MCP discovery ──────────────────────────────
        // Rewrite αντί για φάκελο `src/app/.well-known/`: οι διαδρομές είναι
        // υποχρεωτικές από RFC 9728 / RFC 8414, και δεν εξαρτώνται από το πώς ο
        // App Router χειρίζεται φακέλους που ξεκινούν με τελεία.
        //
        // ⚠️ Το PRM σερβίρεται σε ΔΥΟ διαδρομές επίτηδες. Το πρότυπο ορίζει ότι
        // ο client δοκιμάζει ΠΡΩΤΑ την εκδοχή με path insertion
        // (`/.well-known/oauth-protected-resource/api/mcp`) και μόνο αν αποτύχει
        // πέφτει στη ρίζα. Σερβίροντας μόνο τη ρίζα θα δουλεύαμε — μετά από ένα
        // περιττό 404 σε κάθε σύνδεση.
        {
          source: '/.well-known/oauth-protected-resource',
          destination: '/api/oauth/metadata/protected-resource',
        },
        {
          source: '/.well-known/oauth-protected-resource/api/mcp',
          destination: '/api/oauth/metadata/protected-resource',
        },
        {
          source: '/.well-known/oauth-authorization-server',
          destination: '/api/oauth/metadata/authorization-server',
        },

        // ── ADR-863 Φ3: SBOM σε well-known διεύθυνση (RFC 9472) ─────────────
        // Το IETF έχει καταχωρήσει **μόνιμα** το suffix `sbom` (RFC 9472, κατά
        // RFC 8615), και τα CISA 2026 minimum elements ζητούν ρητά
        // `Component License`. Κανείς από Figma/Slack/Chromium/VS Code/Graphisoft
        // δεν το δημοσιεύει — όλοι σταματούν στο κείμενο για ανθρώπους.
        //
        // ⚠️ Rewrite και ΟΧΙ φάκελος `src/app/.well-known/`, ίδιος λόγος με τα
        //    τρία από πάνω: η διαδρομή είναι υποχρέωση προτύπου και δεν
        //    επιτρέπεται να εξαρτάται από το πώς ο App Router χειρίζεται
        //    φακέλους που ξεκινούν με τελεία.
        // ⚠️ Ο προορισμός είναι ΣΤΑΤΙΚΟ αρχείο του `public/` (το γράφει το
        //    `npm run third-party-notices:generate`, το αντιγράφει το Dockerfile
        //    με `COPY public ./public`) — καμία διαδρομή API, κανένα νέο σύνορο.
        {
          source: '/.well-known/sbom',
          destination: '/third-party/sbom.json',
        },

        // ── ADR-860 §Ε2: ένα `/_next/static/*` που ΔΕΝ υπάρχει → αληθινό 404, ποτέ cache ──
        // `afterFiles` = ΜΕΤΑ τον έλεγχο αρχείων (τα υπαρκτά σερβίρονται κανονικά) και ΠΡΙΝ τα
        // dynamic routes (δεν φτάνει στο catch-all `(app)/[...unprefixed]`, που με το
        // `(app)/loading.tsx` κλείδωνε την απάντηση σε 200). Το `?asset=` μεταφέρει το αρχικό
        // μονοπάτι στο log. ⛔ ΜΗΝ το μετακινήσεις σε `beforeFiles`: θα έκλεβε τα υπαρκτά.
        {
          source: '/_next/static/:path*',
          destination: '/api/static-asset-miss?asset=:path*',
        },
      ],
      fallback: [],
    };
  },
};

// ADR-259D: Wrap with Sentry for error monitoring + source map upload
// Source map upload requires SENTRY_ORG + SENTRY_PROJECT env vars.
// Without them (e.g. self-hosted Coolify deploy), skip upload to avoid exit(255).
const disableSentryWebpack = process.env.DISABLE_SENTRY_WEBPACK === 'true' ||
  !process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT;

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
  telemetry: false,
  disableSourceMapUpload: disableSentryWebpack,
  disableServerWebpackPlugin: disableSentryWebpack,
  disableClientWebpackPlugin: disableSentryWebpack,
});