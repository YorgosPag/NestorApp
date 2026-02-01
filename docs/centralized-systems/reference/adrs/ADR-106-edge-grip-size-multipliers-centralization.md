# ADR-106: Edge Grip Size Multipliers Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Drawing System |
| **Canonical Location** | `EDGE_GRIP_SIZE_MULTIPLIERS` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `EDGE_GRIP_SIZE_MULTIPLIERS` from `rendering/grips/constants.ts`
- **Impact**: Fixed **hardcoded edge grip multipliers** in LayerRenderer (1.4/1.6)
- **Standard Values** (Edge-specific, larger than vertex grips):
  - `COLD`: 1.0 (normal state)
  - `WARM`: 1.4 (hover state, +40% - more dramatic than vertex +25%)
  - `HOT`: 1.6 (active/drag state, +60% - more dramatic than vertex +50%)
- **Rationale**: Edge grips are rendered on thin edge lines, so they need larger multipliers for visible hover/active feedback
- **Files Changed**:
  - `rendering/grips/constants.ts` - Added `EDGE_GRIP_SIZE_MULTIPLIERS` (+16 lines)
  - `rendering/grips/index.ts` - Export added
  - `canvas-v2/layer-canvas/LayerRenderer.ts` - Replaced hardcoded 1.4/1.6 with centralized constants
- **Consistency Table**:
  | Grip Type | COLD | WARM | HOT | Source |
  |-----------|------|------|-----|--------|
  | **Vertex** | 1.0 | 1.25 | 1.5 | `GRIP_SIZE_MULTIPLIERS` |
  | **Edge** | 1.0 | 1.4 | 1.6 | `EDGE_GRIP_SIZE_MULTIPLIERS` |
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero hardcoded edge grip multipliers
  - Consistent with vertex grip centralization (ADR-075)
  - Single place to adjust edge grip visual feedback
- **Companion**: ADR-075 (Grip Size Multipliers), ADR-048 (Unified Grip Rendering System)
