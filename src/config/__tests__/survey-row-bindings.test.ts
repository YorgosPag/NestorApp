/**
 * @fileoverview 🔴 Η **εγγραφή γραμμών** από άκρη σε άκρη, πάνω στο πραγματικό G753 (Φ4β).
 *
 * Δεν ρωτά «γράφει το πεδίο;» — ρωτά **«τι μένει στην καρτέλα όταν ο μηχανικός πατήσει
 * Έγκριση δύο φορές;»**, που είναι το ερώτημα στο οποίο κάθε προφανής υλοποίηση απαντά λάθος:
 * ένα βαθμωτό πεδίο έχει όνομα και ξαναγράφεται· μια **γραμμή** δεν έχει, και προστίθεται.
 *
 * Η αλυσίδα που εκτελείται εδώ είναι η **πραγματική**: 574 κείμενα → Λ1β → Λ2 → στόχοι →
 * writer. Ένα test που έφτιαχνε στόχους με το χέρι θα απεδείκνυε ότι δουλεύει ο writer σε
 * είσοδο **που γράψαμε εμείς**.
 */

/* global describe, it, expect, jest */
import { g753DocumentReadings } from '@/lib/document-body/__tests__/fixtures/g753-body.fixture';
import { resolveDocumentBodyProposals } from '@/lib/title-block/resolve-document-body';
import { createEmptySurveyRecord } from '@/lib/survey-record/survey-record-factory';
import { newGazetteRef, updateRow, actLens } from '@/lib/survey-record/survey-list-rows';
import type { SurveySnapshot } from '@/lib/title-block/resolve-survey-record';
import { DOCUMENT_BODY_PART_KEYS, type DocumentBodyPartKey } from '@/types/document-body-reading';
import { userSourced, type SurveyRecord } from '@/types/project-survey-record';
import type { BindingTarget } from '@/types/title-block-binding';
import {
  applySurveyRowBinding,
  parseSurveyRowPart,
  SURVEY_ROW_LISTS,
  type SurveyRowPartValue,
} from '../survey-row-bindings';

// Διακριτά ids ανά κλήση: σταθερό stub θα έκρυβε ακριβώς το σφάλμα που η ταυτότητα γραμμής
// υπάρχει για να αποτρέψει (δύο γραμμές με ένα id).
jest.mock('@/services/enterprise-id.service', () => {
  let counter = 0;
  return {
    generateSurveyRecordId: () => 'srv_test_fixed',
    generateSurveyActId: () => `svact_${++counter}`,
    generateSurveyApprovalId: () => `svapr_${++counter}`,
    generateSurveyTitleDeedId: () => `svdeed_${++counter}`,
  };
});

const OPEN_RECORD: SurveySnapshot = {
  records: [{ id: 'srv_1', isConfirmed: false, label: '30/7/2026' }],
  activeId: null,
};

function blank(): SurveyRecord {
  return createEmptySurveyRecord({
    companyId: 'company-a',
    projectId: 'proj_1',
    createdBy: 'usr_1',
    now: '2026-08-06T10:00:00.000Z',
  });
}

type RowTarget = Extract<BindingTarget, { kind: 'survey-record-row' }>;

/** Οι στόχοι **γραμμών** που παράγει ο πραγματικός Λ2 πάνω στο πραγματικό σχέδιο. */
function g753RowTargets(): RowTarget[] {
  return resolveDocumentBodyProposals(g753DocumentReadings(), {
    projectId: 'proj_1',
    hasPrimaryAddress: true,
    survey: OPEN_RECORD,
  })
    .flatMap((proposal) => proposal.candidates)
    .map((candidate) => candidate.target)
    .filter((target): target is RowTarget => target.kind === 'survey-record-row');
}

/** Εγκρίνει **όλες** τις γραμμές, με τη σειρά που τις δείχνει η παλέτα. */
function approveAll(record: SurveyRecord, targets: readonly RowTarget[]): SurveyRecord {
  return targets.reduce(
    (acc, target) => applySurveyRowBinding(acc, target.list, target.rowId, target.parts).record,
    record,
  );
}

// ─────────────────────────────────────────────────────────────────────────────

describe('🔴 ΤΑΥΤΟΔΥΝΑΜΙΑ — δεύτερη Έγκριση δεν διπλασιάζει καμία γραμμή', () => {
  const targets = g753RowTargets();

  it('το σχέδιο δίνει έντεκα γραμμές προς έγκριση', () => {
    expect(targets).toHaveLength(11);
  });

  it('μία Έγκριση ⇒ πέντε πράξεις, μία παρατήρηση, δύο εγκρίσεις, τρεις τίτλοι', () => {
    const record = approveAll(blank(), targets);
    expect(record.institutionalActs.urbanPlanDecree).toHaveLength(1);
    expect(record.institutionalActs.generalUrbanPlan).toHaveLength(1);
    expect(record.institutionalActs.zoningRegulations).toHaveLength(3);
    expect(record.remarks).toHaveLength(1);
    expect(record.approvals).toHaveLength(2);
    expect(record.titleDeeds).toHaveLength(3);
  });

  it('🔴 ΔΕΥΤΕΡΗ Έγκριση ⇒ ΤΟ ΙΔΙΟ ΑΚΡΙΒΩΣ έγγραφο, γραμμή προς γραμμή', () => {
    // Το προφανές «πρόσθεσε τη γραμμή» θα έδινε **είκοσι** γραμμές, και ο μηχανικός θα
    // έσβηνε με το χέρι ό,τι εφηύρε το σύστημα (N.7.2 ερώτημα 3).
    const once = approveAll(blank(), targets);
    expect(approveAll(once, targets)).toEqual(once);
  });

  it('η ταυτότητα της γραμμής είναι ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΗ — δεύτερη ανάγνωση, ίδια κλειδιά', () => {
    expect(g753RowTargets().map((t) => t.rowId)).toEqual(targets.map((t) => t.rowId));
  });

  it('κάθε γραμμή έχει ΔΙΚΗ της ταυτότητα — καμία σύγκρουση ανάμεσα στις έντεκα', () => {
    expect(new Set(targets.map((t) => t.rowId)).size).toBe(11);
  });

  it('🔴 οι ΤΑΥΤΟΤΗΤΕΣ των γραμμών επιβιώνουν της δεύτερης έγκρισης', () => {
    const once = approveAll(blank(), targets);
    const twice = approveAll(once, targets);
    expect(twice.titleDeeds.map((d) => d.id)).toEqual(once.titleDeeds.map((d) => d.id));
  });
});

describe('🔴 τι ακριβώς προσγειώνεται στην καρτέλα', () => {
  const record = approveAll(blank(), g753RowTargets());

  it('η θεσμική πράξη κρατά ΤΗΝ ΠΡΑΞΗ και το ΦΕΚ της χωριστά', () => {
    const [decree] = record.institutionalActs.urbanPlanDecree;
    expect(decree.reference.value).toBe('Διάταγμα Ρυμοτομίας Π.Δ. 02-09-1992');
    expect(decree.gazettes.map((g) => g.rawText)).toEqual(['ΦΕΚ 963Δ/25-09-1992']);
  });

  it('🔴 το Γ.Π.Σ. κρατά ΔΥΟ ΦΕΚ — το κόμμα τα χώρισε', () => {
    const [gps] = record.institutionalActs.generalUrbanPlan;
    expect(gps.gazettes).toHaveLength(2);
  });

  it('🔴 η αλυσίδα διόρθωσης μένει ΜΙΑ αναφορά, και το `relation` ΔΕΝ συμπεραίνεται (Q3)', () => {
    const chain = record.institutionalActs.zoningRegulations.find((act) =>
      act.note.value?.includes('Έγκριση Πολεοδομικών'),
    );
    expect(chain!.gazettes).toHaveLength(1);
    expect(chain!.gazettes[0].rawText).toContain('όπως διορθώθηκε');
    for (const act of record.institutionalActs.zoningRegulations) {
      for (const gazette of act.gazettes) expect(gazette.relation ?? null).toBeNull();
    }
  });

  it('η έγκριση ξεχωρίζει ΤΙ εγκρίνεται από ΠΟΙΟΝ εγκρίνει', () => {
    expect(record.approvals.map((a) => a.subject.value)).toEqual([
      'ΑΡΧΑΙΟΛΟΓΙΑ',
      'ΒΕΒΑΙΩΣΗ ΥΨΟΜΕΤΡΩΝ',
    ]);
    expect(record.approvals.map((a) => a.authority.value)).toEqual([
      'Εφορεία Αρχαιοτήτων Πόλης Θεσσαλονίκης',
      'Δήμου Κορδελιού - Ευόσμου',
    ]);
  });

  it('🔴 η ημερομηνία τίτλου γίνεται ISO από τον ΙΔΙΟ αναλυτή με το `surveyDate`', () => {
    expect(record.titleDeeds.map((d) => d.date.value)).toEqual([
      '1993-01-18',
      '2004-06-25',
      '2004-06-30',
    ]);
    // Και το ωμό κείμενο δεν χάνεται ποτέ.
    expect(record.titleDeeds[0].date.rawText).toBe('18/01/1993');
  });

  it('🔴 οι ΤΕΛΕΙΕΣ μένουν κενό: ο τόμος «...» δεν γράφεται ΚΑΙ δεν παίρνει προέλευση σχεδίου', () => {
    const [, dotted, filled] = record.titleDeeds;
    expect(dotted.volume.value).toBeNull();
    expect(dotted.entry.value).toBeNull();
    // 🔑 Το κρίσιμο: μένει `'user'`. Με προέλευση `'survey'` η καρτέλα θα έλεγε ότι **το
    // σχέδιο** δήλωσε κενό τόμο, ενώ το σχέδιο απλώς δεν τον έχει συμπληρώσει ακόμη.
    expect(dotted.volume.provenance).toBe('user');
    expect(filled.volume.value).toBe('262');
    expect(filled.volume.provenance).toBe('survey');
  });

  it('κάθε τιμή που ΗΡΘΕ από το σχέδιο κουβαλά προέλευση και ωμό κείμενο', () => {
    for (const deed of record.titleDeeds) {
      expect(deed.number.provenance).toBe('survey');
      expect(deed.number.rawText).toBe(deed.number.value);
    }
  });

  it('ο συμβολαιογράφος γράφεται ως ΟΝΟΜΑ, χωρίς σύνδεσμο επαφής', () => {
    expect(record.titleDeeds[0].notaryName.value).toBe('ΜΑΙΡΗΣ ΑΘΑΝΑΣΙΑΔΟΥ');
    expect(record.titleDeeds[0].notaryContactId).toBeNull();
  });
});

describe('🔴 ό,τι έγραψε ο ΑΝΘΡΩΠΟΣ επιβιώνει', () => {
  it('ΦΕΚ που πρόσθεσε ο μηχανικός δεν σβήνεται από την Έγκριση', () => {
    // Η λίστα **εμπλουτίζεται**, δεν αντικαθίσταται: το ΦΕΚ είναι value object και η
    // ταυτότητά του είναι το κείμενό του.
    const targets = g753RowTargets();
    const decree = targets.find((t) => t.list === 'urbanPlanDecree');

    let record = applySurveyRowBinding(blank(), 'urbanPlanDecree', decree!.rowId, decree!.parts)
      .record;
    record = updateRow(record, actLens('urbanPlanDecree'), 0, (act) => ({
      ...act,
      gazettes: [...act.gazettes, { ...newGazetteRef(), rawText: 'ΦΕΚ ΧΕΙΡΟΓΡΑΦΟ' }],
    }));

    const after = applySurveyRowBinding(record, 'urbanPlanDecree', decree!.rowId, decree!.parts)
      .record;
    expect(after.institutionalActs.urbanPlanDecree[0].gazettes.map((g) => g.rawText)).toEqual([
      'ΦΕΚ 963Δ/25-09-1992',
      'ΦΕΚ ΧΕΙΡΟΓΡΑΦΟ',
    ]);
  });

  it('🔴 παρατήρηση που πληκτρολόγησε ο μηχανικός ΔΕΝ σβήνεται και ΔΕΝ οικειοποιείται', () => {
    // Το value object δεν έχει id, άρα η ταυτότητά του είναι το κείμενό του: η δική του
    // πρόταση δεν ταιριάζει με του σχεδίου, οπότε **συνυπάρχουν** — και η δική του μένει
    // `'user'`. Το αντίθετο («ξαναγράψ' το, ίδιο είναι») θα απέδιδε στο σχέδιο πρόταση που
    // έγραψε άνθρωπος.
    const remark = g753RowTargets().find((t) => t.list === 'remarks');
    const typed: SurveyRecord = {
      ...blank(),
      remarks: [userSourced<string>('Δικό μου κείμενο')],
    };

    const after = applySurveyRowBinding(typed, 'remarks', remark!.rowId, remark!.parts).record;
    expect(after.remarks.map((r) => r.value)).toEqual([
      'Δικό μου κείμενο',
      'Από το οικόπεδο δεν διέρχεται ρεύμα υψηλής τάσης',
    ]);
    expect(after.remarks[0].provenance).toBe('user');
    expect(after.remarks[1].provenance).toBe('survey');
  });

  it('🔴 παρατήρηση που ο μηχανικός έγραψε ΙΔΙΑ με το σχέδιο δεν διπλασιάζεται', () => {
    // Το σχέδιο γράφει «οικόπεδο**  **δεν» με **διπλό** κενό· κανείς δεν το πληκτρολογεί έτσι.
    // Η σύγκριση γίνεται στο κείμενο που **δείχνει** η γραμμή — αλλιώς η καρτέλα θα έδειχνε δύο
    // ολόιδιες παρατηρήσεις και ο μηχανικός θα έσβηνε τη μία.
    const remark = g753RowTargets().find((t) => t.list === 'remarks');
    const typed: SurveyRecord = {
      ...blank(),
      remarks: [userSourced<string>('Από το οικόπεδο δεν διέρχεται ρεύμα υψηλής τάσης')],
    };

    const after = applySurveyRowBinding(typed, 'remarks', remark!.rowId, remark!.parts).record;
    expect(after.remarks).toHaveLength(1);
    expect(after.remarks[0].provenance).toBe('user');
  });

  it('η εγγραφή αγγίζει **ένα** κλειδί πρώτου επιπέδου — η εμβέλεια του patch', () => {
    const targets = g753RowTargets();
    const deed = targets.find((t) => t.list === 'titleDeeds');
    expect(applySurveyRowBinding(blank(), 'titleDeeds', deed!.rowId, deed!.parts).documentKey).toBe(
      'titleDeeds',
    );
    const act = targets.find((t) => t.list === 'zoningRegulations');
    expect(
      applySurveyRowBinding(blank(), 'zoningRegulations', act!.rowId, act!.parts).documentKey,
    ).toBe('institutionalActs');
  });
});

describe('🔴 οι φύλακες εκτελούνται — δεν είναι νεκρός κώδικας', () => {
  it('μέρος χωρίς πεδίο υποδοχής ΣΚΑΕΙ, δεν παραλείπεται σιωπηλά', () => {
    // Η σιωπηλή παράλειψη θα έγραφε γραμμή **χωρίς** το μέρος της, χωρίς κανένα σήμα.
    const stray: SurveyRowPartValue = { part: 'kind', value: 'x', rawText: 'x' };
    expect(() => applySurveyRowBinding(blank(), 'approvals', 'svapr_x', [stray])).toThrow(
      /has no text field/,
    );
  });

  it('ΦΕΚ σε λίστα που δεν φέρει ΦΕΚ ΣΚΑΕΙ', () => {
    const gazette: SurveyRowPartValue = { part: 'gazette', value: 'ΦΕΚ 1', rawText: 'ΦΕΚ 1' };
    expect(() => applySurveyRowBinding(blank(), 'titleDeeds', 'svdeed_x', [gazette])).toThrow(
      /declares no gazette sub-list/,
    );
  });
});

describe('🔴 κάθε δηλωμένο ΜΕΡΟΣ έχει πού να προσγειωθεί', () => {
  /**
   * Η πύλη που κάνει αδύνατο το «διαβάστηκε αλλά δεν φαίνεται πουθενά».
   *
   * Είναι η **ίδια** ερώτηση με το `survey-bindable-fields.test.ts` για τα βαθμωτά, στραμμένη
   * στα μέρη γραμμής: μέρος που το λεξιλόγιο δηλώνει και καμία ενότητα της καρτέλας δεν
   * δέχεται είναι υπόσχεση που κανείς δεν μπορεί να διαψεύσει διαβάζοντας.
   */
  const landingPlaces = (part: DocumentBodyPartKey): string[] =>
    Object.entries(SURVEY_ROW_LISTS)
      .filter(([, spec]) => {
        if (part === 'gazette') return spec.section.gazettes !== undefined;
        if (part === 'notaryName') return spec.section.linkedContact !== undefined;
        return spec.section.rowFields(0).some((field) => field.part === part);
      })
      .map(([list]) => list);

  it.each(DOCUMENT_BODY_PART_KEYS)('«%s» δέχεται τουλάχιστον μία ενότητα', (part) => {
    expect(landingPlaces(part).length).toBeGreaterThan(0);
  });

  it('🔴 η ΜΟΝΗ μη-ταυτοτική ανάλυση είναι η ημερομηνία — τα υπόλοιπα μένουν ωμά', () => {
    // Κάθε άλλο μέρος που θα αποκτούσε «έξυπνη» ανάλυση θα ήταν δεύτερος τόπος όπου
    // αποφασίζεται τι σημαίνει το κείμενο του σχεδίου.
    for (const part of DOCUMENT_BODY_PART_KEYS) {
      const parsed = parseSurveyRowPart(part, 'ΑΒΓ');
      if (part === 'date') expect(parsed).toBeNull();
      else expect(parsed).toBe('ΑΒΓ');
    }
    expect(parseSurveyRowPart('date', '18/01/1993')).toBe('1993-01-18');
  });

  it('🔴 το ΦΕΚ ΔΕΝ αναλύεται — το ωμό κείμενο είναι το συμβόλαιο (Q3)', () => {
    expect(parseSurveyRowPart('gazette', 'ΦΕΚ 2/τ.Δ/ 10-01-2005 όπως διορθώθηκε')).toBe(
      'ΦΕΚ 2/τ.Δ/ 10-01-2005 όπως διορθώθηκε',
    );
  });
});
