/**
 * Ο DRIVER του Στρώματος 2β (ADR-770 §13) — ανοίγει το harness και μαζεύει τα δύο
 * στιγμιότυπα. **Μόνο μεταφορά**: καμία κρίση, καμία baseline, κανένα κατώφλι.
 *
 * Χωριστά από την πύλη ώστε η πύλη να είναι **unit-testable χωρίς browser** (η μηχανή
 * παίρνει στιγμιότυπα ως δεδομένα). Το ADR-598 έμαθε το αντίστροφο με κόστος: μια πύλη
 * που δεν μπορεί να δοκιμαστεί χωρίς το βαρύ εργαλείο, δεν δοκιμάζεται.
 *
 * 🔴 ΤΡΙΑ ΜΕΤΡΗΜΕΝΑ ΕΜΠΟΔΙΑ, κωδικοποιημένα εδώ ώστε να μη ξαναβρεθούν:
 *
 *  1. **ΥΠΟΧΡΕΩΤΙΚΟ `userAgent` override.** Το `src/middleware.ts` έχει το
 *     `'headlesschrome'` στα `BLOCKED_BOT_PATTERNS` και επιστρέφει **403 χωρίς σώμα**,
 *     σε **κάθε** περιβάλλον (δεν υπάρχει bypass για development). Αποδείχθηκε με
 *     εκτέλεση (2026-08-07): προεπιλογή Playwright ⇒ `ERR_HTTP_RESPONSE_CODE_FAILURE`·
 *     με override ⇒ `200`. Χωρίς αυτή τη γραμμή η πύλη θα ανέφερε **«0 παραβιάσεις»**
 *     για κάθε διαδρομή — δηλαδή θα γεννούσε μόνη της την επόμενη εμφάνιση του
 *     «0 = κανείς δεν κοίταξε».
 *     🔴 **ΔΙΟΡΘΩΣΗ 08/08 (ADR-775 §2)**: εδώ έγραφε «*το ίδιο ισχύει για τα 7 υπάρχοντα
 *     projects — είναι δομικά σπασμένα*». **ΨΕΥΔΕΣ, μετρημένο: 0/7.** Τα device
 *     descriptors του Playwright **περιέχουν** `userAgent`, οπότε κάθε
 *     `...devices['Desktop Chrome']` στέλνει ήδη πραγματικό Chrome UA. Η διάγνωση ισχύει
 *     **μόνο εδώ**, επειδή αυτός ο driver καλεί `newContext()` **χωρίς** descriptor.
 *     Φρουρείται πλέον από το **CHECK 3.46**, που κρίνει και αυτόν τον UA.
 *
 *  2. **Οι browsers του Playwright μπορεί να λείπουν.** Στο μηχάνημα ανάπτυξης δεν
 *     υπάρχει καν ο φάκελος `ms-playwright` (μετρημένο) — και **κανένα** workflow δεν
 *     τρέχει `playwright install`. Δοκιμάζεται πρώτα το bundled chromium (η μόνη
 *     επιλογή στο CI) και μετά ο **εγκατεστημένος** Chrome (`channel`), με ρητό μήνυμα
 *     αν αποτύχουν και τα δύο — ποτέ σιωπηλή παράλειψη.
 *
 *  3. **Ο turbopack θέλει 60–190s για κρύα διαδρομή** (μετρημένο σε 20 διαδρομές).
 *     Γι' αυτό `waitUntil: 'commit'` + μεγάλα χρονικά όρια: το `domcontentloaded` με
 *     90s απέτυχε σε 3 από 6 διαδρομές του πιλότου.
 *
 * @module scripts/lib/contrast/matrix-snapshot
 */

'use strict';

const HARNESS_PATH = '/test-harness/contrast-matrix';

/**
 * Πραγματικός UA του Chrome — βλ. εμπόδιο 1. **ΜΗΝ τον αφαιρέσεις.**
 *
 * ⚠️ Χρησιμοποιείται **μόνο** αν λείπει το device descriptor. Η αυθεντία είναι το
 * `devices['Desktop Chrome'].userAgent` της **εγκατεστημένης** βιβλιοθήκης — μια χειρόγραφη
 * σταθερά είναι δεύτερη αλήθεια που **ήδη είχε αποκλίνει**: εδώ έγραφε `Chrome/140.0.0.0`
 * ενώ το playwright 1.57 δίνει `Chrome/143.0.7499.4` (ADR-775 §2).
 */
const FALLBACK_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
  + 'Chrome/143.0.7499.4 Safari/537.36';

/** Ο UA που ΔΕΝ μπλοκάρεται, από τη βιβλιοθήκη όποτε υπάρχει. */
function realChromeUserAgent(devices) {
  const descriptor = devices && devices['Desktop Chrome'];
  return (descriptor && typeof descriptor.userAgent === 'string')
    ? descriptor.userAgent
    : FALLBACK_CHROME_UA;
}

const NAV_TIMEOUT_MS = 300_000;

function baseUrl() {
  return process.env.RUNTIME_CONTRAST_URL || 'http://localhost:3000';
}

/**
 * Ξεκίνα έναν browser. Bundled chromium πρώτα (CI), εγκατεστημένος Chrome μετά (τοπικά).
 * Και οι δύο απόπειρες αναφέρονται στο σφάλμα — μια πύλη που δεν μπορεί να μετρήσει
 * πρέπει να λέει **γιατί**.
 */
async function launchBrowser(chromium) {
  const attempts = [];
  for (const opts of [{ headless: true }, { headless: true, channel: 'chrome' }]) {
    try {
      return await chromium.launch(opts);
    } catch (e) {
      attempts.push(`${opts.channel || 'bundled'}: ${e.message.split('\n')[0]}`);
    }
  }
  throw new Error(
    'δεν ξεκίνησε browser.\n   ' + attempts.join('\n   ')
    + '\n   Διόρθωση: npx playwright install chromium   (ή εγκατέστησε τον Chrome)',
  );
}

/**
 * Μάζεψε τα δύο στιγμιότυπα (φωτεινό + σκοτεινό) από **μία** φόρτωση της σελίδας.
 *
 * Μία φόρτωση επίτηδες: το θέμα επιβάλλεται και **επαληθεύεται** μέσα στη σελίδα, οπότε
 * δεν υπάρχει race να περιμένουμε. Δύο ξεχωριστές φορτώσεις θα επανέφεραν το ίδιο race
 * που κατέγραψε η μέτρηση των διαδρομών (17 σκοτεινά / 2 φωτεινά / 1 άγνωστο).
 *
 * @returns {Promise<{light:object, dark:object, meta:object}>}
 */
async function collectSnapshots({ chromium } = {}) {
  // eslint-disable-next-line global-require -- προαιρετική εξάρτηση: το module πρέπει να
  // φορτώνεται (και να δοκιμάζεται) χωρίς playwright εγκατεστημένο.
  // eslint-disable-next-line global-require
  const lib = chromium ? { chromium } : require('playwright');
  const pw = lib.chromium;
  const url = baseUrl() + HARNESS_PATH;
  const browser = await launchBrowser(pw);
  try {
    const context = await browser.newContext({
      userAgent: realChromeUserAgent(lib.devices),
      viewport: { width: 1440, height: 900 },
      colorScheme: 'light',
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)));

    const response = await page.goto(url, { waitUntil: 'commit', timeout: NAV_TIMEOUT_MS });
    const status = response ? response.status() : null;
    if (status !== 200) {
      throw new Error(
        `το harness απάντησε ${status} στο ${url}.\n`
        + '   403 σημαίνει ότι το middleware μπλόκαρε τον user-agent· 404 ότι η διαδρομή\n'
        + '   είναι απενεργοποιημένη (isTestHarnessRouteEnabled ⇒ production build).',
      );
    }
    await page.waitForSelector('[data-contrast-matrix-ready="true"]', { timeout: NAV_TIMEOUT_MS });

    const out = {};
    for (const theme of ['light', 'dark']) {
      // eslint-disable-next-line no-await-in-loop -- σειριακά επίτηδες: τα δύο θέματα
      // μοιράζονται το ΙΔΙΟ documentElement, οπότε παράλληλη ανάγνωση θα ήταν race.
      out[theme] = await page.evaluate((t) => window.__contrastMatrix(t), theme);
    }
    if (pageErrors.length) {
      throw new Error(`σφάλματα σελίδας στο harness: ${pageErrors.join(' | ')}`);
    }
    return { ...out, meta: { url, collectedFrom: HARNESS_PATH } };
  } finally {
    await browser.close();
  }
}

module.exports = {
  collectSnapshots,
  launchBrowser,
  baseUrl,
  HARNESS_PATH,
  realChromeUserAgent,
  FALLBACK_CHROME_UA,
  NAV_TIMEOUT_MS,
};
