# ADR-328 Phase 11 Handoff — PDF Preview + Quote Header Actions

**Date:** 2026-04-30
**Phase:** 11 of 15
**Status:** COMPLETE

---

## What was built

### New files
| File | Lines | Purpose |
|------|-------|---------|
| `src/subapps/procurement/utils/quote-header-actions.ts` | ~155 | Pure factory `buildQuoteHeaderActions()` — primary/secondary/overflow actions |
| `src/subapps/procurement/components/QuoteRightPane.tsx` | ~95 | Extracted right pane: header + summary + PDF split/modal |

### Modified files
| File | Change |
|------|--------|
| `src/subapps/procurement/components/QuoteDetailsHeader.tsx` | Extended 85→~210 lines: PrimaryButton, SecondaryIcon, PdfToggleButton, OverflowMenu, ExpiryBanner sub-components; new props primaryActions/secondaryActions/overflowActions/pdfOpen/onTogglePdf/hasPdf |
| `src/subapps/procurement/hooks/useRfqUrlState.ts` | Added `pdfOpen: boolean` (from `?pdf=1`) + `handleTogglePdf` |
| `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx` | 472→500 lines: QuoteRightPane replaces right pane JSX; patchQuoteStatus + handleStub + buildQuoteHeaderActions useMemo |
| `src/i18n/locales/el/quotes.json` | +23 keys: rfqs.quoteHeader.action.* + tooltip.* + delete.* + pdfPanel.* |
| `src/i18n/locales/en/quotes.json` | Same +23 keys in English |

---

## Key design decisions

- **No PdfViewer.tsx extracted** — V9 confirmed `QuoteOriginalDocumentPanel` already reusable (ADR-031/191 SSoT via `FilePreviewRenderer`). Direct reuse.
- **Browse confidence cleanup SKIPPED** — V24 confirmed already clean.
- **`patchQuoteStatus` single callback** — wraps all FSM PATCH calls (confirm/reject/restore) via existing `/api/quotes/{id}` endpoint. Avoids 3 separate useCallback hooks.
- **`hasPdf` heuristic** — derived from `quote.source === 'scan' || 'email_inbox'` (not real file system check). Sufficient for enabling the PDF toggle button.
- **`QuoteRightPane` extraction** — not in §7.15 deliverables but required by N.7.1 (500-line budget). Clean SRP split.

---

## Known gaps / deviations (carry to Phase 12)

### Overflow actions — stubs only
`onDelete`, `onDuplicate`, `onCreatePo`, `onViewPo`, `onOpenComments`, `onOpenHistory` are all `handleStub` (toast "coming soon"). Phase 12 needs:
- Delete: proper AlertDialog confirmation + `DELETE /api/quotes/{id}`
- Duplicate: API for copy-with-new-status
- Comments/History: side panel ADRs (follow-up)

### `createRevision` UI still not wired
Phase 9 deviation still open: `createRevision()` from `quote-versioning-service.ts` needs overflow menu entry. Deferred to Phase 12 alongside the other overflow actions.

### V15 gap (renewal email send) still open
`QuoteRenewalRequestDialog.onSend` is still a stub from Phase 10.

---

## Phase 12 context

Phase 12 = **Vendor Communication** (§7.16 in ADR-328 §7). Scope:
- Invite send dialog (multi-select + suggested + ad-hoc)
- Notification dialog (winner/rejection templates)
- Audit per recipient
- Sent indicator on quote rows
- Wire `QuoteRenewalRequestDialog.onSend` to `POST /api/quotes/{id}/request-renewal`

Next files to read when starting Phase 12:
- `adrs/ADR-328-rfq-detail-contacts-layout.md` §7.16
- `src/subapps/procurement/components/VendorInviteSection.tsx`
- `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx` (Phase 11 state, 500 lines)

---

## Do NOT do in Phase 12

- Do NOT auto-flip `quote.status` to `'expired'` — §5.BB invariant
- Do NOT break `?pdf=1` URL state (useRfqUrlState handles it)
- Do NOT change `hasPdf` to real file system check — it's intentional heuristic
- Do NOT remove legacy props from QuoteDetailsHeader (`onEdit`, `onArchive`, `onCreateNew`) — backward compat
