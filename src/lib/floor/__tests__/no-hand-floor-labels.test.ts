/**
 * ADR-903 — ΦΡΟΥΡΟΣ ΚΛΑΣΗΣ: «γράφει κάποιος ετικέτα ορόφου με το χέρι;»
 *
 * Μέχρι το ADR-903 υπήρχαν **οκτώ** χειρόγραφοι μορφοποιητές που απέκλιναν μεταξύ τους
 * («1 Floor» · «3nd Basement» · «0ος όροφος» · «Υπόγειο» για −3) και κανένα όργανο δεν τους
 * έβλεπε: το CHECK 3.8/i18n:audit ψάχνει μόνο `defaultValue:` και `toast(` (N.11). Εδώ κλείνει
 * η **κλάση**, όχι το δείγμα: νέα ετικέτα ορόφου σε κώδικα ⇒ κόκκινο, εκτός από το κλειστό
 * σύνολο παρακάτω — **με λόγο** ανά γραμμή.
 *
 * Ο ΕΝΑΣ δρόμος: `useFloorLabel()` (UI) · `floorLabelIn()` (server) · `parseLegacyFloor()` (είσοδος).
 */

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../../..');

/** Μοτίβα χειρόγραφης ετικέτας ορόφου μέσα σε **κώδικα** (όχι σχόλια). */
const HAND_LABEL_PATTERNS: readonly RegExp[] = [
  /\d*\}?ος\s+[Όό]ροφος/u, // `${n}ος όροφος` · '1ος Όροφος'
  /['"`]Ισόγειο['"`]/u,
  /['"`](?:\d+ο\s+)?Υπόγειο(?:\s+-?\d+)?['"`]/u,
  /\$\{[^}]+\}(?:st|nd|rd|th)?\s+Floor\b|\bFloor\s+\$\{/u,
];

/**
 * Κλειστό σύνολο εξαιρέσεων — αρχείο → λόγος. Κάθε προσθήκη χρειάζεται λόγο που αντέχει
 * σε review· «δεν είχα χρόνο» δεν είναι λόγος.
 */
const ALLOWED: Readonly<Record<string, string>> = {
  'app/(app)/test-harness/listing-shapes/page.tsx':
    'Τίτλοι fixtures του test harness («6α — Ίδιο κτίριο, 1ος όροφος») — περιγραφή σεναρίου, όχι ετικέτα.',
  'features/property-details/utils/attachments.ts':
    'Δεδομένα επίδειξης (mock attachments) — όχι μορφοποιητής· καμία παραγωγική διαδρομή.',
  'subapps/dxf-viewer/hooks/scene/useSceneState.ts':
    'Όνομα της ΠΡΩΤΗΣ στάθμης DXF ως δεδομένο (ADR-369 longName canonical) — βλ. ADR-903 §εκκρεμότητες.',
};

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules' || entry.name === 'locales'
        || entry.name === 'generated') continue;
      listSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)
      && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Αφαιρεί σχόλια γραμμής και μπλοκ — η αφήγηση επιτρέπεται να λέει «1ος όροφος». */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

function handLabelLines(file: string): string[] {
  const code = stripComments(fs.readFileSync(file, 'utf8'));
  return code.split('\n').flatMap((line, index) =>
    HAND_LABEL_PATTERNS.some((pattern) => pattern.test(line)) ? [`${index + 1}: ${line.trim()}`] : [],
  );
}

const relative = (file: string): string => path.relative(SRC, file).split(path.sep).join('/');
const FLOOR_SSOT_DIR = 'lib/floor/';
const GENERATED_TYPES = 'types/i18n.ts';

describe('ADR-903 — καμία χειρόγραφη ετικέτα ορόφου εκτός του SSoT', () => {
  const files = listSourceFiles(SRC).filter((file) => {
    const rel = relative(file);
    return !rel.startsWith(FLOOR_SSOT_DIR) && rel !== GENERATED_TYPES;
  });

  it('κάθε εύρημα είναι στο κλειστό σύνολο εξαιρέσεων', () => {
    const offenders = files
      .filter((file) => !(relative(file) in ALLOWED))
      .flatMap((file) => handLabelLines(file).map((line) => `${relative(file)}:${line}`));
    expect(offenders).toEqual([]);
  });

  it('καμία εξαίρεση δεν είναι μπαγιάτικη (το αρχείο υπάρχει ΚΑΙ έχει ακόμη εύρημα)', () => {
    const stale = Object.keys(ALLOWED).filter((rel) => {
      const full = path.join(SRC, rel);
      return !fs.existsSync(full) || handLabelLines(full).length === 0;
    });
    expect(stale).toEqual([]);
  });

  it('🔑 ο φρουρός ΒΛΕΠΕΙ: κάθε μοτίβο πιάνει το δείγμα που υπάρχει για να πιάνει', () => {
    const samples = ['`${n}ος όροφος`', "'Ισόγειο'", "'2ο Υπόγειο'", '`${n}th Floor`', '`Floor ${n}`'];
    for (const sample of samples) {
      expect(HAND_LABEL_PATTERNS.some((pattern) => pattern.test(sample))).toBe(true);
    }
    expect(handLabelLines.length).toBe(1);
    expect(stripComments("// '1ος Όροφος'\nconst x = 1;")).not.toMatch(/Όροφος/);
  });
});
