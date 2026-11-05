import { DEFAULT_LIBRARY_PROPOSER, type SubcontractClauseVersion } from '../../types/clause';
import { authoringActionBlock, templateAuthoringBlock, translationApprovalBlock, versionActionBlock, type LibraryActionContext } from '../library-action-blocks';

type Facts = Pick<SubcontractClauseVersion, 'state' | 'proposedBy' | 'professionalReview' | 'sourceHash'>;

const proposed = (proposedBy: string): Facts => ({ state: 'proposed', proposedBy, professionalReview: 'needs_professional_review', sourceHash: 'h1' });
const approved: Facts = { state: 'approved', proposedBy: 'u-author', professionalReview: 'needs_professional_review', sourceHash: 'h1' };
const admin = (actorUid: string): LibraryActionContext => ({ actorUid, canManage: true, canPropose: true, pending: false });
const viewer: LibraryActionContext = { actorUid: 'u-viewer', canManage: false, canPropose: false, pending: false };
/** Η κρίση δεν ήρθε ακόμη — fail-closed, αλλά χωρίς ψευδή αιτία. */
const loading: LibraryActionContext = { actorUid: '', canManage: false, canPropose: false, pending: true };

describe('library-action-blocks — η κρίση που δεν ήρθε ακόμη (ADR-928 §5.20 απόφαση 9)', () => {
  it('εκκρεμεί ⇒ `pending` (ανενεργό, χωρίς «δεν έχεις δικαίωμα»)', () => {
    const version = proposed(DEFAULT_LIBRARY_PROPOSER);
    expect(versionActionBlock('approve', version, loading)).toEqual({ kind: 'pending' });
    expect(versionActionBlock('proposeTranslation', version, loading)).toEqual({ kind: 'pending' });
  });

  it('η πράξη που δεν αφορά κρύβεται ακόμη κι όταν εκκρεμεί η κρίση', () => {
    expect(versionActionBlock('approve', approved, loading)).toEqual({ kind: 'hidden' });
  });

  it('κρίση που ήρθε αρνητική ⇒ η αιτία λέγεται', () => {
    expect(versionActionBlock('approve', proposed(DEFAULT_LIBRARY_PROPOSER), viewer)).toEqual({ kind: 'explained', reason: 'notAuthorized' });
  });
});

describe('library-action-blocks — οι φύλακες του γραφέα, ως αιτίες οθόνης', () => {
  it('πρόταση του συστήματος: ο διαχειριστής εγκρίνει και απορρίπτει', () => {
    const version = proposed(DEFAULT_LIBRARY_PROPOSER);
    expect(versionActionBlock('approve', version, admin('u-1'))).toBeNull();
    expect(versionActionBlock('reject', version, admin('u-1'))).toBeNull();
  });

  it('ο προτείνων ΔΕΝ εγκρίνει τη δική του — αιτία που λέγεται· αποσύρει όμως', () => {
    const version = proposed('u-1');
    expect(versionActionBlock('approve', version, admin('u-1'))).toEqual({ kind: 'explained', reason: 'ownProposal' });
    expect(versionActionBlock('withdraw', version, admin('u-1'))).toBeNull();
  });

  it('η απόσυρση δεν αφορά κανέναν άλλο από τον προτείνοντα', () => {
    expect(versionActionBlock('withdraw', proposed('u-1'), admin('u-2'))).toEqual({ kind: 'hidden' });
  });

  it('χωρίς δικαίωμα: η πράξη που αφορά λέγεται «δεν έχεις δικαίωμα»· η άσχετη κρύβεται', () => {
    expect(versionActionBlock('approve', proposed('u-1'), viewer)).toEqual({ kind: 'explained', reason: 'notAuthorized' });
    expect(versionActionBlock('approve', approved, viewer)).toEqual({ kind: 'hidden' });
  });

  it('έγκριση/απόρριψη μόνο σε πρόταση · νομικός έλεγχος μόνο σε εγκεκριμένη που τον θέλει', () => {
    expect(versionActionBlock('approve', approved, admin('u-1'))).toEqual({ kind: 'hidden' });
    expect(versionActionBlock('reject', approved, admin('u-1'))).toEqual({ kind: 'hidden' });
    expect(versionActionBlock('markReviewed', approved, admin('u-1'))).toBeNull();
    expect(versionActionBlock('markReviewed', { ...approved, professionalReview: 'reviewed' }, admin('u-1'))).toEqual({ kind: 'hidden' });
    expect(versionActionBlock('markReviewed', proposed('u-2'), admin('u-1'))).toEqual({ kind: 'hidden' });
  });

  it('μετάφραση: μπαγιάτικη ⇒ λέγεται · του ίδιου ⇒ λέγεται · άλλου, τρέχουσα ⇒ εγκρίνεται', () => {
    const draft = { status: 'draft' as const, sourceHash: 'h1', proposedBy: 'u-translator' };
    expect(translationApprovalBlock(approved, draft, admin('u-1'))).toBeNull();
    expect(translationApprovalBlock(approved, { ...draft, sourceHash: 'h0' }, admin('u-1'))).toEqual({ kind: 'explained', reason: 'translationStale' });
    expect(translationApprovalBlock(approved, draft, admin('u-translator'))).toEqual({ kind: 'explained', reason: 'ownTranslation' });
    expect(translationApprovalBlock(approved, { ...draft, status: 'approved' }, admin('u-1'))).toEqual({ kind: 'hidden' });
  });
});

describe('library-action-blocks — πόρτες συγγραφής (ADR-928 §5.22)', () => {
  const open = { openProposal: null, isArchived: false };

  it('νέα ρήτρα: με δικαίωμα πρότασης ανοίγει· χωρίς λέγεται· σε αναμονή χωρίς ψευδή αιτία', () => {
    expect(authoringActionBlock('createClause', null, admin('u-1'))).toBeNull();
    expect(authoringActionBlock('createClause', null, viewer)).toEqual({ kind: 'explained', reason: 'notAuthorized' });
    expect(authoringActionBlock('createClause', null, loading)).toEqual({ kind: 'pending' });
  });

  it('πρόταση αλλαγής: μία ανοιχτή ανά ρήτρα (ο γραφέας λέει 409 `proposalPending`) · αρχειοθετημένη ⇒ δεν αφορά', () => {
    expect(authoringActionBlock('proposeChange', open, admin('u-1'))).toBeNull();
    expect(authoringActionBlock('proposeChange', { ...open, openProposal: 3 }, admin('u-1'))).toEqual({ kind: 'explained', reason: 'proposalPending' });
    expect(authoringActionBlock('proposeChange', { ...open, isArchived: true }, admin('u-1'))).toEqual({ kind: 'hidden' });
    expect(authoringActionBlock('proposeChange', { ...open, openProposal: 3 }, viewer)).toEqual({ kind: 'explained', reason: 'notAuthorized' });
  });

  it('πρότυπο: `templates:manage` · σε αναμονή χωρίς ψευδή αιτία · αρχειοθετημένο ⇒ καμία «Επεξεργασία»', () => {
    expect(templateAuthoringBlock(null, { canManageTemplates: true, pending: false })).toBeNull();
    expect(templateAuthoringBlock(null, { canManageTemplates: false, pending: false })).toEqual({ kind: 'explained', reason: 'notAuthorized' });
    expect(templateAuthoringBlock(null, { canManageTemplates: false, pending: true })).toEqual({ kind: 'pending' });
    expect(templateAuthoringBlock({ isArchived: true }, { canManageTemplates: true, pending: false })).toEqual({ kind: 'hidden' });
  });
});
