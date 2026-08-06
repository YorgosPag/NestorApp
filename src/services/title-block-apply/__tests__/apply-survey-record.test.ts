/**
 * @fileoverview Η εγγραφή στο τοπογραφικό — **οι φύλακες, όχι η ευτυχής διαδρομή** (Φ3γ).
 *
 * 🔴 Κάθε έλεγχος εδώ υπάρχει επειδή ο Λ2 έχει **ήδη** απαντήσει το ίδιο ερώτημα πριν το κλικ.
 * Η επανάληψη δεν είναι πλεονασμός: ανάμεσα στην πρόταση και στην έγκριση περνούν λεπτά, και
 * *ένας φύλακας που ζει μόνο στο UI δεν είναι φύλακας*.
 */

/* global describe, it, expect, jest, beforeEach */
import { applySurveyRecordTarget } from '../apply-survey-record';
import type { ApplyTargetContext } from '../apply-types';
import { createEmptySurveyRecord } from '@/lib/survey-record/survey-record-factory';
import type { SurveyRecord } from '@/types/project-survey-record';
import type { BindingTarget } from '@/types/title-block-binding';

jest.mock('@/services/survey-record.service', () => ({
  getSurveyRecord: jest.fn(),
  updateSurveyRecord: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const service = require('@/services/survey-record.service') as {
  getSurveyRecord: jest.Mock;
  updateSurveyRecord: jest.Mock;
};

const CTX: ApplyTargetContext = {
  userId: 'user_1',
  companyId: 'comp_1',
  snapshotValue: 'Π.Ε. 39',
};

const TARGET: Extract<BindingTarget, { kind: 'survey-record' }> = {
  kind: 'survey-record',
  projectId: 'proj_1',
  recordId: 'srv_1',
  field: 'implementationActNumber',
  value: { kind: 'text', value: '39' },
};

function record(overrides: Partial<SurveyRecord> = {}): SurveyRecord {
  return {
    ...createEmptySurveyRecord({
      companyId: 'comp_1',
      projectId: 'proj_1',
      createdBy: 'user_1',
      now: '2026-08-06T00:00:00.000Z',
    }),
    id: 'srv_1',
    ...overrides,
  };
}

beforeEach(() => {
  service.getSurveyRecord.mockReset();
  service.updateSurveyRecord.mockReset();
  service.updateSurveyRecord.mockResolvedValue(true);
});

describe('η ευτυχής διαδρομή γράφει ΕΝΑ κλειδί', () => {
  it('🔴 patch ενός κλειδιού — ΠΟΤΕ ολόκληρη η εγγραφή', async () => {
    // Το gateway είναι pass-through χωρίς συναλλαγή: γράφοντας πίσω ολόκληρη την εγγραφή που
    // διαβάσαμε, θα σβήναμε ό,τι πληκτρολόγησε ο μηχανικός στην καρτέλα στο μεταξύ — **χωρίς
    // σφάλμα και χωρίς μήνυμα**. Ίδιο σχήμα με το `project-snapshot.ts`.
    service.getSurveyRecord.mockResolvedValue(record());

    const result = await applySurveyRecordTarget(TARGET, CTX);
    expect(result.success).toBe(true);

    const [recordId, patch] = service.updateSurveyRecord.mock.calls[0];
    expect(recordId).toBe('srv_1');
    expect(Object.keys(patch).sort()).toEqual(['settlement', 'updatedAt']);
    expect(patch.settlement.implementationAct.number).toEqual({
      value: '39',
      provenance: 'survey',
      rawText: 'Π.Ε. 39',
    });
  });

  it('🔑 το `rawText` είναι το ΚΕΙΜΕΝΟ ΤΟΥ ΣΧΕΔΙΟΥ, όχι η αναλυμένη τιμή', async () => {
    service.getSurveyRecord.mockResolvedValue(record());
    await applySurveyRecordTarget(TARGET, { ...CTX, snapshotValue: 'Π.Ε. 39' });
    expect(service.updateSurveyRecord.mock.calls[0][1].settlement.implementationAct.number.rawText)
      .toBe('Π.Ε. 39');
  });

  it('🔴 γράφει την τιμή ΠΟΥ ΕΝΕΚΡΙΝΕ ο άνθρωπος — δεν ξανα-αναλύει', async () => {
    // Αν ο writer ξανα-αναλύε το `rawText`, μια μελλοντική αλλαγή του κανόνα ανάλυσης θα
    // έγραφε **άλλο** από αυτό που έδειχνε η οθόνη τη στιγμή της έγκρισης — σιωπηλά, και με
    // το όνομα του μηχανικού πάνω του.
    service.getSurveyRecord.mockResolvedValue(record());
    await applySurveyRecordTarget({ ...TARGET, value: { kind: 'text', value: 'ΧΕΙΡΟΚΙΝΗΤΗ' } }, CTX);
    expect(service.updateSurveyRecord.mock.calls[0][1].settlement.implementationAct.number.value)
      .toBe('ΧΕΙΡΟΚΙΝΗΤΗ');
  });
});

describe('🔒 οι φύλακες — καμία εγγραφή, με ΚΩΔΙΚΟ', () => {
  it('εγγραφή που δεν υπάρχει (διαγράφηκε μετά την πρόταση)', async () => {
    service.getSurveyRecord.mockResolvedValue(null);
    const result = await applySurveyRecordTarget(TARGET, CTX);
    expect(result).toEqual({
      success: false,
      error: 'survey record not found',
      errorCode: 'SURVEY_RECORD_MISSING',
    });
    expect(service.updateSurveyRecord).not.toHaveBeenCalled();
  });

  /**
   * 🔴 **ΞΕΝΟ ≡ ΑΝΥΠΑΡΚΤΟ** — και ο ίδιος κωδικός με το «δεν υπάρχει» είναι το ζητούμενο,
   * όχι παράλειψη (ADR-742 / ADR-759 §4.9).
   *
   * Εδώ ζούσε ξεχωριστό `SURVEY_RECORD_FOREIGN`, δηλαδή **μαντείο ύπαρξης**: «ανήκει σε άλλον»
   * επιβεβαιώνει ότι το id υπάρχει. Ο έλεγχος πέρασε στο SSoT `ownedOrNull`, που κρατά τη
   * σιωπηλή πολιτική και **καταγράφει** την απόπειρα.
   */
  it('🔴 εγγραφή ΑΛΛΟΥ μισθωτή — σιωπά όπως το ανύπαρκτο, δεν μαρτυρά ύπαρξη', async () => {
    service.getSurveyRecord.mockResolvedValue(record({ companyId: 'comp_OTHER' }));
    const result = await applySurveyRecordTarget(TARGET, CTX);
    expect(result).toMatchObject({ success: false, errorCode: 'SURVEY_RECORD_MISSING' });
    expect(service.updateSurveyRecord).not.toHaveBeenCalled();
  });

  it('🔴 ο κωδικός είναι ΑΚΡΙΒΩΣ ο ίδιος με το ανύπαρκτο — αλλιώς η διάκριση ΕΙΝΑΙ η διαρροή', async () => {
    service.getSurveyRecord.mockResolvedValue(null);
    const missing = await applySurveyRecordTarget(TARGET, CTX);
    service.getSurveyRecord.mockResolvedValue(record({ companyId: 'comp_OTHER' }));
    const foreign = await applySurveyRecordTarget(TARGET, CTX);
    expect(foreign).toEqual(missing);
  });

  /**
   * 🔴 **Η ΠΑΓΙΔΑ ΤΟΥ ΚΕΝΟΥ, που ο χειρόγραφος έλεγχος άφηνε ανοιχτή.**
   *
   * Χαλασμένο token (`companyId: ''`) και έγγραφο με κενό `companyId` (ADR-232 — τα φτιάχνει
   * το υπεργραφείο) «ταίριαζαν» σε ωμή `!==`, δηλαδή **εγγραφή σε ξένο έγγραφο**. Δεν είναι
   * λάθος κωδικός· είναι απώλεια απομόνωσης μισθωτή.
   */
  it('🔴 κενό companyId και στις δύο πλευρές ΔΕΝ είναι ταίριασμα — το κενό είναι απουσία tenant', async () => {
    service.getSurveyRecord.mockResolvedValue(record({ companyId: '' }));
    const result = await applySurveyRecordTarget(TARGET, { ...CTX, companyId: '' });
    expect(result).toMatchObject({ success: false, errorCode: 'SURVEY_RECORD_MISSING' });
    expect(service.updateSurveyRecord).not.toHaveBeenCalled();
  });

  it('εγγραφή άλλου έργου', async () => {
    service.getSurveyRecord.mockResolvedValue(record({ projectId: 'proj_OTHER' }));
    const result = await applySurveyRecordTarget(TARGET, CTX);
    expect(result).toMatchObject({ success: false, errorCode: 'SURVEY_RECORD_WRONG_PROJECT' });
    expect(service.updateSurveyRecord).not.toHaveBeenCalled();
  });

  it('🔒 ΕΠΙΒΕΒΑΙΩΜΕΝΗ εγγραφή: ορατή άρνηση, ΠΟΤΕ αυτόματη άρση της επιβεβαίωσης', async () => {
    service.getSurveyRecord.mockResolvedValue(
      record({ confirmedBy: 'user_2', confirmedAt: '2026-08-05T00:00:00.000Z' }),
    );
    const result = await applySurveyRecordTarget(TARGET, CTX);
    expect(result).toMatchObject({ success: false, errorCode: 'SURVEY_RECORD_LOCKED' });
    expect(service.updateSurveyRecord).not.toHaveBeenCalled();
  });

  it('αποτυχία εγγραφής επιστρέφει ΑΠΟΤΥΧΙΑ — ο Γ9 δεν επιτρέπεται να δει επιτυχία', async () => {
    service.getSurveyRecord.mockResolvedValue(record());
    service.updateSurveyRecord.mockResolvedValue(false);
    const result = await applySurveyRecordTarget(TARGET, CTX);
    expect(result).toMatchObject({ success: false, errorCode: 'SURVEY_RECORD_UPDATE_FAILED' });
  });

  it('εξαίρεση ανάγνωσης δεν διαφεύγει ως σκέτο crash', async () => {
    service.getSurveyRecord.mockRejectedValue(new Error('offline'));
    const result = await applySurveyRecordTarget(TARGET, CTX);
    expect(result).toMatchObject({ success: false, errorCode: 'SURVEY_RECORD_UPDATE_FAILED' });
  });
});
