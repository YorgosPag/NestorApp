# ADR-328 Handoff — After Phase 0: Verification

**Date:** 2026-04-30
**Phase completed:** 0 (Verification & ADR Audit Population)
**Phase next:** 1 (Foundation — PageHeader + Breadcrumb + Tabs + URL state)

## What was built

- File: `adrs/ADR-328-rfq-detail-contacts-layout.md` — modified: §5.T.3 populated, §5.DD.3 populated, §5.EE.3 populated, §6.4 added (full V1–V26 outcome table + gap list), changelog row added

No production code was written (Phase 0 is read-only audit).

## What was NOT built (deferred or skipped)

- V14 full audit of `VendorInviteSection` internal dialog UX (covered enough for Phase 0 purposes; Phase 12 pre-flight will re-read it)

## Deviations from the ADR spec

- (none) — all deliverables per §7.4 produced

## Known issues / TODOs

- (none)

## Verification status

- [x] Every V1–V26 has a documented outcome (§6.4.2 table)
- [x] Every hard blocker explicitly listed: **0 hard blockers**
- [x] Non-blocking gaps listed with proposed Phase: 15 gaps in §6.4.3
- [x] §5.T.3, §5.DD.3, §5.EE.3 audit tables populated
- [x] §6.4 added with summary
- [x] Changelog row added

## Key findings for Phase 1

1. **`ModuleBreadcrumb` needs `rfqs` entry** — `SEGMENT_CONFIG` in `src/components/shared/ModuleBreadcrumb.tsx` has `procurement`+`quotes` but no `rfqs`. Phase 1 must add it (additive, non-breaking).

2. **`projectName` NOT denormalized on `RFQ`** — `RFQ` type has only `projectId: string`. To show project name in `PageHeader.subtitle`, Phase 1 must either:
   - Accept it as a prop from the server page (recommended — fetch projectName in the RSC/server component that already has rfq data)
   - OR fetch from the contacts/projects API client-side (slower, more complex)
   **Recommended**: pass `projectName: string | null` as prop from the server page to `RfqDetailClient`.

3. **`useIsMobile` already exists** — at `src/hooks/useMobile.tsx`. No need to create `useMediaQuery.ts`. Import directly.

4. **All hooks are one-shot fetch** — `useQuotes`, `useComparison`, `useRfqLines`, `useVendorInvites` all use HTTP fetch. Phase 1 does NOT need to change this (Phase 5 handles real-time). Phase 1 just wires these hooks to the new tab structure.

5. **Toast = sonner** — confirmed. Use `import { toast } from 'sonner'` everywhere.

6. **Zod for validation** — confirmed available in procurement API routes.

## Files to read for Phase 1 pre-flight

Per §7.5 checklist:
- ADR §3 (full structure), §3.1, §3.2, §3.4, §5.E.4, §5.FF
- `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx` — current implementation (~220 lines)
- `src/components/shared/ModuleBreadcrumb.tsx` — to add `rfqs` entry (already read in Phase 0)
- `src/core/headers/enterprise-system/types/index.ts` — `PageHeaderProps` API (already read in Phase 0)
- `src/core/headers/enterprise-system/components/PageHeader.tsx` — actual render

## Hard blockers

None. Implementation green-lit.

## Required reads for next session

- This handoff doc
- ADR §3, §3.1, §3.2, §3.4, §5.E.4, §5.FF (phase 1 spec)
- ADR §7.5 Phase 1 deliverables table

## Suggested model for next session

- **Sonnet 4.6**
- Reason: Phase 1 is 1-3 files, no cross-cutting complexity, straightforward wiring task

## Pending Giorgio decisions

- **projectName resolution strategy** for `PageHeader.subtitle`: prop from server page vs. client-side fetch. Recommended: server-side prop. Confirm before Phase 1 implementation begins.
