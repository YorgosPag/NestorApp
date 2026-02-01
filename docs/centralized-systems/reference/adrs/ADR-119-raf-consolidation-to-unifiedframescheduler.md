# ADR-119: RAF Consolidation to UnifiedFrameScheduler

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Performance |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ IMPLEMENTED (2026-02-01)
- **Decision**: All RAF loops must use `UnifiedFrameScheduler` instead of parallel `requestAnimationFrame()` calls
- **Problem**: Multiple parallel RAF loops competing for resources:
  - `UnifiedFrameScheduler` - Main render loop ✅
  - `DxfPerformanceOptimizer` - FPS measurement loop ❌ DUPLICATE
  - `SmartBoundsManager` - Nested RAF for fit-to-view ❌ DUPLICATE
  - `CanvasSection` - Double-RAF for viewport layout ❌ DUPLICATE
  - `useCentralizedMouseHandlers` - Panning (keep separate - high-frequency state updates)
  - `useEntityDrag` - Throttling (keep separate - state updates, not rendering)
- **Solution**:
  - `DxfPerformanceOptimizer` now uses `UnifiedFrameScheduler.onFrame()` instead of own RAF loop
  - Added `scheduleOnce()` and `scheduleOnceDelayed()` APIs to UnifiedFrameScheduler
  - `SmartBoundsManager` migrated to use `scheduleOnceDelayed()` for fit-to-view
  - `CanvasSection` migrated to use `scheduleOnceDelayed()` for viewport layout
  - Panning/drag RAF loops remain separate (high-frequency state updates, risky to consolidate)
- **New APIs Added** (2026-02-01):
  - `scheduleOnce(id, callback)` - One-shot RAF for next frame
  - `scheduleOnceDelayed(id, callback, delayMs)` - RAF → setTimeout → RAF pattern
  - `cancelOnce(id)` - Cancel pending one-shot callback
- **Changes Made**:
  - `UnifiedFrameScheduler.ts`: Added scheduleOnce/scheduleOnceDelayed APIs
  - `DxfPerformanceOptimizer.ts`: Removed `measureFPS()` RAF loop, now subscribes to scheduler metrics
  - `SmartBoundsManager.ts`: Replaced nested RAF with scheduleOnceDelayed()
  - `CanvasSection.tsx`: Replaced double-RAF pattern with scheduleOnceDelayed()
- **Benefits**:
  - Reduced from 5+ parallel RAF loops to 1 central + 2 specialized
  - More accurate FPS measurement (60-frame rolling average from scheduler)
  - Reduced CPU overhead from competing RAF loops
  - Centralized cleanup and coordination for one-shot operations
- **Companion**: ADR-030 (Unified Frame Scheduler), ADR-019 (Performance Thresholds)
