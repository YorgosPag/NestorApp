/**
 * @fileoverview 🔴 **Η πύλη που κάνει το «γράφτηκε αλλά δεν φαίνεται» αδύνατο** (ADR-759 Φ3γ).
 *
 * ## Γιατί υπάρχει — μετρημένο
 *
 * Το `surveyDate` ζούσε στο σχήμα από τη Φ2 και **δεν αποδιδόταν σε καμία ενότητα**: το
 * `SURVEY_CARD_ORDER` ξεκινούσε από την Α. Αν η προσγείωση της πινακίδας είχε γραφτεί χωρίς
 * αυτόν τον έλεγχο, το σύστημα θα έγραφε στο Firestore μια τιμή που **καμία οθόνη δεν
 * δείχνει** — και ο μηχανικός θα έβλεπε «Έγκριση ✓» με την καρτέλα να μένει ίδια.
 *
 * Είναι το ίδιο ελάττωμα με το `no-primary-address` (δηλωμένο, χωρίς παραγωγό) από την
 * **αντίθετη** πλευρά: παραγωγός χωρίς προορισμό ορατό σε άνθρωπο.
 *
 * ## Και το δεύτερο σκέλος: ΤΑΥΤΟΤΗΤΑ, όχι ομοιότητα
 *
 * Δεν αρκεί «υπάρχει accessor με το ίδιο `labelKey`». Πρέπει να είναι **το ίδιο αντικείμενο**,
 * αλλιώς είναι sibling clone (N.18): δύο ζεύγη `read`/`write` για το ίδιο πεδίο, που
 * μεταγλωττίζονται και τα δύο και αποκλίνουν την ημέρα που διορθωθεί το ένα.
 */

/* global describe, it, expect */
import {
  applySurveyFieldBinding,
  BINDABLE_SURVEY_FIELDS,
  parseSurveyValue,
  SURVEY_BINDING_SPECS,
  surveyBindingPreview,
  type BindableSurveyField,
  type SurveyBindingSpec,
} from '../survey-bindable-fields';
import { allSurveyCardFields } from '../survey-card-config';
import { createEmptySurveyRecord } from '@/lib/survey-record/survey-record-factory';
import type { SurveyRecord } from '@/types/project-survey-record';

const blank = (): SurveyRecord =>
  createEmptySurveyRecord({
    companyId: 'comp_1',
    projectId: 'proj_1',
    createdBy: 'user_1',
    now: '2026-08-06T00:00:00.000Z',
  });

describe('🔴 κάθε δεσμεύσιμο πεδίο ΑΠΟΔΙΔΕΤΑΙ στην καρτέλα', () => {
  it.each(BINDABLE_SURVEY_FIELDS)(
    '«%s» δείχνει στον ΙΔΙΟ accessor που αποδίδει η καρτέλα (ταυτότητα, όχι ομοιότητα)',
    (field: BindableSurveyField) => {
      const rendered = allSurveyCardFields();
      // `toContain` σε πίνακα αντικειμένων συγκρίνει με `Object.is` — ακριβώς η ταυτότητα που
      // ζητάμε. Ένα αντίγραφο με ίδια πεδία θα ΑΠΕΤΥΓΧΑΝΕ εδώ, που είναι το ζητούμενο.
      expect(rendered).toContain(SURVEY_BINDING_SPECS[field].accessor);
    },
  );

  it('το `documentKey` δείχνει σε υπαρκτό κλειδί της εγγραφής', () => {
    const record = blank();
    for (const field of BINDABLE_SURVEY_FIELDS) {
      expect(record).toHaveProperty(SURVEY_BINDING_SPECS[field].documentKey);
    }
  });
});

/**
 * Ένα κείμενο ανά είδος πεδίου που **όντως αναλύεται** — το ίδιο για όλα θα ήταν αδύνατο:
 * το `parseStrictDecimal` αρνείται το «39» με κόμμα και η λίστα αρνείται τον κενό διαχωρισμό.
 */
const RAW_BY_KIND: Record<SurveyBindingSpec['kind'], string> = {
  text: '39',
  number: '12,5',
  boolean: 'ΕΝΤΟΣ ΖΩΝΗΣ ΚΟΙΝΩΝΙΚΟΥ ΣΥΝΤΕΛΕΣΤΗ',
  textList: 'Α,Β',
};

const sampleRawFor = (field: BindableSurveyField): string =>
  RAW_BY_KIND[SURVEY_BINDING_SPECS[field].kind];

describe('η εγγραφή είναι στοχευμένη — και τίποτα άλλο δεν κουνιέται', () => {
  it.each(BINDABLE_SURVEY_FIELDS)(
    '«%s»: γράφει ΜΟΝΟ το δικό του κλειδί πρώτου επιπέδου',
    (field: BindableSurveyField) => {
      const before = blank();
      const raw = sampleRawFor(field);
      const { record: after, documentKey } = applySurveyFieldBinding(
        before,
        field,
        parseSurveyValue(field, raw),
        raw,
      );

      // 🔑 Το ίδιο round-trip anchor με το `survey-card-config.test.ts`, γενικευμένο στον
      // writer: η αστοχία που φυλάει είναι copy-paste σε λάθος πεδίο, **αόρατη στον compiler**
      // επειδή και τα δύο είναι `Sourced<string>`.
      for (const key of Object.keys(before) as (keyof SurveyRecord)[]) {
        if (key === documentKey) continue;
        expect(after[key]).toBe(before[key]);
      }
      expect(after[documentKey]).not.toBe(before[documentKey]);
    },
  );

  it('🔴 η προέλευση είναι «survey» και το ΩΜΟ ΚΕΙΜΕΝΟ διατηρείται ακέραιο', () => {
    const after = applySurveyFieldBinding(
      blank(),
      'implementationActNumber',
      parseSurveyValue('implementationActNumber', 'Π.Ε. 39'),
      'Π.Ε. 39',
    ).record;
    expect(after.settlement.implementationAct.number).toEqual({
      value: '39',
      provenance: 'survey',
      rawText: 'Π.Ε. 39',
    });
  });

  it('🔴 τιμή που ΔΕΝ αναλύθηκε αποθηκεύεται ως `null` ΜΕ το κείμενο του σχεδίου', () => {
    // Η μόνη τίμια απάντηση όταν το σχέδιο λέει μήνα και το πεδίο θέλει ημερομηνία. Χωρίς το
    // `rawText`, η καρτέλα θα έγραφε «κενό στο σχέδιο» — που είναι **ψευδές**.
    const after = applySurveyFieldBinding(
      blank(),
      'surveyDate',
      parseSurveyValue('surveyDate', 'ΙΟΥΛΙΟΣ 2026'),
      'ΙΟΥΛΙΟΣ 2026',
    ).record;
    expect(after.surveyDate).toEqual({
      value: null,
      provenance: 'survey',
      rawText: 'ΙΟΥΛΙΟΣ 2026',
    });
  });
});

describe('η προεπισκόπηση λέει τι ΘΑ γραφτεί', () => {
  it('δείχνει την αναλυμένη τιμή όταν διαφέρει από το ωμό κείμενο', () => {
    expect(surveyBindingPreview('implementationActNumber', 'Π.Ε. 39')).toBe('39');
  });

  it('πέφτει πίσω στο ωμό κείμενο όταν δεν αναλύεται — ποτέ κενό', () => {
    expect(surveyBindingPreview('surveyDate', 'ΙΟΥΛΙΟΣ 2026')).toBe('ΙΟΥΛΙΟΣ 2026');
  });
});

/**
 * 🔴 **Η ετικέτα τύπου δεν είναι διακόσμηση** (Φ4).
 *
 * Ο κατάλογος έπαψε να είναι μόνο κείμενο: το σώμα του σχεδίου φέρνει αριθμούς (ΣΔ, κάλυψη,
 * εμβαδόν), λογική τιμή (ΖΚΣ) και λίστες (κορυφές, πολεοδομικές ενότητες). Ο writer πρέπει να
 * διαλέξει τη **σωστή** `accessor.write`, και η εναλλακτική — `typeof value === 'string'` —
 * θα πετούσε **σιωπηλά** ό,τι δεν ταιριάζει, γράφοντας κενό πεδίο σε βεβαίωση μηχανικού.
 */
describe('🔴 η αναλυμένη τιμή κουβαλά τον τύπο της', () => {
  it('ο ελληνικός αριθμός με χιλιάδες διαβάζεται σωστά — 1.364,05 δεν είναι 1', () => {
    expect(parseSurveyValue('plotArea', '1.364,05')).toEqual({ kind: 'number', value: 1364.05 });
  });

  it('η λίστα κορυφών ΚΡΑΤΑ το διπλό μέλος — το περίγραμμα είναι κλειστό', () => {
    expect(parseSurveyValue('plotBoundaryLabels', 'Α,Β,Γ,Δ,Α')).toEqual({
      kind: 'textList',
      value: ['Α', 'Β', 'Γ', 'Δ', 'Α'],
    });
  });

  it('η λέξη «και» χωρίζει μέλη, όπως τα γράφει το σχέδιο', () => {
    expect(parseSurveyValue('implementationActUrbanUnits', '16 και 17')).toEqual({
      kind: 'textList',
      value: ['16', '17'],
    });
  });

  it('η δήλωση ζώνης δίνει ΜΟΝΟ «ναι» — η σιωπή δεν γίνεται ποτέ «όχι»', () => {
    expect(parseSurveyValue('inSocialFactorZone', 'ΕΝΤΟΣ ΖΩΝΗΣ')).toEqual({
      kind: 'boolean',
      value: true,
    });
    expect(parseSurveyValue('inSocialFactorZone', '   ')).toEqual({ kind: 'boolean', value: null });
  });

  it('🔴 το λατινικό γράμμα φεύγει από την ΤΙΜΗ και μένει στο ΩΜΟ ΚΕΙΜΕΝΟ', () => {
    // Το σχέδιο γράφει «κατά NΟΚ» με λατινικό N. Αποθηκευμένο έτσι, το πεδίο δεν βρίσκεται
    // ποτέ σε αναζήτηση — αλλά το πρωτότυπο δεν επιτρέπεται να αλλοιωθεί.
    const raw = 'κατά NΟΚ';
    const after = applySurveyFieldBinding(
      blank(),
      'declaredMaxHeight',
      parseSurveyValue('declaredMaxHeight', raw),
      raw,
    ).record;
    expect(after.buildingTerms.declaredMaxHeight.value).toBe('κατά ΝΟΚ');
    expect(after.buildingTerms.declaredMaxHeight.rawText).toBe('κατά NΟΚ');
  });

  it('🔴 αναντιστοιχία τύπου είναι ΣΦΑΛΜΑ, όχι σιωπηλό κενό', () => {
    expect(() =>
      applySurveyFieldBinding(blank(), 'plotArea', { kind: 'text', value: 'όχι αριθμός' }, 'x'),
    ).toThrow(/περιμένει/);
  });
});
