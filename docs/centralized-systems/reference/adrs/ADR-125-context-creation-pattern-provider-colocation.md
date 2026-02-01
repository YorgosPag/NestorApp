# ADR-125: Context Creation Pattern (Provider Colocation)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-02-01 |
| **Category** | Data & State |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ APPROVED
- **Date**: 2026-02-01
- **Problem**: Production error "Cannot read properties of null (reading 'Provider')"
- **Root Cause**: Context created in different file than Provider component. Bundle optimization can reorder module evaluation, causing context to be `null` when Provider tries to use it.
- **Decision**: Context MUST be created in SAME file as Provider component (colocation pattern)
- **Pattern**: Autodesk/Microsoft/Google enterprise standard
- **Files Fixed**:
  - `RulersGridContext` → moved to `systems/rulers-grid/RulersGridSystem.tsx`
  - `LevelsContext` → moved to `systems/levels/LevelsSystem.tsx`
- **Backward Compatibility**: Re-exports in original files (`useRulersGrid.ts`, `useLevels.ts`) with lazy loading to prevent circular dependencies
- **Implementation**:
  - Create context in Provider file: `export const MyContext = React.createContext<Type | null>(null);`
  - Re-export from hook file: `export { MyContext } from './MySystem';`
  - Use lazy loading for internal hook reference to prevent circular deps
- **Verification**:
  - TypeScript: `npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json`
  - Production Build: `npm run build` (no "Provider is null" errors)
  - Runtime: Grid toggle ON/OFF, Rulers toggle ON/OFF, Level switching
- **Risk Level**: LOW (structural change with full backward compatibility)
- **Companion**: ADR-010 (Panel Type Centralization), ADR-030 (Data & State)

---
