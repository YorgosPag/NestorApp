# ADR-329 — Quote Comments Side Panel

**Status:** ACCEPTED  
**Date:** 2026-04-30  
**Author:** Giorgio Pagonis  
**Supersedes:** N/A  
**Related:** ADR-328 §5.R (comments placeholder wired, implementation deferred)

---

## Context

ADR-328 §5.R defines the Comments side panel for the RFQ detail page. The panel button is wired in `QuoteDetailsHeader` as a disabled placeholder (`handleStub` via `comingSoon` tooltip). The full implementation is deferred to this ADR.

## Scope

- Comments thread UI in the right-pane side panel (Sheet — right desktop / bottom mobile)
- Per-quote comment creation, display, and deletion
- Read via GET API route (v1); real-time `onSnapshot` deferred to v1.1 (requires Firestore rules update)
- Firestore collection: `quote_comments` (sub-collection of `quotes/{id}`, via `SUBCOLLECTIONS.QUOTE_COMMENTS`)
- i18n keys under `rfqs.comments.*` in `src/i18n/locales/{el,en}/quotes.json`

## Implementation (v1 — 2026-04-30)

### Files created

| File | Role |
|------|------|
| `src/services/quote-comment.service.ts` | Types (`QuoteComment`) + fetch-based API helpers |
| `src/subapps/procurement/components/QuoteCommentsDrawer.tsx` | Sheet drawer — comment list, add/edit/delete |
| `src/app/api/quotes/[id]/comments/route.ts` | GET (list) + POST (create) |
| `src/app/api/quotes/[id]/comments/[commentId]/route.ts` | PATCH (edit) + DELETE (soft/hard) |

### Files modified

| File | Change |
|------|--------|
| `src/config/firestore-collections.ts` | Added `SUBCOLLECTIONS.QUOTE_COMMENTS = 'quote_comments'` |
| `src/i18n/locales/el/quotes.json` | Added `rfqs.comments.*` keys |
| `src/i18n/locales/en/quotes.json` | Added `rfqs.comments.*` keys |
| `src/subapps/procurement/hooks/useRfqUrlState.ts` | Added `commentsOpen` + `handleToggleComments` (mutually exclusive with PDF) |
| `src/subapps/procurement/utils/quote-header-actions.ts` | Removed `disabled: true` from comments action |
| `src/subapps/procurement/components/QuoteRightPane.tsx` | Added `commentsOpen`/`onToggleComments` props + `QuoteCommentsDrawer` render |
| `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx` | Wired `commentsOpen` + `handleToggleComments` from hook; replaced stub |

### v1.1 deferred items

- Real-time `onSnapshot` subscription (requires `quote_comments` sub-collection Firestore rules)
- `@mention` notification dispatch (parse @name, look up user, fire notification)
- Comment count badge on header icon (requires subscription or lightweight count fetch on quote select)
- Soft-delete placeholder «[Σχόλιο διαγράφηκε]» visible to admins

## Design decisions

**Q1 — Visibility:** Comments are **strictly internal** (team only). Vendors never see them, not even via the portal. Vendor communication uses the existing notify-vendor system (ADR-328 Phase 12). Industry standard: Primavera Oracle, Procore, SAP Ariba all maintain this separation.

**Q2 — Granularity:** Comments attach to the **quote as a whole** (not individual lines). Line-level annotation is a future phase-2 feature. For small construction (§5.N: 3–5 quotes), quote-level covers 90% of real use cases. Users reference specific lines in free text ("Γραμμή 3 — ..."). Industry standard: Primavera Unifier, Procore, SAP Ariba all default to document-level comments first.

**Q7 — Placement:** Side drawer (desktop) / bottom sheet (mobile). Comments panel and PDF panel are **mutually exclusive** — they share the same lateral slot. Opening Comments closes PDF and vice versa. No three-column layout. Infrastructure reuses the existing `pdfOpen` / `handleTogglePdf` pattern from ADR-328 Phase 11, extended with a `commentsOpen` toggle. Pattern: Google Docs (side panel), Gmail (side drawer), Google Maps mobile (bottom sheet).

**Q6 — Resolve / Close:** No "resolve" state. Comments stay open permanently. With 2–5 comments per quote, there is no UI problem to solve — all are visible at once. Users close a point by writing a follow-up comment ("✅ Συμφώνησαν σε 3%"). Adding resolve UI + Firestore state for a non-existent problem violates YAGNI. Revisit if volume grows. (Google Docs uses resolve for 50+ simultaneous comments — not our scale.)

**Q5 — Volume:** Typically 2–5 comments per quote, rarely above 10. All comments render at once — no pagination, no "load more". Simple flat list, newest at bottom.

**Q4 — Notifications:** `@mention` only. A comment without `@` is visible in the panel but generates no push notification. Mentioning `@Maria` triggers a notification only to Maria. Rationale: notification fatigue — even in a 3-person team, every comment generating a push causes notifications to be ignored within days. Universal pattern: Google Docs, Procore, Slack, Notion, Linear all use `@mention` as the intentional trigger.

**Q3 — Edit / Delete:**
- **Own comment**: user can edit (shows «επεξεργάστηκε» marker with timestamp) and soft-delete (placeholder «[Σχόλιο διαγράφηκε]» remains — not truly erased, because decisions may have been based on it)
- **Admin**: can hard-delete any comment
- **Audit trail**: edit and delete events logged via EntityAuditService (ADR-195)
- Industry rationale: Google Docs/Chat pattern (edit+marker, soft-delete placeholder). Primavera goes fully immutable; we adopt a middle path appropriate for small construction.

## Out of scope

- Comment reactions, mentions, or attachments (future)
- Cross-RFQ comment aggregation (future)
- Vendor-facing comments / messages (handled by notify-vendor system)

## References

- ADR-328 §5.R — original specification and placeholder
- ADR-195 — EntityAuditService (audit trail for comment creation/deletion)
- ADR-267 — QuoteDetailsHeader SSoT (where the Comments button lives)

## Changelog

| Date | Change |
|------|--------|
| 2026-04-30 | Stub created from ADR-328 §5.R deferral |
| 2026-04-30 | v1 implemented: 4 new files + 7 modified. Sheet drawer, API routes (GET/POST/PATCH/DELETE), URL state (`commentsOpen`), enterprise IDs, i18n keys. Status → ACCEPTED. |
