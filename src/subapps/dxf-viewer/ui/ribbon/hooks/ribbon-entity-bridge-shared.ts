/**
 * Shared primitives for per-entity ribbon bridges (de-dup, ADR-583/597).
 *
 * Every per-entity bridge (`beam` / `mep-boiler` / `wall-covering` / …) exposes the
 * SAME ribbon command surface and resolves its primary-selected entity with the SAME
 * scene lookup. Those two blocks were copy-pasted across the bridges; this module owns
 * them once. Each bridge keeps only its genuinely per-type wiring (dispatchers, catalog
 * branches, per-type command keys).
 */
import { useCallback, useMemo } from 'react';

import type { Entity, AnySceneEntity } from '../../../types/entities';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import { useCommandHistory } from '../../../core/commands';
import { UpdateEntityCommand } from '../../../core/commands/entity-commands/UpdateEntityCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { mmToSceneUnits, resolveSceneUnits } from '../../../utils/scene-units';

/**
 * Type re-exports so every per-entity bridge imports its shared surface from ONE
 * place. Collapses the 4–5 line import cluster (`RibbonComboboxState` +
 * `LevelSceneWriter` + `useUniversalSelection` + the shared-helper import) that
 * jscpd flagged as a near-verbatim clone across the bridges (N.18).
 */
export type { RibbonComboboxState } from '../context/RibbonCommandContext';
export type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';

/** The selection surface a per-entity bridge needs to resolve its primary entity. */
export type PrimaryIdSelection = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId'
>;

/** The ribbon command surface shared by every per-entity bridge. */
export interface RibbonEntityBridgeCore {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly onAction: (action: string) => void;
  /**
   * Panel visibility resolver. `true` when the panel must show; keys outside the
   * entity's visibility set → `true` (no-op).
   */
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

/**
 * `RibbonEntityBridgeCore` without the toggle pair, for the per-entity bridges
 * whose command surface is comboboxes + actions only (no toggle commands) and
 * so skip `useNoopToggles` entirely (`mep-water-heater` / `mep-underfloor`).
 * Collapses the byte-identical 4-member interface literal jscpd flagged as a
 * clone across those bridges (N.18).
 */
export type RibbonEntityBridgeCoreNoToggles = Omit<
  RibbonEntityBridgeCore,
  'onToggle' | 'getToggleState'
>;

type PrimaryIdSource = Pick<ReturnType<typeof useUniversalSelection>, 'getPrimaryId'>;
type SceneReader = Pick<LevelSceneWriter, 'currentLevelId' | 'getLevelScene'>;

/**
 * Resolve the primary-selected entity narrowed to a specific BIM type. Returns null
 * when there is no active level, no scene, no primary selection, or the primary
 * selection is not of the guarded type.
 */
export function useResolveSelectedEntity<T extends Entity>(
  levelManager: SceneReader,
  universalSelection: PrimaryIdSource,
  guard: (entity: Entity) => entity is T,
): () => T | null {
  return useCallback((): T | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const entity = scene.entities.find((x) => x.id === id);
    if (!entity || !guard(entity)) return null;
    return entity;
  }, [levelManager, universalSelection, guard]);
}

/** AutoCAD object transparency range: 0 (opaque) .. 90 (90% transparent). */
const TRANSPARENCY_MAX = 90;

/**
 * Combobox display value for an entity's transparency (0 = opaque). Shared by the
 * line-tool + hatch bridges (`transparency` lives on `BaseEntity` → every entity
 * exposes it), so both read it the same way (N.18 — one definition).
 */
export function entityTransparencyValue(entity: AnySceneEntity): string {
  const raw = (entity as { transparency?: number }).transparency;
  return String(typeof raw === 'number' ? raw : 0);
}

/** Clamp typed transparency to the AutoCAD 0..90 integer range. */
export function clampTransparency(n: number): number {
  return Math.max(0, Math.min(TRANSPARENCY_MAX, Math.round(n)));
}

/** A ribbon toggle that is always `false` (bridges with no toggle commands). */
const NULL_TOGGLE: RibbonToggleState = false;

/** The toggle half of {@link RibbonEntityBridgeCore}. */
export interface RibbonNoopToggles {
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
}

/**
 * Shared no-op toggle pair. Many per-entity bridges expose the `onToggle` /
 * `getToggleState` surface purely for interface parity (their commands are
 * comboboxes / actions, never toggles). Each copy-pasted the identical inert
 * pair + a per-file `NULL_TOGGLE` const; this owns it once (N.18).
 */
export function useNoopToggles(): RibbonNoopToggles {
  const onToggle = useCallback((_commandKey: string, _nextValue: boolean): void => {
    /* no-op — bridge has no toggle commands */
  }, []);
  const getToggleState = useCallback((_commandKey: string): RibbonToggleState => NULL_TOGGLE, []);
  return { onToggle, getToggleState };
}

/** Minimal validation shape every BIM entity exposes for badge surfacing. */
type ValidatedEntity = { readonly validation: { readonly hasCodeViolations: boolean } };

/**
 * Shared `getBadgeState` resolver for the single «code violations» badge that
 * every structural bridge (column / slab / wall / beam / …) surfaces the same
 * way: `true` iff `badgeKey` is the owned violation key AND the primary-selected
 * entity currently reports `validation.hasCodeViolations`. Keys outside
 * `ownedBadgeKeys` → `false` (composes in `useRibbonCommands` without collisions).
 */
export function useViolationBadgeState<T extends ValidatedEntity>(
  resolve: () => T | null,
  ownedBadgeKeys: ReadonlySet<string>,
  violationBadgeKey: string,
): (badgeKey: string) => boolean {
  return useCallback((badgeKey: string): boolean => {
    if (!ownedBadgeKeys.has(badgeKey)) return false;
    const entity = resolve();
    if (!entity) return false;
    if (badgeKey === violationBadgeKey) return entity.validation.hasCodeViolations;
    return false;
  }, [resolve, ownedBadgeKeys, violationBadgeKey]);
}

/**
 * Memoize the assembled bridge object so `RibbonCommandProvider` deps stay
 * stable (ADR-040 Phase XIX — a non-memoized return literal caused a 14/28
 * commit re-render cascade). Every member is already individually memoized
 * (`useCallback`), so `Object.values` yields a stable-length dep list per call
 * site and the assembled identity only changes when a member does. Replaces the
 * per-bridge `return useMemo(() => ({…}), […])` copy (N.18).
 */
export function useStableBridge<T extends object>(members: T): T {
  const memberValues = Object.values(members);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => members, memberValues);
}

/** Full scene-writer surface needed to build a command scene-manager adapter. */
type SceneManagerSource = Pick<
  LevelSceneWriter,
  'currentLevelId' | 'getLevelScene' | 'setLevelScene'
>;

/** The cached `LevelSceneManagerAdapter` returned for the active level. */
type ActiveSceneManager = ReturnType<typeof createLevelSceneManagerAdapter>;

/**
 * Build the cached `LevelSceneManagerAdapter` for the active level, or null when
 * there is no active level. Every per-entity command bridge (`stair` / `wall` /
 * `slab` / `mep-*` / …) opened its `dispatchParams` with the identical
 * `if (!currentLevelId) return; const sm = createLevelSceneManagerAdapter(…)`
 * preamble; this owns it once (N.18). Callers build their per-type command from `sm`.
 */
export function useActiveSceneManager(
  levelManager: SceneManagerSource,
): () => ActiveSceneManager | null {
  return useCallback((): ActiveSceneManager | null => {
    if (!levelManager.currentLevelId) return null;
    return createLevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);
}

/**
 * Ribbon I/O is normalized to millimetres so the hardcoded combobox options line
 * up with the displayed current value. Resolves the mm→scene-units scale for the
 * active level (falls back to the `mm` scale when there is no scene). Extracted
 * from the byte-identical `getSceneUnitsScale` in the stair + wall bridges (N.18).
 */
export function useSceneUnitsScale(levelManager: SceneReader): () => number {
  return useCallback((): number => {
    const lid = levelManager.currentLevelId;
    if (!lid) return mmToSceneUnits('mm');
    const scene = levelManager.getLevelScene(lid);
    return mmToSceneUnits(resolveSceneUnits(scene));
  }, [levelManager]);
}

/**
 * Dispatch a generic `UpdateEntityCommand` patch for the dual-mode "selected
 * entity" bridges (`annotation-symbol` / `scale-bar` / …). Each copy-pasted the
 * identical `createLevelSceneManagerAdapter` + `executeCommand(new
 * UpdateEntityCommand(...))` dispatcher, differing only by the undo label; this
 * owns it once (N.18).
 */
export function useUpdateEntityPatch(
  levelManager: SceneManagerSource,
  undoLabel: string,
): (entityId: string, patch: Record<string, unknown>) => void {
  const { execute: executeCommand } = useCommandHistory();
  const buildSceneManager = useActiveSceneManager(levelManager);
  return useCallback(
    (entityId: string, patch: Record<string, unknown>): void => {
      const sm = buildSceneManager();
      if (!sm) return;
      executeCommand(new UpdateEntityCommand(entityId, patch, sm, undoLabel));
    },
    [executeCommand, buildSceneManager, undoLabel],
  );
}

/**
 * Read a numeric `params` field as ribbon combobox state (`{ value, options: [] }`),
 * or null when the key is unmapped / the field is non-numeric. The command-param
 * bridges (`electrical-panel` / `mep-manifold` / …) all mapped `commandKey →
 * numeric field` and rounded for display the same way; this owns the read once (N.18).
 */
export function readNumericParamState<P>(
  params: P,
  commandKey: string,
  keyToField: Readonly<Record<string, keyof P>>,
): RibbonComboboxState | null {
  const field = keyToField[commandKey];
  if (field === undefined) return null;
  const raw = params[field];
  if (typeof raw !== 'number') return null;
  return { value: String(Math.round(raw)), options: [] };
}

/** The full inert command surface for a bridge with no toggles/actions/panels. */
export interface RibbonInertBridgeExtras extends RibbonNoopToggles {
  readonly onAction: (action: string) => void;
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

/**
 * The inert tail shared by the tool-active «pick a style → place» bridges
 * (`annotation-symbol` / `scale-bar` / `floorplan-symbol` / `furniture` /
 * `mep-fixture-library`): no-op toggles, a no-op `onAction` (the tab auto-hides
 * when neither an entity is selected nor the tool active), and an always-visible
 * `getPanelVisibility`. Each copy-pasted the identical four-member tail; this owns
 * it once (N.18).
 */
export function useInertBridgeExtras(): RibbonInertBridgeExtras {
  const { onToggle, getToggleState } = useNoopToggles();
  const onAction = useCallback((_action: string): void => {
    /* no-op — the tab auto-hides when neither an entity is selected nor the tool active */
  }, []);
  const getPanelVisibility = useCallback((_visibilityKey: string): boolean => true, []);
  return { onToggle, getToggleState, onAction, getPanelVisibility };
}
