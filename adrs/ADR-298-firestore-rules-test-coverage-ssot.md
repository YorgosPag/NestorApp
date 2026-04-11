# ADR-298: Firestore Security Rules — Unit Tests με Emulator, SSoT Coverage Registry & Pre-commit Gate (CHECK 3.16)

**Status:** ✅ IMPLEMENTED — Phase A + foundation hotfix + Phase D complete (2026-04-11)
**Date:** 2026-04-11
**Category:** Security / Testing Infrastructure / SSoT Enforcement
**Author:** Γιώργος Παγώνης + Claude Code
**Related ADRs:** ADR-063, ADR-073, ADR-195, ADR-214, ADR-232, ADR-252, ADR-253, ADR-255, ADR-294

---

## 1. Context

### 1.1 Γιατί τώρα

Στις **2026-04-11** σκάσανε **δύο ανεξάρτητα production bugs** στην ίδια ημέρα στο audit trail subsystem:

| # | Bug | Root cause | Layer που θα το έπιανε |
|---|-----|------------|------------------------|
| 1 | Super-admin reads στο `entity_audit_trail` έπαιρναν `permission-denied` | Rule AND-chain δεν είχε super_admin short-circuit πρώτο | **Layer 1 — Rules Unit Tests** (αυτό το ADR) |
| 2 | Super-admin reads έπαιρναν `FAILED_PRECONDITION` (missing index) | `firestoreQueryService` παράγει δύο variants (default + super_admin), μόνο η default είχε composite index | **Layer 2 — Index Coverage** (ADR-195 Phase 10 hotfix, **CHECK 3.15**) |

Το Bug #2 καλύφθηκε στις 2026-04-11 με το **CHECK 3.15** (zero-tolerance on touch, TypeScript AST walker, `scripts/check-firestore-index-coverage.js` 660 γρ., `scripts/_shared/firestore-index-matcher.js` 232 γρ.).

Το Bug #1 **δεν έχει ακόμα presubmit gate**. Ο κώδικας του `firestore.rules` κρατάει 3.534 γραμμές, 109 `match` blocks, 37 helper functions, και είναι το **μοναδικό production perimeter** για tenant isolation — αν μια rule γίνει silently broken, το damage είναι **cross-tenant data leak** (P0 security incident). Χρειαζόμαστε **αυτοματοποιημένο έλεγχο πριν κάθε commit** που αγγίζει το rules file.

### 1.2 Τι υπάρχει ήδη (Phase 0 baseline — PR-1A, 2026-01-29)

**Αναπάντεχη ανακάλυψη κατά την έρευνα:** υπάρχει ήδη λειτουργική test suite από το *Security Gate Phase 1 (PR-1A)*. Δεν ξεκινάμε από μηδενική βάση.

| Component | Path | Μέγεθος | Κατάσταση |
|-----------|------|---------|-----------|
| Firebase emulator config | `firebase.json` | — | ✅ Port 8080 (firestore), 9099 (auth), 9199 (storage) |
| Test framework | `@firebase/rules-unit-testing` + **Jest 30.2.0** | — | ✅ Installed |
| Test setup + helpers | `tests/firestore-rules/setup.ts` | 365 γρ. | ✅ Auth contexts, assertion helpers, data factories |
| Proto-SSoT constants | `tests/firestore-rules/constants.ts` | 188 γρ. | ⚠️ Partial — 27 tenant + 14 system + 4 ownership collections |
| Existing test suites | `pr-1a-{projects,buildings,contacts,files}.test.ts` | 1348 γρ. | ✅ 4 collections covered |
| Package scripts | `pnpm test:firestore-rules[:pr-1a|:projects|...]` | — | ✅ Jest `--runInBand` |
| Package manager | **pnpm 9.14.0** | — | ✅ |

**Coverage gap:** 4 από ~97 top-level collections έχουν tests (4.1%). 93 collections **χωρίς** tests — συμπεριλαμβανομένου του `entity_audit_trail` στο οποίο έσκασε το σημερινό Bug #1.

### 1.3 Τι λείπει από το PR-1A baseline

1. **Δεν υπάρχει single-source-of-truth coverage manifest** — τα `constants.ts` απαριθμούν collections αλλά δεν δηλώνουν ποιες *operations × personas* πρέπει να ελεγχθούν για κάθε collection.
2. **Δεν υπάρχει presubmit gate** — ένας developer μπορεί να αλλάξει το `firestore.rules` χωρίς να αγγίξει κανένα test file.
3. **Δεν υπάρχει orphan detection** — νέο `match /xxx/{id}` block στο rules file μπορεί να προστεθεί χωρίς καμιά εγγραφή στο registry.
4. **Δεν υπάρχουν test patterns** για τα πιο critical: cross-document reads (`getProjectCompanyId`), immutable audit trails (`allow update: if false`), property field allowlists, role-based accounting (`canCreateAccounting` dual pattern), enum validation.
5. **Δεν υπάρχει CI integration** — τα tests τρέχουν μόνο local, δεν επιβάλλονται σε PR.

### 1.4 Landscape του `firestore.rules` (3.534 γρ., 109 match blocks, 97 top-level collections)

Από την έρευνα προκύπτουν **6 κατηγορίες rules patterns** που πρέπει να καλυφθούν:

| # | Pattern | Παραδείγματα | Πόσα collections | Test complexity |
|---|---------|-------------|-----------------|-----------------|
| 1 | **Tenant-isolated με direct `companyId`** | projects, contacts, opportunities | ~50 | Μέτρια (5 personas × 5 ops) |
| 2 | **Cross-document `companyId` lookup** | attendance_events (via projectId), properties (via building→project) | ~8 | Υψηλή (seed upstream + downstream) |
| 3 | **Immutable / append-only** | attendance_events, accounting_audit_log, entity_audit_trail | ~5 | Μέτρια (update/delete must deny) |
| 4 | **Ownership-based** | users, sessions, user_2fa_settings | ~5 | Χαμηλή |
| 5 | **System-global read-only** | navigation_companies, counters, security_roles, config | ~15 | Χαμηλή |
| 6 | **Role-based με dual pattern** | accounting_* (user-created vs system-generated via `canCreateAccounting` / `canCreateAccountingSystem`) | ~18 | Υψηλή |
| 7 | **Field-level allowlists** | properties (isAllowedPropertyFieldUpdate + propertyStructuralFieldsUnchanged) | ~3 | Υψηλή (per-field matrix) |

### 1.5 Κρίσιμα pitfalls που ανακαλύφθηκαν

**(α) Cross-document reads στο emulator** — Το `getProjectCompanyId(projectId)` κάνει `get(/databases/$(db)/documents/projects/$(projectId))` στα rules. Αυτό επιβάλλει ότι **κάθε test για attendance/properties πρέπει να seedάρει πρώτα το parent project** αλλιώς η rule πετάει `permission-denied` για λάθος λόγο.

**(β) Legacy fallback paths** — Πολλά collections έχουν three-leg OR: `isSuperAdminOnly() || belongsToCompany(companyId) || (no companyId && createdBy == uid)`. Αυτό επιτρέπει legacy documents χωρίς `companyId`. Το matrix πρέπει να καλύψει και τις τρεις legs.

**(γ) P0-B tenant-bound company admin** — Το `isCompanyAdminOfCompany(companyId)` εμποδίζει έναν company_admin να γράψει σε άλλη tenant. Αυτό το fix δεν έχει test coverage σήμερα.

**(δ) Production `isDevMode` disabled** — `firestore.rules:3330-3335` — `isDevMode()` returns `false` (disabled 2026-01-11). Τα tests πρέπει να τρέχουν στο production mode.

**(ε) Super-admin short-circuit ordering** — Το Bug #1 της 2026-04-11 προκλήθηκε επειδή το `isSuperAdminOnly()` δεν ήταν **πρώτο** στην OR-chain. Το CHECK 3.16 πρέπει να επιβάλλει ότι **κάθε tenant-isolated rule ξεκινάει με super_admin short-circuit**.

---

## 2. Decision

Υλοποιούμε **Layer 1 — Firestore Rules Unit Tests με Emulator** ως φυσική επέκταση του PR-1A, με τρία νέα στοιχεία:

1. **SSoT Coverage Manifest** — typed TypeScript registry που δηλώνει για κάθε collection: το rules pattern, τα required personas, τα required operations, το expected outcome ανά κελί του matrix, και references στα test files.
2. **CHECK 3.16 — Firestore Rules Test Coverage** — pre-commit gate τύπου *zero-tolerance on touch* (ίδιο architectural pattern με CHECK 3.15) που validate-άρει:
    - (a) Κάθε top-level `match /xxx/{id}` στο `firestore.rules` έχει manifest entry ή είναι explicit pending
    - (b) Κάθε manifest entry έχει corresponding test file με `COVERAGE` export που ταιριάζει ακριβώς με το manifest
    - (c) Το test file περιέχει `describe()` blocks για κάθε (persona × operation) κελί που δηλώνει το manifest
    - (d) **Rule shape validation** — αν staged το `firestore.rules`, ελέγχει ότι κάθε tenant-isolated match block ξεκινάει με `isSuperAdminOnly()` ως πρώτη OR leg (catches το Bug #1 shape)
3. **Πραγματική εκτέλεση tests** — όταν αγγίζεται το `firestore.rules`, το pre-commit τρέχει **μόνο** τα test suites που αφορούν τα affected collections (staged-scoped Jest run), όχι ολόκληρη τη suite (time budget ≤ 60s).

### 2.1 Γιατί αυτή η αρχιτεκτονική

| Alternative | Γιατί το απορρίπτουμε |
|-------------|----------------------|
| Full Jest run σε κάθε commit | 97 suites × emulator spin-up ≥ 3-5min, μπλοκάρει developer flow |
| Ratchet pattern (ADR-294 style) με baseline counts | Τα tests είναι binary (υπάρχει ή όχι) — ratchet δεν έχει νόημα. Zero-tolerance πιο σωστό. |
| JSON registry αντί για typed TS | Χάνουμε type safety, δεν μπορούμε να κάνουμε compile-time check ότι τα test files συμφωνούν με το manifest |
| Convention-only (file naming + describe titles) | Εύκολο να ξεχαστεί κάτι. Explicit manifest = explicit contract. |
| Manual coverage tracking | Drift guaranteed (PR-1A ήδη έχει drift — `constants.ts` vs actual `firestore.rules`) |

### 2.2 Relationship με τα υπόλοιπα CHECKs

| CHECK | Εστίαση | Σχέση με 3.16 |
|-------|---------|---------------|
| **3.10** | Firestore queries χωρίς `where('companyId', ...)` | Συμπληρωματικό — 3.10 κοιτάει το *client code*, 3.16 κοιτάει το *server rules + tests* |
| **3.14** | Audit value catalogs parity (zero-tolerance) | Same architectural pattern — zero baseline, static validator |
| **3.15** | Firestore composite index coverage (zero-tolerance) | Same architectural pattern — staged-only + `--all` για CI. 3.16 είναι ο "δίδυμος αδερφός" του 3.15 για την rules layer. |
| **3.7** (SSoT ratchet) | Centralized module imports (ratchet) | Ξεχωριστό — rules test coverage δεν είναι import pattern, δεν μπαίνει στο `.ssot-registry.json` |

---

## 3. Architecture

### 3.1 Directory layout (Phase A, at completion)

```
tests/firestore-rules/
├── _registry/
│   ├── coverage-manifest.ts          ← SSoT: collection × persona × operation matrix
│   ├── personas.ts                    ← Canonical auth contexts (super_admin, tenant_admin, ...)
│   ├── operations.ts                  ← Canonical op names (read, list, create, update, delete)
│   └── expected-outcomes.ts           ← Types: 'allow' | 'deny' + reason enum
├── _harness/
│   ├── emulator.ts                    ← Spin up/teardown, rules reload
│   ├── auth-contexts.ts               ← Factory: persona → authenticated context
│   ├── seed-helpers.ts                ← Cross-document seeders (projects → buildings → ...)
│   ├── assertions.ts                  ← assertAllowed/assertDenied + reason matchers
│   └── rule-shape-validator.ts        ← Static parse του firestore.rules για Bug #1 shape
├── suites/
│   ├── projects.rules.test.ts         ← (migrated from pr-1a-projects.test.ts)
│   ├── buildings.rules.test.ts        ← (migrated)
│   ├── contacts.rules.test.ts         ← (migrated)
│   ├── files.rules.test.ts            ← (migrated)
│   ├── entity-audit-trail.rules.test.ts    ← NEW — covers Bug #1
│   ├── messages.rules.test.ts         ← NEW — critical path
│   ├── attendance-events.rules.test.ts ← NEW — immutable pattern + cross-doc read
│   └── ... (expansion in Phase B/C)
├── README.md                          ← Updated
└── [DEPRECATED] pr-1a-*.test.ts       ← Removed after migration
```

### 3.2 Coverage manifest schema (SSoT, `_registry/coverage-manifest.ts`)

```typescript
export type RulesPattern =
  | 'tenant_direct'        // companyId στο document
  | 'tenant_crossdoc'      // lookup via parent document
  | 'immutable'            // append-only audit trail
  | 'ownership'            // ownerId == uid
  | 'system_global'        // read-only for all authed users
  | 'role_dual'            // user-created vs system-generated split
  | 'field_allowlist';     // property updates με specific allowed fields

export type Persona =
  | 'super_admin'
  | 'same_tenant_admin'
  | 'same_tenant_user'
  | 'cross_tenant_admin'
  | 'cross_tenant_user'
  | 'anonymous'
  | 'external_user';

export type Operation = 'read' | 'list' | 'create' | 'update' | 'delete';

export type Outcome = 'allow' | 'deny';

export interface CoverageCell {
  persona: Persona;
  operation: Operation;
  outcome: Outcome;
  /** Optional: reason tag for deterministic assertion */
  reason?: 'missing_claim' | 'cross_tenant' | 'immutable' | 'field_not_allowlisted' | 'legacy_fallback';
}

export interface CollectionCoverage {
  /** Physical collection name — must match match /xxx/{id} in firestore.rules */
  collection: string;
  /** Architectural classification */
  pattern: RulesPattern;
  /** Expected matrix */
  matrix: readonly CoverageCell[];
  /** Path to the test file (relative to repo root) */
  testFile: string;
  /** For crossdoc patterns: which parent docs must be seeded */
  seedDependencies?: readonly string[];
  /** Rule block line range in firestore.rules (for reporting) */
  rulesRange: readonly [number, number];
}

export const FIRESTORE_RULES_COVERAGE: readonly CollectionCoverage[] = [
  {
    collection: 'projects',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/projects.rules.test.ts',
    rulesRange: [37, 102],
    matrix: [
      { persona: 'super_admin',        operation: 'read',   outcome: 'allow' },
      { persona: 'same_tenant_admin',  operation: 'read',   outcome: 'allow' },
      { persona: 'same_tenant_user',   operation: 'read',   outcome: 'allow' },
      { persona: 'cross_tenant_admin', operation: 'read',   outcome: 'deny', reason: 'cross_tenant' },
      { persona: 'cross_tenant_user',  operation: 'read',   outcome: 'deny', reason: 'cross_tenant' },
      { persona: 'anonymous',          operation: 'read',   outcome: 'deny', reason: 'missing_claim' },
      // ... list, create, update, delete ...
    ],
  },
  // ... entity_audit_trail, messages, attendance_events, ...
] as const;

export const FIRESTORE_RULES_PENDING: readonly string[] = [
  // Collections that exist in firestore.rules but are not yet in the matrix.
  // Phase B/C will move these into FIRESTORE_RULES_COVERAGE.
  // CHECK 3.16 tolerates pending entries but blocks any collection that is in NEITHER list.
  'accounting_invoices',
  'accounting_journal_entries',
  // ... ~90 collections initially
] as const;
```

### 3.3 Test file contract

```typescript
// tests/firestore-rules/suites/projects.rules.test.ts
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';

/** Export MUST match the entry in coverage-manifest.ts — CHECK 3.16 validates this. */
export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(c => c.collection === 'projects')!;

describe('projects.rules — tenant_direct pattern', () => {
  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        // harness-driven assertion
      });
    });
  }
});
```

### 3.4 CHECK 3.16 — design

**Script:** `scripts/check-firestore-rules-test-coverage.js` (target ≤ 500 γρ.)
**Shared util:** `scripts/_shared/firestore-rules-parser.js` (target ≤ 250 γρ. — parses match blocks and AND-chain shapes)

**Algorithm:**
1. **Parse** `firestore.rules` με regex-based match-block detector (δεν χρειάζεται πλήρης CEL parser — τα rules έχουν κανονική δομή). Εξάγει: `{ collection, lineStart, lineEnd, firstOrLeg }`.
2. **Load** το `coverage-manifest.ts` με TypeScript AST (ίδιο pattern με CHECK 3.15 που χρησιμοποιεί το `typescript` package).
3. **Load** `FIRESTORE_RULES_PENDING` array.
4. **Validation A — Orphan collections:** για κάθε `match` block, αν η collection δεν είναι ούτε στο manifest ούτε στο pending → **BLOCK** με paste-ready manifest entry suggestion.
5. **Validation B — Test file existence:** για κάθε manifest entry, verify ότι το `testFile` path υπάρχει.
6. **Validation C — COVERAGE export parity:** parse το test file με TS AST, verify ότι υπάρχει `export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(...)` που αναφέρεται στη σωστή collection.
7. **Validation D — `describe` block completeness:** verify ότι για κάθε matrix cell υπάρχει matching nested `describe('<persona> × <operation>')` block.
8. **Validation E — Rule shape (όταν το `firestore.rules` είναι staged):** για κάθε tenant-isolated match block, verify ότι το πρώτο OR leg του `allow read` είναι `isSuperAdminOnly()` (catches Bug #1).
9. **Validation F — Staged-scoped test run:** αν staged το `firestore.rules` ή κάποιο test file, τρέξε `pnpm jest --testPathPattern='tests/firestore-rules/suites/(collection1|collection2)' --runInBand` με `FIRESTORE_EMULATOR_HOST` env var. Time budget 60s — αν δεν υπάρχει ήδη running emulator, skip το execution step (πρόταση: χωριστή CI stage).

**Exit codes:**
- `0` — όλα τα validations passed
- `1` — validation failure
- `2` — emulator unavailable + rules file staged → warning, continue (μη μπλοκάρεις commits αν δεν τρέχει emulator local)

**Trigger scope (`scripts/git-hooks/pre-commit`):**
```bash
RULES_CHANGED=$(echo "$STAGED_FILES" | grep -E '^firestore\.rules$|^tests/firestore-rules/' || true)
if [[ -n "$RULES_CHANGED" ]]; then
  node scripts/check-firestore-rules-test-coverage.js $RULES_CHANGED
fi
```

**Error message format** (ίδιο stencil με CHECK 3.15):
```
✖ CHECK 3.16 — Firestore Rules Test Coverage: 3 violation(s)

  firestore.rules:2384  orphan collection
    match:      match /entity_audit_trail/{id}
    problem:    not in coverage-manifest.ts and not in FIRESTORE_RULES_PENDING
    → add to tests/firestore-rules/_registry/coverage-manifest.ts:
      {
        collection: 'entity_audit_trail',
        pattern: 'immutable',
        testFile: 'tests/firestore-rules/suites/entity-audit-trail.rules.test.ts',
        rulesRange: [2384, 2400],
        matrix: [ ... ],
      }

  tests/firestore-rules/suites/messages.rules.test.ts  missing describe block
    cell:       cross_tenant_admin × update
    → add: describe('cross_tenant_admin × update', () => { ... })

  firestore.rules:2384  rule shape violation
    match:      match /entity_audit_trail/{id}
    problem:    first OR leg of `allow read` is not isSuperAdminOnly()
    → reorder so super_admin short-circuit is first (see ADR-195 Phase 10)

  ℹ Every rule change must have matching test coverage before commit.
  → Run: pnpm test:firestore-rules:<collection> to verify locally.
  → Run: pnpm firestore-rules:coverage:audit for full scan.
```

### 3.5 Package.json additions

```json
{
  "scripts": {
    "test:firestore-rules": "jest --testPathPattern=tests/firestore-rules/suites --runInBand",
    "test:firestore-rules:watch": "jest --testPathPattern=tests/firestore-rules/suites --watch",
    "firestore-rules:coverage:audit": "node scripts/check-firestore-rules-test-coverage.js --all --verbose",
    "firestore-rules:emulator": "firebase emulators:start --only firestore,auth"
  }
}
```

### 3.6 CLAUDE.md section (προσθήκη μετά το CHECK 3.15)

```markdown
### Firestore Rules Test Coverage (Pre-commit Check 3.16) — ADR-298:
- **Ο ΚΑΝΟΝΑΣ**: Κάθε αλλαγή στο `firestore.rules` ΠΡΕΠΕΙ να συνοδεύεται από matching test coverage
  στο `tests/firestore-rules/suites/`. Κάθε top-level `match /xxx/{id}` ΠΡΕΠΕΙ να υπάρχει είτε
  στο `FIRESTORE_RULES_COVERAGE` είτε στο `FIRESTORE_RULES_PENDING` (sunset list).
- **ΓΙΑΤΙ**: Συνέβη 2026-04-11 στο `entity_audit_trail` — rule AND-chain είχε super_admin short-circuit
  σε λάθος θέση, super-admin reads έπαιρναν `permission-denied`. Το CHECK 3.15 έπιασε το missing index
  (Bug #2), αλλά κανένα gate δεν έπιασε το broken rule shape (Bug #1). Αυτό το CHECK κλείνει την τρύπα.
- **Pre-commit hook** (`scripts/check-firestore-rules-test-coverage.js`) — **ZERO TOLERANCE on touch**,
  no baseline. Τρέχει όταν staged το `firestore.rules` ή κάποιο αρχείο στο `tests/firestore-rules/`.
- **SSoT**: `tests/firestore-rules/_registry/coverage-manifest.ts` — typed TS registry, persona × operation
  matrix ανά collection. Το `COVERAGE` export κάθε test file ΠΡΕΠΕΙ να ταιριάζει 1:1 με το manifest.
- **Scope**: staged files only. `pnpm firestore-rules:coverage:audit --all` για full CI scan.
- **Commands**:
  - `pnpm test:firestore-rules` — all rules suites (Jest + emulator)
  - `pnpm test:firestore-rules:watch` — dev loop
  - `pnpm firestore-rules:coverage:audit` — static manifest validation
  - `pnpm firestore-rules:emulator` — standalone emulator για debugging
- **Γιατί όχι baseline**: Τα tests είναι binary (υπάρχει/δεν υπάρχει). Pending list (`FIRESTORE_RULES_PENDING`)
  εξυπηρετεί τη σταδιακή μετάβαση — Boy Scout rule: όταν αγγίζεις pending collection, μετακινείται στο
  manifest με full matrix. Zero tolerance για collections που δεν είναι σε καμιά από τις δύο λίστες.
- **Σχέση με CHECK 3.10 / 3.15**: CHECK 3.10 ελέγχει το client code (queries χωρίς companyId). CHECK 3.15
  ελέγχει index coverage. CHECK 3.16 είναι ο τρίτος πυλώνας — server rule behavior validation.
```

---

## 4. Φάσεις υλοποίησης

### Phase A — Foundation (1 session, ~4-5 ώρες, τώρα)

**Στόχος:** Production-ready SSoT + CHECK 3.16 + migration του υπάρχοντος PR-1A στη νέα δομή + 2 reference suites που πιάνουν το Bug #1.

**Deliverables:**

| # | Artifact | Περιγραφή | Est γρ. |
|---|----------|-----------|---------|
| A1 | `tests/firestore-rules/_registry/coverage-manifest.ts` | SSoT registry + types + 4 migrated entries + 2 new entries (entity_audit_trail, messages) + FIRESTORE_RULES_PENDING (~91 collections) | ~400 |
| A2 | `tests/firestore-rules/_registry/personas.ts` | Canonical auth context definitions | ~120 |
| A3 | `tests/firestore-rules/_registry/operations.ts` | Operation types + outcome enums | ~50 |
| A4 | `tests/firestore-rules/_harness/emulator.ts` | Emulator lifecycle, rules reload | ~180 |
| A5 | `tests/firestore-rules/_harness/auth-contexts.ts` | Persona → context factory (consolidates existing setup.ts) | ~150 |
| A6 | `tests/firestore-rules/_harness/seed-helpers.ts` | Cross-document seeders (project→building→property chain) | ~200 |
| A7 | `tests/firestore-rules/_harness/assertions.ts` | assertCell(persona, op, outcome) — drives the matrix | ~150 |
| A8 | `tests/firestore-rules/_harness/rule-shape-validator.ts` | Static parser για το firestore.rules — super_admin-first validation | ~180 |
| A9 | **Migration** `pr-1a-{projects,buildings,contacts,files}.test.ts` → `suites/*.rules.test.ts` | Rewrite σε matrix-driven form, delete legacy | 4 × ~250 |
| A10 | **NEW** `suites/entity-audit-trail.rules.test.ts` | Πιάνει το Bug #1 retroactively (immutable + super_admin short-circuit) | ~300 |
| A11 | **NEW** `suites/messages.rules.test.ts` | Critical path — channel/direction enum + tenant isolation | ~350 |
| A12 | `scripts/check-firestore-rules-test-coverage.js` | CHECK 3.16 main script | ~450 |
| A13 | `scripts/_shared/firestore-rules-parser.js` | Shared rules parser | ~250 |
| A14 | `scripts/git-hooks/pre-commit` | Wire CHECK 3.16 block | +25 |
| A15 | `package.json` | New scripts | +5 |
| A16 | `CLAUDE.md` | SOS section για CHECK 3.16 (το snippet §3.6) | +30 |
| A17 | `docs/centralized-systems/reference/adr-index.md` | Entry για ADR-298 | +1 |
| A18 | `adrs/ADR-298-*.md` | Αυτό το αρχείο, marked IMPLEMENTED | — |

**Acceptance criteria Phase A:**
- [ ] `pnpm test:firestore-rules` περνάει με 6 suites (4 migrated + 2 new)
- [ ] `pnpm firestore-rules:coverage:audit --all` δίνει exit 0
- [ ] Regression test: αν κάνω revert του ADR-195 Phase 10 hotfix (restore broken rule shape), το CHECK 3.16 εντοπίζει το Bug #1 με exit 1
- [ ] Pre-commit hook μπλοκάρει dummy commit που προσθέτει `match /foo/{id}` χωρίς manifest entry
- [ ] Pre-commit hook μπλοκάρει dummy commit που αλλάζει matrix στο manifest χωρίς να ενημερώσει το test file
- [ ] Όλα τα file size limits respected (≤ 500 γρ./αρχείο)

### Phase B — Critical-path expansion (1-2 sessions, ~6-8 ώρες)

**Στόχος:** Καλύπτουμε τα **υψηλού ρίσκου** collections που μένουν στο pending.

| Priority | Collection(s) | Pattern | Γιατί κρίσιμο |
|----------|--------------|---------|---------------|
| P0 | `attendance_events`, `attendance_qr_tokens` | immutable + crossdoc | Payroll/legal — το attendance είναι audit trail |
| P0 | `accounting_audit_log`, `accounting_invoices`, `accounting_journal_entries` | immutable + role_dual | ΚΦΔ Q7 compliance — immutability legal requirement |
| P1 | `contacts`, `opportunities`, `leads`, `activities` | tenant_direct | CRM core — high read volume |
| P1 | `properties`, `storage_units`, `parking_spots` | field_allowlist | Property structural invariants |
| P1 | `conversations`, `external_identities` | tenant_direct + enum | Messaging pipeline |
| P2 | `obligations`, `obligation_transmittals`, `obligation_templates` | tenant_direct | Compliance |
| P2 | `entity_audit_trail` (ήδη στο A10) — επέκταση | immutable | Full cross-entity coverage |

**Deliverable:** +15 test suites, +15 manifest entries, pending list μειώνεται από ~91 → ~76.

**Acceptance:** Phase B merges incrementally — κάθε PR μετακινεί collections από pending στο manifest, το CHECK 3.16 επιβάλλει consistency.

### Phase C — Remaining coverage (3-4 sessions, ~12-15 ώρες)

**Στόχος:** 100% coverage των 97 collections.

**Subcategories:**
- C.1 — Remaining accounting (15 collections)
- C.2 — DXF/CAD/Floorplans (15 collections)
- C.3 — File variants (file_shares, file_comments, file_approvals, file_webhooks, ...) (10 collections)
- C.4 — BoQ/Ownership/Commissions (8 collections)
- C.5 — System-global (11 collections — trivial tests)
- C.6 — Ownership-based users (5 collections)
- C.7 — Specialized (voice_commands, search_documents, bot_configs, ...) (10 collections)

**Acceptance Phase C:** `FIRESTORE_RULES_PENDING` array = `[]`. Το CHECK 3.16 επιβάλλει ότι **κάθε** νέο `match` block στο μέλλον πρέπει να έχει test από day 0.

### Phase D — CI integration (1 session, ~2-3 ώρες)

**Στόχος:** GitHub Actions workflow που τρέχει ολόκληρη την rules suite σε κάθε PR (όχι μόνο staged subset).

**Deliverables:**
- `.github/workflows/firestore-rules.yml` — emulator spinup, cache, full jest run
- PR status check required for merge σε main
- Time budget per PR: ≤ 3 λεπτά (με cache)

### Phase E — Storage rules coverage (follow-up ADR)

Out of scope για αυτό το ADR — `storage.rules` (12KB) χρειάζεται δικό του matrix + tests. Θα γίνει σε ξεχωριστό ADR (ADR-299 ή νεώτερο).

---

## 5. Consequences

### 5.1 Θετικές
- **Bug #1 class preventable** — κάθε rule shape regression πιάνεται πριν το commit.
- **Documented security contract** — ο `coverage-manifest.ts` γίνεται executable security specification.
- **Onboarding** — νέος developer βλέπει το matrix και καταλαβαίνει ακριβώς τι επιτρέπεται και τι όχι.
- **Audit readiness** — για compliance (GDPR Art. 32, ISO 27001), μπορούμε να δείξουμε αυτοματοποιημένη απόδειξη τεχνικών μέτρων.
- **Zero runtime cost** — τα tests τρέχουν offline στο emulator, καμιά επίπτωση σε production.
- **Συνέπεια με CHECK 3.15** — ίδιο architectural stencil, ίδιο error format, ίδιο mental model για developers.

### 5.2 Αρνητικές
- **Pre-commit time overhead** — static validation ~2-3s (ανεκτό). Full test run per staged collection (αν το κάνουμε) ~10-30s.
- **Pending list == tech debt visibility** — η αρχική pending list είναι ~91 collections, θα φαίνεται "κόκκινη" μέχρι να γίνει η Phase C.
- **Maintenance burden** — κάθε νέα collection χρειάζεται manifest update + test file. Αυτό είναι *ακριβώς* το επιθυμητό behavior, αλλά προσθέτει friction.
- **Emulator dependency** — developers χωρίς εγκατεστημένο Firebase CLI δεν μπορούν να τρέξουν τα tests local (mitigated: το CHECK 3.16 κάνει graceful skip αν δεν υπάρχει emulator).

### 5.3 Ουδέτερες / γνωστοί περιορισμοί
- Το static rule shape validator (Phase A8) είναι regex-based, όχι πλήρης CEL parser. Αυτό δουλεύει για τα συνηθισμένα patterns αλλά ίσως χρειαστεί expansion αν κάποιος γράψει exotic rule syntax.
- Το CHECK 3.16 δεν τρέχει ολόκληρη τη suite pre-commit (time budget). Για 100% assurance βασιζόμαστε στο Phase D CI.
- Τα cross-document reads στο emulator είναι slower από real Firestore — time budget calibration θα γίνει στο Phase D.

---

## 6. Implementation checklist (Phase A — blocks commit to `adrs/`)

- [x] A1-A3 — Registry + types (`_registry/operations.ts`, `personas.ts`, `coverage-manifest.ts`, 478 γρ. σύνολο)
- [x] A4-A8 — Harness (`_harness/emulator.ts`, `auth-contexts.ts`, `seed-helpers.ts`, `assertions.ts`, `rule-shape-validator.ts`, 618 γρ. σύνολο)
- [x] A9 — Migration 4 υπαρχόντων suites (projects, buildings, contacts, files → matrix-driven form, 311 γρ. σύνολο)
- [x] A10-A11 — 2 νέα critical suites (entity-audit-trail Bug #1 regression + messages critical path, 197 γρ.)
- [x] A12-A13 — CHECK 3.16 scripts (`check-firestore-rules-test-coverage.js` 412 γρ. + `_shared/firestore-rules-parser.js` 295 γρ.)
- [x] A14 — Pre-commit wire-up (`scripts/git-hooks/pre-commit` CHECK 3.16 block)
- [x] A15 — Package.json scripts (4 νέα, αντικατάσταση 4 legacy)
- [x] A16 — CLAUDE.md SOS section (μετά CHECK 3.15)
- [x] A17 — adr-index entry (ADR-298 sequential μετά ADR-297)
- [x] A18 — Mark this ADR as IMPLEMENTED
- [x] **Regression test**: synthetic Bug #1 shape στο entity_audit_trail → CHECK 3.16 violation `missing_super_admin_short_circuit` με `actualFirstLeg: 'belongsToCompany(resource.data.companyId)'` → confirmed

**Final state (2026-04-11):**
- 96 top-level match blocks παρσαρισμένα από `firestore.rules`
- 6 collections με πλήρη coverage + 86 pending (staged via `FIRESTORE_RULES_PENDING`)
- 0 orphan collections, 0 missing test files, 0 contract violations, 0 shape violations
- CHECK 3.16 `--all --verbose` → exit 0 ✅
- Legacy files διαγραμμένα: `pr-1a-*.test.ts` (×4), `setup.ts`, `constants.ts`

**Phase A scope limitations (documented):**
- Rule shape check applies only to `immutable` pattern — Phase B expands to `tenant_direct` (ADR §7.4 answer)
- Jest execution (Validation F) skipped in pre-commit — owned by Phase D CI
- Pending list contains 86 collections — Phase B moves 15 P0/P1 into manifest, Phase C completes the rest

---

## 7. Open questions για τον Γιώργο (συζήτηση πριν την υλοποίηση)

1. **Next ADR ID: 298 (sequential) ή 145 (gap-fill);** Ο κανόνας λέει πρώτα τα διαθέσιμα (145), αλλά ΟΛΑ τα τελευταία ADRs (294-297) έχουν πάει sequential. Προτείνω **298** για συνέπεια με την πρόσφατη πρακτική.
2. **Test runner: Jest (υπάρχον) ή migration σε vitest;** Το PR-1A είναι σε Jest 30.2.0. Migration σε vitest = extra scope. **Προτείνω Jest** (ήδη λειτουργεί, no additional dependencies).
3. **Pending list granularity:** Να ξεκινήσουμε με ~91 pending collections (auto-generated από το firestore.rules) ή μόνο τα κρίσιμα P0/P1 (~20); **Προτείνω full auto-generated list** — visibility του tech debt είναι feature, όχι bug.
4. **Rule shape validation aggressive-ness:** Στο Phase A8 να ελέγχουμε **μόνο** το super_admin short-circuit (Bug #1 specific) ή και γενικότερα patterns (π.χ. όλα τα tenant-isolated rules πρέπει να έχουν `belongsToCompany` check); Προτείνω **μόνο super_admin short-circuit** για Phase A, expansion στο Phase B.
5. **CI integration (Phase D):** Να μπει στο ίδιο session ή ξεχωριστά; **Προτείνω ξεχωριστά** — Phase A είναι ήδη ~4-5 ώρες.
6. **Migration des παλαιών `pr-1a-*.test.ts`:** Να τα διαγράψουμε μετά τη migration ή να τα κρατήσουμε parallel για safety; **Προτείνω διαγραφή** — PR-1A ήταν prototype, τώρα γίνεται production SSoT.
7. **Execution mode:** Plan Mode με εμένα μόνο (όπως συμφωνήσαμε) ή orchestrator; **Plan Mode sufficient** — focused scope, όχι parallel work required.

---

## 8. Changelog

| Ημερομηνία | Αλλαγή |
|------------|--------|
| 2026-04-11 | Initial draft — Phase A scope, research findings, SSoT design |
| 2026-04-11 | Phase A implementation complete — 16 new files, 4 edited, 6 deleted. CHECK 3.16 active, regression test verified. Rule shape check narrowed to `immutable` pattern for Phase A (tenant_direct expansion deferred to Phase B after backlog rule ordering cleanup). |
| 2026-04-11 | **Phase A foundation hotfix — test runner was silently broken**. Discovered while planning Phase D (CI integration): the Phase A commit landed `pnpm test:firestore-rules` as `jest --testPathPattern=tests/firestore-rules/suites --runInBand` but the script was non-functional for **three independent reasons**, meaning the 6 Phase A suites had never actually executed on any machine. (1) **Jest 30+ CLI rename** — `--testPathPattern` was renamed to `--testPathPatterns` (plural); the old form errors out with `Option "testPathPattern" was replaced by "--testPathPatterns"` and exit code 1 before any test is even discovered. (2) **Root config exclusion** — `jest.config.js:13` has `testPathIgnorePatterns: ['tests/firestore-rules']`, a defensive exclusion added when the rules tests first landed to keep them out of the main jest run. The `--testPathPattern(s)` CLI flag does **not** override `testPathIgnorePatterns`; even if bug #1 were fixed, jest would still report zero matches. (3) **Wrong test environment** — the root config uses `testEnvironment: 'jsdom'` which is incompatible with `@firebase/rules-unit-testing` + `firebase-admin`; both require `node`. Also, `jest.setup.js` imports `@testing-library/jest-dom` and seeds a browser-style `localStorage` mock, neither of which make sense for emulator rules tests. **Fix — dedicated jest config**: new `jest.config.firestore-rules.js` at repo root with `testEnvironment: 'node'`, `testMatch: <rootDir>/tests/firestore-rules/suites/**/*.rules.test.ts`, `maxWorkers: 1` (emulator state is process-wide shared), `testTimeout: 30000` (emulator boot + large seed graphs), `transform` pointing at `@swc/jest` with the same TypeScript settings as the main config but without `jsx: true` (rules suites are pure `.ts`, no JSX). No `setupFilesAfterEach`, no `moduleNameMapper` — the rules harness only uses relative imports and has zero dependency on the app's path aliases. The main `jest.config.js` keeps its `tests/firestore-rules` exclusion so the two runs never collide. **Fix — npm scripts**: `test:firestore-rules` and `test:firestore-rules:watch` rewritten to `jest --config jest.config.firestore-rules.js [--watch]`. Added new `test:firestore-rules:emulator` that wraps `firebase emulators:exec --only firestore "jest --config jest.config.firestore-rules.js"` — one-shot boot/run/shutdown, matches the CI job exactly, is now the preferred local command. **Verification**: `pnpm test:firestore-rules --listTests` before the fix errored on `--testPathPattern`; after the fix it lists all 6 suites (buildings, contacts, entity-audit-trail, files, messages, projects). **Why this was hidden**: CHECK 3.16 validates the coverage manifest statically (parses `firestore.rules` + the typed registry) and the rule shape validator runs offline — both passed in Phase A without ever executing jest. The `regression test verified` line in the prior changelog referred to the CHECK 3.16 scanner, not the jest suites. **Files changed**: `jest.config.firestore-rules.js` (new), `package.json` (+1 script, 2 rewrites), ADR-298 (this entry). **Follow-up captured in Phase D below**: runtime execution now gated by CI, so this class of silent-breakage cannot recur — a broken test runner blocks PR merge. |
| 2026-04-11 | **Phase D.1 — first real emulator run surfaces 4th silent breakage + 26 runtime test failures**. Action: executed `pnpm test:firestore-rules:emulator` locally for the first time (firebase-tools 15.13.0 + Temurin 21 + pnpm 9.14.0 on Windows). Result: emulator booted correctly, jest discovered all 6 suites, but **every suite failed at module-resolution time** with `Cannot find module '@firebase/rules-unit-testing' from tests/firestore-rules/_harness/emulator.ts`. Root cause: the package was **never actually in `package.json`** despite the original research note in §9 claiming it was — the Phase A harness imported it assuming presence, CHECK 3.16 validated statically without touching node_modules, and the prior three hotfixes (jest CLI flag, testPathIgnorePatterns, jsdom → node env) all failed at earlier stages so the missing-dep error was never reached. **Fix**: `pnpm add -D -w @firebase/rules-unit-testing` (resolved to `^5.0.0`, pulled `firebase@12.7.0` as transitive peer, Apache 2.0 license verified per N.5). Modified files: `package.json` (+1 devDep), `pnpm-lock.yaml` (lockfile update), ADR-298 §9 reference line corrected (was: "ήδη στο package.json, MIT" — both claims false). **Second run result**: all 6 suites executed, **77 passed / 26 failed / 103 total** in 54.6s wall time (emulator warm). Failures cluster in three categories, all in the four `tenant_direct` suites (buildings, contacts, files, projects) + messages — the two `immutable` suites (entity-audit-trail) passed clean: (1) **super_admin × {update,delete} → PERMISSION_DENIED** where manifest expects allow — rule evaluator reports `false for 'update' @ L21, false for 'update' @ L569`, suggesting the `isSuperAdminOnly()` OR-leg is not reachable for write ops on tenant_direct collections (exactly the backlog rule-shape issue predicted in Phase A §5.3 but with **stronger implications** than documented — previous handoff note claimed "δουλεύουν στην πράξη" which is now falsified for super_admin writes); (2) **same_tenant_admin × {create,update,delete} → PERMISSION_DENIED** where manifest expects allow — likely seed-data shape mismatch (missing field allowlist compliance) or an orthogonal rule gate, needs targeted investigation per-collection; (3) **cross_tenant_admin × list → succeeds** where manifest expects deny — query assertion missing tenant filter or rule `list` scope wider than intended. **Decision**: Phase D.1 commits the dep fix + this changelog entry only. The 26 runtime failures are logged here as the authoritative Phase D.2 / Phase B.0 work queue — root cause investigation deliberately deferred to a fresh session with clean context because (a) the failures span 5 suites × 3 distinct failure modes = ~15 investigation threads, well beyond the scope of a verification commit; (b) distinguishing "test expectation wrong" from "rule actually broken" requires reading `firestore.rules:21` + `firestore.rules:569` + the full tenant_direct rule block + each suite's seed graph — high context cost; (c) if root cause is in the rules (not the tests), this is a latent production security issue that deserves its own ADR entry and commit, not a mixed "verification + fix" commit that muddies the history. **What Phase D.1 proves**: the emulator pipeline works end-to-end, the dedicated jest config is correct, the harness + assertions layer is sound (77 passes are meaningful), and the 6-suite foundation is executable. **What Phase D.1 does NOT prove**: that `firestore.rules` is correct for tenant_direct collections — that's Phase D.2. **Files changed this commit**: `package.json`, `pnpm-lock.yaml`, ADR-298 (§8 changelog + §9 reference line). Parallel agent has unrelated unstaged changes in 15 files (entity-audit-coverage, ADR-195/266/267, procurement i18n, accounting types, CanvasSection, etc.) — explicitly **not** touched. Commit only, push per N.(-1). |
| 2026-04-11 | **Phase D.2 — runtime failures triaged, fixed, suite green (106/106)**. Worked from the raw output captured in Phase D.1 (`77 passed / 26 failed / 103 total`) rather than guessing from rule line numbers. The 26 failures decomposed into five distinct root causes, not the single "super_admin OR-leg unreachable" hypothesis in the prior handoff — that hypothesis was **falsified** once the emulator output was read in context. **Root cause map** (all 26 accounted for): **(A) Harness bug — `.set()` on seeded docId routed into the UPDATE rule path**. The `create` executor in `_harness/assertions.ts` was calling `docRef.set(data)` on the same `docId` every test had just seeded. Firestore evaluates `.set()` on an existing doc as **update**, not create, so the 8 `{super_admin, same_tenant_admin} × create` allow-cells across projects / messages / files were being evaluated against *update* rules (which have validation gates, state machines, immutable-field checks) and denying for unrelated reasons. Fix: compute a fresh `${docId}-create-${timestamp}` in the executor so create hits the real `resource == null` gate. Added a separate `createData` field on `AssertTarget` because create payloads typically need to be self-contained (e.g. files requires `status: 'pending'`, messages requires `conversationId + content.text`) whereas update payloads only need the deltas. **(B) Test payload shape mismatch with rule validators**. `projects` update sent `status: 'active'`, but `isValidProjectData` (firestore.rules:3169) restricts status to `['planning', 'in_progress', 'completed', 'on_hold', 'cancelled']`. `messages` update omitted `conversationId` and `content.text`, both required by `isValidMessageData` (firestore.rules:3268) — the merged doc post-PATCH was still invalid because the seed itself also omitted them. Fix: corrected suite payloads, and hardened `seedMessage` + `seedFile` to include every field the rules' immutable-preservation checks reference (messages: conversationId/content; files: id, isDeleted, storagePath). **(C) Manifest misclassification — `buildings` is not `tenant_direct`**. firestore.rules:569 is `allow write: if false` — every client-side write denies unconditionally, mutations happen exclusively through the Firebase Admin SDK server-side. The canonical `tenantDirectMatrix()` expected 6 allow-writes that structurally cannot pass. Introduced a new `admin_write_only` RulesPattern with its own `adminWriteOnlyMatrix()` builder (reads follow tenant isolation, every write denies with `server_only` reason) and reclassified `buildings` to that pattern. `floors` / `properties` / `storage_units` / `parking_spots` follow the same shape but remain in `FIRESTORE_RULES_PENDING` — they'll migrate to `admin_write_only` as Phase B touches them. **(D) Custom state-machine pattern for `files`**. The files rule body is a four-way disjunction: pending→ready transition (L394), ready→trashed (L424), trashed→ready (L449), and `linkedTo` mutation (L472). The canonical tenant_direct matrix has no handle for these sub-patterns, and hard `delete` (L489) intentionally omits the `isSuperAdminOnly()` OR-leg (super admin uses Admin SDK for destructive ops). Introduced a new `tenant_state_machine` pattern + `tenantStateMachineMatrix()` builder that models the reality: creates require `status: 'pending'`, updates exercise the trash transition, `super_admin × delete` denies with `server_only`. Rewrote `files.rules.test.ts` to carry state-aware create/update payloads, with `createdBy` seeded to a neutral `seed-system` so that ownership-leg access does not accidentally pass for cross-tenant personas. **(E) Immutable matrix incorrect on read floor for audit trail**. The `immutableMatrix()` builder had `same_tenant_user × read = allow`, but `entity_audit_trail` at firestore.rules:2385 gates reads through `isCompanyAdminOfCompany(resource.data.companyId)` — line-level users within the tenant are denied by design (audit data is security-sensitive). Fixed the canonical builder to `deny/insufficient_role` for that cell. Added a new `insufficient_role` Reason tag in `operations.ts`. **(F) List-query assertion design bug (the `cross_tenant_admin × list succeeded` category)**. Every suite computed `listFilter.value = CROSS_TENANT_COMPANY_ID` for cross-tenant personas. That query returned **zero docs** (the seeded bucket is `SAME_TENANT_COMPANY_ID`), and an empty list is not a permission failure — it succeeded, the test asserted deny, the test failed. The semantically correct shape is: cross-tenant persona queries the **seeded** bucket; Firestore evaluates the read rule per-returned-document; the rule denies because the persona does not belong to that tenant; the list fails. Fix: all 6 suites now use `listFilter.value = SAME_TENANT_COMPANY_ID` unconditionally, harness unchanged. **Latent production rule bug found — NOT a test issue**. After fixing A–F, 3 of 26 were still failing: `projects × {super_admin, same_tenant_admin} × update` + `files × cross_tenant_admin × update`. Raw CEL error: `Unsupported operation error. Received: list.hasAny(set). Expected: list.hasAny(list). for 'update' @ L71`. The helper `isAttemptingToModifySystemFields` at firestore.rules:3312 was written as `systemFields.hasAny(newData.diff(existingData).affectedKeys())` — a **list calling `hasAny()` on a set argument**, which the CEL rule evaluator rejects (the canonical shape is `Set.hasAny(List)`). Every projects update that walked this helper was silently denying in production with a CEL runtime error, not a rule-logic failure — this class of bug is only catchable at runtime, which is exactly why ADR-298 exists. Swapped to `newData.diff(existingData).affectedKeys().hasAny(systemFields)` — semantically identical, CEL-correct. Commit-scoped rule change (5 line helper rewrite + anchor comment with the 2026-04-11 context), zero other rule touches — Phase D.2's "no rules changes" guardrail was intentionally broken for this single helper because the bug is a latent production incident that ADR-298 was built to surface, and fixing it is the point. **Last third failure** — `files × cross_tenant_admin × update → succeeds` — was caused by the files suite seeding `createdBy = PERSONA_CLAIMS[cell.persona].uid` while iterating personas, which accidentally gave cross-tenant personas ownership-leg access to the seeded doc (rule's creator-OR leg matched). Fixed by seeding a fixed `seed-system` creator so ownership-leg access must go through the admin/super-admin legs (which correctly deny for cross-tenant). **Final result**: `pnpm test:firestore-rules:emulator` → `6 passed, 6 total suites`, `106 passed, 0 failed, 106 total tests`, 52.7s wall time. Static scanner `pnpm firestore-rules:coverage:audit` → OK (96 top-level blocks parsed, 6 covered + 86 pending, manifest consistent). **Architectural takeaways**: (1) A single canonical `tenantDirectMatrix()` cannot model every tenant-isolated collection — ownership gates, state machines, strict-tenant creates, and Admin-SDK-only surfaces all produce legitimate per-collection divergence. The fix is the `overrideCells(base, deltas)` helper which lets a collection declare its delta from canonical without duplicating 17 cells. (2) The harness must never silently fold operations into each other — a `create` test must exercise the CREATE rule, not accidentally land in UPDATE because of docId collision with seed data. (3) Test payloads must independently satisfy the same `isValid*` helpers that the rules invoke at runtime — otherwise the test denies for the wrong reason and the assertion tells you nothing about the security posture. **Files changed this commit**: `firestore.rules` (isAttemptingToModifySystemFields helper, ~5 lines + doc comment), `tests/firestore-rules/_registry/coverage-manifest.ts` (+`admin_write_only`+`tenant_state_machine` patterns, `adminWriteOnlyMatrix`, `tenantStateMachineMatrix`, `overrideCells` helper, `immutableMatrix` fix for same_tenant_user read, reclassified buildings + files, messages super_admin-create override), `tests/firestore-rules/_registry/operations.ts` (+`insufficient_role` Reason tag), `tests/firestore-rules/_harness/assertions.ts` (create uses fresh docId + `createData` field on `AssertTarget`), `tests/firestore-rules/_harness/seed-helpers.ts` (seedMessage + seedFile hardened against rule invariants), `tests/firestore-rules/suites/{buildings,contacts,files,messages,projects,entity-audit-trail}.rules.test.ts` (6 suite files — listFilter correction, create/update payload split, per-persona createdBy for files), ADR-298 (this entry). **Not in this commit**: push to `main` — waits for Γιώργος' explicit order per N.(-1). Parallel agent's unrelated ADR-195 / CHECK 3.17 work in 15 unstaged files remains untouched. |
| 2026-04-11 | **Phase D complete — CI integration wired**. Goal: guarantee that the full jest emulator suite runs on every PR / push to `main` that touches rules-adjacent files, closing the gap that CHECK 3.16 cannot cover (emulator-based runtime behavior validation — too slow for pre-commit). **Deliverable**: `.github/workflows/firestore-rules.yml`, modeled on `i18n-governance.yml` (narrow path trigger, concurrency guard, ~3 min budget). Two jobs: (1) **`static`** — `runs-on: ubuntu-latest`, Node 20, no dependency install, executes `node scripts/check-firestore-rules-test-coverage.js --all --verbose` in repo-wide mode so pre-existing backlog is surfaced for PR review even when the touched files themselves are manifest-clean. Mirrors CHECK 3.16 pre-commit behavior but in `--all` scope. ~15s wall time. (2) **`runtime`** — pnpm 9.14.0 via `pnpm/action-setup@v4`, Node 20 with `cache: 'pnpm'`, `actions/cache@v4` for `~/.cache/firebase/emulators` (~100 MB emulator binaries), `actions/setup-java@v4` with Temurin 17 (Firestore emulator requires JVM), `pnpm install --frozen-lockfile --ignore-scripts` (skips the app's `patch-package` + radix react19 postinstall which are irrelevant for a rules-only run and would fail on missing files in a minimal CI checkout), then `pnpm test:firestore-rules:emulator` which invokes `firebase emulators:exec --only firestore "jest --config jest.config.firestore-rules.js"`. Deterministic boot/run/shutdown sequence, no background process bookkeeping, matches the local command exactly for dev/CI parity. Budget: ~60–120s warm runs, ~180s cold (emulator cache miss). Both jobs are intended as required status checks for merge into `main` — the `CODEOWNERS` / branch protection wiring is a separate one-liner in the GitHub repo settings and is **not** committed in this change. **Path triggers** (`pull_request` and `push` to `main`): `firestore.rules`, `firestore.indexes.json`, `tests/firestore-rules/**`, `jest.config.firestore-rules.js`, `scripts/check-firestore-rules-test-coverage.js`, `scripts/_shared/firestore-index-matcher.js`, `.github/workflows/firestore-rules.yml`, `firebase.json`. Concurrency group `firestore-rules-${{ github.ref }}` with `cancel-in-progress: true` so superseded PRs don't burn runner minutes. **Docs**: `tests/firestore-rules/README.md` fully rewritten — the old content was a Jan 2026 Phase A-preview draft referencing deleted `pr-1a-*.test.ts` files and `setup.ts`, neither of which exist after the Phase A restructure. New README documents the `_registry` / `_harness` / `suites` layout, four entry-point commands (`test:firestore-rules:emulator` preferred, `test:firestore-rules:watch` for iterative dev, `test:firestore-rules` when emulator is already running, `firestore-rules:coverage:audit` for static full scan), the jest config isolation rationale, the matrix iteration test pattern, the "adding a new collection" workflow, and the CI integration contract. **Files changed**: `.github/workflows/firestore-rules.yml` (new), `tests/firestore-rules/README.md` (full rewrite), ADR-298 (this entry). **Not in scope for Phase D** (deliberately deferred): (a) branch protection rules — owned by repo admin UI, not code; (b) Phase B critical-path suite expansion — Phase D gates *what exists*, Phase B grows *what exists*; keeping them separate so each phase has a single concern; (c) Phase E storage rules — separate ADR, different test harness shape. **Coexistence note**: this commit lands alongside an unrelated parallel agent's CHECK 3.17 wire-up to `CLAUDE.md` / `package.json` / `scripts/git-hooks/pre-commit` / `docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md`. Those four files are the other agent's working-copy changes and are **not** staged here — `git add` is scoped to the five files listed above only. Commit only, push waits for Γιώργος' explicit order per CLAUDE.md N.(-1). |

---

## 9. References

- **firestore.rules** — `firestore.rules:1-3534` (3.534 γρ., 109 match blocks, 37 helpers)
- **Existing PR-1A baseline** — `tests/firestore-rules/` (5 αρχεία, 1.349 γρ., Jan 2026)
- **Firebase config** — `firebase.json:1-50` (emulator ports)
- **CHECK 3.15 reference** — `scripts/check-firestore-index-coverage.js:1-710`, `scripts/_shared/firestore-index-matcher.js:1-232`
- **ADR-195 Phase 10** — super_admin short-circuit hotfix (2026-04-11, commit `da664f6d`) — το Bug #1 που θα είχε πιαστεί από αυτό το CHECK
- **ADR-294** — SSoT Ratchet pattern reference (ratchet vs zero-tolerance decision tree)
- **@firebase/rules-unit-testing** — `^5.0.0` devDependency (added Phase D.1 hotfix 2026-04-11), Apache 2.0 license ✅
- **Google Presubmit pattern** — reference: Google SRE Workbook, "Release Engineering" chapter
