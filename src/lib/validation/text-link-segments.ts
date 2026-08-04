/**
 * @module text-link-segments
 * @description Free text → **ordered, gap-free link segments** — Single Source of Truth (ADR-751)
 *
 * The existing extractors answer *"which addresses appear in this text?"* and return cleaned
 * strings: `extractAllEmailsFromText`, `extractAllUrlsFromText`, `extractAllPhonesFromText`
 * all funnel through `distinct()`, which lowercases, de-duplicates and — decisively — throws
 * the character positions away. That is the right shape for their callers (title-block
 * reading, AI enrichment) and the wrong shape for anything that has to *paint* the text:
 * to underline only `2101234567` inside `Τηλ: 2101234567` you need to know **where** it sits.
 *
 * This module answers the second question — *"how does this text break down into linked and
 * unlinked pieces?"* — and it does so **without a single new pattern**. Every regex and every
 * validator is imported from the two canonical modules. A new `EMAIL_REGEX` here would be a
 * second answer to "what is an email address", which is exactly the duplication N.12 forbids,
 * and it would drift the first time one of them was tightened.
 *
 * ## The three guarantees
 * 1. **Gap-free** — the returned segments concatenate back to the input, byte for byte. A
 *    renderer can draw them in order and be certain nothing was dropped or drawn twice.
 * 2. **Non-overlapping** — a character belongs to exactly one segment. Overlaps are resolved
 *    by kind precedence (email › url › phone), never by "whichever regex ran last".
 * 3. **Positions are into the ORIGINAL string** — not into a trimmed or lowercased copy, so
 *    `text.slice(segment.start, segment.end) === segment.text` always holds.
 *
 * @see lib/validation/phone-validation.ts — PHONE_CANDIDATE_RUN, EMAIL_EXTRACT_REGEX, isValidPhone
 * @see lib/validation/email-validation.ts — WEB_URL_EXTRACT_REGEX
 * @see docs/centralized-systems/reference/adrs/ADR-751-cell-text-links.md
 */

import { WEB_URL_EXTRACT_REGEX } from './email-validation';
import { EMAIL_EXTRACT_REGEX, PHONE_CANDIDATE_RUN, cleanPhoneNumber, isValidPhone } from './phone-validation';

/** The three things a reader can act on. Plain prose is `'text'`, which is not a link kind. */
export type TextLinkKind = 'email' | 'phone' | 'url';

interface TextSegmentBase {
  /** The exact substring — `source.slice(start, end)`, never normalised. */
  readonly text: string;
  /** Inclusive index into the **original** string. */
  readonly start: number;
  /** Exclusive index into the **original** string. */
  readonly end: number;
}

/**
 * A piece of text that either is a link or is not.
 *
 * Modelled as a discriminated union rather than `kind: string; href?: string` for the same
 * reason `TableTextRun` pairs `underline: true` with a mandatory `advanceMm`: a link without
 * a destination is not a state the rest of the code should have to defend against. The
 * `href?: undefined` on the prose arm is what lets `segment.href` narrow without a cast.
 */
export type TextLinkSegment =
  | (TextSegmentBase & { readonly kind: 'text'; readonly href?: undefined })
  | (TextSegmentBase & { readonly kind: TextLinkKind; readonly href: string });

export interface TextLinkScanOptions {
  /**
   * Which kinds to look for. Defaults to all three.
   *
   * The escape hatch exists for **numeric contexts**. A Greek landline is `2` followed by
   * nine digits, so a bare ten-digit quantity, drawing code or VAT number matches it exactly;
   * a caller that already knows the text is a computed number (a spreadsheet formula result,
   * a measured quantity) should pass `kinds: ['email', 'url']` rather than have every such
   * value turn into a phone call. Suppression belongs to the caller who has that context —
   * this module cannot infer it from the characters alone.
   */
  readonly kinds?: readonly TextLinkKind[];
}

const ALL_KINDS: readonly TextLinkKind[] = ['email', 'phone', 'url'];

/**
 * Which kind wins when two candidates claim the same characters. Lower is stronger.
 *
 * Email outranks url so that a scheme-bearing address (`http://user@host/…`) reads as mail
 * rather than a page, and both outrank phone because the digit rule is the loosest of the
 * three — a phone candidate can appear *inside* an address (`support2310788493@example.gr`)
 * and must lose there.
 */
const KIND_PRECEDENCE: Readonly<Record<TextLinkKind, number>> = { email: 0, url: 1, phone: 2 };

/**
 * Trailing characters a writer meant as punctuation, not as part of the address.
 *
 * `WEB_URL_EXTRACT_REGEX` ends in `(?:\/\S*)?` — an unrestricted non-space run — so in
 * `δες www.nestorconstruct.gr/έργα, μετά` it swallows the comma. Stripping happens **here**
 * and not in the shared pattern on purpose: the extractors feed lookups where a stray comma
 * is harmless, while a link that opens `…/έργα,` is a 404 the user watches happen.
 */
const URL_TRAILING_PUNCTUATION = /[.,;:!?)\]}»'"]+$/;

/** Separators that may end a phone candidate run but are never part of the number. */
const PHONE_TRAILING_SEPARATORS = /[\s\-()]+$/;

interface Candidate {
  readonly kind: TextLinkKind;
  readonly start: number;
  readonly end: number;
}

/**
 * Break `source` into consecutive segments, marking the ones that are addresses.
 *
 * Always returns at least one segment for a non-empty input, and an empty array for `''`.
 */
export function splitTextIntoLinkSegments(
  source: string,
  options: TextLinkScanOptions = {},
): readonly TextLinkSegment[] {
  if (source === '') return [];

  const kinds = options.kinds ?? ALL_KINDS;
  const candidates: Candidate[] = [];
  if (kinds.includes('email')) candidates.push(...scanPattern(source, EMAIL_EXTRACT_REGEX, 'email'));
  if (kinds.includes('url')) candidates.push(...scanUrls(source));
  if (kinds.includes('phone')) candidates.push(...scanPhones(source));

  return fillGaps(source, resolveOverlaps(candidates));
}

/**
 * True when `source` contains at least one address — the cheap question, for callers that
 * only need to decide whether to do more work.
 *
 * It is deliberately *not* `splitTextIntoLinkSegments(…).some(…)`: this runs on every pointer
 * move over a table, and the full split allocates a segment per gap.
 */
export function hasTextLink(source: string, options: TextLinkScanOptions = {}): boolean {
  const kinds = options.kinds ?? ALL_KINDS;
  if (kinds.includes('email') && globalCopy(EMAIL_EXTRACT_REGEX).test(source)) return true;
  if (kinds.includes('url') && globalCopy(WEB_URL_EXTRACT_REGEX).test(source)) return true;
  return kinds.includes('phone') && scanPhones(source).length > 0;
}

/**
 * The destination of a link segment.
 *
 * ⚠️ The phone branch runs the text through {@link cleanPhoneNumber} — `tel:2310-788493`
 * with the separators left in is not a number a dialler can act on. The oldest consumer in
 * the codebase (`UniversalClickableField`) interpolates the raw field value instead, which
 * works only because those values arrive pre-cleaned from a form; text scraped out of a
 * drawing carries whatever the author typed.
 */
function hrefFor(kind: TextLinkKind, text: string): string {
  switch (kind) {
    case 'email':
      return `mailto:${text}`;
    case 'phone':
      return `tel:${cleanPhoneNumber(text)}`;
    case 'url':
      return /^https?:\/\//i.test(text) ? text : `https://${text}`;
  }
}

/** A fresh global clone, so the shared (stateful) patterns never leak a `lastIndex`. */
function globalCopy(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
}

/** Every match of `pattern`, as candidates of a single kind. */
function scanPattern(source: string, pattern: RegExp, kind: TextLinkKind): Candidate[] {
  const out: Candidate[] = [];
  for (const match of source.matchAll(globalCopy(pattern))) {
    const start = match.index ?? 0;
    out.push({ kind, start, end: start + match[0].length });
  }
  return out;
}

/** Web addresses, with writer's punctuation trimmed off the tail. */
function scanUrls(source: string): Candidate[] {
  const out: Candidate[] = [];
  for (const raw of scanPattern(source, WEB_URL_EXTRACT_REGEX, 'url')) {
    const text = source.slice(raw.start, raw.end);
    const end = raw.start + text.replace(URL_TRAILING_PUNCTUATION, '').length;
    if (end > raw.start) out.push({ ...raw, end });
  }
  return out;
}

/**
 * Phone numbers, mirroring the two-step logic of `extractAllPhonesFromText`: try the whole
 * candidate run first, and only when that fails retry its whitespace-separated parts — a run
 * holding two numbers (`2310788493 6971234567`) validates as neither, and without the retry
 * both would be lost together.
 *
 * The difference from the extractor is bookkeeping, not rules: positions are tracked through
 * both steps, so the caller can still point at the characters.
 */
function scanPhones(source: string): Candidate[] {
  const out: Candidate[] = [];
  for (const run of source.matchAll(globalCopy(PHONE_CANDIDATE_RUN))) {
    const runStart = run.index ?? 0;
    const whole = trimTrailing(source, runStart, runStart + run[0].length);
    if (whole && isValidPhone(source.slice(whole.start, whole.end))) {
      out.push({ kind: 'phone', ...whole });
      continue;
    }
    for (const part of run[0].matchAll(/\S+/g)) {
      const start = runStart + (part.index ?? 0);
      const piece = trimTrailing(source, start, start + part[0].length);
      if (piece && isValidPhone(source.slice(piece.start, piece.end))) {
        out.push({ kind: 'phone', ...piece });
      }
    }
  }
  return out;
}

/**
 * Drop trailing separators from a candidate range.
 *
 * `PHONE_CANDIDATE_RUN` allows spaces, dashes and parentheses *inside* a run, so it happily
 * ends on them (`«τηλ. 2310-788493, fax»` yields `2310-788493, ` minus the comma). Those
 * characters validate fine — `cleanPhoneNumber` strips them — but they would widen the
 * underline past the number and make the clickable range include the following space.
 *
 * No left trim: the pattern's first character class is `[+\d]`, so a run cannot start on one.
 */
function trimTrailing(source: string, start: number, end: number): { start: number; end: number } | null {
  const trimmed = source.slice(start, end).replace(PHONE_TRAILING_SEPARATORS, '');
  return trimmed === '' ? null : { start, end: start + trimmed.length };
}

/**
 * Keep the strongest candidate at each position and discard anything that overlaps it.
 *
 * Sorted by start, then by kind precedence, then by length descending — so at a tie the
 * stronger kind wins, and within one kind the longer match wins (`www.a.gr/b/c` beats a
 * hypothetical `www.a.gr`). A single left-to-right pass then accepts greedily.
 */
function resolveOverlaps(candidates: readonly Candidate[]): Candidate[] {
  const sorted = [...candidates].sort(
    (a, b) =>
      a.start - b.start ||
      KIND_PRECEDENCE[a.kind] - KIND_PRECEDENCE[b.kind] ||
      b.end - a.end,
  );

  const accepted: Candidate[] = [];
  let reached = 0;
  for (const candidate of sorted) {
    if (candidate.start < reached) continue;
    accepted.push(candidate);
    reached = candidate.end;
  }
  return accepted;
}

/** Turn accepted candidates into a gap-free segment list by filling the prose between them. */
function fillGaps(source: string, accepted: readonly Candidate[]): readonly TextLinkSegment[] {
  const segments: TextLinkSegment[] = [];
  let cursor = 0;

  const prose = (start: number, end: number): void => {
    if (end > start) segments.push({ kind: 'text', text: source.slice(start, end), start, end });
  };

  for (const { kind, start, end } of accepted) {
    prose(cursor, start);
    const text = source.slice(start, end);
    segments.push({ kind, text, start, end, href: hrefFor(kind, text) });
    cursor = end;
  }
  prose(cursor, source.length);

  return segments;
}
