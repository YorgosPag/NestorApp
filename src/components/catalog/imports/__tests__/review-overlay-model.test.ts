/**
 * **Ο χάρτης κατάστασης πάνω στο PDF** (ADR-923 §5.5.2 Β8) — καθαρό μοντέλο: τόνοι, συγχώνευση ίδιας περιοχής, χειρότερος τόνος,
 * σειρά (περιέκτες πρώτα, μετά ανάγνωση) και σταθερά κλειδιά που επιβιώνουν ξαναφόρτωμα.
 */
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type { ImportPageUnmappedLine, ImportProposalField, ImportProposalRow, PageRegion } from '@/subapps/catalog/types/catalog-import';
import type { ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { ANY_SLOT } from '@/subapps/catalog/types/product';
import { lineKeyOf } from '@/subapps/catalog/import/page-line-overrides';
import {
  buildReviewBoxes,
  countBoxTones,
  fieldTargetOf,
  lineTargetOf,
  reasonOfField,
  resolveReviewTarget,
  reviewTargetKey,
  toneOfField,
  toneOfLine,
} from '../review-overlay-model';

const CELL: PageRegion = { x: 0.1, y: 0.2, width: 0.1, height: 0.02 };
const ROW_BAND: PageRegion = { x: 0.05, y: 0.19, width: 0.8, height: 0.04 };

const target = (attributeId: string) => ({ kind: 'attribute', attributeId, channel: ANY_SLOT, locale: ANY_SLOT } as const);

const field = (overrides: Partial<ImportProposalField> = {}): ImportProposalField => ({
  target: target('cattr_power'),
  sourceText: '340',
  incoming: { type: 'measurement', amount: '340', unitCode: 'm3_h' },
  live: null,
  base: null,
  status: 'new',
  confidence: 0.95,
  anchor: { kind: 'page', page: 87, regions: [CELL], verified: true },
  issues: [],
  decision: 'accept',
  ...overrides,
});

const row = (rowKey: string, fields: readonly ImportProposalField[], overrides: Partial<ImportProposalRow> = {}): ImportProposalRow => ({
  rowKey, holderKind: 'product', holderId: null, expectedRevision: null, action: 'create', label: rowKey, fields, issues: [], ...overrides,
});

const proposal = (rows: readonly ImportProposalRow[]): ImportProposalWire => ({
  id: 'cipsl_1', companyId: 'c', revision: 1, isDeleted: false, createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', deletedAt: null, deletedBy: null,
  batchId: 'b', groupKey: 'g', purpose: 'attributes', status: 'pending', familyId: 'f', variantSchemeCode: 's', modelCode: 'mfp', priceListVersionId: null, pages: [87],
  extracted: { groupKey: 'g', modelCode: 'mfp', sharedCells: [], rows: [], pages: [87] }, rows, violations: [], appliedAt: null, appliedBy: null,
});

const line = (overrides: Partial<ImportPageUnmappedLine> = {}): ImportPageUnmappedLine => ({
  page: 87, table: 't0', line: 4, label: 'ΕΝΑΛΛΑΚΤΗΣ', values: ['A', 'B'], regions: [ROW_BAND], ...overrides,
});

const source = (proposals: readonly ImportProposalWire[], lines: readonly ImportPageUnmappedLine[] = []) =>
  ({ proposals, lines, overrides: undefined, activity: new Map() });

describe('toneOfField', () => {
  const r = row('r0', []);
  it('εκκρεμεί · αποδεκτό · απορρίφθηκε · αμετάβλητο ⇒ οι κάδοι της σύνοψης', () => {
    expect(toneOfField(r, field({ decision: 'pending' }))).toBe('pending');
    expect(toneOfField(r, field())).toBe('accepted');
    expect(toneOfField(r, field({ decision: 'reject' }))).toBe('dismissed');
    expect(toneOfField(r, field({ status: 'unchanged' }))).toBe('accepted');
  });
  it('εύρημα · αδιάβαστη τιμή · διαψευσμένη τιμή · εύρημα γραμμής ⇒ πρόβλημα, ακόμη κι αν έγινε δεκτό', () => {
    expect(toneOfField(r, field({ issues: [{ code: 'misaligned', path: 'x' }] }))).toBe('problem');
    expect(toneOfField(r, field({ incoming: null }))).toBe('problem');
    expect(toneOfField(r, field({ anchor: { kind: 'page', page: 87, regions: [CELL], verified: false } }))).toBe('problem');
    expect(toneOfField(row('r0', [], { issues: [{ code: 'modelCodeMissing', path: 'x' }] }), field())).toBe('problem');
  });
  it('σελίδα χωρίς στρώση κειμένου (`verified: null`) ΔΕΝ είναι πρόβλημα — δεν διαψεύστηκε, απλώς δεν ελέγχεται', () => {
    expect(toneOfField(r, field({ anchor: { kind: 'page', page: 87, regions: [CELL], verified: null } }))).toBe('accepted');
  });
});

describe('reasonOfField', () => {
  const r = row('r0', []);
  it('η αιτία ταξιδεύει με τον τόνο: εύρημα πεδίου (πριν από της γραμμής) · αδιάβαστη · διαψευσμένη · καμία', () => {
    const fieldIssue = { code: 'misaligned', path: 'x' } as const;
    const rowIssue = { code: 'modelCodeMissing', path: 'x' } as const;
    expect(reasonOfField(row('r0', [], { issues: [rowIssue] }), field({ issues: [fieldIssue] }))).toEqual({ kind: 'issue', issue: fieldIssue });
    expect(reasonOfField(row('r0', [], { issues: [rowIssue] }), field())).toEqual({ kind: 'issue', issue: rowIssue });
    expect(reasonOfField(r, field({ incoming: null }))).toEqual({ kind: 'unread' });
    expect(reasonOfField(r, field({ anchor: { kind: 'page', page: 87, regions: [CELL], verified: false } }))).toEqual({ kind: 'unverified' });
    expect(reasonOfField(r, field({ decision: 'pending' }))).toBeNull();
  });
});

describe('toneOfLine', () => {
  it('γραμμή χωρίς πεδίο = ΔΙΚΟΣ της τόνος, όχι πρόβλημα · άρνηση = πρόβλημα · αγνοημένη = απορρίφθηκε · δεμένη = αντιστοιχίστηκε', () => {
    expect(toneOfLine('pending')).toBe('unmapped');
    expect(toneOfLine('refused')).toBe('problem');
    expect(toneOfLine('ignored')).toBe('dismissed');
    expect(toneOfLine('mapped')).toBe('accepted');
    expect(toneOfLine('saving')).toBe('pending');
  });
});

describe('buildReviewBoxes', () => {
  it('ίδια περιοχή από 4 παραλλαγές ⇒ ΕΝΑ πλαίσιο με 4 στόχους, τόνος = ο χειρότερος', () => {
    const rows = ['v0', 'v1', 'v2', 'v3'].map((key, index) => row(key, [field(index === 2 ? { decision: 'pending' } : {})]));
    const boxes = buildReviewBoxes(source([proposal(rows)]));
    expect(boxes).toHaveLength(1);
    expect(boxes[0].targets).toHaveLength(4);
    expect(boxes[0].tone).toBe('pending');
  });

  it('το πρόβλημα κερδίζει το εκκρεμεί και το ✓ — δεν κρύβεται πίσω τους', () => {
    const rows = [row('v0', [field()]), row('v1', [field({ decision: 'pending' })]), row('v2', [field({ incoming: null })])];
    expect(buildReviewBoxes(source([proposal(rows)]))[0].tone).toBe('problem');
  });

  it('ο στόχος που έβαψε το πλαίσιο μπαίνει ΠΡΩΤΟΣ (τον ονομάζει η ετικέτα, τον επιλέγει το κλικ) — ίσοι κρατούν τη σειρά', () => {
    const rows = [row('v0', [field()]), row('v1', [field({ decision: 'pending' })]), row('v2', [field({ incoming: null })]), row('v3', [field({ decision: 'pending' })])];
    const [box] = buildReviewBoxes(source([proposal(rows)]));
    expect(box.targets.map((entry) => entry.target.kind === 'field' && entry.target.rowKey)).toEqual(['v2', 'v1', 'v3', 'v0']);
    expect(box.targets[0].reason).toEqual({ kind: 'unread' });
  });

  it('ενωμένη ετικέτα με ✓ πεδίο + γραμμή χωρίς πεδίο ⇒ «χωρίς πεδίο», όχι πρόβλημα — και η γραμμή μπροστά', () => {
    const boxes = buildReviewBoxes(source([proposal([row('r0', [field({ anchor: { kind: 'page', page: 87, regions: [ROW_BAND], verified: true } })])])], [line()]));
    expect(boxes).toHaveLength(1);
    expect(boxes[0].tone).toBe('unmapped');
    expect(boxes[0].targets[0].subject.kind).toBe('line');
  });

  it('γραμμή που αρνήθηκε η επανερμηνεία ⇒ πρόβλημα, με τον λόγο της άρνησης', () => {
    const refused = { ...source([], [line()]), activity: new Map([[lineKeyOf(line()), { kind: 'refused', reason: 'tablesDrifted' } as const]]) };
    const [box] = buildReviewBoxes(refused);
    expect(box.tone).toBe('problem');
    expect(box.targets[0].reason).toEqual({ kind: 'refused', refusal: 'tablesDrifted' });
  });

  it('θόρυβος float στην ίδια περιοχή ⇒ ακόμη ένα πλαίσιο', () => {
    const nudged = { ...CELL, x: CELL.x + 1e-9 };
    const rows = [row('v0', [field()]), row('v1', [field({ anchor: { kind: 'page', page: 87, regions: [nudged], verified: true } })])];
    expect(buildReviewBoxes(source([proposal(rows)]))).toHaveLength(1);
  });

  it('ο περιέκτης πριν από το περιεχόμενο ⇒ το κελί ζωγραφίζεται πάνω από τη ζώνη της γραμμής και κερδίζει το κλικ', () => {
    const boxes = buildReviewBoxes(source([proposal([row('r0', [field()])])], [line()]));
    expect(boxes.map((box) => box.targets[0].subject.kind)).toEqual(['line', 'field']);
  });

  it('χωρίς επικάλυψη: σειρά ανάγνωσης (πάνω→κάτω, αριστερά→δεξιά)', () => {
    const at = (x: number, y: number) => field({ target: target(`cattr_${x}_${y}`), anchor: { kind: 'page', page: 87, regions: [{ x, y, width: 0.05, height: 0.01 }], verified: true } });
    const boxes = buildReviewBoxes(source([proposal([row('r0', [at(0.5, 0.5), at(0.1, 0.5), at(0.9, 0.1)])])]));
    expect(boxes.map((box) => [box.region.x, box.region.y])).toEqual([[0.9, 0.1], [0.1, 0.5], [0.5, 0.5]]);
  });

  it('πεδίο χωρίς σημείο σελίδας (κελί αρχείου) και γραμμή χωρίς περιοχές ⇒ κανένα πλαίσιο, κανένα σφάλμα', () => {
    const cell = field({ anchor: { kind: 'cell', row: 2, column: 3 } });
    expect(buildReviewBoxes(source([proposal([row('r0', [cell])])], [line({ regions: [] })]))).toEqual([]);
  });
});

describe('countBoxTones', () => {
  it('πλαίσια κατά τόνο του πλαισίου · στοιχεία ΜΟΝΑΔΙΚΑ και κατά τον ΔΙΚΟ τους τόνο (μία γραμμή σε 3 πλαίσια = 1 απόφαση)', () => {
    const cells = [CELL, { ...CELL, x: 0.3 }, { ...CELL, x: 0.5 }];
    const counts = countBoxTones(buildReviewBoxes(source([proposal([row('r0', [field({ anchor: { kind: 'page', page: 87, regions: [{ ...CELL, y: 0.6 }], verified: true } })])])], [line({ regions: cells })])));
    expect(counts.unmapped).toEqual({ boxes: 3, targets: 1 });
    expect(counts.accepted).toEqual({ boxes: 1, targets: 1 });
    expect(counts.problem).toEqual({ boxes: 0, targets: 0 });
  });
});

describe('ταυτότητα στόχου', () => {
  it('ίδιο κλειδί για ΝΕΑ αντικείμενα (ξαναφόρτωμα) — και λύνεται στο νέο πεδίο', () => {
    const before = proposal([row('r0', [field()])]);
    const after = proposal([row('r0', [field()])]);
    const keyBefore = reviewTargetKey(fieldTargetOf('cipsl_1', before.rows[0], before.rows[0].fields[0]));
    const targetAfter = fieldTargetOf('cipsl_1', after.rows[0], after.rows[0].fields[0]);
    expect(reviewTargetKey(targetAfter)).toBe(keyBefore);
    const resolved = resolveReviewTarget(targetAfter, [after], []);
    expect(resolved?.kind === 'field' && resolved.field).toBe(after.rows[0].fields[0]);
  });

  it('πεδίο και γραμμή δεν συγκρούονται ποτέ σε κλειδί · στόχος που χάθηκε ⇒ null, όχι ψεύτικη επιλογή', () => {
    const p = proposal([row('r0', [field()])]);
    expect(reviewTargetKey(fieldTargetOf('cipsl_1', p.rows[0], p.rows[0].fields[0]))).not.toBe(reviewTargetKey(lineTargetOf(line())));
    expect(resolveReviewTarget({ kind: 'field', proposalId: 'cipsl_1', rowKey: 'gone', targetKey: importTargetKey(target('cattr_power')) }, [p], [])).toBeNull();
    expect(resolveReviewTarget(lineTargetOf(line()), [p], [])).toBeNull();
  });
});

describe('§5.5.2 Β8 (β): κάθε διαβασμένο κελί παίρνει πλαίσιο', () => {
  const ALT_CELL: PageRegion = { x: 0.1, y: 0.8, width: 0.1, height: 0.02 };
  const BTU_CELL: PageRegion = { x: 0.1, y: 0.5, width: 0.1, height: 0.02 };
  const at = (region: PageRegion) => ({ kind: 'page', page: 87, regions: [region], verified: true } as const);

  it('εναλλακτική ⇒ δικό της πλαίσιο, ίδιος στόχος, δικό της τυπωμένο κείμενο', () => {
    const repeated = field({ sourceText: 'MFP-34K1M-Q1AA1', issues: [{ code: 'attributeRepeated', path: 'x' }], alternatives: [{ text: '099-03-001', anchor: at(ALT_CELL) }] });
    const boxes = buildReviewBoxes(source([proposal([row('r0', [repeated])])]));
    expect(boxes).toHaveLength(2);
    const [value, alternative] = boxes;
    expect(value.targets[0]).toMatchObject({ relation: 'value', printed: 'MFP-34K1M-Q1AA1' });
    expect(alternative.targets[0]).toMatchObject({ relation: 'alternative', printed: '099-03-001', tone: 'problem' });
    expect(alternative.targets[0].key).toBe(value.targets[0].key);
  });

  it('επιβεβαίωση με θέση ⇒ πλαίσιο με τον τόνο του πεδίου· σκέτο κείμενο (παλιό σχήμα) ⇒ κανένα, ποτέ σφάλμα', () => {
    const corroborated = field({ corroboratedBy: [{ text: '6142 BTU/h', anchor: at(BTU_CELL) }, '8189 BTU/h'] });
    const boxes = buildReviewBoxes(source([proposal([row('r0', [corroborated])])]));
    expect(boxes.map((box) => box.targets[0].relation)).toEqual(['value', 'corroboration']);
    expect(boxes[1].targets[0]).toMatchObject({ printed: '6142 BTU/h', tone: 'accepted' });
  });

  it('μετρά πλαίσια, όχι νέα στοιχεία: το πεδίο μένει ΕΝΑ στοιχείο', () => {
    const corroborated = field({ corroboratedBy: [{ text: '6142 BTU/h', anchor: at(BTU_CELL) }] });
    expect(countBoxTones(buildReviewBoxes(source([proposal([row('r0', [corroborated])])]))).accepted).toEqual({ boxes: 2, targets: 1 });
  });

  it('ίδια περιοχή με τον νικητή ⇒ ένα πλαίσιο, ως τιμή', () => {
    const same = field({ corroboratedBy: [{ text: '340', anchor: at(CELL) }] });
    const boxes = buildReviewBoxes(source([proposal([row('r0', [same])])]));
    expect(boxes).toHaveLength(1);
    expect(boxes[0].targets).toHaveLength(1);
    expect(boxes[0].targets[0].relation).toBe('value');
  });
});
