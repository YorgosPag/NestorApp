/**
 * @jest-environment jsdom
 *
 * @fileoverview **Η ΤΥΠΟΓΡΑΦΙΑ ΠΡΟΖΑΣ ΔΕΝ ΧΤΥΠΑ ΛΙΣΤΕΣ ΔΙΑΤΑΞΗΣ** (ADR-777 §8.49).
 * @related src/app/shell-surface.css §4β · ADR-816 (WCAG 1.4.8) · ADR-797
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΤΟ CSS ΙΣΧΥΡΙΖΟΤΑΝ ΟΤΙ ΕΧΕΙ — ΚΑΙ ΔΕΝ ΕΙΧΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το §4β του `shell-surface.css` γράφει *«φυλάσσονται από άγκυρα που απαιτεί ≥ τα
 * ελάχιστα»*. **`grep` = 0**: καμία δοκιμή δεν ανέφερε ποτέ `--shell-prose-*`. Ήταν
 * *«φρουρός χωρίς απόδειξη ζωής»* (ADR-749 §5) σε επίπεδο **σχολίου** — και το κόστος
 * μετρήθηκε ζωντανά στο `/pro/<ψευδώνυμο>`: **36px** ανάμεσα σε κάρτες που ζητούσαν
 * `gap-2` (8px), και **27px** ανάμεσα σε δύο badge που ζητούσαν `gap-1` (4px).
 *
 * 🔑 **ΕΚΤΕΛΕΙ ΤΟΝ ΑΛΗΘΙΝΟ ΕΠΙΛΟΓΕΑ, ΔΕΝ ΤΟΝ ΠΕΡΙΓΡΑΦΕΙ.** Ο επιλογέας διαβάζεται από
 * το **ίδιο το αρχείο** και τρέχει μέσα από `Element#matches` — τη μηχανή επιλογέων.
 * Μια δοκιμή που έγραφε τον επιλογέα ξανά θα επικύρωνε **το αντίγραφό της**, δηλαδή θα
 * ήταν το ίδιο σχήμα με το σχόλιο που αντικαθιστά.
 */

import fs from 'fs';
import path from 'path';

const CSS = fs.readFileSync(
  path.join(process.cwd(), 'src/app/shell-surface.css'),
  'utf8',
);

/**
 * Ο **ζωντανός** επιλογέας του κανόνα απόστασης, όπως είναι γραμμένος σήμερα.
 *
 * ⚠️ Αν κανείς τον ξαναγράψει ως σκέτο `li + li`, το regex **δεν** θα τον βρει και η
 * δοκιμή πέφτει **εδώ** — που είναι το σωστό σημείο αποτυχίας: ο κανόνας έπαψε να
 * κάνει τη διάκριση, ανεξάρτητα από το τι κάνει μετά.
 */
function proseSpacingSelector(): string {
  const line = CSS.split('\n').find(
    (l) => l.includes('> li + li') && l.includes('data-shell-measure'),
  );
  if (line === undefined) {
    throw new Error(
      'Ο κανόνας απόστασης πρόζας δεν βρέθηκε με τη μορφή «… > li + li». ' +
        'Αν έγινε σκέτο `[data-shell-measure] li + li`, τα 36px επέστρεψαν στις κάρτες.',
    );
  }
  // ⚠️ Η γραμμή είναι είτε «…,» (μεσαία του καταλόγου) είτε «… {» (τελευταία). Ένα
  //    σκέτο `replace(/,$/)` άφηνε το **άγκιστρο** μέσα στον επιλογέα ⇒ άκυρος ⇒ όλα
  //    τα `matches()` γύριζαν `false`, και **το Π1 περνούσε ψευδώς**. Πιάστηκε από το
  //    Π2 — που είναι ακριβώς ο λόγος που το Π2 γράφτηκε.
  return line.trim().replace(/\s*[,{]\s*$/, '');
}

function build(html: string): HTMLElement {
  const host = document.createElement('div');
  host.setAttribute('data-shell-measure', 'prose');
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Π1 — ΟΙ ΛΙΣΤΕΣ ΔΙΑΤΑΞΗΣ ΕΞΑΙΡΟΥΝΤΑΙ', () => {
  it('🔴 η ΣΤΗΛΗ καρτών της βιτρίνας γραφείου δεν παίρνει απόσταση παραγράφου', () => {
    // Ακριβώς η κλάση του `AgencyProfileContent` — εκεί μετρήθηκαν τα 36px.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `:not([class*='flex'], …)` ⇒ κοκκινίζει.
    const host = build(
      '<ul class="m-0 flex list-none flex-col gap-2 p-0"><li id="a"></li><li id="b"></li></ul>',
    );
    expect(host.querySelector('#b')!.matches(proseSpacingSelector())).toBe(false);
  });

  it('🔴 το ΠΛΕΓΜΑ της ρίζας δεν παίρνει απόσταση παραγράφου', () => {
    const host = build(
      '<ul class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4 p-0">' +
        '<li id="a"></li><li id="b"></li></ul>',
    );
    expect(host.querySelector('#b')!.matches(proseSpacingSelector())).toBe(false);
  });

  it('🔴 τα BADGE μέσα στην κάρτα δεν σπάνε σε δύο σειρές', () => {
    // Ακριβώς η κλάση της `ListingCard` — εκεί μετρήθηκαν τα 27px, που έκαναν το
    // `flex-wrap` να αποδίδει «Ενοικίαση» και «Πώληση» σε **δύο** σειρές.
    const host = build(
      '<ul class="mt-2 flex flex-wrap gap-1"><li id="a"></li><li id="b"></li></ul>',
    );
    expect(host.querySelector('#b')!.matches(proseSpacingSelector())).toBe(false);
  });
});

describe('Π2 — Η ΣΥΜΜΟΡΦΩΣΗ ΔΕΝ ΧΑΛΑΡΩΣΕ (WCAG 1.4.8)', () => {
  it('🔴 η ΓΥΜΝΗ λίστα των νομικών σελίδων ΕΞΑΚΟΛΟΥΘΕΙ να παίρνει απόσταση', () => {
    // 🔴 **ΤΟ ΑΛΛΟ ΣΚΕΛΟΣ — και είναι αυτό που κάνει τη δοκιμή άγκυρα αντί για
    //    δικαιολογία.** Μια εξαίρεση που ίσχυε παντού θα «περνούσε» το Π1 και θα είχε
    //    **καταργήσει** σιωπηλά ένα κριτήριο προσβασιμότητας.
    //    🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε το `:not(…)` σε `:is(…)` ⇒ κοκκινίζει.
    //    Έτσι γράφουν `terms` · `privacy-policy` · `data-deletion` (επαληθευμένο).
    const host = build('<ul><li id="a"></li><li id="b"></li></ul>');
    expect(host.querySelector('#b')!.matches(proseSpacingSelector())).toBe(true);
  });

  it('🔴 και η αριθμημένη λίστα του `data-deletion` το ίδιο', () => {
    const host = build('<ol><li id="a"></li><li id="b"></li></ol>');
    expect(host.querySelector('#b')!.matches(proseSpacingSelector())).toBe(true);
  });

  it('🔴 το ΠΡΩΤΟ στοιχείο δεν παίρνει ποτέ απόσταση — η μέτρηση γίνεται ΜΙΑ φορά', () => {
    // `margin-block-end` θα διπλασίαζε την απόσταση σε flex/grid συγκείμενο, όπου τα
    // περιθώρια **δεν** συμπτύσσονται — το λέει ήδη το CSS, εδώ εκτελείται.
    const host = build('<ul><li id="a"></li><li id="b"></li></ul>');
    expect(host.querySelector('#a')!.matches(proseSpacingSelector())).toBe(false);
  });
});
