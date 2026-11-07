# HANDOFF — ADR-923 «ισχύει από» PUSHED (51ab4fb4) · next: live check, then findings D, E, A, B

**Date:** 2026-11-07 · **Worktree:** `C:\Nestor_Worktrees\adr-928-live-verify-2` · **Branch:** `agent/adr-928-live-verify-2`
**Previous handoff:** `HANDOFFS/2026-11-07_ADR-928_live-verified_next-xchange-import_fixes-A-B_handoff.md`
**main / production:** `51ab4fb4` landed + **pushed** (76afc4e7..51ab4fb4) → Netcup deploy of nestorconstruct.gr.

---

## 1. DONE this session

### 1.1 xChange price report live check (ADR-923 K4γ) — 4/4 ✅
Target: draft «Δοκιμή 6α B2B · Έκδοση 4» (created by Giorgio, later **discarded** by Giorgio — history only).
Files: EUR copies in the old session scratchpad (gone). Recreate if needed: copy
`src/subapps/catalog/interop/etim/__tests__/fixtures/xchange-2.0.sample.json`, set `CurrencyCode` = `EUR`, for 3 products
duplicate `Supplier[0].Product[0]` with distinct ManufacturerProductNumber / GTIN / SupplierItemNumber. Never in the repo.
| Check | Shown | |
|---|---|---|
| el singular | «1 προϊόν έχει κλιμάκια ή επιβαρύνσεις, που η γραμμή τιμής δεν κρατά.» | ✅ |
| el plural | «3 προϊόντα έχουν κλιμάκια…» | ✅ |
| en singular / plural | «1 product has… / 3 products have…» | ✅ |
| raw keys | none | ✅ |
All 3 test batches discarded (`/discard` 200): `cibat_dcd6dfba…`, `cibat_7ed22d11…`, `cibat_c8c06212…` (GBP).

### 1.2 «Ισχύει από» prefilled (Giorgio's request) — commit `51ab4fb4`, ADR-923 changelog 2026-11-07
- `publishableStart(versions, nowMs)` in `src/subapps/catalog/pricing/version-timeline.ts` (same rule as `judgeVersionPublication`):
  earliest = day after latest published start · suggested = **tomorrow** or earliest (rule of `nextPeriodStart`, Σ7: never retroactive) · after = version number.
- ONE field `src/components/catalog/pricing/ValidFromField.tsx` used by NewVersionDialog, DraftVersionRow, PublishVersionDialog:
  named hint, days before the fence disabled in the calendar, quick picks Today/Tomorrow/1st of next month (+ No date on drafts).
- Publish of a dateless draft starts from the suggestion (`usePublishFlow.suggestedValidFrom`); a stored date wins.
- `VersionTimeline` filters to its own `priceListId` before suggesting (the view holds ALL lists).
- SSoT: `instantOfDateKey` / `dayAfterInstant` moved to `src/lib/calendar/date-key.ts` (used by `discount-condition-draft.ts` too).
- ⚠️ Tests written, **NOT run**: `src/subapps/catalog/pricing/__tests__/publishable-start.test.ts`, +2 in
  `src/components/catalog/pricing/__tests__/use-publish-flow.test.ts`. Run only with Giorgio's approval.
- ⚠️ Land needed 2 rebases (main moved: accounting commits). Conflicts: ADR-923 changelog (kept all rows), generated
  `src/types/i18n.ts` + `shell-slice.manifest.json` (taken from main, **regenerated**, never hand-merged). Rebase does not run the
  pre-commit hook: the post-rebase result was not hook-checked.

---

## 2. NEXT — in this order (each needs Giorgio's «ναι» where marked)

### 2.1 Live check of 1.2 after deploy (approved by implication of push — confirm with Giorgio)
Τιμοκατάλογοι → Δοκιμή 6α B2B → Εκδόσεις → «Νέα έκδοση»: field prefilled 08/11/2026 (tomorrow), hint «Νωρίτερα 31/10/2026: … Έκδοση 3»,
days ≤ 30/10 not selectable, quick picks work. **Do NOT press «Δημιουργία»** (agent clicks on create/discard are blocked by the
permission classifier anyway — Giorgio clicks). Also check en.

### 2.2 Finding D — currency conflict is invisible (needs «ναι»)
GBP xChange file → server 422 `catalog.invalid` `issues:[{code:'currencyConflict', path:'fileId', params:{currency:'GBP',expected:'EUR'}}]`
on `POST /api/catalog/imports/{id}/map`. UI toast says «δείτε τα πεδία με κόκκινο» but **no field is red** (`fileId` has no field);
the batch stays «Αντιστοίχιση» with only «Δεν υπάρχουν προτάσεις ακόμη.». Research (Akeneo / Salsify / Shopify import errors) →
show file-level issues on the batch + in the new-import panel, by issue code. SSoT audit first: `useIssueMessage`, `FieldIssues`,
`CatalogIssues`, `catalogFailureOf`, import panel failure path (`NewImportPanel.tsx`, `use-import-batch.ts`).

### 2.3 Finding E — `xchange.pricesImported` without plural (needs «ναι»)
«Μπήκαν στον έλεγχο τιμές για 1 από 1 προϊόντα» (en «1 of 1 products»). Key in `src/i18n/locales/{el,en}/catalog-import.json`.
Check why CHECK 3.115 (`npm run test:i18n-plural`, ADR-932) did not catch it (`{products}` not named `count`?) — fix the CLASS.
Same for `xchange.imported` ({imported, products}).

### 2.4 Finding A — screen-reader zoom announcement (approved earlier) — see previous handoff §2.2
### 2.5 Finding B — `/files` mobile preview squeezed (approved earlier) — see previous handoff §2.3
### 2.6 Finding C — `/catalog/imports` «Φόρτωση καταλόγου…» seen again ~9 s (2nd time). Investigate only if Giorgio asks.

---

## 3. Browser / tool traps (this session)
- Agent clicks that create/discard production records (new price version, discard version) are **denied** by the auto-mode
  classifier → navigate + open the dialog, Giorgio clicks. Import «Έναρξη» and batch «Εγκατάλειψη» were allowed.
- Long `javascript_tool` polls >40 s time out (CDP 45 s) → keep each poll ≤ 38 s.
- To read an API error body: wrap `window.fetch` in the page and capture `/api/catalog/imports*` responses.
- Price-list dialogs: the new-version dialog's version list only shows **draft** versions; none exist by default.
- Repo-wide `grep`/`Grep` on `src` can time out (>120 s) — scope to a folder.

## 4. DO NOT
No commit on `main` · `wt:land` / push only on Giorgio's order · no tsc · no `--no-verify` · no `git add -A` · no bare
`git stash` · no tests without approval · nothing outside the order · SSoT grep before any code · always answer in Greek.
