/**
 * ADR-598 G11 · §3 procurement — **Καμία ετικέτα χωρίς πεδίο** στο procurement.
 *
 * Μετρημένο 2026-09-21: 30 `<Label>` σε 10 αρχεία δεν ονόμαζαν τίποτα. Ο αναγνώστης οθόνης
 * διάβαζε «πεδίο κειμένου» χωρίς όνομα, και το κλικ στην ετικέτα δεν εστίαζε το πεδίο
 * (WCAG 1.3.1 · 4.1.2). Στις φόρμες υπήρχε ήδη `idBase = useId()` — η σύνδεση απλώς
 * δεν γινόταν.
 *
 * Κ1 — κάθε `<Label>`/`<label>` είτε δηλώνει `htmlFor`, είτε **τυλίγει** το πεδίο του.
 * Κ2 — ένα **κυριολεκτικό** `htmlFor="x"` έχει `id="x"` στο ίδιο αρχείο (τα δυναμικά
 *      `${idBase}-…` τα ελέγχει ο axe στα tests των φορμών — βλέπει το πραγματικό DOM).
 *
 * Η ετικέτα που **δεν** ονομάζει πεδίο δεν είναι ετικέτα: κεφαλίδα ομάδας = `<legend>`/
 * επικεφαλίδα (`LineItemsSection`), κεφαλίδα στήλης = `aria-labelledby` (`BreakpointsEditor`),
 * ζεύγος προς ανάγνωση = `<dl>` (`FieldRow`).
 */

import * as ts from 'typescript';
import { listRepoSourceFiles, readRepoFile } from '@/test-utils/read-source';

const LABEL_TAGS = new Set(['Label', 'label']);
const CONTROL_TAGS = new Set(['input', 'select', 'textarea', 'Input', 'Textarea', 'Checkbox', 'Switch', 'RadioGroupItem']);
const SCOPES = ['src/components/procurement', 'src/subapps/procurement'];

/**
 * Γνωστές εξαιρέσεις ΚΑΤΑ ΤΑΥΤΟΤΗΤΑ (αρχείο → πλήθος), με λόγο. Όταν διορθωθούν, το test
 * **απαιτεί** να σβηστεί η γραμμή — η εξαίρεση δεν μένει να καλύπτει νέο κενό.
 */
const KNOWN_GAPS: Readonly<Record<string, { count: number; why: string }>> = {
  'src/subapps/procurement/components/signatory/SignatoryProposalCard.tsx': {
    count: 1,
    why: 'EscoOccupationPicker → LinkedSinglePickerView → PickerSearchInput δεν δέχονται id/aria-labelledby· .claude-rules/pending-ratchet-work.md',
  },
};

interface Finding { readonly rule: 'Κ1' | 'Κ2'; readonly line: number; readonly detail: string }

function parse(source: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function visitAll(node: ts.Node, fn: (n: ts.Node) => void): void {
  fn(node);
  ts.forEachChild(node, (child) => visitAll(child, fn));
}

function attr(el: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
  return el.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === name,
  );
}

function literalValue(a: ts.JsxAttribute | undefined): string | null {
  const init = a?.initializer;
  if (init && ts.isStringLiteral(init)) return init.text;
  if (init && ts.isJsxExpression(init) && init.expression && ts.isNoSubstitutionTemplateLiteral(init.expression)) {
    return init.expression.text;
  }
  return null;
}

function wrapsControl(label: ts.JsxElement): boolean {
  let found = false;
  visitAll(label, (n) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && CONTROL_TAGS.has(n.tagName.getText())) found = true;
  });
  return found;
}

/** Κ1 + Κ2 — καθαρή συνάρτηση πάνω σε κείμενο πηγής, δοκιμάσιμη με fixtures. */
export function checkLabelAssociation(source: string, fileName = 'fixture.tsx'): Finding[] {
  const sf = parse(source, fileName);
  const ids = new Set<string>();
  visitAll(sf, (n) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const id = literalValue(attr(n, 'id'));
      if (id) ids.add(id);
    }
  });

  const findings: Finding[] = [];
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  visitAll(sf, (n) => {
    const opening = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null;
    if (!opening || !LABEL_TAGS.has(opening.tagName.getText())) return;
    const htmlFor = attr(opening, 'htmlFor');
    if (!htmlFor) {
      if (!(ts.isJsxElement(n) && wrapsControl(n))) findings.push({ rule: 'Κ1', line: lineOf(n), detail: 'χωρίς htmlFor και χωρίς πεδίο μέσα της' });
      return;
    }
    const target = literalValue(htmlFor);
    if (target !== null && !ids.has(target)) findings.push({ rule: 'Κ2', line: lineOf(n), detail: `htmlFor="${target}" χωρίς id="${target}"` });
  });
  return findings;
}

describe('checkLabelAssociation — πιάνει ό,τι λέει (fixtures)', () => {
  it('Κ1: ετικέτα χωρίς htmlFor δίπλα σε πεδίο ⇒ εύρημα', () => {
    const src = `const X = () => (<div><Label>{t('a')}</Label><Input value="" /></div>);`;
    expect(checkLabelAssociation(src).map((f) => f.rule)).toEqual(['Κ1']);
  });

  it('Κ1: ετικέτα που τυλίγει το πεδίο της ⇒ καθαρό', () => {
    const src = `const X = () => (<label>{t('a')}<Checkbox checked /></label>);`;
    expect(checkLabelAssociation(src)).toEqual([]);
  });

  it('Κ2: κυριολεκτικό htmlFor χωρίς αντίστοιχο id ⇒ εύρημα', () => {
    const src = `const X = () => (<div><Label htmlFor="a">x</Label><Input id="b" /></div>);`;
    expect(checkLabelAssociation(src).map((f) => f.rule)).toEqual(['Κ2']);
  });

  it('δυναμικό htmlFor (`${idBase}-x`) ⇒ Κ1 ικανοποιημένος, Κ2 δεν κρίνει', () => {
    const src = 'const X = () => (<div><Label htmlFor={`${idBase}-x`}>x</Label><Input id={`${idBase}-x`} /></div>);';
    expect(checkLabelAssociation(src)).toEqual([]);
  });
});

describe('procurement — κάθε ετικέτα ονομάζει πεδίο', () => {
  const files = SCOPES.flatMap((dir) => listRepoSourceFiles(dir, ['.tsx'])).filter(
    (f) => !f.includes('/__tests__/') && !/\.(test|spec|stories)\.tsx$/.test(f),
  );

  it('σαρώθηκαν αρχεία με ετικέτες (αλλιώς το «0» σημαίνει «κανείς δεν κοίταξε»)', () => {
    const withLabels = files.filter((f) => /<[Ll]abel\b/.test(readRepoFile(f)));
    expect(withLabels.length).toBeGreaterThan(10);
  });

  it('Κ1 + Κ2 = 0 έξω από τις δηλωμένες εξαιρέσεις — και καμία εξαίρεση ΠΕΡΙΤΤΗ', () => {
    const offenders: string[] = [];
    const gapCounts: Record<string, number> = {};
    for (const file of files) {
      const source = readRepoFile(file);
      if (!/<[Ll]abel\b/.test(source)) continue;
      const findings = checkLabelAssociation(source, file);
      const known = KNOWN_GAPS[file];
      if (known) { gapCounts[file] = findings.length; continue; }
      for (const f of findings) offenders.push(`${file}:${f.line} [${f.rule}] ${f.detail}`);
    }
    expect(offenders).toEqual([]);
    for (const [file, { count }] of Object.entries(KNOWN_GAPS)) expect({ file, found: gapCounts[file] ?? 0 }).toEqual({ file, found: count });
  });
});
