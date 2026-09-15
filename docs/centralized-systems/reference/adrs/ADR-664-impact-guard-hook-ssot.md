# ADR-664: Mutation Impact Guard **Hook** SSoT (`useProjectImpactGuard`)

## Status
✅ **ACTIVE — 2026-07-16** — De-duplication of the copy-pasted client-side mutation-impact guard hooks under `src/hooks/`. Six `use*ImpactGuard` hooks each re-declared byte-identical the same preview state machine — fetch preview → allow/warn/block → INP-deferred confirm — differing only in endpoint, log scope, and whether the caller wants `onBlockDismiss`. Collapsed onto one shared hook `impact-guard/useProjectImpactGuard.tsx`; each sibling keeps only its binding. **Public API unchanged** → the six `useGuarded*` consumers are untouched. jscpd on the refactored fileset: **0 clones** (verified `jscpd:diff`); the six files went **704 → 334 lines** and **24 clones / 428 duplicated lines → 0**.

**Related:**
- **ADR-591** (Impact-Preview Primitives SSoT) — **the server-side mirror of this ADR**, same family (broker / engineer / landowners / labor), same archetype (**shared primitive + per-instance binding**). ADR-591 de-duplicated the `src/lib/firestore/` *services* that answer the preview; this one de-duplicates the `src/hooks/` *hooks* that consume it. Together the two ends of the same request are now each owned once.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the token-based detector that surfaced these twins. Found by a full `jscpd:check` sweep: `src/hooks/ ↔ src/hooks/` was the **largest directory pair in the repo** (1331 lines / 82 clones / 32 files), and this family was its core.
- **ADR-307** (IKA Mutation Impact Guards) — cited by `useIkaLaborComplianceSaveImpactGuard` and by ADR-591. ⚠️ **No `ADR-307-*.md` file exists in `adrs/`** — the reference is a phantom. Recorded here, not invented: the docblock citation was preserved as-is rather than silently dropped or fabricated.

---

## Context

Every mutation that can break dependent records is fronted by a guard hook. The hook asks the preview endpoint what the mutation would affect, then:

- `allow` → run the mutation immediately
- `warn` → show `ProjectMutationImpactDialog`; run the mutation only if the user confirms
- `block` → show the dialog; the mutation can never run

A **real SSoT audit (grep + `.ssot-registry.json` + jscpd)** found **no shared hook existed** — the machine was inlined six times:

| Hook | Lines | Endpoint | Deviation from the others |
|---|---|---|---|
| `useProjectBrokerTerminateImpactGuard` | 110 | `BROKER_TERMINATE_PREVIEW(id)` | — |
| `useProjectEngineerRemoveImpactGuard` | 110 | `ENGINEER_IMPACT_PREVIEW(id)` | — |
| `useProjectLandownersSaveImpactGuard` | 110 | `LANDOWNERS_SAVE_PREVIEW(id)` | — |
| `useProjectOwnershipMutationImpactGuard` | 123 | `OWNERSHIP_IMPACT_PREVIEW(id)` | `onBlockDismiss` |
| `useProjectMutationImpactGuard` | 121 | `IMPACT_PREVIEW(id)` | `onBlockDismiss` |
| `useIkaLaborComplianceSaveImpactGuard` | 130 | `IKA.LABOR_COMPLIANCE_SAVE_PREVIEW` | no request body; fixed route; `createModuleLogger` instead of `console.error` |

The three axes above are the **only** real variation. `buildUnavailablePreview()` was byte-identical in all six (and, per ADR-591, in six services besides). Each hook has exactly **one** consumer — a thin `useGuarded*` wrapper — so the public surface was small and fully known before the merge.

### Two defects the audit surfaced (fixed here, not carried forward)

1. **Dead state in 3 of 6.** `previewRef` is written on every preview and cleared on reset — but only `ownership` and `project-mutation` ever *read* it (to decide whether a dismissal was a `block`). In broker / engineer / landowners it is pure copy-paste residue: written, never read.
2. **`reset` was unstable in the 2 hooks that take options.** `options` defaulted to a fresh `{}` literal and `reset` depended on `[options]`, so `reset` — and therefore the `ImpactDialog` `useMemo` that depends on it — was re-created on **every render**. `useGuardedOwnershipTableMutation` passes an inline object literal, so this fired in production. The SSoT reads `onBlockDismiss` through a ref, making `reset` genuinely stable.

---

## Decision

### New module `src/hooks/impact-guard/useProjectImpactGuard.tsx`

| Export | Owns |
|---|---|
| `useProjectImpactGuard<TRequest>(scope, endpoint, options?)` | The whole state machine: `checking`, preview fetch, allow/warn/block routing, INP-deferred confirm, `reset`, and the memoised `ImpactDialog`. |
| `buildUnavailableProjectImpactPreview()` | The fail-safe `block` preview for a failed endpoint. Was ×6. |
| `ProjectImpactGuardOptions` / `ProjectImpactGuard<TRequest>` (types) | The options and return contract. |

**Why `endpoint: string` and not a `fetchPreview` callback.** The caller already resolves its own route (`API_ROUTES.PROJECTS.X(projectId)` → a string; IKA's is a plain constant). Passing the resolved string covers both shapes with no branching, and — because it is a **primitive** — `previewBefore`'s `useCallback` stays referentially stable without the caller having to memoise anything. A callback parameter would have re-created the guard on every render unless every call site remembered to wrap it.

### Migrations
Each of the six becomes a binding of ~24 lines that names its scope, resolves its endpoint, and re-exports the shared `previewBefore` under **its own historical method name** (`previewBeforeTerminate` / `previewBeforeRemove` / `previewBeforeSave` / `previewBeforeMutate`). `useIkaLaborComplianceSaveImpactGuard` additionally adapts the signature — its `previewBeforeSave(action)` takes no request — by binding a module-level frozen empty request.

**No God-shell:** `usePropertyMutationImpactGuard` and `useContactMutationImpactGuard` are **deliberately out of scope**. They are not twins of this family — they carry a *different* preview type (`PropertyMutationImpactPreview` has no `companyLinkChange`; `ContactIdentityImpactPreview` has `affectedDomains`), render a *different* dialog, and use a different message-key namespace. Contact diverges further still: no `checking`, a `MutationResult` return, and a two-branch individual/service flow. Forcing them in would mean generics over preview type *and* dialog *and* message key — a shell that hides more than it shares.

### One intentional behaviour change
The five hooks that logged via `console.error` now log via `createModuleLogger(scope)` — the project's telemetry SSoT, which `useIkaLaborComplianceSaveImpactGuard` already used. Unifying the other way would have regressed IKA off the SSoT. This affects console output only (`logger.error` clears the browser WARN threshold), never UI or control flow.

---

## Consequences

- **−24 clones** in this fileset (428 duplicated lines → 0); the six files shrink **704 → 334 lines**, of which 153 is the new shared hook.
- One place now owns the guard contract: a change to the INP pattern, the fail-safe preview, or the dialog wiring happens **once**, not six times.
- `reset` is stable, so the impact dialog no longer re-renders on every parent render in the two option-taking guards.
- New impact guards should bind `useProjectImpactGuard` instead of re-declaring the machine. The server end should bind ADR-591's primitives.

### Out of scope (boy-scout note, not touched)
The `src/hooks/ ↔ src/hooks/` cluster has more beyond this family — `useEntityAudit ↔ useGlobalAuditTrail` (107 lines / 6 clones, ⚠️ touches the `entity-audit-trail` registry module, ADR-195), the `use*TrashState` quartet (~115 lines), `useBorderTokens` self-clones (115 lines), `useCameraCapture ↔ useVideoRecorder` (68 lines). Recorded in `.claude-rules/pending-ratchet-work.md`, not addressed here.

---

## Verification
- `npx jest src/hooks/impact-guard` → **31 GREEN** (13 state machine + 18 bindings).
- `npx jest src/hooks/impact-guard src/hooks/__tests__` → **49 GREEN** (incl. pre-existing `useContactMutationImpactGuard`, untouched).
- **Mutation-verified — the tests were proven to fail on the two bugs this refactor actually risks:**
  1. wired `useProjectEngineerRemoveImpactGuard` to the broker endpoint → the binding test failed;
  2. replaced the confirm `setTimeout(…, 0)` with a synchronous call → the INP test failed.
  Both reverted; 31/31 restored.
- `npm run jscpd:diff -- <7 files>` → **0 new clones** (without `SKIP_JSCPD_DIFF`).
- `npm run jscpd:check` → **2926/3059**. ⚠️ The tree is shared with other agents' uncommitted work, so that figure is not this ADR alone; the isolated, measured contribution is **−24 clones**.
- ❌ No `tsc` (N.17 — agents do not run TypeScript checks).

## Addendum — ONE decision core for all three guard families *(2026-09-15, ADR-777 §8.69.13)*

**The defect (live test, ADR-777 §8.69.11 #3):** Sales → «Αλλαγή Τιμής» → impact dialog (`warn`) → «Συνέχεια» ⇒ `PATCH 200`,
but the price dialog stayed open with no message. The same machine existed **three** times (this ADR merged six project
hooks and deliberately left property + contact out) and in all three it resolved `false` **before** the human decided,
then ran the confirmed action **fire-and-forget** (`setTimeout(() => void action())`). No caller ever learned the outcome;
`usePropertiesSidebar` even showed «success» when the guard **blocked**.

**Decision:** promise-based confirmation (Radix discussion #1328 · react-confirm) in one core, bound by all three families.

| Module | Role |
|---|---|
| `src/hooks/impact-guard/guard-result.ts` | **Pure** (no React): `GuardOutcome = 'completed' \| 'cancelled' \| 'blocked' \| 'failed'` · `GuardResult` (`failed` carries the error) · `runGuardedAction` · `outcomeOrThrow` |
| `src/hooks/impact-guard/useImpactDecision.ts` | The state machine: `guard({ fetchPreview, unavailablePreview, action })` resolves **after** the action; `dialogProps` for any impact dialog; `onBlockDismiss`; `checking` |
| `useProjectImpactGuard` · `usePropertyMutationImpactGuard` · `useContactMutationImpactGuard` | Bindings: endpoint + dialog + (property/contact) when a preview is needed at all |

- **INP gain kept:** dialog closes first, action runs in the next task — only the promise now resolves *after* it.
- **Radix order:** `AlertDialogAction` runs `onClick` (confirm) **before** `onOpenChange(false)`; confirm *takes* the pending
  decision, so the close that follows cannot cancel it (anchor Ε6).
- **No hanging promise:** unmount / `reset` / a second call while pending ⇒ `cancelled` (newest intent wins).
- **Caller rule:** success only on `completed`; `outcomeOrThrow` rethrows `failed` into the caller's **existing** catch
  (`translatePropertyMutationError`); silence on `cancelled`/`blocked`.
- **Callers fixed:** ChangePriceDialog · RevertDialog · use-sales-action-mutation · usePropertyInlineEdit · usePropertiesSidebar ·
  usePropertyViewer · PropertyDetailsContent (building link: cancel is no longer reported as an error) · PropertyFieldsBlock ·
  LinkedSpacesCard (rollback only after the decision) · GeneralProjectTab · ProjectBrokersTab · ProjectAssociationsTab ·
  useTitleBlockApproval (approval now recorded after «Συνέχεια») · useContactUpdateGuards → executeGuardedContactUpdate →
  useGuardedContactMutation → useContactSubmission / useContactDetailsController / usePersonaToggle. Landowners, labor
  compliance and ownership-table callers report inside their own action and needed no change.
- 🗑️ `blockedUnsafeClear` removed: its only producer always returned `false` (grep).
- Boy-scout (CHECK 3.28 on touched files, all pre-existing): `useGuardedContactMutation` twin updaters · `ProjectBrokersTab`
  twin agreement cards · `GeneralProjectTab` form values (initial vs sync, already diverging on `description`) · contact
  deferred save (`utils/contactForm/deferred-save.ts`) · sales dialog header (`use-sales-dialog-base.ts`).

**Anchors:** new `useImpactDecision.test.tsx` (12) · `useProjectImpactGuard.test.tsx` (13, adapted) · bindings · contact guard ·
new caller anchors `change-price-dialog-outcome.test.tsx` (4) and `usePropertiesSidebar-outcome.test.tsx` (4).
**Mutations 4/4 red:** resolve before the action (2) · dismiss ⇒ `completed` (4) · action error ⇒ `completed` (2) · sidebar
ignores the outcome (2). Jest over hooks/sales/property/projects/contacts/title-block: **84/85 suites** — the one red is
`useSelectedEntityUrlState` (unrelated: `url-query-state` went async in `8c1f8fd7`). `jscpd:diff` on every touched file: **0**.

**Declared limits:**
1. A contact update the guard *chain* hands to one of its own dialogs resolves `cancelled` for the caller — that dialog
   (`createGuardHandlers`) reports its own outcome.
2. Callers keep their `saving` state while the (modal) impact dialog is open.
3. Unmount after «Συνέχεια» does not abort the scheduled action; it still runs and resolves.
4. The registry module `impact-guard-hook` was re-described, not given a new pattern (a new pattern needs a golden example and
   a baseline run — not an agent task, N.12).

## Changelog
- **2026-09-15** — **ONE decision core for property, project and contact guards** (Addendum above, ADR-777 §8.69.13): named
  outcome resolved after the action · `guard-result.ts` + `useImpactDecision.ts` · 3 families + 6 bindings + 17 callers ·
  12+4+4 new anchors, mutations 4/4 · 5 boy-scout clone fixes.
- **2026-07-16** — Created. New `impact-guard/useProjectImpactGuard.tsx` SSoT + 6 hook migrations + 2 test files (31 tests). Fixed dead `previewRef` in 3 hooks and unstable `reset` in 2. jscpd −24 clones in the fileset.
