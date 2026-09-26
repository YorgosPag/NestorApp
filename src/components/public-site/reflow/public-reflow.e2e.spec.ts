/**
 * **CHECK 3.94 — Πύλη αναδιάταξης δημόσιων σελίδων** (ADR-797 §Φ.Ρ · WCAG 2.2 SC 1.4.10).
 *
 * «**Χωράει κάθε στοιχείο στην οθόνη** — ή κάτι κόβεται σιωπηλά στη δεξιά άκρη;»
 *
 * 🔴 **ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (2026-09-25, iPhone 12 Pro 390 px)**: η αρχική έκοβε **πέντε** μπλοκ —
 * κεφαλίδα ως τα 436 px (το 🌐 μισό, θέμα/λογαριασμός εκτός οθόνης), ήρωας · πόρτες ·
 * «Οι χώροι μου» ως τα 422, «κάλυψη» ως τα 398. **Κανένα jest δεν μπορούσε να το δει** (το jsdom
 * δεν έχει διάταξη) και **ούτε η κύλιση**: ο καθολικός `overflow-x: clip` το έκρυβε, οπότε
 * `scrollWidth` = 390 = «όλα καλά». Δύο αιτίες, καμία «φαρδύ παιδί»: (α) `gap-6` σε πλέγμα
 * μέτρου τριών στηλών ⇒ +48 px (στατικά φυλάγεται πλέον από το CHECK 3.63 Κ6)· (β) οκτώ
 * χειριστήρια σε μία γραμμή κεφαλίδας (470 px σε 358).
 *
 * 🔑 **ΓΙΑΤΙ ΠΡΑΓΜΑΤΙΚΕΣ ΣΕΛΙΔΕΣ ΚΑΙ ΟΧΙ HARNESS** (αντίθετα με το 3.82): το ελάττωμα ζούσε στη
 * **σύνθεση** — πλέγμα κελύφους × κλάσεις σελίδας × κεφαλίδα. Ένα harness θα μετρούσε τη σύνθεση
 * που **εμείς** φανταστήκαμε· η επόμενη βλάβη θα είναι σε αυτή που δεν φανταστήκαμε.
 *
 * ⚠️ **ΑΡΝΕΙΤΑΙ ΝΑ ΠΕΡΑΣΕΙ ΣΕ ΑΔΕΙΑ ΣΕΛΙΔΑ**: μια διαδρομή που απέτυχε να αποδοθεί (500, λευκή
 * οθόνη) θα είχε **μηδέν** παραβάτες — «πράσινο που σημαίνει κανείς δεν κοίταξε». Γι' αυτό κάθε
 * μέτρηση απαιτεί πρώτα HTTP 2xx **και** ορατή κεφαλίδα (`header nav`) — και ότι το θέμα που
 * ζητήθηκε είναι **αυτό** που αποδόθηκε (αλλιώς «πράσινο και στα δύο» θα σήμαινε «είδα το ένα»).
 */

import { expect, test, type Page } from '@playwright/test';

import { THEME_STORAGE_KEY } from '@/lib/appearance/theme-storage-key';
import { collectReflowFindings, type ReflowFindings } from './measure-horizontal-overflow';
import { settleLayout } from './settle-layout';
import {
  REFLOW_ALLOWED_SURFACES,
  REFLOW_ROUTES,
  REFLOW_THEMES,
  REFLOW_WIDTHS,
} from './public-reflow-cases';

/** Το `lg` του Tailwind — από εκεί και πάνω η κεφαλίδα δείχνει την πλήρη μπάρα, όχι «☰ Μενού». */
const FULL_BAR_MIN_WIDTH = 1024;

/** Η διάταξη λογίζεται ήρεμη όταν τόσα διαδοχικά δείγματα, ανά {@link SAMPLE_INTERVAL_MS}, συμφωνούν. */
const STABLE_SAMPLES = 3;
const SAMPLE_INTERVAL_MS = 500;
const MAX_SAMPLES = 20;

/**
 * Τα ευρήματα **αφού ηρεμήσει η διάταξη** (ADR-797 §Φ.Ρ.2) — και οι δύο ερωτήσεις από το ΙΔΙΟ δείγμα.
 * ⛔ Αν δεν ηρεμήσει ποτέ, η πύλη **ΑΠΟΤΥΓΧΑΝΕΙ** ρητά — ποτέ «πήρα το τελευταίο δείγμα και πέρασα».
 */
async function findingsOf(page: Page): Promise<ReflowFindings> {
  let previous = '';
  let agreeing = 0;
  for (let sample = 0; sample < MAX_SAMPLES; sample += 1) {
    await page.evaluate(settleLayout);
    const findings = await page.evaluate(collectReflowFindings, [...REFLOW_ALLOWED_SURFACES]);
    const key = JSON.stringify(findings);
    agreeing = key === previous ? agreeing + 1 : 1;
    if (agreeing >= STABLE_SAMPLES) return findings;
    previous = key;
    await page.waitForTimeout(SAMPLE_INTERVAL_MS);
  }
  throw new Error(`η διάταξη δεν ηρέμησε σε ${MAX_SAMPLES} δείγματα — τελευταίο: ${previous}`);
}

/**
 * Οι δύο ερωτήσεις (ADR-797 §Φ.Ρ.3) ως **χωριστές** αποτυχίες — το μήνυμα λέει ΠΟΙΑ απαντήθηκε «όχι».
 * `expect.soft`: μια σελίδα που κόβει και τα δύο δείχνει και τα δύο σε ένα run.
 */
function expectFits(findings: ReflowFindings, where: string): void {
  expect.soft(findings.offscreen, `${where} — στοιχείο πέρα από την οθόνη`).toEqual([]);
  expect.soft(findings.clipped, `${where} — κείμενο ψαλιδισμένο από το κουτί του`).toEqual([]);
}

async function openRoute(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), `${route}: η σελίδα δεν αποδόθηκε (HTTP ${response?.status()})`).toBe(true);
  // Αρνητικός μάρτυρας ζωής: χωρίς ορατή κεφαλίδα, «μηδέν παραβάτες» δεν σημαίνει τίποτα.
  await expect(page.locator('header nav').first()).toBeVisible({ timeout: 60_000 });
  // 🔑 ΜΑΡΤΥΡΑΣ ΕΤΟΙΜΟΤΗΤΑΣ (ADR-797 §Φ.Ρ.3): κάθε σελίδα του εύρους φορτώνει δεδομένα και το ΔΗΛΩΝΕΙ
  //    (`<main aria-busy>` — `ShellSurface.busy`). Μετρημένο 2026-09-26: για ~3 s το `/stay` δεν είχε ούτε
  //    πεδίο ούτε κάρτες, και «3 δείγματα που συμφωνούν» έκριναν ήρεμη μια ΑΔΕΙΑ σελίδα. ⛔ Σελίδα που δεν
  //    δηλώνει `aria-busy` ή δεν βγαίνει ποτέ από τη φόρτωση ΑΠΟΤΥΓΧΑΝΕΙ — κι αυτό είναι βλάβη, όχι θόρυβος.
  await expect(page.locator('main').first(), `${route}: η σελίδα δεν βγήκε από τη φόρτωση (<main aria-busy>)`)
    .toHaveAttribute('aria-busy', 'false', { timeout: 60_000 });
}

for (const theme of REFLOW_THEMES) {
  test.describe(`CHECK 3.94 — θέμα ${theme}`, () => {
    test.beforeEach(async ({ context }) => {
      await context.addInitScript(
        ([key, value]) => window.localStorage.setItem(key, value),
        [THEME_STORAGE_KEY, theme] as const,
      );
    });

    for (const width of REFLOW_WIDTHS) {
      for (const route of REFLOW_ROUTES) {
        test(`${route} @ ${width}px — χωρά στην οθόνη και κάθε κείμενο στο κουτί του`, async ({ page }) => {
          await page.setViewportSize({ width, height: 844 });
          await openRoute(page, route);
          expect(await page.evaluate(() => document.documentElement.classList.contains('dark')))
            .toBe(theme === 'dark');
          expectFits(await findingsOf(page), `${route} @ ${width}px`);
        });
      }

      if (width < FULL_BAR_MIN_WIDTH) {
        // Ό,τι έφυγε από τη μπάρα ζει στο συρτάρι — και το συρτάρι ΟΦΕΙΛΕΙ επίσης να χωρά.
        test(`«☰ Μενού» @ ${width}px — το συρτάρι χωρά και προσφέρει γλώσσα + θέμα`, async ({ page }) => {
          await page.setViewportSize({ width, height: 844 });
          await openRoute(page, '/');
          const dialog = page.getByRole('dialog');
          const trigger = page.locator('header nav button[aria-haspopup="dialog"]');
          // Χωρίς `networkidle` το κλικ μπορεί να προλάβει το hydration και να χαθεί ⇒ επανάληψη (`toPass`).
          // ⛔ ΙΔΕΜΠΟΤΙΚΑ: πάτα ΜΟΝΟ αν το κουμπί δεν δηλώνει ήδη ανοιχτό. Μετρημένο 2026-09-25: το πρώτο κλικ
          //    άνοιξε, ο αργός server άργησε να το δείξει, το δεύτερο κλικ έπεσε ΠΑΝΩ στο ανοιχτό συρτάρι.
          await expect(async () => {
            if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click({ timeout: 5_000 });
            await expect(dialog).toBeVisible({ timeout: 10_000 });
          }).toPass({ timeout: 60_000 });
          // CHECK 3.72: η μετακόμιση είναι θεραπεία ΜΟΝΟ αν οι προτιμήσεις φτάνονται.
          // Γλώσσες (≥ 2) + θέματα (3) ως ΟΡΑΤΕΣ επιλογές — όχι αναπτυσσόμενα κρυμμένα σε δεύτερο επίπεδο.
          // `expect.poll`, όχι στιγμιαίο `count()`: το περιεχόμενο του συρταριού φορτώνεται lazy (μετρημένο: 0).
          await expect.poll(() => dialog.getByRole('radio').count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(5);
          expectFits(await findingsOf(page), `συρτάρι @ ${width}px`);
        });
      }
    }
  });
}
