/**
 * @fileoverview 🔴 Ο Λ2 του **σώματος**: μάρτυρες, συγχώνευση, προορισμοί (ADR-759 Φ4).
 *
 * Τρέχει πάνω στα **πραγματικά** έγγραφα του `G753_ergasia F.dxf`. Ό,τι ελέγχεται εδώ είναι
 * αποφάσεις, όχι ανάγνωση: πού πάει η τιμή, πόσοι το λένε, και τι γίνεται όταν ο προορισμός
 * είναι κλειστός.
 */

/* global describe, it, expect */
import { g753DocumentReadings } from '@/lib/document-body/__tests__/fixtures/g753-body.fixture';
import type { BindingProposal } from '@/types/title-block-binding';
import { resolveDocumentBodyProposals } from '../resolve-document-body';
import type { SurveySnapshot } from '../resolve-survey-record';

const PROJECT = 'proj_g753';
const ONE_OPEN_RECORD: SurveySnapshot = {
  records: [{ id: 'srv_a', isConfirmed: false, label: 'ΙΟΥΛΙΟΣ 2026' }],
  activeId: null,
};

const readings = g753DocumentReadings();

const proposals = (): BindingProposal[] =>
  resolveDocumentBodyProposals(readings, {
    projectId: PROJECT,
    hasPrimaryAddress: true,
    survey: ONE_OPEN_RECORD,
  });

const forSurveyField = (field: string): BindingProposal[] =>
  proposals().filter((p) =>
    p.candidates.some((c) => c.target.kind === 'survey-record' && c.target.field === field),
  );

describe('🔴 κάθε πρόταση δηλώνει ΠΟΙΟΣ τη γέννησε', () => {
  it('όλες φέρουν `sourceKind: document-body` — το λεξιλόγιο απέκτησε παραγωγό', () => {
    expect(proposals().every((p) => p.sourceKind === 'document-body')).toBe(true);
  });

  it('🔴 και το layer της ΔΙΚΗΣ ΤΗΣ προέλευσης — όχι το «επιλεγμένο» της παλέτας', () => {
    // Στο G753 όλες οι **νικήτριες** γραμμές προέρχονται από το `ΠΕΡΙΓΡΑΦΗ`, γιατί τα δύο
    // έγγραφα του `Περίγραμμα` μόνο **επαναλαμβάνουν** ό,τι λέει ήδη η φόρμα — γι' αυτό
    // μετριούνται ως μάρτυρες αντί να παράγουν δικές τους γραμμές. Το πεδίο υπάρχει επειδή
    // η **δυνατότητα** είναι πραγματική: αν η φόρμα έλειπε, νικητής θα ήταν το άλλο layer.
    // ⚠️ **ΔΙΟΡΘΩΘΗΚΕ 2026-08-06 (ADR-759 §4.11β).** Εδώ έγραφε ότι **κάθε** πρόταση έρχεται
    // από το `ΠΕΡΙΓΡΑΦΗ`, με σκεπτικό ότι τα δύο έγγραφα του `Περίγραμμα` μόνο
    // **επαναλαμβάνουν** τη φόρμα. Αυτό έπαψε να ισχύει όταν το «ΕΜΒΑΔΟΝ ΓΕΩΤΕΜΑΧΙΟΥ»
    // απέκτησε **δικές του** τέσσερις παρατηρήσεις: μια γραμμή λίστας δεν περνά από τη
    // συγχώνευση μαρτύρων (ίδια αλυσίδα ΦΕΚ σε δύο πράξεις **δεν** είναι διπλότυπο), άρα
    // παράγει πρόταση με το **δικό της** layer.
    //
    // Ο ισχυρισμός που είχε αξία επιβιώνει και δηλώνεται τώρα ρητά: τα **βαθμωτά** — αυτά
    // που όντως συγχωνεύονται — εξακολουθούν να κερδίζονται από τη φόρμα.
    const scalars = proposals().filter((p) => p.corroboration !== undefined);
    expect(scalars.length).toBeGreaterThan(0);
    expect(scalars.every((p) => p.layerName === 'ΠΕΡΙΓΡΑΦΗ')).toBe(true);

    const onlyOutsideForm = resolveDocumentBodyProposals(
      readings.filter((r) => r.kind === 'parcel-area-note'),
      { projectId: PROJECT, hasPrimaryAddress: true, survey: ONE_OPEN_RECORD },
    );
    expect(onlyOutsideForm.every((p) => p.layerName === 'Περίγραμμα')).toBe(true);
    expect(onlyOutsideForm.length).toBeGreaterThan(0);
  });
});

describe('🔴 η συγχώνευση μαρτύρων — μία γραμμή, πόσοι το λένε', () => {
  it('το εμβαδόν δηλώνεται ΤΡΕΙΣ φορές και δίνει ΜΙΑ πρόταση', () => {
    const area = forSurveyField('plotArea');
    expect(area).toHaveLength(1);
    expect(area[0].corroboration).toBe(3);
  });

  it('🔴 η συγχώνευση γίνεται στην ΑΝΑΛΥΜΕΝΗ τιμή, όχι στο κείμενο', () => {
    // Τα τρία κείμενα είναι «1.364,05» · «1364,05» · «1.364,05» — διαφορετικοί χαρακτήρες,
    // ίδιος αριθμός. Σύγκριση κειμένου θα έβγαζε δύο «διαφωνούντες» που συμφωνούν απόλυτα.
    const [area] = forSurveyField('plotArea');
    expect(area.snapshotValue).toBe('1.364,05');
    const candidate = area.candidates[0];
    expect(candidate.target.kind === 'survey-record' && candidate.target.value).toEqual({
      kind: 'number',
      value: 1364.05,
    });
  });

  it('οι κορυφές του οικοπέδου το λένε τρία έγγραφα', () => {
    expect(forSurveyField('plotBoundaryLabels')[0].corroboration).toBe(3);
  });

  it('ό,τι λέει ΕΝΑ έγγραφο δεν παριστάνει τους πολλούς', () => {
    expect(forSurveyField('surveyDate')[0].corroboration).toBe(1);
  });
});

describe('🔴 Φ5 — το σώμα αναβαθμίζει ό,τι η πινακίδα άφησε μισό', () => {
  it('η ημερομηνία ΑΝΑΛΥΕΤΑΙ πλήρως — καμία επιφύλαξη «μερικής τιμής»', () => {
    const [date] = forSurveyField('surveyDate');
    const candidate = date.candidates[0];
    expect(candidate.target.kind === 'survey-record' && candidate.target.value).toEqual({
      kind: 'text',
      value: '2026-07-30',
    });
    expect(date.caution).toBeUndefined();
  });

  it('🔴 η Πράξη Εφαρμογής ΔΕΝ φέρει `ambiguous-abbreviation` εδώ — γράφεται ολογράφως', () => {
    // Η επιφύλαξη ανήκει στο «Π.Ε. 39» της πινακίδας, όπου το ακρωνύμιο είναι διφορούμενο.
    // Στο σώμα το ίδιο νούμερο εισάγεται από τη φράση «ΠΡΑΞΗ ΕΦΑΡΜΟΓΗΣ» — καμία αμφισημία.
    expect(forSurveyField('implementationActNumber')[0].caution).toBeUndefined();
  });

  it('η Περιφερειακή Ενότητα πάει στη ΔΙΕΥΘΥΝΣΗ του έργου, όχι στο τοπογραφικό', () => {
    const address = proposals().filter((p) =>
      p.candidates.some((c) => c.target.kind === 'project-address'),
    );
    expect(address).toHaveLength(1);
    const target = address[0].candidates[0].target;
    expect(target.kind === 'project-address' && target.field).toBe('regionalUnit');
    expect(target.kind === 'project-address' && target.value).toBe('Θεσσαλονίκης');
  });
});

describe('🔴 κλειστός προορισμός ⇒ ΟΡΑΤΗ γραμμή, ποτέ εξαφάνιση', () => {
  it('σχέδιο χωρίς έργο: κάθε πρόταση δηλώνει `no-project`', () => {
    const orphan = resolveDocumentBodyProposals(readings, {});
    expect(orphan.length).toBeGreaterThan(0);
    expect(orphan.every((p) => p.blockedBy === 'no-project')).toBe(true);
    expect(orphan.every((p) => p.candidates.length === 0)).toBe(true);
  });

  it('έργο χωρίς κύρια διεύθυνση: η Περιφερειακή Ενότητα δηλώνεται κλειστή ΠΡΙΝ το κλικ', () => {
    const blocked = resolveDocumentBodyProposals(readings, {
      projectId: PROJECT,
      hasPrimaryAddress: false,
      survey: ONE_OPEN_RECORD,
    }).filter((p) => p.blockedBy === 'no-primary-address');
    expect(blocked).toHaveLength(1);
  });

  it('έργο χωρίς καρτέλα τοπογραφικού: οι δηλώσεις δεν έχουν πού να πάνε — και το λένε', () => {
    const noRecord = resolveDocumentBodyProposals(readings, {
      projectId: PROJECT,
      hasPrimaryAddress: true,
    });
    expect(noRecord.some((p) => p.blockedBy === 'no-survey-record')).toBe(true);
  });

  it('παγωμένο τοπογραφικό: ορατή άρνηση, ποτέ σιωπηλή παράκαμψη', () => {
    const frozen = resolveDocumentBodyProposals(readings, {
      projectId: PROJECT,
      hasPrimaryAddress: true,
      survey: { records: [{ id: 'srv_a', isConfirmed: true, label: 'x' }], activeId: 'srv_a' },
    });
    expect(frozen.some((p) => p.blockedBy === 'survey-record-locked')).toBe(true);
  });
});

describe('η ταυτότητα της γραμμής είναι σταθερή', () => {
  it('το σημείο εισαγωγής του εγγράφου είναι η ταυτότητα — ίδιο για όλα τα πεδία του', () => {
    const fromForm = proposals().filter((p) => p.layerName === 'ΠΕΡΙΓΡΑΦΗ');
    expect(new Set(fromForm.map((p) => p.sourceHandle)).size).toBeGreaterThan(0);
    // Ετικέτα και τιμή είναι το **ίδιο** MTEXT: η τιμή δεν έχει δικό της πλαίσιο μέσα σε πρόζα.
    expect(fromForm.every((p) => p.sourceHandle === p.labelHandle)).toBe(true);
  });

  it('δύο εκτελέσεις δίνουν την ίδια σειρά — ο μηχανικός δεν βλέπει άλλη οθόνη κάθε φορά', () => {
    expect(proposals().map((p) => p.fieldKey)).toEqual(proposals().map((p) => p.fieldKey));
  });
});
