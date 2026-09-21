/**
 * ADR-598 G11 — **Κανένα `SearchableCombobox` χωρίς όνομα** — σε ΟΛΟ το `src/`.
 *
 * Ο τύπος `FieldAccessibleName` το απαιτεί ήδη. Αυτή η φρουρά υπάρχει για τα δύο σημεία
 * όπου ο τύπος **δεν φτάνει**:
 * - ο πράκτορας δεν τρέχει `tsc` (N.17), άρα ένας νέος καταναλωτής μπορεί να φτάσει στο
 *   commit χωρίς κανείς να έχει δει το σφάλμα μεταγλώττισης·
 * - το `src/subapps/dxf-viewer/**` είναι **εκτός** root tsconfig — εκεί ο τύπος δεν
 *   ελέγχεται καθόλου από το τοπικό typecheck.
 *
 * Κ1 — κάθε `<SearchableCombobox>` **ή wrapper του** δηλώνει `id`, `aria-label`,
 *      `aria-labelledby` ή spread (`{...accessibleName}` που προωθεί).
 *
 * 🔑 **Οι wrappers ΔΕΝ είναι χειρόγραφη λίστα**: wrapper = component του οποίου τα props
 *    είναι τύπος που αναφέρει `FieldAccessibleName`. Νέος wrapper που δηλώνει σωστά τον
 *    τύπο μπαίνει αυτόματα στον έλεγχο· λίστα θα πάλιωνε σιωπηλά.
 *
 * ⚠️ Όριο, δηλωμένο: το «`id` χωρίς `<label htmlFor>`» ΔΕΝ ελέγχεται εδώ (η ετικέτα μπορεί
 *    να ζει σε άλλο αρχείο — π.χ. `GenericFormRenderer`). Το πιάνει ο φύλακας εκτέλεσης
 *    του SSoT (`findMissingAccessibleName`), που βλέπει το πραγματικό DOM.
 */

import * as ts from 'typescript';
import { listRepoSourceFiles, readRepoFile } from '@/test-utils/read-source';

const NAME_TYPE = 'FieldAccessibleName';
const SSOT_COMPONENT = 'SearchableCombobox';
const NAMING_ATTRS = new Set(['id', 'aria-label', 'aria-labelledby']);

interface Finding { readonly tag: string; readonly line: number }

function parse(source: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function visitAll(sf: ts.SourceFile, fn: (node: ts.Node) => void): void {
  const visit = (node: ts.Node): void => {
    fn(node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

/** Components του αρχείου των οποίων τα props αναφέρουν `FieldAccessibleName`. */
function findWrappers(source: string, fileName = 'fixture.tsx'): string[] {
  if (!source.includes(NAME_TYPE)) return [];
  const sf = parse(source, fileName);
  const namedTypes = new Set<string>();
  visitAll(sf, (node) => {
    if (ts.isTypeAliasDeclaration(node) && node.type.getText().includes(NAME_TYPE)) {
      namedTypes.add(node.name.text);
    }
  });
  const wrappers: string[] = [];
  visitAll(sf, (node) => {
    if (!ts.isFunctionDeclaration(node) || !node.name) return;
    const propsType = node.parameters[0]?.type?.getText();
    if (propsType !== undefined && (namedTypes.has(propsType) || propsType.includes(NAME_TYPE))) {
      wrappers.push(node.name.text);
    }
  });
  return wrappers;
}

/** Κ1 — καθαρή συνάρτηση πάνω σε κείμενο πηγής, δοκιμάσιμη με fixtures. */
function checkComboboxNaming(source: string, tags: ReadonlySet<string>, fileName = 'fixture.tsx'): Finding[] {
  const sf = parse(source, fileName);
  const findings: Finding[] = [];
  visitAll(sf, (node) => {
    if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
    const tag = node.tagName.getText();
    if (!tags.has(tag)) return;
    const named = node.attributes.properties.some(
      (p) => ts.isJsxSpreadAttribute(p) || (ts.isJsxAttribute(p) && NAMING_ATTRS.has(p.name.getText())),
    );
    if (!named) findings.push({ tag, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
  });
  return findings;
}

const TAGS = new Set([SSOT_COMPONENT, 'MyPicker']);

describe('findWrappers — ο wrapper βρίσκεται από τον ΤΥΠΟ, όχι από λίστα (fixtures)', () => {
  it('type alias με FieldAccessibleName ⇒ wrapper', () => {
    const src = `type P = Own & FieldAccessibleName;
      export function MyPicker({ value, ...accessibleName }: P) { return null; }
      function Other({ value }: Own) { return null; }`;
    expect(findWrappers(src)).toEqual(['MyPicker']);
  });

  it('inline τύπος με FieldAccessibleName ⇒ wrapper', () => {
    const src = `export function MyPicker(props: Own & FieldAccessibleName) { return null; }`;
    expect(findWrappers(src)).toEqual(['MyPicker']);
  });
});

describe('checkComboboxNaming — ο Κ1 πιάνει ό,τι λέει (fixtures)', () => {
  it('SSoT χωρίς όνομα ⇒ εύρημα', () => {
    const src = `const X = () => <SearchableCombobox value="" onValueChange={f} options={[]} />;`;
    expect(checkComboboxNaming(src, TAGS).map((f) => f.tag)).toEqual([SSOT_COMPONENT]);
  });

  it('wrapper χωρίς όνομα ⇒ εύρημα', () => {
    const src = `const X = () => (<MyPicker value="" onChange={f}></MyPicker>);`;
    expect(checkComboboxNaming(src, TAGS).map((f) => f.tag)).toEqual(['MyPicker']);
  });

  it.each([
    ['id', `id={fieldId}`],
    ['aria-label', `aria-label={t('a')}`],
    ['aria-labelledby', `aria-labelledby="l"`],
    ['spread (προώθηση)', `{...accessibleName}`],
  ])('με %s ⇒ καθαρό', (_name, attr) => {
    const src = `const X = () => <SearchableCombobox ${attr} value="" onValueChange={f} options={[]} />;`;
    expect(checkComboboxNaming(src, TAGS)).toEqual([]);
  });
});

describe('ΟΛΟ το src/ — κάθε combobox έχει όνομα', () => {
  const files = listRepoSourceFiles('src', ['.tsx']).filter(
    (f) => !f.includes('/__tests__/') && !/\.(test|spec|stories)\.tsx$/.test(f),
  );
  const sources = new Map(files.map((f) => [f, readRepoFile(f)]));
  const tags = new Set<string>([SSOT_COMPONENT]);
  for (const [file, source] of sources) for (const w of findWrappers(source, file)) tags.add(w);

  it('οι wrappers βρέθηκαν (αλλιώς το «0» σημαίνει «κανείς δεν κοίταξε»)', () => {
    for (const known of ['DoyPicker', 'TradeSelector', 'AreaCombobox', 'POProjectSelector']) {
      expect(tags).toContain(known);
    }
  });

  it('Κ1 = 0, πάνω σε μη κενό σύνολο χρήσεων', () => {
    const offenders: string[] = [];
    let checked = 0;
    for (const [file, source] of sources) {
      if (![...tags].some((tag) => source.includes(`<${tag}`))) continue;
      checked += 1;
      for (const f of checkComboboxNaming(source, tags, file)) offenders.push(`${file}:${f.line} [${f.tag}]`);
    }
    expect(offenders).toEqual([]);
    expect(checked).toBeGreaterThan(20);
  });
});
