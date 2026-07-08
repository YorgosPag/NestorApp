'use client';

/**
 * ============================================================================
 * ESCO Picker Popover Shell — backward-compat re-export (ADR-601)
 * ============================================================================
 *
 * The implementation was promoted to the domain-neutral
 * `@/components/shared/pickers/picker-popover-shell` (SSoT) when EmployerPicker
 * joined the picker family. This module keeps the original ESCO-named exports
 * so existing consumers (EscoOccupationPicker, EscoSkillPicker, tests) resolve
 * unchanged. See that module for the full bug-history rationale (ADR-325).
 *
 * @module components/shared/esco/esco-picker-popover-shell
 */

export {
  PickerPopoverShell as EscoPickerPopoverShell,
  PickerPopoverShell as default,
  type PickerPopoverShellProps as EscoPickerPopoverShellProps,
} from '@/components/shared/pickers/picker-popover-shell';
