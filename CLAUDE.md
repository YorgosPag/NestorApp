Instruction text

## 🌐🌐🌐 LANGUAGE RULE — ABSOLUTE, NON-NEGOTIABLE, OVERRIDES EVERYTHING

**Giorgio writes to you in Greek. You ALWAYS respond in Italian.**

- ✅ READ Greek input perfectly (Giorgio's native language)
- ✅ RESPOND ALWAYS in Italian, regardless of the language of these instructions
- ❌ NEVER respond in English (even though these instructions are in English)
- ❌ NEVER respond in Greek (token cost is 2.5-3x higher than Italian)
- ⚠️ This rule OVERRIDES every other instruction. If any rule below appears to conflict, this one wins.

**Why**: Italian output saves ~60% output tokens vs Greek, and output tokens cost 5x input tokens. Giorgio knows Italian fluently. The English language of this file is purely for input-token efficiency in the tokenizer — it does NOT mean you should respond in English.

---

## 🚨🚨🚨 SOS. SOS. N.(-1) — TERMINAL PROHIBITION: NEVER GIT PUSH WITHOUT ORDER
**ABSOLUTELY FORBIDDEN** to `git push` without EXPLICIT order from Giorgio.
- After every `git commit`, **STOP** and **WAIT** for an order.
- DO NOT push automatically, DO NOT push "for convenience", DO NOT push "because it built".
- Push happens ONLY if Giorgio says: "push", "send it", "upload", "go Vercel" (in Greek: "push", "στείλε", "ανέβασε", "πήγαινε Vercel").
- **WHY:** Each push = Vercel build = credits consumption ($). Giorgio pays.
- **ZERO EXCEPTIONS.** This rule overrides ALL other rules.
- 📘 Full git/push/backup protocol: `docs/deployment/git-workflow.md`

## SOS. SOS. N.0 — CENTRALIZED SYSTEMS
YOU READ:
- **MASTER HUB**: `docs/centralized-systems/README.md`
- **ADR INDEX**: `docs/centralized-systems/reference/adr-index.md`

So you know which centralized systems exist and use them.

## 🚨 SOS. SOS. N.0.0 — PERSISTENT RULES FOLDER (.claude-rules/)

**AT THE START OF EVERY SESSION** you read `.claude-rules/MEMORY.md` and the files referenced there. This folder contains **permanent behavioral rules**:
- General quality rules (Google-level, SSoT, anti-hardcoding)
- Workflow rules (ADR-driven, no push without order, etc.)
- Project-specific pending work / context

**Why a project folder**: Git-tracked, automatic backup with code, visible to Giorgio, follows every clone.

**If you spot a new stable rule** → save it in `.claude-rules/` (project), not in the user folder.

## 🚨 SOS. SOS. N.0.1 — NON-NEGOTIABLE RULE: ADR-DRIVEN WORKFLOW (4 PHASES)

**EVERY TASK MANDATORILY follows this flow. ZERO EXCEPTIONS.**

**CRITICAL: CODE = SOURCE OF TRUTH, ADRs = DOCUMENTATION. If they disagree, code wins.**

### PHASE 1: RECOGNITION (Plan Mode)
Before you write A SINGLE line of code:
1. Find relevant ADRs from `docs/centralized-systems/reference/adr-index.md`
2. Read the **CURRENT CODE** (Grep/Glob/Read) — that's what runs in production
3. Compare ADR vs Code — do they match?
4. **If they DO NOT match** → UPDATE THE ADR to reflect the current code
5. Create plan for the task based on updated ADR + Giorgio's order

### PHASE 2: IMPLEMENTATION
Write code based on the plan from Phase 1.

### PHASE 3: ADR UPDATE
After implementation:
1. Update the relevant ADR(s) with the changes made
2. Add entry to the changelog section of the ADR
3. Update any diagrams, interfaces, examples

### PHASE 4: COMMIT + DEPLOY
Code AND ADR(s) in the same commit.

**WHY**: Many ADRs are out-of-date. If you blindly follow an outdated ADR → you'll break production. First check code, then update, then implement, then re-update.

## SOS. SOS. N.1 — PROFESSIONAL QUALITY
Every solution must be **professional**, not a **neighborhood corner-shop hack**.

## SOS. SOS. N.2 — `any` IS FORBIDDEN

## SOS. SOS. N.3 — INLINE STYLES ARE FORBIDDEN

## SOS. SOS. N.4 — FORBIDDEN:
- Excessive/anarchic use of `<div>`
- Nested `<div>` without semantic structure
- Components consisting only of consecutive `<div>` without reason
- UI parts that should use semantic elements (`section`, `nav`, `main`, `header`, `footer`)

## SOS. SOS. N.5 — LICENSE CHECK
- BEFORE installing ANY new npm package → MANDATORILY check the license
- ONLY ALLOWED permissive licenses: **MIT**, **Apache 2.0**, **BSD**
- FORBIDDEN: **GPL**, **LGPL**, **AGPL** (force open source)
- If license is unclear → ASK Giorgio
- Ref: ADR-034 Appendix C

## SOS. SOS. N.6 — MANDATORY USE OF ENTERPRISE IDs
- EVERY Firestore document MUST be created with `setDoc()` + ID from `enterprise-id.service.ts`
- FORBIDDEN: `addDoc()`, `.add()`, `.collection().doc()` without ID, `Date.now()` IDs, filename-based IDs, inline `crypto.randomUUID()`
- SOLE SOURCE of IDs: `@/services/enterprise-id.service` (60+ generators)
- If no generator exists for the collection → CREATE prefix + generator FIRST
- **PRE-COMMIT ENFORCEMENT**: SSoT ratchet hook blocks `addDoc(`, `.add({`, `.collection().doc()` in new files. Module: `addDoc-prohibition` in `.ssot-registry.json`
- Ref: ADR-017, ADR-210, ADR-294

## SOS. SOS. N.7 — GOOGLE-LEVEL QUALITY
- Every coding/fix MUST be **Google-level**
- Optimistic updates, proper state management, zero race conditions
- If the first solution is not Google-level → don't commit it, rewrite it correctly
- Examples: Google Docs auto-save, Gmail instant actions, Google Contacts patterns

## SOS. SOS. N.7.1 — GOOGLE FILE SIZE STANDARDS
- **Code files** (handler, service, utility, component): **MAX 500 lines**
- **Functions**: **MAX 40 lines** — if exceeded, extract helper
- **Config / Types / Data files**: No limit (no logic)
- If file >500 lines → **MANDATORY split** before commit
- Pre-commit hook BLOCKS commit if staged code file >500 lines
- **Exceptions**: `*.config.*`, `types/`, `config/`, `data/`, `*.d.ts`, `*.test.*`, `*.spec.*`
- **WHY**: Google SRP — each file = 1 responsibility. >500 lines = code smell, >1000 = bug

## 🚨🚨🚨 SOS. SOS. N.8 — EXECUTION MODE EVALUATION (ADR-261)

**FIRST STEP OF EVERY TASK — BEFORE YOU WRITE A SINGLE LINE OF CODE:**

Evaluate the task. Count files + domains. Choose execution mode:

| Criterion | Simple execution | Plan Mode | Orchestrator |
|----------|--------------|-----------|--------------|
| Files | 1-2 | 3-5 | **5+** |
| Domains | 1 | 1-2 | **2+** |
| Type | Bugfix, small change | New feature, refactor | **Cross-cutting** |
| Risk | Low | Medium | **High** |

**MANDATORY FLOWS:**
1. **Simple execution** (1-2 files, 1 domain) → Proceed immediately
2. **Plan Mode** (3-5 files) → Enter plan mode yourself, no approval needed
3. **Orchestrator** (5+ files, 2+ domains) → **STOP.** Inform Giorgio FIRST:
```
🤖 Task evaluation: ~X files in Y domains.
Suggestion: Orchestrator (~ZK tokens, Nx) or Plan Mode?
What do you prefer?
```
- **DO NOT run orchestrator without Giorgio's approval** (~2.5–3.5x tokens)
- **DO NOT ignore this rule** — 5+ files & 2+ domains = ASK

## SOS. SOS. N.9 — CONTEXT HEALTH INDICATOR (MANDATORY AT END OF EVERY TASK)

After every completed task, display:

```
📊 Context: ~35% | Commands: 3 | ✅ Continue normally
```
```
📊 Context: ~70% | Commands: 6 | ⚠️ Consider /clear if changing topic
```
```
📊 Context: ~90% | Commands: 9+ | 🔴 Do /clear before next command
```

**Guidelines:**
- 1-3 commands, few reads → ~20-35% → ✅
- 4-6 commands, moderate reads → ~50-70% → ⚠️
- 7+ commands or many refactorings → ~80-95% → 🔴
- Many errors/retries → +15%

**NOISE RULE**: If you're stuck or repeating same mistakes REGARDLESS of percentage → don't insist:
```
⚠️ I'm struggling — context has noise from previous tasks.
Suggestion: Do /clear and give me the command again cleanly.
```

**🔴 HANDOFF PROTOCOL** — At 🔴 level (or NOISE RULE triggers), ALWAYS offer:
```
🔴 Context ~90% — vuoi handoff report prima di /clear?
```
- If Giorgio says yes → write structured report (stato, prossimo passo, contesto critico, non fare)
- If Giorgio says no → just say /clear
- **NEVER** just say "fai /clear" without offering the handoff first at 🔴 level
- **WHY**: Google-level runbook — never lose state between sessions

(Note: the indicator text shown to Giorgio must be in Italian, per the LANGUAGE RULE at the top.)

## SOS. SOS. N.10 — AI PIPELINE: MANDATORY TESTING (Google Presubmit Pattern)
- **WHEN you touch files in `src/services/ai-pipeline/`**:
  1. **RUN** the tests: `npm run test:ai-pipeline:all` (62 suites, ~11s)
  2. **WRITE new tests** if adding functionality
  3. **UPDATE existing tests** if changing behavior
- Pre-commit hook automatically runs the tests if staged files contain ai-pipeline changes
- If tests fail → DO NOT commit, FIX first
- **Test patterns**: `src/services/ai-pipeline/__tests__/` and `tools/__tests__/handlers/`

## 🚨🚨🚨 SOS. SOS. N.11 — TERMINAL PROHIBITION: HARDCODED STRINGS in CODE (i18n SSoT)

**ABSOLUTELY FORBIDDEN** to use hardcoded Greek/English strings in `.ts` / `.tsx` files outside of locale files.

### Rules:

1. **ALL user-facing strings** go through `t('namespace.key')` i18n calls.
2. **FORBIDDEN** is `defaultValue` with literal Greek/English text:
   ```typescript
   // ❌ FORBIDDEN
   t('myKey', { defaultValue: 'Προσθήκη Νέου Έργου' })

   // ✅ ALLOWED
   t('myKey')                            // the key exists in locales
   t('myKey', { defaultValue: '' })      // empty string only
   ```
3. **BEFORE** any new key in code → **FIRST** add the key in `src/i18n/locales/el/*.json` **AND** `src/i18n/locales/en/*.json`.
4. **EXCEPTIONS**: `src/i18n/locales/**/*.json`, code comments, `logger.*()` calls (server logs), test files, ADR docs.

### WHY:
- **Pure SSoT**: Every label change happens ONCE in locale JSONs
- **Translation**: If hardcoded Greek, English runs Greek
- **Consistency**: All developers use the same pattern

### Pre-commit checks (summary):

| CHECK | Goal | Mode | Baseline |
|-------|--------|------|----------|
| **3.8** | Missing i18n keys (`t('key')` without match in locales) | RATCHET | `.i18n-missing-keys-baseline.json` (4762) |
| **3.9** | ICU interpolation — `{variable}` not `{{variable}}` in locale JSONs | RATCHET | 0 (fully cleaned) |
| **3.10** | Firestore `query()` with `where()` MUST include `companyId` | RATCHET | `.firestore-companyid-baseline.json` (48) |
| **3.13** | i18n Runtime Resolver Reachability (ADR-279/280) | RATCHET | 378 violations / 13 files |
| **3.14** | Audit Value Catalogs SSoT (ADR-195) | ZERO TOL | no baseline |
| **3.15** | Firestore Index Coverage (super-admin variant) | ZERO TOL on touch | no baseline |
| **3.16** | Firestore Rules Test Coverage (ADR-298) | ZERO TOL on touch | no baseline |
| **3.17** | Entity Audit Coverage — writers call `EntityAuditService.recordChange()` | RATCHET | `.entity-audit-coverage-baseline.json` (70) |

**📘 Full details (incidents, why, commands, relationships)**: `docs/centralized-systems/reference/precommit-checks.md`

### Hardcoded strings baseline
- **Baseline file**: `.i18n-violations-baseline.json` (473 violations / 94 files, 2026-04-05)
- New file with violations → BLOCK (zero tolerance)
- Existing file with more than baseline → BLOCK
- Commands: `npm run i18n:audit`, `npm run i18n:baseline`

### Boy Scout Rule
When you touch a legacy file → clean up as many violations as you can. **ZERO TOLERANCE for new violations.**

## SOS. SOS. N.12 — SSoT RATCHET ENFORCEMENT (ADR-294)
- **Pre-commit hook CHECK 3.7** blocks new SSoT violations
- **Pre-commit hook CHECK 3.18 (ADR-314)** blocks new structural duplicates / anti-patterns / registry gaps. Layer 1 = pre-commit smoke (~0.2s), Layer 2 = `.github/workflows/ssot-discover.yml` full scan on every PR. Baseline: `.ssot-discover-baseline.json` (46 duplicates / 5 anti-patterns / 91 unprotected, 2026-04-19). Local full scan: `SSOT_DISCOVER_FULL=1 git commit …`.
- **Test suites (Google presubmit-grade)**:
  - `scripts/__tests__/check-ssot-discover-ratchet.test.js` — CHECK 3.18 wrapper logic (57 tests / 9 groups, coverage 96.82% stmts / 92.30% branches / 100% fns). Run: `npm run test:ssot-discover`.
  - `scripts/__tests__/registry-golden-regex.test.js` — registry golden tests (44 tests / 3 groups): ERE syntax validity on all ~225 `forbiddenPatterns` via real `grep -E -f` + semantic match/skip fixtures on a 13-module cross-tier sample (incl. `gcs-buckets` after 2026-04-19 dormant-ratchet fix). Catches the v3.0-class `(?:...)`/lookahead-silent-match-nothing bug at presubmit. Run: `npm run test:registry-golden`.
  - Combined: `npm run test:ssot-suite` → 101 tests, ~30s Windows / ~10s Linux.
- **Registry**: `.ssot-registry.json` — 62+ modules in 7 tiers
- **Baseline**: `.ssot-violations-baseline.json` — 7 files, 16 violations (2026-04-11)
- **Entity audit trail**: Module `entity-audit-trail` (Tier 3, ADR-195) forbids direct writes to `entity_audit_trail`, inline queries, and re-implementations of the `useEntityAudit` hook. Canonical: `src/services/entity-audit.service.ts` + `src/hooks/useEntityAudit.ts`
- **Ratchet**: Violations only decrease
- **WHEN you centralize a new module** → add it to `.ssot-registry.json` + `npm run ssot:baseline`
- **Commands**:
  - `npm run ssot:audit` — progress vs baseline
  - `npm run ssot:baseline` — update baseline
  - `npm run ssot:discover` — detect duplicates, anti-patterns, registry gaps (human report)
  - `npm run ssot:discover:check` — full scan + baseline compare (CHECK 3.18, ~4 min Win / ~1 min Linux)
  - `npm run ssot:discover:baseline` — refresh CHECK 3.18 baseline after legit cleanup

## 🚨🚨🚨 SOS. SOS. N.13 — RATCHET BACKLOG SESSION-START REMINDER (ADR-299)

**IN YOUR FIRST RESPONSE OF EVERY NEW SESSION**:

1. **CHECK** first line of `.claude-rules/pending-ratchet-work.md` for `STATUS:`
   - If `STATUS: ALL_DONE` → **SKIP reading the rest**. Say 1 line: "Nessun ratchet pendente." Done.
   - If `STATUS: ACTIVE` → **READ** the file fully, **REMIND** Giorgio BRIEFLY (2-4 lines max) of what's pending
2. **EXCEPTION**: If Giorgio gives an order for **independent work**, skip the reminder entirely.

**UPDATE RULE**:
- Completed ratchet → **REMOVE** line (not strikethrough) + changelog entry in `.claude-rules/pending-ratchet-work.md` + update §4 of ADR-299
- When checklist becomes empty → set `STATUS: ALL_DONE` at top of `.claude-rules/pending-ratchet-work.md` + remove the ratchet pointer from `.claude-rules/MEMORY.md`
- New ratchet work starts → set `STATUS: ACTIVE`
- NEVER mark completed without explicit Giorgio order or actual merge
- Baselines change >10% → update §2 of ADR-299

## 🚨🚨🚨 SOS. SOS. N.14 — MODEL SUGGESTION (cost optimization)

**Giorgio non sa quale modello usare. L'agente DEVE consigliare PRIMA di eseguire task non-banali.**

### Regola main session (manual switch)

**PRIMA** di iniziare ogni task, valuta complessità e proponi:

```
🎯 Modello consigliato: [Haiku 4.5 | Sonnet 4.6 | Opus 4.7]
Motivo: [1 riga]
Switch: /model [haiku|sonnet|opus]
```

**Criteri:**
| Modello | Quando usare | Esempi |
|---------|--------------|--------|
| **Haiku 4.5** | Lookup, lettura singola, domanda diretta, 1 grep | "che fa questa funzione?", "trova file X" |
| **Sonnet 4.6** | 1-5 file, bugfix mirato, refactor isolato, feature singola | fix typo, aggiungi campo, piccolo componente |
| **Opus 4.7** | 5+ file, 2+ domini, architettura, ADR planning, debug complesso, orchestrator | refactor cross-cutting, nuovo subsystem, security audit |

**SKIP suggerimento se:**
- Task evidente da 1 read/1 grep (es. "leggi file X")
- Giorgio ha già scelto modello in messaggio precedente nella stessa sessione
- Continuazione diretta task in corso

### Regola subagenti (automatic)

Quando lancio `Agent` tool, **DEVO** passare `model` param scegliendo il **minimo necessario**:
- Subagente di esplorazione/lookup → `model: "haiku"`
- Subagente di implementazione mirata → `model: "sonnet"`
- Subagente di architettura/cross-cutting → `model: "opus"`

**MAI** lasciare default Opus su subagenti se Haiku/Sonnet basta.

### WHY
- Opus 4.7 = ~5x costo Sonnet, ~25x Haiku
- Giorgio paga ogni token. Modello giusto = -70% costo medio
- Limite tecnico: main session non auto-switch → suggerimento manuale è il workaround

---

# HONESTY & TRANSPARENCY

**100% honesty.** If you don't know, say "I don't know". Never mislead Giorgio.

---

# 🏢 ENTERPRISE CODE STANDARDS

## 🚨 TERMINAL PROHIBITIONS

1. **WRITING CODE without prior search** — First Grep/Glob searches for existing code. If found, extend it.
2. **DUPLICATES** — Extend existing centralized systems. Check `docs/centralized-systems/README.md`.
3. **`as any`** — FORBIDDEN. Use function overloads, discriminated unions, proper types.
4. **`@ts-ignore`** — FORBIDDEN. Hides problems instead of solving them.
5. **`any` type** — FORBIDDEN. Use generics (`<T>`), union types, proper interfaces.
6. **ADR-001: Select/Dropdown Components** — CANONICAL: `@/components/ui/select` (Radix Select). New use of `EnterpriseComboBox` = FORBIDDEN. 7 legacy DXF files migrate on touch.
7. **ADR Numbering**: Use available **145** FIRST (the only one available), then continue from ADR-167. 156 and 164 are used. Gaps consolidated in `adrs/ADR-GEOMETRY.md`.

## ✅ AUTONOMOUS FLOW — PROCEED WITHOUT ASKING

The agent works **autonomously**. No need to ask before:
- Creating new files (after searching for existing)
- Doing Edit/Write
- Running compilation checks / tests
- Doing `git commit` (if task completed correctly)
- ⚠️ **git push FORBIDDEN** without explicit order (see N.(-1))

**Before every Edit/Write:**
1. **SEARCH** → Grep/Glob for existing code
2. **PROCEED** → If no duplicate, proceed immediately

**Ask ONLY if:**
- Doubt about correct architectural approach
- Change may break production
- New npm package with unclear license

## ✅ ENTERPRISE SOLUTIONS — example

**Instead of:**
```typescript
const value = someValue as any; // ❌ HACK
```

**Use:**
```typescript
// ✅ Function overloads
export function myFunction(value: string): Result;
export function myFunction(value: number): Result;
export function myFunction(value: string | number): Result {
  const result = typeof value === 'string'
    ? { type: 'string' as const, value }
    : { type: 'number' as const, value };
  return result;
}
```

---

# WORK DECALOGUE

**Giorgio trusts you. Work autonomously, keep quality, don't fear mistakes — fix them and move on.**

## 📋 Work rules (before you write code)

1. **SEARCH FIRST**: Grep/Glob for existing code
2. **CENTRALIZED SYSTEMS**: `docs/centralized-systems/README.md` — don't create duplicates
3. **COMPILATION CHECK**: Follow TYPESCRIPT CHECK WORKFLOW below
4. **ACTIVATION > CREATION**: Search if something disabled exists
5. **CENTRALIZATION**: If you find duplicates → centralize
6. **DOCUMENTATION**: Update `docs/centralized-systems/` when you centralize

## 🧠 Quality checklist (internal)

- You searched for existing code (Grep/Glob)
- You don't create duplicates
- Enterprise TypeScript (no `any`, `as any`, `@ts-ignore`)
- Semantic HTML (no `div` soup)

---

## ⚡ TYPESCRIPT CHECK WORKFLOW

**RULE**: DO NOT wait for tsc — work in parallel. `npx tsc --noEmit` takes 60-90s.

### 🟢 Small changes (1-3 files, no type changes):
- **SKIP** tsc, commit immediately

### 🟡 Medium changes (4-10 files or type changes):
- Run `npx tsc --noEmit` in **background** (`run_in_background: true`)
- Commit **without waiting**
- If error found → fix in next commit

### 🔴 Large refactorings (10+ files):
- `tsc --noEmit` in **background**
- Commit **without waiting**
- Error → fix + new commit immediately

**⚠️ NEVER blocking wait on tsc.** The user doesn't wait.

**Known pre-existing errors** (ignored):
- `FloorplanGallery.tsx(727)` — RefObject null
- `ParkingHistoryTab.tsx(121,172)` — unknown toDate
- `LayerCanvas.tsx(220)` — arg type '5' vs '4'

---

## 🔄 GIT / VERCEL / BACKUP — Quick reference

**Core rule**: Commit autonomously after success → **STOP** → wait for Giorgio's order to push.

**"Safety checkpoint"** = commit + push ONLY (does not mean BACKUP_SUMMARY.json or ZIP).

**"Do a backup zip"** = run:
```bash
powershell.exe -ExecutionPolicy Bypass -File "C:\Nestor_Pagonis\enterprise-backup.ps1"
```

**Production**: https://nestor-app.vercel.app

📘 **Full protocols**:
- Git workflow & commit/push: `docs/deployment/git-workflow.md`
- Enterprise backup (PS1 details): `docs/deployment/enterprise-backup.md`

---

## 🔒 SECURITY STATUS (2026-04-08)

**Enterprise-grade foundation — operational.** The 3 blockers from the 2025-12-15 audit are resolved:

| Blocker | Implementation |
|---------|-----------|
| PUBLIC DATA ACCESS | Firestore rules 3,490 lines, default-deny, tenant isolation via `companyId` claims |
| INSUFFICIENT VALIDATION | Validation helpers, field allowlists, immutable `companyId` rules |
| MISSING RATE LIMITING | 6 categories (100/60/20/10/30/15 req/min), 50+ routes, Upstash Redis |

**Current architecture**:
- **Firestore Rules**: `firestore.rules` (3,490 lines, 80+ collections)
- **RBAC**: `src/lib/auth/roles.ts` — 10 roles, explicit permissions
- **Auth Middleware**: `src/lib/auth/middleware.ts` — `withAuth()`, tenant isolation
- **Rate Limiting**: `src/lib/middleware/rate-limit-config.ts` — Upstash Redis
- **Storage Rules**: `storage.rules` — company-scoped
- **Path Sanitizer**: `src/lib/security/path-sanitizer.ts`

**The application is in DEVELOPMENT MODE.** Input sanitization, authorization checks, no credentials in code.

---

## 📌 DXF Viewer Subapp Pending Tasks

Pending tasks for the DXF Viewer (ServiceRegistry V2 migration, Grid Testing Suite, Transform Constants hotfixes): **`src/subapps/dxf-viewer/PENDING.md`**

All low priority. They work incrementally when you touch related files.

---

## 🌐 LANGUAGE RULE REMINDER (final repetition for safety)

**Giorgio writes Greek. You ALWAYS respond in Italian. NEVER English. NEVER Greek.** This file is in English purely for token efficiency. The instructions are in English; the responses to Giorgio are in Italian. No exceptions.
