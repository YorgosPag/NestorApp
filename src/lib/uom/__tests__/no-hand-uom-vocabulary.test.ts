/**
 * ADR-923 §5.11 «3γ» Α10 — ΦΡΟΥΡΟΣ ΚΛΑΣΗΣ: «ξαναγράφει κάποιος λεξιλόγιο μονάδων με το χέρι;»
 *
 * Ήταν **τρία** λεξιλόγια (BOQ `'pcs'` · PO `'τεμ'` · RFQ `'τμχ'`) και **πέντε** αντίγραφα ετικετών — και κανένα όργανο
 * δεν τα έβλεπε (το CHECK 3.8 ρωτά «υπάρχει το κλειδί;», όχι «υπάρχει ήδη αλλού;»). Κλείνει η **κλάση**, όχι το δείγμα:
 * ελληνική γραφή μονάδας ή ετικέτα `…units.${…}` σε κώδικα ⇒ κόκκινο, εκτός από το κλειστό σύνολο — **με λόγο** ανά γραμμή.
 * Το σύνολο **μόνο μικραίνει** (4γ ✅ · 4δ ✅ · 4β ✅ — έμειναν μόνο ΑΛΛΕΣ έννοιες, με λόγο).
 *
 * Ο ΕΝΑΣ δρόμος: `resolveUom()` / `DEFAULT_UOM` (`lib/uom/uom-registry`) · `useUomLabel()` (UI) · `uomLabelIn()` (server).
 */

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../../..');

const PATTERNS: readonly RegExp[] = [
  /['"`](?:τεμ|τμχ|τεμ\.|τ\.μ\.|κ\.μ\.)['"`]/u, // χειρόγραφη γραφή μονάδας
  /units\.\$\{/u, // ετικέτα μονάδας από δικό του αντίγραφο namespace
];

/** Κλειστό σύνολο — αρχείο → λόγος. Κάθε προσθήκη χρειάζεται λόγο που αντέχει σε review. */
const ALLOWED: Readonly<Record<string, string>> = {
  'subapps/dxf-viewer/bim-3d/dimensions/Dim3DPropertiesPanel.tsx':
    'Μονάδες ΜΗΚΟΥΣ σχεδίου (mm/cm/m της διάστασης 3D) — άλλη έννοια από τη μονάδα ποσότητας· ADR-362.',
  'subapps/dxf-viewer/ui/components/export/ExportDialog.tsx':
    'Μονάδες ΣΧΕΔΙΟΥ της εξαγωγής DXF (INSUNITS) — άλλη έννοια από τη μονάδα ποσότητας.',
  'lib/document-body/document-body-values.ts':
    'Αναλυτής ΕΛΕΥΘΕΡΟΥ κειμένου νομικών εγγράφων («120 τ.μ.») — γραφές που ψάχνει μέσα σε πρόζα, όχι λεξιλόγιο τιμών.',
  'services/ai-pipeline/agentic-reply-utils.ts':
    'Ανίχνευση πρόθεσης σε μήνυμα χρήστη (λέξη-κλειδί «τ.μ.») — όχι μονάδα ποσότητας.',
};

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['__tests__', 'node_modules', 'locales', 'generated', 'uom'].includes(entry.name)) continue;
      listSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)
      && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Αφαιρεί σχόλια γραμμής και μπλοκ — η αφήγηση επιτρέπεται να λέει «'τεμ'». */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

function offendingFiles(): string[] {
  return listSourceFiles(SRC)
    .filter((file) => {
      const code = stripComments(fs.readFileSync(file, 'utf8'));
      return PATTERNS.some((pattern) => pattern.test(code));
    })
    .map((file) => path.relative(SRC, file).split(path.sep).join('/'));
}

describe('ΕΝΑ λεξιλόγιο μονάδων', () => {
  const offending = offendingFiles();

  it('κανένα νέο χειρόγραφο λεξιλόγιο ή αντίγραφο ετικετών μονάδας', () => {
    expect(offending.filter((file) => !(file in ALLOWED))).toEqual([]);
  });

  it('το κλειστό σύνολο δεν κρατά αρχεία που καθάρισαν (μόνο μικραίνει)', () => {
    expect(Object.keys(ALLOWED).filter((file) => !offending.includes(file))).toEqual([]);
  });
});
