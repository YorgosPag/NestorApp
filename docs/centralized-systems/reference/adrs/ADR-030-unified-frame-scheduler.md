# ADR-030: Unified Frame Scheduler

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-02-01 |
| **Category** | Performance |
| **Canonical Location** | `UnifiedFrameScheduler` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `UnifiedFrameScheduler` singleton from `rendering/core/UnifiedFrameScheduler.ts`
- **Pattern**: Single RAF loop with priority queue (Autodesk/Adobe pattern)
- **Features**:
  - Priority-based render queue (CRITICAL → BACKGROUND)
  - Dirty flag aggregation from multiple sources
  - Frame skipping optimization under load
  - Performance metrics collection via `getMetrics()`
  - Auto-start/stop based on registered systems
- **API**:
  - `UnifiedFrameScheduler.register(id, name, priority, render, isDirty?)` - Register render system
  - `UnifiedFrameScheduler.getMetrics()` - Get current FPS, frame timing
  - `UnifiedFrameScheduler.onFrame(callback)` - Subscribe to frame metrics
- **Consumers** (2026-02-01):
  - `DxfPerformanceOptimizer.ts` - Uses `onFrame()` for FPS tracking instead of parallel RAF loop
  - (Migrated: Removed duplicate `requestAnimationFrame(measureFPS)` loop)
- **Consumers** (added 2026-05-27 via ADR-040 Phase XXIII / ADR-366 Phase 4.2 closure):
  - `bim-3d/scene/ThreeJsSceneManager` — registered as `'bim-3d-scene'` system (NORMAL priority) by `BimViewport3D` on mount; provides `tick(now, delta)` callback + `isSceneDirty()` dirty-check (5-input OR via `scene-dirty-state.ts` SSoT). Replaces the parallel persistent `startLoop()` rAF that ran concurrently with the master scheduler. Pre-commit ratchet: `.ssot-registry.json#frame-scheduler-master-raf` blocks reintroduction of `this.rafHandle = requestAnimationFrame` outside the canonical scheduler.
- **Companion**: ADR-119 (RAF Consolidation), ADR-040 §"Phase XXIII — Single rAF SSoT Consolidation (BIM 3D)", ADR-366 §Phase 4.2 (closure note)
