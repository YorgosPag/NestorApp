/**
 * ADR-598 G11 · Δ — **Κανένα αναδυόμενο δεν μένει ανώνυμο διάλογος** — σε ΟΛΟ το `src/`.
 *
 * Το SSoT `popover.tsx` ονομάζει τον διάλογο από το `PopoverTrigger` (React Aria). Ό,τι ΔΕΝ
 * μπορεί να δει ούτε ο τύπος ούτε το runtime είναι το αναδυόμενο **χωρίς trigger**
 * (`PopoverAnchor`, ελεγχόμενο `open`): εκεί το όνομα πρέπει να δοθεί ρητά. Αυτό το ρωτά
 * ο **Κ1**, στατικά, πριν φτάσει στον άνθρωπο.
 *
 * Κ1 — `<PopoverContent>` σε αρχείο **χωρίς** `<PopoverTrigger>` δηλώνει `aria-label`,
 *      `aria-labelledby` ή `role` (`presentation` για host listbox).
 * Κ2 — Όποιος αποδίδει το **ωμό** `@radix-ui/react-popover` δεν αποδίδει `Root`/`Trigger`
 *      (θα έσπαγε το context ονομασίας) και ζητά το όνομα από `usePopoverContentNaming`.
 *
 * ⚠️ Όριο, δηλωμένο: ο Κ1 κρίνει **ανά αρχείο**. Αν το trigger ζει σε άλλο αρχείο από το
 *    `PopoverContent`, ο Κ1 ζητά ρητό όνομα χωρίς να χρειάζεται (ψευδώς θετικό). Η θεραπεία,
 *    ένα ρητό όνομα, δεν βλάπτει. Το αντίθετο σφάλμα, ψευδώς αρνητικό, δεν είναι δυνατό.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const SRC_ROOT = path.resolve(__dirname, '../../..');
const SSOT_FILE = path.join(SRC_ROOT, 'components', 'ui', 'popover.tsx');
const NAMING_ATTRS = new Set(['aria-label', 'aria-labelledby', 'role']);

interface Finding { readonly rule: 'K1' | 'K2'; readonly line: number; readonly why: string }

function jsxTagName(node: ts.JsxOpeningLikeElement): string {
  return node.tagName.getText();
}

/** Καθαρή συνάρτηση πάνω σε κείμενο πηγής — δοκιμάσιμη με fixtures. */
function checkPopoverNaming(source: string, fileName = 'fixture.tsx'): Finding[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const openings: ts.JsxOpeningLikeElement[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) openings.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sf);

  const findings: Finding[] = [];
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const hasTrigger = openings.some((o) => jsxTagName(o) === 'PopoverTrigger');

  for (const o of openings) {
    if (jsxTagName(o) !== 'PopoverContent' || hasTrigger) continue;
    const named = o.attributes.properties.some(
      (p) => ts.isJsxAttribute(p) && NAMING_ATTRS.has(p.name.getText()),
    );
    if (!named) {
      findings.push({ rule: 'K1', line: lineOf(o), why: 'PopoverContent χωρίς trigger και χωρίς όνομα/role' });
    }
  }

  const rawImport = sf.statements.find(
    (s): s is ts.ImportDeclaration =>
      ts.isImportDeclaration(s) && (s.moduleSpecifier as ts.StringLiteral).text === '@radix-ui/react-popover',
  );
  if (rawImport) {
    for (const o of openings) {
      if (/\.(Root|Trigger)$/.test(jsxTagName(o))) {
        findings.push({ rule: 'K2', line: lineOf(o), why: `ωμό ${jsxTagName(o)} — χρησιμοποίησε Popover/PopoverTrigger του SSoT` });
      }
    }
    const rendersContent = openings.some((o) => /\.Content$/.test(jsxTagName(o)));
    if (rendersContent && !source.includes('usePopoverContentNaming(')) {
      findings.push({ rule: 'K2', line: lineOf(rawImport), why: 'ωμό Content χωρίς usePopoverContentNaming' });
    }
  }
  return findings;
}

function walk(dir: string, out: string[]): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (entry.name.endsWith('.tsx') && !/\.(test|spec|stories)\.tsx$/.test(entry.name)) out.push(abs);
  }
  return out;
}

describe('checkPopoverNaming — οι κανόνες πιάνουν ό,τι λένε (fixtures)', () => {
  it('Κ1: anchor χωρίς όνομα ⇒ εύρημα', () => {
    const src = `const X = () => (<Popover><PopoverAnchor /><PopoverContent align="start">x</PopoverContent></Popover>);`;
    expect(checkPopoverNaming(src).map((f) => f.rule)).toEqual(['K1']);
  });

  it.each([
    ['aria-label', `aria-label={t('a')}`],
    ['aria-labelledby', `aria-labelledby="l"`],
    ['role', `role="presentation"`],
  ])('Κ1: anchor με %s ⇒ καθαρό', (_name, attr) => {
    const src = `const X = () => (<Popover><PopoverAnchor /><PopoverContent ${attr} onOpenAutoFocus={(e) => e.preventDefault()}>x</PopoverContent></Popover>);`;
    expect(checkPopoverNaming(src)).toEqual([]);
  });

  it('Κ1: με trigger ⇒ καθαρό (το ονομάζει το SSoT)', () => {
    const src = `const X = () => (<Popover><PopoverTrigger>Φίλτρα</PopoverTrigger><PopoverContent>x</PopoverContent></Popover>);`;
    expect(checkPopoverNaming(src)).toEqual([]);
  });

  it('Κ2: ωμό Root/Trigger και Content χωρίς hook ⇒ τρία ευρήματα', () => {
    const src = `import * as P from '@radix-ui/react-popover';
      const X = () => (<P.Root><P.Trigger>a</P.Trigger><P.Content>x</P.Content></P.Root>);`;
    expect(checkPopoverNaming(src).map((f) => f.rule)).toEqual(['K2', 'K2', 'K2']);
  });

  it('Κ2: ωμό Content ΜΕ hook ⇒ καθαρό', () => {
    const src = `import * as P from '@radix-ui/react-popover';
      const X = () => { const n = usePopoverContentNaming(); return <P.Content {...n}>x</P.Content>; };`;
    expect(checkPopoverNaming(src)).toEqual([]);
  });
});

describe('ΟΛΟ το src/ — κανένα ανώνυμο αναδυόμενο', () => {
  it('Κ1 + Κ2 = 0', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT, [])) {
      if (file === SSOT_FILE) continue;
      const source = fs.readFileSync(file, 'utf8');
      if (!source.includes('PopoverContent') && !source.includes('@radix-ui/react-popover')) continue;
      for (const f of checkPopoverNaming(source, file)) {
        offenders.push(`${path.relative(SRC_ROOT, file).replace(/\\/g, '/')}:${f.line} [${f.rule}] ${f.why}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
