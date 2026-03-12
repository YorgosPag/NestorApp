# ADR-200: Utility Hooks Centralization (Phase 2)

## Status: ✅ IMPLEMENTED

## Date: 2026-03-12

## Context

Phase 2 of scattered code centralization (successor to ADR-161). Analysis of the codebase identified 3 high-ROI patterns duplicated across many files with zero centralized hooks:

1. **Clipboard copy + feedback**: 18 files with identical `navigator.clipboard.writeText()` + `setCopied(true)` + `setTimeout(reset, 2000)`
2. **Click-outside detection**: 7 files with identical `document.addEventListener('mousedown')` + `contains()` check + cleanup
3. **`window.confirm()` usage**: 7 files using native confirm dialogs instead of existing enterprise `ConfirmDialog` component

## Decision

### Hook 1: `useCopyToClipboard`

**Location**: `src/hooks/useCopyToClipboard.ts`

```typescript
interface CopyToClipboardReturn {
  copy: (text: string) => Promise<boolean>;
  copied: boolean;
}
function useCopyToClipboard(resetDelay?: number): CopyToClipboardReturn;
```

- Delegates to `copyToClipboard()` from `@/lib/share-utils` (browser fallback included)
- Auto-resets `copied` state after configurable delay (default 2000ms)
- Handles timer cleanup on unmount
- Multiple instances per component for separate copy states

**Migrated files (11)**:
- `TwoFactorEnrollment.tsx` (2 instances)
- `BankAccountCard.tsx`, `MessageContextMenu.tsx`, `voice-assistant-button.tsx`
- `GeneralProjectHeader.tsx`, `QrCodePanel.tsx`, `ShareDialog.tsx`
- `CopyActionsSection.tsx` (2 instances)
- `DxfViewerContent.tsx`, `useSceneState.ts` (2 instances), `TestResultsModal.tsx`

### Hook 2: `useClickOutside`

**Location**: `src/hooks/useClickOutside.ts`

```typescript
function useClickOutside(
  refs: RefObject<HTMLElement | null> | ReadonlyArray<RefObject<HTMLElement | null>>,
  handler: () => void,
  options?: { event?: 'mousedown' | 'click'; enabled?: boolean }
): void;
```

- Single ref or array of refs (for multi-element dropdowns)
- Conditional activation via `enabled` option
- Configurable event type (`mousedown` or `click`)

**Migrated files (7)**:
- `ToolButton.tsx`, `GeoMapControls.tsx` (single ref)
- `CustomRelationshipSelect.tsx`, `EmployeeSelector.tsx` (dual ref)
- `useColorMenuState.ts`, `EnterprisePortalSystem.tsx`, `GanttView.tsx` (conditional)

### Hook 3: `useConfirmDialog`

**Location**: `src/hooks/useConfirmDialog.ts`

```typescript
interface UseConfirmDialogReturn {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  dialogProps: Partial<ConfirmDialogProps>;
}
function useConfirmDialog(): UseConfirmDialogReturn;
```

- Promise-based API: `const ok = await confirm({...})`
- Returns `dialogProps` to spread on `<ConfirmDialog />`
- Works in both components (render ConfirmDialog directly) and hooks (return dialogProps to consumer)
- Variants: `default`, `destructive`, `warning`

**Migrated files (7)**:
- `StorageTab/index.tsx`, `FloorsTabContent.tsx`, `MeasurementsTabContent.tsx` (destructive)
- `TasksTab.tsx` (destructive), `FloorPlanControlPointPicker.tsx` (warning)
- `useLeadsList.ts` + `LeadsList.tsx` (hook + consumer pattern)
- `useSectionEditorState.ts` + `SectionEditor.tsx` (hook + consumer pattern)

## Consequences

- **Positive**: ~30 files cleaned of duplicated clipboard/click-outside/confirm patterns
- **Positive**: Consistent behavior across all copy-to-clipboard operations (fallback included)
- **Positive**: Enterprise ConfirmDialog replaces all native `window.confirm()` calls
- **Positive**: Zero breaking changes — all backward compatible
- **Negative**: None identified

## Migrate-on-Touch Rules

Future files encountering these patterns MUST use the centralized hooks:

| Pattern | Use Instead |
|---------|-------------|
| `navigator.clipboard.writeText` + `setCopied` + `setTimeout` | `useCopyToClipboard()` |
| `document.addEventListener('mousedown')` + `.contains()` | `useClickOutside()` |
| `window.confirm()` | `useConfirmDialog()` + `<ConfirmDialog />` |

## Changelog

| Date | Change |
|------|--------|
| 2026-03-12 | Initial implementation — 3 hooks, ~25 files migrated |
