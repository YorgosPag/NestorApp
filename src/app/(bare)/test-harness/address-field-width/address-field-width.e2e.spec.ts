import { expect, test } from '@playwright/test';

import { addressFieldMinChars } from '@/components/shared/addresses/editor/address-field-widths';

import {
  RESULTS_ELEMENT_ID,
  WIDTH_CASES,
  type FieldWidthResult,
} from './address-field-width-cases';

/**
 * # ΠΥΛΗ ΩΦΕΛΙΜΟΥ ΠΛΑΤΟΥΣ (ADR-332 D27 Ζ7) — **«ΒΛΕΠΕΙ Ο ΑΝΘΡΩΠΟΣ ΤΙ ΓΡΑΦΕΙ;»**
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: στις 2026-09-13 μετρήθηκε ζωντανά ότι τα πεδία **Οδός / Αριθμός /
 * Τ.Κ.** έφταναν σε **ωφέλιμο πλάτος ΜΗΔΕΝ** σε στενή στήλη — `clientWidth − padding = 0`.
 * Στο `FrontageAddressCreateDialog` (`sm:max-w-md`, **σταθερό** πλάτος) αυτό ίσχυε σε
 * **ΚΑΘΕ οθόνη**. **703 tests ήταν πράσινα.**
 *
 * Η αιτία δεν ήταν το στένεμα· ήταν ότι *η προτεραιότητα συρρίκνωσης ήταν ανάποδη*: το
 * σήμα κατάστασης (`min-content`, άκαμπτο) έτρωγε **3,4×** τον χώρο του ίδιου του πεδίου
 * (`flex-shrink: 1`, το μόνο που πλήρωνε).
 *
 * 🔑 **ΓΙΑΤΙ PLAYWRIGHT ΚΑΙ ΟΧΙ JEST**: το **jsdom δεν έχει διάταξη**. Ένα jest test εδώ
 * μπορεί να ελέγξει μόνο **ονόματα κλάσεων** — θα «περνούσε» με σωστές κλάσεις και σπασμένη
 * διάταξη. *Άγκυρα που δεν μπορεί να κοκκινίσει για τον δηλωμένο της λόγο είναι σχόλιο.*
 *
 * 🏆 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ**: Material/Carbon/GOV.UK λένε **πού** να μπει η ένδειξη
 * κατάστασης (μέσα στο πεδίο ή από κάτω, **ποτέ** δίπλα). Κανένα design system δεν
 * **επαληθεύει** ότι το πεδίο έμεινε αναγνώσιμο — το αφήνουν στο μάτι του designer. Εδώ το
 * κρατά σύστημα, και σε **χαρακτήρες**: η ερώτηση δεν είναι «πόσα pixel;» αλλά
 * **«χωράει αυτό που κρατά το πεδίο;»**.
 *
 * ⛔ **ΤΟΠΙΚΑ: ΤΡΕΞΕ ΤΟ ΜΟΝΟ ΑΦΟΥ Ο DEV SERVER ΞΑΝΑΜΕΤΑΓΛΩΤΤΙΣΕ.** Μια κόκκινη πύλη αμέσως
 * μετά από edit μπορεί να κρίνει **μπαγιάτικο bundle** — ξανατρέξ' την (μάθημα 3.77).
 */

const HARNESS = '/test-harness/address-field-width';

let measured: FieldWidthResult[] = [];

/**
 * 🔑 **ΜΙΑ ΜΕΤΡΗΣΗ, ΠΕΝΤΕ ΚΡΙΣΕΙΣ.** Αν κάθε κριτήριο άνοιγε δική του σελίδα, τα πέντε θα
 * έκριναν **πέντε διαφορετικές** μετρήσεις — και μια οριακή τιμή θα περνούσε στο ένα και θα
 * έκοβε στο άλλο. **Ασυνεπής πύλη.** (Ίδια απόφαση με το CHECK 3.77.)
 */
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(HARNESS);
    const json = page.locator(`#${RESULTS_ELEMENT_ID}`);
    await expect(json).toBeAttached({ timeout: 180_000 });
    measured = JSON.parse(await json.innerText()) as FieldWidthResult[];
  } finally {
    await page.close();
  }
});

test.describe('ADR-332 Ζ7 — το πεδίο δείχνει ό,τι γράφεται', () => {
  test('Κ1 🔴 ΚΑΝΕΝΑ πεδίο δεν πέφτει κάτω από το δάπεδό του — η ερώτηση που κανείς δεν έκανε', () => {
    /*
      Το δάπεδο ΔΕΝ ζει εδώ. Ζει στο `address-field-widths.ts` — **το ίδιο αρχείο που
      διαβάζει ο κώδικας** για το `maxLength` του Τ.Κ. Δεύτερος αριθμός εδώ θα απέκλινε
      στην πρώτη αλλαγή, και η πύλη θα φύλαγε υπόσχεση που κανείς δεν έδωσε.
    */
    const starved = measured
      .filter(row => row.usableChars < addressFieldMinChars(row.field))
      .map(row =>
        `${row.caseId}(${row.caseWidthPx}px) · ${row.field}: `
        + `${row.usableChars} χαρ. < ${addressFieldMinChars(row.field)} — `
        + `το σήμα «${row.badgeText}» κρατά ${row.badgePx}px`,
      );
    expect(starved).toEqual([]);
  });

  test('Κ2 η γραμμή ΤΥΛΙΓΕΤΑΙ, δεν ξεχειλίζει — λύση που κρύβει δεν είναι λύση', () => {
    /*
      ⚠️ Χωρίς αυτό, το Κ1 θα περνούσε με ένα πεδίο που «χωράει» επειδή σπρώχνει το σήμα
      **έξω από το κάδρο**. Ο γονέας έχει `overflow-x: clip` (globals.css) ⇒ το σήμα θα
      εξαφανιζόταν σιωπηλά: ανταλλαγή ενός αόρατου δεδομένου με μια αόρατη κατάσταση.
    */
    const spilling = measured
      .filter(row => row.overflows)
      .map(row => `${row.caseId} · ${row.field}`);
    expect(spilling).toEqual([]);
  });

  test('Κ3 ⚠️ η μέτρηση ΕΓΙΝΕ — «καμία γραμμή» σημαίνει «κανείς δεν κοίταξε», όχι «καθαρό»', () => {
    /*
      🔴 Το σχήμα «`0` σημαίνει *κανείς δεν κοίταξε*» έχει πληρωθεί **πέντε** φορές σε αυτό
      το έργο (N.11 · N.12 · N.18 · CHECK 3.77 · και το ίδιο το Ζ6). Χωρίς αυτό το κριτήριο,
      ένα harness που δεν αποδίδει τη φόρμα θα έδινε «όλα καλά» με **μηδέν** γραμμές.
    */
    expect(measured.length).toBeGreaterThan(0);
    const missing = WIDTH_CASES
      .filter(c => measured.filter(row => row.caseId === c.id).length < 3)
      .map(c => `${c.id}: ${measured.filter(row => row.caseId === c.id).length} πεδία`);
    expect(missing).toEqual([]);
  });

  test('Κ4 🔴 μετρήθηκε το ΧΕΙΡΟΤΕΡΟ σήμα — αλλιώς περνάμε το εύκολο και σπάμε στην παραγωγή', () => {
    /*
      🔴 **ΜΕΤΡΗΜΕΝΟ ΓΙΑΤΙ ΠΑΡΑΛΙΓΟ ΝΑ ΣΥΜΒΕΙ.** Η αρχική ζωντανή μέτρηση έγινε με το badge
      **«Ταιριάζει»** (9 χαρακτήρες, 90px). Το πλατύτερο όμως είναι το **«Δεν συμπληρώθηκε»**
      (16 χαρακτήρες, ~103px) — και είναι ακριβώς αυτό που βλέπει ο άνθρωπος σε **άδεια**
      φόρμα, δηλαδή τη στιγμή που πρωτοαρχίζει να γράφει.

      Μια πύλη που δοκίμαζε το «Ταιριάζει» θα ήταν πράσινη και η παραγωγή θα έσπαγε στο
      πλατύτερο: το σχήμα *«ο λόγος μη διακρίσιμος»* (§7 #2). Το κριτήριο αυτό βεβαιώνει ότι
      το όργανο μετρά το **χειρότερο** σενάριο — και ότι κάποιος δεν το «απλοποίησε» αργότερα.
    */
    const withBadge = measured.filter(row => row.badgePx > 0);
    expect(withBadge.length, 'κανένα σήμα δεν αποδόθηκε — το όργανο μετρά φόρμα ΧΩΡΙΣ badges').toBeGreaterThan(0);

    const widest = Math.max(...withBadge.map(row => row.badgePx));
    const widestText = withBadge.find(row => row.badgePx === widest)?.badgeText ?? '';
    expect(widestText, 'το πλατύτερο σήμα δεν είναι το «Δεν συμπληρώθηκε» — μετράμε ευκολότερο σενάριο').toContain('συμπληρώ');
  });

  test('Κ5 το άνετο πλάτος ΔΕΝ παλινδρόμησε — η θεραπεία δεν στενεύει ό,τι ήταν καλά', () => {
    /*
      Η θεραπεία επιβάλλει δάπεδο και τύλιγμα. Και τα δύο είναι αδιάφορα σε άνετο χώρο —
      **αν** το δάπεδο μπήκε ως `flex-basis` και όχι ως `width`. Αν κάποιος το γράψει ως
      σταθερό πλάτος, εδώ θα φανεί: τα πεδία θα σταματήσουν να μεγαλώνουν.
    */
    const roomy = measured.filter(row => row.caseId === 'roomy');
    expect(roomy.length).toBeGreaterThan(0);
    const cramped = roomy
      .filter(row => row.usableChars < addressFieldMinChars(row.field) * 1.5)
      .map(row => `${row.field}: ${row.usableChars} χαρ. σε στήλη 805px`);
    expect(cramped).toEqual([]);
  });
});
