# ADR-328 Handoff — After Phase 4: Setup Tab Lock State + Banner

**Date:** 2026-04-30
**Phase completed:** 4 (Setup Tab lock state + banner)
**Phase next:** 5 (per §7 — check ADR §7.9 next session)

## What was built

- `src/subapps/procurement/utils/rfq-lock-state.ts` — NEW: `SetupLockState` type + `deriveSetupLockState(rfq, quotes)`. Uses `rfq.winnerQuoteId` as awardLocked signal.
- `src/subapps/procurement/components/SetupLockBanner.tsx` — NEW (~60 lines): amber banner (awardLocked) + red banner (poLocked). Props: `lockState`, `vendorName`, `poNumber`, `onRevertAward`, `onViewPo`, `onCancelPo`.
- `src/subapps/procurement/components/RfqLinesPanel.tsx` — `lockState?: SetupLockState` prop. Delete buttons + add-line button disabled when `locked`.
- `src/subapps/procurement/components/VendorInviteSection.tsx` — `lockState?: SetupLockState` prop. Add-invite button disabled when locked. `InviteRow` gets `lockState`; revoke disabled only for `poLocked` (awardLocked keeps cancel per §5.G.1).
- `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx` — `lockState` + `winnerVendorName` useMemo. Imports `SetupLockBanner` + `deriveSetupLockState`. Tab 3: `SetupLockBanner` at top, `lockState` passed to `RfqLinesPanel` + `VendorInviteSection`.
- `src/i18n/locales/el/quotes.json` + `en/quotes.json` — 9 new keys under `rfqs.setup.*`.

## Deviations from ADR spec

- **`poLocked` unreachable**: `RFQ` type has no `purchaseOrderId` field → `deriveSetupLockState` can only return `'unlocked'` or `'awardLocked'`. Red PO banner renders correctly for future use, but will never show until `purchaseOrderId` is added to the RFQ type.
- **`onRevertAward` not wired**: `SetupLockBanner` has the prop but `RfqDetailClient` does not pass it (no revert API route exists). The "Αναίρεση Νικητή" button is therefore NOT rendered in the banner. §5.F.3 revert flow deferred to a future phase.
- **No per-button tooltips**: ADR §5.G.3 specifies tooltip text on each disabled button. Omitted to avoid N.23 ratchet violations. Banner is the single source of lock explanation per §5.G.2.

## Verification status

- [ ] No award → Setup tab fully enabled
- [ ] Award exists → banner shows (amber), lines locked, add-invite locked, cancel invite still works
- [ ] (future) PO created → red banner, all controls locked
- [ ] TypeScript: no new errors

## Required reads for next session

- ADR §7.9 Phase 5 spec (read next session)
- `.claude-rules/adr-328-handoff-after-phase-4.md` (this file)
- `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx`

## Suggested model for next session

- **Sonnet 4.6** (unless Phase 5 spans 5+ files/2+ domains)

## Pending Giorgio decisions

- Wire `onRevertAward` in future phase when revert API is implemented
- Add `purchaseOrderId` to RFQ type when PO system is built
