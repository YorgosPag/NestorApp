import type { CatalogFailure } from '@/services/catalog/catalog-failure';
import type { PriceLineChange } from '@/subapps/catalog/pricing/diff-price-versions';
import type { PricePublicationPreview } from '@/subapps/catalog/types/price-list-requests';
import {
  canPublish,
  changeCounts,
  isChangedMeanwhile,
  orderedChanges,
  publishFlowReducer,
  publishRequestOf,
  startPublishFlow,
  visibleChanges,
  type PublishEvent,
  type PublishFlow,
} from '../publish-flow';

const preview = (diffDigest: string | null, linesRevision = 7): PricePublicationPreview => ({
  versionId: 'v2',
  previousVersionId: 'v1',
  linesRevision,
  fenceBp: 2000,
  diff: { changes: [], unchanged: 3, fenced: diffDigest === null ? 0 : 2 },
  diffDigest,
});

const failure = (kind: CatalogFailure['kind'], fence: CatalogFailure['fence'] = null): CatalogFailure =>
  ({ kind, issues: [], currentRevision: null, fence });

const run = (events: readonly PublishEvent[], start: PublishFlow = startPublishFlow(4)): PublishFlow =>
  events.reduce(publishFlowReducer, start);

const toReview = (digest: string | null): PublishEvent[] => [
  { type: 'schedule', issue: null, needsSave: false },
  { type: 'previewLoaded', preview: preview(digest) },
];

describe('publish-flow — η δημοσίευση ως μηχανή καταστάσεων', () => {
  it('ημερομηνία που ο κριτής αρνείται ⇒ μένει στο βήμα με το εύρημα, καμία αποστολή', () => {
    const flow = run([{ type: 'schedule', issue: 'versionValidFromNotAfterPrevious', needsSave: true }]);
    expect(flow).toEqual({ step: 'schedule', revision: 4, issue: 'versionValidFromNotAfterPrevious', notice: null });
  });

  it('νέα ημερομηνία ⇒ πρώτα αποθήκευση (CAS)· η δημοσίευση στέλνει τη ΝΕΑ αναθεώρηση της έκδοσης', () => {
    const flow = run([
      { type: 'schedule', issue: null, needsSave: true },
      { type: 'saved', revision: 5 },
      { type: 'previewLoaded', preview: preview(null) },
      { type: 'submit' },
    ]);
    expect(publishRequestOf(flow)).toEqual({ expectedRevision: 5, expectedLinesRevision: 7, confirmedDiffDigest: null });
  });

  it('χωρίς φράχτη ⇒ δημοσίευση χωρίς επιβεβαίωση, με το linesRevision της προεπισκόπησης', () => {
    const flow = run(toReview(null));
    expect(canPublish(flow)).toBe(true);
  });

  it('με φράχτη ⇒ το «Δημοσίευση» μένει κλειστό ως τη ρητή επιβεβαίωση· στέλνει το αποτύπωμα που είδε ο άνθρωπος', () => {
    const unconfirmed = run([...toReview('aaaaaaaaaaaaaaaa'), { type: 'submit' }]);
    expect(unconfirmed.step).toBe('review');
    expect(publishRequestOf(unconfirmed)).toBeNull();
    const sent = run([{ type: 'confirm', confirmed: true }, { type: 'submit' }], unconfirmed);
    expect(publishRequestOf(sent)?.confirmedDiffDigest).toBe('aaaaaaaaaaaaaaaa');
  });

  it('409 άλλου φράχτη ⇒ νέα προεπισκόπηση, η επιβεβαίωση ΣΒΗΝΕΙ — ποτέ σιωπηλή αποστολή με το νέο αποτύπωμα', () => {
    const publishing = run([...toReview('aaaaaaaaaaaaaaaa'), { type: 'confirm', confirmed: true }, { type: 'submit' }]);
    const fenced = failure('confirmationRequired', { diffDigest: 'bbbbbbbbbbbbbbbb', fencedCount: 5 });
    const after = run([{ type: 'failed', failure: fenced }], publishing);
    expect(after).toEqual({ step: 'previewing', revision: 4, notice: 'fenceChanged' });
    const reviewed = run([{ type: 'previewLoaded', preview: preview('bbbbbbbbbbbbbbbb') }, { type: 'submit' }], after);
    expect(reviewed).toMatchObject({ step: 'review', confirmed: false, notice: 'fenceChanged' });
    expect(canPublish(reviewed)).toBe(false);
  });

  it('409 CAS (άλλαξε από άλλον) ⇒ αποτυχία που ζητά νέα αρχή πάνω στη ζωντανή έκδοση', () => {
    const publishing = run([...toReview(null), { type: 'submit' }]);
    const after = run([{ type: 'failed', failure: failure('revisionMismatch') }], publishing);
    expect(isChangedMeanwhile(after)).toBe(true);
    expect(run([{ type: 'restart', revision: 9, notice: 'changedMeanwhile' }], after)).toEqual(startPublishFlow(9, 'changedMeanwhile'));
  });

  it('confirmationRequired ΧΩΡΙΣ αποτύπωμα (σώμα που δεν ελέγχθηκε) ⇒ αποτυχία, όχι ατέρμονη ανανέωση', () => {
    const publishing = run([...toReview(null), { type: 'submit' }]);
    expect(run([{ type: 'failed', failure: failure('confirmationRequired') }], publishing).step).toBe('failed');
  });

  it('γεγονότα εκτός σειράς αγνοούνται (αργή απάντηση δεν προσπερνά βήμα)', () => {
    const scheduled = startPublishFlow(4);
    expect(run([{ type: 'previewLoaded', preview: preview(null) }, { type: 'submit' }, { type: 'published' }], scheduled)).toEqual(scheduled);
  });
});

const change = (subjectKey: string, kind: PriceLineChange['kind'], exceedsFence: boolean): PriceLineChange =>
  ({ kind, subjectKey, before: null, after: null, unitPriceChangeBp: null, exceedsFence });

describe('orderedChanges / changeCounts — η διαφορά στην οθόνη', () => {
  const changes = [change('c', 'added', false), change('a', 'changed', false), change('b', 'changed', true), change('d', 'removed', true)];

  it('φραγμένες πρώτες, μετά αλλαγές · νέες · αφαιρέσεις', () => {
    expect(orderedChanges(changes).map((entry) => entry.subjectKey)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('μετρά ανά είδος', () => {
    expect(changeCounts(changes)).toEqual({ added: 1, removed: 1, changed: 2 });
  });

  it('προεπισκόπηση: ΟΛΕΣ οι φραγμένες φαίνονται ακόμη κι αν ξεπερνούν το όριο· κρύβονται μόνο μη φραγμένες, μετρημένες', () => {
    const many = [...Array.from({ length: 3 }, (_, i) => change(`f${i}`, 'changed', true)), ...Array.from({ length: 5 }, (_, i) => change(`n${i}`, 'changed', false))];
    const { shown, hidden } = visibleChanges(many, 2);
    expect(shown.filter((entry) => entry.exceedsFence)).toHaveLength(3);
    expect(shown).toHaveLength(5);
    expect(hidden).toBe(3);
  });
});
