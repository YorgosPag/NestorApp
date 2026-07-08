# ADR-590: Email Template Shared Primitives SSoT (`confirmation-email-shared` + showcase hero/labels)

## Status
✅ **ACTIVE — 2026-07-08** — De-duplication of the copy-pasted email builders under `src/services/email-templates/`. Two families collapsed onto shared primitives: (1) the **showcase** surfaces (building / parking / project / storage / property) shared their hero block, money/percent formatters and the identical label-accessor config; (2) the **confirmation** surfaces (reservation / cancellation / sale / professional-assignment+removal) shared their info-row / total-row / titled-card / greeting / closing / branded-wrap / VAT-split / orchestration primitives. jscpd (min-tokens 50) on the refactored fileset: **0 clones** (verified `jscpd:diff`); global clone count **4465 → 4409 (−56)**. Per-type data shapes and Greek copy stay per-file — only layout/logic primitives are shared (no God-shell).

**Related:**
- **ADR-585** (Domain Card View-Model Hook) — same shell+binding archetype for spatial cards; sibling de-dup in the same 2026-07-08 sweep.
- **ADR-586** (Meta Webhook Shared Core) — same sweep, communications bucket (core + thin adapters).
- **ADR-588** (Space Media Tab Shell) — same sweep, space-management bucket (shell + binding + shared primitives). This ADR is the same archetype for the email bucket.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the token-based detector that surfaced these twins and gates re-introduction.
- **ADR-316 / ADR-321** (Showcase core email builder factory) — `createShowcaseEmailBuilder`, the pre-existing SSoT shell this ADR completes by pushing the last per-surface duplication (hero / formatters / label accessors) into shared helpers.

---

## Context

`src/services/email-templates/` holds server-rendered Mailgun emails. Two families had drifted into copy-paste:

**Showcase family** — already thin configs over `createShowcaseEmailBuilder` (ADR-321), but each of building/parking/project/storage still inlined:
- a byte-identical `renderXxxHero` (name `<h1>` + optional code / subtitle / description lines — only the entity accessor differed),
- a private `formatMoneyAmount` (`Intl.NumberFormat('el-GR', EUR, 0 decimals)`) — **4 copies**, distinct from the base `formatEuro` (2 decimals),
- a private `formatProgress` (`Math.round + '%'`) — **2 copies**,
- the identical seven-lambda `labels: { … }` accessor object bridging the surface PDF labels to the factory — **4 copies**.

**Confirmation family** — no shared module at all. `buildInfoRow` was copy-pasted **×4**, `buildTotalRow` **×3**, and the `<!-- Info card -->` coloured-header table block, the greeting block, the closing/signature block, the `wrapInBrandedTemplate({…})` call, the VAT split (`gross/1.24`) and the `{ subject, html, text }` orchestration were duplicated across all four builders (and internally between `professional-assignment`'s assignment vs removal variants).

A **real SSoT audit (grep + jscpd)** confirmed the base engine (`base-email-template.wrapInBrandedTemplate`, `showcase-core.createShowcaseEmailBuilder`) was already the SSoT — the duplication was **presentational boilerplate + per-type binding**, not a second engine. Big-player practice (React Email / MJML / Maizzle) is exactly **shared partials/primitives + per-template composition**, so the fix generalises that.

> **i18n note (N.11):** the hardcoded-strings audit (`i18n-audit.sh`) only flags `t('key', { defaultValue: '…' })` — it does **not** scan raw Greek in server-side template literals, so none of these `.ts` builders are (or were) baselined. The shared greeting/closing helpers therefore safely carry the fixed `Αγαπητέ/ή` / `Με εκτίμηση` chrome; all **variable** copy stays a caller-supplied parameter.

---

## Decision

### Confirmation family — new module `src/services/email-templates/confirmation-email-shared.ts`
Layout/logic primitives, deliberately free of variable copy:

| Export | Owns |
|---|---|
| `buildInfoRow(label, value)` / `buildTotalRow(label, value)` | The two-column info / highlighted-total rows (was ×4 / ×3). |
| `buildInfoCard({ title, bodyHtml, headerColor? })` | The `<!-- Info card -->` coloured-header table (navy default, `#DC2626` for the cancellation reason). |
| `buildGreeting(name, introHtml)` / `buildClosing(closingHtml, companyName)` | Salutation+intro / farewell+signature scaffolding. Variable copy passed in. |
| `wrapConfirmationEmail(contentHtml, data)` | The `wrapInBrandedTemplate({…})` call + `companyName` fallback + footer-contact forwarding. |
| `assembleConfirmationEmail({ subject, contentHtml, text, data })` → `ConfirmationEmailResult` | The wrap + `{ subject, html, text }` orchestration tail. |
| `splitVat(gross, divisor=1.24)` → `{ net, vat }` | The VAT breakdown every buyer email recomputed. |
| `UnitPropertyFields` / `BuyerConfirmationFields` + `buildUnitPropertyCardBody` / `buildUnitPropertyTextLines` / `floorSuffix` | Shared buyer/unit/property data shape + its HTML card body & plain-text lines (Μονάδα / Κτίριο / Έργο / Διεύθυνση / Κατασκευαστική). |
| `textSectionHeader(title)` | `═══ TITLE ═══` plain-text section rule. |
| re-exports `BRAND, escapeHtml, formatEuro, formatDateGreek, formatPaymentMethod` | Single import origin for the whole family. |

The three buyer emails (`CancellationEmailData` / `ReservationEmailData` / `SaleEmailData`) now `extends BuyerConfirmationFields` and declare only their financial fields. `professional-assignment` keeps its own property shape (`Κωδικός`/`Ακίνητο`/`Όροφος` — genuinely different) and extracts **local** helpers for its assignment↔removal self-clones (`buildPropertyCardBody`, `buildBuyerCardBody`, `build{Property,Buyer,Contact}TextLines`).

### Showcase family — extend the existing SSoT
- `showcase-email-shared.ts` gains `renderShowcaseHero({ name, code?, codeLabel?, subtitleBits?, description? })`, `formatShowcaseMoney`, `formatShowcasePercent`. Building/parking/project/storage/property heroes become one call each; the 4+2 formatter copies are deleted.
- `showcase-core/email-builder-factory.ts` gains `standardShowcaseEmailLabels<L extends StandardShowcaseEmailLabelShape>()` — SSoT for the identical seven-lambda accessor object. Building/parking/project/storage pass `labels: standardShowcaseEmailLabels<XLabels>()`; property keeps bespoke accessors (its labels use `chrome.photosTitle`).

### Public contract preserved
Every exported builder (`buildReservationConfirmationEmail`, `buildBuildingShowcaseEmail`, …), its data interface and its `{ subject, html, text }` result are unchanged — callers are untouched. Rendered HTML/text is byte-equivalent modulo insignificant inter-tag whitespace (email clients collapse it).

---

## Out of scope
- **`professional-assignment` removal Notice** (two bespoke paragraphs) stays inline — unique copy, not a clone.
- **`FloorFloorplanInline` / other `formatEuro` consumers** — not touched; adopt shared helpers on next touch (Boy-Scout, N.0.2).
- **Merging the three buyer builders into one parametrised function** — rejected: their data types (`reason` vs `invoiceRef` vs `finalPrice/depositAlreadyInvoiced`) genuinely diverge; per-type separation + shared primitives is the ADR-588 lesson (no God-shell).

---

## Verification
- Jest: `src/services/email-templates/__tests__/shared-primitives.test.ts` — 16 tests, behaviour-preservation of the shared primitives + all four confirmation builders (cards present, VAT split, floor formatting, section headers, conditional cards). ✅
- `jscpd:diff` on the 13 changed files → **0 clones**. Global `jscpd:check` → **4409 / 4465 (−56)**. (`jscpd:baseline` intentionally not run — shared working tree; locked by the committer.)

---

## Changelog
- **2026-07-08** — Created. Showcase hero/formatters/label-accessor SSoT + new `confirmation-email-shared` module; 9 email builders refactored; −56 global clones (CHECK 3.28). ADR-590 (number reclaimed after ADR-589 was taken concurrently by the DXF tool-lifecycle work).
