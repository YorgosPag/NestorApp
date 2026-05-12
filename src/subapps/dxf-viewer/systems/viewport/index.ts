/**
 * ADR-344 Phase 11 — Viewport system public surface.
 *
 * `ViewportStore`: plain singleton, annotation scale SSoT.
 * `ViewportContext`: React hook layer (useSyncExternalStore).
 * `standard-scales`: AutoCAD-standard preset catalog.
 */

export * from './ViewportStore';
export * from './ViewportContext';
export * from './standard-scales';
