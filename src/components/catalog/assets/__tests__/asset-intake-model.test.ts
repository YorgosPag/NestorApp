/**
 * @jest-environment node
 *
 * @fileoverview **Η εισαγωγή αρχείων στη βιβλιοθήκη μέσων** — προτάσεις, προέλεγχος, συνέχεια από το στάδιο (ADR-923 §5.10.4).
 */

import type { AssetRecord } from '@/services/catalog/catalog-api.client';
import {
  baseNameOf,
  fileFactsOf,
  intakeRowIssues,
  intakeRowsFor,
  isStartable,
  kindForRole,
  kindOfFile,
  nextStageOf,
  uniqueCode,
  type IntakeRow,
} from '../asset-intake-model';
import { assumedProfileKind } from '../asset-labels';

const MIB = 1024 * 1024;

/** Ένα `File` του browser χωρίς bytes — μέγεθος δηλωμένο (μόνο αυτό διαβάζει ο προέλεγχος). */
function fakeFile(name: string, type: string, size = 1024): File {
  return { name, type, size } as File;
}

const NO_CODES: ReadonlySet<string> = new Set();
const keyOf = (index: number) => `k${index}`;

function rowFor(file: File, overrides: Partial<IntakeRow> = {}): IntakeRow {
  return { ...intakeRowsFor([file], NO_CODES, keyOf)[0], ...overrides };
}

describe('προτάσεις από το αρχείο', () => {
  it('Π1 — κάθε είδος αρχείου παίρνει τον ρόλο του και το είδος του', () => {
    const rows = intakeRowsFor([
      fakeFile('Fan coil 016.jpg', 'image/jpeg'),
      fakeFile('Datasheet MFP.pdf', 'application/pdf'),
      fakeFile('mfp.ifc', ''),
      fakeFile('mfp.rfa', 'application/octet-stream'),
      fakeFile('demo.mp4', 'video/mp4'),
    ], NO_CODES, keyOf);
    expect(rows.map((row) => [row.role, row.kind])).toEqual([
      ['photo', 'image'], ['datasheet', 'document'], ['bim', 'bim'], ['bim', 'bim'], ['video', 'video'],
    ]);
  });

  it('Π2 — κωδικός από το όνομα (ελληνικά ⇒ λατινικά), ετικέτα = όνομα χωρίς κατάληξη', () => {
    const [row] = intakeRowsFor([fakeFile('Φωτογραφία προϊόντος.JPG', 'image/jpeg')], NO_CODES, keyOf);
    expect(row.label).toBe('Φωτογραφία προϊόντος');
    expect(row.code).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(baseNameOf('.hidden')).toBe('.hidden');
  });

  it('Π3 — κωδικοί μοναδικοί απέναντι στη βιβλιοθήκη ΚΑΙ μέσα στη δέσμη', () => {
    const rows = intakeRowsFor([fakeFile('a.jpg', 'image/jpeg'), fakeFile('a.png', 'image/png')], new Set(['a']), keyOf);
    expect(rows.map((row) => row.code)).toEqual(['a_2', 'a_3']);
    expect(uniqueCode('x'.repeat(64), new Set(['x'.repeat(64)]))).toHaveLength(64);
  });

  it('Π4 — ρόλος με δύο είδη (σχέδιο): το είδος του αρχείου κερδίζει', () => {
    expect(kindForRole('drawing', 'document')).toBe('document');
    expect(kindForRole('drawing', 'image')).toBe('image');
    expect(kindForRole('photo', 'document')).toBe('image');
  });

  it('Π5 — αρχείο χωρίς είδος (zip) ⇒ κανένα είδος, και ο προέλεγχος το λέει', () => {
    const zip = fakeFile('pack.zip', 'application/zip');
    expect(kindOfFile(fileFactsOf(zip))).toBeNull();
    expect(intakeRowIssues(rowFor(zip), NO_CODES, []).map((issue) => issue.code)).toEqual(['fileKindMismatch']);
  });
});

describe('προέλεγχος πριν από κάθε byte (ίδια κρίση με τον διακομιστή)', () => {
  it('Ε1 — PDF μετονομασμένο σε .jpg ⇒ αντίφαση κατάληξης/MIME', () => {
    const row = rowFor(fakeFile('photo.jpg', 'application/pdf'));
    expect(intakeRowIssues(row, NO_CODES, []).map((issue) => issue.code)).toEqual(['fileTypeConflict']);
  });

  it('Ε2 — εικόνα πάνω από 200 MB ⇒ fileTooLarge με το όριο', () => {
    const issues = intakeRowIssues(rowFor(fakeFile('print.tif', 'image/tiff', 201 * MIB)), NO_CODES, []);
    expect(issues).toEqual([{ code: 'fileTooLarge', path: 'fileId', params: { maxMb: 200 } }]);
  });

  it('Ε3 — PDF σε μέσο «εικόνα» ⇒ fileKindMismatch', () => {
    const row = rowFor(fakeFile('spec.pdf', 'application/pdf'), { role: 'photo', kind: 'image' });
    expect(intakeRowIssues(row, NO_CODES, []).map((issue) => issue.code)).toEqual(['fileKindMismatch']);
  });

  it('Ε4 — διπλός κωδικός (βιβλιοθήκη ή δέσμη) και άκυρος κωδικός', () => {
    const row = rowFor(fakeFile('a.jpg', 'image/jpeg'), { code: 'a' });
    expect(intakeRowIssues(row, new Set(['a']), ['a']).map((issue) => issue.code)).toEqual(['duplicateCode']);
    expect(intakeRowIssues(row, NO_CODES, ['a', 'a']).map((issue) => issue.code)).toEqual(['duplicateCode']);
    expect(intakeRowIssues({ ...row, code: '1abc' }, NO_CODES, []).map((issue) => issue.code)).toEqual(['invalidCode']);
  });

  it('Ε5 — μετά τη δημιουργία ο κωδικός δεν κρίνεται ξανά (είναι πλέον η ταυτότητα)', () => {
    const asset = { id: 'casst_1', code: 'a', revision: 1 } as AssetRecord;
    const row = rowFor(fakeFile('a.jpg', 'image/jpeg'), { code: 'a', asset });
    expect(intakeRowIssues(row, new Set(['a']), ['a'])).toEqual([]);
  });
});

describe('συνέχεια από το στάδιο της αποτυχίας', () => {
  const file = fakeFile('a.jpg', 'image/jpeg');
  const asset = { id: 'casst_1', code: 'a', revision: 1 } as AssetRecord;

  it('Σ1 — create → upload → attach → τέλος', () => {
    expect(nextStageOf(rowFor(file))).toBe('create');
    expect(nextStageOf(rowFor(file, { asset }))).toBe('upload');
    expect(nextStageOf(rowFor(file, { asset, fileId: 'f1' }))).toBe('attach');
    expect(nextStageOf(rowFor(file, { asset, fileId: 'f1', status: { kind: 'done' } }))).toBeNull();
  });

  it('Σ2 — αποτυχία στη σύνδεση ⇒ η επανάληψη ΔΕΝ ξανανεβάζει (το fileId κρατήθηκε)', () => {
    const failed = rowFor(file, { asset, fileId: 'f1', status: { kind: 'failed', stage: 'attach', reason: 'network', issues: [] } });
    expect(isStartable(failed)).toBe(true);
    expect(nextStageOf(failed)).toBe('attach');
  });

  it('Σ3 — γραμμή σε αναμονή ή σε εκτέλεση δεν ξαναξεκινά', () => {
    expect(isStartable(rowFor(file, { status: { kind: 'queued' } }))).toBe(false);
    expect(isStartable(rowFor(file, { status: { kind: 'running', stage: 'upload', progress: 0.5 } }))).toBe(false);
  });
});

describe('ζωντανή επαλήθευση 2026-10-26 — ψευδής «διπλός κωδικός» ενώ η γραμμή τρέχει', () => {
  it('🔴 Ζ1 η αισιόδοξη εγγραφή της ΙΔΙΑΣ γραμμής δεν είναι «άλλος» κωδικός: όσο τρέχει, ο κωδικός δεν ξανακρίνεται', () => {
    const row = rowFor(fakeFile('a.jpg', 'image/jpeg'), { code: 'a', status: { kind: 'running', stage: 'create', progress: 0 } });
    expect(intakeRowIssues(row, new Set(['a']), ['a'])).toEqual([]);
    expect(intakeRowIssues({ ...row, status: { kind: 'queued' } }, new Set(['a']), ['a'])).toEqual([]);
  });

  it('🔴 Ζ2 το εύρημα «διπλός κωδικός» κουβαλά τον κωδικό (το μήνυμα έχει {code})', () => {
    const row = rowFor(fakeFile('a.jpg', 'image/jpeg'), { code: 'a' });
    expect(intakeRowIssues(row, new Set(['a']), ['a'])).toEqual([{ code: 'duplicateCode', path: 'code', params: { code: 'a' } }]);
  });
});

describe('ζωντανή επαλήθευση 2026-10-26 — η ετικέτα έλεγε το αντίθετο από τα bytes', () => {
  it('🔴 Ζ3 CMYK χωρίς προφίλ: η εκτύπωση ΚΡΑΤΑ τους αριθμούς (όχι «ως sRGB»)· η οθόνη λέει «γενικό CMYK»', () => {
    expect(assumedProfileKind('print', 'cmyk')).toBe('cmykPrint');
    expect(assumedProfileKind('web', 'cmyk')).toBe('cmykWeb');
    expect(assumedProfileKind('web', 'rgb')).toBe('rgb');
    expect(assumedProfileKind('print', null)).toBe('rgb');
  });
});
