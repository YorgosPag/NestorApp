/**
 * ADR-763 §12/§13 — **η δομή των ορισμάτων δεν επιτρέπεται να αποκλίνει από τα ονόματα.**
 *
 * 🔴 Ο κωδικός ειδών (`'arnl'`) και τα μεταφρασμένα ονόματα
 * (`τιμή_αναζήτησης;πίνακας;αριθμός_δείκτη_στήλης;εύρος_αναζήτησης`) είναι **δύο αρχεία που
 * περιγράφουν την ίδια λίστα**. Ένας χαρακτήρας παραπάνω ή λιγότερο και ο διάλογος ζωγραφίζει
 * τη στήλη ειδών **μετατοπισμένη**: σωστό όνομα, λάθος γκρι τύπος δίπλα του. Καμία εξαίρεση,
 * κανένα σφάλμα εκτέλεσης — απλώς λάθος οδηγία, με σιγουριά.
 *
 * Ανοίγει τα **πραγματικά** JSON και στις δύο γλώσσες, για τον ίδιο λόγο που το κάνει και το
 * `formula-catalog-i18n.test.ts`: το «σωστό στα ελληνικά, λάθος στα αγγλικά» είναι το σχήμα
 * που παρήγαγε τις δύο αποκλίνουσες λίστες namespace του CHECK 3.34.
 *
 * @see bim/table/formula/catalog/formula-argument-data.ts
 */

import el from '@/i18n/locales/el/dxf-viewer.json';
import en from '@/i18n/locales/en/dxf-viewer.json';
import { FORMULA_CATALOG } from '../formula/catalog/formula-catalog';
import { formulaCatalogKey } from '../formula/catalog/formula-catalog-taxonomy';
import {
  FORMULA_ARGUMENT_STRUCTURE,
  FORMULA_MAX_ARGUMENTS,
} from '../formula/catalog/formula-argument-data';
import { parseKindCode } from '../formula/catalog/formula-argument-taxonomy';
import {
  formatSignature,
  parseArgumentNames,
  resolveFormulaSignature,
  signatureRows,
} from '../formula/catalog/formula-signature';

type ArgsBundle = { readonly args: Record<string, string> };

const LOCALES: ReadonlyArray<readonly [string, Record<string, string>]> = [
  ['el', (el as { table: { insertFunction: ArgsBundle } }).table.insertFunction.args],
  ['en', (en as { table: { insertFunction: ArgsBundle } }).table.insertFunction.args],
];

const DOCUMENTED_NAMES = FORMULA_CATALOG.filter((entry) => entry.documented).map((e) => e.name);
const STRUCTURE_NAMES = Object.keys(FORMULA_ARGUMENT_STRUCTURE);

/** Τα ονόματα ορισμάτων μιας συνάρτησης σε μια γλώσσα. */
function namesOf(bundle: Record<string, string>, fn: string): readonly string[] {
  return parseArgumentNames(bundle[formulaCatalogKey(fn)] ?? '');
}

/** Η υπογραφή όπως τη βλέπει ο διάλογος, με τα ελληνικά ονόματα. */
function greekSignature(fn: string) {
  return resolveFormulaSignature({
    name: fn,
    argumentNames: LOCALES[0][1][formulaCatalogKey(fn)] ?? '',
    genericName: 'Όρισμα',
  });
}

describe('ADR-763 §12 — κάλυψη: κάθε τεκμηριωμένη έχει δομή, καμία ορφανή', () => {
  it('κάθε τεκμηριωμένη συνάρτηση του καταλόγου έχει εγγραφή δομής', () => {
    const missing = DOCUMENTED_NAMES.filter((name) => FORMULA_ARGUMENT_STRUCTURE[name] === undefined);
    expect(missing).toEqual([]);
  });

  it('καμία εγγραφή δομής δεν δείχνει σε άγνωστη ή μη τεκμηριωμένη συνάρτηση', () => {
    const known = new Set(DOCUMENTED_NAMES);
    expect(STRUCTURE_NAMES.filter((name) => !known.has(name))).toEqual([]);
  });

  it('η κάλυψη είναι πλήρης — 153 = 153', () => {
    expect(STRUCTURE_NAMES).toHaveLength(DOCUMENTED_NAMES.length);
  });
});

describe('ADR-763 §12 — ο κωδικός ειδών συμφωνεί με τα ονόματα, ΚΑΙ ΣΤΙΣ ΔΥΟ ΓΛΩΣΣΕΣ', () => {
  it.each(LOCALES)('%s: πλήθος ειδών === πλήθος ονομάτων', (_locale, bundle) => {
    const mismatched = STRUCTURE_NAMES.filter((fn) => {
      const parsed = parseKindCode(FORMULA_ARGUMENT_STRUCTURE[fn].k);
      return parsed === null || parsed.kinds.length !== namesOf(bundle, fn).length;
    });
    expect(mismatched).toEqual([]);
  });

  it('κάθε κωδικός ειδών αναλύεται (κανένα γράμμα εκτός λεξιλογίου)', () => {
    const broken = STRUCTURE_NAMES.filter((fn) => parseKindCode(FORMULA_ARGUMENT_STRUCTURE[fn].k) === null);
    expect(broken).toEqual([]);
  });

  it('τα υποχρεωτικά δεν ξεπερνούν τα δηλωμένα ορίσματα', () => {
    const overflowing = STRUCTURE_NAMES.filter((fn) => {
      const parsed = parseKindCode(FORMULA_ARGUMENT_STRUCTURE[fn].k);
      return parsed !== null && FORMULA_ARGUMENT_STRUCTURE[fn].req > parsed.kinds.length;
    });
    expect(overflowing).toEqual([]);
  });

  /**
   * 🔴 Ένα όνομα ορίσματος που περιέχει `;` θα κοβόταν στα δύο από το
   * {@link parseArgumentNames} — δηλαδή θα γεννούσε φάντασμα όρισμα και θα χαλούσε το μήκος.
   * Ο έλεγχος φυλάει τη **μορφή αποθήκευσης**, όχι τη γλώσσα.
   */
  it.each(LOCALES)('%s: κανένα όνομα ορίσματος δεν περιέχει τον διαχωριστή αποθήκευσης', (_l, bundle) => {
    const offenders = STRUCTURE_NAMES.filter((fn) => namesOf(bundle, fn).some((n) => n.includes(';')));
    expect(offenders).toEqual([]);
  });
});

describe('ADR-763 §13 — μηδενική τάξη και επαναλαμβανόμενα', () => {
  it.each(['PI', 'TRUE', 'FALSE', 'NA'])('η %s δεν έχει ορίσματα, αλλά έχει υπογραφή', (fn) => {
    const spec = greekSignature(fn);
    expect(spec.args).toEqual([]);
    expect(spec.repeat).toBeUndefined();
    expect(spec.named).toBe(true);
    expect(signatureRows(spec, 0)).toEqual([]);
  });

  it('η CONCATENATE ξεκινά με δύο σειρές και μεγαλώνει κατά μία', () => {
    const spec = greekSignature('CONCATENATE');
    expect(spec.args.map((a) => a.name)).toEqual(['κείμενο1', 'κείμενο2']);
    expect(spec.repeat).toEqual({ groupSize: 1, max: FORMULA_MAX_ARGUMENTS });
    expect(signatureRows(spec, 0).map((a) => a.name)).toEqual(['κείμενο1', 'κείμενο2']);
    expect(signatureRows(spec, 2).map((a) => a.name)).toEqual(['κείμενο1', 'κείμενο2', 'κείμενο3']);
    expect(signatureRows(spec, 3).map((a) => a.name))
      .toEqual(['κείμενο1', 'κείμενο2', 'κείμενο3', 'κείμενο4']);
  });

  /**
   * 🔴 Η καρδιά του {@link FormulaRepeatSpec}: το `SUMIFS` **δεν** κατεβάζει ποτέ μισό ζεύγος.
   * Με σημαία `repeats` σε ένα όρισμα, η επόμενη σειρά θα ήταν σκέτο `κριτήρια2`.
   */
  it('η SUMIFS μεγαλώνει σε ΖΕΥΓΗ, ποτέ μισό', () => {
    const spec = greekSignature('SUMIFS');
    expect(spec.repeat?.groupSize).toBe(2);
    const grown = signatureRows(spec, 3).map((a) => a.name);
    expect(grown).toHaveLength(5);
    expect(grown.slice(3)).toEqual([`${spec.args[1].name.replace(/\d+$/, '')}2`, `${spec.args[2].name.replace(/\d+$/, '')}2`]);
  });

  it('η ROUND δεν μεγαλώνει ποτέ — σταθερό πλήθος', () => {
    const spec = greekSignature('ROUND');
    expect(spec.repeat).toBeUndefined();
    expect(signatureRows(spec, 9)).toHaveLength(2);
  });

  it('η επανάληψη σταματά στο ανώτατο', () => {
    const spec = greekSignature('SUM');
    expect(signatureRows(spec, 10_000)).toHaveLength(FORMULA_MAX_ARGUMENTS);
  });
});

describe('ADR-763 §13 — υποχρεωτικότητα', () => {
  it('η VLOOKUP έχει 3 υποχρεωτικά και 1 προαιρετικό', () => {
    const spec = greekSignature('VLOOKUP');
    expect(spec.args.map((a) => a.requirement))
      .toEqual(['required', 'required', 'required', 'optional']);
  });

  it('η IF έχει 2 υποχρεωτικά — το τρίτο είναι προαιρετικό όπως στο Excel', () => {
    expect(greekSignature('IF').args.map((a) => a.requirement))
      .toEqual(['required', 'required', 'optional']);
  });

  it('τα είδη ακολουθούν τη σειρά των ονομάτων', () => {
    expect(greekSignature('VLOOKUP').args.map((a) => a.kind))
      .toEqual(['any', 'range', 'number', 'logical']);
  });
});

describe('ADR-763 §13 — οι 222 μη τεκμηριωμένες ΑΝΟΙΓΟΥΝ κι αυτές', () => {
  const undocumented = FORMULA_CATALOG.find((entry) => !entry.documented);

  it('υπάρχει τουλάχιστον μία μη τεκμηριωμένη στον κατάλογο', () => {
    expect(undocumented).toBeDefined();
  });

  it('παίρνει γενικά ονόματα, καμία εφευρημένη υποχρεωτικότητα', () => {
    const spec = resolveFormulaSignature({
      name: undocumented!.name,
      argumentNames: '',
      genericName: 'Όρισμα',
    });
    expect(spec.named).toBe(false);
    expect(spec.args.map((a) => a.name)).toEqual(['Όρισμα1', 'Όρισμα2']);
    expect(spec.args.every((a) => a.requirement === 'unspecified')).toBe(true);
    expect(signatureRows(spec, 2).map((a) => a.name)).toEqual(['Όρισμα1', 'Όρισμα2', 'Όρισμα3']);
  });
});

describe('ADR-763 §13 — 🔴 η υπογραφή χρησιμοποιεί τον διαχωριστή ΤΗΣ ΓΡΑΜΜΑΤΙΚΗΣ', () => {
  it('ίδια υπογραφή, δύο γραμματικές, δύο κείμενα', () => {
    const spec = greekSignature('ROUND');
    expect(formatSignature(spec, ';')).toBe('ROUND(αριθμός;αριθμός_ψηφίων)');
    expect(formatSignature(spec, ',')).toBe('ROUND(αριθμός,αριθμός_ψηφίων)');
  });

  it('το επαναλαμβανόμενο τελειώνει σε έλλειψη, όχι σε εφευρημένο τρίτο όρισμα', () => {
    expect(formatSignature(greekSignature('SUM'), ';')).toBe('SUM(αριθμός1;αριθμός2;…)');
  });

  it('η μηδενικής τάξης δεν γράφει διαχωριστή', () => {
    expect(formatSignature(greekSignature('PI'), ';')).toBe('PI()');
  });
});
