import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

/**
 * 🔑 **ΤΑ SPEC ΠΟΥ ΕΧΟΥΝ ΔΙΚΟ ΤΟΥΣ PROJECT — ΜΙΑ ΦΟΡΑ, ΚΑΙ ΤΑ ΔΙΑΒΑΖΟΥΝ ΔΥΟ.**
 *
 * Ένα spec με **δικό του** project το έχει επειδή χρειάζεται συνθήκες που τα γενικά projects
 * **δεν** δίνουν: swiftshader για WebGL, δικό του `timeout`, δικό του κάδρο, δικά του golden.
 * Τα γενικά όμως (`chromium` · `firefox` · `webkit` · `Mobile *`) **δεν έχουν `testMatch`**,
 * άρα σηκώνουν **ΚΑΘΕ** spec — και τα τρία παρακάτω **μαζί**.
 *
 * 🔴 **ΜΕΤΡΗΜΕΝΟ (2026-09-09), ΟΧΙ ΕΙΚΑΣΙΑ**: `playwright test camera-motion --list` έδινε
 * **6 projects × 6 tests = 36**, όπου **30** έτρεχαν χωρίς τις σημαίες που κάνουν τη μέτρηση
 * δυνατή. Ίδιο σχήμα μετρήθηκε και στο `bim-3d-visual-regression` *(6 projects για 1 test)* —
 * δηλαδή **κανόνας του repo, όχι εξαίρεση**. Το κόστος δεν είναι μόνο runner-λεπτά: είναι
 * **κόκκινα που δεν σημαίνουν τίποτα**, δηλαδή ο σιγουρότερος δρόμος για να μάθει ο αναγνώστης
 * να αγνοεί τη σουίτα.
 *
 * ⚠️ **Η ΙΔΙΑ ΣΤΑΘΕΡΑ ΤΡΟΦΟΔΟΤΕΙ ΚΑΙ ΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ**, και αυτός είναι όλος ο λόγος που
 * υπάρχει: το «αυτό το project **ΚΑΤΕΧΕΙ** το spec» (`testMatch`) και το «τα γενικά το
 * **ΠΡΟΣΠΕΡΝΟΥΝ**» (`testIgnore`) γράφονταν αλλιώς **δύο φορές** — και θα απέκλιναν στην πρώτη
 * μετονομασία, αφήνοντας ένα spec **ορφανό** ή **διπλό**, σιωπηλά (ADR-749).
 */
const DEDICATED_SPECS = {
  visualDxf: '**/dxf-viewer/e2e/dxf-visual-regression.spec.ts',
  visualBim3d: '**/dxf-viewer/e2e/bim-3d-visual-regression.spec.ts',
  cameraMotion: '**/test-harness/camera-motion/camera-motion.e2e.spec.ts',
  addressFieldWidth: '**/test-harness/address-field-width/address-field-width.e2e.spec.ts',
  publicReflow: '**/public-site/reflow/public-reflow.e2e.spec.ts',
} as const;

/** Ό,τι ανήκει σε ειδικό project, ΔΕΝ ανήκει στα γενικά. Παράγεται — ποτέ δεύτερη λίστα. */
const GENERIC_TEST_IGNORE = Object.values(DEDICATED_SPECS);

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './src',
  testMatch: [
    '**/e2e/**/*.spec.ts',
    '**/__tests__/e2e/**/*.spec.ts',
    '**/*.e2e.spec.ts',
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html'],
    ['junit', { outputFile: 'reports/junit/playwright.xml' }]
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: GENERIC_TEST_IGNORE,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: GENERIC_TEST_IGNORE,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: GENERIC_TEST_IGNORE,
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      testIgnore: GENERIC_TEST_IGNORE,
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      testIgnore: GENERIC_TEST_IGNORE,
    },
    {
      name: 'visual-dxf',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        navigationTimeout: 90000,
        actionTimeout: 30000,
      },
      // ⚠️ Τα {projectName}/{platform} είναι ΥΠΟΧΡΕΩΤΙΚΑ και είναι το DEFAULT του Playwright
      // ({arg}-{projectName}-{platform}{ext}). Μέχρι 08/08 έλειπαν και τα δύο: τα projects
      // firefox/webkit/Mobile* δεν έχουν testMatch, άρα έτρεχαν κι αυτά τα 43 visual tests και
      // συγκρίνονταν με τα ΙΔΙΑ 40 golden (chromium/Windows) ⇒ 172 βέβαιες αποτυχίες, και σε
      // Linux runner αποτυγχάνει ακόμα και το chromium. Φρουρείται από CHECK 3.46 (ADR-775).
      //
      // ✅ 09/09: η ΡΙΖΑ εκείνου του περιστατικού έκλεισε — τα γενικά projects φέρουν πλέον
      // `testIgnore: GENERIC_TEST_IGNORE`, οπότε δεν σηκώνουν ΚΑΘΟΛΟΥ spec που ανήκει σε
      // ειδικό project. Το ρητό πρότυπο μένει: είναι η ΔΕΥΤΕΡΗ γραμμή άμυνας, και μόνο αυτή
      // φυλάγεται από πύλη. Μια μέρα που κάποιος δώσει testMatch σε γενικό project, η ανοχή
      // αυτή θα είναι ξανά ο λόγος που δεν χάθηκαν golden.
      snapshotPathTemplate:
        'src/subapps/dxf-viewer/e2e/__snapshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}',
      testMatch: [DEDICATED_SPECS.visualDxf],
      timeout: 120000,
    },
    {
      // ADR-550 Φ2 — 3D BIM golden-image harness. Needs WebGL; bundled chromium
      // renders it via swiftshader (software) so the screenshot works headless.
      name: 'visual-bim-3d',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        navigationTimeout: 120000,
        actionTimeout: 30000,
        launchOptions: {
          args: [
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
          ],
        },
      },
      // βλ. σχόλιο στο visual-dxf — ίδιος λόγος, ίδια πύλη (CHECK 3.46).
      snapshotPathTemplate:
        'src/subapps/dxf-viewer/e2e/__snapshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}',
      testMatch: [DEDICATED_SPECS.visualBim3d],
      timeout: 180000,
    },
    {
      /*
        ADR-847 §9 — η πύλη κίνησης κάμερας (CHECK 3.77). ΔΙΚΟ της project και όχι σκέτο
        `chromium`, για ΔΥΟ λόγους που κανένας δεν είναι αισθητικός:

        1. 🔴 **Το MapLibre ΕΙΝΑΙ WebGL.** Σε runner χωρίς GPU ο Chrome πέφτει στον SwiftShader,
           και **από το Chrome 130** η πτώση αυτή είναι υπό κατάργηση: χωρίς το _ρητό_
           `--enable-unsafe-swiftshader` το WebGL context προειδοποιεί σήμερα και χάνεται
           αύριο (Chromium docs/gpu/swiftshader.md). Χάρτης που δεν κτίζεται = πύλη που
           κοκκινίζει για λόγο άσχετο με την κίνηση — δηλαδή πύλη που δεν λέει τίποτα.
           Έχει πληρωθεί ήδη μία φορά εδώ: δες `visual-bim-3d` παραπάνω, ίδια σημαίες.

        2. ⚠️ **Το `timeout` του project είναι ΚΑΙ του `beforeAll`.** Η μέτρηση γίνεται ΜΙΑ φορά
           στο `beforeAll` (πέντε πτήσεις, ~1.000 καρέ) και με λογισμική απόδοση το κάθε
           καρέ κοστίζει πολλαπλάσια. Με τα προεπιλεγμένα 30s η πύλη θα κοκκίνιζε στο
           CI για **ταχύτητα μηχανής**, τη στιγμή που το παγωμένο ρολόι φροντίζει ώστε οι
           αριθμοί να ΜΗΝ εξαρτώνται από αυτήν. Αργό ≠ λάθος.

        ⚠️ ΚΑΜΙΑ `snapshotPathTemplate`: η πύλη κρίνει **αριθμούς**, όχι εικόνες — άρα δεν
        υπάρχει golden ούτε εξάρτηση από πλατφόρμα (CHECK 3.46 ομάδα Β: `golden-default`).
      */
      name: 'camera-motion',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
        navigationTimeout: 120000,
        launchOptions: {
          args: [
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
          ],
        },
      },
      testMatch: [DEDICATED_SPECS.cameraMotion],
      timeout: 300000,
    },
    {
      /*
        ADR-332 D27 Ζ7 — η πύλη ωφέλιμου πλάτους. ΔΙΚΟ της project, για λόγους που **δεν**
        είναι αισθητικοί:

        1. 🔴 **ΤΟ ΚΑΔΡΟ ΕΙΝΑΙ Η ΜΕΤΡΗΣΗ.** Το harness δηλώνει τα πλάτη του **το ίδιο**
           (`WIDTH_CASES`), αλλά ένα πολύ στενό viewport θα έβαζε τα δοχεία σε
           `max-inline-size: 100%` και θα μετρούσε **άλλα** πλάτη από τα δηλωμένα. Στα
           γενικά projects το `Mobile Chrome` (393px) θα το έκανε **σίγουρα** — δηλαδή η
           πύλη θα κοκκίνιζε για κάδρο, όχι για ελάττωμα.

        2. ⚠️ **Το `deviceScaleFactor` αλλάζει το `ch`.** Η κρίση είναι σε **χαρακτήρες**,
           που παράγονται από `measureText('0')` στη γραμματοσειρά του πεδίου. Σταθερό 1
           ⇒ σταθερή μονάδα.

        ⚠️ ΚΑΜΙΑ `snapshotPathTemplate`: η πύλη κρίνει **αριθμούς**, όχι εικόνες — άρα δεν
        υπάρχει golden ούτε εξάρτηση από πλατφόρμα (CHECK 3.46 ομάδα Β: `golden-default`).
        ⚠️ Καμία σημαία WebGL: δεν υπάρχει χάρτης εδώ, μόνο DOM.
      */
      name: 'address-field-width',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
        navigationTimeout: 120000,
        /*
          🔴 **ΕΛΛΗΝΙΚΑ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΠΡΟΤΙΜΗΣΗ — ΕΙΝΑΙ ΤΟ ΧΕΙΡΟΤΕΡΟ ΣΕΝΑΡΙΟ.**

          Το πλάτος που κρίνεται είναι ό,τι **περισσεύει** αφού πάρει τον χώρο του το σήμα
          κατάστασης — άρα εξαρτάται από το **μήκος του κειμένου** του σήματος, δηλαδή από
          τη γλώσσα. Ελληνικά «Δεν συμπληρώθηκε» = **16** χαρακτήρες· αγγλικά «Not provided»
          = 12. Μέτρηση στα αγγλικά θα ήταν πράσινη και η **ελληνική** παραγωγή θα έσπαγε.

          ⚠️ Το γενικό `use.locale` είναι `'en-US'` (γρ. 59) και ισχύει για όλα τα άλλα
          projects· εδώ παρακάμπτεται **επίτηδες**. Η εφαρμογή είναι ελληνόγλωσση.

          🔴 **ΜΕΤΡΗΜΕΝΟ**: με `en-US` η πρώτη εκτέλεση της πύλης διάβασε ωμό κλειδί
          (`editor.field.badge.notProvided`, **30** χαρακτήρες) — δηλαδή μετρούσε πλάτος
          που **κανείς άνθρωπος δεν βλέπει**, και μάλιστα ψευδώς αυστηρό. Το harness πλέον
          αρνείται να δημοσιεύσει μέτρηση με ανεπίλυτο κλειδί, αλλά η σωστή γλώσσα είναι
          η **πρώτη** άμυνα, όχι η δεύτερη.
        */
        locale: 'el-GR',
      },
      testMatch: [DEDICATED_SPECS.addressFieldWidth],
      timeout: 300000,
    },
    {
      /*
        📱 CHECK 3.94 (ADR-797 §Φ.Ρ) — «χωράει κάθε στοιχείο στην οθόνη;» στις ΠΡΑΓΜΑΤΙΚΕΣ
        δημόσιες σελίδες, σε 320–1024 px, σε δύο θέματα. Το πλάτος το ορίζει το ίδιο το spec
        (`setViewportSize`) ανά περίπτωση· εδώ μόνο ό,τι είναι κοινό.

        🔑 `el-GR`, για τον ίδιο λόγο με το 3.82: το πλάτος εξαρτάται από το ΜΗΚΟΣ του κειμένου,
        και τα ελληνικά είναι το χειρότερο σενάριο («Επαγγελματίες» 13 χαρακτήρες έναντι
        «Professionals»). Μέτρηση στα αγγλικά θα ήταν πράσινη πάνω στην ελληνική παραγωγή.
        ⚠️ Καμία `snapshotPathTemplate`: κρίνει ΑΡΙΘΜΟΥΣ (ορθογώνια), όχι εικόνες.
      */
      name: 'public-reflow',
      use: {
        ...devices['Desktop Chrome'],
        deviceScaleFactor: 1,
        navigationTimeout: 120000,
        locale: 'el-GR',
      },
      testMatch: [DEDICATED_SPECS.publicReflow],
      timeout: 180000,
    },
  ],
  webServer: {
    command: 'npm run dev:fast',
    /*
      ⚠️ Η ΔΙΕΥΘΥΝΣΗ ΕΤΟΙΜΟΤΗΤΑΣ ΕΙΝΑΙ ΠΑΡΑΚΑΜΨΙΜΗ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΚΑΠΡΙΤΣΙΟ.
      Η προεπιλογή μένει **ακριβώς** ό,τι ήταν (`/test-harness/dxf-canvas`), αλλά μια
      σουίτα που ΔΕΝ αγγίζει τον DXF viewer πληρώνει αλλιώς την **κρύα μεταγλώττισή** του
      μόνο και μόνο για να απαντήσει «ο server σηκώθηκε;» — και, με
      `reuseExistingServer`, ένας server που σηκώθηκε αλλού μοιάζει **κάτω** όσο η
      διαδρομή αυτή μεταγλωττίζεται ακόμη, οπότε το Playwright ξεκινά **δεύτερο**.
      Το CHECK 3.77 (`camera-motion-gate.yml`) προθερμαίνει τη ΔΙΚΗ του διαδρομή με
      πραγματικό user-agent και τη δηλώνει εδώ — μηδέν διπλός server, μηδέν άσχετη
      μεταγλώττιση, μηδέν εξάρτηση από εσωτερικά του Playwright.
    */
    url: process.env.PLAYWRIGHT_WEB_SERVER_URL || `${baseURL}/test-harness/dxf-canvas`,
    reuseExistingServer: true,
    timeout: 600 * 1000,
    stderr: 'pipe',
    stdout: 'pipe',
  },
});

