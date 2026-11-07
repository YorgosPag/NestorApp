# ADR-050: Unified Toolbar Integration

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | UI Components |
| **Canonical Location** | `EnhancedDXFToolbar` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `EnhancedDXFToolbar` with collapsible sections
- **Pattern**: AutoCAD Ribbon pattern

---

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-11-07 | **Η κανονική θέση άλλαξε (ADR-933).** Το `EnhancedDXFToolbar` (που φιλοξενούσε το `OverlayToolbarSection`) διαγράφηκε στο `c63144b7` (2026-05-14, «ribbon handles all actions»), αλλά η κορδέλα δεν πήρε ποτέ αντίστοιχη εντολή — το είδος περιοχής έμεινε ανεπίλεκτο έξι μήνες. Η επιλογή είδους + μεθόδου γεωμετρίας ζει πλέον στην contextual καρτέλα **«Περιοχή»** (`contextual-overlay-region-tab.ts`), που ξαναχρησιμοποιεί το `KindSelector`. Τα `OverlayToolbarSection`, `DraggableOverlayToolbar` (σημαία `USE_UNIFIED_OVERLAY_TOOLBAR`), `OverlayToolbar*.tsx` μένουν στο δέντρο απροσάρτητα (απόφαση Giorgio) — **δεν** είναι πια η κανονική θέση. |
