# ADR-548 — Ribbon re-render cascade: σπάσιμο του levelManager churn (auto-save status)

**Status:** 🟡 IMPLEMENTED (UNCOMMITTED 2026-06-28) — pending browser-verify + commit (Giorgio)
**Domains:** perf (re-render cascade), levels/auto-save context, DXF ribbon
**Σχετικά:** ADR-040 (micro-leaf subscriber doctrine), ADR-547 (scene-model SSoT cascade — ΑΔΕΛΦΗ ρίζα, διαφορετικός vector), ADR-345 (DXF ribbon interface), ADR-341 (God-context split)
**Πηγή:** `HANDOFFS/HANDOFF_2026-06-28_ribbon-cascade-ROOT-levelmanager-churn.md` · React-DevTools Profiler `profiling-data.28-06-2026.11-47-13.json` (69% session σε render, ribbon + ~903 tooltips)

---

## 1. Πρόβλημα

Σε **κάθε** edit (και σε κάθε auto-save cycle) το ribbon + ~903 tooltips ξανα-render-άρονταν
(profiler: **69%** του session χρόνου σε render). Η αλυσίδα:

```
auto-save cycle (saveStatus saving→success→idle, lastSaveTime)
  → sceneManager (useAutoSaveSceneManager) αλλάζει identity
  → getCurrentFileName / getAutoSaveStatus (dep: [sceneManager]) → νέα refs
  → LevelsHookReturn useMemo recompute → LevelsContext value νέα ref
  → ~40 ribbon-command bridges churn → useRibbonCommands νέο
  → RibbonRoot React.memo σπάει → ΟΛΟ το ribbon + tooltips render
```

## 2. Ρίζα (CODE = source of truth)

Το `LevelsContext` value **υποτίθεται** σταθερό σε edit (ADR-547 §2: deps μόνο
`fileRecordId`/`saveContext` + ref-based scene getters). Στην πράξη **δεν ήταν**: το dep array
περιείχε ΚΑΙ `getCurrentFileName` / `getAutoSaveStatus`, που ήταν `useCallback(..., [sceneManager])`.
Το `sceneManager` αλλάζει identity σε κάθε save cycle (`saveStatus`/`lastSaveTime` = deps του δικού
του `useMemo`), άρα οι getters churn-άρουν → όλο το context churn-άρει. Δηλαδή το volatile
auto-save status «κουβαλιόταν» πάνω στο levels context.

## 3. Απόφαση — dedicated reactive κανάλι (ADR-040 doctrine)

Το volatile scene auto-save status **βγαίνει** από το levels context σε zero-React singleton store,
ίδιο pattern με `CompletionStyleStore` / `ModalPresenceStore`:

- **NEW `stores/AutoSaveStatusStore.ts`** — `{ currentFileName, lastSaveTime, saveStatus }` snapshot ·
  `get()` σταθερό ref μεταξύ αλλαγών (no-op `set` όταν δεν αλλάζει πεδίο) · `useAutoSaveStatus()` hook
  (`useSyncExternalStore`).
- **`useAutoSaveSceneManager.ts`** — ΕΝΑΣ writer effect `set({currentFileName,lastSaveTime,saveStatus})`
  στα `[currentFileName, lastSaveTime, saveStatus]`. Το React state μένει ο owner· το store είναι
  projection (όχι δεύτερη πηγή αλήθειας).
- **`AutoSaveStatus.tsx`** — διαβάζει από `useAutoSaveStatus()` (όχι getters) → re-render **μόνο** αυτό
  το widget σε save cycle.
- **`LevelsSystem.tsx`** — αφαιρέθηκαν `getCurrentFileName`/`getAutoSaveStatus` (def + return + deps).
  Το context value είναι πλέον πραγματικά σταθερό σε edit/save cycle.
- **`useLevels.ts`** — αφαιρέθηκαν τα 2 optional type fields (μόνος consumer ήταν το AutoSaveStatus).

**SSoT audit:** ο μόνος consumer των getters ήταν το `AutoSaveStatus.tsx` (content-grep). Το
`CentralizedAutoSaveStatus.tsx` διαβάζει **διαφορετική** πηγή (`useSettingsSaveStatusOptional`,
settings save-status, ADR-341) → **δεν** επηρεάζεται. Άρα αφαίρεση (όχι dead ref-stable getters) =
η SSoT-σωστή έκβαση: σκοτώνει τον churn vector + καθαρίζει dead code.

## 4. Συμπληρωματικό (Fix A)

`hooks/common/useImportWizard.ts` — 9 functions σε `useCallback` + return σε `useMemo` (1 από τις 2
πηγές churn· από μόνο του δεν έσπαγε το cascade — ο cascade-killer είναι το §3).

## 5. Εκτός scope

God-context split (ADR-341 pattern) — λάθος target για αυτό το cascade· optional Layer 2, ΜΟΝΟ αν
re-profile δείξει ότι αξίζει.

## 6. Verification

- 5 jest (`stores/__tests__/AutoSaveStatusStore.test.ts`) GREEN — snapshot/notify/no-op/unsubscribe/stable-ref.
- 🔴 Browser re-profile («record why» ON, self-time top-25) εκκρεμεί: επιβεβαίωση ότι save cycle πλέον
  re-render-άρει **μόνο** το AutoSaveStatus, όχι ribbon/tooltips.

## Changelog

- **2026-06-28** — Δημιουργία. §3 dedicated store + getter removal (IMPLEMENTED, UNCOMMITTED). 5 jest GREEN.
