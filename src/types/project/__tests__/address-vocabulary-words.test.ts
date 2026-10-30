/**
 * ADR-195 (ζ) 🏷️′ · N.11 — Οι λέξεις των λεξιλογίων διεύθυνσης ζουν σε ΕΝΑ σημείο.
 *
 * Η κλάση που έκλεισε: ο τύπος διεύθυνσης έργου και η πλευρά οικοπέδου είχαν λέξεις σε
 * ΤΕΣΣΕΡΑ σημεία — `addresses:types|blockSides`, δύο αντίγραφα (`building-address:address.*`,
 * `projects-data:address.*`, χωρίς `frontage` ⇒ ωμό κλειδί στις οθόνες κτιρίου) και ελληνικούς
 * πίνακες στο `address-helpers.ts`, με όρισμα `locale` που αγνοούνταν.
 *
 *   Ω1 — κάθε τιμή κάθε ρίζας έχει λέξη στο ΕΝΑ σημείο, σε el ΚΑΙ en·
 *   Ω2 — κανένα άλλο αντικείμενο locale δεν απαριθμεί το λεξιλόγιο (κλειστό σύνολο εξαιρέσεων, με λόγο)·
 *   Ω3 — κανένα string literal στο `src/types/project/` δεν έχει ελληνικούς χαρακτήρες·
 *   Ω4 — το ΕΝΑ σημείο απόδοσης (`useAddressVocabularyWords`) λύνει τις πραγματικές λέξεις.
 *
 * Το CHECK 3.73 φυλά τους ΤΥΠΟΥΣ (ένα σώμα τιμών)· δεν βλέπει `Record<ProjectAddressType, string>`
 * με ελληνικές τιμές, γιατί αυτό είναι ΔΕΜΕΝΟ. Αυτή η άγκυρα φυλά τις ΛΕΞΕΙΣ.
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { renderHook } from '@testing-library/react';

import { BLOCK_SIDE_DIRECTIONS, PROJECT_ADDRESS_TYPES } from '@/types/project/addresses';
import { ADDRESS_VALIDATION_ISSUES } from '@/types/project/address-helpers';
import { useAddressVocabularyWords } from '@/components/shared/addresses/useAddressVocabularyWords';

let mockLang: 'el' | 'en' = 'el';
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: (ns: string) => ({
    t: (key: string) => {
      // Πραγματικό JSON, όχι mock λέξεις: το κλειδί που ζητά το hook πρέπει να ΥΠΑΡΧΕΙ.
      const json = jest.requireActual<typeof import('fs')>('fs').readFileSync(
        `${process.cwd()}/src/i18n/locales/${mockLang}/${ns}.json`, 'utf-8');
      let node: unknown = JSON.parse(json);
      for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
      return typeof node === 'string' ? node : key;
    },
  }),
}));

type Lang = 'el' | 'en';
const LANGS: readonly Lang[] = ['el', 'en'];
const LOCALES_DIR = path.join(process.cwd(), 'src', 'i18n', 'locales');
const PROJECT_TYPES_DIR = path.join(process.cwd(), 'src', 'types', 'project');
const GREEK = /[Ͱ-Ͽἀ-῿]/;

/** Λεξιλόγιο → το ΕΝΑ σημείο όπου ζουν οι λέξεις του (`ns:διαδρομή`). */
const VOCABULARIES: ReadonlyArray<readonly [string, readonly string[], string]> = [
  ['ProjectAddressType', PROJECT_ADDRESS_TYPES, 'addresses:types'],
  ['BlockSideDirection', BLOCK_SIDE_DIRECTIONS, 'addresses:blockSides'],
  ['AddressValidationIssue', ADDRESS_VALIDATION_ISSUES, 'addresses:form.validation'],
];

/**
 * Αντικείμενα locale που απαριθμούν τις ίδιες τιμές για ΑΛΛΟ λόγο. Κλειστό σύνολο: νέα
 * εγγραφή μπλοκάρει ακόμα κι όταν είναι σωστή, ώστε να τη δει άνθρωπος (πρότυπο CHECK 3.73).
 */
const OTHER_VOCABULARIES: Readonly<Record<string, string>> = {
  'common:audit.values':
    'γενική εφεδρεία του Ιστορικού για τιμές χωρίς δηλωμένο κατάλογο (audit-value-resolver βήμα 4)',
  'properties-enums:units.orientation': 'προσανατολισμός ακινήτου (OrientationType), όχι πλευρά οικοπέδου',
  'properties-enums:orientation.short': 'συντομογραφίες προσανατολισμού (Β/ΒΑ…), άλλο λεξιλόγιο',
  'listing-detail:terrain.stats.towards': 'γραμματική μορφή «προς τα βόρεια» για το έδαφος αγγελίας',
};
const ENUMERATION_THRESHOLD = 5;

const jsonCache = new Map<string, unknown>();
function readLocale(lang: Lang, ns: string): unknown {
  const file = `${lang}/${ns}`;
  if (!jsonCache.has(file)) {
    jsonCache.set(file, JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, lang, `${ns}.json`), 'utf-8')));
  }
  return jsonCache.get(file);
}

function nodeAt(lang: Lang, ref: string): unknown {
  const [ns, keyPath] = ref.split(':');
  let node = readLocale(lang, ns);
  for (const part of keyPath.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** Κάθε αντικείμενο locale (όλα τα namespaces) με ≥κατώφλι κλειδιά από το λεξιλόγιο. */
function enumerationsOf(lang: Lang, values: readonly string[]): string[] {
  const found: string[] = [];
  const walk = (node: unknown, trail: string): void => {
    if (node === null || typeof node !== 'object') return;
    const keys = Object.keys(node);
    if (values.filter((v) => keys.includes(v)).length >= ENUMERATION_THRESHOLD) found.push(trail);
    for (const [k, child] of Object.entries(node)) walk(child, trail.endsWith(':') ? `${trail}${k}` : `${trail}.${k}`);
  };
  for (const file of fs.readdirSync(path.join(LOCALES_DIR, lang))) {
    if (file.endsWith('.json')) walk(readLocale(lang, file.replace(/\.json$/, '')), `${file.replace(/\.json$/, '')}:`);
  }
  return found;
}

/** String/template literals με ελληνικούς χαρακτήρες (AST parse-only — σχόλια και regex δεν μετρούν). */
function greekLiteralsIn(file: string): string[] {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf-8'), ts.ScriptTarget.Latest, true);
  const hits: string[] = [];
  const visit = (node: ts.Node): void => {
    const isText = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
      || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node);
    if (isText && GREEK.test(node.getText(source))) {
      hits.push(`${path.basename(file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1} ${node.getText(source)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

describe('Ω1 — κάθε τιμή έχει λέξη στο ΕΝΑ σημείο, στις δύο γλώσσες', () => {
  it.each(VOCABULARIES.flatMap(([name, values, ref]) =>
    LANGS.flatMap((lang) => values.map((value) => [name, lang, ref, value] as const)),
  ))('%s · %s · %s.%s', (_name, lang, ref, value) => {
    const word = nodeAt(lang, `${ref}.${value}`);
    expect(typeof word).toBe('string');
    expect(String(word).trim()).not.toBe('');
  });
});

describe('Ω2 — κανένα δεύτερο σώμα λέξεων στα locales', () => {
  it.each(VOCABULARIES.filter(([name]) => name !== 'AddressValidationIssue')
    .flatMap(([name, values, ref]) => LANGS.map((lang) => [name, lang, values, ref] as const)))(
    '%s · %s', (_name, lang, values, ref) => {
      const copies = enumerationsOf(lang, values).filter((at) => at !== ref && !(at in OTHER_VOCABULARIES));
      expect(copies).toEqual([]);
    },
  );

  it('κάθε δηλωμένη εξαίρεση υπάρχει ακόμη (αλλιώς η εξαίρεση είναι νεκρή και πρέπει να φύγει)', () => {
    for (const ref of Object.keys(OTHER_VOCABULARIES)) {
      for (const lang of LANGS) expect(nodeAt(lang, ref)).toBeInstanceOf(Object);
    }
  });
});

describe('Ω3 — καμία λέξη μέσα στον κώδικα των τύπων διεύθυνσης', () => {
  const files = fs.readdirSync(PROJECT_TYPES_DIR)
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.d.ts'))
    .map((f) => path.join(PROJECT_TYPES_DIR, f));

  it('ο φρουρός σαρώνει πραγματικά αρχεία', () => {
    expect(files.map((f) => path.basename(f))).toEqual(expect.arrayContaining(['address-helpers.ts', 'addresses.ts']));
  });

  it.each(files.map((f) => [path.basename(f), f] as const))('%s', (_name, file) => {
    expect(greekLiteralsIn(file)).toEqual([]);
  });
});

describe('Ω4 — το ΕΝΑ σημείο απόδοσης λύνει τις λέξεις του λεξιλογίου', () => {
  it.each(LANGS)('%s', (lang) => {
    mockLang = lang;
    const { result } = renderHook(() => useAddressVocabularyWords());
    for (const type of PROJECT_ADDRESS_TYPES) {
      expect(result.current.addressType(type)).toBe(nodeAt(lang, `addresses:types.${type}`));
    }
    for (const side of BLOCK_SIDE_DIRECTIONS) {
      expect(result.current.blockSide(side)).toBe(nodeAt(lang, `addresses:blockSides.${side}`));
    }
  });
});
