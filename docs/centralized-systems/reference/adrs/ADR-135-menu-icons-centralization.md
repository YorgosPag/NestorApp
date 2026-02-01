# ADR-135: Menu Icons Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | UI Components |
| **Canonical Location** | `src/subapps/dxf-viewer/ui/icons/MenuIcons.tsx` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: SVG icons για context menus ορίζονταν inline σε κάθε component (hardcoded strokeWidth)
- **Decision**: Κεντρικοποίηση όλων των menu icons σε ένα αρχείο με χρήση PANEL_LAYOUT.SVG_ICON tokens
- **Canonical Location**: `src/subapps/dxf-viewer/ui/icons/MenuIcons.tsx`
- **Icons Centralized**:
  - **Zoom Icons**: FitIcon, ZoomInIcon, ZoomOutIcon, Zoom100Icon, HistoryIcon, OriginMarkerIcon
  - **Drawing Icons**: EnterIcon, ClosePolygonIcon, UndoIcon, CancelIcon, FlipArcIcon
- **Files Updated**: RulerCornerBox.tsx, DrawingContextMenu.tsx
- **Result**: ~70 γραμμές inline code αφαιρέθηκαν, χρήση centralized strokeWidth tokens

---
