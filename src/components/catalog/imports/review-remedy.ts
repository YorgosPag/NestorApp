/**
 * @fileoverview **Τι κάνεις για ένα πλαίσιο της αναθεώρησης** (ADR-923 §5.5.2 Β8 βήμα Β) — καθαρό μοντέλο «λύσης»: για κάθε στόχο,
 *   **γιατί** χρειάζεται τον άνθρωπο και **ποιες ενέργειες** το λύνουν. Το διαβάζουν το popover του PDF **και** η λίστα, ώστε να
 *   μη διαφωνούν ποτέ για το ποια κουμπιά έχει μια γραμμή (Revit Review Warnings: η αιτία **και** το κουμπί που τη λύνει).
 * @module components/catalog/imports/review-remedy
 *
 * 🔑 **Ένας κανόνας ενεργειών γραμμής** (`lineActionsOf`): ως το βήμα Β ζούσε μόνο στο `LineActions` της λίστας.
 * 🔑 **Μία πηγή τιμών «Κράτα»** (`keepValuesOf`): η τυπωμένη τιμή πρώτη, μετά οι εναλλακτικές της πηγής (βήμα Α) — **με την άγκυρά
 *    τους**, ώστε το κουμπί να δείχνει στο PDF από πού έρχεται (φάντασμα, βήμα Γ).
 * 🔑 **«Τιμή» πάντα ορατή** για όποιον τιμολογεί (βήμα Γ): χωρίς τιμοκατάλογο γίνεται «Τιμή — διάλεξε πρώτα τιμοκατάλογο», στην
 *    **ίδια** θέση. Ο server δεν ταξινομεί γραμμές τιμής· γραμμή τιμής γίνεται μόνο όταν το δηλώσει ο άνθρωπος, άρα η επιλογή δεν
 *    κρύβεται επειδή λείπει μια προϋπόθεση — δείχνει την προϋπόθεση. Και η άρνηση `priceTargetMissing` καταλήγει στο ίδιο κουμπί.
 * 🔑 Μη αποφασίσιμη πρόταση (κλειστή παρτίδα · εγκεκριμένη · σε αναβάθμιση) ⇒ **μόνο** το «γιατί», κανένα κουμπί που θα αρνιόταν.
 * 🔑 Πρόταση αποθηκευμένη πριν από τις εναλλακτικές (χωρίς `alternatives`) ⇒ «Διόρθωση»: ποτέ σιωπηλό κενό.
 */

import type { ImportProposalField, ImportSourceValue } from '@/subapps/catalog/types/catalog-import';
import type { LineState } from './import-text';
import type { LineToolMode } from './line-tool-props';
import type { ReviewBoxTarget, ReviewReason } from './review-overlay-model';

/** Ποιο εργαλείο ανοίγει μια γραμμή: ιδιότητα (Β3) ή τιμή (Β4). */
export type LineTool = LineToolMode | 'price';

export type RemedyAction =
  | { readonly kind: 'keepValue'; readonly text: string; readonly anchor: ImportSourceValue['anchor'] }
  | { readonly kind: 'editField' }
  | { readonly kind: 'lineTool'; readonly mode: LineTool }
  | { readonly kind: 'ignoreLine' }
  | { readonly kind: 'pickPriceTarget' };

/** Η αιτία — ό,τι ξέρει το πλαίσιο (`ReviewReason`), συν «χωρίς πεδίο», που **δεν** είναι πρόβλημα αλλά θέλει απόφαση. */
export type RemedyWhy = ReviewReason | { readonly kind: 'unmapped' };

export interface ReviewRemedy {
  readonly why: RemedyWhy | null;
  readonly actions: readonly RemedyAction[];
}

export interface RemedyContext {
  /** Η πρόταση του στόχου εκκρεμεί **και** η παρτίδα δέχεται αποφάσεις — η ίδια κρίση με τα κουμπιά της λίστας. */
  readonly decidable: boolean;
  /** Δικαίωμα σχήματος καταλόγου ⇒ «Νέα ιδιότητα». */
  readonly canManage: boolean;
  /** Δικαίωμα τιμολόγησης ⇒ «Τιμή» · «Διάλεξε τιμοκατάλογο». */
  readonly canPrice: boolean;
  /** Η παρτίδα έχει τιμοκατάλογο ⇒ μια γραμμή μπορεί να γίνει τιμή. */
  readonly hasPriceTarget: boolean;
}

export interface LineActionRights {
  readonly canManage: boolean;
  /** Δικαίωμα τιμολόγησης ⇒ η θέση «Τιμή» υπάρχει. */
  readonly canPrice: boolean;
  /** Η παρτίδα έχει τιμοκατάλογο ⇒ η «Τιμή» ανοίγει τον διάλογο· αλλιώς ζητά πρώτα τιμοκατάλογο. */
  readonly hasPriceTarget: boolean;
}

/** Οι ενέργειες μιας ανοιχτής γραμμής, με τη σειρά των κουμπιών — **ο ένας κανόνας** για λίστα και popover. */
export function lineActionsOf({ canManage, canPrice, hasPriceTarget }: LineActionRights): RemedyAction[] {
  const actions: RemedyAction[] = [{ kind: 'lineTool', mode: 'map' }];
  if (canManage) actions.push({ kind: 'lineTool', mode: 'new' });
  if (canPrice) actions.push(hasPriceTarget ? { kind: 'lineTool', mode: 'price' } : { kind: 'pickPriceTarget' });
  actions.push({ kind: 'ignoreLine' });
  return actions;
}

/**
 * Οι τιμές που προσφέρει το «Κράτα»: η τυπωμένη πρώτη (με την άγκυρα του πεδίου), μετά οι εναλλακτικές (με τη δική τους). Καμία
 * εναλλακτική ⇒ καμία επιλογή.
 */
export function keepValuesOf(field: Pick<ImportProposalField, 'sourceText' | 'anchor' | 'alternatives'>): ImportSourceValue[] {
  const alternatives = field.alternatives ?? [];
  return alternatives.length === 0 ? [] : [{ text: field.sourceText, anchor: field.anchor }, ...alternatives];
}

/** «Η πηγή δίνει και άλλη τιμή» — το μόνο εύρημα πεδίου με ενέργεια λύσης σήμερα. */
const isRepeated = (field: ImportProposalField): boolean => field.issues.some((issue) => issue.code === 'attributeRepeated');

function fieldActions(field: ImportProposalField): RemedyAction[] {
  if (!isRepeated(field)) return [];
  const values = keepValuesOf(field);
  return values.length === 0 ? [{ kind: 'editField' }] : values.map(({ text, anchor }) => ({ kind: 'keepValue', text, anchor }));
}

/** Γραμμή που περιμένει απόφαση (ή που η απόφασή της αρνήθηκε) — οι άλλες καταστάσεις δεν ζητούν ενέργεια εδώ. */
const OPEN_LINE_STATES: readonly LineState[] = ['pending', 'refused'];

function lineRemedy(state: LineState, reason: ReviewReason | null, ctx: RemedyContext): ReviewRemedy {
  const why: RemedyWhy | null = state === 'pending' ? { kind: 'unmapped' } : reason;
  if (!ctx.decidable || !OPEN_LINE_STATES.includes(state)) return { why, actions: [] };
  // Η άρνηση `priceTargetMissing` δεν χρειάζεται δικό της κουμπί: χωρίς τιμοκατάλογο η θέση «Τιμή» είναι ήδη «διάλεξε πρώτα».
  return { why, actions: lineActionsOf(ctx) };
}

/** Η λύση ενός στόχου πλαισίου: γιατί · τι κάνεις. */
export function remedyOf(entry: ReviewBoxTarget, ctx: RemedyContext): ReviewRemedy {
  const { subject, reason } = entry;
  if (subject.kind === 'line') return lineRemedy(subject.state, reason, ctx);
  return { why: reason, actions: ctx.decidable ? fieldActions(subject.field) : [] };
}
