/**
 * CHECK 3.66 / ADR-802 — ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΑΠΟΓΡΑΦΗΣ ΠΥΛΩΝ.
 *
 * ⚠️ Οι μεταλλάξεις γίνονται στις **ΕΙΣΟΔΟΥΣ** (συνθετικός εκτελεστής / hook / οδηγός), όχι
 * στην πύλη: μια πύλη που κρίνει κείμενο πρέπει να αποδείξει ότι ξεχωρίζει **περιεχόμενο**,
 * όχι ότι περιέχει μια λέξη.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const inventory = require('../lib/gate-inventory/inventory');
const { STATES, judge, idsOf } = require('../lib/gate-inventory/judge');

const REPO_ROOT = path.join(__dirname, '..', '..');
const REASON = 'λόγος αρκετά μακρύς ώστε να περάσει το υποχρεωτικό κατώφλι των σαράντα χαρακτήρων';

/** Συνθετικός κόσμος — κάθε άγκυρα αλλάζει **μία** είσοδο. */
const world = (over = {}) => inventory.takeInventory(REPO_ROOT, {
  executor: "addThread('3.10', 'a', 's'); addBash('3.11', 'b', 's');",
  hook: '# CHECK 3.12 τρέχει στη Φάση 0',
  guide: '| **3.10** | κάτι |\n| **3.11** | κάτι |\n| **3.12** | κάτι |\n',
  declarations: {},
  ...over,
});

describe('CHECK 3.66 — η απογραφή των πυλών', () => {
  it('Κ1: ΚΑΙ ΟΙ ΔΥΟ μορφές δρομολόγησης μετρούν — `addThread` ΚΑΙ `addBash`', () => {
    const inv = world();
    expect([...inv.runs].sort()).toEqual(['3.10', '3.11', '3.12']);
    expect(inv.counts.dispatched).toBe(2);
    expect(inv.counts.hooked).toBe(1);
  });

  /**
   * 🔴 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΗΣ ΠΡΑΓΜΑΤΙΚΗΣ ΑΣΤΟΧΙΑΣ: το πρώτο κριτήριο ήταν καρφωμένο στο
   * `addThread` και κατήγγελλε τα 3.9/3.10 ως φαντάσματα — **2 ψευδώς θετικά στα 3 (67%)**.
   * Αυτή η άγκυρα κρατά το μοτίβο **αγνωστικό ως προς τη μορφή**.
   */
  it('Κ2: κριτήριο καρφωμένο σε ΜΙΑ μορφή θα γεννούσε ΨΕΥΔΕΣ φάντασμα — εδώ δεν γεννά', () => {
    const v = judge(world());
    expect(idsOf(v, STATES.GHOST_ROW)).toEqual([]);
    expect(idsOf(v, STATES.DOCUMENTED).sort()).toEqual(['3.10', '3.11', '3.12']);
  });

  it('Κ3: πύλη που ΤΡΕΧΕΙ χωρίς καμία αναφορά ⇒ 🔴 undocumented-gate', () => {
    const v = judge(world({ guide: '| **3.10** | κάτι |\n| **3.11** | κάτι |\n' }));
    expect(idsOf(v, STATES.UNDOCUMENTED)).toEqual(['3.12']);
  });

  it('Κ4: αναφορά σε ΠΡΟΖΑ (κανόνας N.12/N.18) ΔΕΝ είναι παραβίαση — είναι 🔶 prose-only', () => {
    const v = judge(world({ guide: '| **3.10** | κάτι |\n| **3.11** | κάτι |\nΤο CHECK 3.12 περιγράφεται στον κανόνα N.12.\n' }));
    expect(idsOf(v, STATES.UNDOCUMENTED)).toEqual([]);
    expect(idsOf(v, STATES.PROSE_ONLY)).toEqual(['3.12']);
  });

  /**
   * 🔴 **Η ΑΥΤΟ-ΑΚΥΡΩΣΗ — ΠΛΗΡΩΘΗΚΕ ΖΩΝΤΑΝΑ ΤΗ ΣΤΙΓΜΗ ΠΟΥ ΓΡΑΦΤΗΚΕ Η ΠΥΛΗ.**
   *
   * Η πρώτη εκδοχή της **γραμμής του 3.66** απαριθμούσε τις αδήλωτες πύλες («εκστρατεία που
   * τελειώνει στο μηδέν: 3.5·3.6·3.11…»). Επειδή οι αναφορές μετρούνταν σε **όλο** το αρχείο,
   * η μέτρηση **κατέρρευσε από 9 σε 0**: η πύλη έγινε πράσινη επειδή **περιέγραψε** το χρέος,
   * όχι επειδή το έλυσε.
   *
   * Ίδια οικογένεια με το `Κ7β` του CHECK 3.50: *κείμενο που τεκμηριώνει τη βλάβη δεν
   * επιτρέπεται να μετριέται ως θεραπεία.*
   */
  it('Κ4β: παραπομπή ΜΕΣΑ σε άλλη γραμμή πίνακα ΔΕΝ τεκμηριώνει — αλλιώς η πύλη αυτο-ακυρώνεται', () => {
    const guide = '| **3.10** | κάτι |\n| **3.11** | κάτι |\n'
      + '| **3.99** | ίδιο σχήμα με το 3.12, δες και το 3.12 |\n';
    const v = judge(world({ guide, declarations: { '3.99': { reason: REASON } } }));
    expect(idsOf(v, STATES.UNDOCUMENTED)).toEqual(['3.12']);
    expect(idsOf(v, STATES.PROSE_ONLY)).toEqual([]);
  });

  it('Κ5: γραμμή χωρίς εκτέλεση και χωρίς δήλωση ⇒ ⛔ ghost-row', () => {
    const v = judge(world({ guide: '| **3.10** | κάτι |\n| **3.11** | κάτι |\n| **3.12** | κάτι |\n| **3.99** | φάντασμα |\n' }));
    expect(idsOf(v, STATES.GHOST_ROW)).toEqual(['3.99']);
  });

  it('Κ6: το ίδιο φάντασμα ΔΗΛΩΜΕΝΟ ως μόνο-CI ⇒ ✅, όχι παραβίαση', () => {
    const v = judge(world({
      guide: '| **3.10** | κάτι |\n| **3.11** | κάτι |\n| **3.12** | κάτι |\n| **3.99** | CI only |\n',
      declarations: { '3.99': { reason: REASON } },
    }));
    expect(idsOf(v, STATES.GHOST_ROW)).toEqual([]);
    expect(idsOf(v, STATES.DECLARED_CI_ONLY)).toEqual(['3.99']);
  });

  it('Κ7: δήλωση ΧΩΡΙΣ ουσιαστικό λόγο ⇒ ⛔ reasonless-declaration', () => {
    const v = judge(world({
      guide: '| **3.10** | κ |\n| **3.11** | κ |\n| **3.12** | κ |\n| **3.99** | κ |\n',
      declarations: { '3.99': { reason: 'γιατί ναι' } },
    }));
    expect(idsOf(v, STATES.REASONLESS_DECLARATION)).toEqual(['3.99']);
  });

  it('Κ8: δήλωση για πύλη που ΟΝΤΩΣ τρέχει ⇒ ⛔ redundant-declaration (μη σαπίζει το μητρώο)', () => {
    const v = judge(world({ declarations: { '3.10': { reason: REASON } } }));
    expect(idsOf(v, STATES.REDUNDANT_DECLARATION)).toEqual(['3.10']);
  });

  it('Κ9: δήλωση χωρίς γραμμή στον οδηγό ⇒ ⛔ orphan-declaration', () => {
    const v = judge(world({ declarations: { '3.99': { reason: REASON } } }));
    expect(idsOf(v, STATES.ORPHAN_DECLARATION)).toEqual(['3.99']);
  });

  it('Κ10: η σειρά είναι ΑΡΙΘΜΗΤΙΚΗ — «3.5 < 3.11», ποτέ λεξικογραφική', () => {
    expect(['3.11', '3.5', '3.20'].sort(inventory.byGateNumber)).toEqual(['3.5', '3.11', '3.20']);
  });

  it('Κ11: FAIL-CLOSED — αρχείο-αυθεντία που λείπει ⇒ σφάλμα ΜΕ ΟΝΟΜΑ, ποτέ κενό σύνολο', () => {
    expect(() => inventory.takeInventory(path.join(__dirname, '__δεν_υπάρχει__')))
      .toThrow(/run-checks-parallel\.js λείπει/);
  });

  it('Κ12: η λογιστική ΚΛΕΙΝΕΙ — κάθε πύλη και κάθε δήλωση παίρνει ακριβώς μία κατάσταση', () => {
    const v = judge(world({ declarations: { '3.99': { reason: REASON } } }));
    const total = Object.values(v.tally).reduce((a, b) => a + b, 0);
    expect(total).toBe(v.rows.length);
    expect(new Set(v.rows.map((r) => r.id)).size).toBe(v.rows.length);
  });

  /** 🔑 Η ΒΑΘΜΟΝΟΜΗΣΗ: η πύλη τρέχει στο ΠΡΑΓΜΑΤΙΚΟ δέντρο και συμφωνεί με τη baseline. */
  it('Π1: στο ΠΡΑΓΜΑΤΙΚΟ δέντρο — καμία μπλοκάρουσα κατάσταση, και η baseline ταιριάζει', () => {
    const cli = require('../check-gate-inventory.js');
    const m = cli.measure();
    expect(m.blocking).toEqual([]);
    const baseline = JSON.parse(fs.readFileSync(cli.BASELINE_FILE, 'utf8'));
    expect(m.violationIds).toEqual(baseline.violations);
    expect(m.declarations).toEqual(baseline.declarations);
  });

  it('Π2: ο ΠΑΡΟΝΟΜΑΣΤΗΣ — το πραγματικό δέντρο ΟΝΤΩΣ έχει αδήλωτες πύλες (αλλιώς η πύλη δεν κοίταξε)', () => {
    const m = require('../check-gate-inventory.js').measure();
    expect(m.verdict.inv.counts.runs).toBeGreaterThan(40);
    expect(m.violationIds.length).toBeGreaterThan(0);
  });

  it('Π3: η σπορά ΑΡΝΕΙΤΑΙ να κλειδώσει μπλοκάρουσα κατάσταση σε baseline', () => {
    const cli = require('../check-gate-inventory.js');
    expect(() => cli.buildPayload({ blocking: [{ state: STATES.GHOST_ROW }], violationIds: [], declarations: [] }))
      .toThrow(/άρνηση σποράς/);
  });
});
