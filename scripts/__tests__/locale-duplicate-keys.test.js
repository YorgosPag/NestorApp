/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΕΣ — CHECK 3.71 / ADR-810, «διπλά κλειδιά σε locale JSON».
 *
 * ⚠️ ΒΑΘΜΟΝΟΜΗΣΗ ΣΕ ΠΡΑΓΜΑΤΙΚΟ ΙΣΤΟΡΙΚΟ (`git show <καρφωμένο>:`), ποτέ σε fixture:
 * ένα fixture αποδεικνύει ότι η πύλη αντιδρά σε ό,τι της έγραψα εγώ· μόνο ο πραγματικός
 * κώδικας αποδεικνύει ότι θα είχε πιάσει τη ζωντανή βλάβη — **360 νεκρές μεταφράσεις**.
 * ⚠️ **ΚΑΡΦΩΜΕΝΟ commit, ΠΟΤΕ `HEAD`**· το `gitShow` **σκάει** σε κενή απάντηση.
 */

'use strict';

const { execFileSync } = require('node:child_process');

const gate = require('../check-locale-duplicate-keys');
const { findDuplicateKeys, dottedName } = require('../lib/i18n/duplicate-keys');

const ROOT = gate.PROJECT_ROOT;
const PINNED = 'ff307a28';   // η κατάσταση ΠΡΙΝ τη συγχώνευση (ADR-810 §2)

function gitShow(rev, relPath) {
  const out = execFileSync('git', ['show', `${rev}:${relPath}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (!out || !out.trim()) throw new Error(`gitShow κενό: ${rev}:${relPath} — άκυρη βαθμονόμηση`);
  return out;
}
const namesIn = (text) => findDuplicateKeys(text).map(dottedName);

const HISTORIC = [
  ['src/i18n/locales/el/common.json', 'audit.fields', '177 ετικέτες πεδίων ανά γλώσσα, νεκρές'],
  ['src/i18n/locales/en/common.json', 'audit.fields', 'ίδιο, αγγλικά'],
  ['src/i18n/locales/el/projects.json', 'documents', 'selectForContracts + selectForDocuments'],
  ['src/i18n/locales/en/projects.json', 'documents', 'ίδιο, αγγλικά'],
  ['src/i18n/locales/el/admin.json', 'roleManagement.unnamed', 'ίδιο κλειδί, ΑΛΛΗ τιμή'],
  ['src/i18n/locales/el/crm-inbox.json', 'calendarPage.toolbar', 'αντικείμενο, δύο φορές'],
];

describe('Π — βαθμονόμηση σε πραγματικό ιστορικό', () => {
  it.each(HISTORIC)('Π1 — %s: το «%s» ΠΙΑΝΕΤΑΙ (%s)', (rel, key) => {
    expect(namesIn(gitShow(PINNED, rel))).toContain(key);
  });

  it.each(HISTORIC)('Π2 — %s: η ΣΗΜΕΡΙΝΗ εκδοχή είναι ΚΑΘΑΡΗ (ο παρονομαστής)', (rel) => {
    const fs = require('node:fs');
    expect(namesIn(fs.readFileSync(`${ROOT}/${rel}`, 'utf8'))).toEqual([]);
  });

  it('🔴 Π3 — Η ΣΥΓΧΩΝΕΥΣΗ ΔΕΝ ΑΛΛΑΞΕ ΚΑΜΙΑ ΟΡΑΤΗ ΤΙΜΗ (μηδέν οπτική αλλαγή)', () => {
    const fs = require('node:fs');
    const leaves = (o, pre, acc) => {
      for (const [k, v] of Object.entries(o)) {
        const q = pre ? `${pre}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, q, acc);
        else acc.set(q, JSON.stringify(v));
      }
      return acc;
    };
    // ⚠️ ΤΟ `audit.fields` ΜΕΤΑΚΟΜΙΣΕ σε δικό του namespace (ADR-810 §5): ήταν **27%**
    //    του `common.json`, που ταξιδεύει ΟΛΟΚΛΗΡΟ σε κάθε διαδρομή. Η ερώτηση της
    //    άγκυρας παραμένει «καμία ορατή τιμή δεν άλλαξε» — αλλά ο **σημερινός κόσμος**
    //    είναι η ΕΝΩΣΗ των δύο αρχείων. Χωρίς αυτό η άγκυρα θα κατήγγειλε τη
    //    **μετακόμιση** ως απώλεια.
    const AFTER_ALSO = { 'src/i18n/locales/el/common.json': 'src/i18n/locales/el/common-audit.json',
      'src/i18n/locales/en/common.json': 'src/i18n/locales/en/common-audit.json' };
    let checked = 0;
    for (const [rel] of HISTORIC) {
      // `JSON.parse` = ΑΚΡΙΒΩΣ ό,τι έβλεπε το i18next τότε (κρατά το τελευταίο).
      const before = leaves(JSON.parse(gitShow(PINNED, rel)), '', new Map());
      const after = leaves(JSON.parse(fs.readFileSync(`${ROOT}/${rel}`, 'utf8')), '', new Map());
      if (AFTER_ALSO[rel]) leaves(JSON.parse(fs.readFileSync(`${ROOT}/${AFTER_ALSO[rel]}`, 'utf8')), '', after);
      const changed = [...before].filter(([k, v]) => after.get(k) !== v);
      expect(`${rel}: ${changed.length} αλλαγμένες`).toBe(`${rel}: 0 αλλαγμένες`);
      checked += before.size;
    }
    expect(checked).toBeGreaterThan(3000);   // ΠΑΡΟΝΟΜΑΣΤΗΣ: όντως συγκρίθηκε κάτι
  });

  it('🔴 Π4 — ΚΑΙ ΕΠΕΣΤΡΕΨΑΝ τα χαμένα: 177 ετικέτες πεδίων ζουν πάλι', () => {
    const fs = require('node:fs');
    const before = JSON.parse(gitShow(PINNED, 'src/i18n/locales/el/common.json'));
    // ⚠️ ΝΕΟ ΣΠΙΤΙ: το `audit.fields` μετακόμισε στο `common-audit.json` (ADR-810 §5).
    const after = JSON.parse(fs.readFileSync(`${ROOT}/src/i18n/locales/el/common-audit.json`, 'utf8'));

    // ⚠️ Η ΠΡΩΤΗ ΓΡΑΦΗ ΤΗΣ ΑΓΚΥΡΑΣ ΥΠΕΘΕΣΕ ότι το `audit.fields.project` έλειπε
    // ολόκληρο. **Λάθος**: ο νικητής είχε `project.addresses` και **μόνο** αυτό — ο
    // χαμένος είχε τα υπόλοιπα. Η βλάβη ήταν **μερική**, δηλαδή ακόμη πιο ύπουλη:
    // ο κόμβος υπήρχε, οπότε κάθε έλεγχος «υπάρχει;» απαντούσε **ναι**.
    expect(Object.keys(before.audit.fields.project)).toEqual(['addresses']);
    expect(typeof after.audit.fields.project.name).toBe('string');

    // Και το παλιό σπίτι ΔΕΝ κρατά αντίγραφο — αλλιώς θα είχαμε δύο αλήθειες.
    const stillInCommon = JSON.parse(fs.readFileSync(`${ROOT}/src/i18n/locales/el/common.json`, 'utf8'));
    expect(stillInCommon.audit.fields).toBeUndefined();

    const leafCount = (o) => (o && typeof o === 'object' && !Array.isArray(o)
      ? Object.values(o).reduce((n, v) => n + leafCount(v), 0) : 1);
    const gained = leafCount(after.audit.fields) - leafCount(before.audit.fields);
    expect(`ανακτήθηκαν ${gained}`).toBe('ανακτήθηκαν 177');
  });
});

describe('Κ — το συμβόλαιο', () => {
  it('Κ1 — η ΛΟΓΙΣΤΙΚΗ ΚΛΕΙΝΕΙ και ο παρονομαστής δεν είναι μηδέν', () => {
    const m = gate.measure(['--all']);
    expect(m.files).toBeGreaterThan(150);
    expect(Object.values(m.tally).reduce((a, b) => a + b, 0)).toBe(m.files);
  });

  it('🔴 Κ2 — το ΠΡΑΓΜΑΤΙΚΟ δέντρο είναι ΚΑΘΑΡΟ (προϋπόθεση του zero-tolerance)', () => {
    const m = gate.measure(['--all']);
    expect(m.violations).toEqual([]);
  });

  it('🔴 Κ3 — ΤΟ `JSON.parse` ΕΙΝΑΙ ΤΥΦΛΟ — αυτός είναι όλος ο λόγος ύπαρξης', () => {
    const text = '{ "a": 1, "a": 2 }';
    expect(JSON.parse(text)).toEqual({ a: 2 });          // κανένα σφάλμα, καμία ένδειξη
    expect(namesIn(text)).toEqual(['a']);                // η πύλη το βλέπει
  });

  it('Κ4 — ΙΔΙΟ όνομα σε ΔΙΑΦΟΡΕΤΙΚΑ αντικείμενα ΔΕΝ είναι διπλότυπο', () => {
    expect(namesIn('{ "x": { "n": 1 }, "y": { "n": 2 } }')).toEqual([]);
  });

  it('Κ5 — το μονοπάτι ονομάζεται πλήρως, ώστε ο άνθρωπος να βρει τη θέση', () => {
    expect(namesIn('{ "a": { "b": { "c": 1, "c": 2 } } }')).toEqual(['a.b.c']);
  });

  it('🔴 Κ6 — συμβολοσειρά ΚΑΙ αντικείμενο στο ίδιο κλειδί (η περίπτωση `floor`)', () => {
    expect(namesIn('{ "f": "Όροφος", "f": { "id": "x" } }')).toEqual(['f']);
  });

  it('🔴 Κ7 — ελληνικά, escapes και αγκύλες ΜΕΣΑ σε τιμές δεν παρασύρουν τον σαρωτή', () => {
    const tricky = '{ "a": "τιμή με \\" και { } και [ ]", "b": ["{", "}"], "a": "δεύτερη" }';
    expect(JSON.parse(tricky).a).toBe('δεύτερη');
    expect(namesIn(tricky)).toEqual(['a']);
  });

  it('🔴 Κ8 — άκυρο JSON ⇒ ⛔ `unparsable`, ΠΟΤΕ σιωπηλό «καθαρό»', () => {
    expect(() => findDuplicateKeys('{ "a": ')).toThrow();
    expect(() => findDuplicateKeys('[1,2]')).toThrow(/δεν είναι αντικείμενο/);
  });

  it('Κ9 — η έξοδος διαφυγής υπάρχει και είναι ΜΙΑ', () => {
    process.env.SKIP_LOCALE_DUPLICATE_KEYS = '1';
    try { expect(gate.main(['--all'])).toBe(0); } finally { delete process.env.SKIP_LOCALE_DUPLICATE_KEYS; }
  });
});

describe('Μ — ο φρουρός είναι ΚΑΛΩΔΙΩΜΕΝΟΣ (ραφή ένεσης)', () => {
  const clean = () => ({ scope: 'all', files: 1, tally: {}, violations: [], blocking: [] });
  const dirty = () => ({
    scope: 'all', files: 1, tally: {},
    violations: [{ file: 'x.json', state: 'duplicate-key', detail: '«a» δηλώνεται 2 φορές' }],
    blocking: [{ file: 'x.json', state: 'duplicate-key', detail: '«a» δηλώνεται 2 φορές' }],
  });

  it('Μ0 — καθαρή μέτρηση ⇒ ΠΡΑΣΙΝΟ (ο παρονομαστής)', () => {
    expect(gate.main([], clean)).toBe(0);
  });

  it('🔴 Μ1 — βρώμικη μέτρηση ⇒ ΚΟΚΚΙΝΟ (χωρίς αυτό η πύλη είναι διακοσμητική)', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    try { expect(gate.main([], dirty)).toBe(1); } finally { err.mockRestore(); }
  });

  it('🔴 Μ2 — το `--report` τυπώνει και ΔΕΝ μπλοκάρει', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try { expect(gate.main(['--report'], dirty)).toBe(0); } finally { log.mockRestore(); }
  });
});
