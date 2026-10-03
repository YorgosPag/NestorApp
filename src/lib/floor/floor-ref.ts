/**
 * @fileoverview **ΑΝΑΦΟΡΑ ΟΡΟΦΟΥ** — ο ένας τύπος που λέει «σε ποια στάθμη» (ADR-903).
 * @module lib/floor/floor-ref
 *
 * 🔑 Πρότυπο των μεγάλων: Revit Level (υψόμετρο + «Building Story») · ArchiCAD Story (προσημασμένος
 * δείκτης, ισόγειο = 0) · IFC `IfcBuildingStorey` + `Pset_BuildingStoreyCommon` · RESO `EntryLevel` ·
 * idealista `floor` (αριθμός **ή** επώνυμη στάθμη: «bajo», «entreplanta», «ático»). **Όλοι** χωρίζουν
 * τον **αριθμό** από το **είδος** — εδώ `number` + `kind` (`FloorKind`, το λεξιλόγιο του `FloorDocument`).
 *
 * - `kind: null` ⇒ το είδος συνάγεται από τον αριθμό (`inferKindFromNumber`) — τα πεδία που κρατούν
 *   μόνο ακέραιο (`Property.floor`, ζήτηση `floorMin/Max`) περνούν αυτούσια.
 * - `number: null` ⇒ **επώνυμη** στάθμη χωρίς αριθμό («Δώμα», «Σοφίτα» — idealista «ático»). Ο τύπος
 *   **απαγορεύει** `standard` χωρίς αριθμό: «Όροφος» χωρίς ποιος δεν είναι ετικέτα.
 * - Ο ημιώροφος **ποτέ** 0,5 (κανένας από τους μεγάλους): `kind: 'mezzanine'`, δεμένος στον από κάτω.
 *
 * 🔴 `parseLegacyFloor` είναι ο **ΕΝΑΣ** parser παλιών κειμένων. Άγνωστο κείμενο ⇒ `null`, **ποτέ**
 * σιωπηλό ισόγειο (το παλιό `parseFloorLevel` έκανε το «Πυλωτή» ⇒ 0 ⇒ λάθος κωδικό ακινήτου).
 */

import { inferKindFromNumber, isFloorKind, type FloorKind } from '@/utils/floor-naming';

/** Είδη που αποδίδονται χωρίς αριθμό (επώνυμες στάθμες). */
export type NamedFloorKind = Exclude<FloorKind, 'standard'>;

export type FloorRef =
  | { readonly number: number; readonly kind: FloorKind | null }
  | { readonly number: null; readonly kind: NamedFloorKind };

/** Το είδος για προβολή — δηλωμένο, αλλιώς συναγόμενο από τον αριθμό. */
export function resolveFloorKind(ref: FloorRef): FloorKind {
  // `kind === null` στενεύει στο πρώτο σκέλος της ένωσης ⇒ `number: number`.
  if (ref.kind !== null) return ref.kind;
  return inferKindFromNumber(ref.number);
}

/** `FloorRef` από τα πεδία ενός εγγράφου (`number` + προαιρετικό `kind`). `null` αν δεν υπάρχει αριθμός. */
export function floorRefOf(number: number | null | undefined, kind?: FloorKind | null): FloorRef | null {
  if (typeof number !== 'number' || !Number.isInteger(number)) return null;
  return { number, kind: kind ?? null };
}

// ─── Κλειδί στάθμης `αριθμός:είδος` ─────────────────────────────────────────

/**
 * Το **ένα** κλειδί μιας στάθμης: `αριθμός:είδος` (`'0:pilotis'`, `'-1:basement'`, `':roof'`).
 *
 * Πυλωτή και ισόγειο έχουν **και οι δύο** αριθμό 0 — το κλειδί τα κρατά χωριστά. Το είδος είναι το
 * **επιλυμένο** (`resolveFloorKind`) ⇒ `{0, null}` ≡ `{0, 'ground'}`. Το μοιράζονται το φίλτρο ορόφου
 * (`floor-filter`), ο επιλογέας δηλωμένης στάθμης και το κλειδί μονάδας (ADR-900 §8 #2, 2β.2).
 */
export function floorRefKey(ref: FloorRef): string {
  return `${ref.number ?? ''}:${resolveFloorKind(ref)}`;
}

/** Το αντίστροφο του {@link floorRefKey}. Άκυρο κλειδί ⇒ `null`. */
export function parseFloorRefKey(key: string): FloorRef | null {
  const separator = key.indexOf(':');
  if (separator < 0) return null;
  const rawNumber = key.slice(0, separator);
  const kind = key.slice(separator + 1);
  if (!isFloorKind(kind)) return null;
  if (rawNumber === '') return kind === 'standard' ? null : { number: null, kind };
  if (!/^-?\d+$/.test(rawNumber)) return null;
  return { number: Number.parseInt(rawNumber, 10), kind };
}

// ─── Parser παλιών κειμένων ──────────────────────────────────────────────────

/** Πεζά, χωρίς τόνους, ένα κενό — «Υπόγειο -1» ≡ «υπογειο -1». */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\s ]+/g, ' ')
    .trim();
}

/** Επώνυμες στάθμες: el · en · tokens του parking · short codes του `generateAutoShortName`. */
const NAMED: ReadonlyArray<readonly [readonly string[], FloorRef]> = [
  [['ισογειο', 'ground', 'ground floor', 'gf'], { number: 0, kind: 'ground' }],
  [['υπογειο', 'basement'], { number: -1, kind: 'basement' }],
  [['ημιυπογειο', 'semi-basement', 'semi basement', 'semibasement', 'sb'], { number: -1, kind: 'semi-basement' }],
  [['υπερυψωμενο', 'υπερυψωμενο ισογειο', 'raised ground', 'raised ground floor', 'raised-ground', 'rg'],
    { number: 0, kind: 'raised-ground' }],
  [['πυλωτη', 'pilotis', 'pl'], { number: 0, kind: 'pilotis' }],
  [['μεσοπατωμα', 'ημιωροφος', 'mezzanine'], { number: null, kind: 'mezzanine' }],
  [['σοφιτα', 'attic', 'at'], { number: null, kind: 'attic' }],
  [['δωμα', 'ταρατσα', 'roof', 'rooftop', 'r'], { number: null, kind: 'roof' }],
  [['αποληξη κλιμακοστασιου', 'αποληξη', 'stair penthouse', 'stair-penthouse', 'sp'],
    { number: null, kind: 'stair-penthouse' }],
  [['θεμελιωση', 'foundation', 'f'], { number: null, kind: 'foundation' }],
  [['first'], { number: 1, kind: 'standard' }],
];

const NAMED_INDEX: ReadonlyMap<string, FloorRef> = new Map(
  NAMED.flatMap(([tokens, ref]) => tokens.map(token => [token, ref] as const)),
);

/** `[μοτίβο, από αριθμό σε αναφορά]` — η σειρά μετρά μόνο όπου δύο μοτίβα μοιάζουν. */
const PATTERNS: ReadonlyArray<readonly [RegExp, (n: number) => FloorRef]> = [
  [/^[-+]?\d+$/, n => ({ number: n, kind: null })],
  [/^(\d+)\s*(?:ος|ο|η)?\s*οροφος$/, n => ({ number: n, kind: 'standard' })],
  [/^οροφος\s*(\d+)$/, n => ({ number: n, kind: 'standard' })],
  [/^(\d+)\s*(?:st|nd|rd|th)?\s*floor$/, n => ({ number: n, kind: 'standard' })],
  [/^(?:floor|level|l)\s*(\d+)$/, n => ({ number: n, kind: 'standard' })],
  [/^(\d+)\s*ο?\s*υπογειο$/, n => ({ number: -n, kind: 'basement' })],
  [/^υπογειο\s*-?\s*(\d+)$/, n => ({ number: -n, kind: 'basement' })],
  [/^(\d+)\s*(?:st|nd|rd|th)?\s*basement$/, n => ({ number: -n, kind: 'basement' })],
  [/^(?:basement|b)\s*-?\s*(\d+)$/, n => ({ number: -n, kind: 'basement' })],
  [/^(\d+)\s*ο?\s*(?:μεσοπατωμα|ημιωροφος)$/, n => ({ number: n, kind: 'mezzanine' })],
  [/^(?:mezzanine|m)\s*(\d+)$/, n => ({ number: n, kind: 'mezzanine' })],
];

function parseText(text: string): FloorRef | null {
  const value = normalize(text);
  if (value === '') return null;
  const named = NAMED_INDEX.get(value);
  if (named !== undefined) return named;
  for (const [pattern, toRef] of PATTERNS) {
    const match = pattern.exec(value);
    if (match) return toRef(Number.parseInt(match[1] ?? match[0], 10));
  }
  return null;
}

/**
 * Ο **ΕΝΑΣ** parser παλιών τιμών ορόφου: ακέραιος · αριθμητικό κείμενο · ελληνικά/αγγλικά ονόματα ·
 * tokens του parking (`basement-1`, `first`, `rooftop`) · short codes (`GF`, `B2`, `L3`, `M1`, `PL`…).
 * Άγνωστο ⇒ `null`.
 */
export function parseLegacyFloor(raw: unknown): FloorRef | null {
  if (typeof raw === 'number') return Number.isInteger(raw) ? { number: raw, kind: null } : null;
  if (typeof raw !== 'string') return null;
  const parkingToken = /^basement-(\d+)$/i.exec(raw.trim());
  if (parkingToken) return { number: -Number.parseInt(parkingToken[1], 10), kind: 'basement' };
  return parseText(raw);
}
