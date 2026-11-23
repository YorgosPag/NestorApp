/**
 * @fileoverview **«Ε = 1.364,05 τ.μ.» → 1364.05 m²** — the area a surveyor WRITES on a diagram (ADR-920 §14.11 Π4/Π5).
 * @related ../../document-body (reads «ΕΜΒΑΔΟΝ ΓΕΩΤΕΜΑΧΙΟΥ» only as a document heading — this reads the bare statement)
 *
 * The written area is the surveyor's own corroboration: it is computed from the same vertex coordinates (shoelace).
 * A ring whose area matches it is, with very high likelihood, the ring the surveyor meant. Forms seen on Greek
 * diagrams (Υπ. Ανάπτυξης / ΥΠΑΑΤ samples, ADR-920 §14.11 research):
 *
 *   Ε = 13653.76 μ2 · E (Α,Β,Γ,Δ,Α) = 1.364,05 τ.μ. · ΕΜΒΑΔΟΝ ΟΙΚΟΠΕΔΟΥ: 1.364,05 m² · Εμβαδόν γεωτεμαχίου 1364,05 τμ
 *
 * 🔑 **A unit is REQUIRED.** Without it «E = 0.9996» (the projection's scale factor, printed on the same sheet) would
 *    read as an area. A statement without τ.μ./μ²/m² is not an area statement — no guessing.
 * 🔑 The letter may be Latin `E` (CAD fonts) or Greek `Ε`; accents and case do not matter. Numbers go through
 *    `parseStrictDecimal` — the project's grammar for numbers written in survey data (never `parseLocaleNumber`,
 *    which strips noise and would read «11 μ.» as 11). ⚠️ Its rule reads a lone «1.364» as 1.364, not 1364 — such a
 *    statement then simply fails to corroborate; it can never corroborate a wrong ring.
 */

import { parseStrictDecimal } from '@/lib/number/locale-number';
import { normalizeGreekHomoglyphs, stripAccents } from '@/utils/greek-text';

/** Square-metre spellings, after accent strip + upper case. */
const UNIT = String.raw`(?:Τ\.?\s?Μ\.?|ΤΕΤΡΑΓΩΝΙΚΑ\s+ΜΕΤΡΑ|[ΜM]\s?[2²])`;
const NUMBER = String.raw`([-−]?\d[\d.,]*)`;
/** «Ε» / «E» as a word, an optional «(Α,Β,Γ,…)», then «=» or «:». */
const LETTER_FORM = String.raw`(?<![\p{L}\p{N}])[ΕE]\s*(?:\([^)]*\))?\s*[=:]\s*` + NUMBER + String.raw`\s*` + UNIT;
/** «ΕΜΒΑΔΟΝ» + up to three words, then an optional «=» / «:». */
const WORD_FORM = String.raw`(?<![\p{L}\p{N}])ΕΜΒΑΔΟΝ(?:\s+\p{L}+){0,3}\s*(?:\([^)]*\))?\s*[=:]?\s*` + NUMBER + String.raw`\s*` + UNIT;

const STATEMENT_PATTERNS: readonly RegExp[] = [new RegExp(LETTER_FORM, 'gu'), new RegExp(WORD_FORM, 'gu')];

function comparable(text: string): string {
  return stripAccents(normalizeGreekHomoglyphs(text)).toUpperCase();
}

/** A captured number → m², or `null` (zero / negative / not a number is not an area). */
function areaOf(raw: string): number | null {
  const value = parseStrictDecimal(raw.replace(/[.,]+$/, ''));
  return value !== null && value > 0 ? value : null;
}

/** Every area statement in a text, m², in order of appearance, without repeats. */
export function plotAreaStatementsIn(text: string): number[] {
  const source = comparable(text);
  const found: { at: number; m2: number }[] = [];
  for (const pattern of STATEMENT_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const m2 = areaOf(match[1] ?? '');
      if (m2 !== null) found.push({ at: match.index ?? 0, m2 });
    }
  }
  found.sort((a, b) => a.at - b.at);
  return found.map((f) => f.m2).filter((m2, i, all) => all.indexOf(m2) === i);
}
