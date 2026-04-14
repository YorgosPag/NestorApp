# ADR-301 — Storage Rules Test Coverage SSoT

**Status:** Accepted  
**Date:** 2026-04-14  
**Authors:** YorgosPag  
**Related:** ADR-031 (File Storage System), ADR-298 (Firestore Rules Coverage)

---

## 1. Context

`storage.rules` is the security boundary for all Firebase Storage uploads,
reads, and deletes in the Nestor platform. As of 2026-04-14 it contains
**4 top-level match path patterns**:

| Path Pattern | Lines | Operations |
|---|---|---|
| `/companies/{cId}/projects/{pId}/entities/…/files/{f}` | 172-201 | read, write, delete |
| `/companies/{cId}/entities/…/files/{f}` | 212-229 | read, write, delete |
| `/cad/{userId}/{fileId}/{fileName}` | 238-249 | read, write, delete |
| `/temp/{userId}/{fileName}` | 258-265 | read+write, delete |

Prior to this ADR, Storage rules had **zero automated test coverage**. Any
change to `storage.rules` could silently break tenant isolation, owner access,
or super_admin bypass paths. The existing ADR-298 Firestore rules coverage
pattern provided a proven blueprint to replicate for Storage.

---

## 2. Decision

Create a dedicated Storage rules test harness at `tests/storage-rules/`
modelled on the Firestore harness (ADR-298) but adapted for the Storage
emulator API (`@firebase/rules-unit-testing` v5 — `ctx.storage()`).

### 2.1 Architecture

```
tests/storage-rules/
  _harness/
    emulator.ts          ← initStorageEmulator() / teardownStorageEmulator() / resetStorageData()
    auth-contexts.ts     ← getStorageContext(env, persona) → RulesTestContext
    seed-helpers.ts      ← seedStorageFile(env, path) — bypasses rules for arrange phase
    assertions.ts        ← assertStorageCell(ctx, cell, target) — dispatches read/write/delete
  _registry/
    personas.ts          ← StoragePersona type + PERSONA_CLAIMS (SRP copy from firestore registry)
    operations.ts        ← StorageOperation = 'read' | 'write' | 'delete'
    coverage-manifest.ts ← STORAGE_RULES_COVERAGE (SSoT) + STORAGE_RULES_PENDING
  suites/
    canonical-path-with-project.storage.test.ts
    canonical-path-no-project.storage.test.ts
    cad-files.storage.test.ts
    temp-uploads.storage.test.ts
```

### 2.2 Emulator configuration

Storage emulator: `localhost:9199` (matches `firebase.json`).  
Init: `initializeTestEnvironment({ storage: { rules, host, port } })`.  
Reset: `env.clearStorage()` in `afterEach`.

### 2.3 Coverage matrix

Each path registers a `matrix: readonly StorageCoverageCell[]` of
`(persona × operation)` cells. Four storage personas are used:

| Persona | UID | companyId | globalRole |
|---|---|---|---|
| `super_admin` | `persona-super-admin` | `company-root` | `super_admin` |
| `same_tenant_user` | `persona-same-user` | `company-a` | `internal_user` |
| `same_tenant_admin` | `persona-same-admin` | `company-a` | `company_admin` |
| `cross_tenant_user` | `persona-cross-user` | `company-b` | `internal_user` |
| `anonymous` | — | — | — |

For owner-based paths (`cad/`, `temp/`), `same_tenant_user` acts as the
**file owner** — the path embeds `OWNER_USER_UID = 'persona-same-user'`.

### 2.4 Seed-before-read/delete pattern

Firebase Storage emulator returns `storage/object-not-found` (not
`storage/unauthorized`) when a file does not exist. Without pre-seeding,
deny assertions on `read` and `delete` would pass for the wrong reason. Every
test seeds the target file via `withSecurityRulesDisabled` before running
read/delete cells.

### 2.5 Write path strategy

Write cells use a unique path suffix (`path--write-<timestamp>`) to ensure
the emulator sees a **CREATE** operation. This avoids routing through a
potential UPDATE path and ensures the `allow write` gate is exercised cleanly.

---

## 3. CHECK 3.19 — Zero-tolerance coverage gate

`scripts/check-storage-rules-test-coverage.js` enforces:

| Validation | What is checked |
|---|---|
| **A** | Every `match` block in `storage.rules` is in COVERAGE (by `rulesRange`) or `STORAGE_RULES_PENDING` |
| **B** | Every COVERAGE entry has an existing test file at `testFile` path |
| **C** | Each test file exports `COVERAGE` and references its `pathId` |
| **D** | Each test file iterates via `for (const cell of COVERAGE.matrix)` |

**Trigger:** commits that stage `storage.rules` or any file under
`tests/storage-rules/`.

**Pre-commit hook:** CHECK 3.19 block inserted between CHECK 3.17 and CHECK 4.

**NPM scripts:**
```bash
pnpm test:storage-rules             # run suites (requires emulator)
pnpm test:storage-rules:emulator    # auto-start emulator + run suites
pnpm storage-rules:coverage:audit   # full scan of CHECK 3.19
pnpm storage-rules:emulator         # start emulator for manual testing
```

---

## 4. Known caveat — `temp/` read + `isValidFileSize()`

The rule at `storage.rules:261`:
```
allow read, write: if isOwner(userId) && isValidFileSize();
```

`isValidFileSize()` accesses `request.resource.size`. For **read** operations,
`request.resource` is `null` in Firebase Storage Rules. Accessing `.size` on
null may cause the rule to error → deny, even for the file owner.

**Current state:** The test matrix marks `same_tenant_user × read → allow`
reflecting the intent. If the emulator denies this cell, the test fails and
exposes the latent rule bug. The fix is to split the rule:
```
allow read: if isOwner(userId);
allow write: if isOwner(userId) && isValidFileSize();
allow delete: if isOwner(userId);
```
This is tracked as a future improvement, not a blocker for Phase A.

---

## 5. Scope boundaries

This ADR covers **storage.rules only**. Firestore rules remain under ADR-298.

The two systems are intentionally separate:
- Different emulator ports (Firestore: 8080, Storage: 9199)
- Different SDKs (`ctx.firestore()` vs `ctx.storage()`)
- Different test manifests and check scripts
- Shared persona model (SRP duplicate — not cross-imported)

---

## 6. Phase history

| Phase | Date | What |
|---|---|---|
| **A** | 2026-04-14 | Harness + manifest + 4 suites + CHECK 3.19 + ADR-301 |

---

## 7. Changelog

| Date | Change |
|---|---|
| 2026-04-14 | Initial ADR accepted. Phase A complete: 4 paths, 48 cells, CHECK 3.19. |
