/**
 * ADR-640 M3 — classify a DXF block NAME for the import Phase-0 preservation gate.
 *
 * AutoCAD names anonymous blocks with a `*<letter><n>` convention. Some are REAL user
 * geometry that must be preserved as a first-class BlockEntity (selectable/movable as one);
 * others are system decorations that already have a dedicated representation and must stay on
 * the legacy flatten path. The pre-M3 gate flattened EVERY `*`-prefixed name — so a furniture
 * `*U#` (anonymous / dynamic block) broke into loose lines/arcs (repro: μπλοκ+γραμμοσκιαση.dxf,
 * INSERT `*U2` @ layer EPIPLA_ON_OFF). Big-player parity (AutoCAD): a `*U#`/`*A#` block reference
 * stays ONE object; only dimension/hatch decoration blocks are exploded.
 *
 * AutoCAD anonymous-block prefixes:
 *   *U#  anonymous / dynamic-block instance          → PRESERVE (furniture, symbols — real geometry)
 *   *A#  anonymous associative-array block (2012+)    → PRESERVE (real repeated geometry)
 *   *E#  anonymous non-uniformly-scaled reference     → PRESERVE (real geometry)
 *   *X#  R12 associative-hatch (exploded pattern)     → FLATTEN (dxf-hatch-xdata-converter owns it)
 *   *D#  associative-dimension geometry               → FLATTEN (the DIMENSION entity owns it)
 *
 * Policy: anonymous blocks are PRESERVED by default (never silently lose real geometry —
 * Revit/AutoCAD behaviour), EXCEPT the small denylist below whose members have a dedicated,
 * non-block scene representation. Future AutoCAD anonymous prefixes for real geometry therefore
 * auto-preserve. SSoT — the single place that maps a block name to preserve/flatten.
 */

/** Anonymous-block prefixes that have a dedicated non-block representation → keep flattening. */
const FLATTEN_ANON_PREFIXES: ReadonlySet<string> = new Set(['*X', '*D']);

/**
 * Should a DXF INSERT with this block name be PRESERVED as a first-class BlockEntity (vs flattened
 * to loose entities)? Named (non-`*`) blocks are always preserved; anonymous blocks are preserved
 * unless they are a known decoration (`*X` hatch / `*D` dimension) handled by a dedicated path.
 *
 * Note: this answers only the name-based question. The caller still gates on non-MINSERT and a
 * successful `createBlockInstance` (renderable members), so a decoration-less empty block still
 * falls back to the flatten path.
 */
export function shouldPreserveBlockName(name: string): boolean {
  if (!name.startsWith('*')) return true; // named block → always preserved
  const prefix = name.slice(0, 2).toUpperCase(); // '*U', '*X', '*D', …
  return !FLATTEN_ANON_PREFIXES.has(prefix);
}

/** True when the block name is one of AutoCAD's anonymous (`*`-prefixed) forms. */
export function isAnonymousBlockName(name: string): boolean {
  return name.startsWith('*');
}
