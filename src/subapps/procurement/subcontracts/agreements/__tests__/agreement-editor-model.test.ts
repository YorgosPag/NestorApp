/**
 * ADR-928 Φ3γ — το καθαρό στρώμα του επεξεργαστή: πρότυπο → πρόχειρο · αποθηκευμένο → πρόχειρο · ζωντανή κρίση ·
 * προβολή της προεπισκόπησης. Κάθε συνάρτηση ελέγχεται ΑΠΕΝΑΝΤΙ στον γραφέα (ίδιοι κριτές, ίδιο `contentFieldsOf`).
 */

import { DEFAULT_CLAUSE_LIBRARY } from '@/config/subcontracts/default-clause-library';
import { DEFAULT_TRADE_TEMPLATES } from '@/config/subcontracts/default-trade-templates';
import type { SubcontractTradeTemplate } from '../../types/trade-template';
import { contentFieldsOf } from '../agreement-content-fields';
import { draftInputOf } from '../agreement-draft-input';
import { draftFromTemplate } from '../draft-from-template';
import { issuesAt, issuesUnder } from '../issue-paths';
import { judgeAgreementDraft } from '../judge-agreement-draft';
import { judgeClauseSelections, selectionInputsOf, type ApprovedLibrary } from '../judge-deviations';
import { projectDraftAgreement } from '../project-draft-agreement';
import { LIBRARY, sampleAgreement, sampleProjectIdentity } from './agreement-fixtures';

const TODAY = '2026-11-03';
const ACTOR = 'u_author';

/** Η προεπιλεγμένη βιβλιοθήκη, κάθε ρήτρα εγκεκριμένη στην έκδοση 1 — όπως μετά τη σπορά. */
const SEEDED_LIBRARY: ApprovedLibrary = new Map(
  DEFAULT_CLAUSE_LIBRARY.map((clause) => [clause.clauseKey, { clauseId: `sccl_${clause.clauseKey}`, version: 1, parameters: clause.parameters }]),
);

function seededTemplate(index: number): SubcontractTradeTemplate {
  const definition = DEFAULT_TRADE_TEMPLATES[index];
  return {
    ...definition, id: `sctt_${definition.code}`, companyId: 'comp_1', isArchived: false, revision: 1,
    createdAt: '2026-11-01T08:00:00.000Z', updatedAt: '2026-11-01T08:00:00.000Z', createdBy: 'u_seed', updatedBy: 'u_seed',
  };
}

const CHOICE = { scope: { kind: 'single_project' as const, projectId: 'proj_1', buildingIds: [] }, subcontractorContactId: 'ct_sub' };
const context = (library: ApprovedLibrary = LIBRARY) => ({ library, previous: [], actorUid: ACTOR, today: TODAY });

describe('draftFromTemplate — η φόρμα παράγεται από το πρότυπο', () => {
  it.each(DEFAULT_TRADE_TEMPLATES.map((template, index) => [template.code, index] as const))(
    '%s: με τη σπαρμένη βιβλιοθήκη το πρόχειρο περνά τους ΙΔΙΟΥΣ κριτές με τον γραφέα χωρίς εύρημα',
    (_code, index) => {
      const { draft, unresolved } = draftFromTemplate(seededTemplate(index), SEEDED_LIBRARY, CHOICE);
      expect(unresolved).toEqual([]);
      expect(judgeAgreementDraft(draft, context(SEEDED_LIBRARY)).issues).toEqual([]);
      expect(draft.templateId).toBe(seededTemplate(index).id);
    },
  );

  it('ρήτρα χωρίς έκδοση σε ισχύ ή άγνωστη ΔΕΝ μαντεύεται: μένει έξω και αναφέρεται', () => {
    const template = { ...seededTemplate(1), clauses: [
      { clauseKey: 'crew.composition', parameterOverrides: {} },
      { clauseKey: 'no.such.clause', parameterOverrides: {} },
      { clauseKey: 'payment.instruments', parameterOverrides: {} },
    ] };
    const { draft, unresolved } = draftFromTemplate(template, LIBRARY, CHOICE);
    expect(unresolved).toEqual(['crew.composition', 'no.such.clause']);
    expect(draft.clauses.map((clause) => [clause.clauseKey, clause.version])).toEqual([['payment.instruments', 2]]);
  });

  it('τιμή προτύπου για ΔΕΣΜΕΥΜΕΝΗ παράμετρο δεν περνά (ο γραφέας θα έλεγε overrideOnBoundParameter)', () => {
    const template = { ...seededTemplate(1), clauses: [
      { clauseKey: 'retention.performance', parameterOverrides: { rate: { kind: 'percent' as const, value: 700 } } },
      { clauseKey: 'payment.instruments', parameterOverrides: { instrument: { kind: 'enum' as const, value: 'bank' } } },
    ] };
    const { draft } = draftFromTemplate(template, LIBRARY, CHOICE);
    expect(draft.clauses[0].parameterValues).toEqual({});
    expect(draft.clauses[1].parameterValues).toEqual({ instrument: { kind: 'enum', value: 'bank' } });
  });
});

describe('draftInputOf — στρογγυλή διαδρομή με τον γραφέα', () => {
  it('το αμετάβλητο πρόχειρο ξαναγράφει ΑΚΡΙΒΩΣ το ίδιο περιεχόμενο', () => {
    const saved = sampleAgreement();
    const draft = draftInputOf(saved);
    const rejudged = judgeClauseSelections(draft.clauses, LIBRARY, draft.terms, saved.clauses, { uid: ACTOR });
    const { parties, scope, clauses, ...rest } = contentFieldsOf(draft, { parties: saved.parties, scope: saved.scope, clauses: rejudged.selections });
    expect(rejudged.issues).toEqual([]);
    expect({ parties, scope, clauses }).toEqual({ parties: saved.parties, scope: saved.scope, clauses: saved.clauses });
    expect(rest.projectIds).toEqual(saved.projectIds);
    expect(rest.lines).toBe(saved.lines);
  });

  it('οι λόγοι αποκλίσεων ταξιδεύουν — και η απόφαση μένει (ίδια τιμή + ίδιος λόγος)', () => {
    const pending = judgeClauseSelections(
      [{ clauseKey: 'payment.instruments', version: 2, parameterValues: { instrument: { kind: 'enum', value: 'cheque' } }, deviationReasons: { instrument: 'επιταγή 4 μηνών' } }],
      LIBRARY, sampleAgreement().terms, [], { uid: ACTOR },
    ).selections;
    const approved = pending.map((selection) => ({
      ...selection,
      deviations: { instrument: { ...selection.deviations.instrument, decision: 'approved' as const, decidedBy: 'u_admin', decidedAt: '2026-11-03T09:00:00.000Z' } },
    }));
    const inputs = selectionInputsOf(approved);
    expect(inputs[0].deviationReasons).toEqual({ instrument: 'επιταγή 4 μηνών' });
    const again = judgeClauseSelections(inputs, LIBRARY, sampleAgreement().terms, approved, { uid: 'u_other' });
    expect(again.issues).toEqual([]);
    expect(again.selections[0].deviations.instrument.decision).toBe('approved');
  });
});

describe('judgeAgreementDraft — όλα τα ευρήματα μαζί, με τα μονοπάτια του γραφέα', () => {
  it('επικύρωση + ρήτρες στην ίδια απάντηση', () => {
    const draft = { ...draftInputOf(sampleAgreement()), title: { el: '' } };
    const withCash = { ...draft, clauses: [{ ...draft.clauses[1], parameterValues: { instrument: { kind: 'enum' as const, value: 'cash' } } }] };
    const { issues } = judgeAgreementDraft(withCash, context());
    expect(issuesAt(issues, 'title').map((issue) => issue.code)).toEqual(['clauseTitleRequired']);
    expect(issuesUnder(issues, 'clauses').map((issue) => issue.code)).toEqual(['deviationForbidden']);
  });

  it('πρόθεμα σε όριο τμήματος: `lines.1` δεν πιάνει το `lines.10`', () => {
    const issues = [{ code: 'amountInvalid' as const, path: 'lines.10.unitPrice' }, { code: 'amountInvalid' as const, path: 'lines.1.unitPrice' }];
    expect(issuesUnder(issues, 'lines.1')).toEqual([issues[1]]);
  });
});

describe('projectDraftAgreement — η προεπισκόπηση δείχνει το πρόχειρο, τα μέρη μένουν του διακομιστή', () => {
  const saved = sampleAgreement();
  const project = (patch: Partial<ReturnType<typeof draftInputOf>>) => {
    const draft = { ...draftInputOf(saved), ...patch };
    return projectDraftAgreement(saved, draft, judgeAgreementDraft(draft, { ...context(), previous: saved.clauses }).selections);
  };

  it('αμετάβλητο πρόχειρο ⇒ το αποθηκευμένο έγγραφο, τίποτα «μπαγιάτικο»', () => {
    const { agreement, stale } = project({});
    expect(stale).toEqual([]);
    expect(agreement).toEqual(saved);
  });

  it('τιμή ρήτρας, τίτλος, αφαίρεση κτιρίου ⇒ φαίνονται αμέσως', () => {
    const draft = draftInputOf(saved);
    const { agreement, stale } = project({
      title: { el: 'Νέος τίτλος' },
      scope: { kind: 'single_project', projectId: 'proj_1', buildingIds: [] },
      clauses: [draft.clauses[0], { ...draft.clauses[1], parameterValues: { instrument: { kind: 'enum', value: 'cheque' } }, deviationReasons: { instrument: 'λόγος' } }],
    });
    expect(stale).toEqual([]);
    expect(agreement.title).toEqual({ el: 'Νέος τίτλος' });
    expect(agreement.scope.kind === 'single_project' && agreement.scope.project.buildingIds).toEqual([]);
    expect(agreement.clauses[1].parameterValues.instrument).toEqual({ kind: 'enum', value: 'cheque' });
    expect(agreement.clauses[1].deviations.instrument.decision).toBe('pending');
  });

  it('§5.24: νέο κτίριο ⇒ η ετικέτα του ΔΕΝ μαντεύεται (stale)· όσα έμειναν κρατούν τη δική τους', () => {
    const labelled = sampleAgreement({ scope: { kind: 'single_project', project: { ...sampleProjectIdentity(), buildings: [{ id: 'bld_1', label: 'Κτήριο Α' }] } } });
    const draft = { ...draftInputOf(labelled), scope: { kind: 'single_project' as const, projectId: 'proj_1', buildingIds: ['bld_1', 'bld_2'] } };
    const { agreement, stale } = projectDraftAgreement(labelled, draft, judgeAgreementDraft(draft, { ...context(), previous: labelled.clauses }).selections);
    expect(stale).toEqual(['scope']);
    expect(agreement.scope.kind === 'single_project' && agreement.scope.project.buildings).toEqual([{ id: 'bld_1', label: 'Κτήριο Α' }]);
  });

  it('άλλος υπεργολάβος / ονομαστικοί οικοπεδούχοι / άλλο έργο ⇒ ΔΕΝ μαντεύεται, αναφέρεται', () => {
    const { agreement, stale } = project({
      subcontractorContactId: 'ct_other',
      projectOwners: { kind: 'named', contactIds: ['ct_owner'] },
      scope: { kind: 'single_project', projectId: 'proj_2', buildingIds: [] },
    });
    expect(stale).toEqual(['subcontractor', 'projectOwners', 'scope']);
    expect(agreement.parties.subcontractor).toBe(saved.parties.subcontractor);
    expect(agreement.scope).toBe(saved.scope);
  });

  it('οικοπεδούχοι «κανένας» λύνονται χωρίς πηγή ⇒ φαίνονται αμέσως', () => {
    const { agreement, stale } = project({ projectOwners: { kind: 'none' } });
    expect(stale).toEqual([]);
    expect(agreement.parties.projectOwners).toEqual({ kind: 'none' });
  });
});
