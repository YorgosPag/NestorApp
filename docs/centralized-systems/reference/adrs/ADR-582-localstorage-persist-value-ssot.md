# ADR-582 — `createPersistedValue` — localStorage-persistence SSoT

**Status:** 🟡 IMPLEMENTED (UNCOMMITTED) — 🔴 browser-verify + commit + ssot:baseline εκκρεμούν
**Date:** 2026-07-07
**Domain:** DXF Viewer / State & persistence (stores, systems, config, bim-3d)
**Related:** ADR-092 (centralized localStorage service `storage-utils.ts`), createExternalStore (WAVE 3 platform primitive `@/lib/state`), ADR-040 (micro-leaf zero-React stores), ADR-294 (SSoT ratchet)

---

## 1. Πρόβλημα

~10+ module-level stores στο dxf-viewer επαναλάμβαναν χειροκίνητα το **ίδιο** persistence boilerplate: init με `typeof localStorage === 'undefined' ? default : JSON.parse(getItem(key)) ?? default`, mutator με `setItem(key, JSON.stringify(next))` (± `removeItem` on default) μέσα σε try/catch, **ΚΑΙ** το createExternalStore pub/sub. Δύο SSoT υπήρχαν ήδη αλλά **δεν** χρησιμοποιούνταν μαζί:
- `createExternalStore` (reactive pub/sub) — χρησιμοποιούνταν.
- `storage-utils.ts` (ADR-092) `storageGet`/`storageSet`/`storageRemove` (SSR-safe + quota-guarded + JSON) — **παρακαμπτόταν** από πολλά stores που έγραφαν raw `localStorage.getItem/setItem`.

Λείπε το **combination** primitive (Zustand `persist` middleware / VS Code Memento analog): reactive **ΚΑΙ** persisted single value, hydrate-on-init + persist-on-change, μία φορά.

## 2. Απόφαση

Νέο `src/subapps/dxf-viewer/stores/createPersistedValue.ts` — **συνθέτει** τα δύο υπάρχοντα SSoT, δεν ξαναγράφει κανένα:

```ts
createPersistedValue<T>(key, defaultValue, {
  equals?,            // forwarded στο createExternalStore (suppress redundant notify+persist)
  removeOnDefault?,   // Object.is vs default → storageRemove (lean storage)
  validate?,          // normalise hydrated value (clamp / enum-coerce / finite-check)
  serialize?, deserialize?,  // Zustand-parity RAW-STRING codec (βλ. §3)
}): ExternalStore<T>
```

- **Hydrate:** `storageGet(key, default)` (JSON) ή codec raw-string· μετά `validate`.
- **set:** τρέχει το underlying set (τιμά `equals`), persist **μόνο** αν άλλαξε το snapshot (equals-suppressed / same-value write = no localStorage touch — byte-identical με τα παλιά `if (next===cur) return` guards).
- **reset:** delegates στο `createExternalStore.reset` (state + drop subscribers, **NO persist**) — test/lifecycle.

Επιστρέφει το απλό `ExternalStore<T>` shape, ώστε τα domain wrappers (`getX/setX/subscribeX`) να μένουν **ΑΚΡΙΒΩΣ** ίδια.

## 3. Raw-string codec + `storage-utils` επέκταση

Αρκετά stores persist-άρουν **raw non-JSON strings** (enum literal `'mm'`, XLine mode `'through'`, legacy boolean `'1'`/`'0'`). `JSON.parse('mm')` **throw**-άρει → τυφλή migration σε JSON θα **έσβηνε** τις αποθηκευμένες προτιμήσεις κάθε χρήστη (data-loss). Λύση (Zustand-parity):
- **storage-utils.ts**: νέα `storageGetString(key)` / `storageSetString(key, raw)` (SSR/quota-safe, reuse `isStorageAvailable`) — raw string, χωρίς JSON.
- **createPersistedValue**: όταν δοθούν **ΚΑΙ** `serialize` **ΚΑΙ** `deserialize` → raw-string path (exact legacy format preserved, `deserialize` throw → default). Αλλιώς JSON path.

Έτσι μετανάστευσαν **ΜΕ ΜΗΔΕΝΙΚΗ αλλαγή storage-format** και τα raw-string stores.

## 4. Classification (grep-audit 20 candidates → 3 buckets)

| Bucket | Πλήθος | Μηχανισμός | Αρχεία |
|---|---|---|---|
| **A** createPersistedValue | 5 | reactive single value | LinetypeScaleStore*, LineweightDisplayStore (codec '1'/'0'), display-unit-state (codec 'mm'), LinetypeRegistry (array+validate), CommandHistoryStore (split entries/navIndex) |
| **B** storageGet/Set(String) | 7 | non-reactive read/modify/write (dynamic key = arg) | last-active-tab-tracker*, regression-detector, baseline-tracker, CommandAliasRegistry, PerformanceHistoryStore (Zustand kept — μόνο το enabled boolean), xline-mode-store (composite· μόνο το `mode` → storageGetString), LayerFiltersStore (pinned-smart, per-project dynamic key) |
| **C** leave | 8 | bespoke multi-key / driver / high-risk | QuickStyleStore (5 keys, own ratchet), polar-tracking-store, ambient-alignment-config-store, PerformanceHUDStore, auto-submit-store, session-id-generator, telemetry-store, CommandPersistence (IndexedDB driver) |

*golden references (έγιναν χειροκίνητα πρώτα). Η classification + migration έγιναν με **orchestrator** (Giorgio-approved): 20 haiku classifiers + 9 sonnet migrators· 2 golden + 3 raw-string/dynamic-key χειροκίνητα. **12 stores migrated συνολικά.**

**LayerFiltersStore (τελικά migrated, ΟΧΙ deferred):** ο classifier το φοβήθηκε ως «A needs fixed key», αλλά η pinned-smart persistence είναι **δύο helper functions** (`readPinnedFromStorage`/`writePinnedToStorage`) με dynamic per-project key `dxf:pinnedSmartFilters:{pid}` — **B-style**: `storageGet`/`storageSet` δέχονται το key ως **argument**, άρα το dynamic key καλύπτεται φυσικά. Zero behavior/format change· 17/17 jest GREEN (incl. pinned survive-project-switch).

## 5. Γιατί ΟΧΙ content-ratchet guard (honest)

Το handoff πρότεινε ratchet «forbid inline `localStorage.getItem/setItem` σε stores». **Δεν** προστέθηκε: το CHECK 3.7 (ADR-294) είναι **repo-wide χωρίς path-scoping** (τεκμηριωμένο στο module `point-translate-helpers`), οπότε ένα `localStorage\.(getItem|setItem)` pattern θα μπλόκαρε **ΟΛΟ** το repo (auth, other subapps, legit localStorage). Το `allowlist` απλώς εξαιρεί αρχεία — δεν μπορεί να scope-άρει σε dxf. Άρα enforcement = canonical primitive + αυτό το ADR + code review (ίδια απόφαση με point-translate-helpers). Το QuickStyleStore διατηρεί το **δικό** του namespaced ratchet (`dxf:quickStyle.*`).

## 6. Έλεγχος (jest· ΟΧΙ tsc — N.17)

- `stores/__tests__/createPersistedValue.test.ts` — 12 (hydrate/persist/removeOnDefault/equals/validate/reset + raw-string codec: bare-string persist, legacy hydrate, '1'/'0' round-trip, corrupt→default).
- `stores/__tests__/persist-ssot-migration-smoke.test.ts` — 7 (load + public-API smoke για no-test migrated: CommandHistoryStore, xline-mode, displayUnit, last-active-tab, baseline-tracker, CommandAliasRegistry, regression-detector).
- Regression: LinetypeScaleStore 6, LineweightDisplayStore 5, LinetypeRegistry (2 suites) — **όλα GREEN** (45 + 7 = 52).
- PerformanceHistoryStore: read-verified (Zustand store διατηρήθηκε· μόνο το `enabled` boolean → storageGet/Set, format-compatible) — δεν test-άρεται μόνο του (Zustand instance).

## 7. Συνέπειες

- ✅ ΕΝΑ persistence primitive· reuse createExternalStore **και** storage-utils (κανένα re-impl).
- ✅ 12 stores migrated με **μηδενική αλλαγή** public API + storage-format (raw-string codec).
- ✅ storage-utils επεκτάθηκε με raw string accessors (γενικό, reusable).
- ⚠️ 8 C-leave stores εκτός (τεκμηριωμένα)· ΟΧΙ content-ratchet (repo-wide over-block).
- 🔴 browser-verify (LTSCALE/lineweight/display-unit/XLine-mode/command-history/pinned-filters persist across reload) + commit + `ssot:baseline` (κανένα νέο ratchet module — skip) εκκρεμούν (Giorgio).

## Changelog

- **2026-07-07** — Δημιουργία (Opus 4.8, orchestrator). Νέο `createPersistedValue` (createExternalStore + storage-utils) + raw-string codec + `storageGetString/Set` στο storage-utils. Classification 20 stores → migration **12** (A5/B7, C8 εκτός): 2 golden + 9 orchestrated + 3 raw-string/dynamic-key manual (LineweightDisplay codec fix, display-unit, xline-mode, LayerFiltersStore). 69 jest GREEN (12 primitive + 7 smoke + 6+5+17+17+… regression). UNCOMMITTED.
