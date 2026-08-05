/**
 * @fileoverview Η καλωδίωση της παλέτας «Σύνδεση Πινακίδας» (ADR-745 Φ3β).
 *
 * Τρία πράγματα που **δεν** τα πιάνει κανένα άλλο test, και που όταν σπάνε δεν βγάζουν σφάλμα:
 *
 * 1. **Κουμπί χωρίς χειριστή** — το ribbon δηλώνει `action`, ο dispatcher το αγνοεί: το κλικ
 *    απλώς δεν κάνει τίποτα.
 * 2. **Ωμό κλειδί στην οθόνη** — ο ρητός χάρτης δείχνει σε κλειδί που δεν υπάρχει στα locales.
 *    Είναι ακριβώς η βλάβη του ADR-752: τα αρχεία υπήρχαν, οι τύποι υπήρχαν, οι καταναλωτές
 *    υπήρχαν, και η οθόνη έβαφε `titleBlockBinding.fields.employer` — με **όλες** τις πύλες
 *    πράσινες, γιατί καμία δεν ρωτούσε αυτή την ερώτηση.
 * 3. **Απόκλιση el/en** — το ένα locale παίρνει το κλειδί, το άλλο όχι, και η βλάβη εμφανίζεται
 *    μόνο σε γλώσσα που κανείς δεν δοκιμάζει.
 */

import fs from 'fs';
import path from 'path';

// __tests__ → title-block-binding → components → ui → dxf-viewer → subapps → src → ρίζα
const ROOT = path.resolve(__dirname, '../../../../../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const locale = (lang: string) =>
  JSON.parse(read(`src/i18n/locales/${lang}/dxf-viewer-shell.json`)) as Record<string, unknown>;

/** Ακολουθεί μια διαδρομή τύπου `a.b.c` μέσα στο locale· `undefined` όταν λείπει. */
function at(tree: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    tree,
  );
}

/** Τα κλειδιά που όντως γράφει ο κώδικας — διαβασμένα από το αρχείο, όχι ξαναγραμμένα εδώ. */
function declaredKeys(): string[] {
  const sources = [
    // ⚠️ Η λίστα πρέπει να καλύπτει **κάθε** αρχείο που γράφει κλειδί. Στη Φ3β το αρχείο
    // χωρίστηκε σε τρία (N.7.1) και οι ετικέτες μετακόμισαν στο `proposal-labels.ts`: με τη
    // σκέτη παλιά λίστα το test θα εξέταζε **7** κλειδιά αντί για 30+, δηλαδή θα έμενε πράσινο
    // κοιτάζοντας σχεδόν τίποτα. Ο φρουρός «δηλώνει κλειδιά» παρακάτω υπάρχει ακριβώς γι' αυτό.
    read('src/subapps/dxf-viewer/ui/components/title-block-binding/proposal-labels.ts'),
    read('src/subapps/dxf-viewer/ui/components/title-block-binding/TitleBlockProposalList.tsx'),
    read('src/subapps/dxf-viewer/ui/components/title-block-binding/TitleBlockProposalRow.tsx'),
    read('src/subapps/dxf-viewer/ui/components/TitleBlockBindingPalette.tsx'),
  ].join('\n');
  return [...sources.matchAll(/'(titleBlockBinding\.[A-Za-z0-9.\-_]+)'/g)].map((m) => m[1]);
}

describe('καλωδίωση κουμπιού → ενέργεια', () => {
  it('η ενέργεια του ribbon έχει χειριστή στον dispatcher', () => {
    const ribbon = read('src/subapps/dxf-viewer/ui/ribbon/data/insert-tab.ts');
    const dispatcher = read('src/subapps/dxf-viewer/app/dxf-special-actions.ts');
    expect(ribbon).toContain("action: 'open-title-block-binding'");
    expect(dispatcher).toContain("action === 'open-title-block-binding'");
    expect(dispatcher).toContain('TitleBlockBindingPaletteStore.open()');
  });

  it('η παλέτα είναι όντως τοποθετημένη στο δέντρο, όχι μόνο γραμμένη', () => {
    const dialogs = read('src/subapps/dxf-viewer/app/DxfViewerDialogs.tsx');
    expect(dialogs).toContain('<TitleBlockBindingPalette');
    expect(dialogs).toContain('levelId={levelManager.currentLevelId');
  });

  it('🔴 το fileRecordId φτάνει στην παλέτα ως `?? null` — ΠΟΤΕ `?? \'\'`', () => {
    // Γ2: μηδενίσιμο εκ σχεδιασμού, φτάνει ΑΡΓΟΤΕΡΑ, και είναι μέρος του ντετερμινιστικού
    // κλειδιού. Κενή συμβολοσειρά ⇒ το επόμενο φόρτωμα δεν ξαναβρίσκει τη σύνδεση ⇒ δεύτερο
    // κλικ = ΔΕΥΤΕΡΟ έγγραφο. Το `user?.uid ?? ''` ήταν ο τελευταίος φραγμός του κλικ (§13ι).
    const dialogs = read('src/subapps/dxf-viewer/app/DxfViewerDialogs.tsx');
    expect(dialogs).toContain('fileRecordId={levelManager.fileRecordId ?? null}');
    expect(dialogs).not.toContain("fileRecordId={levelManager.fileRecordId ?? ''}");
  });
});

describe('κλειδιά i18n', () => {
  const el = locale('el');
  const en = locale('en');

  it('ο κώδικας δηλώνει κλειδιά — αλλιώς το test θα περνούσε χωρίς να κοιτάξει τίποτα', () => {
    expect(declaredKeys().length).toBeGreaterThan(15);
  });

  it.each(['el', 'en'])('🔴 κάθε κλειδί που γράφει ο κώδικας υπάρχει στο %s', (lang) => {
    const tree = lang === 'el' ? el : en;
    const missing = declaredKeys().filter((key) => {
      // Οι πληθυντικοί ζουν ως `key_one` / `key_other` (i18next) — το σκέτο κλειδί δεν υπάρχει.
      if (at(tree, key) !== undefined) return false;
      return at(tree, `${key}_one`) === undefined || at(tree, `${key}_other`) === undefined;
    });
    expect(missing).toEqual([]);
  });

  it('η ετικέτα του κουμπιού υπάρχει και στις δύο γλώσσες', () => {
    expect(at(el, 'ribbon.commands.titleBlockBinding')).toEqual(expect.any(String));
    expect(at(en, 'ribbon.commands.titleBlockBinding')).toEqual(expect.any(String));
  });

  it('🔴 el και en έχουν ΑΚΡΙΒΩΣ τα ίδια κλειδιά — καμία μονόπλευρη προσθήκη', () => {
    const flatten = (node: unknown, prefix = ''): string[] =>
      node && typeof node === 'object'
        ? Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
            v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
          )
        : [];
    expect(flatten(el.titleBlockBinding).sort()).toEqual(flatten(en.titleBlockBinding).sort());
  });

  it('🔴 κανένα δυναμικό t() με πρότυπο κείμενο — ο generator του shell slice αρνείται να παράγει', () => {
    // ⚠️ Τα σχόλια **αφαιρούνται πρώτα**, και όχι από ευγένεια: η πρώτη γραφή αυτού του test
    // κοκκίνιζε επειδή το ίδιο το σχόλιο του κώδικα *έγραφε το απαγορευμένο μοτίβο για να το
    // απαγορεύσει*. Ίδιο σχήμα με την παγίδα του CHECK 3.36, όπου ένα παράδειγμα μέσα σε σχόλιο
    // γέννησε φάντασμα namespace. Ένας φύλακας που δεν ξεχωρίζει κώδικα από κείμενο για
    // ανθρώπους παράγει ψευδώς θετικά — και τα ψευδώς θετικά σκοτώνουν φύλακες.
    const stripComments = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const sources = [
      read('src/subapps/dxf-viewer/ui/components/title-block-binding/TitleBlockProposalList.tsx'),
      read('src/subapps/dxf-viewer/ui/components/TitleBlockBindingPalette.tsx'),
    ]
      .map(stripComments)
      .join('\n');
    expect(sources).not.toMatch(/\bt\(\s*`/);
  });
});
