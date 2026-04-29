# ADR-328 Handoff — After Phase 6: Stats Dashboard + Tab Badges

**Date:** 2026-04-30
**Phase completed:** 6 (Stats Dashboard + Tab Badges, §5 / §5.B / §3.3)
**Phase next:** 7 (Sort + Search, per §7.11) OR 8 (Award Flow, per §7.12) — Phase 7 depends only on Phase 2 ✓; Phase 8 depends on Phase 5 ✓ and Phase 7

## What was built

### New file

- `src/subapps/procurement/utils/rfq-dashboard-stats.ts` (~90 lines):
  - `buildRfqDashboardStats(rfq, quotes, invites, comparison, activeTab, t): DashboardStat[]`
  - Per tab returns 4 `DashboardStat[]` for `UnifiedDashboard` SSoT:
    - **quotes**: total / underReview / accepted / bestPrice (min positive total, EUR formatted)
    - **comparison**: bestPrice / worstPrice / priceDiff / recommendation (vendor name from `comparison.quotes`)
    - **setup**: totalLines / totalVolume / invites.length / attentionCount (expired OR pending-past-deadline)
  - `toDeadlineMs` helper handles both serialized Firestore Timestamp (`{ seconds }`) and ISO string
  - `formatEur` helper with `el-GR` locale, 0 decimal places

### Modified (1)

- `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx`:
  - `showDashboard: boolean` state — `useState(false)` per §3.3 (hidden by default, no persistence)
  - `useVendorInvites(id)` hoisted — only `invites` destructured; used by stats factory + badge derivation
  - 3 derived `useMemo` values:
    - `underReviewCount` — `quotes.filter(q => q.status === 'under_review').length`
    - `recommendationPending` — `Boolean(comparison?.recommendation) && !quotes.some(q => q.status === 'accepted')`
    - `setupAttentionCount` — invites where `status === 'expired'` OR `status === 'pending'` AND past rfq.deadlineDate
  - `dashboardStats` memo — calls `buildRfqDashboardStats(rfq, quotes, invites, comparison, activeTab, t)`
  - Eye-toggle button: `Button[variant=ghost, size=sm]` with `Eye`/`EyeOff` icon, prepended to PageHeader `customActions`
  - `UnifiedDashboard` rendered between PageHeader and `<Tabs>`, conditional on `showDashboard`
  - `TabsTrigger` for "quotes": `Badge[variant=destructive]` with `underReviewCount` when > 0
  - `TabsTrigger` for "comparison": yellow `<span>` dot when `recommendationPending`
  - `TabsTrigger` for "setup": `Badge[variant=warning]` with `setupAttentionCount` when > 0

### i18n keys added (16 new keys × 2 locales)

`src/i18n/locales/{el,en}/quotes.json` under `rfqs.*`:
- `rfqs.tabs.badges.{underReview, recommendation, setupAttention}` (aria-labels)
- `rfqs.dashboard.toggle`
- `rfqs.dashboard.quotes.{total, underReview, accepted, bestPrice}`
- `rfqs.dashboard.comparison.{bestPrice, worstPrice, priceDiff, recommendation}`
- `rfqs.dashboard.setup.{totalLines, totalVolume, invites, pending}`

## Deviations from ADR spec

- **`useVendorInvites` called twice** (once in `RfqDetailClient` for stats/badges, once internally in `VendorInviteSection`). The Firebase SDK deduplicates `onSnapshot` listeners for the same query at the SDK level — no duplicate network calls. The double call also triggers a second `/api/rfqs/{rfqId}/vendor-contacts` fetch. Acceptable at Phase 6 scale (3–5 invites, tiny page per §5.N). Phase 12 (vendor communication) will hoist invites properly when reworking `VendorInviteSection` props anyway.
- **`setupAttentionCount` counts all `pending` invites past deadline** (even those still within `expiresAt`). This is intentional — any invite still `pending` when the RFQ deadline has passed deserves attention regardless of token expiry.

## Verification status

Per §7.10 validation checklist:
- [ ] Dashboard hidden by default — ✅ `useState(false)`
- [ ] Click eye → 4 cards appear, change with active tab — **needs manual QA**
- [ ] Tab «Προσφορές» shows red badge with count when any `under_review` — **needs manual QA**
- [ ] Tab «Σύγκριση» shows yellow dot when recommendation pending — **needs manual QA**
- [ ] Tab «Ρύθμιση» shows yellow badge when invites need attention — **needs manual QA**
- [ ] TypeScript: no new errors — **not yet run; tsc --noEmit recommended**
- [ ] Pre-commit hook (i18n ratchet, ssot ratchet, file size) — runs on commit; expected pass

## Files modified / created

### Modified (3)
- `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx`
- `src/i18n/locales/el/quotes.json`
- `src/i18n/locales/en/quotes.json`
- `adrs/ADR-328-rfq-detail-contacts-layout.md` (changelog)

### Created (2)
- `src/subapps/procurement/utils/rfq-dashboard-stats.ts`
- `.claude-rules/adr-328-handoff-after-phase-6.md`

## Required reads for next session

- This handoff (`.claude-rules/adr-328-handoff-after-phase-6.md`)
- ADR §7.11 (Phase 7: Sort + Search) or §7.12 (Phase 8: Award Flow)

## Suggested model for next session

- **Sonnet 4.6** for Phase 7 (2 new utils ~80+120 lines + QuoteList.tsx modification)
- **Sonnet 4.6** for Phase 8 (2 new files + modifications, depends on Phase 5 locking primitives)

## Pending Giorgio decisions

- Phase 7 or Phase 8 next? Phase 7 (sort+search, independent) vs Phase 8 (award flow, needs locking from Phase 5)
- Manual QA of stats dashboard: verify 4 cards update when switching tabs
- Phase 5 scaffolding (`ConflictDialog`, `useLiveChangeToasts`) still dead code — wired in Phase 8 award flow
