/**
 * USE POLYGON AREA TOOL — Cluster #17 SSoT (ADR-626)
 *
 * Domain-wrapper hook shared by every N-click **closed-area** drawing tool
 * (Floor-Finish / Roof / Underfloor-heating — all «by boundary» footprint tools).
 * Sits on top of the canonical vertex-chain FSM {@link usePolygonSketchChain}
 * (ADR-363 — the SAME engine slab/column/stair already use, incl. Revit-grade
 * face-snap of each vertex to wall/column faces) and adds ONLY the per-tool domain
 * scaffolding the FSM intentionally does not own (ADR-363 ownership boundary):
 *   - `overrides` + `error` domain state
 *   - the single-writer live-preview store (footprint rubber-band)
 *   - `setParamOverrides` (Dynamic-Input field merge)
 *   - `getStatusText` (i18n status keys)
 *   - build + validate + commit (`commitEntity` → the tool's builders)
 *
 * Before this, Floor-Finish/Roof/Underfloor each re-implemented the whole FSM
 * (their headers literally read «clone of useRoofTool/useSlabTool»); Floor-Finish
 * and Underfloor also lacked the face-snap that Roof/Slab had — a consistency
 * defect, not a design choice. Big-player practice (Revit Floor/Roof by boundary
 * Sketch Mode, C4D spline, Figma pen) snaps boundary vertices to existing geometry
 * uniformly, so adopting the shared engine gives face-snap parity for free.
 *
 * @module hooks/drawing/use-polygon-area-tool
 * @see hooks/drawing/use-polygon-sketch-chain — canonical vertex-chain FSM (ADR-363)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import { usePolygonSketchChain, type PolygonSketchPhase } from './use-polygon-sketch-chain';

/** Single-writer live-preview store for the in-progress footprint. */
export interface PolygonAreaPreviewStore {
  set(payload: { vertices: readonly Point2D[] }): void;
  reset(): void;
}

/** Discriminated build result — the superset every area builder returns. */
export type PolygonAreaBuildResult<TEntity> =
  | { readonly ok: true; readonly entity: TEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/** i18n status keys for the two active FSM phases. */
export interface PolygonAreaStatusKeys {
  readonly first: string;
  readonly next: string;
}

export interface UsePolygonAreaToolConfig<TOverrides extends object, TEntity> {
  /** Single-writer live-preview store for the in-progress footprint. */
  readonly previewStore: PolygonAreaPreviewStore;
  /**
   * Build + validate the entity from the closed vertex list (the params step is
   * folded into the binding). `ok:false` keeps the FSM in `awaitingNextVertex`.
   */
  readonly commitEntity: (
    vertices: readonly Point2D[],
    overrides: TOverrides,
    sceneUnits: SceneUnits,
    levelId: string,
  ) => PolygonAreaBuildResult<TEntity>;
  /** i18n status keys shown per active phase. */
  readonly statusKeys: PolygonAreaStatusKeys;
  /** Initial / on-deactivate overrides (default `{}`). */
  readonly initialOverrides?: TOverrides;
  // ── options forwarded verbatim from the tool binding ──
  readonly onCreated?: (entity: TEntity) => void;
  readonly currentLevelId?: string;
  readonly getAutoCloseTolerance?: () => number;
  readonly getSceneUnits?: () => SceneUnits;
  /** Live scene entities for the vertex face-snap (flush to member faces). */
  readonly getSceneEntities?: () => readonly Entity[];
}

export interface PolygonAreaToolState<TOverrides> {
  readonly phase: PolygonSketchPhase;
  readonly vertices: readonly Point2D[];
  readonly overrides: TOverrides;
  readonly error: string | null;
}

export interface PolygonAreaToolResult<TOverrides> {
  readonly state: PolygonAreaToolState<TOverrides>;
  activate(): void;
  deactivate(): void;
  reset(): void;
  /** Returns true if the click advanced/committed the FSM. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** Commit-and-finish (Enter path). Returns true on commit. */
  finishPolygon(): boolean;
  /** Dynamic-Input field overrides (merged into current overrides). */
  setParamOverrides(overrides: Partial<TOverrides>): void;
  /** Status text for status-bar / Dynamic-Input prompt (i18n key). */
  getStatusText(): string;
  readonly isActive: boolean;
  readonly isAwaitingFirstVertex: boolean;
  readonly isAwaitingNextVertex: boolean;
}

export function usePolygonAreaTool<TOverrides extends object, TEntity>(
  config: UsePolygonAreaToolConfig<TOverrides, TEntity>,
): PolygonAreaToolResult<TOverrides> {
  const {
    previewStore, commitEntity, statusKeys, initialOverrides = {} as TOverrides,
    onCreated, currentLevelId = '0', getAutoCloseTolerance, getSceneUnits, getSceneEntities,
  } = config;

  // Domain state the FSM primitive intentionally does NOT own (ADR-363 boundary).
  const [overrides, setOverrides] = useState<TOverrides>(initialOverrides);
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  // Latest initial-overrides read via ref so `deactivate` stays reference-stable
  // even when the caller passes a fresh object literal each render (the default
  // `{}` does). Without this, `deactivate`'s identity churns → useToolLifecycle's
  // effect re-fires every render → setOverrides(new {}) → infinite update loop.
  const initialOverridesRef = useRef(initialOverrides);
  initialOverridesRef.current = initialOverrides;
  const [error, setError] = useState<string | null>(null);

  // ── commit closure → FSM `onCommit` (false keeps awaitingNextVertex for a fix) ──
  const onCommit = useCallback(
    (vertices: readonly Point2D[]): boolean => {
      const sceneUnits: SceneUnits = getSceneUnits?.() ?? 'mm';
      const result = commitEntity(vertices, overridesRef.current, sceneUnits, currentLevelId);
      if (!result.ok) {
        setError(result.hardErrors[0] ?? null);
        return false;
      }
      onCreated?.(result.entity);
      return true;
    },
    [commitEntity, getSceneUnits, currentLevelId, onCreated],
  );

  const chain = usePolygonSketchChain({ onCommit, getSceneUnits, getSceneEntities, getAutoCloseTolerance });
  const { phase, vertices } = chain;

  // ── live footprint preview (single-writer, mirrors phase/vertices) ──
  useEffect(() => {
    if (phase === 'idle') {
      previewStore.reset();
      return;
    }
    previewStore.set({ vertices });
  }, [phase, vertices, previewStore]);
  useEffect(() => () => previewStore.reset(), [previewStore]);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // ── lifecycle (error cleared on entry; overrides preserved except on deactivate) ──
  const activate = useCallback(() => { setError(null); chain.activate(); }, [chain.activate]);
  const deactivate = useCallback(() => {
    setError(null);
    setOverrides(initialOverridesRef.current);
    chain.deactivate();
  }, [chain.deactivate]);
  const reset = useCallback(() => { setError(null); chain.reset(); }, [chain.reset]);

  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      setError(null);
      return chain.onCanvasClick(point);
    },
    [chain.onCanvasClick],
  );

  const setParamOverrides = useCallback((partial: Partial<TOverrides>) => {
    setOverrides((prev) => ({ ...prev, ...partial }));
  }, []);

  const getStatusText = useCallback((): string => {
    switch (phaseRef.current) {
      case 'awaitingFirstVertex': return statusKeys.first;
      case 'awaitingNextVertex': return statusKeys.next;
      default: return '';
    }
  }, [statusKeys]);

  return {
    state: { phase, vertices, overrides, error },
    activate,
    deactivate,
    reset,
    onCanvasClick,
    finishPolygon: chain.finishPolygon,
    setParamOverrides,
    getStatusText,
    isActive: chain.isActive,
    isAwaitingFirstVertex: chain.isAwaitingFirstVertex,
    isAwaitingNextVertex: chain.isAwaitingNextVertex,
  };
}
