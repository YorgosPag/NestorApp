/**
 * @fileoverview 🔴 **Οι δύο ειλικρίνειες οθόνης της Φ4β** (ADR-759 §4.9).
 *
 * Και οι δύο βλάβες ήταν **ορατές στην οθόνη και αόρατες σε 1.757 tests**, γιατί καμία δεν
 * είναι σφάλμα: η μία τύπωνε παύλα εκεί που ανήκει όνομα, η άλλη τύπωνε τη **φράση που
 * προκάλεσε** μια λογική τιμή αντί για την τιμή. Δύο προτάσεις που δεν ισχύουν, με όλες τις
 * πύλες πράσινες.
 *
 * ⚠️ **Το `fakeT` διαβάζει τα ΠΡΑΓΜΑΤΙΚΑ locale αρχεία** — ίδιο ιδίωμα με το
 * `title-block-binding-wiring.test.ts`, και για τον ίδιο λόγο: ένα mock που επιστρέφει το
 * κλειδί δεν μπορεί να αποδείξει ούτε ότι το κλειδί **υπάρχει**, ούτε ότι το πρότυπο είναι
 * **ICU** (μονά άγκιστρα). Το project τρέχει `.use(ICU)`· τα `{{διπλά}}` θα ήταν σιωπηλά
 * αδρανή και θα βάφονταν ωμά στην οθόνη — έχει ήδη συμβεί (handoff Ζ.1).
 */

/* global describe, it, expect */
import fs from 'fs';
import path from 'path';
import {
  SURVEY_AFFIRMATION_LABEL,
  SURVEY_RECORD_LABEL_NAMESPACE,
  SURVEY_RECORD_NAME_LABEL,
  surveyAffirmationLabel,
  surveyRecordDisplayName,
} from '../survey-record-labels';
import { surveyRecordLabel } from '@/lib/survey-record/survey-record-label';
import { createEmptySurveyRecord } from '@/lib/survey-record/survey-record-factory';
import { surveySourced, userSourced, type SurveyRecord } from '@/types/project-survey-record';

// __tests__ → config → src → ρίζα
const ROOT = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const LANGS = ['el', 'en'] as const;
type Lang = (typeof LANGS)[number];

const tree = (lang: Lang): Record<string, unknown> =>
  JSON.parse(read(`src/i18n/locales/${lang}/${SURVEY_RECORD_LABEL_NAMESPACE}.json`));

function at(node: Record<string, unknown>, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined,
      node,
    );
}

/**
 * `t` που επιλύει **προθεματισμένα** κλειδιά από τα αληθινά αρχεία, όπως το i18next.
 *
 * Επιστρέφει το κλειδί αυτούσιο όταν λείπει — δηλαδή αναπαράγει ακριβώς αυτό που θα έβαφε η
 * οθόνη, ώστε ο έλεγχος «δεν είναι ωμό κλειδί» να έχει νόημα.
 */
const fakeT = (lang: Lang) =>
  ((key: string, vars?: Record<string, string>) => {
    const bare = key.startsWith(`${SURVEY_RECORD_LABEL_NAMESPACE}:`)
      ? key.slice(SURVEY_RECORD_LABEL_NAMESPACE.length + 1)
      : key;
    const raw = at(tree(lang), bare);
    const text = typeof raw === 'string' ? raw : key;
    return vars
      ? Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), text)
      : text;
  }) as never;

const blank = (): SurveyRecord =>
  createEmptySurveyRecord({
    companyId: 'comp_1',
    projectId: 'proj_1',
    createdBy: 'user_1',
    now: '2026-08-06T00:00:00.000Z',
  });

// ── 1. Η ταυτότητα ────────────────────────────────────────────────────────────

describe('🔴 surveyRecordLabel — ταυτότητα, ποτέ κείμενο διεπαφής', () => {
  it('η ολοκαίνουργια καρτέλα δεν έχει όνομα, και το λέει με `null`', () => {
    expect(surveyRecordLabel(blank())).toBeNull();
  });

  it('🔴 ΠΟΤΕ παύλα — ήταν η κατάσταση κάθε νέας καρτέλας και τη διάβαζε ο μηχανικός', () => {
    // Μετάλλαξη-φύλακας: επαναφέροντας το `return UNNAMED` αυτό κοκκινίζει, ενώ ο έλεγχος
    // από πάνω (`toBeNull`) θα κοκκίνιζε κι αυτός — τα δύο μαζί ονομάζουν **τη βλάβη**.
    expect(surveyRecordLabel(blank())).not.toBe('—');
  });

  it('το ωμό κείμενο του σχεδίου προηγείται της αναλυμένης τιμής', () => {
    const record: SurveyRecord = {
      ...blank(),
      surveyDate: surveySourced<string>('2026-07-30', 'ΙΟΥΛΙΟΣ 2026'),
    };
    // Ο μηχανικός έχει δει «ΙΟΥΛΙΟΣ 2026» με τα μάτια του· το ISO θα ήταν αγνώριστο.
    expect(surveyRecordLabel(record)).toBe('ΙΟΥΛΙΟΣ 2026');
  });

  it('χωρίς ωμό κείμενο πέφτει στην αναλυμένη τιμή, μετά στο όνομα αρχείου', () => {
    const parsedOnly: SurveyRecord = { ...blank(), surveyDate: userSourced<string>('2026-07-30') };
    expect(surveyRecordLabel(parsedOnly)).toBe('2026-07-30');

    const fileOnly: SurveyRecord = { ...blank(), sourceFileName: 'G753_ergasia F.dxf' };
    expect(surveyRecordLabel(fileOnly)).toBe('G753_ergasia F.dxf');
  });

  it('⚠️ ΔΕΝ υποχωρεί στο `createdAt` — θα ήταν ημερομηνία που κανείς τοπογράφος δεν δήλωσε', () => {
    const record = blank();
    expect(surveyRecordLabel(record)).not.toBe(record.createdAt);
  });
});

// ── 2. Η φράση, με τα πραγματικά locales ──────────────────────────────────────

describe('🔴 surveyRecordDisplayName — η μία φράση, εκτελεσμένη', () => {
  it.each(LANGS)('η ανώνυμη καρτέλα αποκτά όνομα στο %s, όχι παύλα', (lang) => {
    const out = surveyRecordDisplayName(null, fakeT(lang));
    expect(out).not.toBe('—');
    expect(out).not.toContain('card.recordUnnamed');
    expect(out.length).toBeGreaterThan(3);
  });

  it.each(LANGS)('η ονομασμένη καρτέλα κουβαλά την ταυτότητά της στο %s', (lang) => {
    const out = surveyRecordDisplayName('30/7/2026', fakeT(lang));
    expect(out).toContain('30/7/2026');
    expect(out).not.toContain('card.recordLabel');
    // Το πρότυπο πρέπει να **προσθέτει** κάτι· σκέτη η ταυτότητα θα σήμαινε ότι το `{name}`
    // δεν αντικαταστάθηκε ποτέ και απλώς επιστράφηκε το κείμενο του κλειδιού.
    expect(out).not.toBe('30/7/2026');
  });

  /**
   * 🔴 **Ο έλεγχος που έλειπε, και τον βρήκε μετάλλαξη** (Μ6, 06/08).
   *
   * Δείχνοντας το `unnamed` στο πρότυπο του `named`, η οθόνη έβαφε **«Τοπογραφικό {name}»** —
   * ασυμπλήρωτο πρότυπο, δηλαδή η ίδια οικογένεια βλάβης με το ωμό κλειδί του ADR-752. Και οι
   * τέσσερις υπάρχοντες έλεγχοι έμεναν **πράσινοι**: δεν ήταν παύλα, δεν ήταν το κλειδί, ήταν
   * αρκετά μακρύ, και διέφερε από την ονομασμένη εκδοχή. Κανείς δεν ρωτούσε αν είναι **φράση**.
   */
  it.each(LANGS)('🔴 καμία έκβαση στο %s δεν αφήνει ασυμπλήρωτο σύμβολο ICU', (lang) => {
    for (const out of [
      surveyRecordDisplayName(null, fakeT(lang)),
      surveyRecordDisplayName('30/7/2026', fakeT(lang)),
    ]) {
      expect(out).not.toMatch(/[{}]/);
    }
  });

  it('🔴 ονομασμένη και ανώνυμη ΔΕΝ δίνουν το ίδιο κείμενο', () => {
    expect(surveyRecordDisplayName(null, fakeT('el'))).not.toBe(
      surveyRecordDisplayName('30/7/2026', fakeT('el')),
    );
  });

  it.each(LANGS)('⚠️ το πρότυπο του %s είναι ICU (`{name}`), ποτέ i18next (`{{name}}`)', (lang) => {
    const raw = at(tree(lang), 'card.recordLabel');
    expect(raw).toEqual(expect.any(String));
    expect(String(raw)).toContain('{name}');
    expect(String(raw)).not.toContain('{{');
  });
});

// ── 3. Η λογική τιμή ──────────────────────────────────────────────────────────

describe('🔴 surveyAffirmationLabel — «Ναι», όχι η φράση που την προκάλεσε', () => {
  it.each(LANGS)('το true και το false δίνουν διαφορετικές λέξεις στο %s', (lang) => {
    const yes = surveyAffirmationLabel(true, fakeT(lang));
    const no = surveyAffirmationLabel(false, fakeT(lang));
    expect(yes).not.toBe(no);
    expect(yes).not.toContain('actions.');
    expect(no).not.toContain('actions.');
  });

  it('στα ελληνικά είναι οι λέξεις που ήδη δείχνει η καρτέλα', () => {
    expect(surveyAffirmationLabel(true, fakeT('el'))).toBe(at(tree('el'), 'actions.yes'));
    expect(surveyAffirmationLabel(false, fakeT('el'))).toBe(at(tree('el'), 'actions.no'));
  });
});

// ── 4. Μία σύνθεση, δύο οθόνες ────────────────────────────────────────────────

describe('🔴 SSoT — καμία οθόνη δεν ξαναγράφει τις ετικέτες', () => {
  const CONSUMERS = [
    'src/components/projects/survey-data/SurveyDocumentSection.tsx',
    'src/components/projects/survey-data/SourcedFieldRow.tsx',
    'src/subapps/dxf-viewer/ui/components/TitleBlockBindingPalette.tsx',
    'src/subapps/dxf-viewer/ui/components/title-block-binding/proposal-labels.ts',
  ];

  it('οι καταναλωτές υπάρχουν — αλλιώς ο έλεγχος θα περνούσε χωρίς να κοιτάξει τίποτα', () => {
    for (const file of CONSUMERS) {
      expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
    }
  });

  it.each(CONSUMERS)(
    '🔴 το %s καταναλώνει τη σύνθεση και ΔΕΝ γράφει το κλειδί μόνο του',
    (file) => {
      const source = read(file);
      // Η απόκλιση δεν είναι υποθετική: μέχρι σήμερα η καρτέλα τύπωνε «Τοπογραφικό 30/7/2026»
      // και η παλέτα σκέτο «30/7/2026», για την **ίδια** εγγραφή.
      expect(source).not.toMatch(/['"]card\.recordLabel['"]/);
      expect(source).not.toMatch(/['"]actions\.(yes|no)['"]/);
      expect(source).toMatch(/survey-record-labels/);
    },
  );

  it('🔴 κάθε αρχείο που καταναλώνει τη σύνθεση δηλώνει το namespace', () => {
    for (const file of CONSUMERS) {
      const source = read(file);
      if (!/useTranslation\(/.test(source)) continue;
      // Η καρτέλα το έχει ήδη ως **πρωτεύον**· η παλέτα πρέπει να το δανειστεί ρητά, αλλιώς
      // το προθεματισμένο κλειδί βάφεται ωμό (ADR-716 Φ5 · `useTranslation.ts:99`).
      expect(source).toMatch(
        /useTranslation\((?:'surveyRecord'|\[[^\]]*SURVEY_RECORD_LABEL_NAMESPACE)/,
      );
    }
  });
});

// ── 5. Τα κλειδιά υπάρχουν, και στις δύο γλώσσες ──────────────────────────────

describe('🔴 κάθε κλειδί που δηλώνει το config υπάρχει σε el ΚΑΙ en', () => {
  const DECLARED = [
    SURVEY_RECORD_NAME_LABEL.named,
    SURVEY_RECORD_NAME_LABEL.unnamed,
    SURVEY_AFFIRMATION_LABEL.yes,
    SURVEY_AFFIRMATION_LABEL.no,
  ];

  it('κάθε κλειδί φέρει το πρόθεμα του namespace — αλλιώς δεν βρίσκεται από άλλη οθόνη', () => {
    for (const key of DECLARED) {
      expect(key.startsWith(`${SURVEY_RECORD_LABEL_NAMESPACE}:`)).toBe(true);
    }
  });

  it.each(LANGS)('όλα υπάρχουν στο %s', (lang) => {
    const missing = DECLARED.filter(
      (key) => typeof at(tree(lang), key.slice(SURVEY_RECORD_LABEL_NAMESPACE.length + 1)) !== 'string',
    );
    expect(missing).toEqual([]);
  });

  it('🔴 το `card` έχει ΑΚΡΙΒΩΣ τα ίδια κλειδιά σε el και en — καμία μονόπλευρη προσθήκη', () => {
    const keys = (lang: Lang) => Object.keys((tree(lang).card ?? {}) as object).sort();
    expect(keys('el')).toEqual(keys('en'));
  });
});
