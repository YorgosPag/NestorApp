/**
 * @fileoverview **Η κατάσταση κάθε μετάφρασης μιας έκδοσης, όπως τη λέει η οθόνη** — καθαρό (ADR-928 §5.2.2 · Φ3γ-0).
 * @module subapps/procurement/subcontracts/library/translation-status
 *
 * 🔑 Τρεις καταστάσεις, όχι δύο: **εγκεκριμένη** · **πρόχειρη** · **μπαγιάτικη** (το `sourceHash` της δεν είναι πια το
 *    ελληνικό της έκδοσης). Η τρίτη είναι εκείνη που οι άλλοι κρύβουν μέσα στο «πρόχειρο»: εδώ λέγεται, μαζί με το
 *    **τι** άλλαξε στο ελληνικό (`staleSince`), για να μη γίνει η μετάφραση αγγαρεία στα τυφλά.
 * 🔑 Ο κανόνας «μπαγιάτικη» είναι **ο ίδιος** με τον φύλακα του γραφέα (`refuseTranslationApproval` ⇒ `translationStale`):
 *    ισότητα hash, τίποτα άλλο.
 */

import { DOCUMENT_LANGUAGES } from '../document/document-locale';
import {
  CLAUSE_AUTHORITATIVE_LANGUAGE,
  type ClauseBlock,
  type ClauseBody,
  type ClauseInline,
  type ClauseTranslation,
  type SubcontractClauseVersion,
} from '../types/clause';
import type { ClauseLanguage } from '../types/clause-parameter';

export type TranslationState = 'approved' | 'draft' | 'stale' | 'missing';

export interface TranslationRow {
  readonly language: ClauseLanguage;
  readonly state: TranslationState;
  readonly translation: ClauseTranslation | null;
}

/** Η κατάσταση μιας μετάφρασης απέναντι στο ελληνικό της έκδοσης. */
export function translationStateOf(version: Pick<SubcontractClauseVersion, 'sourceHash'>, translation: ClauseTranslation | undefined): TranslationState {
  if (!translation) return 'missing';
  if (translation.sourceHash !== version.sourceHash) return 'stale';
  return translation.status === 'approved' ? 'approved' : 'draft';
}

/** Μία γραμμή ανά γλώσσα εγγράφου πλην της αυθεντικής — και όσες άλλες γλώσσες έχει ήδη η έκδοση. */
export function translationRowsOf(version: Pick<SubcontractClauseVersion, 'sourceHash' | 'translations'>): TranslationRow[] {
  const languages = new Set<ClauseLanguage>([...DOCUMENT_LANGUAGES, ...Object.keys(version.translations)]);
  languages.delete(CLAUSE_AUTHORITATIVE_LANGUAGE);
  return [...languages].map((language) => {
    const translation = version.translations[language];
    return { language, state: translationStateOf(version, translation), translation: translation ?? null };
  });
}

/** Το «σχήμα» ενός σώματος: είδος μπλοκ, πλήθος στοιχείων, και η σειρά κειμένου/παραμέτρων — **χωρίς** το κείμενο. */
function shapeOf(body: ClauseBody): string {
  const runShape = (run: readonly ClauseInline[]) => run.map((inline) => (inline.kind === 'param' ? `{${inline.key}}` : 't')).join(',');
  return JSON.stringify(body.blocks.map((block) => (block.kind === 'paragraph' ? ['p', runShape(block.inlines)] : ['l', block.ordered, block.items.map(runShape)])));
}

/**
 * Η αφετηρία μιας πρότασης μετάφρασης: η υπάρχουσα μετάφραση αν έχει **το ίδιο σχήμα** με το ελληνικό (μπαγιάτικη μετά
 * από αλλαγή διατύπωσης, όχι δομής ⇒ η δουλειά δεν χάνεται), αλλιώς το ελληνικό σώμα. Οι παράμετροι είναι **πάντα** του
 * ελληνικού, στις ίδιες θέσεις: ο επεξεργαστής αλλάζει μόνο κείμενο, άρα το «ίδιο σύνολο παραμέτρων» του γραφέα τηρείται
 * με κατασκευή.
 */
export function translationSeedOf(greek: ClauseBody, existing: ClauseBody | null): ClauseBody {
  return existing !== null && shapeOf(existing) === shapeOf(greek) ? existing : greek;
}

/** Η θέση ενός τμήματος κειμένου: μπλοκ · στοιχείο λίστας (`null` σε παράγραφο) · τμήμα. */
export interface InlinePosition {
  readonly block: number;
  readonly item: number | null;
  readonly inline: number;
}

function replaceText(run: readonly ClauseInline[], index: number, text: string): ClauseInline[] {
  return run.map((inline, position) => (position === index && inline.kind === 'text' ? { kind: 'text', text } : inline));
}

/** Αλλάζει **μόνο** ένα τμήμα κειμένου· τμήμα παραμέτρου μένει ανέγγιχτο (κλειδωμένο). */
export function withInlineText(body: ClauseBody, position: InlinePosition, text: string): ClauseBody {
  const blocks = body.blocks.map((block, index): ClauseBlock => {
    if (index !== position.block) return block;
    if (block.kind === 'paragraph') return position.item === null ? { ...block, inlines: replaceText(block.inlines, position.inline, text) } : block;
    return { ...block, items: block.items.map((item, itemIndex) => (itemIndex === position.item ? replaceText(item, position.inline, text) : item)) };
  });
  return { ...body, blocks };
}

/**
 * Η έκδοση από την οποία προέρχεται μια μπαγιάτικη μετάφραση: η πιο πρόσφατη **παλαιότερη** έκδοση με το ίδιο ελληνικό
 * (`sourceHash`) — για να δειχτεί δίπλα δίπλα τι άλλαξε. `null` αν δεν βρίσκεται στο χρονολόγιο.
 */
export function staleSourceOf(
  version: Pick<SubcontractClauseVersion, 'version'>,
  translation: Pick<ClauseTranslation, 'sourceHash'>,
  history: readonly SubcontractClauseVersion[],
): SubcontractClauseVersion | null {
  const candidates = history.filter((entry) => entry.version < version.version && entry.sourceHash === translation.sourceHash);
  return candidates.reduce<SubcontractClauseVersion | null>((best, entry) => (best === null || entry.version > best.version ? entry : best), null);
}
