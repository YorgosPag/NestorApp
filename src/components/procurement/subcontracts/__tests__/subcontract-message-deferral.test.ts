/**
 * ADR-744 §34 · ADR-928 Φ3α-2 — ΤΑ ΜΗΝΥΜΑΤΑ ΕΥΡΗΜΑΤΩΝ/ΑΡΝΗΣΕΩΝ ΤΗΣ ΥΠΕΡΓΟΛΑΒΙΑΣ ΔΕΝ ΤΑ ΠΛΗΡΩΝΕΙ ΤΟ ΠΡΩΤΟ ΚΑΡΕ.
 *
 * Ίδιες δύο άγκυρες με τον κατάλογο (`catalog-issue-deferral.test.ts`), γιατί σπάει με τους ίδιους δύο τρόπους:
 *   1. **Η αιτία**: στατικό import του `subcontract-message-keys` ⇒ ~80 κλειδιά ξανά στην κλειστότητα της καρτέλας.
 *   2. **Το αποτέλεσμα**: το slice της καρτέλας «Υπεργολαβίες» κουβαλά `subcontracts.issues` / `subcontracts.failure`.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../..');
const MODULE = 'subcontract-message-keys';
const SCANNED = ['src/app', 'src/components', 'src/hooks', 'src/services/procurement', 'src/subapps/procurement'];
const SLICE = path.join(ROOT, 'src/i18n/generated/routes/o__workspace__projects__id__procurement__subcontracts.el.json');

function sourceFiles(dir: string): string[] {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.(ts|tsx)$/.test(file) && !/(^|[\\/])__tests__[\\/]/.test(file))
    .map((file) => path.join(absolute, file));
}

const staticEdge = new RegExp(`(?:from\\s*|require\\(\\s*|^\\s*import\\s*)['"][^'"]*/${MODULE}['"]`, 'm');
const dynamicEdge = new RegExp(`import\\(\\s*['"][^'"]*/${MODULE}['"]\\s*\\)`);

describe('ο πίνακας μηνυμάτων της υπεργολαβίας φτάνει ΜΟΝΟ μέσω import()', () => {
  const files = SCANNED.flatMap(sourceFiles);

  it('σαρώνει πραγματικά αρχεία (όχι πράσινο επειδή δεν κοίταξε)', () => {
    expect(files.length).toBeGreaterThan(1000);
  });

  it('κανένα στατικό import', () => {
    const offenders = files.filter((file) => staticEdge.test(fs.readFileSync(file, 'utf8'))).map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('ζητείται με import() από ακριβώς έναν δηλωτή', () => {
    expect(files.filter((file) => dynamicEdge.test(fs.readFileSync(file, 'utf8')))).toHaveLength(1);
  });

  it('ο ανιχνευτής πιάνει στατικό import και αφήνει το import() (αυτοέλεγχος)', () => {
    expect(staticEdge.test(`import { SUBCONTRACT_ISSUE_KEYS } from './${MODULE}';`)).toBe(true);
    expect(staticEdge.test(`  import('./${MODULE}').then((m) => m.SUBCONTRACT_ISSUE_KEYS)`)).toBe(false);
  });
});

describe('το slice της καρτέλας δεν κουβαλά ευρήματα ή αρνήσεις', () => {
  it('υπάρχει, και δεν έχει `subcontracts.issues` / `subcontracts.failure`', () => {
    const slice = JSON.parse(fs.readFileSync(SLICE, 'utf8')) as { procurement?: { subcontracts?: Record<string, unknown> } };
    expect(slice.procurement?.subcontracts).toBeDefined();
    expect(slice.procurement?.subcontracts?.issues).toBeUndefined();
    expect(slice.procurement?.subcontracts?.failure).toBeUndefined();
  });
});
