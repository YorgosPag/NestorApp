# HANDOFF — ADR-928 §5.25.2: live verification of the PDF viewer + ADR-923 xChange report

**Date:** 2026-11-07 · **Worktree:** `C:\Nestor_Worktrees\adr-928-live-verify-2` · **Branch:** `agent/adr-928-live-verify-2`
**Previous handoff:** `HANDOFFS/2026-11-07_ADR-928_pdf-viewer-scroll_plural-fix-then-commit_handoff.md`

---

## 1. Current state (verified with git / gh, 2026-11-07)

| What | Status |
|---|---|
| `db033961` fix(i18n): ICU plural for the xChange report + the report behind a lazy surface (ADR-932 / ADR-923) | ✅ in `main` · ✅ pushed · ✅ **live** |
| `58802cf1` feat(files): PDF viewer like Chrome PDF (ADR-928 §5.25.1–§5.25.2) | ✅ in `main` · ✅ pushed · ✅ **live** |
| Production | **live `7b43cea`** (run `42373787991`: build ✓ · firebase-plan ✓ · firestore:indexes deployed with Giorgio's approval ✓ · Netcup ✓). Before it: `b324537` |
| Firestore rules / storage rules | identical to production — no deploy needed |

**Not one test was run** (N.(-2)). Nothing has been verified live yet.

---

## 2. NEXT — live verification (browser, only AFTER Giorgio logs in; never passwords)

### 2.1 PDF viewer (a project's files → open a PDF)
1. Opens at the **top** of page 1, in **"Fit"**.
2. **Mouse wheel** = vertical scroll (like Chrome PDF), not zoom.
3. **Ctrl+wheel** (⌘ on Mac) = zoom **anchored at the pointer**; the point under the cursor stays put.
4. **−/+** step through the zoom ladder; the percentage is correct.
5. Menu: **fit width / fit page**.
6. **Ctrl+\\** toggles fit-width / fit-page.
7. **Drag** (pan) works when the page is larger than the frame.
8. **Panel resize** → the page follows (fit is recomputed).
9. **Rotation** → the fit is recomputed and the page stays correct.
10. **Page change** → goes to the top of the new page.
11. **Highlights** follow the zoom/scroll.
12. **Mobile 390 px**: no horizontal page scroll; pinch zoom works.
13. **Clean console** (no errors/warnings from the viewer).
14. **Subcontract document page**: Ctrl+wheel zoom works the same way.

### 2.2 xChange report (ADR-923)
- `/catalog/imports` → open an **ETIM xChange** batch → the price report renders, **never a raw key**, with correct plurals: el "1 προϊόν… / 3 προϊόντα…", en "1 product… / 3 products…".

**Report to Giorgio:** ✅/❌ per item, with a screenshot where something fails. Any fix → a new commit on this branch, with an explicit file list.

---

## 3. Open decisions (Giorgio's — do NOT do them without a "yes")
- Tighten the route seal for `/catalog/imports`: 6947 → 6174 bytes (measured after the lazy surface).
- Tests for `usePdfViewport` / `zoom-anchor` (N.(-2): only with approval).
- Continuous scroll across all pages (Chrome/Acrobat style) vs. page-by-page.
- Unused `files.preview.*` keys.
- Unify the zoom controls (PDF viewer vs. other viewers).
- `wt:remove` of this worktree only on order, after verification.

---

## 4. Outside this branch (for information only — not this session's work)
- **`agent/common-spaces-stage-b`** (worktree `C:\Nestor_Worktrees\common-spaces-stage-b`, ADR-933 "Region" command): **no commit/land**. The hook blocks on CHECK 3.115, because the branch is 28 commits behind `main` and lacks `db033961`. The rebase was refused by the permissions in both sessions. Giorgio has to run `git stash push -m giorgio-cs-snap` → `git rebase main` → `git stash pop --index` there, then regenerate `i18n.ts`, commit, land and push. Backups held by the owning agent: a patch in its scratchpad + `git stash create` `e7f9df16`.
- **Orphan worktree** `.claude/worktrees/agent-a4aa1ef33828efaf9` (`agent/adr-923-w3-l1-quote-delivery`): no owner; the ADR-923 wave 4 handoff proposes discarding it. Left untouched.
- `7b43cea1` (Giorgio's property-dossier) went out with the message `<τι άλλαξε>` — pushed, so it is not amended.

---

## 5. DO NOT
- No `wt:land` / push without Giorgio's order. No commit on `main`.
- No tsc, no `--no-verify`, no `git add -A`, no bare `git stash`.
- No tests without approval. No changes outside the order.
