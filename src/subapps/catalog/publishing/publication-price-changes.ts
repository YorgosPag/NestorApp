/**
 * **«Τι άλλαξε» ανάμεσα σε δύο εκδόσεις τιμών** (ADR-923 §5.7 · §5.6.1): καθαρό, πάνω στη διαφορά της Φάσης 3.
 *
 * 🔑 Καμία δεύτερη μηχανή: οι γραμμές ταιριάζονται και κρίνονται από το `diffPriceVersions`, με τον ίδιο φράχτη (§18).
 * 🔒 Τα ποσά έρχονται από τον επιλυτή του κοινού της έκδοσης, όχι από τη γραμμή: ο πίνακας δεν τυπώνει ποτέ άλλη τιμή από τις σελίδες,
 *    και το κοινό «χονδρική» δεν βλέπει το ποσό της λίστας πριν από την έκπτωσή του.
 * 🔑 Οι ομάδες είναι του Coupa: νέα, καταργήσεις, αυξήσεις, μειώσεις. Αλλαγή που δεν φτάνει στην τιμή του κοινού δεν τυπώνεται.
 * @module subapps/catalog/publishing/publication-price-changes
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { MinorAmount } from '@/lib/money/money';
import { unitPriceChangeBp, type PriceVersionDiff } from '../pricing/diff-price-versions';
import { formatPublicationChange, formatPublicationPrice, withBreakHints } from './layout-text';
import type { PriceChangeGroup, PriceChangesEntry } from './publication-entries';

export const PUBLICATION_CHANGE_KINDS = ['added', 'removed', 'raised', 'lowered'] as const;
export type PublicationChangeKind = (typeof PUBLICATION_CHANGE_KINDS)[number];

/** Η τιμή ενός SKU για το κοινό της έκδοσης· `null` ⇒ δεν έχει τιμή για αυτό το κοινό. */
export interface PublicationQuote {
  readonly netPrice: MinorAmount;
  readonly priceQuantity: number;
}

export type PublicationQuoter = (variantId: string) => PublicationQuote | null;

export interface PublicationPriceChange {
  readonly kind: PublicationChangeKind;
  readonly variantId: string;
  readonly before: PublicationQuote | null;
  readonly after: PublicationQuote | null;
  /** Μεταβολή ανά μονάδα, στην τιμή του κοινού. */
  readonly changeBp: number | null;
  /** Ο φράχτης της δημοσίευσης (§18): η γραμμή κρατήθηκε για επιβεβαίωση. */
  readonly fenced: boolean;
}

function directionOf(before: PublicationQuote, after: PublicationQuote): { readonly kind: PublicationChangeKind; readonly changeBp: number | null } | null {
  const changeBp = unitPriceChangeBp(before, after);
  if (changeBp === 0) return null;
  // `null` = από μηδέν: η τιμή ανέβηκε, απλώς το ποσοστό δεν ορίζεται.
  return { kind: changeBp === null || changeBp > 0 ? 'raised' : 'lowered', changeBp };
}

/** Από τη διαφορά των γραμμών στις αλλαγές που βλέπει **αυτό** το κοινό. Μόνο SKU: οι γραμμές κόστους δεν τυπώνονται. */
export function publicationPriceChanges(diff: PriceVersionDiff, quoteBefore: PublicationQuoter, quoteAfter: PublicationQuoter): readonly PublicationPriceChange[] {
  return diff.changes.flatMap((change): PublicationPriceChange[] => {
    const subject = change.after?.subject ?? change.before?.subject;
    if (subject?.kind !== 'variant') return [];
    const { variantId } = subject;
    const base = { variantId, fenced: change.exceedsFence };
    if (change.kind === 'added') return [{ ...base, kind: 'added', before: null, after: quoteAfter(variantId), changeBp: null }];
    if (change.kind === 'removed') return [{ ...base, kind: 'removed', before: quoteBefore(variantId), after: null, changeBp: null }];
    const before = quoteBefore(variantId);
    const after = quoteAfter(variantId);
    const direction = before && after ? directionOf(before, after) : null;
    return direction ? [{ ...base, ...direction, before, after }] : [];
  });
}

export interface PriceChangeWords {
  readonly title: string;
  readonly groups: Readonly<Record<PublicationChangeKind, string>>;
  readonly before: string;
  readonly after: string;
  readonly change: string;
  readonly noPrice: string;
}

export interface PriceChangeInput {
  readonly changes: readonly PublicationPriceChange[];
  /** Κωδικός και όνομα μόνο όσων ανήκουν στο εύρος της έκδοσης: ό,τι λείπει δεν τυπώνεται. */
  readonly names: ReadonlyMap<string, { readonly code: string | null; readonly label: string | null }>;
  readonly words: PriceChangeWords;
  readonly language: HumanLanguage;
}

/** Οι στήλες κάθε ομάδας. Η νέα γραμμή έχει μόνο τη νέα τιμή, η κατάργηση μόνο την τελευταία. */
function columnsOf(kind: PublicationChangeKind, words: PriceChangeWords): readonly string[] {
  if (kind === 'added') return [words.after];
  if (kind === 'removed') return [words.before];
  return [words.before, words.after, words.change];
}

function cellsOf(change: PublicationPriceChange, input: PriceChangeInput): readonly string[] {
  const price = (quote: PublicationQuote | null) => (quote ? formatPublicationPrice(quote.netPrice, input.language) : input.words.noPrice);
  if (change.kind === 'added') return [price(change.after)];
  if (change.kind === 'removed') return [price(change.before)];
  return [price(change.before), price(change.after), change.changeBp === null ? '—' : formatPublicationChange(change.changeBp, input.language)];
}

function groupOf(kind: PublicationChangeKind, input: PriceChangeInput): PriceChangeGroup | null {
  const rows = input.changes.flatMap((change) => {
    const name = change.kind === kind ? input.names.get(change.variantId) : undefined;
    if (!name) return [];
    const label = [name.code, name.label === name.code ? null : name.label].filter(Boolean).join(' · ');
    return [{ id: change.variantId, sortKey: name.code ?? name.label ?? change.variantId, label: withBreakHints(label), cells: cellsOf(change, input) }];
  });
  if (rows.length === 0) return null;
  const ordered = [...rows].sort((a, b) => a.sortKey.localeCompare(b.sortKey, input.language, { numeric: true }) || a.id.localeCompare(b.id));
  return { id: kind, title: input.words.groups[kind], columns: columnsOf(kind, input.words), rows: ordered.map(({ id, label, cells }) => ({ id, label, cells })) };
}

/** Η σελίδα της σύγκρισης, ή `null` όταν δεν άλλαξε τίποτα μέσα στο εύρος: κενή σελίδα δεν τυπώνεται. */
export function priceChangesEntry(input: PriceChangeInput): PriceChangesEntry | null {
  const groups = PUBLICATION_CHANGE_KINDS.flatMap((kind) => groupOf(kind, input) ?? []);
  return groups.length === 0 ? null : { kind: 'priceChanges', id: 'price-changes', title: input.words.title, groups };
}
