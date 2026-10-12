/**
 * ADR-911 Φ4-3β — η λογική της αναθεώρησης ανοιγμάτων, σε συνθετικά στοιχεία (κάθε κανόνας
 * μόνος του) και πάνω στο σχέδιο δοκιμής (η λογιστική κλείνει).
 *
 *   · «τίποτα» ΔΕΝ φτάνει στον πυρήνα ως απόφαση·
 *   · «όμοια» = ίδιος λόγος ΚΑΙ ίδια κατάσταση ενοίκου — ποτέ μόνο ο ένας·
 *   · η υπόδειξη είναι «τίποτα» ΜΟΝΟ για κενό με κάτι ζωγραφισμένο μέσα·
 *   · αναποφάσιστα + απορριφθέντα + μη εγγράψιμα = όλα τα «προς απόφαση».
 */

import {
  countOpeningsByStatus,
  type OpeningProposal,
  type OpeningProposalItem,
} from '../opening-proposal';
import {
  canChooseOpening,
  countOpeningReview,
  decisionsFromChoices,
  reviewableOpenings,
  similarOpeningKeys,
  suggestedOpeningChoice,
  type OpeningReviewChoice,
} from '../opening-review';
import { buildOpeningPreview, openingReviewSignature } from '../opening-preview';
import { LEVEL, propose, sceneOf, writtenWalls } from './opening-fixture';

const SPAN = { start: { x: 0, y: 0 }, end: { x: 900, y: 0 } };
const HOST = { kind: 'bridge', wallIds: ['a', 'b'] } as const;

function item(key: string, patch: Partial<OpeningProposalItem> = {}): OpeningProposalItem {
  return {
    key, status: 'needs-decision', symbol: 'none', sourceIds: [], reason: 'no-symbol',
    host: HOST, span: SPAN, widthMm: 900, ...patch,
  };
}

const proposalOf = (...items: OpeningProposalItem[]): OpeningProposal => ({ items, unexplainedIds: [] });

describe('ADR-911 Φ4-3β — απαντήσεις → αποφάσεις του πυρήνα', () => {
  it('«τίποτα» μένει έξω: ο πυρήνας δέχεται μόνο ό,τι γράφεται', () => {
    const choices = new Map<string, OpeningReviewChoice>([['a', 'door'], ['b', 'none'], ['c', 'window']]);
    expect([...decisionsFromChoices(choices)]).toEqual([['a', 'door'], ['c', 'window']]);
  });
});

describe('ADR-911 Φ4-3β — ποιο στοιχείο δέχεται απάντηση', () => {
  it('αποφασίσιμο ή ήδη αποφασισμένο ⇒ ναι· χωρίς ξενιστή / θέση, ή από σύμβολο ⇒ όχι', () => {
    expect(canChooseOpening(item('a'))).toBe(true);
    expect(canChooseOpening(item('b', { status: 'door', decided: true }))).toBe(true);
    expect(canChooseOpening(item('c', { host: undefined }))).toBe(false);
    expect(canChooseOpening(item('d', { span: undefined }))).toBe(false);
    expect(canChooseOpening(item('e', { status: 'door' }))).toBe(false);
    expect(canChooseOpening(item('f', { status: 'existing' }))).toBe(false);
  });

  it('στην ουρά μπαίνουν όσα ρωτιούνται ΚΑΙ όσα απαντήθηκαν — όχι τα σύμβολα, όχι τα υπάρχοντα', () => {
    const proposal = proposalOf(
      item('ask'), item('answered', { status: 'window', decided: true }),
      item('blocked', { host: undefined, reason: 'no-jamb' }),
      item('symbol', { status: 'door', symbol: 'door', reason: undefined }), item('there', { status: 'existing' }),
    );
    expect(reviewableOpenings(proposal).map((i) => i.key)).toEqual(['ask', 'answered', 'blocked']);
  });
});

describe('ADR-911 Φ4-3β — υπόδειξη, ποτέ απόφαση', () => {
  it('κενό με ζωγραφισμένες γραμμές μέσα ⇒ «τίποτα»· άδειο κενό ⇒ καμία υπόδειξη', () => {
    expect(suggestedOpeningChoice(item('a', { occupantIds: ['line_1'] }))).toBe('none');
    expect(suggestedOpeningChoice(item('b', { occupantIds: [] }))).toBeNull();
    expect(suggestedOpeningChoice(item('c'))).toBeNull();
  });

  it('στοιχείο που δεν δέχεται απάντηση δεν παίρνει υπόδειξη, ό,τι κι αν κρατά', () => {
    expect(suggestedOpeningChoice(item('a', { host: undefined, occupantIds: ['line_1'] }))).toBeNull();
  });
});

describe('ADR-911 Φ4-3β — «όμοια»', () => {
  const proposal = proposalOf(
    item('empty-1'), item('empty-2'),
    item('occupied-1', { occupantIds: ['x'] }), item('occupied-2', { occupantIds: ['y', 'z'] }),
    item('sparse', { reason: 'sparse-symbol', symbol: 'window' }),
    item('blocked', { host: undefined }),
    item('answered', { status: 'door', decided: true }),
  );

  it('ίδιος λόγος ΚΑΙ ίδια κατάσταση ενοίκου — το ίδιο το στοιχείο περιλαμβάνεται', () => {
    expect(similarOpeningKeys(proposal, 'empty-1')).toEqual(['empty-1', 'empty-2', 'answered']);
    expect(similarOpeningKeys(proposal, 'occupied-1')).toEqual(['occupied-1', 'occupied-2']);
  });

  it('άλλος λόγος δεν είναι όμοιο, όσο κι αν μοιάζει η γεωμετρία', () => {
    expect(similarOpeningKeys(proposal, 'sparse')).toEqual(['sparse']);
  });

  it('στοιχείο που δεν δέχεται απάντηση, ή άγνωστο κλειδί, δεν έχει όμοια — ούτε τον εαυτό του', () => {
    expect(similarOpeningKeys(proposal, 'blocked')).toEqual([]);
    expect(similarOpeningKeys(proposal, 'nope')).toEqual([]);
  });
});

describe('ADR-911 Φ4-3β — η λογιστική της αναθεώρησης', () => {
  it('κάθε «προς απόφαση» μετριέται ΑΚΡΙΒΩΣ μία φορά', () => {
    const proposal = proposalOf(
      item('undecided'), item('dismissed'), item('blocked', { host: undefined }),
      item('decided', { status: 'door', decided: true }),
      item('symbol', { status: 'window', symbol: 'window' }), item('there', { status: 'existing' }),
    );
    const choices = new Map<string, OpeningReviewChoice>([['dismissed', 'none'], ['decided', 'door']]);

    expect(countOpeningReview(proposal, choices)).toEqual({ writable: 2, undecided: 1, dismissed: 1, blocked: 1 });
  });

  it('«τίποτα» σε στοιχείο που δεν γράφεται ούτως ή άλλως μένει «δεν γράφεται», όχι «απορρίφθηκε»', () => {
    const proposal = proposalOf(item('blocked', { host: undefined }));
    expect(countOpeningReview(proposal, new Map([['blocked', 'none']]))).toEqual({ writable: 0, undecided: 0, dismissed: 0, blocked: 1 });
  });

  it('στο σχέδιο δοκιμής: 12 εγγράψιμα, 2 αναποφάσιστα — και κλείνει με τα πλήθη της πρότασης', () => {
    const proposal = propose(sceneOf(writtenWalls(true)));
    const counts = countOpeningReview(proposal, new Map());
    const byStatus = countOpeningsByStatus(proposal);

    expect(counts).toEqual({ writable: 12, undecided: 2, dismissed: 0, blocked: 0 });
    expect(counts.writable).toBe(byStatus.door + byStatus.window);
    expect(counts.undecided + counts.dismissed + counts.blocked).toBe(byStatus['needs-decision']);
  });

  it('στο σχέδιο δοκιμής τα δύο κενά είναι όμοια μεταξύ τους και η υπόδειξη είναι «τίποτα»', () => {
    const proposal = propose(sceneOf(writtenWalls(true)));
    const gaps = proposal.items.filter((i) => i.symbol === 'none');

    expect(gaps).toHaveLength(2);
    expect(similarOpeningKeys(proposal, gaps[0].key)).toEqual(gaps.map((g) => g.key));
    expect(gaps.map(suggestedOpeningChoice)).toEqual(['none', 'none']);
  });
});

describe('ADR-911 Φ4-3β — το αποτύπωμα αυτού που είδε ο άνθρωπος', () => {
  const entities = sceneOf(writtenWalls(true));
  const previewOf = (proposal: OpeningProposal, choices = new Map<string, OpeningReviewChoice>()) =>
    buildOpeningPreview({ proposal, entities, levelId: LEVEL, sceneUnits: 'mm', choices });

  it('δύο υπολογισμοί της ίδιας σκηνής έχουν το ΙΔΙΟ αποτύπωμα, παρά τα νέα ids ανοιγμάτων', () => {
    const a = propose(entities);
    const b = propose(entities);
    expect(openingReviewSignature(a, previewOf(a))).toBe(openingReviewSignature(b, previewOf(b)));
  });

  it('μια απόφαση αλλάζει το αποτύπωμα', () => {
    const base = propose(entities);
    const gap = base.items.find((i) => i.symbol === 'none')!;
    const decided = propose(entities, new Map([[gap.key, 'door']]));
    expect(openingReviewSignature(decided, previewOf(decided))).not.toBe(openingReviewSignature(base, previewOf(base)));
  });

  it('ίδια πρόταση, άλλο φωτισμένο περίγραμμα ⇒ άλλο αποτύπωμα', () => {
    const proposal = propose(entities);
    const preview = previewOf(proposal);
    const moved = { ...preview, zones: preview.zones.map((z, i) => (i === 0 ? { ...z, pieces: [] } : z)) };
    expect(openingReviewSignature(proposal, moved)).not.toBe(openingReviewSignature(proposal, preview));
  });

  it('άρνηση του σχεδίου εγγραφής είναι μέρος αυτού που είδε ο άνθρωπος', () => {
    const proposal = propose(entities);
    const preview = previewOf(proposal);
    expect(openingReviewSignature(proposal, { ...preview, refusal: 'overlap' })).not.toBe(openingReviewSignature(proposal, preview));
  });
});
