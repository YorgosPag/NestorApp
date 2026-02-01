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
