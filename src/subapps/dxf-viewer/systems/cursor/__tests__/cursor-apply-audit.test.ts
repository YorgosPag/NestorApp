/**
 * Tests — ADR-739 §31.11, το **όργανο** του δείκτη (`cursor-apply-audit`).
 *
 * Ένα διαγνωστικό όργανο που δεν δοκιμάζεται είναι σχόλιο: αν σιωπά όταν πρέπει να μιλήσει,
 * θα διαβαστεί ως «δεν συνέβη τίποτα» — δηλαδή θα **παραπλανήσει** τη διάγνωση αντί να τη
 * βοηθήσει. Τα tests καρφώνουν τις τέσσερις ιδιότητες που το κάνουν αξιόπιστο:
 *
 *  1. **Σιωπή όταν είναι σβηστό** — αλλιώς πληρώνει ο hot path του `mousemove`.
 *  2. **Ο δακτύλιος δεν μεγαλώνει ποτέ**, και κρατά τις **τελευταίες** εγγραφές (η τελευταία
 *     είναι αυτή που «έμεινε στην οθόνη» — ολόκληρο το ερώτημα του Α1).
 *  3. **Το αποτύπωμα ταυτοποιεί ράστερ**: ίδια συμβολοσειρά ⇒ ίδιο αποτύπωμα. Αυτή είναι η
 *     ερώτηση «βλέπει ο browser νέα εικόνα;», που είναι η προϋπόθεση του τεκμηριωμένου flicker.
 *  4. **Η συμπίεση δείχνει τις μεταβάσεις** — χωρίς αυτή, 300 ωμές σειρές δεν διαβάζονται.
 */
import {
  __resetCursorAuditForTests,
  buildCursorAuditReport,
  fingerprintCursorValue,
  getCursorAuditRecords,
  isCursorAuditEnabled,
  noteCursorApply,
  noteCursorProbe,
  resetCursorAudit,
  setCursorAuditEnabled,
} from '../cursor-apply-audit';
import type { TableIndicatorHit } from '../../../bim/table/table-indicator-geometry';

const COLUMN_HIT: TableIndicatorHit = { axis: 'column', colId: 'c1', index: 2 };
const ROW_HIT: TableIndicatorHit = { axis: 'row', rowId: 'r1', index: 5 };

/** Δύο τιμές δείκτη με σχήμα data-URL, ώστε το αποτύπωμα να έχει κάτι να συρρικνώσει. */
const PNG_A = 'url("data:image/png;base64,AAAABBBBCCCC") 10 10, pointer';
const PNG_B = 'url("data:image/png;base64,ZZZZYYYYXXXX") 10 10, pointer';

beforeEach(() => {
  __resetCursorAuditForTests();
});

describe('§31.11 — σιωπή όταν είναι σβηστό', () => {
  it('εξ ορισμού είναι σβηστό και δεν καταγράφει τίποτα', () => {
    expect(isCursorAuditEnabled()).toBe(false);
    noteCursorProbe('ok', 'column-select', COLUMN_HIT, 100, 50);
    noteCursorApply('table', 'column-select', PNG_A, 1);
    expect(getCursorAuditRecords()).toHaveLength(0);
  });

  it('το σβήσιμο σταματά την καταγραφή χωρίς να σβήσει ό,τι έχει ήδη μαζευτεί', () => {
    setCursorAuditEnabled(true);
    noteCursorProbe('ok', 'column-select', COLUMN_HIT, 1, 2);
    setCursorAuditEnabled(false);
    noteCursorProbe('ok', 'row-select', ROW_HIT, 3, 4);
    expect(getCursorAuditRecords()).toHaveLength(1);
  });

  it('το άνοιγμα ΜΗΔΕΝΙΖΕΙ — μια μέτρηση αρχίζει από καθαρό δακτύλιο', () => {
    setCursorAuditEnabled(true);
    noteCursorProbe('ok', 'column-select', COLUMN_HIT, 1, 2);
    setCursorAuditEnabled(false);
    setCursorAuditEnabled(true);
    expect(getCursorAuditRecords()).toHaveLength(0);
  });

  it('το `reset` αδειάζει τον δακτύλιο ΧΩΡΙΣ να κλείσει το όργανο', () => {
    setCursorAuditEnabled(true);
    noteCursorProbe('ok', null, null, 1, 2);
    resetCursorAudit();
    expect(getCursorAuditRecords()).toHaveLength(0);
    expect(isCursorAuditEnabled()).toBe(true);
  });
});

describe('§31.11 — ο δακτύλιος', () => {
  it('δεν ξεπερνά το όριο και κρατά τις ΤΕΛΕΥΤΑΙΕΣ εγγραφές', () => {
    setCursorAuditEnabled(true);
    for (let i = 0; i < 700; i++) noteCursorProbe('ok', null, null, i, 0);
    const rows = getCursorAuditRecords();
    expect(rows).toHaveLength(600);
    // Η τελευταία εγγραφή είναι το τελευταίο συμβάν — αυτό ακριβώς ρωτά το Α1.
    expect(rows[rows.length - 1].x).toBe(699);
    // Οι πρώτες 100 έπεσαν έξω.
    expect(rows[0].x).toBe(100);
  });

  it('τα ορίσματα καταγράφονται ακέραια, με τον ΛΟΓΟ κάθε σάρωσης', () => {
    setCursorAuditEnabled(true);
    noteCursorProbe('no-world', null, null, 7, 9);
    const [row] = getCursorAuditRecords();
    expect(row).toMatchObject({ kind: 'probe', reason: 'no-world', role: null, hit: '-', x: 7, y: 9 });
  });

  it('η υποδιαίρεση γίνεται κείμενο ΜΕΣΑ στον φρουρό, ανά άξονα', () => {
    setCursorAuditEnabled(true);
    noteCursorProbe('ok', 'column-select', COLUMN_HIT, 0, 0);
    noteCursorProbe('ok', 'row-select', ROW_HIT, 0, 0);
    expect(getCursorAuditRecords().map((r) => r.hit)).toEqual(['col#2', 'row#5']);
  });

  it('η εγγραφή δείκτη κρατά κλάδο, ρόλο και dpr', () => {
    setCursorAuditEnabled(true);
    noteCursorApply('navwheel', 'column-select', 'default', 1.25);
    expect(getCursorAuditRecords()[0]).toMatchObject({
      kind: 'apply', branch: 'navwheel', role: 'column-select', dpr: 1.25, fingerprint: 'default',
    });
  });
});

describe('§31.11 — το αποτύπωμα ταυτοποιεί το ράστερ', () => {
  it('οι λέξεις-κλειδιά περνούν αυτούσιες (δεν υπάρχει εικόνα να ταυτοποιηθεί)', () => {
    expect(fingerprintCursorValue('col-resize')).toBe('col-resize');
    expect(fingerprintCursorValue('none')).toBe('none');
  });

  it('ΙΔΙΑ συμβολοσειρά ⇒ ΙΔΙΟ αποτύπωμα — η προϋπόθεση του «καμία νέα εικόνα»', () => {
    expect(fingerprintCursorValue(PNG_A)).toBe(fingerprintCursorValue(PNG_A));
  });

  it('ΔΙΑΦΟΡΕΤΙΚΟ ράστερ ⇒ διαφορετικό αποτύπωμα', () => {
    expect(fingerprintCursorValue(PNG_A)).not.toBe(fingerprintCursorValue(PNG_B));
  });

  it('ξεχωρίζει `image-set(...)` από σκέτο `url(...)` — δύο διαδρομές εκπομπής, δύο ονόματα', () => {
    expect(fingerprintCursorValue(PNG_A).startsWith('url:')).toBe(true);
    expect(fingerprintCursorValue(`image-set(${PNG_A}) 2x`).startsWith('set:')).toBe(true);
  });

  it('το αποτύπωμα δεν κουβαλά το data-URL (ο δακτύλιος θα γινόταν megabytes)', () => {
    const huge = `url("data:image/png;base64,${'Q'.repeat(4000)}") 10 10, pointer`;
    expect(fingerprintCursorValue(huge).length).toBeLessThan(40);
  });
});

describe('§31.11 — η αναφορά', () => {
  it('όταν ο δακτύλιος είναι άδειος λέει ΠΩΣ ανοίγει, όχι απλώς «κενό»', () => {
    expect(buildCursorAuditReport()).toContain('__cursorAudit.on()');
  });

  it('συμπιέζει διαδοχικές ίδιες σαρώσεις σε ΕΝΑ τρέξιμο με πλήθος', () => {
    setCursorAuditEnabled(true);
    for (let i = 0; i < 5; i++) noteCursorProbe('ok', 'column-select', COLUMN_HIT, i, 40);
    expect(buildCursorAuditReport()).toContain('column-select ×5');
  });

  it('🔴 κάνει ΟΡΑΤΗ την ταλάντωση: εναλλαγή ρόλων ⇒ πολλαπλά τρεξίματα', () => {
    setCursorAuditEnabled(true);
    for (let i = 0; i < 3; i++) {
      noteCursorProbe('ok', 'column-select', COLUMN_HIT, i, 40);
      noteCursorProbe('ok', 'column-resize', null, i, 40);
    }
    const report = buildCursorAuditReport();
    // 6 εναλλαγές = 6 τρεξίματα του ενός. Αν η συμπίεση τα ένωνε, το τρεμόπαιγμα θα κρυβόταν.
    expect(report).toContain('ΣΑΡΩΣΕΙΣ (η ΑΙΤΙΑ)  — 6 μεταβάσεις');
  });

  it('ο λόγος μιας αποτυχημένης σάρωσης εμφανίζεται σε παρένθεση, ξεχωριστά από τον ρόλο', () => {
    setCursorAuditEnabled(true);
    noteCursorProbe('ok', 'column-select', COLUMN_HIT, 1, 1);
    noteCursorProbe('no-world', null, null, 1, 1);
    const report = buildCursorAuditReport();
    expect(report).toContain('(no-world) ×1');
  });

  it('μετρά ΠΟΣΑ ΔΙΑΚΡΙΤΑ ράστερ είδε ο browser — η ερώτηση του flicker', () => {
    setCursorAuditEnabled(true);
    noteCursorApply('table', 'column-select', PNG_A, 1);
    noteCursorApply('table', 'column-select', PNG_A, 1);
    noteCursorApply('crosshair', null, PNG_B, 1);
    expect(buildCursorAuditReport()).toContain('ΔΙΑΚΡΙΤΑ ΑΠΟΤΥΠΩΜΑΤΑ: 2');
  });

  it('η ουρά τυπώνει τις ωμές εγγραφές, ώστε η συμπίεση να μην μπορεί να κρύψει κάτι', () => {
    setCursorAuditEnabled(true);
    noteCursorProbe('leave', null, null, -1, -1);
    const report = buildCursorAuditReport();
    expect(report).toContain('ΤΕΛΕΥΤΑΙΕΣ');
    expect(report).toContain('probe leave');
  });
});
