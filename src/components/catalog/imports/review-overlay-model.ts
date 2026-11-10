/**
 * @fileoverview **Ο χάρτης κατάστασης πάνω στο PDF της αναθεώρησης** (ADR-923 §5.5.2 Β8) — καθαρό μοντέλο: ποιοι στόχοι
 *   (πεδία πρότασης · γραμμές πίνακα) έχουν περιοχή στη σελίδα, σε ποια κατάσταση, και πώς γίνονται **πλαίσια**.
 * @module components/catalog/imports/review-overlay-model
 *
 * 🔑 **Σταθερή ταυτότητα στόχου** (`reviewTargetKey`): η επιλογή κρατά **κλειδί**, όχι αντικείμενο. Ως το Β8 το ενεργό πεδίο
 *    κρινόταν με `field === focused`, άρα κάθε ξαναφόρτωμα της πρότασης (νέα αντικείμενα) έσβηνε σιωπηλά την επιλογή.
 * 🔑 **Ίδια περιοχή ⇒ ΕΝΑ πλαίσιο με πολλούς στόχους** (ενωμένο κελί `ΠΑΡΟΧΗ ΑΕΡΑ` = 6 στόχοι). Η κατάσταση του πλαισίου είναι
 *    η **χειρότερη** των στόχων του (`worstReviewTone`): ένα πρόβλημα δεν κρύβεται πίσω από τρία ✓. Οι στόχοι ταξινομούνται με
 *    τον ίδιο κανόνα, άρα ο **πρώτος** είναι αυτός που έβαψε το πλαίσιο: τον ονομάζει η ετικέτα, τον επιλέγει το κλικ.
 * 🔑 **Σειρά = ζωγραφική = κλικ = Tab.** Πρώτα τα πλαίσια που δεν περιέχονται σε άλλο, μετά όσα περιέχονται, και μέσα σε κάθε
 *    στρώση σειρά ανάγνωσης (πάνω→κάτω, αριστερά→δεξιά). Το περιεχόμενο ζωγραφίζεται **πάνω** από τον περιέκτη, άρα το κλικ
 *    στο μικρό κελί πάει στο κελί και όχι στη γραμμή που το περικλείει. (Κανένα από τα Rossum · Azure DI · ABBYY δεν τεκμηριώνει
 *    κανόνα επικάλυψης — δική μας απόφαση, δηλωμένη στο ADR.)
 */

import { fieldAddress } from '@/subapps/catalog/import/human-edits';
import { lineDecisionOf, lineKeyOf } from '@/subapps/catalog/import/page-line-overrides';
import { corroborationsOf, importTargetKey } from '@/subapps/catalog/import/proposal-values';
import { REVIEW_MARK_TONES, worstReviewTone, type ReviewMarkTone } from '@/subapps/catalog/import/review-marks';
import type {
  ImportIssue,
  ImportLineOverride,
  ImportPageUnmappedLine,
  ImportProposalField,
  ImportProposalRow,
  ImportSourceValue,
  PageRegion,
} from '@/subapps/catalog/types/catalog-import';
import type { ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import type { ImportLineRefusal } from '@/subapps/catalog/vocabulary/catalog-import';
import type { LineState } from './import-text';
import { lineStateOf } from './line-state';
import { bucketOf } from './proposal-summary';
import type { LineActivity } from './use-line-decisions';

// ── Ταυτότητα στόχου ─────────────────────────────────────────────────────────

export type ReviewTarget =
  | { readonly kind: 'field'; readonly proposalId: string; readonly rowKey: string; readonly targetKey: string }
  | { readonly kind: 'line'; readonly lineKey: string };

const SEP = '\u0000';

export function reviewTargetKey(target: ReviewTarget): string {
  return target.kind === 'field'
    ? ['f', target.proposalId, fieldAddress(target.rowKey, target.targetKey)].join(SEP)
    : ['l', target.lineKey].join(SEP);
}

export const fieldTargetOf = (proposalId: string, row: ImportProposalRow, field: ImportProposalField): ReviewTarget =>
  ({ kind: 'field', proposalId, rowKey: row.rowKey, targetKey: importTargetKey(field.target) });

/** Γραμμή χωρίς πεδίο **ή** αποφασισμένη γραμμή — η ταυτότητα είναι η διεύθυνσή της (σελίδα · πίνακας · γραμμή). */
export const lineTargetOf = (line: Pick<ImportPageUnmappedLine, 'page' | 'table' | 'line'>): ReviewTarget => ({ kind: 'line', lineKey: lineKeyOf(line) });

/** Ο στόχος λυμένος στα **τρέχοντα** δεδομένα — `null` αν χάθηκε (π.χ. ξαναχτίστηκε ο πίνακας και το πεδίο δεν υπάρχει πια). */
export type ResolvedReviewTarget =
  | { readonly kind: 'field'; readonly proposal: ImportProposalWire; readonly row: ImportProposalRow; readonly field: ImportProposalField }
  | { readonly kind: 'line'; readonly line: ImportPageUnmappedLine };

export function resolveReviewTarget(
  target: ReviewTarget | null,
  proposals: readonly ImportProposalWire[],
  lines: readonly ImportPageUnmappedLine[],
): ResolvedReviewTarget | null {
  if (target === null) return null;
  if (target.kind === 'line') {
    const line = lines.find((candidate) => lineKeyOf(candidate) === target.lineKey);
    return line ? { kind: 'line', line } : null;
  }
  const proposal = proposals.find((candidate) => candidate.id === target.proposalId);
  const row = proposal?.rows.find((candidate) => candidate.rowKey === target.rowKey);
  const field = row?.fields.find((candidate) => importTargetKey(candidate.target) === target.targetKey);
  return proposal && row && field ? { kind: 'field', proposal, row, field } : null;
}

// ── Κατάσταση ────────────────────────────────────────────────────────────────

/**
 * **Γιατί** ένας στόχος είναι πρόβλημα — η αιτία ταξιδεύει με το πλαίσιο ώς το `aria-label`, ώστε το «Πρόβλημα» να μη λέει
 * ποτέ μόνο «κάτι δεν πάει καλά» (Rossum: ο λόγος του «automation blocker» δίπλα στην τιμή).
 */
export type ReviewReason =
  | { readonly kind: 'issue'; readonly issue: ImportIssue }
  | { readonly kind: 'unread' }
  | { readonly kind: 'unverified' }
  | { readonly kind: 'refused'; readonly refusal: ImportLineRefusal };

/**
 * Πρόβλημα = κάτι που ο άνθρωπος πρέπει να **δει**, όχι απλώς να αποφασίσει: εύρημα στο πεδίο ή στη γραμμή του, τιμή που δεν
 * διαβάστηκε, ή τιμή που η στρώση κειμένου **διέψευσε** (`verified === false`). Το εύρημα του πεδίου προηγείται του ευρήματος
 * της γραμμής: είναι το πιο συγκεκριμένο.
 */
export function reasonOfField(row: ImportProposalRow, field: ImportProposalField): ReviewReason | null {
  const issue = field.issues[0] ?? row.issues[0];
  if (issue) return { kind: 'issue', issue };
  if (field.incoming === null) return { kind: 'unread' };
  return field.anchor?.kind === 'page' && field.anchor.verified === false ? { kind: 'unverified' } : null;
}

/** Αιτία ⇒ πρόβλημα· αλλιώς ο κάδος της σύνοψης (`bucketOf`). */
export function toneOfField(row: ImportProposalRow, field: ImportProposalField): ReviewMarkTone {
  if (reasonOfField(row, field) !== null) return 'problem';
  const bucket = bucketOf(field);
  if (bucket === 'pending') return 'pending';
  return bucket === 'rejected' ? 'dismissed' : 'accepted';
}

/**
 * Γραμμή **χωρίς πεδίο** = δικός της τόνος, **όχι** πρόβλημα: η τιμή διαβάστηκε σωστά, απλώς η οικογένεια δεν έχει ιδιότητα να
 * τη δεχτεί (live 2026-11-10: 56 από τα 61 κόκκινα της σελ. 87). Πρόβλημα μένει η **άρνηση** της επανερμηνείας.
 * Αγνοημένη = απορρίφθηκε· σε αποθήκευση = εκκρεμεί.
 */
const LINE_TONES: Readonly<Record<LineState, ReviewMarkTone>> = {
  pending: 'unmapped',
  refused: 'problem',
  saving: 'pending',
  mapped: 'accepted',
  ignored: 'dismissed',
};

export const toneOfLine = (state: LineState): ReviewMarkTone => LINE_TONES[state];

// ── Πλαίσια ──────────────────────────────────────────────────────────────────

/**
 * §5.5.2 Β8 (β): **ποιο** κελί του πεδίου είναι αυτό το πλαίσιο. Κάθε κελί που διαβάστηκε παίρνει πλαίσιο, όχι μόνο ο νικητής
 * (Azure DI: πεδίο με **πίνακα** περιοχών · Rossum: hover στο πλαίσιο λέει σε ποιο πεδίο ανήκει):
 *   - `value`: το κελί που έδωσε την τιμή·
 *   - `alternative`: λέει **άλλο** για το ίδιο πεδίο — ο ίδιος στόχος, άρα το ίδιο popover με «Κράτα «…»»·
 *   - `corroboration`: λέει **το ίδιο** σε άλλη μονάδα (Btu/h) — δεν ζητά απόφαση, αλλά δεν μένει πια αόρατο.
 * Σχέση, **όχι** τόνος: ο τόνος είναι του πεδίου (το CHECK 3.41 κρίνει μόνο τους τόνους)· η σχέση ταξιδεύει ώς το `aria-label`.
 */
export type ReviewRelation = 'value' | 'alternative' | 'corroboration';

export interface ReviewBoxTarget {
  readonly target: ReviewTarget;
  readonly key: string;
  readonly relation: ReviewRelation;
  readonly tone: ReviewMarkTone;
  /** Η αιτία του προβλήματος (`null` όταν ο τόνος δεν είναι πρόβλημα). */
  readonly reason: ReviewReason | null;
  /** Ό,τι χρειάζεται η οθόνη για να το ονομάσει (η ετικέτα πεδίου λύνεται στην οθόνη, από τη βιβλιοθήκη ιδιοτήτων). */
  readonly subject:
    | { readonly kind: 'field'; readonly field: ImportProposalField }
    /** Η κατάσταση της γραμμής ταξιδεύει μαζί της (§5.5.2 Β8 βήμα Β): από αυτήν κρίνει το `remedyOf` ποιες ενέργειες ισχύουν. */
    | { readonly kind: 'line'; readonly label: string; readonly state: LineState };
  /** Το κείμενο **αυτού** του κελιού όπως τυπώθηκε στο PDF (στην εναλλακτική ή την επιβεβαίωση: το δικό της, όχι του νικητή). */
  readonly printed: string;
}

export interface ReviewBox {
  readonly id: string;
  readonly page: number;
  readonly region: PageRegion;
  readonly tone: ReviewMarkTone;
  /** Ταξινομημένοι κατά τόνο (`REVIEW_MARK_TONES`): ο **πρώτος** είναι αυτός που αποφασίζει το χρώμα — τον ονομάζει η ετικέτα, τον επιλέγει το κλικ. */
  readonly targets: readonly ReviewBoxTarget[];
}

interface ReviewOverlaySource {
  readonly proposals: readonly ImportProposalWire[];
  readonly lines: readonly ImportPageUnmappedLine[];
  readonly overrides: readonly ImportLineOverride[] | undefined;
  readonly activity: ReadonlyMap<string, LineActivity>;
}

/** Ακρίβεια ταυτότητας περιοχής: 1/10.000 της σελίδας ⇒ ίδιο κελί από δύο πεδία = ίδιο κλειδί, ακόμη και με θόρυβο float. */
const REGION_PRECISION = 10_000;
const regionId = (page: number, region: PageRegion): string =>
  [page, region.x, region.y, region.width, region.height].map((n) => Math.round(n * REGION_PRECISION)).join(':');

interface Placed { readonly page: number; readonly region: PageRegion; readonly entry: ReviewBoxTarget }

/** Τα κελιά ενός πεδίου με τη σχέση τους: ο νικητής πρώτος, ώστε σε κοινή περιοχή να κρατηθεί αυτός (`buildReviewBoxes`). */
const fieldSources = (field: ImportProposalField): readonly { readonly relation: ReviewRelation; readonly source: ImportSourceValue }[] => [
  { relation: 'value', source: { text: field.sourceText, anchor: field.anchor } },
  ...(field.alternatives ?? []).map((source) => ({ relation: 'alternative' as const, source })),
  ...corroborationsOf(field).map((source) => ({ relation: 'corroboration' as const, source })),
];

/** Κάθε διαβασμένο κελί του πεδίου γίνεται πλαίσιο του **ίδιου** στόχου: κλικ οπουδήποτε ⇒ το ίδιο πεδίο, η ίδια επιλογή. */
function fieldPlacements(proposalId: string, row: ImportProposalRow, field: ImportProposalField): Placed[] {
  const target = fieldTargetOf(proposalId, row, field);
  const base = { target, key: reviewTargetKey(target), tone: toneOfField(row, field), reason: reasonOfField(row, field), subject: { kind: 'field', field } } as const;
  return fieldSources(field).flatMap(({ relation, source }) => {
    const { anchor } = source;
    if (anchor?.kind !== 'page') return [];
    const entry: ReviewBoxTarget = { ...base, relation, printed: source.text };
    return anchor.regions.map((region) => ({ page: anchor.page, region, entry }));
  });
}

function placedFields(proposal: ImportProposalWire): Placed[] {
  return proposal.rows.flatMap((row) => row.fields.flatMap((field) => fieldPlacements(proposal.id, row, field)));
}

function placedLines({ lines, overrides, activity }: ReviewOverlaySource): Placed[] {
  return lines.flatMap((line) => {
    const target = lineTargetOf(line);
    const key = reviewTargetKey(target);
    const now = activity.get(lineKeyOf(line));
    const state = lineStateOf(now, lineDecisionOf(overrides, line));
    const reason: ReviewReason | null = now?.kind === 'refused' ? { kind: 'refused', refusal: now.reason } : null;
    const entry: ReviewBoxTarget = {
      target, key, relation: 'value', tone: toneOfLine(state), reason, subject: { kind: 'line', label: line.label, state }, printed: line.values.join(' · '),
    };
    return (line.regions ?? []).map((region) => ({ page: line.page, region, entry }));
  });
}

const contains = (outer: PageRegion, inner: PageRegion): boolean => outer !== inner
  && outer.x <= inner.x && outer.y <= inner.y
  && outer.x + outer.width >= inner.x + inner.width && outer.y + outer.height >= inner.y + inner.height
  && outer.width * outer.height > inner.width * inner.height;

/** Βάθος περιοχής = πόσα άλλα πλαίσια της ίδιας σελίδας την περιέχουν. Ταξινόμηση: βάθος ↑, μετά σειρά ανάγνωσης. */
function orderBoxes(boxes: readonly ReviewBox[]): ReviewBox[] {
  const depth = new Map(boxes.map((box) => [box.id, boxes.filter((other) => other.page === box.page && contains(other.region, box.region)).length]));
  return [...boxes].sort((a, b) => a.page - b.page
    || (depth.get(a.id) ?? 0) - (depth.get(b.id) ?? 0)
    || a.region.y - b.region.y
    || a.region.x - b.region.x);
}

const toneRank = (tone: ReviewMarkTone): number => REVIEW_MARK_TONES.indexOf(tone);

/** Ο χειρότερος τόνος μπροστά (σταθερή ταξινόμηση: ίσοι τόνοι κρατούν τη σειρά της πηγής). */
const byTone = (entries: readonly ReviewBoxTarget[]): ReviewBoxTarget[] => [...entries].sort((a, b) => toneRank(a.tone) - toneRank(b.tone));

/** Όλα τα πλαίσια της παρτίδας. Ένας στόχος με περισσότερες περιοχές (πεδίο σε δύο κελιά) εμφανίζεται σε καθεμία. */
export function buildReviewBoxes(source: ReviewOverlaySource): ReviewBox[] {
  const grouped = new Map<string, { page: number; region: PageRegion; entries: ReviewBoxTarget[] }>();
  for (const placed of [...source.proposals.flatMap(placedFields), ...placedLines(source)]) {
    const id = regionId(placed.page, placed.region);
    const group = grouped.get(id) ?? { page: placed.page, region: placed.region, entries: [] };
    if (!group.entries.some((entry) => entry.key === placed.entry.key)) group.entries.push(placed.entry);
    grouped.set(id, group);
  }
  return orderBoxes([...grouped].map(([id, { page, region, entries }]) => ({
    id, page, region, targets: byTone(entries), tone: worstReviewTone(entries.map((entry) => entry.tone)),
  })));
}

/** Ανά κατάσταση: πόσα **πλαίσια** βλέπει ο άνθρωπος, και πόσα **στοιχεία** (πεδία · γραμμές) κρύβονται πίσω τους. */
export interface ReviewToneCount {
  readonly boxes: number;
  readonly targets: number;
}

/**
 * Για το υπόμνημα. Τα στοιχεία μετρούν **μοναδικά** και κατά τον **δικό τους** τόνο: μια γραμμή χωρίς πεδίο με 5 πλαίσια
 * (ετικέτα + 4 τιμές) είναι **μία** απόφαση — «Χωρίς πεδίο 56 · 11 στοιχεία», όπως η λίστα λέει «11 γραμμές».
 */
export function countBoxTones(boxes: readonly ReviewBox[]): Readonly<Record<ReviewMarkTone, ReviewToneCount>> {
  const seen = new Map<ReviewMarkTone, Set<string>>(REVIEW_MARK_TONES.map((tone) => [tone, new Set<string>()]));
  const boxCounts = new Map<ReviewMarkTone, number>(REVIEW_MARK_TONES.map((tone) => [tone, 0]));
  for (const box of boxes) {
    boxCounts.set(box.tone, (boxCounts.get(box.tone) ?? 0) + 1);
    for (const entry of box.targets) seen.get(entry.tone)?.add(entry.key);
  }
  const countOf = (tone: ReviewMarkTone): ReviewToneCount => ({ boxes: boxCounts.get(tone) ?? 0, targets: seen.get(tone)?.size ?? 0 });
  // Κυριολεκτικό αντικείμενο, όχι `Object.fromEntries`: ο `Record` σπάει τη μεταγλώττιση αν προστεθεί τόνος και λείψει εδώ.
  return { problem: countOf('problem'), unmapped: countOf('unmapped'), pending: countOf('pending'), accepted: countOf('accepted'), dismissed: countOf('dismissed') };
}
