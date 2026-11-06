/**
 * ΑΓΚΥΡΕΣ — CHECK 3.115 / ADR-932, «λέει αυτό το μήνυμα "1 παραγγελίες";».
 *
 * Ομάδες:
 *   Κ — η κρίση ενός μηνύματος (`lib/i18n-plural/judge.js`), με τον parser του χρόνου εκτέλεσης
 *   Λ — οι κατηγορίες έρχονται από το CLDR, όχι από λίστα γραμμένη εδώ
 *   Δ — οι δηλώσεις αμετάβλητου: λόγος υποχρεωτικός, μπαγιάτικη δήλωση = ⛔
 *   Ρ — η διαδρομή ΚΡΙΣΗΣ (`runSetRatchetCli`) μπλοκάρει όντως — ραφή ένεσης, όχι το πραγματικό δέντρο
 *   Π — βαθμονόμηση στο πραγματικό δέντρο
 */

'use strict';

const judge = require('../lib/i18n-plural/judge');
const gate = require('../check-i18n-plural');
const ratchet = require('../lib/ratchet-baseline');

const { STATES, judgeMessage } = judge;
const states = (text, lang = 'el') => judgeMessage(text, lang).map((f) => f.state);

describe('Κ — η κρίση ενός μηνύματος', () => {
  it('Κ1: το περιστατικό — «{count} παραγγελίες» είναι σκέτο', () => {
    expect(states('{count} παραγγελίες')).toEqual([STATES.BARE]);
  });

  it('Κ2: η διόρθωσή του είναι πληθυντικός χωρίς εύρημα', () => {
    expect(states('{count, plural, one {# παραγγελία} other {# παραγγελίες}}')).toEqual([STATES.PLURAL]);
  });

  it('Κ3: `{count, number}` εκτός πληθυντικού είναι επίσης σκέτο', () => {
    expect(states('{count, number} orders', 'en')).toEqual([STATES.BARE]);
  });

  it('Κ4: `{count}` μέσα σε σκέλος του ΙΔΙΟΥ πληθυντικού δεν είναι σκέτο', () => {
    expect(states('{count, plural, =0 {καμία} one {μία} other {{count} παραγγελίες}}')).toEqual([STATES.PLURAL]);
  });

  it('Κ5: `{count}` μέσα σε πληθυντικό ΑΛΛΟΥ ορίσματος είναι σκέτο', () => {
    expect(states('{rows, plural, one {# γραμμή, {count} λάθη} other {# γραμμές, {count} λάθη}}')).toEqual([STATES.BARE]);
  });

  it('Κ6: `select` πάνω στο `count` φυλάει όπως το `plural`', () => {
    expect(states('{count, select, 0 {κανένα} other {{count}}}')).toEqual([]);
  });

  it('Κ7: οι ετικέτες αγνοούνται όπως στο `i18next-icu` (`ignoreTag`) — το `{count}` μέσα τους μετρά', () => {
    expect(states('<b>{count}</b> στοιχεία')).toEqual([STATES.BARE]);
  });

  it('Κ8: `=1` στη θέση του `one` ⇒ λείπει κατηγορία', () => {
    expect(states('{count, plural, =1 {# αρχείο} other {# αρχεία}}')).toEqual([STATES.MISSING_CATEGORY]);
  });

  it('Κ9: κατηγορία που η γλώσσα δεν επιλέγει ποτέ ⇒ νεκρό σκέλος', () => {
    expect(states('{count, plural, one {#} few {#} other {#}}')).toEqual([STATES.FOREIGN_CATEGORY]);
  });

  it('Κ10: `{{x}}` του i18next δεν αναλύεται ⇒ η οθόνη δείχνει το ωμό κείμενο', () => {
    expect(states('Τιμή {{p10}}')).toEqual([STATES.UNPARSABLE]);
  });

  it('Κ11: μήνυμα χωρίς ICU όρισμα, ή με άλλο όρισμα, δεν έχει τίποτα να πει', () => {
    expect(states('Αποθήκευση')).toEqual([]);
    expect(states('{decided} από {total}')).toEqual([]);
  });
});

describe('Λ — οι κατηγορίες έρχονται από το CLDR', () => {
  it('Λ1: ελληνικά και αγγλικά = one + other', () => {
    expect([...judge.pluralCategories('el', 'cardinal')].sort()).toEqual(['one', 'other']);
    expect([...judge.pluralCategories('en', 'cardinal')].sort()).toEqual(['one', 'other']);
  });

  it('Λ2: γλώσσα με περισσότερες μορφές καλύπτεται χωρίς αλλαγή γραμμής', () => {
    expect(states('{count, plural, one {# plik} other {# plików}}', 'pl')).toEqual([STATES.MISSING_CATEGORY]);
    expect(states('{count, plural, one {#} few {#} many {#} other {#}}', 'pl')).toEqual([STATES.PLURAL]);
  });

  it('Λ3: `selectordinal` κρίνεται με τους κανόνες ΤΑΚΤΙΚΩΝ (en: one/two/few/other)', () => {
    expect(states('{count, selectordinal, one {#st} other {#th}}', 'en')).toEqual([STATES.MISSING_CATEGORY]);
    expect(states('{count, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}', 'en')).toEqual([STATES.PLURAL]);
  });

  it('Λ4: γλώσσα που το Intl δεν γνωρίζει ⇒ σφάλμα με όνομα, ποτέ «καθαρό»', () => {
    expect(() => judge.pluralCategories('xx-invalid-ZZ', 'cardinal')).toThrow(/xx-invalid-ZZ/);
  });
});

/** Είσοδος πύλης στη μνήμη: `{ rel: κείμενο }` — ίδιο σχήμα με το `openGateInput`. */
function memoryInput(files) {
  return {
    files: (_roots, { accept }) => Object.keys(files).filter(accept),
    read: (f) => (Object.hasOwn(files, f) ? files[f] : null),
    rel: (f) => f,
  };
}

const LOCALE = 'src/i18n/locales/en/shop.json';
const declarations = (invariants) => JSON.stringify({ invariants });

describe('Δ — οι δηλώσεις αμετάβλητου', () => {
  it('Δ1: δηλωμένο σκέτο μήνυμα δεν είναι εύρημα', () => {
    const m = gate.measure([], memoryInput({
      [LOCALE]: JSON.stringify({ a: '{count} pending' }),
      [gate.DECLARATIONS_FILE]: declarations({ 'en/shop:a': '«pending» has no number inflection in English.' }),
    }));
    expect(m.violationIds).toEqual([]);
    expect(m.tally[STATES.DECLARED]).toBe(1);
    expect(m.zeroTolerance).toEqual([]);
  });

  it('Δ2: δήλωση χωρίς λόγο ⇒ ⛔', () => {
    const m = gate.measure([], memoryInput({
      [LOCALE]: JSON.stringify({ a: '{count} pending' }),
      [gate.DECLARATIONS_FILE]: declarations({ 'en/shop:a': '' }),
    }));
    expect(m.zeroTolerance.map((z) => z.state)).toEqual([gate.DECL.WITHOUT_REASON]);
  });

  it('Δ3: δήλωση για μήνυμα που ΔΕΝ είναι πια σκέτο ⇒ ⛔ (κρύβει την επόμενη παλινδρόμηση)', () => {
    const m = gate.measure([], memoryInput({
      [LOCALE]: JSON.stringify({ a: '{count, plural, one {# order} other {# orders}}' }),
      [gate.DECLARATIONS_FILE]: declarations({ 'en/shop:a': 'Was invariant before the fix, now stale.' }),
    }));
    expect(m.zeroTolerance.map((z) => z.state)).toEqual([gate.DECL.STALE]);
  });

  it('Δ4: η δήλωση καλύπτει ΜΟΝΟ το σκέτο — όχι λάθος κατηγορία', () => {
    const m = gate.measure([], memoryInput({
      [LOCALE]: JSON.stringify({ a: '{count, plural, =1 {# file} other {# files}}' }),
      [gate.DECLARATIONS_FILE]: declarations({ 'en/shop:a': 'Trying to silence a missing category.' }),
    }));
    expect(m.violationIds).toEqual([`${STATES.MISSING_CATEGORY} en/shop:a`]);
    expect(m.zeroTolerance.map((z) => z.state)).toEqual([gate.DECL.STALE]);
  });
});

/** Τρέχει τη ΔΙΑΔΡΟΜΗ ΚΡΙΣΗΣ με ραφή ένεσης· πιάνει το `process.exit` χωρίς να σκοτώσει τον runner. */
async function judgeExit(files, baselineIds) {
  const baselineFile = 'baseline.json';
  const input = memoryInput({
    ...files,
    [baselineFile]: JSON.stringify({ violations: baselineIds, declarations: [] }),
  });
  const realExit = process.exit;
  const realErr = console.error;
  const realLog = console.log;
  const codes = [];
  process.exit = (c) => { codes.push(c); throw new Error('__exit__'); };
  console.error = () => {};
  console.log = () => {};
  try {
    await ratchet.runSetRatchetCli({ ...gate.descriptor, baselineFile, input }, ['node', 'gate']);
  } catch (e) {
    if (e.message !== '__exit__') throw e;
  } finally {
    process.exit = realExit; console.error = realErr; console.log = realLog;
  }
  return codes;
}

describe('Ρ — η διαδρομή κρίσης μπλοκάρει όντως', () => {
  const bare = { [LOCALE]: JSON.stringify({ a: '{count} orders' }) };

  it('Ρ1: νέο σκέτο μήνυμα, άγνωστο στη baseline ⇒ έξοδος 1', async () => {
    expect(await judgeExit(bare, [])).toEqual([1]);
  });

  it('Ρ2: το ίδιο μήνυμα, ήδη στη baseline ⇒ έξοδος 0', async () => {
    expect(await judgeExit(bare, ['bare-count en/shop:a'])).toEqual([0]);
  });

  it('Ρ3: ανταλλαγή (διορθώθηκε το α, χάλασε το β) ⇒ έξοδος 1 — γι\' αυτό ταυτότητα και όχι αριθμός', async () => {
    const swapped = { [LOCALE]: JSON.stringify({ a: '{count, plural, one {# order} other {# orders}}', b: '{count} items' }) };
    expect(await judgeExit(swapped, ['bare-count en/shop:a'])).toEqual([1]);
  });

  it('Ρ4: ⛔ (νεκρό σκέλος) μπλοκάρει ΑΚΟΜΑ ΚΙ ΑΝ η baseline είναι ικανοποιημένη', async () => {
    const dead = { [LOCALE]: JSON.stringify({ a: '{count, plural, one {#} few {#} other {#}}' }) };
    expect(await judgeExit(dead, [])).toEqual([1]);
  });

  it('Ρ5: καθαρό ⇒ έξοδος 0', async () => {
    const clean = { [LOCALE]: JSON.stringify({ a: '{count, plural, one {# order} other {# orders}}' }) };
    expect(await judgeExit(clean, [])).toEqual([0]);
  });
});

describe('Π — βαθμονόμηση στο πραγματικό δέντρο', () => {
  const { openGateInput } = require('../lib/gate-input');
  const real = gate.measure([], openGateInput({ root: ratchet.PROJECT_ROOT }));

  it('Π1: το περιστατικό είναι διορθωμένο — «Παραγγελίες Αγοράς» και στις δύο γλώσσες', () => {
    for (const lang of ['el', 'en']) {
      expect(real.violationIds).not.toContain(`${STATES.BARE} ${lang}/procurement:hub.purchaseOrders.count`);
    }
  });

  it('Π2: ο παρονομαστής — η πύλη ΕΙΔΕ αρχεία και μηνύματα (ένα «0» από άδεια σάρωση δεν είναι «καθαρό»)', () => {
    expect(real.files).toBeGreaterThan(200);
    expect(real.tally[STATES.PLURAL]).toBeGreaterThan(500);
  });

  it('Π3: κανένα ⛔ στο σημερινό δέντρο', () => {
    expect(real.zeroTolerance).toEqual([]);
  });

  it('Π4: το δέντρο δεν ξεπερνά τη baseline (κάθε ταυτότητα είναι γνωστή)', () => {
    const baseline = require('../../.i18n-plural-baseline.json');
    const known = new Set(baseline.violations);
    expect(real.violationIds.filter((id) => !known.has(id))).toEqual([]);
  });
});
