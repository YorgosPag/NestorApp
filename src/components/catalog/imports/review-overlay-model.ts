/**
 * @fileoverview **Ο χάρτης κατάστασης πάνω στο PDF της αναθεώρησης** (ADR-923 §5.5.2 Β8) — καθαρό μοντέλο: ποιοι στόχοι
 *   (πεδία πρότασης · γραμμές πίνακα) έχουν περιοχή στη σελίδα, σε ποια κατάσταση, και πώς γίνονται **πλαίσια**.
 * @module components/catalog/imports/review-overlay-model
 *
 * 🔑 **Σταθερή ταυτότητα στόχου** (`reviewTargetKey`): η επιλογή κρατά **κλειδί**, όχι αντικείμενο. Ως το Β8 το ενεργό πεδίο
 *    κρινόταν με `field === focused`, άρα κάθε ξαναφόρτωμα της πρότασης (νέα αντικείμενα) έσβηνε σιωπηλά την επιλογή.
 * 🔑 **Ίδια περιοχή ⇒ ΕΝΑ πλαίσιο με πολλούς στόχους** (ενωμένο κελί `MB-SA11A1` = 4 παραλλαγές). Η κατάσταση του πλαισίου είναι
 *    η **χειρότερη** των στόχων του (`worstReviewTone`): ένα πρόβλημα δεν κρύβεται πίσω από τρία ✓.
 * 🔑 **Σειρά = ζωγραφική = κλικ = Tab.** Πρώτα τα πλαίσια που δεν περιέχονται σε άλλο, μετά όσα περιέχονται, και μέσα σε κάθε
 *    στρώση σειρά ανάγνωσης (πάνω→κάτω, αριστερά→δεξιά). Το περιεχόμενο ζωγραφίζεται **πάνω** από τον περιέκτη, άρα το κλικ
 *    στο μικρό κελί πάει στο κελί και όχι στη γραμμή που το περικλείει. (Κανένα από τα Rossum · Azure DI · ABBYY δεν τεκμηριώνει
 *    κανόνα επικάλυψης — δική μας απόφαση, δηλωμένη στο ADR.)
 */

import { fieldAddress } from '@/subapps/catalog/import/human-edits';
import { lineDecisionOf, lineKeyOf } from '@/subapps/catalog/import/page-line-overrides';
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import { worstReviewTone, type ReviewMarkTone } from '@/subapps/catalog/import/review-marks';
import type { ImportLineOverride, ImportPageUnmappedLine, ImportProposalField, ImportProposalRow, PageRegion } from '@/subapps/catalog/types/catalog-import';
import type { ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
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
 * Πρόβλημα = κάτι που ο άνθρωπος πρέπει να **δει**, όχι απλώς να αποφασίσει: εύρημα στο πεδίο ή στη γραμμή του, τιμή που δεν
 * διαβάστηκε, ή τιμή που η στρώση κειμένου **διέψευσε** (`verified === false`). Αλλιώς ο κάδος της σύνοψης (`bucketOf`).
 */
export function toneOfField(row: ImportProposalRow, field: ImportProposalField): ReviewMarkTone {
  const unverified = field.anchor?.kind === 'page' && field.anchor.verified === false;
  if (field.issues.length > 0 || row.issues.length > 0 || field.incoming === null || unverified) return 'problem';
  const bucket = bucketOf(field);
  if (bucket === 'pending') return 'pending';
  return bucket === 'rejected' ? 'dismissed' : 'accepted';
}

/** Γραμμή **χωρίς πεδίο** = πρόβλημα (η προδιαγραφή: «χωρίς αντιστοίχιση»)· αγνοημένη = απορρίφθηκε· σε αποθήκευση = εκκρεμεί. */
const LINE_TONES: Readonly<Record<LineState, ReviewMarkTone>> = {
  pending: 'problem',
  refused: 'problem',
  saving: 'pending',
  mapped: 'accepted',
  ignored: 'dismissed',
};

export const toneOfLine = (state: LineState): ReviewMarkTone => LINE_TONES[state];

// ── Πλαίσια ──────────────────────────────────────────────────────────────────

export interface ReviewBoxTarget {
  readonly target: ReviewTarget;
  readonly key: string;
  readonly tone: ReviewMarkTone;
  /** Ό,τι χρειάζεται η οθόνη για να το ονομάσει (η ετικέτα πεδίου λύνεται στην οθόνη, από τη βιβλιοθήκη ιδιοτήτων). */
  readonly subject: { readonly kind: 'field'; readonly field: ImportProposalField } | { readonly kind: 'line'; readonly label: string };
  /** Το κείμενο όπως τυπώθηκε στο PDF. */
  readonly printed: string;
}

export interface ReviewBox {
  readonly id: string;
  readonly page: number;
  readonly region: PageRegion;
  readonly tone: ReviewMarkTone;
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

function placedFields(proposal: ImportProposalWire): Placed[] {
  return proposal.rows.flatMap((row) => row.fields.flatMap((field) => {
    const anchor = field.anchor;
    if (anchor?.kind !== 'page') return [];
    const target = fieldTargetOf(proposal.id, row, field);
    const entry: ReviewBoxTarget = { target, key: reviewTargetKey(target), tone: toneOfField(row, field), subject: { kind: 'field', field }, printed: field.sourceText };
    return anchor.regions.map((region) => ({ page: anchor.page, region, entry }));
  }));
}

function placedLines({ lines, overrides, activity }: ReviewOverlaySource): Placed[] {
  return lines.flatMap((line) => {
    const target = lineTargetOf(line);
    const key = reviewTargetKey(target);
    const tone = toneOfLine(lineStateOf(activity.get(lineKeyOf(line)), lineDecisionOf(overrides, line)));
    const entry: ReviewBoxTarget = { target, key, tone, subject: { kind: 'line', label: line.label }, printed: line.values.join(' · ') };
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
    id, page, region, targets: entries, tone: worstReviewTone(entries.map((entry) => entry.tone)),
  })));
}

/** Πόσα πλαίσια ανά κατάσταση — για το υπόμνημα. */
export function countBoxTones(boxes: readonly ReviewBox[]): Readonly<Record<ReviewMarkTone, number>> {
  const counts: Record<ReviewMarkTone, number> = { problem: 0, pending: 0, accepted: 0, dismissed: 0 };
  for (const box of boxes) counts[box.tone] += 1;
  return counts;
}
