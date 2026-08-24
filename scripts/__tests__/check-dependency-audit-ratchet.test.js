/**
 * ΑΓΚΥΡΑ ΔΙΑΤΗΡΗΣΗΣ ΑΙΤΙΟΛΟΓΗΣΗΣ — ADR-598 G2.
 *
 * ΤΙ ΦΥΛΑΕΙ: το `--write-baseline` ανανεώνει τα ΜΗΧΑΝΙΚΑ πεδία ενός advisory
 * (id/severity/title/cves/url) αλλά ΔΕΝ επιτρέπεται να αγγίξει την ΑΠΟΦΑΣΗ
 * (`reason`/`owner`), που τη γράφει άνθρωπος.
 *
 * ΓΙΑΤΙ: μέχρι 2026-08-24 ισοπέδωνε κάθε `reason` στο seed κείμενο. Στις 2026-07-26
 * γράφτηκαν δύο πλήρως αιτιολογημένες εγγραφές και το ADR κατέγραψε ρητά ότι η εντολή
 * «δεν χρησιμοποιήθηκε» για να μη σβηστούν — η επόμενη εκτέλεση τις έσβησε ούτως ή
 * άλλως. Χωρίς άγκυρα, η διόρθωση είναι σχόλιο.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { writeBaseline, loadBaseline } = require('../check-dependency-audit-ratchet.js');

const SEED_REASON = 'Seeded — pre-existing transitive advisory; tracked for remediation';
const HUMAN_REASON = 'ADR-598 G2 (2026-07-26) — install-time only, ΔΕΝ αναβαθμίζεται· το ρίσκο της αλλαγής ξεπερνά το ρίσκο του CVE.';

/** Ένα advisory όπως το δίνει το `extractGatedAdvisories`. */
function advisory(over = {}) {
  return {
    id: 111,
    severity: 'high',
    module: 'tar',
    title: 'κάποιο DoS',
    cves: ['CVE-2026-00001'],
    url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
    ...over,
  };
}

function withTempBaseline(initial, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deps-audit-'));
  const file = path.join(dir, '.pnpm-audit-baseline.json');
  if (initial) fs.writeFileSync(file, JSON.stringify(initial, null, 2) + '\n');
  try {
    return fn(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('deps-audit --write-baseline: η ΑΠΟΦΑΣΗ δεν ανήκει στο εργαλείο (ADR-598 G2)', () => {
  let logSpy;
  beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined); });
  afterEach(() => { logSpy.mockRestore(); });

  it('Α) ΔΙΑΤΗΡΕΙ ανθρώπινη αιτιολόγηση ΚΑΙ ιδιοκτήτη υπάρχουσας εγγραφής', () => {
    const initial = {
      allowed: {
        'GHSA-aaaa-bbbb-cccc': { ...advisory(), reason: HUMAN_REASON, owner: 'security-team' },
      },
    };
    withTempBaseline(initial, (file) => {
      writeBaseline({ 'GHSA-aaaa-bbbb-cccc': advisory() }, file);
      const e = loadBaseline(file).allowed['GHSA-aaaa-bbbb-cccc'];
      expect(e.reason).toBe(HUMAN_REASON);
      // Ο ιδιοκτήτης είναι ΚΙ ΑΥΤΟΣ απόφαση: το 'giorgio' είναι προεπιλογή για ΝΕΑ
      // εγγραφή, ποτέ επιβολή πάνω σε υπάρχουσα (μετάλλαξη Μ2 — έβγαινε πράσινη).
      expect(e.owner).toBe('security-team');
    });
  });

  it('Β) ΑΝΑΝΕΩΝΕΙ τα μηχανικά πεδία, ακόμα κι όταν διατηρεί την αιτιολόγηση', () => {
    const initial = {
      allowed: {
        'GHSA-aaaa-bbbb-cccc': {
          ...advisory({ severity: 'low', title: 'παλιός τίτλος', cves: [] }),
          reason: HUMAN_REASON,
          owner: 'giorgio',
        },
      },
    };
    withTempBaseline(initial, (file) => {
      writeBaseline({ 'GHSA-aaaa-bbbb-cccc': advisory({ severity: 'critical', title: 'νέος τίτλος' }) }, file);
      const e = loadBaseline(file).allowed['GHSA-aaaa-bbbb-cccc'];
      expect(e.severity).toBe('critical');
      expect(e.title).toBe('νέος τίτλος');
      expect(e.cves).toEqual(['CVE-2026-00001']);
      expect(e.reason).toBe(HUMAN_REASON);   // η απόφαση μένει
    });
  });

  it('Γ) ΝΕΟ advisory παίρνει το seed placeholder', () => {
    withTempBaseline({ allowed: {} }, (file) => {
      writeBaseline({ 'GHSA-new-0000-0000': advisory() }, file);
      expect(loadBaseline(file).allowed['GHSA-new-0000-0000'].reason).toBe(SEED_REASON);
    });
  });

  it('Δ) ΚΛΑΔΕΥΕΙ εγγραφή που δεν αναφέρεται πια (ο μηχανισμός ratchet)', () => {
    const initial = {
      allowed: {
        'GHSA-stale-000-000': { ...advisory(), reason: HUMAN_REASON, owner: 'giorgio' },
        'GHSA-aaaa-bbbb-cccc': { ...advisory(), reason: SEED_REASON, owner: 'giorgio' },
      },
    };
    withTempBaseline(initial, (file) => {
      writeBaseline({ 'GHSA-aaaa-bbbb-cccc': advisory() }, file);
      const allowed = loadBaseline(file).allowed;
      expect(Object.keys(allowed)).toEqual(['GHSA-aaaa-bbbb-cccc']);
      expect(allowed['GHSA-stale-000-000']).toBeUndefined();
    });
  });

  it('Ε) λειτουργεί χωρίς προϋπάρχουσα baseline (πρώτο seed)', () => {
    withTempBaseline(null, (file) => {
      writeBaseline({ 'GHSA-aaaa-bbbb-cccc': advisory() }, file);
      expect(loadBaseline(file).allowed['GHSA-aaaa-bbbb-cccc'].reason).toBe(SEED_REASON);
    });
  });

  it('ΣΤ) κλειστή λογιστική — τυπώνονται ΚΑΙ ΟΙ ΤΡΕΙΣ κάδοι, ακόμα και στο μηδέν', () => {
    withTempBaseline({ allowed: {} }, (file) => {
      writeBaseline({}, file);
      const printed = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(printed).toMatch(/διατηρήθηκαν αιτιολογήσεις: 0/);
      expect(printed).toMatch(/νέες \(seed placeholder\):\s+0/);
      expect(printed).toMatch(/κλαδεύτηκαν \(δεν αναφέρονται πια\): 0/);
    });
  });
});
