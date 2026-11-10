/**
 * ADR-929 Φ0.5 — **τι λέει ένα κείμενο γραμμένο πάνω σε σχέδιο;** Το ΕΝΑ SSoT για μήκη διαστάσεων, κλίμακα, εμβαδό και
 * ετικέτα ανοίγματος, από το κείμενο **όπως γράφτηκε**.
 *
 * 🔑 Ο κανόνας μονάδων ζούσε σε δύο σημεία: στο prompt του VLM (`plan-reading-prompt.ts`, οδηγία προς το μοντέλο) και
 *   μέσα στο `fusion/dimension-precision.ts` (`[1000, 10, 1]` + δικό του regex αριθμού). Εδώ ζει πλέον μία φορά.
 * 🔑 Τα ελληνικά σχέδια γράφουν μέτρα με δύο δεκαδικά («3.50» = 3500 mm). Ένας **σκέτος ακέραιος** («350», «20») ΔΕΝ λέει
 *   μόνος του τη μονάδα του: τη λέει το σχέδιο (`inferBareIntegerUnit`). Χωρίς απόδειξη ⇒ `null`, ποτέ μαντεψιά: το κείμενο
 *   μένει ορατό, απλώς δεν γίνεται περιορισμός του λύτη (ίδια συμπεριφορά με το `valueMm = null` του VLM).
 * ⚠️ Ο εκθέτης των ελληνικών σχεδίων («3.50⁵») δεν αναγνωρίζεται ακόμα: το κείμενο δεν ταιριάζει ⇒ `null`.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/reading/written-values
 */

import { normalizeNumber } from '../../../systems/dynamic-input/utils/number';
import type { PlanTextKind } from '../plan-recognition-types';

export type WrittenLengthUnit = 'm' | 'cm' | 'mm';

/** Οι μονάδες με τις οποίες γράφονται μήκη στα σχέδια, σε mm. */
export const WRITTEN_UNIT_MM: Readonly<Record<WrittenLengthUnit, number>> = { m: 1000, cm: 10, mm: 1 };

/** Οι ίδιες, από τη μεγαλύτερη στη μικρότερη (σειρά αναζήτησης ακρίβειας). */
export const WRITTEN_UNITS_MM: readonly number[] = [WRITTEN_UNIT_MM.m, WRITTEN_UNIT_MM.cm, WRITTEN_UNIT_MM.mm];

/** Η μονάδα ενός σκέτου ακεραίου σε αυτό το σχέδιο· `null` = δεν αποδεικνύεται. */
export type BareIntegerUnit = 'cm' | 'mm' | null;

export interface WrittenLength {
  readonly valueMm: number;
  /** Το μέγεθος του τελευταίου γραμμένου ψηφίου, σε mm (≥ 1). */
  readonly precisionMm: number;
  readonly unit: WrittenLengthUnit;
}

/** Κάθε αριθμός μέσα σε ένα κείμενο, όπως γράφτηκε («3.50x3.40» ⇒ «3.50», «3.40»). */
export function writtenNumberTokens(raw: string): string[] {
  return raw.match(/\d+(?:[.,]\d+)?/g) ?? [];
}

/** Ρητή μονάδα στο τέλος: «3.50m», «350 cm», «35εκ.», «3500 χιλ.». */
const UNIT_SUFFIX: ReadonlyArray<readonly [RegExp, WrittenLengthUnit]> = [
  [/^(mm|χιλ\.?)$/iu, 'mm'],
  [/^(cm|εκ\.?)$/iu, 'cm'],
  [/^(m|μ\.?)$/iu, 'm'],
];

const LENGTH_TEXT = /^(\d+(?:[.,]\d+)?)\s*([\p{L}.]*)$/u;

function suffixUnit(suffix: string): WrittenLengthUnit | null | undefined {
  if (suffix === '') return undefined;
  for (const [pattern, unit] of UNIT_SUFFIX) if (pattern.test(suffix)) return unit;
  return null;
}

/** Ένα μήκος γραμμένο ως **μόνο** περιεχόμενο του κειμένου, ή `null` (άλλο κείμενο, ή μονάδα που δεν αποδεικνύεται). */
export function parseDimensionValue(raw: string, bareIntegerUnit: BareIntegerUnit): WrittenLength | null {
  const m = LENGTH_TEXT.exec(raw.trim());
  if (m === null) return null;
  const [, token, suffix] = m;
  const decimals = token.split(/[.,]/)[1]?.length ?? 0;
  const explicit = suffixUnit(suffix);
  if (explicit === null) return null;
  const unit: WrittenLengthUnit | null = explicit ?? (decimals > 0 ? 'm' : bareIntegerUnit);
  if (unit === null) return null;
  const value = Number.parseFloat(normalizeNumber(token));
  if (!(value > 0)) return null;
  const unitMm = WRITTEN_UNIT_MM[unit];
  return { valueMm: value * unitMm, precisionMm: Math.max(unitMm * 10 ** -decimals, 1), unit };
}

/**
 * Η μονάδα των σκέτων ακεραίων ενός σχεδίου, από τα δικά του κείμενα διαστάσεων: αν γράφει μέτρα με δεκαδικά, οι ακέραιοι
 * είναι εκατοστά (πάχη «20», ύψη «250»). Αλλιώς `null` — η μονάδα δεν αποδεικνύεται από το κείμενο μόνο.
 */
export function inferBareIntegerUnit(dimensionRaws: readonly string[]): BareIntegerUnit {
  const writesMetres = dimensionRaws.some((raw) => parseDimensionValue(raw, null)?.unit === 'm');
  return writesMetres ? 'cm' : null;
}

/** «1:100», «Κλ. 1:50», «ΚΛΙΜΑΚΑ 1 : 200» ⇒ ο παρονομαστής. */
export function parseWrittenScale(raw: string): number | null {
  const m = /(?:^|\D)1\s*:\s*(\d{1,5})(?!\d)/u.exec(raw);
  if (m === null) return null;
  const denominator = Number.parseInt(m[1], 10);
  return denominator > 1 ? denominator : null;
}

/** «24 τ.μ.», «24,5 m²», «Ε=231.04τμ» ⇒ m². */
export function parseWrittenAreaM2(raw: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(?:τ\.?\s*μ\.?|m²|m2)/iu.exec(raw);
  if (m === null) return null;
  const value = Number.parseFloat(normalizeNumber(m[1]));
  return value > 0 ? value : null;
}

/** Η ετικέτα ανοίγματος «0.80/2.20» (πλάτος/ύψος, Δ5). */
const OPENING_SIZE = /^\d+[.,]\d{2}\s*\/\s*\d+[.,]\d{2}$/u;

/**
 * Το είδος ενός κειμένου **μόνο** από τη μορφή του. `room-name` και `title` ΔΕΝ βγαίνουν εδώ: χρειάζονται λεξιλόγιο ή
 * θέση, όχι μορφή — μένουν `other` ως να τα κρίνει κάποιος που ξέρει.
 */
export function classifyWrittenText(raw: string): PlanTextKind {
  const text = raw.trim();
  if (parseWrittenScale(text) !== null) return 'scale';
  if (parseWrittenAreaM2(text) !== null) return 'area';
  if (OPENING_SIZE.test(text)) return 'opening-size';
  const m = LENGTH_TEXT.exec(text);
  if (m !== null && suffixUnit(m[2]) !== null) return 'dimension';
  return 'other';
}
