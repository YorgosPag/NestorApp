# ADR-002: Enterprise Z-Index Hierarchy

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Design System |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Source**: `design-tokens.json` → CSS variables
- **Pattern**: `var(--z-index-*)` for all z-index values
- **Prohibited**: Hardcoded z-index (e.g., `z-[9999]`)

### DXF Viewer Exception

The DXF Viewer subapp uses `MODAL_Z_INDEX` from `dxf-viewer/config/modal-config.ts` for z-index management. This is a parallel system because WebGL/Canvas overlays require z-index values at the browser maximum (`2147483647`) that exceed the design-tokens range.

| Key | Value | Usage |
|-----|-------|-------|
| `COLOR_DIALOG_CONTAINER` | `2147483646` | Color dialog backdrop (just below max) |
| `COLOR_DIALOG` | `2147483647` | Color dialog content (maximum z-index) |

**Updated 2026-02-12**: `EnterpriseColorDialog.tsx` migrated from hardcoded values to `MODAL_Z_INDEX` constants.
