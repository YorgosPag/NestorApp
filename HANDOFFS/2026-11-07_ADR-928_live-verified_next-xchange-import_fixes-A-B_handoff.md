# HANDOFF — ADR-928 §5.25.2: PDF viewer VERIFIED live · next: xChange import (approved) + fixes A/B

**Date:** 2026-11-07 · **Worktree:** `C:\Nestor_Worktrees\adr-928-live-verify-2` · **Branch:** `agent/adr-928-live-verify-2`
**Previous handoff:** `HANDOFFS/2026-11-07_ADR-928_pdf-viewer-live-verify_handoff.md`
**Production:** live `7b43cea` (nestorconstruct.gr). No code changed in this session. Not one test was run (N.(-2)).

---

## 1. Live verification of the PDF viewer (§2.1 of the previous handoff) — DONE, 14/14 ✅

Measured in Giorgio's Chrome (logged in by him; Chrome zoom 80% ⇒ DPR 0.8, innerWidth 2400 CSS px).
File: `/files` → QT-0004.pdf (9 pages, `file_17ff952a…`).

| # | Item | Result |
|---|---|---|
| 1 | Opens at top, fit width, 1/9 | ✅ |
| 2 | Wheel = scroll (scrollTop 0→375, zoom unchanged) | ✅ |
| 3 | Ctrl+wheel anchored at pointer (200→313%, drift ≈0.5 px) | ✅ |
| 4 | −/+ ladder 313→400→300→250→200, canvas = 595×zoom | ✅ |
| 5 | Menu fit page 65% (547.3 ≤ 548) / fit width 200% | ✅ |
| 6 | Ctrl+\\ toggles fit | ✅ visually · ⚠️ **finding A** |
| 7 | Drag pan 1:1 (horizontal clamps at edge) | ✅ |
| 8 | Panel 1227→665 px ⇒ 200%→106% | ✅ |
| 9 | Rotation ⇒ 142% landscape, bitmap = CSS×DPR | ✅ |
| 10 | Next page ⇒ scrollTop 0 | ✅ |
| 11 | Highlights: ARIES import batch `cibat_2243edc8…` p.85/434, zero drift 168→328% + scroll | ✅ |
| 12 | 390 px: no horizontal page scroll; pinch (synthetic touch) 27→109% | ✅ · ⚠️ **finding B** |
| 13 | Console clean (only "message channel closed" ×5 = Chrome extension) | ✅ |
| 14 | Subcontract ΣΥΜ-2026-001 (`sca_20a68887…`): Ctrl+wheel anchor ≤1 px, also on grey margin | ✅ |

**Report this table to Giorgio as done** (already reported in chat 2026-11-07).

---

## 2. NEXT — in this order

### 2.1 xChange price report (ADR-923) — Giorgio said **"ΝΑΙ"** (2026-11-07) to two production imports
No ETIM xChange batch exists in production (only 4 ARIES PDF imports).
1. Singular: import `src/subapps/catalog/interop/etim/__tests__/fixtures/xchange-2.0.sample.json` via `/catalog/imports` → "Νέα εισαγωγή". It has **one** product with an AllowanceSurcharge (6%) ⇒ expected line "1 προϊόν έχει κλιμάκια…".
2. Plural: a **copy** of the same file in the session scratchpad (never in the repo) with **3** products that carry an AllowanceSurcharge ⇒ "3 προϊόντα…". Read `XChangeReportNote.tsx` first: count lines render **only when > 0** (onRequest / amountMissing / entryIncomplete / allowanceSurcharges).
3. Check both in **el and en** ("1 product… / 3 products…"), **never a raw key**. Screenshot on failure.
4. The batches stay "Σε έλεγχο" (nothing written to the catalog without approval) → **discard both** afterwards (button "Απόρριψη" in the batch header).
- Browser only after Giorgio logs in; never passwords. Use `file_upload` of the claude-in-chrome tools.

### 2.2 Finding A — screen-reader announcement misses keyboard/gesture zoom (approved: "ΟΚ ΠΡΟΧΩΡΑ" + quality mandate)
- `src/components/shared/media/viewer/DocumentZoomControl.tsx` — `useUserZoomAnnouncement` sets the `role="status"` sr-only text only after `markUserAction()` (buttons/menu). **Ctrl+\\** (`PdfCanvasViewer.tsx:264` → `toggleFit()`), Ctrl+wheel and pinch do not announce ⇒ status said 200% while 65% was visible.
- Proposal (verify with research — Chrome PDF / pdf.js / Acrobat / Google Docs a11y): **discrete** user actions (keyboard shortcuts, fit toggle) announce; **continuous** gestures (wheel/pinch) announce once, debounced after the gesture settles — never per frame.
- SSoT: the hook is shared with the subcontract `DocumentZoomBar` ⇒ fix it **in the hook / viewport owner (`usePdfViewport`)**, not per caller. Grep all callers of `markUserAction` / `DocumentZoomControl` first.

### 2.3 Finding B — `/files` on mobile squeezes the preview (approved, same message)
- At 390 px the file manager keeps list + preview side by side: viewer 194 px wide, page 27%, preview starts at y=831 of 844 (off-screen). This is the **file-manager layout**, not the viewer.
- Research first (Google Drive, Dropbox, OneDrive, Procore, Autodesk Docs mobile web): full-screen preview vs bottom sheet; back gesture/URL state.
- SSoT audit: grep the file-manager layout + any existing responsive/mobile sheet primitives (`Sheet`, `Drawer`, `useMediaQuery`/breakpoint hooks) before writing code. N.8: if ≥5 files / 2 domains → ask Giorgio (orchestrator vs plan mode).

### 2.4 Finding C — first load of `/catalog/imports` hung on "Φόρτωση καταλόγου…" >11 s once; reload fixed it. Unexplained — investigate only if Giorgio asks (one-line proposal).

### 2.5 After fixes: ADR-928 changelog (Phase 3) + commit on this branch with an **explicit file list**. Tests only with approval. No land/push.

---

## 3. Browser state / traps (learned this session)
- `resize_window` to a phone width applied a **persistent** device emulation (390×844 DPR 3) to the tab; resizing back failed ⇒ close that tab and open a new one.
- Synthetic wheel must be dispatched on `document.elementFromPoint(x, y)`, not on the scroller.
- Key name for Ctrl+\\ in `computer` is `ctrl+\\`.
- A stray empty "New tab" may remain outside the MCP tab group — Giorgio can close it.
- The cross-session peer note: `common-spaces-stage-b` landed to main as `473e8cf1` (ADR-933 Phase A), not pushed. Information only.

## 4. Open decisions (Giorgio's — unchanged)
Route seal `/catalog/imports` 6947→6174 · tests for `usePdfViewport`/`zoom-anchor` · continuous scroll across pages · unused `files.preview.*` keys · unify zoom controls · `wt:remove` of this worktree.

## 5. DO NOT
No `wt:land` / push without order · no commit on `main` · no tsc, no `--no-verify`, no `git add -A`, no bare `git stash` · no tests without approval · nothing outside the order · always answer in Greek.
