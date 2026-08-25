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
const { gitShow } = require('./_git-show');

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
   * 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΚΑΡΦΩΜΕΝΟΣ ΣΤΗΝ ΙΣΤΟΡΙΑ.
   *
   * 🔴 Η πρώτη γραφή αυτής της άγκυρας (2026-08-25) ρωτούσε το **ζωντανό** δέντρο:
   * `expect(m.violationIds).toContain('Liberation Sans Bold')`. Ήταν σωστή όσο η βλάβη
   * υπήρχε — και **αυτο-ακυρώθηκε τη στιγμή που η εκστρατεία πέτυχε**: μόλις ενσωματώθηκε
   * το Liberation, η άγκυρα που υπάρχει για να αποδεικνύει *«η πύλη ξεχωρίζει τη σπασμένη
   * μορφή»* έγινε η **μόνη κόκκινη**, και ο εύκολος δρόμος θα ήταν να διαγραφεί.
   *
   * Ένας παρονομαστής δεν επιτρέπεται να μετακινείται μαζί με τη θεραπεία (ADR-790 §9.1).
   * Πλέον διαβάζει τον **πραγματικό** preloader του `ef31ea94` — το commit όπου το
   * `CAD_SUBSTITUTE_FONTS` είχε **μία** εγγραφή (`Liberation Sans → Roboto-Regular.ttf`) —
   * και απαιτεί από την πύλη να **δει** τη βλάβη εκεί. ⚠️ **ΚΑΡΦΩΜΕΝΟ commit, ΠΟΤΕ `HEAD`**:
   * το `HEAD` μετακινείται και η άγκυρα θα ξανα-αυτοακυρωνόταν σιωπηλά.
   */
  it('Π2: ο ΠΑΡΟΝΟΜΑΣΤΗΣ — στο ef31ea94 η πύλη ΒΛΕΠΕΙ τις ανεκπλήρωτες υποσχέσεις', () => {
    const historicalPreload = gitShow(
      'ef31ea94',
      'src/subapps/dxf-viewer/text-engine/fonts/cad-font-preload.ts',
    );
    // Ο ΠΙΝΑΚΑΣ είναι ο σημερινός: οι υποσχέσεις δεν άλλαξαν, μόνο το τι φορτώνεται.
    const v = P.judge(P.takeInventory(REPO_ROOT, {
      preload: historicalPreload,
      declarations: {},
      fileExists: () => true,
    }));
    const unkeepable = P.idsOf(v, P.STATES.UNKEEPABLE);
    expect(unkeepable).toContain('Liberation Sans Bold');
    expect(unkeepable).toContain('Liberation Mono');
    expect(P.idsOf(v, P.STATES.BUNDLED)).toEqual(['Liberation Sans']);
  });

  /**
   * Η άλλη μισή απόδειξη: το σημερινό δέντρο δεν είναι «0 επειδή κανείς δεν κοίταξε» — οι
   * ίδιες δύο όψεις **φορτώνονται όντως**, και οι δύο που μένουν είναι **ΔΗΛΩΜΕΝΕΣ**, όχι
   * σιωπηλά απούσες.
   */
  it('Π2β: σήμερα οι ίδιες όψεις είναι ΦΟΡΤΩΜΕΝΕΣ, και η υπόλοιπη απουσία είναι ΔΗΛΩΜΕΝΗ', () => {
    const m = require('../check-font-promise.js').measure();
    const v = P.judge(m.inv);
    expect(P.idsOf(v, P.STATES.BUNDLED)).toEqual(
      expect.arrayContaining(['Liberation Sans', 'Liberation Sans Bold', 'Liberation Mono']),
    );
    expect(m.violationIds).toEqual([]);
    expect(m.declarations.length).toBeGreaterThan(0);
  });

  it('Π3: η σπορά ΑΡΝΕΙΤΑΙ να κλειδώσει μπλοκάρουσα κατάσταση σε baseline', () => {
    const cli = require('../check-font-promise.js');
    expect(() => cli.buildPayload({ blocking: [{ state: P.STATES.UNLOADABLE_PRELOAD }], violationIds: [], declarations: [] }))
      .toThrow(/άρνηση σποράς/);
  });

  /**
   * 🔴 **Ζ — Ο ΦΡΟΥΡΟΣ ΤΟΥ ZERO-TOLERANCE, ΚΑΙ ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΔΙΚΗ ΤΟΥ ΑΓΚΥΡΑ.**
   *
   * Ως τις 2026-08-25 οι **πέντε** δηλωμένες ⛔ καταστάσεις αυτής της πύλης ήταν
   * **διακοσμητικές**: το `runSetRatchetCli` συγκρίνει **μόνο** τα σύνολα `violationIds` /
   * `declarations`, και καμία μπλοκάρουσα κατάσταση δεν μπαίνει σε αυτά. Μετρημένο ζωντανά
   * δύο φορές — η αναφορά τύπωνε `⛔ unloadable-preload 1` και η πύλη απαντούσε `✅ exit 0`.
   */
  describe('Ζ — το zero-tolerance ΜΠΛΟΚΑΡΕΙ όντως', () => {
    const cli = require('../check-font-promise.js');

    /** Πιάνει το `process.exit` χωρίς να σκοτώσει τον runner. */
    function captureExit(fn) {
      const realExit = process.exit;
      const realErr = console.error;
      const codes = [];
      process.exit = (c) => { codes.push(c); throw new Error('__exit__'); };
      console.error = () => {};
      try { fn(); } catch (e) { if (e.message !== '__exit__') throw e; }
      finally { process.exit = realExit; console.error = realErr; }
      return codes;
    }

    const blockingMeasure = () => ({
      blocking: [{ state: P.STATES.UNLOADABLE_PRELOAD, id: '/fonts/GHOST.ttf', detail: 'δοκιμή' }],
      violationIds: [], declarations: [],
    });
    const cleanMeasure = () => ({ blocking: [], violationIds: [], declarations: [] });

    it('Ζ1: μπλοκάρουσα κατάσταση ⇒ έξοδος με 1', () => {
      expect(captureExit(() => cli.enforceZeroTolerance([], blockingMeasure))).toEqual([1]);
    });

    it('Ζ2: καθαρή κατάσταση ⇒ καμία έξοδος', () => {
      expect(captureExit(() => cli.enforceZeroTolerance([], cleanMeasure))).toEqual([]);
    });

    it('Ζ3: `--report` ΔΕΝ μπλοκάρει — ο άνθρωπος πρέπει να ΔΕΙ τι έσπασε', () => {
      expect(captureExit(() => cli.enforceZeroTolerance(['--report'], blockingMeasure))).toEqual([]);
      expect(captureExit(() => cli.enforceZeroTolerance(['--write-baseline'], blockingMeasure))).toEqual([]);
    });

    /**
     * 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: αποδεικνύει ότι ο φρουρός **δεν είναι πλεονασμός**. Αν οι μπλοκάρουσες
     * ταυτότητες εμφανίζονταν στα σύνολα που συγκρίνει ο κοινός CLI, το ratchet θα τις έπιανε
     * μόνο του. **Δεν εμφανίζονται** — γι' αυτό χωρίς τον φρουρό η πύλη έμενε πράσινη.
     */
    it('Ζ4: ο ΠΑΡΟΝΟΜΑΣΤΗΣ — οι μπλοκάρουσες ταυτότητες ΔΕΝ φτάνουν ΠΟΤΕ στα συγκρινόμενα σύνολα', () => {
      const inv = P.takeInventory(REPO_ROOT, {
        table: "substituteFamily: 'Alpha',",
        preload: "cacheName: 'Alpha', url: '/fonts/Alpha.ttf'",
        declarations: { Ghost: { reason: REASON } },
        fileExists: () => false,
      });
      const v = P.judge(inv);
      const blocking = v.rows.filter((r) => P.BLOCKING.includes(r.state));
      expect(blocking.length).toBeGreaterThan(0);

      const compared = [
        ...P.idsOf(v, P.STATES.UNKEEPABLE),
        ...P.idsOf(v, P.STATES.DECLARED_SYNTHESIZED),
      ];
      for (const row of blocking) expect(compared).not.toContain(row.id);
    });

    /**
     * 🔑 Η ΚΑΛΩΔΙΩΣΗ: το `Ζ1` καλεί τη συνάρτηση **απευθείας** και θα έμενε πράσινο ακόμη κι αν
     * κανείς δεν την καλούσε από το CLI — ακριβώς το μάθημα `Ν3` του CHECK 3.31.
     */
    it('Ζ5: το CLI καλεί τον φρουρό ΠΡΙΝ το ratchet', () => {
      const src = fs.readFileSync(path.join(__dirname, '..', 'check-font-promise.js'), 'utf8');
      const guard = src.indexOf('enforceZeroTolerance(process.argv');
      const ratchetCall = src.indexOf('runSetRatchetCli({');
      expect(guard).toBeGreaterThan(-1);
      expect(ratchetCall).toBeGreaterThan(-1);
      expect(guard).toBeLessThan(ratchetCall);
    });
  });
});
