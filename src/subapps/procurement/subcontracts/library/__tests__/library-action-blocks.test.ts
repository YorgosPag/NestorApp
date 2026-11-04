import { DEFAULT_LIBRARY_PROPOSER, type SubcontractClauseVersion } from '../../types/clause';
import { translationApprovalBlock, versionActionBlock, type LibraryActionContext } from '../library-action-blocks';

type Facts = Pick<SubcontractClauseVersion, 'state' | 'proposedBy' | 'professionalReview' | 'sourceHash'>;

const proposed = (proposedBy: string): Facts => ({ state: 'proposed', proposedBy, professionalReview: 'needs_professional_review', sourceHash: 'h1' });
const approved: Facts = { state: 'approved', proposedBy: 'u-author', professionalReview: 'needs_professional_review', sourceHash: 'h1' };
const admin = (actorUid: string): LibraryActionContext => ({ actorUid, canManage: true, canPropose: true });
const viewer: LibraryActionContext = { actorUid: 'u-viewer', canManage: false, canPropose: false };

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
