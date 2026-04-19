# Pre-Commit Check Reference

**Status:** Active
**Owner:** Γιώργος Παγώνης
**Last updated:** 2026-04-19
**Referenced from:** `CLAUDE.md` SOS N.11

Full details for pre-commit checks CHECK 3.13 – CHECK 3.18. These checks are enforced by the pre-commit hook and block commits that violate the baselines or introduce new violations.

| CHECK | Goal | Mode | Baseline |
|-------|------|------|----------|
| **3.18** | SSoT Discover Ratchet — new duplicate exports / anti-patterns / registry gaps | RATCHET | `.ssot-discover-baseline.json` (46 / 5 / 91) |

Για τα βασικά CHECK 3.8–3.12 (hardcoded strings, missing keys, ICU interpolation, companyId, label resolution) δες το CLAUDE.md SOS N.11 summary και τα corresponding scripts στο `scripts/`.

---

## CHECK 3.13 — i18n Runtime Resolver Reachability (ADR-279 / ADR-280)

### Rule
Κάθε dotted i18n key που αναφέρεται σε **static config** (`service-config.ts`, `individual-config.ts`, modal-select label tables, `dropdown-*-labels.ts`) ΠΡΕΠΕΙ να είναι προσβάσιμη μέσω του `SERVICE_FORM_NAMESPACES` list στο `src/components/generic/i18n/translate-field-value.ts` — όχι απλώς να υπάρχει «κάπου» στα locale files.

### Why
Μετά το ADR-280 namespace splitting, keys μπορεί να μεταφερθούν σε νέο namespace που δεν είναι στη λίστα του runtime resolver. Το `namespace-compat.ts → LEGACY_NESTED_MAP` σώζει τα κλασικά `t()` calls αλλά **όχι** τον `translateFieldValue` που καλεί απευθείας `i18next.exists()`. Αποτέλεσμα: raw dotted keys στο UI.

**Incident:** 2026-04-11 στη φόρμα Δημόσιας Υπηρεσίας → «Βασικά Στοιχεία».

### Enforcement
- **Script**: `scripts/check-i18n-resolver-reachability.js`
- **Mode**: RATCHET
- **Baseline**: `.i18n-resolver-reachability-baseline.json` (378 violations σε 13 αρχεία, 2026-04-11)
- **AST walker** παρσάρει το `SERVICE_FORM_NAMESPACES` από το resolver module (single source of truth), φορτώνει τα per-namespace JSON sets, και προσομοιώνει τον runtime resolver (direct hit + `contacts.` prefix strip).
- Αν key δεν resolvάρει → ΜΠΛΟΚ.

### How to add a new split namespace
Όταν προσθέτεις νέο split namespace που θα διαβάζεται από service/individual form renderers → πρόσθεσέ το στο `SERVICE_FORM_NAMESPACES` **ΜΑΖΙ** με το locale file.

### Commands
- `npm run resolver-reach:audit` — scan όλου του scope
- `npm run resolver-reach:baseline` — refresh baseline μετά από legit cleanup

### Relationship with other checks
- **CHECK 3.8** ελέγχει `t('key')` calls vs any locale
- **CHECK 3.12** ελέγχει `label: 'key'` vs any locale
- **CHECK 3.13** ελέγχει runtime namespace **reachability** — κλείνει την τρύπα «key exists in locales but unreachable at runtime»

---

## CHECK 3.14 — Audit Value Catalogs SSoT (ADR-195 / ADR-279)

### Rule
Κάθε audit-tracked field με enum values ΠΡΕΠΕΙ να δηλωθεί στο `src/config/audit-value-catalogs.ts` με pointer στο canonical i18n catalog (`{ ns, path }`). Ο audit trail renderer (`ContactHistoryTab`, `audit-timeline-entry`) μεταφράζει τα stored values **αποκλειστικά** μέσω αυτού του map — δεν επιτρέπεται διπλασιασμός στο `common:audit.values.*`.

### Why
**Incident:** 2026-04-11 στο `/contacts` — ο `category` (public service) rendered `"Κατηγορία: Δήμος → region"` (mixed). Root cause: το `options.serviceCategories` είχε 19 entries αλλά το `audit.values.*` μόνο 2, και οι template-literal `t()` calls διαφεύγουν του CHECK 3.8. Single source of truth: τα enum values ζουν **μόνο** στο canonical form option catalog.

### Enforcement
- **Script**: `scripts/check-audit-value-catalogs.js`
- **Mode**: ZERO TOLERANCE (no baseline)
- Παρσάρει το `AUDIT_VALUE_CATALOGS` από το config module
- Για κάθε entry φορτώνει `el/<ns>.json` + `en/<ns>.json`
- Επιβεβαιώνει ότι το dot-path υπάρχει και στις δύο γλώσσες
- Επιβεβαιώνει non-empty `{ string: string }` object
- Επιβεβαιώνει key-level parity el ⇔ en
- **camelCase guard-rail**: απορρίπτει lowercase snake_case/kebab-case keys (Phase 9.1) — ο one-way snake→camel resolver fallback είναι ασφαλής **μόνο αν** τα catalogs είναι camelCase-clean

### How to add a new enum audit field
Πρόσθεσέ το στο `AUDIT_VALUE_CATALOGS` και κάνε commit. Το CHECK 3.14 validates αυτόματα. Δεν χρειάζεται καμία άλλη αλλαγή.

### Commands
- `npm run audit-values:audit` — τρέχει τον validator manually

### Relationship with other checks
CHECK 3.8 / 3.12 δεν πιάνουν dynamic template-literal `t()` calls σε audit value rendering. CHECK 3.14 κλείνει αυτό το κενό ως single-source validator για audit-trail enum translation.

---

## CHECK 3.15 — Firestore Index Coverage (ADR-195 Phase 10 hotfix)

### Rule
Κάθε query που περνάει από το `firestoreQueryService` SSoT ΠΡΕΠΕΙ να έχει matching composite index στο `firestore.indexes.json` — **και** για τη default variant (με auto-injected `companyId`) **και** για τη super-admin variant (χωρίς tenant prefix, όπως κάνει `buildTenantConstraints()` όταν `ctx.isSuperAdmin === true`).

### Why
**Incident:** 2026-04-11 στο `/projects/[id]/history` + `/admin/audit-log` + contact history. Το `subscribeEntity('ENTITY_AUDIT_TRAIL', { constraints: [where entityType, where entityId, orderBy timestamp desc] })` είχε index `[companyId, entityType, entityId, timestamp desc]` — company admins δούλευαν, **super admins έπαιρναν `FAILED_PRECONDITION`** γιατί το `[entityType, entityId, timestamp desc]` (χωρίς companyId) δεν υπήρχε.

### Enforcement
- **Script**: `scripts/check-firestore-index-coverage.js`
- **Mode**: ZERO TOLERANCE on touch (no baseline)
- TypeScript AST walker βρίσκει `firestoreQueryService.subscribe(KEY, ..., { constraints })` + `.getAll(KEY, { constraints })` calls σε staged `src/**/*.{ts,tsx}`
- **Scope-aware resolution**: shorthand `{ constraints }` identifier λύνεται μέσω της enclosing function's local `const constraints = [...]` — critical για modules με πολλαπλές subscribe functions
- Παράγει 2 shapes ανά call (default + super_admin), ελέγχει coverage μέσω του shared `scripts/_shared/firestore-index-matcher.js`
- Missing shape → block + ready-to-paste `firestore.indexes.json` snippet στο output

### Scope
Μόνο staged files. Pre-existing backlog (39 shapes σε 30 αρχεία, 2026-04-11) καθαρίζει σταδιακά με Boy Scout rule — το CHECK ξυπνά όταν αγγίξεις το αρχείο.

### Commands
- `npm run firestore:indexes:audit` — full scan (για CI / manual audit)

### Why no baseline
Ένα broken index είναι production incident, όχι tech-debt κατηγορία. Zero tolerance *on touch* είναι το Google presubmit equivalent για security/correctness gates.

---

## CHECK 3.16 — Firestore Rules Test Coverage (ADR-298)

### Rule
Κάθε αλλαγή στο `firestore.rules` ΠΡΕΠΕΙ να συνοδεύεται από matching test coverage στο `tests/firestore-rules/suites/`. Κάθε top-level `match /xxx/{id}` ΠΡΕΠΕΙ να υπάρχει είτε στο `FIRESTORE_RULES_COVERAGE` είτε στο `FIRESTORE_RULES_PENDING` (sunset list).

### Why
**Incident:** 2026-04-11 στο `entity_audit_trail` — rule AND-chain είχε super_admin short-circuit σε λάθος θέση, super-admin reads έπαιρναν `permission-denied`. Το CHECK 3.15 έπιασε το missing index (Bug #2), αλλά κανένα gate δεν έπιασε το broken rule shape (Bug #1). Αυτό το CHECK κλείνει την τρύπα.

### Enforcement
- **Script**: `scripts/check-firestore-rules-test-coverage.js`
- **Mode**: ZERO TOLERANCE on touch, no baseline
- Τρέχει όταν staged το `firestore.rules` ή κάποιο αρχείο στο `tests/firestore-rules/`

### SSoT
`tests/firestore-rules/_registry/coverage-manifest.ts` — typed TS registry, persona × operation matrix ανά collection. Το `COVERAGE` export κάθε test file ΠΡΕΠΕΙ να ταιριάζει 1:1 με το manifest και να κάνει iterate το `COVERAGE.matrix` (drift prevention).

### Harness
`tests/firestore-rules/_harness/` — emulator lifecycle, persona→context factory, seed helpers, matrix-driven assertions, rule-shape validator.

### Rule shape check (Phase A scope)
Μόνο για `immutable` pattern collections — το πρώτο OR leg του `allow read` gate πρέπει να είναι `isSuperAdminOnly()`. Phase B επεκτείνει σε `tenant_direct`.

### Commands (preferred first)
- `pnpm test:firestore-rules:emulator` — **preferred**, one-shot boot/run/shutdown μέσω `firebase emulators:exec`
- `pnpm test:firestore-rules` — Jest suite (requires emulator ήδη running)
- `pnpm test:firestore-rules:watch` — dev loop (requires emulator running)
- `pnpm firestore-rules:coverage:audit` — static manifest validation (full scan)
- `pnpm firestore-rules:emulator` — standalone Firebase emulator

### Jest config
Dedicated `jest.config.firestore-rules.js` (node env, isolated from main suite). Root `jest.config.js` εξαιρεί `tests/firestore-rules` μέσω `testPathIgnorePatterns`, οπότε τα δύο jest runs δεν διασταυρώνονται.

### CI gate (Phase D — 2026-04-11)
`.github/workflows/firestore-rules.yml` — 2 jobs (static full scan + runtime emulator via `emulators:exec`). Path-triggered, pnpm + emulator binary cache, Temurin 17. Required status check for merge σε `main`.

### Pending list
86 collections (2026-04-11). Boy Scout rule: όταν αγγίζεις pending collection, μετακινείται στο manifest με full matrix.

### Why no baseline
Τα tests είναι binary (υπάρχει/δεν υπάρχει). Pending list εξυπηρετεί τη σταδιακή μετάβαση, όχι drift ratchet.

### Relationship with other checks
- **CHECK 3.10** ελέγχει client queries (companyId)
- **CHECK 3.15** ελέγχει index coverage
- **CHECK 3.16** είναι ο τρίτος πυλώνας — server rule behavior validation

---

## CHECK 3.17 — Entity Audit Coverage (ADR-195)

### Rule
Κάθε αρχείο που κάνει Firestore write σε audit-tracked collection (`projects`, `contacts`, `buildings`, `properties`, `floors`, `parking`, `storage`, `purchase_orders`, `companies`) ΠΡΕΠΕΙ επίσης να καλεί `EntityAuditService.recordChange()` από το canonical SSoT module (`src/services/entity-audit.service.ts`).

### Why
**Incident:** 2026-04-11 στο `/projects` — το `/api/projects/list` POST handler έγραφε νέο project document αλλά δεν έκανε record στο audit trail, οπότε το per-project «Ιστορικό» tab ήταν άδειο ενώ το reader side ήταν πλήρως ενσωματωμένο (ADR-195 Phase 3). Το υπάρχον SSoT registry entry `entity-audit-trail` κλειδώνει τα direct writes στην `entity_audit_trail` collection (reader protection), αλλά δεν εγγυάται ότι κάθε mutation σε tracked entity γεννά audit entry. Αυτό το check κλείνει το συμμετρικό κενό στην writer πλευρά.

### Enforcement
- **Script**: `scripts/check-entity-audit-coverage.js`
- **Mode**: RATCHET
- Για κάθε staged `src/**/*.{ts,tsx}` αρχείο ανιχνεύει references σε `COLLECTIONS.<TRACKED_KEY>` με write shape (`setDoc`/`updateDoc`/`deleteDoc`/`addDoc`/`.set(`/`.update(`/`.delete(`/`.add(`)
- Αν το αρχείο περιέχει write αλλά ΔΕΝ περιέχει `EntityAuditService.recordChange(` → violation
- **File-level granularity (v1)**: ένα αρχείο με ένα covered και ένα uncovered write path περνάει προσωρινά — αποδεκτό γιατί τα migrated handlers είναι 1-write-per-file

### Baseline
`.entity-audit-coverage-baseline.json` (70 legacy αρχεία grandfathered, 2026-04-11)

### How to add a new handler
Όταν προσθέτεις νέο handler που γράφει σε audit-tracked collection → ΥΠΟΧΡΕΩΤΙΚΑ fetch `performedBy` + `performedByName` + `companyId` και κάλεσε `recordChange({ entityType, entityId, action, changes, performedBy, performedByName, companyId })` στην ίδια transactional ενότητα.

### Commands
- `npm run audit-coverage:audit` — full scan με verbose report
- `npm run audit-coverage:baseline` — refresh baseline μετά από legit cleanup

### Relationship with entity-audit-trail SSoT
Το registry entry `entity-audit-trail` απαγορεύει **direct writes** στο `entity_audit_trail` collection από οπουδήποτε εκτός του canonical service (reader-side protection). Το CHECK 3.17 απαιτεί **writes σε tracked entities** να καλούν το canonical service (writer-side coverage). Μαζί εγγυώνται ότι η audit trail είναι complete και untampered.

---

---

## CHECK 3.18 — SSoT Discover Ratchet (ADR-314)

### Rule
Το συνολικό μέτρημα structural SSoT violations που αναφέρει το `npm run ssot:discover` (Phase 2 `duplicateExports` + Phase 3 `antiPatterns` + Phase 4 `unprotected` centralized files) **δεν επιτρέπεται να ανέβει** πάνω από το baseline. Ratchet down only.

### Why
Το CHECK 3.7 (`.ssot-registry.json`) μπλοκάρει regressions σε *καταγεγραμμένα* modules (62+ tiers). Δεν βλέπει νέα duplicate symbols ή νέες anti-patterns που δεν υπάρχουν στο registry. Το `scripts/ssot-discover.sh` τα βρίσκει αλλά έτρεχε μόνο manual → duplicate που γεννήθηκε σήμερα περνούσε CI μέχρι να το θυμηθεί κάποιος → retroactive cleanup (Phases C.5.1 → C.5.21 στο ADR-314, ~43h εκτίμηση). Το CHECK 3.18 κλείνει το κενό σε presubmit.

### Enforcement (Defense in Depth, ADR-294 pattern)

| Layer | Where | Mode | Speed |
|-------|-------|------|-------|
| **Layer 1 — pre-commit** | `scripts/git-hooks/pre-commit` CHECK 3.18 | **smoke** (baseline file presence + JSON validity) | ~0.2s |
| **Layer 2 — CI** | `.github/workflows/ssot-discover.yml` | **full** (4-phase scan) | ~1-2 min on Linux |
| **Layer 3 — local on demand** | `SSOT_DISCOVER_FULL=1 git commit …` or `npm run ssot:discover:check` | **full** | ~4 min on Windows Git Bash, ~30-60s Linux |

**Why not full scan in pre-commit**: το bash scanner κάνει `grep -rnE` σε όλα τα 5.195 `.ts/.tsx` files. Σε Linux τρέχει ~30-60s, σε Windows Git Bash ~4 λεπτά (process-spawn overhead). Αν μπει full στο pre-commit, ο hook πάει από ~3.5min → ~7min — prohibitive για κάθε local commit. Το CI layer είναι authoritative gate (Branch Protection blocks merge).

### Scope (pre-commit)
- Script: `scripts/check-ssot-discover-ratchet.js`
- Triggers: staged `src/**/*.{ts,tsx}` — non-src changes δεν μετακινούν τα counts
- Behaviour: validates `.ssot-discover-baseline.json` exists + parses + has `duplicateExports`/`antiPatterns`/`unprotected` numeric fields. Does **not** re-scan — trusts CI for the full check.

### Scope (CI)
- Workflow: `.github/workflows/ssot-discover.yml`
- Triggers: `src/**/*.{ts,tsx}`, `scripts/ssot-discover.sh`, `scripts/check-ssot-discover-ratchet.js`, `.ssot-discover-baseline.json`, `.ssot-registry.json`
- Ubuntu runner, Node 20, no dependency install (pure bash + Node stdlib)
- Exits 1 if any tracked metric > baseline

### Baseline
`.ssot-discover-baseline.json` (46 duplicates / 5 anti-patterns / 91 unprotected, frozen 2026-04-19, ADR-314)

### Commands
- `npm run ssot:discover` — full human-readable 4-phase report (for diagnostics)
- `npm run ssot:discover:check` — full scan + baseline compare (exits 1 on raise)
- `npm run ssot:discover:baseline` — regenerate baseline after legitimate cleanup

### Remediation flow
1. **Centralize** the new pattern into an existing SSoT module (preferred)
2. **Register** a new SSoT module in `.ssot-registry.json` (add Tier X, `npm run ssot:baseline`)
3. **Refresh baseline** only for intentional cleanup debt: `npm run ssot:discover:baseline`

### Relationship with other checks
- **CHECK 3.7** (SSoT Ratchet) → blocks regressions of *registered* patterns. File-level granularity, per-module.
- **CHECK 3.18** (this one) → blocks *new duplicate patterns* + anti-patterns not yet registered. Total counts granularity, cross-module.
- Together: CHECK 3.7 keeps known SSoT modules clean; CHECK 3.18 prevents new fragmentation from escaping undetected.

### Test suites (Google presubmit-grade, ADR-294 changelog 2026-04-19)

**Suite 1 — CHECK 3.18 ratchet wrapper** (`scripts/__tests__/check-ssot-discover-ratchet.test.js`):
- **Fixtures**: `scripts/__tests__/fixtures/` — committed scanner output snapshot (`ssot-discover-output.txt`), minimal + ANSI variants, baseline JSON variants (valid / corrupt / missing-field / non-numeric / null-field), fake scanner shell scripts (`fake-scanner-ok.sh`, `fake-scanner-fail.sh`).
- **57 tests in 9 groups**: `stripAnsi`, `parseSummary`, `loadBaseline`, `writeBaseline`, `compare`, `parseArgs`, env-driven resolvers, CLI integration (`spawnSync`), in-process coverage of `runScanner`/`runFull`/`runSmoke`/`printHelp`/`main` via `process.exit` stub, and a regression snapshot test that fails loudly if the bash scanner Summary format drifts.
- **Coverage** on `scripts/check-ssot-discover-ratchet.js`: **96.82% statements / 92.30% branches / 100% functions / 96.69% lines** — exceeds the 95%/90% Google presubmit target. Runtime ~3.5s, no real scanner spawn (~4 min on Windows).
- **Enabled by**: dependency-injected `filePath` arg on I/O fns, `SSOT_DISCOVER_BASELINE_FILE` + `SSOT_DISCOVER_SCANNER` env overrides, and a `require.main === module` guard so Jest can import internals.
- **Run**: `npm run test:ssot-discover`.

**Suite 2 — Registry Golden Regex** (`scripts/__tests__/registry-golden-regex.test.js`):
- **Purpose**: catches the exact class of bug that caused the ADR-294 v2.0→v3.0 regression — `(?:...)` non-capturing groups + PCRE lookaheads that GNU `grep -E` silently accepts as literal text, matching nothing. Tests the REAL enforcement tool (`grep -E -f`), not a JS-regex approximation.
- **40 tests in 3 groups**:
  - **ERE syntax validity** (1 test): spawns `grep -E -f patternFile` against all ~225 `forbiddenPatterns` entries, fails on any status-2 regex error. Windows-safe (temp-file pattern passing — avoids argv backslash mangling).
  - **Golden semantic matching** (36 tests): 12-module cross-tier sample — firestore-collections, enterprise-id, domain-constants, addDoc-prohibition, intent-badge-utils, tenant-company-id, soft-delete-config, notification-events, storage-path-construction, entity-creation-manual, intl-formatting, date-local. Each pattern must fire on the module's `shouldMatch` fixture + NOT fire on its `shouldSkip` fixture (false-positive traps: imports / SSoT usage / type-level literals).
  - **Fixture coverage** (3 tests): sample spans ≥2 tiers, every sample exists in registry, no empty fixtures.
- **SSoT discipline**: patterns loaded only from `.ssot-registry.json`. Tests never hardcode a regex. Fixtures in `scripts/__tests__/fixtures/registry-golden-fixtures.js`.
- **Known finding documented inline**: `gcs-buckets[0]` pattern uses PCRE lookaheads — ratchet module currently dormant. Not gated (pre-existing debt).
- **Runtime**: ~49s Windows / ~5s Linux (dominated by 225 spawn calls).
- **Run**: `npm run test:registry-golden` or `npm run test:ssot-suite` (both suites — 97 tests).

---

## Boy Scout Rule (applies to all RATCHET checks)

Όταν αγγίζεις legacy file → καθάρισε όσα violations μπορείς. Δεν είναι υποχρεωτικό, αλλά σταδιακά φτάνουμε στο 0.

**ΜΗΔΕΝΙΚΗ ΑΝΟΧΗ για νέα violations. Legacy: gradual cleanup.**
