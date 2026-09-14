/**
 * ΑΓΚΥΡΕΣ ΤΗΣ ΠΥΛΗΣ 3.83 — «ποιος αποφασίζει τη γραμμή From:;» (ADR-857 Φ9)
 *
 * 🔑 **ΚΑΘΕ ΑΓΚΥΡΑ ΕΚΤΕΛΕΙ ΤΗΝ ΙΔΙΑ ΤΗ ΜΗΧΑΝΗ ΤΗΣ ΠΥΛΗΣ** — καμία δεν ξαναγράφει τη
 * λογική της. Μια πύλη που δεν μπορεί να **κοκκινίσει αποδεδειγμένα** δεν είναι πύλη
 * (CHECK 3.54: «μπορεί αυτό το αρχείο test να κοκκινίσει κάτι;»).
 *
 * ⚠️ Τα `shouldMatch`/`shouldSkip` δεν είναι επινοημένα: το κρίσιμο **skip** είναι
 * **πραγματικό ψευδώς θετικό που παρήγαγε η πρώτη εκτέλεση** της πύλης σε ζωντανό
 * δέντρο. Ένα μετρημένο ψευδώς θετικό αξίζει περισσότερο από δέκα φανταστικά.
 */
'use strict';

const {
  envReadsIn,
  manualCompositionsIn,
  importsRoot,
  rootExportNames,
  sourceFileOf,
  SENDER_ENV_VARS,
  ROOT_EXPORTS,
} = require('../check-sender-authority');

const FILE = '/virtual/sample.ts';
const parse = (code) => sourceFileOf(FILE, code);

// =============================================================================
// Κ1 — ΑΝΑΓΝΩΣΗ ΜΕΤΑΒΛΗΤΗΣ ΑΠΟΣΤΟΛΕΑ
// =============================================================================

describe('Κ1 — η μεταβλητή αποστολέα διαβάζεται ΜΟΝΟ στη ρίζα', () => {
  it.each(SENDER_ENV_VARS)('Κ1α · πιάνει το process.env.%s σε κώδικα', (name) => {
    const hits = envReadsIn(parse(`const x = process.env.${name} || 'fallback';`));
    expect(hits.map((h) => h.variable)).toEqual([name]);
  });

  it('Κ1β 🔴 ΤΟ ΣΧΟΛΙΟ ΠΟΥ ΤΕΚΜΗΡΙΩΝΕΙ ΤΗ ΘΕΡΑΠΕΙΑ ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΒΑΣΗ', () => {
    // Αυτός είναι ΟΛΟΚΛΗΡΟΣ ο λόγος που η πύλη είναι AST και όχι κείμενο: και τα εννέα
    // θεραπευμένα αρχεία της Φ9 κουβαλούν σχόλια που ΟΝΟΜΑΖΟΥΝ ό,τι αφαιρέθηκε.
    // Σαρωτής κειμένου θα κοκκίνιζε πάνω στη ΘΕΡΑΠΕΙΑ (σχήμα Κ7β του 3.50).
    const code = [
      '// 🔴 ΕΔΩ ΖΟΥΣΕ: process.env.FROM_NAME || PRODUCT_NAME — έφυγε στη Φ9.',
      '/* Διάβαζε process.env.FROM_EMAIL με δική του εφεδρεία. */',
      "const from = resolveSenderHeader();",
    ].join('\n');
    expect(envReadsIn(parse(code))).toEqual([]);
  });

  it('Κ1γ · μεταβλητή ΕΚΤΟΣ του κλειστού συνόλου δεν είναι εύρημα', () => {
    // `NEXT_PUBLIC_COMPANY_EMAIL_DOMAIN` είναι ΑΛΛΟ αναγνωριστικό από το
    // `COMPANY_EMAIL_DOMAIN` — η ταύτιση είναι ακριβής, ποτέ υποσυμβολοσειρά.
    const code = 'const d = process.env.NEXT_PUBLIC_COMPANY_EMAIL_DOMAIN;';
    expect(envReadsIn(parse(code))).toEqual([]);
  });

  it('Κ1δ · συμβολοσειρά που ΠΕΡΙΕΧΕΙ το όνομα δεν είναι ανάγνωση', () => {
    expect(envReadsIn(parse("const doc = 'όρισε FROM_NAME στο περιβάλλον';"))).toEqual([]);
  });
});

// =============================================================================
// Κ2 — ΧΕΙΡΟΓΡΑΦΗ ΣΥΝΘΕΣΗ ΤΟΥ ΦΑΚΕΛΟΥ
// =============================================================================

describe('Κ2 — «Όνομα <διεύθυνση>» συντίθεται ΜΟΝΟ στη ρίζα', () => {
  it.each([
    ['κανονικό', 'const h = `${name} <${email}>`;'],
    ['χωρίς κενό', 'const h = `${name}<${email}>`;'],
    ['με ουρά μετά', 'const h = `${name} <${email}> (αποστολέας)`;'],
  ])('Κ2α · πιάνει %s', (_label, code) => {
    expect(manualCompositionsIn(parse(code))).toHaveLength(1);
  });

  it('Κ2β 🔴 ΤΟ ΜΕΤΡΗΜΕΝΟ ΨΕΥΔΩΣ ΘΕΤΙΚΟ — μήνυμα XML με ΔΥΟ ετικέτες', () => {
    // Η ΠΡΩΤΗ εκτέλεση της πύλης σε ζωντανό δέντρο (16.558 αρχεία) κοκκίνισε ΕΔΩ:
    // `src/lib/xml/xml-dom.ts:38`. Η αιτία ήταν ο κανόνας, όχι το αρχείο — ρωτούσε
    // «τελειώνει το ενδιάμεσο σε `<`;» αντί «είναι το ενδιάμεσο ΜΟΝΟ κενά και `<`;».
    // ⚠️ Καρφώνεται εδώ ΑΥΤΟΥΣΙΟ: αν κάποιος χαλαρώσει ξανά τον κανόνα, κοκκινίζει.
    const code = 'throw new Error(`Root element is not <${expectedRoot}> (found <${root.tagName}>).`);';
    expect(manualCompositionsIn(parse(code))).toEqual([]);
  });

  it.each([
    ['σύνδεσμος HTML', 'const a = `<a href="${url}">${label}</a>`;'],
    ['διαδρομή', 'const p = `${origin}/api/notifications`;'],
    ['mailto', 'const m = `mailto:${address}`;'],
    ['γενικός τύπος', 'const t = `Array<${inner}>`;'],
  ])('Κ2γ · δεν πιάνει %s', (_label, code) => {
    expect(manualCompositionsIn(parse(code))).toEqual([]);
  });

  it('Κ2δ · σχόλιο που δείχνει τη ΛΑΘΟΣ μορφή δεν είναι παράβαση', () => {
    expect(manualCompositionsIn(parse('// ΜΗΝ γράψεις `${name} <${email}>` — ρώτα τη ρίζα.'))).toEqual([]);
  });
});

// =============================================================================
// Κ3 + ΠΑΡΟΝΟΜΑΣΤΗΣ
// =============================================================================

describe('Κ3 — η ρίζα εξάγει ό,τι υποθέτει η πύλη', () => {
  it('Κ3α · διαβάζει τα εξαγόμενα ονόματα από τον ΚΩΔΙΚΑ', () => {
    const code = [
      "export const PLATFORM_SENDER_ADDRESS = 'info@example.gr';",
      'export type SenderHeader = string;',
      'export function senderHeader() { return 1; }',
      'function notExported() { return 2; }',
    ].join('\n');
    const names = rootExportNames(parse(code));
    expect(names.has('PLATFORM_SENDER_ADDRESS')).toBe(true);
    expect(names.has('senderHeader')).toBe(true);
    expect(names.has('notExported')).toBe(false);
  });

  it('Κ3β 🔴 ΑΝ ΛΕΙΨΕΙ ΕΞΑΓΩΓΗ, Η ΠΥΛΗ ΤΟ ΒΛΕΠΕΙ — fail-closed', () => {
    const names = rootExportNames(parse("export const PLATFORM_SENDER_ADDRESS = 'x';"));
    const missing = ROOT_EXPORTS.filter((n) => !names.has(n));
    expect(missing).toContain('resolveSenderHeader');
    expect(missing).toContain('adoptStoredSenderHeader');
  });
});

describe('Παρονομαστής — «φυλάει τίποτα;»', () => {
  it('Π1 · αναγνωρίζει καταναλωτή που εισάγει τη ρίζα', () => {
    const code = "import { resolveSenderHeader } from '@/services/company/sender-identity';";
    expect(importsRoot(parse(code))).toBe(true);
  });

  it('Π2 · ΔΕΝ μετρά ως καταναλωτή ένα σκέτο σχόλιο που την ονομάζει', () => {
    expect(importsRoot(parse('// δες services/company/sender-identity'))).toBe(false);
  });

  it('Π3 · άσχετη εισαγωγή δεν μετρά', () => {
    expect(importsRoot(parse("import { x } from '@/services/company/company-name-resolver';"))).toBe(false);
  });
});
