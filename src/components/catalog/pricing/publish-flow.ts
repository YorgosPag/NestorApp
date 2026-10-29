/**
 * **Η δημοσίευση μιας έκδοσης τιμών, ως μηχανή καταστάσεων** — καθαρό μοντέλο (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @related subapps/catalog/pricing/version-timeline.ts (`judgeVersionPublication` — η ΙΔΙΑ κρίση με τον διακομιστή) ·
 *   subapps/catalog/pricing/diff-price-versions.ts (η διαφορά) · server/catalog/price-publication.server.ts (ο γραφέας)
 * @module components/catalog/pricing/publish-flow
 *
 * ```
 * schedule ──(ημερομηνία κρίθηκε)──▶ saving? ──▶ previewing ──▶ review ──(επιβεβαίωση αν φράχτης)──▶ publishing ──▶ published
 *    ▲                                              ▲                                                    │
 *    └──────── changedMeanwhile (409 CAS) ──────────┼──────────── fenceChanged (409 φράχτη) ◀─────────────┘
 * ```
 *
 * 🔑 **Καμία σιωπηλή αποστολή** (SAP: η αλλαγή πάνω από το όριο ζητά ρητή επιβεβαίωση): με φραγμένη διαφορά το «Δημοσίευση»
 *    ανοίγει **μόνο** με ρητό «Επιβεβαιώνω», και στέλνει **το αποτύπωμα που είδε** ο άνθρωπος. Αν ο διακομιστής μετρήσει
 *    **άλλη** φραγμένη διαφορά (409 `confirmationRequired`), η επιβεβαίωση **σβήνει** και ξαναφορτώνεται η προεπισκόπηση.
 * 🔑 **Αλλαγή άλλου στο μεταξύ** (409 `revisionMismatch`: έκδοση, γραμμές ή άλλη δημοσίευση) ⇒ πίσω στην αρχή με ειδοποίηση:
 *    η ημερομηνία και η διαφορά που είδε ο άνθρωπος δεν ισχύουν πια — ποτέ «ξαναδοκίμασε με τα νέα» πίσω από την πλάτη του.
 * 🔑 Η αναθεώρηση της έκδοσης **ταξιδεύει** μέσα στη μηχανή: μετά το «ισχύει από» (CAS) η δημοσίευση στέλνει τη **νέα**.
 */

import type { CatalogFailure } from '@/services/catalog/catalog-failure';
import type { PriceLineChange } from '@/subapps/catalog/pricing/diff-price-versions';
import type { CatalogIssueCode } from '@/subapps/catalog/schema/catalog-issues';
import type { PricePublicationPreview, PublishPriceVersionRequest } from '@/subapps/catalog/types/price-list-requests';

/** Γιατί ο άνθρωπος βλέπει ξανά ένα βήμα που είχε περάσει. */
export type PublishNotice = 'fenceChanged' | 'changedMeanwhile';

export type PublishFlow =
  | { readonly step: 'schedule'; readonly revision: number; readonly issue: CatalogIssueCode | null; readonly notice: PublishNotice | null }
  | { readonly step: 'saving'; readonly revision: number }
  | { readonly step: 'previewing'; readonly revision: number; readonly notice: PublishNotice | null }
  | {
      readonly step: 'review';
      readonly revision: number;
      readonly preview: PricePublicationPreview;
      readonly confirmed: boolean;
      readonly notice: PublishNotice | null;
    }
  | { readonly step: 'publishing'; readonly revision: number; readonly preview: PricePublicationPreview }
  | { readonly step: 'published' }
  | { readonly step: 'failed'; readonly revision: number; readonly failure: CatalogFailure };

export type PublishEvent =
  /** Ο άνθρωπος όρισε «ισχύει από»: `issue` = η κρίση `judgeVersionPublication`· `needsSave` = διαφέρει από την αποθηκευμένη. */
  | { readonly type: 'schedule'; readonly issue: CatalogIssueCode | null; readonly needsSave: boolean }
  | { readonly type: 'saved'; readonly revision: number }
  | { readonly type: 'previewLoaded'; readonly preview: PricePublicationPreview }
  | { readonly type: 'confirm'; readonly confirmed: boolean }
  | { readonly type: 'submit' }
  | { readonly type: 'published' }
  | { readonly type: 'failed'; readonly failure: CatalogFailure }
  /** Νέα αρχή πάνω στη **ζωντανή** έκδοση (μετά από αλλαγή άλλου ή αποτυχία). */
  | { readonly type: 'restart'; readonly revision: number; readonly notice: PublishNotice | null };

export function startPublishFlow(revision: number, notice: PublishNotice | null = null): PublishFlow {
  return { step: 'schedule', revision, issue: null, notice };
}

/** Χρειάζεται ρητή επιβεβαίωση; — μόνο όταν κάποια γραμμή πέρασε τον φράχτη (ο διακομιστής δίνει αποτύπωμα). */
export const needsConfirmation = (preview: PricePublicationPreview): boolean => preview.diffDigest !== null;

function onSchedule(flow: PublishFlow, event: Extract<PublishEvent, { type: 'schedule' }>): PublishFlow {
  if (flow.step !== 'schedule') return flow;
  if (event.issue !== null) return { ...flow, issue: event.issue };
  return event.needsSave ? { step: 'saving', revision: flow.revision } : { step: 'previewing', revision: flow.revision, notice: flow.notice };
}

/**
 * Η άρνηση της δημοσίευσης: άλλος φράχτης ⇒ νέα προεπισκόπηση (η επιβεβαίωση σβήνει) · αλλιώς αποτυχία — το CAS
 * (`revisionMismatch`) το διαβάζει το {@link isChangedMeanwhile} και ζητά νέα αρχή πάνω στη ζωντανή έκδοση.
 */
function onPublishFailed(flow: Extract<PublishFlow, { step: 'publishing' }>, failure: CatalogFailure): PublishFlow {
  if (failure.kind === 'confirmationRequired' && failure.fence !== null) {
    return { step: 'previewing', revision: flow.revision, notice: 'fenceChanged' };
  }
  return { step: 'failed', revision: flow.revision, failure };
}

function onFailed(flow: PublishFlow, failure: CatalogFailure): PublishFlow {
  if (flow.step === 'publishing') return onPublishFailed(flow, failure);
  if (flow.step === 'saving' || flow.step === 'previewing') return { step: 'failed', revision: flow.revision, failure };
  return flow;
}

export function publishFlowReducer(flow: PublishFlow, event: PublishEvent): PublishFlow {
  switch (event.type) {
    case 'schedule':
      return onSchedule(flow, event);
    case 'saved':
      return flow.step === 'saving' ? { step: 'previewing', revision: event.revision, notice: null } : flow;
    case 'previewLoaded':
      return flow.step === 'previewing' ? { step: 'review', revision: flow.revision, preview: event.preview, confirmed: false, notice: flow.notice } : flow;
    case 'confirm':
      return flow.step === 'review' ? { ...flow, confirmed: event.confirmed } : flow;
    case 'submit':
      return canPublish(flow) && flow.step === 'review' ? { step: 'publishing', revision: flow.revision, preview: flow.preview } : flow;
    case 'published':
      return flow.step === 'publishing' ? { step: 'published' } : flow;
    case 'failed':
      return onFailed(flow, event.failure);
    case 'restart':
      return startPublishFlow(event.revision, event.notice);
  }
}

/** Το «Δημοσίευση» ανοίγει; — μόνο σε προεπισκόπηση, και με επιβεβαίωση όταν υπάρχει φράχτης. */
export function canPublish(flow: PublishFlow): boolean {
  return flow.step === 'review' && (!needsConfirmation(flow.preview) || flow.confirmed);
}

/** Το αίτημα δημοσίευσης **της προεπισκόπησης που είδε** ο άνθρωπος — `null` αν δεν επιτρέπεται ακόμη. */
export function publishRequestOf(flow: PublishFlow): PublishPriceVersionRequest | null {
  if (flow.step !== 'publishing') return null;
  const { preview } = flow;
  return {
    expectedRevision: flow.revision,
    expectedLinesRevision: preview.linesRevision,
    confirmedDiffDigest: needsConfirmation(preview) ? preview.diffDigest : null,
  };
}

/** Η αλλαγή «άλλαξε από άλλον» ζητά νέα αρχή πάνω στη ζωντανή έκδοση (όχι απλή επανάληψη). */
export const isChangedMeanwhile = (flow: PublishFlow): boolean => flow.step === 'failed' && flow.failure.kind === 'revisionMismatch';

const KIND_ORDER: Readonly<Record<PriceLineChange['kind'], number>> = { changed: 0, added: 1, removed: 2 };

/** Η σειρά της διαφοράς στην οθόνη: **φραγμένες πρώτες**, μετά αλλαγές · νέες · αφαιρέσεις, μετά κατά υποκείμενο. */
export function orderedChanges(changes: readonly PriceLineChange[]): readonly PriceLineChange[] {
  return [...changes].sort(
    (a, b) =>
      Number(b.exceedsFence) - Number(a.exceedsFence) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.subjectKey.localeCompare(b.subjectKey),
  );
}

/** Πόσες μη φραγμένες αλλαγές δείχνει η προεπισκόπηση πριν από το «και N ακόμη» (οι φραγμένες φαίνονται ΠΑΝΤΑ όλες). */
export const UNFENCED_PREVIEW_LIMIT = 200;

/**
 * Τι φαίνεται στην προεπισκόπηση: **κάθε** φραγμένη (ο άνθρωπος επιβεβαιώνει ό,τι βλέπει — ποτέ «επιβεβαιώνω 600» με 200
 * ορατές) και ως `limit` από τις υπόλοιπες· `hidden` = πόσες δεν φαίνονται, ώστε η οθόνη να το λέει.
 */
export function visibleChanges(changes: readonly PriceLineChange[], limit: number = UNFENCED_PREVIEW_LIMIT) {
  const ordered = orderedChanges(changes);
  const fenced = ordered.filter((change) => change.exceedsFence);
  const rest = ordered.filter((change) => !change.exceedsFence);
  return { shown: [...fenced, ...rest.slice(0, limit)], hidden: Math.max(0, rest.length - limit) };
}

/** Πόσες γραμμές ανά είδος αλλαγής — για τη σύνοψη «+3 · −1 · 12 αλλαγές». */
export function changeCounts(changes: readonly PriceLineChange[]): Readonly<Record<PriceLineChange['kind'], number>> {
  const counts = { added: 0, removed: 0, changed: 0 };
  for (const change of changes) counts[change.kind]++;
  return counts;
}
