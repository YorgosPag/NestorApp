/**
 * Η **μορφή κειμένου** της σελίδας (ADR-923 §5.6 · §21.1): υποδείξεις σπασίματος, ποσά `el-GR` και μετατροπή του
 * `richText` σε μπλοκ του μοντέλου διάταξης. Καθαρό.
 *
 * 🔴 **Υποδείξεις σπασίματος**: χωρίς αυτές, το Typst αφήνει το «1058x596x250» να **πατήσει πάνω στο διπλανό κελί**
 *    (μετρημένο, Φάση 0). Μηδενικού πλάτους κενό **μόνο** μετά από «x»/«×»/«/» ανάμεσα σε ψηφία: το «1/2″» σπάει αν
 *    χρειαστεί, το «kW/m²» μένει ανέπαφο.
 * @module subapps/catalog/publishing/layout-text
 */

import type { HumanLanguage } from '@/i18n/languages';
import { majorFromMinor, type MinorAmount } from '@/lib/money/money';
import { checkRichText } from '../values/rich-text';
import type { LayoutBlock, LayoutInline } from './layout-model';

export const ZERO_WIDTH_SPACE = '​';

const BREAK_POINT = /(\d)([xX×/])(?=\d)/g;

export function withBreakHints(text: string): string {
  return text.replace(BREAK_POINT, `$1$2${ZERO_WIDTH_SPACE}`);
}

const LOCALE_OF: Readonly<Record<HumanLanguage, string>> = { el: 'el-GR', en: 'en-GB' };

/** Χρήμα με ομαδοποίηση και πάντα δύο δεκαδικά — ντετερμινιστικό, ανεξάρτητο από τη γλώσσα της διεργασίας. */
export function formatPublicationPrice(minor: MinorAmount, language: HumanLanguage): string {
  return new Intl.NumberFormat(LOCALE_OF[language], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(majorFromMinor(minor));
}

/** ISO → «1/11/2026» σε UTC: το ίδιο PDF δεν αλλάζει με τη ζώνη ώρας του διακομιστή. */
export function formatPublicationDate(iso: string, language: HumanLanguage): string {
  return new Intl.DateTimeFormat(LOCALE_OF[language], { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
}

// ── richText → μπλοκ ──────────────────────────────────────────────────────────

const TOKEN = /<(\/?)([a-z0-9]+)(?:\s+href="([^"]*)")?\s*\/?>|([^<]+)/g;

const ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

const decode = (text: string): string => text.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity);

interface InlineState {
  strong: number;
  emphasis: number;
  link: string | null;
}

type Tree = LayoutBlock[];

interface Walker {
  readonly blocks: Tree;
  readonly state: InlineState;
  current: LayoutInline[];
  list: { ordered: boolean; items: LayoutInline[][] } | null;
}

function pushText(walker: Walker, text: string): void {
  const { strong, emphasis, link } = walker.state;
  const inline: LayoutInline = { text: decode(text), ...(strong > 0 ? { strong: true } : {}), ...(emphasis > 0 ? { emphasis: true } : {}), ...(link ? { link } : {}) };
  walker.current.push(inline);
}

function flushParagraph(walker: Walker): void {
  if (walker.current.some((inline) => inline.text.trim() !== '')) walker.blocks.push({ kind: 'paragraph', inlines: walker.current });
  walker.current = [];
}

function openList(walker: Walker, ordered: boolean): void {
  flushParagraph(walker);
  walker.list = { ordered, items: [] };
}

function closeList(walker: Walker): void {
  if (walker.list && walker.list.items.length > 0) walker.blocks.push({ kind: 'bullets', ordered: walker.list.ordered, items: walker.list.items });
  walker.list = null;
}

function closeItem(walker: Walker): void {
  walker.list?.items.push(walker.current);
  walker.current = [];
}

function closeHeading(walker: Walker): void {
  const text = walker.current.map((inline) => inline.text).join('');
  if (text.trim() !== '') walker.blocks.push({ kind: 'heading', level: 3, text, outlined: false });
  walker.current = [];
}

function applyOpen(walker: Walker, tag: string, href: string | undefined): void {
  const { state } = walker;
  if (tag === 'strong' || tag === 'b') state.strong += 1;
  else if (tag === 'em' || tag === 'i') state.emphasis += 1;
  else if (tag === 'a') state.link = href ?? null;
  else if (tag === 'br') pushText(walker, '\n');
  else if (tag === 'ul' || tag === 'ol') openList(walker, tag === 'ol');
  else if (tag === 'p' || tag === 'h3' || tag === 'h4') flushParagraph(walker);
}

function applyClose(walker: Walker, tag: string): void {
  const { state } = walker;
  if (tag === 'strong' || tag === 'b') state.strong -= 1;
  else if (tag === 'em' || tag === 'i') state.emphasis -= 1;
  else if (tag === 'a') state.link = null;
  else if (tag === 'li') closeItem(walker);
  else if (tag === 'ul' || tag === 'ol') closeList(walker);
  else if (tag === 'p') flushParagraph(walker);
  else if (tag === 'h3' || tag === 'h4') closeHeading(walker);
}

/**
 * Το `richText` ως μπλοκ. Περνά **ξανά** από τη γραμματική (`checkRichText`): κείμενο εκτός γλώσσας δεν φτάνει ποτέ
 * αναλυμένο στη σελίδα, τυπώνεται ως απλή παράγραφος (φαίνεται, αντί να χαθεί σιωπηλά).
 */
export function richTextBlocks(html: string): LayoutBlock[] {
  if (!checkRichText(html).ok) return [{ kind: 'paragraph', inlines: [{ text: html }] }];
  const walker: Walker = { blocks: [], state: { strong: 0, emphasis: 0, link: null }, current: [], list: null };
  for (const match of html.matchAll(TOKEN)) {
    const [, closing, tag, href, text] = match;
    if (text !== undefined) pushText(walker, text);
    else if (closing) applyClose(walker, tag);
    else applyOpen(walker, tag, href);
  }
  flushParagraph(walker);
  return walker.blocks;
}
