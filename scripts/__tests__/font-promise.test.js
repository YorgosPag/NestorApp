/**
 * CHECK 3.67 / ADR-803 — ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΥΠΟΣΧΕΣΗΣ ΓΡΑΜΜΑΤΟΣΕΙΡΑΣ.
 *
 * ⚠️ Οι μεταλλάξεις γίνονται στις **ΕΙΣΟΔΟΥΣ** (συνθετικός πίνακας / preloader), όχι στην
 * πύλη — μια πύλη που διαβάζει κείμενο πρέπει να αποδείξει ότι ξεχωρίζει **περιεχόμενο**.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const P = require('../lib/font-promise/promise');

const REPO_ROOT = path.join(__dirname, '..', '..');
const REASON = 'ο browser συνθέτει την όψη· ο χρήστης βλέπει έντονο κείμενο με συνθετικό βάρος, τεκμηριωμένα αποδεκτό';

/** Συνθετικός κόσμος — κάθε άγκυρα αλλάζει **μία** είσοδο. */
const world = (over = {}) => P.takeInventory(REPO_ROOT, {
  table: "substituteFamily: 'Alpha',\nsubstituteFamily: 'Beta',",
  preload: "cacheName: 'Alpha', url: '/fonts/Alpha.ttf'",
  declarations: {},
  fileExists: () => true,
  ...over,
});

describe('CHECK 3.67 — υπόσχεται ο πίνακας όψη που δεν φορτώνεται;', () => {
  it('Κ1: υπόσχεση που ΦΟΡΤΩΝΕΤΑΙ ⇒ ✅· υπόσχεση που ΔΕΝ φορτώνεται ⇒ 🔴', () => {
    const v = P.judge(world());
    expect(P.idsOf(v, P.STATES.BUNDLED)).toEqual(['Alpha']);
    expect(P.idsOf(v, P.STATES.UNKEEPABLE)).toEqual(['Beta']);
  });

  it('Κ2: δήλωση «το συνθέτει ο browser» με ουσιαστικό λόγο ⇒ ✅, όχι παραβίαση', () => {
    const v = P.judge(world({ declarations: { Beta: { reason: REASON } } }));
    expect(P.idsOf(v, P.STATES.UNKEEPABLE)).toEqual([]);
    expect(P.idsOf(v, P.STATES.DECLARED_SYNTHESIZED)).toEqual(['Beta']);
  });

  it('Κ3: δήλωση ΧΩΡΙΣ ουσιαστικό λόγο ⇒ ⛔ reasonless-declaration', () => {
    const v = P.judge(world({ declarations: { Beta: { reason: 'έτσι' } } }));
    expect(P.idsOf(v, P.STATES.REASONLESS_DECLARATION)).toEqual(['Beta']);
  });

  it('Κ4: δήλωση για οικογένεια που ΚΑΝΕΙΣ δεν υπόσχεται ⇒ ⛔ orphan-declaration', () => {
    const v = P.judge(world({ declarations: { Gamma: { reason: REASON } } }));
    expect(P.idsOf(v, P.STATES.ORPHAN_DECLARATION)).toEqual(['Gamma']);
  });

  /**
   * 🔑 ΤΟ ΣΚΑΛΙ ΠΑΝΩ ΑΠΟ ΤΟ AutoCAD: εκείνο ανακαλύπτει τη λείπουσα όψη **στο άνοιγμα του
   * σχεδίου** — δηλαδή αφού το λάθος έχει ήδη φύγει στον χρήστη. Εδώ ανακαλύπτεται στο commit.
   */
  it('Κ5: δηλωμένη ως φορτωμένη αλλά το ΑΡΧΕΙΟ λείπει ⇒ ⛔ unloadable-preload', () => {
    const v = P.judge(world({ fileExists: () => false }));
    expect(P.idsOf(v, P.STATES.UNLOADABLE_PRELOAD)).toEqual(['/fonts/Alpha.ttf']);
  });

  it('Κ6: FAIL-CLOSED — αρχείο-αυθεντία που λείπει ⇒ σφάλμα ΜΕ ΟΝΟΜΑ, ποτέ «καμία υπόσχεση»', () => {
    expect(() => P.takeInventory(path.join(__dirname, '__δεν_υπάρχει__')))
      .toThrow(/font-substitution-table\.ts λείπει/);
  });

  it('Κ7: η λογιστική ΚΛΕΙΝΕΙ — κάθε υπόσχεση/δήλωση/αρχείο παίρνει ακριβώς μία κατάσταση', () => {
    const v = P.judge(world({ declarations: { Gamma: { reason: REASON } }, fileExists: () => false }));
    expect(Object.values(v.tally).reduce((a, b) => a + b, 0)).toBe(v.rows.length);
  });

  /** 🔑 ΒΑΘΜΟΝΟΜΗΣΗ στο ΠΡΑΓΜΑΤΙΚΟ δέντρο. */
  it('Π1: το πραγματικό δέντρο — καμία μπλοκάρουσα κατάσταση, baseline ταιριάζει', () => {
    const cli = require('../check-font-promise.js');
    const m = cli.measure();
    expect(m.blocking).toEqual([]);
    const baseline = JSON.parse(fs.readFileSync(cli.BASELINE_FILE, 'utf8'));
    expect(m.violationIds).toEqual(baseline.violations);
  });

  /**
   * 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: αν το πραγματικό δέντρο δεν είχε ανεκπλήρωτες υποσχέσεις, το «0
   * παραβιάσεις» θα σήμαινε «δεν κοίταξα». Μετρημένο 2026-08-25: **4 στις 5**.
   */
  it('Π2: ο ΠΑΡΟΝΟΜΑΣΤΗΣ — ο πίνακας ΟΝΤΩΣ υπόσχεται όψεις που δεν φορτώνονται', () => {
    const m = require('../check-font-promise.js').measure();
    expect(m.inv.promised.length).toBeGreaterThan(1);
    expect(m.violationIds).toContain('Liberation Sans Bold');
  });

  it('Π3: η σπορά ΑΡΝΕΙΤΑΙ να κλειδώσει μπλοκάρουσα κατάσταση σε baseline', () => {
    const cli = require('../check-font-promise.js');
    expect(() => cli.buildPayload({ blocking: [{ state: P.STATES.UNLOADABLE_PRELOAD }], violationIds: [], declarations: [] }))
      .toThrow(/άρνηση σποράς/);
  });
});
