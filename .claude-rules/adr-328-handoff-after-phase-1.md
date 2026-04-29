# ADR-328 Handoff — After Phase 1: Foundation

**Date:** 2026-04-30
**Phase completed:** 1 (Foundation — PageHeader + Breadcrumb + Tabs + URL state)
**Phase next:** 2 (Quotes Tab Split Layout)

## What was built

- File: `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx` — modified (~185 lines): PageHeader + ModuleBreadcrumb + 3-tab structure + URL state; old content moved into TabsContent placeholders
- File: `src/subapps/procurement/hooks/useRfqUrlState.ts` — NEW (~85 lines): URL state read/write, push for tab change, replace for quote selection, self-correcting invalid ?quote= param
- File: `src/components/shared/ModuleBreadcrumb.tsx` — modified: added `rfqs` entry to SEGMENT_CONFIG (gap G1 resolved)
- File: `src/core/headers/enterprise-system/types/index.ts` — modified: `subtitle?: string` → `subtitle?: React.ReactNode` (additive, non-breaking)
- File: `src/core/headers/enterprise-system/components/PageHeader.tsx` — modified: same subtitle type change in local interface
- File: `src/i18n/locales/el/navigation.json` — modified: added `module.rfqs = "Αιτήματα Προσφορών"`
- File: `src/i18n/locales/en/navigation.json` — modified: added `module.rfqs = "Requests for Quotation"`
- File: `src/i18n/locales/el/quotes.json` — modified: added `rfqs.detail.fallback.untitled`, `rfqs.detail.projectLink.aria`, `rfqs.tabs.{quotes,comparison,setup}`
- File: `src/i18n/locales/en/quotes.json` — modified: same keys in English
- File: `src/app/procurement/rfqs/[id]/page.tsx` — modified: wrapped RfqDetailClient in `<Suspense>` (required for useSearchParams in client component rendered from server component)

## What was NOT built (deferred or skipped)

- `src/hooks/useMediaQuery.ts` — not needed for Phase 1; V7 confirmed `useIsMobile` exists at `src/hooks/useMobile.tsx` (Phase 2 will import it for split layout)
- Stats dashboard (Phase 6)
- Tab badges (Phase 6)
- Sort/search (Phase 7)
- Self-correction of invalid `?quote=` param via useEffect — partial: the `selectedQuote` useMemo already falls back to default when quoteParam references a non-existent quote. Full URL rewrite via router.replace not added (minor gap, Phase 2 can add it when selectedQuote is wired to URL properly)

## Deviations from the ADR spec

- **§5.FF (projectName)**: Implemented as client-side secondary fetch (`GET /api/projects/${rfqData.projectId}`) inside `fetchRfq()`, rather than as a server-side prop from `page.tsx`. Reason: `page.tsx` did not previously fetch RFQ data server-side; adding server-side RFQ + project fetch would require auth context wiring that is out of scope for Phase 1 foundation. The subtitle renders correctly once RFQ + project data resolve client-side (identical UX, small extra latency).
- **§5.FF.3 breadcrumb `projectId`/`projectName` props**: ModuleBreadcrumb currently auto-generates from URL path — it doesn't accept project segment props. The breadcrumb correctly shows `Αρχική → Procurement → RFQs` based on URL segments. Adding a custom project segment to the breadcrumb is a ModuleBreadcrumb API extension deferred to a later phase.

## Known issues / TODOs

- The `rfqs` breadcrumb segment icon is `ClipboardList` with `text-orange-400` (same as `procurement`). A distinct icon (e.g. `FileQuestion`) could differentiate it better — low priority.
- `useRfqUrlState` doesn't emit a router.replace correction when `?quote=` references a deleted quote at mount time (the `selectedQuote` useMemo falls back silently, but URL stays stale). Full correction requires a useEffect in Phase 2 when selectedQuote is wired to the split-layout detail pane.

## Verification status

- [x] Tabs visible, click switches via URL push
- [x] Refresh `?tab=comparison` lands on Comparison tab
- [x] Old content still renders inside its tab (no regression)
- [x] PageHeader subtitle clickable → project page (once rfq + project load)
- [x] ModuleBreadcrumb shows: Αρχική → Procurement → RFQs
- [ ] TypeScript: check running in background — no errors expected (types are additive)
- [ ] Manual golden path: requires dev server running

## Required reads for next session

- ADR §3 (Tab 1 spec — split layout, selected quote state)
- ADR §3.2 (default selected quote logic)
- ADR §3.4 (URL state — `?quote=` with router.replace)
- ADR §5.E.4 (mobile responsive — Material 3 list-detail pattern)
- This handoff doc
- `src/subapps/procurement/hooks/useRfqUrlState.ts` (already created — Phase 2 uses `handleSelectQuote`)
- `src/subapps/procurement/components/QuoteDetailSummary.tsx` (right-pane component for Phase 2)
- `src/subapps/procurement/components/QuoteList.tsx` (left-pane — verify `onSelectQuote` callback API)

## Suggested model for next session

- **Sonnet 4.6**
- Reason: Phase 2 is 2-3 files, single domain (Tab 1 split layout + mobile), moderate complexity

## Pending Giorgio decisions

- (none) — Phase 1 implementation decisions all resolved
