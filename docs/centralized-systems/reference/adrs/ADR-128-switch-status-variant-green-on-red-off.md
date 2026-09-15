# ADR-128: Switch Status Variant (Green ON / Red OFF)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-02-01 |
| **Category** | UI Components |
| **Canonical Location** | `@/components/ui/switch` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ APPROVED
- **Date**: 2026-02-01
- **Problem**: Switch components had no visual distinction for ON/OFF state
- **Decision**: Add `variant` prop to Switch component with centralized tokens
- **Canonical Location**: `@/components/ui/switch` + `@/design-system/color-bridge`
- **Variants Available**:
  - `default`: Primary when ON, input color when OFF
  - `status`: Green when ON, Red when OFF (visibility toggles)
  - `success`: Green when ON, muted when OFF
  - `destructive`: Red when ON, muted when OFF
- **Files Updated**: 6 Switch components in Ruler Settings
- **Pattern**: Centralized tokens in COLOR_BRIDGE.switch

---

## Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-09-15 | **`default` = ρόλος χειριστηρίου επιλογής (ADR-770 §17).** Ήταν `bg-primary` (ON) / `bg-input` (OFF) με λαβή `bg-background`: στο σκοτεινό το `--primary` ≡ `--card` ⇒ ON **αόρατο**· στο φωτεινό η λαβή OFF μετρά **1,33:1**. Τώρα ON = `bg-control-accent` + λαβή `bg-control-accent-foreground` (6,92 / 4,76)· OFF = **περιγραμμένη τροχιά** `border-control-outline` + λαβή `bg-control-outline` (M3 `unselected-handle-color → outline`, Fluent 2 `colorNeutralStrokeAccessible`). Κάθε variant δηλώνει πλέον `thumb` (το `switch.tsx` δεν διαβάζει `useSemanticColors`). `status`/`success` **αμετάβλητα**. ⚠️ **Ανοιχτό, δηλωμένο**: `destructive` ON μετρά σκοτ. **1,48:1** (τροχιά επί `--card`) — θέλει δικό του token τροχιάς· γραμμένο στο `DECLARED_OPEN_STATES` της άγκυρας Ο5. |
