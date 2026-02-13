# DXF Viewer Initial Investigation Report
Date: 2026-02-12
Scope: `src/subapps/dxf-viewer` and `src/app/dxf/viewer/page.tsx`

## 1) First things to investigate (if asked to audit this sub-app)
1. Access control and data boundary safety first.
2. Rendering/state architecture consistency second (providers, event bus, scene sync, side effects).
3. Protocol compliance third (no inline styles, no hardcoded values, no duplicate/legacy paths).
4. Runtime/performance hygiene fourth (production debug logs, heavy listeners, global window hooks).
5. Quality gate status fifth (lint/typecheck/tests/build).

Reason: these 5 areas can create either direct security exposure, hard-to-debug state corruption, or high-maintenance regressions.

## 2) Findings from this investigation

### Critical
- Development auth bypass exists in DXF page guard:
  - `src/app/dxf/viewer/page.tsx:56`
  - `if (process.env.NODE_ENV === 'development') { return <>{children}</>; }`
- Why this is high risk:
  - If a non-production deployment runs with development mode or if environment config drifts, admin check is bypassed.
  - It is a hard bypass in route-level guard, not just UX fallback.

### High
- Duplicate `CanvasProvider` wrapping likely creates split context instances:
  - `src/subapps/dxf-viewer/DxfViewerApp.tsx:81`
  - `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:977`
- Impact:
  - Child hooks may read/write a different provider instance than expected.
  - This can produce non-deterministic transform/canvas state behavior.

- Firestore-enabled level system is always on in core composition:
  - `src/subapps/dxf-viewer/DxfViewerApp.tsx:79` (`<LevelsSystem enableFirestore>`)
- Impact:
  - No visible environment guard at composition level.
  - Raises risk of unintended persistence operations in non-target environments.

### Medium
- Protocol violations: extensive inline style usage in production DXF UI code.
  - Examples:
    - `src/subapps/dxf-viewer/ui/color/EnterpriseColorDialog.tsx:185`
    - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1863`
    - `src/subapps/dxf-viewer/components/shared/BaseModal.tsx:138`
    - `src/subapps/dxf-viewer/ui/components/CentralizedAutoSaveStatus.tsx:201`
- Local_Protocol requires NO inline styles.

- Hardcoded max z-index values in modal stack:
  - `src/subapps/dxf-viewer/ui/color/EnterpriseColorDialog.tsx:185` (`2147483646`)
  - `src/subapps/dxf-viewer/ui/color/EnterpriseColorDialog.tsx:206` (`2147483647`)
- Hardcoded extreme values are brittle and usually signal layering-system drift.

- Hardcoded fallback pixel value in layout calc:
  - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1863` (`?? 30`)

- Production debug logging still active in core render flow:
  - `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:302`
  - `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:308`
  - `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:319`
  - `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:333`
  - `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:347`
- Impact: noisy telemetry, potential perf cost, and log leakage in runtime paths.

### Low / Maintainability
- Legacy/duplicate config artifacts present:
  - `src/subapps/dxf-viewer/config/modal-select.ts`
  - `src/subapps/dxf-viewer/config/modal-select-old.ts`
- Stray root file artifacts in sub-app root:
  - `src/subapps/dxf-viewer/afairesh_DXFcanvasRefactored.txt`

## 3) Quality gate evidence (commands + result)

### Lint
Command:
`F:\PowerShell\7\pwsh.exe -Command "npm run lint"`
Result:
- FAILED (many repo-wide lint errors, not specific only to DXF viewer)
- Example errors include unused imports, hardcoded strings, design-system enforcement failures.

### Typecheck
Command:
`F:\PowerShell\7\pwsh.exe -Command "npx tsc --noEmit"`
Result:
- FAILED
- Reported:
  - `src/app/api/accounting/tax/dashboard/route.ts(27,25): Module '@/subapps/accounting/utils/entity-guards' has no exported member 'isLlc'`
  - `src/app/api/accounting/tax/dashboard/route.ts(91,49): Property 'calculateEPETax' does not exist on type 'AccountingService'`

### Tests
Command attempted:
`F:\PowerShell\7\pwsh.exe -Command "npm test -- --passWithNoTests"`
Result:
- Not executed (permission request rejected by user at runtime).

### Build
Command:
`F:\PowerShell\7\pwsh.exe -Command "npm run build"`
Result:
- PASSED
- Next.js build completed successfully (token build + production build).

## 4) Practical next investigation steps (ordered)
1. Remove/replace development auth bypass in `src/app/dxf/viewer/page.tsx`.
2. Collapse to single `CanvasProvider` ownership and re-verify transform/canvas flows.
3. Replace hardcoded z-index and px fallback values with centralized tokens/config.
4. Eliminate inline `style={...}` in production components (convert to tokenized style systems/classes).
5. Gate debug logging behind explicit debug flag and strip from core runtime effects.

## 5) Direct answer to user question
If I had to start from zero and pick only one first check for this sub-app, I would first inspect **access control at the page entry + any environment bypasses**, because that is the fastest path to finding a high-impact issue.
