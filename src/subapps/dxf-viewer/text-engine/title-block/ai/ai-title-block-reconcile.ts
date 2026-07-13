/**
 * ADR-651 Φάση Δ — **reconciliation**: AI structured output → έγκυρο `TextTemplate`.
 *
 * Καθαρή συνάρτηση (κανένα I/O, καμία γνώση δικτύου/UI) ⇒ unit-testable, ίδιο μοτίβο με το
 * `validateTranslatedQuery` του ADR-268: **δεν εμπιστεύεται το LLM**. Κάθε `placeholderPath`
 * περνά από το `isKnownPlaceholder` — ό,τι δεν ανήκει στο `PLACEHOLDER_REGISTRY` (hallucination
 * ή typo) **πέφτει** και καταγράφεται στο `droppedPaths`. Έτσι το AI output μπορεί μόνο να
 * παράγει πινακίδα με **γνωστά** δεδομένα, ποτέ με σπασμένο `{{x.y}}`.
 *
 * Το αποτέλεσμα είναι `DxfTextNode` χτισμένο με τους **ίδιους** builders των built-in προτύπων
 * (`makeNode/makeParagraph/makeRun`) και τη **σύμβαση** που διαβάζει ο υπάρχων renderer
 * (`title-block-rows.ts`): πρώτη γραμμή χωρίς `:` = επικεφαλίδα· κάθε άλλη = «Ετικέτα: τιμή».
 * Άρα η AI πινακίδα ζωγραφίζεται/τυπώνεται/εξάγεται από τα **ίδια 3 backends**, δωρεάν.
 *
 * @see ../../templates/resolver/variables.ts — isKnownPlaceholder (SSoT γνωστών paths)
 * @see ../title-block-rows.ts — η σύμβαση «Ετικέτα: τιμή» που διαβάζεται πίσω
 */

import {
  CAPTION_RUN_STYLE,
  DEFAULT_RUN_STYLE,
  HEADING_RUN_STYLE,
  makeNode,
  makeParagraph,
  makeRun,
} from '../../templates/defaults/template-helpers';
import { extractPlaceholders } from '../../templates/extract-placeholders';
import { isKnownPlaceholder } from '../../templates/resolver/variables';
import type { TextTemplate } from '../../templates/template.types';
import type { DxfTextNode, TextParagraph, TextRunStyle } from '../../types/text-ast.types';
import type { TitleBlockLocale } from '../title-block-presets';
import type { AiTitleBlock, AiTitleBlockRow } from './ai-title-block-schema';

/** Draft id — δεν persist-άρεται· η αποθήκευση περνά από το CRUD που δίνει enterprise id (N.6). */
export const AI_TITLE_BLOCK_DRAFT_ID = 'ai-draft/title-block';

/**
 * Τυλίγει ένα `DxfTextNode` σε user-tier draft `TextTemplate` (category `'title-block'`).
 * ΕΝΑ σημείο για το draft shape — το reconcile ΚΑΙ ο AI compliance route χτίζουν από εδώ
 * (N.18: μηδέν διπλός draft literal). Δεν persist-άρεται: η αποθήκευση δίνει enterprise id.
 */
export function buildDraftTitleBlockTemplate(
  content: DxfTextNode,
  locale: TitleBlockLocale,
): TextTemplate {
  return {
    id: AI_TITLE_BLOCK_DRAFT_ID,
    companyId: null,
    name: '',
    category: 'title-block',
    content,
    placeholders: Object.freeze(extractPlaceholders(content)),
    isDefault: false,
    locale,
    createdAt: null,
    updatedAt: null,
  };
}

export interface ReconciledTitleBlock {
  /** Το επεξεργάσιμο πρότυπο (category `'title-block'`, user-tier draft). */
  readonly template: TextTemplate;
  /** Αν το preset της AI πινακίδας έχει κελί σφραγίδας (τρέφει τον έλεγχο πληρότητας). */
  readonly withStampBox: boolean;
  /** Τα paths που το AI πρότεινε αλλά ΔΕΝ είναι γνωστά — πετάχτηκαν (για ενημέρωση χρήστη). */
  readonly droppedPaths: readonly string[];
}

/** Το ορατό token μιας τιμής: γνωστό placeholder → `{{path}}`· αλλιώς literal ή κενό. */
function valueToken(row: AiTitleBlockRow, dropped: string[]): string {
  const path = row.placeholderPath?.trim();
  if (path) {
    if (isKnownPlaceholder(path)) return `{{${path}}}`;
    dropped.push(path); // hallucinated / typo → κρατάμε τη γραμμή, χάνουμε το binding
  }
  return row.literalValue?.trim() ?? '';
}

/** Έμφαση → run style (η επικεφαλίδα έχει δικό της, πιο έντονο style). */
function styleForEmphasis(emphasis: AiTitleBlockRow['emphasis']): TextRunStyle {
  return emphasis === 'default' ? DEFAULT_RUN_STYLE : CAPTION_RUN_STYLE;
}

/** «Ετικέτα: τιμή» → παράγραφος. Πεδίο με ετικέτα κρατά την `:` ακόμη κι όταν η τιμή είναι κενή
 * (κενό πεδίο προς συμπλήρωση — ο reader το βλέπει ως πεδίο, όχι ως label-only/επικεφαλίδα). */
function rowParagraph(row: AiTitleBlockRow, dropped: string[]): TextParagraph | null {
  const label = row.label.trim();
  const value = valueToken(row, dropped);
  if (!label && !value) return null; // κενή γραμμή — δεν μπαίνει
  const text = label ? (value ? `${label}: ${value}` : `${label}:`) : value;
  return makeParagraph([makeRun(text, styleForEmphasis(row.emphasis))]);
}

/** Η παράγραφος επικεφαλίδας (χωρίς `:`, ώστε ο reader να την πάει στη ζώνη τίτλου). */
function headingParagraph(ai: AiTitleBlock, dropped: string[]): TextParagraph | null {
  const path = ai.heading.placeholderPath?.trim();
  if (path) {
    if (isKnownPlaceholder(path)) {
      return makeParagraph([makeRun(`{{${path}}}`, HEADING_RUN_STYLE)]);
    }
    dropped.push(path);
  }
  const literal = ai.heading.literalText?.trim();
  return literal ? makeParagraph([makeRun(literal, HEADING_RUN_STYLE)]) : null;
}

/**
 * AI structured output → έγκυρο `TextTemplate` draft (+ ό,τι χρειάζεται ο έλεγχος πληρότητας).
 *
 * Ντετερμινιστική: ίδιο input ⇒ ίδιο output (καμία τυχαιότητα, κανένα `Date.now`).
 */
export function reconcileAiTitleBlock(ai: AiTitleBlock): ReconciledTitleBlock {
  const droppedPaths: string[] = [];
  const paragraphs: TextParagraph[] = [];

  const heading = headingParagraph(ai, droppedPaths);
  if (heading) paragraphs.push(heading);

  for (const row of ai.rows) {
    const paragraph = rowParagraph(row, droppedPaths);
    if (paragraph) paragraphs.push(paragraph);
  }

  const content = makeNode(paragraphs, { attachment: 'BR' });

  return {
    template: buildDraftTitleBlockTemplate(content, ai.locale),
    withStampBox: ai.withStampBox,
    // Μοναδικά, ντετερμινιστική σειρά (ώστε το UI/tests να μη «χοροπηδούν»).
    droppedPaths: Array.from(new Set(droppedPaths)).sort(),
  };
}

/**
 * Το πλήρες αποτέλεσμα που ταξιδεύει στον client (wire contract των AI routes): το reconciled
 * πρότυπο + τα metadata του μοντέλου (βεβαιότητα/σημειώσεις). JSON-safe (timestamps `null`,
 * `content` = απλά δεδομένα) ⇒ περνά ως έχει από το route στον διάλογο.
 */
export interface AiTitleBlockResult extends ReconciledTitleBlock {
  /** Βεβαιότητα ερμηνείας 0–1 (χαμηλή ⇒ υπόδειξη στον χρήστη να ελέγξει). */
  readonly confidence: number;
  /** Σύντομη σημείωση του μοντέλου (τι κατάλαβε/υπέθεσε). */
  readonly notes: string;
}

/** AI structured output → πλήρες wire result (reconcile + metadata). */
export function toAiTitleBlockResult(ai: AiTitleBlock): AiTitleBlockResult {
  return { ...reconcileAiTitleBlock(ai), confidence: ai.confidence, notes: ai.notes };
}
