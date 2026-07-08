# ADR-591: Impact-Preview Primitives SSoT (`impact-preview-primitives`)

## Status
✅ **ACTIVE — 2026-07-08** — De-duplication of the copy-pasted mutation-impact preview services under `src/lib/firestore/`. Six server-only `preview*Impact` services each re-declared byte-identical the same three primitives — the `allow` preview, the fail-safe `unavailable` preview, and the warn/block finalize. Collapsed onto one shared module `impact-preview-primitives.ts`; each service keeps only its own Firestore query + rule engine (`buildDependencies`) + logger. jscpd (min-tokens 50) on the refactored fileset: **0 clones** (verified `jscpd:diff`); global clone count **4465 → 4364 (−101)**. No God-shell: the divergent address/ownership previews consume only the shared builders (address keeps its bespoke `allow/warn/allow` finalize; ownership reuses the shared finalize for its non-forced path).

**Related:**
- **ADR-585** (Domain Card View-Model Hook), **ADR-586** (Meta Webhook Shared Core), **ADR-588** (Space Media Tab Shell), **ADR-590** (Email Template Shared Primitives) — same 2026-07-08 de-duplication sweep, same archetype (**shared primitive + per-instance binding**), different buckets.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the token-based detector that surfaced these twins and gates re-introduction.
- **ADR-307** (IKA Mutation Impact Guards) — the labor-compliance service migrated here.

---

## Context

`src/lib/firestore/` holds the server-only impact-preview services that power the mutation-guard API routes (`/api/projects/[projectId]/broker-terminate-preview`, `/engineer-impact-preview`, `/landowners-save-preview`, `/api/ika/labor-compliance-save-preview`, …). Each service answers the same question shape: *"if the user performs this mutation, what dependent records are affected, and should we allow / warn / block?"*

A **real SSoT audit (grep + jscpd)** showed **no** shared helper existed — every service inlined the same three pieces:

1. **`buildAllowPreview()`** — the canonical "nothing to warn about" preview. Byte-identical in **6 files**.
2. **`buildUnavailablePreview()`** — the fail-safe preview returned when the Firestore query throws (fail safe = `block`). Byte-identical in **6 files**.
3. The **finalize** idiom — `deps.length === 0 → allow`, otherwise count warn/block deps → derive `mode` → assemble the preview, wrapped in a `try/catch` that logs and returns `unavailable`. Present in **4 files** (broker / engineer / landowners / labor).

What genuinely differs per service — the Firestore query (collection + `where` filters), the rule engine (`buildDependencies`), the request type, and the logger channel — stays per-file. Big-player practice for this shape (a shared result-assembler + per-handler binding) is exactly **shared primitive + per-instance binding**, so the fix generalises that and avoids a God-shell over the divergent services.

---

## Decision

### New module `src/lib/firestore/impact-preview-primitives.ts`
Server-only (`import 'server-only'`), owns the three primitives once:

| Export | Owns |
|---|---|
| `buildAllowImpactPreview()` | The canonical `allow` preview (no deps, mutation is safe). Was ×6. |
| `buildUnavailableImpactPreview()` | The fail-safe `block` preview for a failed query. Was ×6. |
| `finalizeImpactPreview(deps, messageKey)` | Count warn/block deps → derive `mode` → assemble the dependency-only preview. Was ×4. |
| `resolveImpactPreview(compute, onError)` | The end-to-end `try/catch` wrapper: empty deps → allow, otherwise finalize, thrown error → unavailable (logged by the caller via `onError`). |
| `ImpactDependencyResult` (type) | `{ deps; messageKey }` — the return shape of a per-service `buildDependencies`. |

### Migrations
- **4 simple services** (`project-broker-terminate-impact`, `project-engineer-remove-impact`, `project-landowners-save-impact`, `ika-labor-compliance-save-impact`) → each becomes thin: keep query + `buildDependencies` + logger, delegate the whole assembly to `resolveImpactPreview(compute, onError)`. The labor service previously hardcoded `mode: 'warn'`; that is behaviour-identical to the derived mode because all its deps are `warn`.
- **2 larger services** — `project-address-mutation-impact` consumes only `buildAllowImpactPreview` / `buildUnavailableImpactPreview` and keeps its bespoke finalize (`blockingCount>0?'block':warningCount>0?'warn':'allow'`, with `mutationKinds`/`changes`). `project-ownership-mutation-impact` consumes the two builders **and** `finalizeImpactPreview` for its non-forced path, keeping only its bespoke `forcedBlock` branch.

**Public API unchanged** → the 4 API-route consumers are untouched.

> **i18n note (N.11):** all message identifiers are `impactGuard.*` i18n keys (no raw copy, no `defaultValue`) — nothing baselined or introduced here.

---

## Consequences

- **−101 clones** globally (4465 → 4364), 0 clones in the refactored fileset (`jscpd:diff`).
- One place now owns the allow / unavailable / finalize contract — a future field on `ProjectMutationImpactPreview` changes in one primitive, not six.
- New impact services should import the primitives (or `resolveImpactPreview`) instead of re-declaring them.

### Out of scope (boy-scout note, not touched)
`src/lib/firestore/` still contains two other structural clone clusters — `deletion-guard.ts ↔ deletion-link-guard.ts` (~54 lines) and internal self-clones in `soft-delete-engine.ts` (~36 lines). These live in more complex files and warrant a dedicated pass; recorded here, not addressed in this ADR.

---

## Verification
- `npx jest src/lib/firestore/__tests__/impact-preview-primitives.test.ts` → **8 GREEN** (allow / unavailable / finalize warn+block+fallback / resolve allow+finalize+error).
- `npx jest src/lib/firestore/__tests__` → **25 GREEN** (incl. pre-existing `contact-mutation-impact-preview`, `property-write-normalizer`).
- `npm run jscpd:diff -- <7 files>` → **0 new clones**.
- `npm run jscpd:check` → **4364/4465 (−101)**.
- ❌ No `tsc` (N.17 — agents do not run TypeScript checks).

## Changelog
- **2026-07-08** — Created. New `impact-preview-primitives.ts` SSoT + 6 service migrations + `impact-preview-primitives.test.ts` (8 tests). jscpd 4465 → 4364.
