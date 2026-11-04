import { DEFAULT_CLAUSE_LIBRARY } from '@/config/subcontracts/default-clause-library';
import { DEFAULT_TRADE_TEMPLATES } from '@/config/subcontracts/default-trade-templates';
import type { ApprovedLibrary, ClauseInForce } from '../../agreements/judge-deviations';
import { documentLocaleOf } from '../../document/document-locale';
import { DEFAULT_LIBRARY_PROPOSER, type ClauseBody, type ClauseTranslation, type SubcontractClauseVersion } from '../../types/clause';
import type { ClauseParameterDefinition } from '../../types/clause-parameter';
import { movedIndex, reviewCommandOf, successorOf, type ReviewKeyEvent } from '../review-keyboard';
import { pendingSeedTemplatesOf } from '../seed-template-readiness';
import { rangeText, toleranceTextOf } from '../tolerance-text';
import { staleSourceOf, translationRowsOf, translationSeedOf, translationStateOf, withInlineText } from '../translation-status';

const inForce = (index: number, parameters: ClauseInForce['parameters']): ClauseInForce => ({ clauseId: `sccl_${index}`, version: 1, parameters });

/** Η σπαρμένη βιβλιοθήκη, όλη εγκεκριμένη — η είσοδος που θα έβλεπε ο γραφέας μετά από πλήρη έλεγχο. */
const fullyApproved: ApprovedLibrary = new Map(DEFAULT_CLAUSE_LIBRARY.map((draft, index) => [draft.clauseKey, inForce(index, draft.parameters)]));

describe('seed-template-readiness — τι περιμένουν τα προτεινόμενα πρότυπα', () => {
  it('όλη η σπαρμένη βιβλιοθήκη εγκεκριμένη ⇒ κάθε προτεινόμενο πρότυπο έτοιμο (ίδιος κριτής με τον γραφέα)', () => {
    const pending = pendingSeedTemplatesOf(DEFAULT_TRADE_TEMPLATES, [], fullyApproved);
    expect(pending.map((entry) => [entry.definition.code, entry.issues.length, entry.awaitingClauses.length])).toEqual(
      DEFAULT_TRADE_TEMPLATES.map((template) => [template.code, 0, 0]),
    );
  });

  it('ρήτρα χωρίς έκδοση σε ισχύ ⇒ το πρότυπο που τη δένει λέει ποια περιμένει', () => {
    const [template] = DEFAULT_TRADE_TEMPLATES;
    const waitingKey = template.clauses[0].clauseKey;
    const library = new Map(fullyApproved).set(waitingKey, null);
    const [entry] = pendingSeedTemplatesOf([template], [], library);
    expect(entry.awaitingClauses).toEqual([waitingKey]);
    expect(entry.issues).toEqual([{ code: 'clauseRefNotApproved', path: 'clauses.0' }]);
  });

  it('ό,τι υπάρχει ήδη στον χώρο (και αρχειοθετημένο) δεν είναι εκκρεμές', () => {
    expect(pendingSeedTemplatesOf(DEFAULT_TRADE_TEMPLATES, DEFAULT_TRADE_TEMPLATES.map(({ code }) => ({ code })), new Map())).toEqual([]);
  });
});

const translation = (patch: Partial<ClauseTranslation> = {}): ClauseTranslation => ({
  body: { heading: 'Retention', blocks: [] }, status: 'approved', origin: 'human', sourceHash: 'h1',
  proposedBy: 'u-1', approvedBy: 'u-2', approvedAt: '2026-11-04T00:00:00.000Z', ...patch,
});

const version = (number: number, sourceHash: string, translations: Record<string, ClauseTranslation> = {}): SubcontractClauseVersion => ({
  id: `sccv_${number}`, companyId: 'comp_1', clauseId: 'sccl_1', version: number, state: 'approved', professionalReview: 'reviewed',
  effectiveFrom: null, supersededBy: null, body: { heading: '', blocks: [] }, parameters: [], translations,
  contentHash: 'c', sourceHash, proposedBy: DEFAULT_LIBRARY_PROPOSER, proposalReason: null, decidedBy: null, decidedAt: null,
  decisionReason: null, reviewedBy: null, reviewedAt: null, revision: 1, createdAt: '', updatedAt: '', updatedBy: 'u',
});

describe('translation-status — εγκεκριμένη · πρόχειρη · μπαγιάτικη · λείπει', () => {
  it('ο κανόνας «μπαγιάτικη» = άλλο ελληνικό, όπως ο φύλακας του γραφέα — ακόμη κι αν ήταν εγκεκριμένη', () => {
    expect(translationStateOf({ sourceHash: 'h1' }, translation())).toBe('approved');
    expect(translationStateOf({ sourceHash: 'h1' }, translation({ status: 'draft' }))).toBe('draft');
    expect(translationStateOf({ sourceHash: 'h2' }, translation({ status: 'approved' }))).toBe('stale');
    expect(translationStateOf({ sourceHash: 'h2' }, undefined)).toBe('missing');
  });

  it('μία γραμμή ανά γλώσσα εγγράφου πλην της ελληνικής, και όσες άλλες έχει η έκδοση', () => {
    const rows = translationRowsOf(version(2, 'h2', { de: translation({ sourceHash: 'h2', status: 'draft' }) }));
    expect(rows.map((row) => [row.language, row.state])).toEqual([['en', 'missing'], ['de', 'draft']]);
  });

  it('η πηγή μιας μπαγιάτικης: η πιο πρόσφατη παλαιότερη έκδοση με το ίδιο ελληνικό', () => {
    const history = [version(3, 'h3'), version(2, 'h1'), version(1, 'h1')];
    expect(staleSourceOf({ version: 3 }, { sourceHash: 'h1' }, history)?.version).toBe(2);
    expect(staleSourceOf({ version: 3 }, { sourceHash: 'h9' }, history)).toBeNull();
  });
});

describe('translation-status — αφετηρία πρότασης μετάφρασης', () => {
  const greek: ClauseBody = {
    heading: 'Κράτηση',
    blocks: [{ kind: 'paragraph', inlines: [{ kind: 'text', text: 'Κράτηση ' }, { kind: 'param', key: 'rate' }, { kind: 'text', text: ' επί κάθε πληρωμής.' }] }],
  };
  const english: ClauseBody = {
    heading: 'Retention',
    blocks: [{ kind: 'paragraph', inlines: [{ kind: 'text', text: 'Retention ' }, { kind: 'param', key: 'rate' }, { kind: 'text', text: ' on each payment.' }] }],
  };

  it('ίδιο σχήμα ⇒ η υπάρχουσα (και μπαγιάτικη) μετάφραση· άλλο σχήμα ή καμία ⇒ το ελληνικό', () => {
    expect(translationSeedOf(greek, english)).toBe(english);
    const reshaped: ClauseBody = { ...english, blocks: [{ kind: 'paragraph', inlines: [{ kind: 'text', text: 'Retention.' }] }] };
    expect(translationSeedOf(greek, reshaped)).toBe(greek);
    expect(translationSeedOf(greek, null)).toBe(greek);
  });

  it('η επεξεργασία αλλάζει μόνο κείμενο — η παράμετρος μένει κλειδωμένη στη θέση της', () => {
    const edited = withInlineText(english, { block: 0, item: null, inline: 2 }, ' of every payment.');
    expect(edited.blocks[0]).toEqual({ kind: 'paragraph', inlines: [{ kind: 'text', text: 'Retention ' }, { kind: 'param', key: 'rate' }, { kind: 'text', text: ' of every payment.' }] });
    expect(withInlineText(english, { block: 0, item: null, inline: 1 }, 'x')).toEqual(english);
  });
});

describe('tolerance-text — οι ζώνες όπως τις λέει το έγγραφο', () => {
  const el = documentLocaleOf('el');
  const retention = DEFAULT_CLAUSE_LIBRARY.find((draft) => draft.clauseKey === 'retention.performance');
  const rate = retention?.parameters[0] as ClauseParameterDefinition;

  it('εύρος ως ποσοστό εγγράφου, με συμπεριληπτικά όρια', () => {
    const definition: ClauseParameterDefinition = { ...rate, tolerance: { kind: 'numeric', acceptable: { min: 300, max: 1000 }, walkAway: { min: 200, max: null } } };
    expect(toleranceTextOf(definition, el)).toEqual({
      kind: 'range', acceptable: `${el.percent(300)} – ${el.percent(1000)}`, walkAway: `≥ ${el.percent(200)}`,
    });
  });

  it('χωρίς ζώνη · σταθερή · ανοιχτό εύρος', () => {
    expect(toleranceTextOf({ ...rate, tolerance: null }, el)).toEqual({ kind: 'none' });
    expect(toleranceTextOf({ ...rate, tolerance: { kind: 'fixed' } }, el)).toEqual({ kind: 'fixed' });
    expect(rangeText({ min: null, max: null }, rate, el)).toBeNull();
    expect(rangeText({ min: 500, max: 500 }, rate, el)).toBe(el.percent(500));
  });
});

const key = (patch: Partial<ReviewKeyEvent>): ReviewKeyEvent => ({ key: 'j', ctrlKey: false, altKey: false, metaKey: false, typing: false, onControl: false, ...patch });

describe('review-keyboard — J/K/A/R/Enter', () => {
  it('γράμματα και Enter γίνονται εντολές, και με Shift/Caps Lock', () => {
    expect(['j', 'K', 'a', 'R', 'Enter', 'x'].map((value) => reviewCommandOf(key({ key: value })))).toEqual(['next', 'previous', 'approve', 'reject', 'open', null]);
  });

  it('ποτέ μέσα σε πεδίο ή με τροποποιητή (Ctrl+R = ανανέωση browser)', () => {
    expect(reviewCommandOf(key({ key: 'a', typing: true }))).toBeNull();
    expect(reviewCommandOf(key({ key: 'r', ctrlKey: true }))).toBeNull();
    expect(reviewCommandOf(key({ key: 'j', metaKey: true }))).toBeNull();
    expect(reviewCommandOf(key({ key: 'j', altKey: true }))).toBeNull();
  });

  it('Enter σε κουμπί ανήκει στο κουμπί (επιλογή), τα γράμματα όχι', () => {
    expect(reviewCommandOf(key({ key: 'Enter', onControl: true }))).toBeNull();
    expect(reviewCommandOf(key({ key: 'j', onControl: true }))).toBe('next');
  });

  it('η κίνηση δεν τυλίγει· χωρίς επιλογή ξεκινά από την πρώτη', () => {
    expect(movedIndex(-1, 'next', 3)).toBe(0);
    expect(movedIndex(2, 'next', 3)).toBe(2);
    expect(movedIndex(0, 'previous', 3)).toBe(0);
    expect(movedIndex(1, 'previous', 3)).toBe(0);
    expect(movedIndex(0, 'next', 0)).toBe(-1);
  });

  it('μετά την απόφαση: η επόμενη που πήρε τη θέση της, αλλιώς η προηγούμενη, αλλιώς τίποτα', () => {
    expect(successorOf(['a', 'b', 'c'], ['a', 'c'], 'b')).toBe('c');
    expect(successorOf(['a', 'b', 'c'], ['a', 'b'], 'c')).toBe('b');
    expect(successorOf(['a', 'b'], ['a', 'b'], 'b')).toBe('b');
    expect(successorOf(['a'], [], 'a')).toBeNull();
  });
});
