# ADR-151: Grip Tolerance Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `TOLERANCE_CONFIG.GRIP_APERTURE` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `TOLERANCE_CONFIG.GRIP_APERTURE` from `config/tolerance-config.ts`
- **Decision**: Centralize grip detection tolerance (8 pixels) to single source of truth
- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: Duplicate hardcoded `tolerance: number = 8` for grip detection in 3 files:
  - `utils/entity-renderer.ts:93` - `findGripAtPoint(..., tolerance: number = 8)`
  - `systems/grip-interaction/GripInteractionManager.ts:72` - `checkGripHover(..., tolerance: number = 8)`
  - `rendering/core/EntityRendererComposite.ts:117` - `findGripAtPoint(..., tolerance: number = 8)`
  - Risk: Inconsistent grip detection behavior if values diverge
- **Solution**: Use existing `TOLERANCE_CONFIG.GRIP_APERTURE: 8` constant:
  ```typescript
  // 🏢 ADR-151: Centralized grip tolerance
  import { TOLERANCE_CONFIG } from '../config/tolerance-config';

  findGripAtPoint(..., tolerance: number = TOLERANCE_CONFIG.GRIP_APERTURE): GripInfo | null
  ```
- **Files Migrated** (3 files):
  - `utils/entity-renderer.ts`:
    - Before: `findGripAtPoint(..., tolerance: number = 8)`
    - After: `findGripAtPoint(..., tolerance: number = TOLERANCE_CONFIG.GRIP_APERTURE)`
  - `systems/grip-interaction/GripInteractionManager.ts`:
    - Before: `checkGripHover(..., tolerance: number = 8)`
    - After: `checkGripHover(..., tolerance: number = TOLERANCE_CONFIG.GRIP_APERTURE)`
  - `rendering/core/EntityRendererComposite.ts`:
    - Before: `findGripAtPoint(..., tolerance: number = 8)`
    - After: `findGripAtPoint(..., tolerance: number = TOLERANCE_CONFIG.GRIP_APERTURE)`
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Consistent grip detection tolerance across all components
  - Single place to adjust grip aperture size
  - Uses existing centralized constant (no new file created)
  - Follows established TOLERANCE_CONFIG pattern (ADR-105, ADR-147)
- **Companion**: ADR-105 (Hit Test Tolerance), ADR-147 (Hit Tolerance Centralization)
