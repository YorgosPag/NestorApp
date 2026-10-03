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

// ============================================================================
// ΔΕΥΤΕΡΗ ΟΙΚΟΓΕΝΕΙΑ — η ετικέτα ορόφου ΜΕΣΑ ΣΕ ΚΛΕΙΔΙ i18n (ADR-900 §8 #2, 2β.2)
// ============================================================================
//
// 🔴 Ο σαρωτής κώδικα ήταν ΔΟΜΙΚΑ ΤΥΦΛΟΣ εδώ: `t('search-results:listing.floor', { value })` δεν περιέχει
// καμία ελληνική λέξη — η ετικέτα («Όροφος {value}» ⇒ «Όροφος -1» για το υπόγειο, χωρίς είδος) ζούσε στο
// locale. Βρέθηκαν ΤΡΙΑ τέτοια (κάρτα αποτελεσμάτων · χαρακτηριστικά αγγελίας · παρόμοιες πωλήσεις) + ένα νεκρό.
// Το μοτίβο είναι ΟΛΗ η τιμή (όχι υποσυμβολοσειρά): «{count} όροφοι» είναι καταμέτρηση, όχι ετικέτα στάθμης.

const LOCALES_DIR = path.join(SRC, 'i18n', 'locales');
const FLOOR_SSOT_NAMESPACE = 'floors.json';

/** Ολόκληρη τιμή που είναι ετικέτα ΜΙΑΣ στάθμης από αριθμό. */
// Πρόθεμα μόνο με ΚΕΦΑΛΑΙΟ («Όροφος {n}» = ετικέτα)· «όροφος {delta}» / «floor {delta}» = διαφορά, όχι στάθμη.
const LOCALE_FLOOR_LABEL = /^(?:Όροφος\s*\{\w+\}|\{\w+\}\s*(?:ος|ο)?\s*[Όό]ροφος|Floor\s*\{\w+\}|\{\w+\}\s*(?:st|nd|rd|th)?\s*[Ff]loor)$/u;

/** Κλειστό σύνολο, `γλώσσα/ns:μονοπάτι` → λόγος. Η εξαίρεση που δεν πιάνει πια τίποτα είναι κόκκινη. */
const LOCALE_ALLOWED: Readonly<Record<string, string>> = {
  'el/bim3d:section.presets.floorN': 'Δείκτης προεπιλογής τομής, όχι στάθμη κτιρίου (ADR-903 §7).',
  'en/bim3d:section.presets.floorN': 'Δείκτης προεπιλογής τομής, όχι στάθμη κτιρίου (ADR-903 §7).',
  'el/bim3d:aria.announcements.floorChanged': 'Ανακοίνωση αναγνώστη οθόνης με ΟΝΟΜΑ ορόφου (κείμενο), όχι αριθμό.',
  'en/bim3d:aria.announcements.floorChanged': 'Ανακοίνωση αναγνώστη οθόνης με ΟΝΟΜΑ ορόφου (κείμενο), όχι αριθμό.',
  'el/spatial-tour:viewer.floorNumbered': 'Εφεδρικό όνομα στάθμης ξενάγησης (`level.label ?? …`), όχι όροφος κτιρίου.',
  'en/spatial-tour:viewer.floorNumbered': 'Εφεδρικό όνομα στάθμης ξενάγησης (`level.label ?? …`), όχι όροφος κτιρίου.',
};

function localeFloorLabels(): string[] {
  const found: string[] = [];
  const walk = (node: unknown, where: string, trail: string): void => {
    if (typeof node === 'string') {
      if (LOCALE_FLOOR_LABEL.test(node.trim())) found.push(`${where}:${trail}`);
      return;
    }
    if (node === null || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) walk(value, where, trail === '' ? key : `${trail}.${key}`);
  };
  for (const language of fs.readdirSync(LOCALES_DIR)) {
    const dir = path.join(LOCALES_DIR, language);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== FLOOR_SSOT_NAMESPACE)) {
      walk(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')), `${language}/${file.replace(/\.json$/, '')}`, '');
    }
  }
  return found;
}

describe('ADR-903 · 2β.2 — καμία ετικέτα ορόφου μέσα σε locale εκτός του namespace `floors`', () => {
  const found = localeFloorLabels();

  it('κάθε εύρημα είναι στο κλειστό σύνολο εξαιρέσεων', () => {
    expect(found.filter((entry) => !(entry in LOCALE_ALLOWED))).toEqual([]);
  });

  it('καμία εξαίρεση δεν είναι μπαγιάτικη', () => {
    expect(Object.keys(LOCALE_ALLOWED).filter((entry) => !found.includes(entry))).toEqual([]);
  });

  it('🔑 ο φρουρός ΒΛΕΠΕΙ — και ΔΕΝ πιάνει καταμετρήσεις', () => {
    for (const sample of ['Όροφος {value}', '{n}ος Όροφος', 'Floor {value}', '{floor}th floor']) {
      expect(LOCALE_FLOOR_LABEL.test(sample)).toBe(true);
    }
    for (const sample of ['{count} όροφοι', 'Show floor {floor} in the all-floors view', 'floor {delta}']) {
      expect(LOCALE_FLOOR_LABEL.test(sample)).toBe(false);
    }
  });
});
