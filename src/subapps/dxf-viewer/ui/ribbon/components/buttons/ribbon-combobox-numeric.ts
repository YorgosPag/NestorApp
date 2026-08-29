/**
 * ADR-345 §4.5 — Numeric editable-combobox SSoT helpers.
 *
 * The single `RibbonCombobox` renders an EDITABLE (type-to-enter) field instead
 * of a plain Radix Select whenever its option list is purely numeric — Revit-grade:
 * presets in the dropdown PLUS free typing, negatives where the field allows. These
 * pure functions decide "is this a numeric field?", resolve its constraints from the
 * preset list (overridable per command), and sanitize/commit typed input. Shared by
 * `RibbonEditableCombobox` and its unit tests — ZERO inline logic in the component.
 *
 * Because the mutation path (`onComboboxChange(commandKey, value)`) is already generic
 * across every contextual tab (foundation, column, beam, wall, MEP…), making THIS SSoT
 * editable turns every numeric combobox app-wide into a Revit-style input with no
 * per-domain wiring.
 *
 * @see ./RibbonEditableCombobox.tsx — the consumer
 * @see docs/centralized-systems/reference/adrs/ADR-345-ribbon.md
 */

import type React from 'react';
import type {
  RibbonCommand,
  RibbonComboboxOption,
} from '../../types/ribbon-types';
// 🏢 SSoT: canonical comma→dot normalizer (comma-normalize ratchet module)
import { normalizeNumber } from '../../../../systems/dynamic-input/utils/number';

/** Parse an option/draft value to a finite number, or `null` (non-numeric / empty). */
export function parseOptionNumber(value: string): number | null {
  const trimmed = normalizeNumber(value.trim());
  if (trimmed === '' || trimmed === '-' || trimmed === '.') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * True when every option is a numeric literal → the field is a numeric quantity and
 * should be editable. Non-numeric enum combos (kind/justification/anchor: `isLiteralLabel:false`
 * with i18n labels) and labelled lists (scales like "1:50", font families) return false.
 */
export function isNumericOptionList(
  options: readonly RibbonComboboxOption[],
): boolean {
  if (options.length === 0) return false;
  return options.every(
    (o) => o.isLiteralLabel === true && parseOptionNumber(o.value) !== null,
  );
}

/** Resolved typing constraints for an editable numeric combobox. */
export interface ResolvedNumericConfig {
  allowNegative: boolean;
  allowDecimal: boolean;
  min?: number;
  max?: number;
}

/**
 * Resolve constraints for a (candidate) numeric combobox. Returns `null` when the
 * field is NOT numeric — the caller then renders a plain Radix Select. `command.numericInput`
 * overrides the values inferred from the preset list:
 *   - negatives auto-allowed when any preset is negative (e.g. top-elevation −500…−2000);
 *   - decimals auto-allowed when any preset is non-integer (e.g. line spacing 1.0/1.5);
 *   - `editable:false` forces a Select even for numeric lists; `editable:true` forces editing.
 */
export function resolveNumericConfig(
  command: RibbonCommand,
  options: readonly RibbonComboboxOption[],
): ResolvedNumericConfig | null {
  const cfg = command.numericInput;
  if (cfg?.editable === false) return null;
  const numeric = isNumericOptionList(options);
  if (!numeric && cfg?.editable !== true) return null;

  const nums = options
    .map((o) => parseOptionNumber(o.value))
    .filter((n): n is number => n !== null);
  const anyNegative = nums.some((n) => n < 0);
  const anyDecimal = nums.some((n) => !Number.isInteger(n));

  return {
    allowNegative: cfg?.allowNegative ?? anyNegative,
    allowDecimal: cfg?.allowDecimal ?? anyDecimal,
    min: cfg?.min,
    max: cfg?.max,
  };
}

/**
 * Strip characters not permitted by the current constraints (live keystroke filter).
 * Keeps a single leading minus (when allowed), a single decimal dot (when allowed),
 * and digits. Lets partial drafts like "-", "1." survive while typing.
 */
export function filterNumericDraft(
  raw: string,
  cfg: ResolvedNumericConfig,
): string {
  let out = '';
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
    } else if ((ch === '.' || ch === ',') && cfg.allowDecimal && !out.includes('.')) {
      out += '.';
    } else if (ch === '-' && cfg.allowNegative && out.length === 0) {
      out += '-';
    }
  }
  return out;
}

/**
 * Commit a typed draft → normalized numeric string for `onComboboxChange`, or `null`
 * when invalid / out of range (the caller reverts to the previous value). A lone "-",
 * ".", or "" is invalid; sign and min/max are enforced.
 */
export function commitNumericDraft(
  raw: string,
  cfg: ResolvedNumericConfig,
): string | null {
  const n = parseOptionNumber(raw);
  if (n === null) return null;
  if (!cfg.allowNegative && n < 0) return null;
  if (cfg.min !== undefined && n < cfg.min) return null;
  if (cfg.max !== undefined && n > cfg.max) return null;
  return String(n);
}

/**
 * 🔴 ADR-739 §70 (Boy Scout, N.0.2) — **«`Enter` δεσμεύει μέσω `blur`»**, μία φορά.
 *
 * Ήταν γραμμένο **τρεις** φορές, ταυτόσημα, στα τρία πεδία που ήδη εισάγουν αυτό το module
 * (`RibbonEditableCombobox`, `StatusBarEditableCombobox`, `RibbonWallDimensionWidget`) — και
 * το CHECK 3.28 (jscpd) το κατήγγειλε ως **δύο** ακριβείς κλώνους τη στιγμή που τα τρία
 * αρχεία βρέθηκαν στο ίδιο diff. Μετρημένο ότι **προϋπήρχε** στο HEAD: τα ίδια δύο ζεύγη
 * βγαίνουν και από τις ανέγγιχτες εκδόσεις.
 *
 * ## Γιατί επιστρέφει `boolean` και δεν είναι σκέτος χειριστής
 * Δύο από τους τρεις καταναλωτές δεν κάνουν **τίποτα άλλο** με το πλήκτρο — εκείνοι το
 * περνούν κατευθείαν ως `onKeyDown`. Ο τρίτος έχει και βέλη (`ArrowUp`/`ArrowDown`), και
 * χρειάζεται να ξέρει **αν το πλήκτρο καταναλώθηκε** ώστε να μη συνεχίσει. Ένας χειριστής
 * που επιστρέφει `void` θα ανάγκαζε τον τρίτο να ξαναρωτήσει `e.key === 'Enter'` — δηλαδή
 * θα κρατούσε ζωντανό το μισό διπλότυπο, εκεί ακριβώς που είναι πιο εύκολο να ξεχαστεί.
 *
 * ⚠️ Η δέσμευση γίνεται από το `onBlur` του πεδίου, **όχι** εδώ: αυτή η συνάρτηση δεν ξέρει
 * τι σημαίνει «δεσμεύω» για τον καθένα (άλλος γράφει σε store, άλλος καλεί `onCommit`).
 * Ξέρει μόνο ότι το `Enter` **τερματίζει τη γραφή** — και ο ένας δρόμος τερματισμού που
 * έχουν ήδη και οι τρεις είναι το `blur`.
 *
 * @returns `true` αν το πλήκτρο καταναλώθηκε (ήταν `Enter`), αλλιώς `false`
 */
export function commitNumericFieldOnEnter(
  event: React.KeyboardEvent<HTMLInputElement>,
): boolean {
  if (event.key !== 'Enter') return false;
  event.preventDefault();
  event.currentTarget.blur();
  return true;
}
