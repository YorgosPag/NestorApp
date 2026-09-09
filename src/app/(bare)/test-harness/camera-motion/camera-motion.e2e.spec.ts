import { expect, test } from '@playwright/test';

import { CAMERA_HOPS, MEASUREMENT_FRAME, RESULTS_ELEMENT_ID } from './camera-motion-hops';

/**
 * # ΠΥΛΗ ΚΙΝΗΣΗΣ ΚΑΜΕΡΑΣ (ADR-847 §9) — **«ΠΕΤΑΞΕ, Ή ΠΗΔΗΞΕ;»**
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: στις 2026-09-09 έφυγε στην ιστορία *(`3d0d715e`)* κώδικας που
 * έκανε κάθε μακρινή πτήση **ακαριαίο πήδημα** — `300 χλμ ⇒ 2 ms`. **Δεκατρία tests
 * ήταν πράσινα**, γιατί ρωτούσαν *«κλήθηκε το `flyTo`;»* και όχι *«πέταξε;»*.
 *
 * 🔑 **Η κρίση ΔΕΝ ζει εδώ.** Ζει στο `lib/geo/camera-trajectory`, καθαρή και ελεγμένη
 * ντετερμινιστικά σε `jest` με **χειρόγραφες** διαδρομές *(πτήση · πήδημα · σύρσιμο)*.
 * Αυτό το αρχείο κάνει **ένα** πράγμα: βεβαιώνεται ότι ο **αληθινός** χάρτης, με τις
 * **αληθινές** επιλογές της εφαρμογής, παράγει διαδρομή που περνά εκείνη την κρίση.
 *
 * ⚠️ Το harness βηματίζει με **παγωμένο ρολόι** *(`setNow`)*, άρα τα νούμερα **δεν**
 * εξαρτώνται από τον ρυθμό καρέ της μηχανής CI — το μάθημα που κόστισε τρεις αποτυχημένες
 * μετρήσεις όταν μια δεύτερη ανοιχτή καρτέλα έκανε το `visibilityState` `hidden`.
 *
 * ⛔ **ΤΟΠΙΚΑ: ΤΡΕΞΕ ΤΟ ΜΟΝΟ ΑΦΟΥ Ο DEV SERVER ΞΑΝΑΜΕΤΑΓΛΩΤΤΙΣΕ.** Μετρημένο 2026-09-09:
 * αμέσως μετά από αλλαγή στο `lib/geo/camera-motion.ts`, η πύλη κοκκίνισε σε **μπαγιάτικο
 * bundle** — η πηγή ήταν σωστή, ο σερβιρισμένος κώδικας όχι. Δεύτερη εκτέλεση: **6/6
 * πράσινα, χωρίς καμία αλλαγή**. Στο CI δεν υπάρχει: ο `webServer` ξεκινά καθαρός.
 * 🔑 Μια κόκκινη πύλη αμέσως μετά από edit **δεν είναι απόδειξη** — ξανατρέξ' την.
 */

const HARNESS = '/test-harness/camera-motion';

interface HopResult {
  id: string;
  label: string;
  expectsArc: boolean;
  durationMs: number;
  arcDepth: number;
  frames: number;
  flew: boolean;
  journey: boolean;
  frameWidth: number;
  frameHeight: number;
}

/**
 * 🔑 **ΜΙΑ ΜΕΤΡΗΣΗ, ΕΞΙ ΚΡΙΣΕΙΣ — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΒΕΛΤΙΣΤΟΠΟΙΗΣΗ.**
 *
 * Η πρώτη γραφή καλούσε τη μέτρηση **μέσα σε κάθε test**: πέντε πτήσεις × έξι κριτήρια =
 * **τριάντα** πτήσεις, ~6 λεπτά CI για δεδομένα που δεν αλλάζουν μεταξύ τους. Χειρότερα:
 * τα έξι κριτήρια θα έκριναν **έξι διαφορετικές** μετρήσεις, οπότε μια οριακή τιμή θα
 * μπορούσε να περνά στο ένα και να κόβει στο άλλο — **ασυνεπής πύλη**.
 *
 * ⇒ Μετράμε **μία φορά** σε `beforeAll`, και τα έξι κριτήρια κρίνουν **τα ίδια** νούμερα.
 */
let measured: HopResult[] = [];

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(HARNESS);
    const json = page.locator(`#${RESULTS_ELEMENT_ID}`);
    // Το περιθώριο είναι γενναιόδωρο επίτηδες: μια αργή μηχανή CI κάνει τη ΜΕΤΡΗΣΗ αργή
    // χωρίς να την κάνει λάθος — το παγωμένο ρολόι φροντίζει γι' αυτό.
    await expect(json).toBeAttached({ timeout: 180_000 });
    measured = JSON.parse(await json.innerText()) as HopResult[];
  } finally {
    await page.close();
  }
});

test.describe('ADR-847 — η κάμερα πετάει, δεν πηδά', () => {
  test('Κ1 🔴 ΚΑΘΕ διαδρομή ΠΕΤΑΕΙ — η ερώτηση που καμία πράσινη άγκυρα δεν έκανε', async () => {
    const results = measured;

    expect(results).toHaveLength(CAMERA_HOPS.length);
    const jumped = results.filter(r => !r.flew).map(r => `${r.label} → ${r.durationMs}ms`);
    expect(jumped).toEqual([]);
  });

  test('Κ2 🏆 τα ΜΕΓΑΛΑ άλματα διαβάζονται ως ταξίδι — ζουμάρουν έξω πριν μεταφερθούν', async () => {
    /*
      🔑 **Εδώ πάμε πιο πέρα από Compose/Flutter.** Εκείνα βηματίζουν καρέ και ελέγχουν
      τελική κατάσταση ή jank. Μια γραμμική μετακίνηση όμως έχει **ακριβώς την ίδια
      διάρκεια** με μια πτήση van Wijk και **ίδιο τέρμα** — αλλά ο άνθρωπος χάνει τα πάντα
      από τα μάτια του στη μέση. Μόνο το **σχήμα** τα ξεχωρίζει.
    */
    const results = measured;

    const dragged = results
      .filter(r => r.expectsArc && !r.journey)
      .map(r => `${r.label} → καμπύλη ${r.arcDepth}`);
    expect(dragged).toEqual([]);
  });

  test('Κ3 η διάρκεια ΑΚΟΛΟΥΘΕΙ την απόσταση — αλλιώς κάποιος ξανακάρφωσε σταθερά', async () => {
    /*
      ⚠️ Αυτό είναι που κοκκινίζει αν κάποιος ξαναπεράσει `duration: <αριθμός>`: όλες οι
      διαδρομές θα έβγαζαν **την ίδια** τιμή. Μετρημένο εύρος 2026-09-09: κοντινό `884 ms`,
      πανελλαδικό `3.824 ms` — **τέσσερις φορές** διαφορά.
    */
    const results = measured;
    const near = results.find(r => r.id === 'near');
    const country = results.find(r => r.id === 'country');

    expect(near, 'λείπει η κοντινή διαδρομή').toBeDefined();
    expect(country, 'λείπει η πανελλαδική διαδρομή').toBeDefined();
    expect(country!.durationMs).toBeGreaterThan(near!.durationMs * 1.5);
  });

  test('Κ4 καμία διαδρομή δεν γίνεται νωθρή — το πάνω άκρο μένει ανθρώπινο', async () => {
    const results = measured;
    const sluggish = results.filter(r => r.durationMs > 5_000).map(r => `${r.label} → ${r.durationMs}ms`);
    expect(sluggish).toEqual([]);
  });

  test('Κ6 🔴 οι αριθμοί ισχύουν στο ΔΗΛΩΜΕΝΟ κάδρο — αλλιώς συγκρίνουμε άλλες συνθήκες', async () => {
    /*
      🔴 **ΜΕΤΡΗΜΕΝΟ ΓΙΑΤΙ ΣΥΝΕΒΗ** (2026-09-09): η ίδια διαδρομή Αθήνα→Θεσσαλονίκη έδωσε
      **4.417 ms** σε κάδρο `958×300` και **3.367 ms** σε `2350×349`. Δεν είναι σφάλμα —
      ο van Wijk μετρά **οθόνες**, όχι χιλιόμετρα. Είναι όμως ο λόγος που ένα κατώφλι
      χωρίς κάδρο δεν σημαίνει τίποτα.

      ⚠️ Και ένα κάδρο **μηδενικού ύψους** δίνει «εύλογους» αριθμούς: η πρώτη εκδοχή του
      harness μέτρησε σε `958×0` και παρήγαγε πέντε γραμμές που έμοιαζαν σωστές.
    */
    const results = measured;
    for (const row of results) {
      expect(row.frameHeight, `${row.label}: μηδενικό ύψος = ψεύτικη μέτρηση`).toBeGreaterThan(100);
      /*
        ⚠️ **Ανοχή, όχι ισότητα** — και ο λόγος είναι μετρημένος: με `border: 1px` στο
        δοχείο ο καμβάς έβγαινε **958×349** αντί για 960×352. Ένα κριτήριο ακριβούς
        ισότητας θα κοκκίνιζε για **διακόσμηση**, και ο επόμενος θα «διόρθωνε» τη ΔΗΛΩΣΗ
        ώστε να ταιριάξει στο στυλ — δηλαδή θα ευθυγράμμιζε τη μονάδα μέτρησης με το
        αντικείμενο. Λίγα εικονοστοιχεία δεν αλλάζουν τίποτα· ένα διαφορετικό **κάδρο**
        αλλάζει τα πάντα *(958×300 ⇒ 4.417 ms, 2350×349 ⇒ 3.367 ms)*.
      */
      expect(Math.abs(row.frameWidth - MEASUREMENT_FRAME.width)).toBeLessThanOrEqual(4);
      expect(Math.abs(row.frameHeight - MEASUREMENT_FRAME.height)).toBeLessThanOrEqual(4);
    }
  });

  test('Κ5 ⚠️ η μέτρηση ΕΓΙΝΕ — λίγα καρέ σημαίνει «κανείς δεν κοίταξε», όχι «καθαρό»', async () => {
    /*
      🔴 Το σχήμα «`0` σημαίνει *κανείς δεν κοίταξε*» έχει πληρωθεί **τέσσερις** φορές σε
      αυτό το έργο. Χωρίς αυτό το κριτήριο, ένας χάρτης που δεν αποδίδει καθόλου θα
      έδινε «όλα καλά» με **δύο** καρέ ανά διαδρομή.
    */
    const results = measured;
    const thin = results.filter(r => r.frames < 10).map(r => `${r.label} → ${r.frames} καρέ`);
    expect(thin).toEqual([]);
  });
});
