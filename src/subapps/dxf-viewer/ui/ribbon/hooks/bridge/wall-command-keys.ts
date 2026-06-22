/**
 * ADR-363 Phase 1 — Wall contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data
 * declaration (`contextual-wall-tab.ts`) and the bridge mappings (Phase 1.5
 * `useRibbonWallBridge`). Mirrors `STAIR_RIBBON_KEYS` pattern.
 *
 * Phase 1 wires only the keys needed by the contextual tab. Bridge listener
 * implementation lands Phase 1.5 when wall update operations exist; until
 * then the events are emitted but no-op.
 */

export const WALL_RIBBON_KEYS = {
  stringParams: {
    /** Wall category selector (5 options: exterior/interior/partition/parapet/fence). */
    category: 'wall.params.category',
    /** Material key (rc/masonry/aerated-concrete/gypsum). DNA walls ignore this. */
    material: 'wall.params.material',
    /** ADR-396 v2 Φ6a — ETICS envelope-function override (auto/exterior/interior). */
    envelopeFunction: 'wall.params.envelopeFunction',
  },
  params: {
    /** mm — wall height. */
    height: 'wall.params.height',
    /** mm — wall thickness (read-only display when dna present; SSoT = dna.totalThickness). */
    thickness: 'wall.params.thickness',
  },
  toggles: {
    /** Exterior-face flip selector. */
    flip: 'wall.params.flip',
  },
  // ─── ADR-404 Phase 5b — κεκλιμένος (battered) τοίχος ──────────────────────
  // 1-DOF lean ⟂ στη φορά start→end. Το signed `tilt.angle` (SSoT `wall-tilt.ts`)
  // εκφράζεται στο UI ως **μέγεθος** (`tiltAngle`, 0..80°) + **πλευρά** (`tiltSide`,
  // left/right). Drawing-mode → tool overrides· selected → params.tilt. Logic SSoT =
  // `wall-tilt-param.ts` (μηδέν διπλό μέσα στους generic param-helpers).
  tilt: {
    /** on/off — κεκλιμένος ή κατακόρυφος. */
    enabled: 'wall.params.tiltEnabled',
    /** left/right — πλευρά κλίσης (πρόσημο του signed angle). */
    side: 'wall.params.tiltSide',
    /** deg — μέγεθος γωνίας από κατακόρυφο (0..80, unsigned· πρόσημο από `side`). */
    angle: 'wall.params.tiltAngle',
  },
} as const;

export type WallRibbonNumberCommandKey =
  | typeof WALL_RIBBON_KEYS.params.height
  | typeof WALL_RIBBON_KEYS.params.thickness;

export type WallRibbonStringCommandKey =
  | typeof WALL_RIBBON_KEYS.stringParams.category
  | typeof WALL_RIBBON_KEYS.stringParams.material
  | typeof WALL_RIBBON_KEYS.stringParams.envelopeFunction;

export type WallRibbonToggleCommandKey =
  | typeof WALL_RIBBON_KEYS.toggles.flip;

export const WALL_RIBBON_NUMBER_KEYS: readonly WallRibbonNumberCommandKey[] = [
  WALL_RIBBON_KEYS.params.height,
  WALL_RIBBON_KEYS.params.thickness,
];

export const WALL_RIBBON_STRING_KEYS: readonly WallRibbonStringCommandKey[] = [
  WALL_RIBBON_KEYS.stringParams.category,
  WALL_RIBBON_KEYS.stringParams.material,
  WALL_RIBBON_KEYS.stringParams.envelopeFunction,
];

export const WALL_RIBBON_TOGGLE_KEYS: readonly WallRibbonToggleCommandKey[] = [
  WALL_RIBBON_KEYS.toggles.flip,
];

export const WALL_RIBBON_KEYS_ACTIONS = {
  close: 'wall.actions.close',
  delete: 'wall.actions.delete',
  // ADR-401 Phase E.1 — manual detach of wall top/base from a structural host.
  detachTop: 'wall.actions.detachTop',
  detachBase: 'wall.actions.detachBase',
  // ADR-441 Slice GEN-WALL / 3-mode — «Τοίχοι από κάναβο». main = inner (default)·
  // variants = Wall Location Line (Εσωτερικά/Κεντρικά/Εξωτερικά).
  fromGrid: 'wall.actions.fromGrid',
  fromGridCenter: 'wall.actions.fromGridCenter',
  fromGridOuter: 'wall.actions.fromGridOuter',
} as const;

const WALL_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(WALL_RIBBON_KEYS_ACTIONS),
);

export function isWallActionKey(action: string): boolean {
  return WALL_ACTION_KEY_SET.has(action);
}

/** Visibility key (red badge when `validation.hasCodeViolations === true`). */
export const WALL_RIBBON_BADGE_KEYS = {
  violations: 'wall.badge.violations',
} as const;

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

const WALL_NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>(WALL_RIBBON_NUMBER_KEYS);
const WALL_STRING_KEY_SET: ReadonlySet<string> = new Set<string>(WALL_RIBBON_STRING_KEYS);
const WALL_TOGGLE_KEY_SET: ReadonlySet<string> = new Set<string>(WALL_RIBBON_TOGGLE_KEYS);

export function isWallRibbonKey(commandKey: string): boolean {
  return WALL_NUMBER_KEY_SET.has(commandKey);
}

export function isWallRibbonStringKey(commandKey: string): boolean {
  return WALL_STRING_KEY_SET.has(commandKey);
}

export function isWallRibbonToggleKey(commandKey: string): boolean {
  return WALL_TOGGLE_KEY_SET.has(commandKey);
}

// ─── ADR-404 Phase 5b — tilt key set + guard ─────────────────────────────────

/** Τα 3 command keys της κλίσης (enabled/side/angle). Διακριτό set ώστε ο bridge να
 *  τα δρομολογεί στον dedicated `wall-tilt-param` resolver, ΟΧΙ στους generic helpers. */
export const WALL_RIBBON_TILT_KEYS = [
  WALL_RIBBON_KEYS.tilt.enabled,
  WALL_RIBBON_KEYS.tilt.side,
  WALL_RIBBON_KEYS.tilt.angle,
] as const;

const WALL_TILT_KEY_SET: ReadonlySet<string> = new Set<string>(WALL_RIBBON_TILT_KEYS);

export function isWallTiltKey(commandKey: string): boolean {
  return WALL_TILT_KEY_SET.has(commandKey);
}
