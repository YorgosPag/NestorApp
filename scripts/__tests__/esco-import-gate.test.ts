/**
 * ΑΓΚΥΡΕΣ — **Η ΠΥΛΗ FAIL-CLOSED** και **Η ΑΡΝΗΣΗ ΝΑ ΕΠΙΝΟΗΣΟΥΜΕ ΚΩΔΙΚΟ**
 * (ADR-132 · ADR-798 §20.4 #3 και #4).
 *
 * ⚠️ Όλες εκτελούν. Η πύλη δοκιμάζεται με **ενεμένο γραφέα**, ώστε η πρόταση
 * *«δεν γράφει τίποτα όταν η συγκομιδή είναι ατελής»* να είναι **μετρημένη
 * σειρά**, όχι ισχυρισμός σε σχόλιο.
 */

import {
  runEscoImport,
  harvestRefusals,
  uriToDocId,
  type EscoImportDescriptor,
  type EscoTransformResult,
} from '../lib/esco/esco-import-runner';
import type { HarvestVerdict } from '../lib/esco/esco-harvest';
import type { EscoSearchResult } from '../lib/esco/esco-api';
import {
  transformOccupations,
  iscoSegmentOf,
} from '../lib/esco/esco-occupation-document';
import { transformSkills } from '../lib/esco/esco-skill-document';
import { classifyIscoCode, resolveIscoPrefix } from '../../src/config/isco-prefix';
import type { EscoOccupationDocument } from '../../src/types/contacts/esco-types';

// ============================================================================
// ΕΡΓΑΛΕΙΑ
// ============================================================================

function concept(overrides: Partial<EscoSearchResult> = {}): EscoSearchResult {
  return {
    uri: 'http://data.europa.eu/esco/occupation/fbceeac6-798b-4307-a825-626707a753ad',
    code: '2142.1.9',
    preferredLabel: { el: 'Πολιτικός Μηχανικός', en: 'Civil Engineer' },
    ...overrides,
  };
}

// ============================================================================
// Α. 🔴 ΤΟ '0000' — Η ΕΠΙΝΟΗΜΕΝΗ ΤΑΥΤΟΤΗΤΑ
// ============================================================================

describe('Α. ο κωδικός ISCO δεν επινοείται', () => {
  it('🔴 ΓΙΑΤΙ ΗΤΑΝ ΨΕΜΑ: το «0000» είναι ΑΔΙΑΚΡΙΤΟ από πραγματικό κωδικό', () => {
    // Ο ταξινομητής — ο ΙΔΙΟΣ που ρωτά όλη η εφαρμογή — δεν μπορεί να το
    // ξεχωρίσει. Άρα η σεντινέλα ΞΕΠΛΕΝΕ σφάλμα σε νόμιμη κατάσταση.
    expect(classifyIscoCode('0000')).toEqual({ kind: 'valid', code: '0000' });
    expect(classifyIscoCode('0110')).toEqual({ kind: 'valid', code: '0110' });
    // Και το πρόθεμα «0» είναι υπαρκτή μείζων ομάδα: Ένοπλες Δυνάμεις.
    expect(resolveIscoPrefix({ '0': 'ΕΝΟΠΛΕΣ ΔΥΝΑΜΕΙΣ' }, '0000')).toEqual({
      kind: 'declared',
      entry: 'ΕΝΟΠΛΕΣ ΔΥΝΑΜΕΙΣ',
      prefix: '0',
    });
    // Το κενό, αντίθετα, δεν ταξινομείται πουθενά — και αυτό είναι η αλήθεια.
    expect(resolveIscoPrefix({ '0': 'ΕΝΟΠΛΕΣ ΔΥΝΑΜΕΙΣ' }, '')).toEqual({ kind: 'absent' });
  });

  it('έννοια ΧΩΡΙΣ κωδικό γράφεται με κενό — ποτέ 0000 / 000', () => {
    const { documents, notes } = transformOccupations([concept({ code: undefined })]);

    expect(documents[0].iscoCode).toBe('');
    expect(documents[0].iscoGroup).toBe('');
    expect(documents[0].iscoCode).not.toBe('0000');
    expect(documents[0].iscoGroup).not.toBe('000');
    expect(notes.join(' ')).toContain('1 χωρίς κωδικό');
  });

  it('έγκυρος κωδικός δίνει κωδικό ΚΑΙ τριψήφια ελάσσονα ομάδα', () => {
    const { documents, notes, warnings } = transformOccupations([concept()]);

    expect(documents[0].iscoCode).toBe('2142');
    expect(documents[0].iscoGroup).toBe('214');
    expect(notes.join(' ')).toContain('1 με κωδικό');
    expect(warnings).toHaveLength(0);
  });

  it('ΔΥΣΜΟΡΦΟΣ κωδικός μένει ΑΥΤΟΥΣΙΟΣ, χωρίς ομάδα, και ΦΩΝΑΖΕΙ', () => {
    const { documents, warnings } = transformOccupations([concept({ code: 'X7.1' })]);

    // Αποθηκεύεται ΠΑΝΤΑ ό,τι κρίθηκε: η έξοδος του `iscoSegmentOf`.
    // Ορατό στον επιλυτή ως σφάλμα — όχι ξεπλυμένο σε σιωπή.
    expect(documents[0].iscoCode).toBe('X7');
    expect(resolveIscoPrefix({}, documents[0].iscoCode)).toEqual({
      kind: 'malformed',
      value: 'X7',
    });
    expect(documents[0].iscoGroup).toBe('');
    expect(warnings.join(' ')).toContain('ΔΥΣΜΟΡΦΟ');
    expect(warnings.join(' ')).toContain('X7');
  });

  it('κωδικός που αρχίζει με τελεία είναι ΔΥΣΜΟΡΦΟΣ, όχι απών', () => {
    // ⚠️ Η προφανής υλοποίηση (`code.split('.')[0] || ''`) θα τον έλεγε «απόντα»
    // — δηλαδή θα έκρυβε σφάλμα της πηγής μέσα σε νόμιμη σιωπή, ξανά.
    expect(iscoSegmentOf('.1.9')).toBe('.1.9');
    expect(iscoSegmentOf(undefined)).toBeUndefined();
    expect(iscoSegmentOf('   ')).toBeUndefined();
    expect(iscoSegmentOf('2142.1.9')).toBe('2142');

    const { warnings } = transformOccupations([concept({ code: '.1.9' })]);
    expect(warnings.join(' ')).toContain('ΔΥΣΜΟΡΦΟ');
  });

  it('έννοια χωρίς ΚΑΜΙΑ ετικέτα παραλείπεται, και η παράλειψη μετριέται', () => {
    const { documents } = transformOccupations([
      concept(),
      concept({ uri: 'urn:x', preferredLabel: {} }),
    ]);

    expect(documents).toHaveLength(1);
  });

  it('τα tokens γράφονται από τον ΚΟΙΝΟ τοκενιστή, με προθέματα', () => {
    const { documents } = transformOccupations([concept()]);

    expect(documents[0].searchTokensEl).toContain('πο');
    expect(documents[0].searchTokensEl).toContain('πολιτικος'); // χωρίς τόνο
    expect(documents[0].searchTokensEn).toContain('civil');
    expect(documents[0].searchTokensEl).not.toContain('π'); // ελάχιστο 2
  });
});

// ============================================================================
// Β. ΔΕΞΙΟΤΗΤΕΣ — ίδια μηχανή, χωρίς ISCO
// ============================================================================

describe('Β. δεξιότητες', () => {
  it('παράγει έγγραφο χωρίς κανένα πεδίο ISCO', () => {
    const { documents } = transformSkills([
      { uri: 'urn:s1', preferredLabel: { el: 'Συγκόλληση', en: 'Welding' } },
    ]);

    expect(documents).toHaveLength(1);
    expect(documents[0]).not.toHaveProperty('iscoCode');
    expect(documents[0].searchTokensEn).toContain('weld');
  });
});

// ============================================================================
// Γ. ΤΟ ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ ID — ιδιοδύναμη επανεισαγωγή
// ============================================================================

describe('Γ. id εγγράφου', () => {
  const prefix = 'http://data.europa.eu/esco/occupation/';

  it('ίδιο URI ⇒ ίδιο id, πάντα', () => {
    const uri = `${prefix}fbceeac6-798b-4307-a825-626707a753ad`;
    expect(uriToDocId(uri, prefix)).toBe('fbceeac6-798b-4307-a825-626707a753ad');
    expect(uriToDocId(uri, prefix)).toBe(uriToDocId(uri, prefix));
  });

  it('URI χωρίς UUID πέφτει σε ασφαλές εφεδρικό', () => {
    expect(uriToDocId(`${prefix}κάτι/άλλο`, prefix)).toMatch(/^[a-zA-Z0-9_-]+$/);
  });
});

// ============================================================================
// Δ. 🔴 Η ΠΥΛΗ — ΑΤΕΛΕΣ ΔΕΝ ΓΡΑΦΕΤΑΙ
// ============================================================================

const incomplete: HarvestVerdict = {
  kind: 'incomplete',
  concepts: [concept()],
  declaredTotal: 2942,
  pagesFetched: 5,
  duplicatesDropped: 0,
  recoveredPages: 0,
  failedPages: [{ page: 3, attempts: 5, error: 'ESCO_TRANSIENT HTTP 503' }],
  observedTotals: [2942],
  reasons: ['pages-failed', 'count-mismatch'],
};

const complete: HarvestVerdict = {
  kind: 'complete',
  concepts: [concept()],
  declaredTotal: 1,
  pagesFetched: 1,
  duplicatesDropped: 0,
  recoveredPages: 0,
};

const descriptor: EscoImportDescriptor<EscoOccupationDocument> = {
  title: 'δοκιμή',
  conceptType: 'occupation',
  scheme: 'urn:scheme',
  collection: 'system/esco_cache/occupations',
  uriPrefix: 'http://data.europa.eu/esco/occupation/',
  noun: 'επαγγέλματα',
  transform: transformOccupations,
  uriOf: (document) => document.uri,
};

interface RunResult {
  readonly exitCode: number;
  readonly writes: number;
  readonly output: string;
}

async function run(verdict: HarvestVerdict, argv: string[] = []): Promise<RunResult> {
  const output: string[] = [];
  const log = jest.spyOn(console, 'log').mockImplementation((...a) => void output.push(a.join(' ')));
  const err = jest.spyOn(console, 'error').mockImplementation((...a) => void output.push(a.join(' ')));
  let writes = 0;
  try {
    const exitCode = await runEscoImport(descriptor, argv, {
      harvest: () => Promise.resolve(verdict),
      write: (_d, documents) => {
        writes += 1;
        return Promise.resolve(documents.length);
      },
    });
    return { exitCode, writes, output: output.join('\n') };
  } finally {
    log.mockRestore();
    err.mockRestore();
  }
}

describe('Δ. πύλη fail-closed', () => {
  it('🔴 ΑΤΕΛΗΣ συγκομιδή ⇒ ΜΗΔΕΝ γραφές, έξοδος 1, καμία ✅', async () => {
    const result = await run(incomplete);

    expect(result.writes).toBe(0); // ⚠️ Η σειρά, μετρημένη.
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('ΔΕΝ ΓΡΑΦΤΗΚΕ ΤΙΠΟΤΑ');
    expect(result.output).not.toContain('✅ ΕΙΣΑΓΩΓΗ ΠΛΗΡΗΣ');
  });

  it('--allow-partial γράφει, αλλά ΠΟΤΕ δεν λέει «πλήρης»', async () => {
    const result = await run(incomplete, ['--allow-partial']);

    expect(result.writes).toBe(1);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('⚠️  ΕΙΣΑΓΩΓΗ ΜΕ ΕΠΙΦΥΛΑΞΕΙΣ');
    expect(result.output).not.toContain('✅ ΕΙΣΑΓΩΓΗ ΠΛΗΡΗΣ');
    expect(result.output).toContain('--allow-partial');
  });

  it('πηγή που δηλώνει ΜΗΔΕΝ έννοιες είναι βλάβη, όχι άδειο λεξιλόγιο', async () => {
    const result = await run({ ...complete, concepts: [], declaredTotal: 0 });

    expect(result.writes).toBe(0);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('ΜΗΔΕΝ έννοιες');
  });

  it('πλήρης συγκομιδή γράφει και δηλώνει ✅ με κλειστή λογιστική', async () => {
    const result = await run(complete);

    expect(result.writes).toBe(1);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('✅ ΕΙΣΑΓΩΓΗ ΠΛΗΡΗΣ');
    expect(result.output).toContain('📐 Λογιστική');
    expect(result.output).toContain('δηλωμένα 1 · μοναδικά 1 · έγγραφα 1 · παραλείφθηκαν 0');
  });

  it('δύσμορφοι κωδικοί κατεβάζουν το banner από ✅ σε ⚠️', async () => {
    const result = await run({ ...complete, concepts: [concept({ code: 'X7.1' })] });

    expect(result.writes).toBe(1);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('⚠️  ΕΙΣΑΓΩΓΗ ΜΕ ΕΠΙΦΥΛΑΞΕΙΣ');
    expect(result.output).not.toContain('✅ ΕΙΣΑΓΩΓΗ ΠΛΗΡΗΣ');
  });
});

// ============================================================================
// ΣΤ. 🔍 --dry-run — Η ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΠΟΥ ΕΛΕΙΠΕ (ADR-132 §10 · ADR-823)
// ============================================================================
//
// 🔴 **Γιατί**: ο εισαγωγέας γράφει σε **παραγωγή** και η μηχανή **δεν έχει δει
// ποτέ** το αληθινό API — και οι 95 άγκυρες τρέχουν με **πλαστό `fetch`**. Το
// πρώτο πραγματικό τρέξιμο **ήταν** και η πρώτη γραφή. Καμία σοβαρή εργαλειοθήκη
// δεν βγάζει μεταλλάκτη δεδομένων χωρίς προεπισκόπηση.
//
// ⚠️ **Ο ΤΡΟΠΟΣ ΕΧΕΙ ΣΗΜΑΣΙΑ**: το `run()` παραπάνω **ενίει γραφέα-κατάσκοπο**.
// Άρα η πρόταση *«το --dry-run δεν γράφει»* δεν ελέγχεται από **κείμενο εξόδου**
// αλλά από **μετρημένη σειρά κλήσεων**: ο κατάσκοπος δεν καλείται ΠΟΤΕ. Άγκυρα
// που ζητούσε `toContain('ΠΡΟΕΠΙΣΚΟΠΗΣΗ')` θα αποδείκνυε ότι το μήνυμα είναι
// **γραμμένο**, ποτέ ότι ο γραφέας είναι **παρακαμμένος**.
describe('ΣΤ. --dry-run: ΜΗΔΕΝ γραφές, πλήρης λογιστική', () => {
  it('🔑 ο ΓΡΑΦΕΑΣ ΔΕΝ ΚΑΛΕΙΤΑΙ ΚΑΘΟΛΟΥ — ούτε ο ενεμένος', async () => {
    const result = await run(complete, ['--dry-run']);

    expect(result.writes).toBe(0); // ⚠️ Η σειρά, μετρημένη — όχι το μήνυμα.
    expect(result.exitCode).toBe(0);
  });

  it('η σημαία ΝΙΚΑ τον ενεμένο γραφέα — δεν παρακάμπτεται από σημείο εισόδου', async () => {
    // Η ίδια κλήση ΧΩΡΙΣ τη σημαία καλεί τον κατάσκοπο ακριβώς μία φορά. Αυτό το
    // ζεύγος είναι που κάνει το προηγούμενο test να σημαίνει κάτι: αλλιώς θα ήταν
    // πράσινο και σε μια υλοποίηση που δεν γράφει ΠΟΤΕ.
    const withFlag = await run(complete, ['--dry-run']);
    const withoutFlag = await run(complete, []);

    expect(withFlag.writes).toBe(0);
    expect(withoutFlag.writes).toBe(1);
  });

  it('δείχνει ΑΚΡΙΒΩΣ την ίδια λογιστική με την πραγματική γραφή', async () => {
    const preview = await run(complete, ['--dry-run']);
    const real = await run(complete, []);

    const accounting = 'δηλωμένα 1 · μοναδικά 1 · έγγραφα 1 · παραλείφθηκαν 0';
    expect(preview.output).toContain(accounting);
    expect(real.output).toContain(accounting);
  });

  it('λέει ΠΟΣΑ και ΠΟΥ θα γράφονταν, και δείχνει δείγμα id', async () => {
    const result = await run(complete, ['--dry-run']);

    expect(result.output).toContain('system/esco_cache/occupations');
    expect(result.output).toContain('ΘΑ γράφονταν: 1 επαγγέλματα');
    // Το id είναι το UUID του URI — ντετερμινιστικό, άρα ελέγξιμο.
    expect(result.output).toContain('fbceeac6-798b-4307-a825-626707a753ad');
  });

  it('ΠΟΤΕ δεν δηλώνει επιτυχή εισαγωγή — η προεπισκόπηση δεν είναι εισαγωγή', async () => {
    const result = await run(complete, ['--dry-run']);

    expect(result.output).not.toContain('✅ ΕΙΣΑΓΩΓΗ ΠΛΗΡΗΣ');
    expect(result.output).not.toContain('⚠️  ΕΙΣΑΓΩΓΗ ΜΕ ΕΠΙΦΥΛΑΞΕΙΣ');
    expect(result.output).toContain('ΤΙΠΟΤΑ ΔΕΝ ΓΡΑΦΤΗΚΕ');
  });

  it('🔴 η ΠΥΛΗ προηγείται: ατελής συγκομιδή σταματά ΚΑΙ σε --dry-run', async () => {
    // Η προεπισκόπηση δεν επιτρέπεται να δείξει ποτέ κάτι που η πύλη θα απέρριπτε
    // — αλλιώς θα δίδασκε λάθος μοντέλο για το τι θα γραφόταν.
    const result = await run(incomplete, ['--dry-run']);

    expect(result.writes).toBe(0);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('ΔΕΝ ΓΡΑΦΤΗΚΕ ΤΙΠΟΤΑ');
    expect(result.output).not.toContain('ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΟΛΟΚΛΗΡΩΘΗΚΕ');
  });

  it('συνδυασμός --dry-run --allow-partial: προχωρά ως την προεπισκόπηση, ΧΩΡΙΣ γραφή', async () => {
    const result = await run(incomplete, ['--dry-run', '--allow-partial']);

    expect(result.writes).toBe(0);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('ΤΙΠΟΤΑ ΔΕΝ ΓΡΑΦΤΗΚΕ');
  });
});

// ============================================================================
// Ε. Ο ΚΡΙΤΗΣ ΤΗΣ ΠΥΛΗΣ, ΞΕΧΩΡΙΣΤΑ
// ============================================================================

describe('Ε. harvestRefusals', () => {
  const empty: EscoTransformResult<EscoOccupationDocument> = {
    documents: [],
    notes: [],
    warnings: [],
  };
  const one = transformOccupations([concept()]);

  it('πλήρες + έγγραφα ⇒ καμία άρνηση', () => {
    expect(harvestRefusals(complete, one, false)).toHaveLength(0);
  });

  it('πλήρες αλλά ΜΗΔΕΝ έγγραφα ⇒ άρνηση', () => {
    expect(harvestRefusals(complete, empty, false)).toHaveLength(1);
  });

  it('ατελές ⇒ άρνηση· ατελές + allowPartial ⇒ καμία', () => {
    expect(harvestRefusals(incomplete, one, false)).toHaveLength(1);
    expect(harvestRefusals(incomplete, one, true)).toHaveLength(0);
  });
});
