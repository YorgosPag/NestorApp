Instruction text

## 🌐🌐🌐 LANGUAGE RULE — ABSOLUTE, NON-NEGOTIABLE, OVERRIDES EVERYTHING

**Giorgio writes to you in Greek. You ALWAYS respond in Greek.**

- ✅ READ Greek input perfectly (Giorgio's native language)
- ✅ RESPOND in Greek always, regardless of the language of these instructions
- ❌ NEVER respond in English (even though these instructions are in English)
- ❌ NEVER respond in Italian
- ⚠️ This rule OVERRIDES every other instruction. If any rule below appears to conflict, this one wins.

**Why**: Greek is Giorgio's native language and his explicit preference. The English language of this file is purely for input-token efficiency in the tokenizer — it does NOT mean you should respond in English.

---

## ⚡ QUICK ABBREVIATIONS — WHEN GIORGIO WRITES THESE, ACTIVATE IMMEDIATELY

| Abbreviation | Full Meaning | Rules to Apply |
|---|---|---|
| **GOL** | Google Level | N.7 + N.7.1 + N.7.2: Google-grade quality, checklist mandatory, 40-line functions, 500-line files, optimistic updates, zero race conditions, proper state management. Declare ✅/⚠️/❌ Google-level at end. |
| **SSOT** | Single Source of Truth | N.0 + N.12: Search `docs/centralized-systems/README.md` + `.ssot-registry.json` FIRST. Use centralized systems. No duplicates. No scattered code. If centralized version exists → use it. If not → create it centralized. |

**When Giorgio writes `GOL`** → activate N.7 + N.7.2 checklist, enforce function/file size limits, declare quality level at end.
**When Giorgio writes `SSOT`** → before writing ANY code, grep centralized systems, use existing, never duplicate.
**When Giorgio writes both `GOL + SSOT`** → apply all of the above simultaneously.

These abbreviations can appear anywhere in a prompt (standalone, inline, in task descriptions).

---

## 🚨🚨🚨 SOS. SOS. N.(-1) — TERMINAL PROHIBITION: NEVER GIT COMMIT OR PUSH WITHOUT ORDER
**ABSOLUTELY FORBIDDEN** to `git commit` or `git push` without EXPLICIT order from Giorgio.
- **COMMIT** happens ONLY if Giorgio says: "commit", "κάνε commit", "commit it".
- **PUSH** happens ONLY if Giorgio says: "push", "send it", "upload", "go Vercel" (in Greek: "push", "στείλε", "ανέβασε", "πήγαινε Vercel").
- DO NOT commit automatically, DO NOT commit "because it's done", DO NOT commit "for convenience".
- DO NOT push automatically, DO NOT push "for convenience", DO NOT push "because it built".
- **WHY commit:** Giorgio decides when work is ready to be committed — not the agent.
- **WHY push:** Each push = Vercel build = credits consumption ($). Giorgio pays.
- **ZERO EXCEPTIONS.** This rule overrides ALL other rules.
- 📘 Full git/push/backup protocol: `docs/deployment/git-workflow.md`

## 🚨🚨🚨 SOS. SOS. N.(-1.1) — TERMINAL PROHIBITION: NEVER `--no-verify`

**ABSOLUTELY FORBIDDEN** to use `git commit --no-verify` or `git push --no-verify`.
- ❌ NEVER `git commit --no-verify` (bypasses pre-commit hook safety checks)
- ❌ NEVER `git push --no-verify` (bypasses pre-push hook safety checks)
- ❌ NEVER `--no-gpg-sign` or `-c commit.gpgsign=false` (disables signing)
- ❌ NEVER any other git bypass flags

**If pre-commit hook FAILS:**
1. **READ** the error message completely
2. **DEBUG** the failing check (run individual checks, check Node.js scripts)
3. **REPORT** the exact error to Giorgio with:
   - What check failed (CHECK number + name)
   - Exact error message
   - Which files trigger it
   - Estimated fix complexity
4. **WAIT** for Giorgio's decision: fix the hook, or skip the specific check with env var

**WHY:** Pre-commit hooks are safety nets. They catch:
- Hardcoded strings, missing i18n keys
- Security violations, GPL dependencies
- Dead code, file size violations
- Architecture regressions (ADR-040 orchestrator subscriptions)

Bypassing them = accepting untested, potentially broken code into the repo.

**INCIDENT:** 2026-05-25 — Agent bypassed hook with `--no-verify` because CHECK 3.17 (entity-audit) was failing. This masked a real bug in the Node.js worker script and let code through without proper validation.

**ZERO EXCEPTIONS.** If hook blocks, something is wrong — either the code or the hook itself. Find out which, then fix it. Never bypass.

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

## 🚨 SOS. SOS. N.0.2 — PROACTIVE CENTRALIZATION (BOY SCOUT RULE)

**DURING EVERY INVESTIGATION** — when reading/grepping code for any task — if you discover duplicate, scattered, or copy-pasted patterns:

### Immediate decision (takes 5 seconds):

| Pattern | Action | When |
|---------|--------|------|
| Small duplicate (< 1h fix, 1-3 files) | **FIX IMMEDIATELY** — before continuing the main task | Always |
| Large duplicate (> 1h, 4+ files) | **ADD TO `.claude-rules/pending-ratchet-work.md`** immediately with: what, where, why, fix | Always |
| Unsure | Add to pending — Giorgio decides priority | Always |

### How to fix a small duplicate:
1. Check if SSoT already exists (grep for the pattern in centralized files)
2. If yes → centralize to existing SSoT
3. If no → create the SSoT method/function FIRST, then centralize
4. Never copy-paste a pattern to N files — always ask "where does this belong?"

### NEVER:
- Wait for Giorgio to ask "is this centralized?"
- Copy-paste a pattern to multiple files when a central method would do
- Leave a discovered duplicate unflagged

**WHY**: Giorgio confirmed 2026-05-19. Root incident: `if (options.grips) renderGrips()` was copy-pasted to 7 BIM renderer files instead of using/creating a `BaseEntityRenderer.finalizeRender()` SSoT. Discovered DURING the fix session, should have been caught and fixed on the spot.

**This rule applies to ALL agents, not just the one who discovered the duplicate.**

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

## SOS. SOS. N.7.2 — GOOGLE-LEVEL ARCHITECTURE CHECKLIST (MANDATORY)

**BEFORE implementing ANY feature/fix**, answer these questions internally:

| # | Question | Google answer |
|---|----------|---------------|
| 1 | Proactive or reactive? | **Proactive** — create data at the right lifecycle moment, not as a side effect |
| 2 | Race condition possible? | **No** — primary path runs before any dependent action |
| 3 | Idempotent? | **Yes** — calling twice = same result, no duplicates |
| 4 | Belt-and-suspenders? | **Yes** — primary path + safety net fallback |
| 5 | Single Source of Truth? | **Yes** — one place owns the data, others read it |
| 6 | Fire-and-forget or await? | **Await** for correctness, fire-and-forget only for non-blocking side effects |
| 7 | Who owns the lifecycle? | **Explicit** — one service/route is responsible, not emergent behavior |

**After implementation, declare explicitly:**
```
✅ Google-level: YES — [one-line reason]
⚠️ Google-level: PARTIAL — [gap description + urgency]
❌ Google-level: NO — [what needs to change]
```

**If PARTIAL or NO** → either fix immediately or open a pending item in `.claude-rules/`.

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

(Note: the indicator text shown to Giorgio must be in Greek, per the LANGUAGE RULE at the top.)

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
| **3.22** | Dead-code Ratchet (knip + smart-skip + Layer 2 CI) | RATCHET | `.deadcode-baseline.json` (8 files) |
| **3.23** | Native HTML Tooltip — `title=` on HTML JSX elements (AST-based) | RATCHET | `.native-tooltip-baseline.json` (63 violations / 48 files) |
| **3.29** | DXF Viewer tsc errors (ADR-663) — hook = baseline smoke only· **CI** = full per-file ratchet | RATCHET | `.dxf-tsc-baseline.json` (381 errors: 117 source / 264 test) |

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

## 🚨🚨🚨 SOS. SOS. N.14 — MODEL ENFORCEMENT (cost optimization)

**MANDATORY STOP before every non-trivial task. NO implementation until model is confirmed.**

### Regola main session — BLOCCO OBBLIGATORIO

**PRIMA** di iniziare ogni task (non-banale), l'agente DEVE:

1. Valutare la complessità del task
2. Dichiarare il modello consigliato
3. **FERMARSI e aspettare conferma** — NON procedere con l'implementazione

Formato obbligatorio:
```
🎯 Modello consigliato: [Haiku 4.5 | Sonnet 4.6 | Opus 4.7]
Motivo: [1 riga]
Switch: /model [haiku|sonnet|opus]
⏸️ In attesa di conferma — rispondi "ok" o switcha il modello prima che proceda.
```

**L'agente NON scrive codice, NON legge file, NON fa grep** finché Giorgio non risponde "ok" / "vai" / "procedi" o conferma il modello.

**Criteri:**
| Modello | Quando usare | Esempi |
|---------|--------------|--------|
| **Haiku 4.5** | Lookup, lettura singola, domanda diretta, 1 grep | "che fa questa funzione?", "trova file X" |
| **Sonnet 4.6** | 1-5 file, bugfix mirato, refactor isolato, feature singola | fix typo, aggiungi campo, piccolo componente |
| **Opus 4.7** | 5+ file, 2+ domini, architettura, ADR planning, debug complesso, orchestrator | refactor cross-cutting, nuovo subsystem, security audit |

**SKIP blocco se:**
- Task è 1 read / 1 grep / risposta diretta senza codice (Haiku implicito)
- Giorgio ha già dichiarato il modello nel messaggio corrente (es. "con Sonnet fai X")
- Continuazione diretta di task già confermato nella stessa sessione
- Giorgio risponde a una domanda dell'agente (non è una nuova implementazione)

### Regola subagenti (automatic)

Quando lancio `Agent` tool, **DEVO** passare `model` param scegliendo il **minimo necessario**:
- Subagente di esplorazione/lookup → `model: "haiku"`
- Subagente di implementazione mirata → `model: "sonnet"`
- Subagente di architettura/cross-cutting → `model: "opus"`

**MAI** lasciare default Opus su subagenti se Haiku/Sonnet basta.

### WHY
- Opus 4.7 = ~5x costo Sonnet, ~25x Haiku
- Giorgio paga ogni token. Modello sbagliato = token sprecati
- L'agente non può auto-switchare → BLOCCO + attesa = unico workaround affidabile

---

## 🚨🚨🚨 SOS. SOS. N.15 — ΑΠΑΓΟΡΕΥΣΗ ΚΑΤΑΓΡΑΦΗΣ ΕΚΚΡΕΜΟΤΗΤΩΝ (καταργήθηκε το tracker)

**ΑΠΑΡΑΒΑΤΟΣ ΚΑΝΟΝΑΣ (Giorgio 2026-06-23): ΠΟΤΕ ΠΛΕΟΝ μην καταγράφεις εκκρεμότητες.**

- ❌ **ΑΠΑΓΟΡΕΥΕΤΑΙ** να γράφεις/ενημερώνεις το `C:\Nestor_Pagonis\local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`
  (παλιά ονομασία `local_ΑΝΑΦΟΡΑ_2.txt`). Το tracker εκκρεμοτήτων **καταργήθηκε**.
- ❌ ΜΗΝ δημιουργείς άλλο αρχείο/λίστα «εκκρεμοτήτων» στη θέση του (ούτε `PENDING`-style, ούτε στο MEMORY).
- ✅ Το υπάρχον αρχείο μένει στον δίσκο ως ιστορικό — **μην το αγγίζεις** (ούτε για διαγραφή γραμμών,
  ούτε για προσθήκη). Αν θες να το σβήσεις, θα το κάνει ο Giorgio.

### Πού ζει πλέον η κατάσταση εργασίας:
- **«Τι έγινε»** → ADR changelog + status header (κανόνας N.0.1 ADR-driven workflow) + git log.
- **Ratchet work** → `.claude-rules/pending-ratchet-work.md` (όταν σχετίζεται με ratchet).
- **Pending/ongoing context** → auto-memory `MEMORY.md` (όταν δεν προκύπτει από κώδικα/git).
- Στο τέλος κάθε task, ενημέρωσε **μόνο** αυτά (ADR/ratchet/MEMORY) — **όχι** tracker εκκρεμοτήτων.

### WHY:
Ο Giorgio αποφάσισε ότι το ξεχωριστό tracker εκκρεμοτήτων δεν προσφέρει — διπλασιάζει πληροφορία που
ήδη ζει σε ADR + git + MEMORY και φούσκωνε. Η κατάσταση παρακολουθείται από εκεί.

---

## 🚨🚨🚨 SOS. SOS. N.16 — COMMIT AGENT PROTOCOL (cost optimization)

**Ο commit agent τρέχει πάντα ως Haiku.** Ο Giorgio ενεργοποιεί χειροκίνητα άλλο μοντέλο αν χρειαστεί.

### Εκτέλεση — χρησιμοποίησε ΠΑΝΤΑ το slash command:

```
/project:commit
```

Το slash command βρίσκεται στο `.claude/commands/commit.md` και περιέχει το πλήρες πρωτόκολλο:
- Χρησιμοποιεί `"C:\Program Files\Git\cmd\git.exe"` (Windows git path — **ΠΟΤΕ** `/usr/bin/git`)
- git status → diff → commit
- Hook PASS → αναφέρει `✅ Commit επιτυχής: [hash] — [message]`
- Hook FAIL → αναφέρει ακριβώς τι απέτυχε + escalation message (βλ. παρακάτω)

### Hook FAIL escalation format:

```
❌ Pre-commit hook απέτυχε

Τι απέτυχε: [αντέγραψε ακριβώς το error output]

Αξιολόγηση:
- Αρχεία που χρειάζονται fix: [λίστα]
- Τύπος fix: [split / refactor / και τα δύο]
- Εκτιμώμενη πολυπλοκότητα: [απλό <1h / σύνθετο >1h]

🎯 Switch σε:
  /model sonnet → αν είναι split 1-3 αρχεία, 1 domain
  /model opus   → αν είναι refactor 2+ domains ή cross-cutting

Μετά το switch πες "προχώρα" και θα κάνω το fix + retry commit.
```

### Κανόνες:
- **Haiku ΔΕΝ κάνει fix** — μόνο αναφέρει
- **Sonnet** = απλά splits, 1-3 αρχεία, 1 domain, <1h
- **Opus** = σύνθετα refactors, 2+ domains, >1h, cross-cutting
- Μετά το fix → retry `/project:commit`
- **ΠΟΤΕ** git commit χωρίς explicit εντολή από Giorgio (N.(-1))
- **ΠΟΤΕ** `git add -A` — μόνο specific files

### WHY:
Giorgio κάνει commits μέσω agent (ποτέ χειροκίνητα). Haiku εξοικονομεί ~5x tokens έναντι Sonnet για απλά commits. Το escalation pattern εξασφαλίζει σωστή ποιότητα χωρίς σπατάλη.

---

## 🚨🚨🚨 SOS. SOS. N.17 — ΑΠΑΓΟΡΕΥΣΗ ΕΛΕΓΧΟΥ TypeScript ΣΦΑΛΜΑΤΩΝ (ΟΧΙ tsc ΑΠΟ ΠΡΑΚΤΟΡΑ)

**ΑΠΑΓΟΡΕΥΕΤΑΙ ΑΠΟΛΥΤΩΣ** ένας πράκτορας να τρέχει έλεγχο TypeScript σφαλμάτων όταν γράφει/αλλάζει κώδικα.
Συγκεκριμένα **ΠΟΤΕ** μην τρέξεις:
- `tsc`, `tsc --noEmit`, `npx tsc`, `npx tsc --noEmit`
- `npm run typecheck` / `type-check` / οποιοδήποτε script κάνει type-check
- οποιαδήποτε άλλη εντολή «ελέγχου σφαλμάτων TypeScript» (foreground **Ή** background, targeted **Ή** full-project)

**Ισχύει για ΟΛΟΥΣ τους πράκτορες, σε ΚΑΘΕ εργασία, ΧΩΡΙΣ ΕΞΑΙΡΕΣΕΙΣ.**

### ΤΙ ΕΠΙΤΡΕΠΕΤΑΙ:
- ✅ Γράψε/άλλαξε κώδικα κανονικά και **ΣΤΑΜΑΤΑ** — μην επικυρώνεις με tsc.
- ✅ Τρέξε **jest tests** (στοχευμένα, γρήγορα) όπου χρειάζεται — αυτά **δεν** απαγορεύονται.
- ✅ Εμπιστεύσου τους τύπους που γράφεις (enterprise TypeScript: όχι `any`/`as any`/`@ts-ignore`).

### ΠΟΙΟΣ ΚΑΝΕΙ ΤΟΝ ΕΛΕΓΧΟ:
- **Ο Giorgio** τρέχει τον έλεγχο TypeScript **ο ίδιος, ανά τακτά χρονικά διαστήματα** — όχι κάθε φορά που γράφεται κώδικας.
- Η type-safety επικυρώνεται επίσης από το **pre-commit hook** την ώρα του commit (που κάνει ο Giorgio).
- ⚠️ **DXF Viewer**: το root `tsconfig.json` **ΕΞΑΙΡΕΙ** το `src/subapps/dxf-viewer/**` — ούτε το `npm run typecheck` ούτε το hook το έβλεπαν ΠΟΤΕ. Αυτό το κενό το καλύπτει πλέον το **CHECK 3.29 στο CI** (ADR-663, per-file ratchet vs `.dxf-tsc-baseline.json`). Άρα ο N.17 ισχύει ακέραιος και για το subapp: ο πράκτορας ΔΕΝ τρέχει tsc — το CI το κάνει.

### WHY:
Κάθε `tsc --noEmit` είναι βαρύς (full type-check, 60-90s, υψηλό CPU/RAM σε αδύναμο PC) και τρέχει σε **κάθε** μικρή αλλαγή → **χάνεται τεράστιος χρόνος**. Τα σφάλματα τύπου που προκύπτουν είναι **πολύ λίγα** και πιάνονται είτε στον περιοδικό έλεγχο του Giorgio είτε στο pre-commit hook. Άρα ο ανά-εργασία έλεγχος από πράκτορα είναι **καθαρή σπατάλη χρόνου**.

**ΖΕΡΟ ΕΞΑΙΡΕΣΕΙΣ. Κάθε πράκτορας πρέπει να γνωρίζει αυτόν τον κανόνα στην αρχή κάθε session.**

---

## 🚨🚨🚨 SOS. SOS. N.18 — ANTI-DUPLICATION SELF-GUARD (jscpd, ADR-584, CHECK 3.28)

**ΠΡΙΝ δηλώσεις «κεντρικοποίηση done» / «τελείωσα το SSoT»**, τρέξε token-based clone check στα ΔΙΚΑ σου staged αρχεία:

```
npm run jscpd:diff <τα staged src αρχεία σου>
```

- ✅ Καθαρό → μπορείς να πεις «done».
- ❌ Βρήκε clone → **ΜΗΝ** το πεις done. Έφτιαξες sibling clone (το κλασικό λάθος: κεντρικοποιείς το Α, γράφεις Β+Γ ως δίδυμα). Εξήγαγε το κοινό σε **ΕΝΑ** module και κάνε import και στα δύο.

**Γιατί υπάρχει (ADR-584):** το `ssot:discover` (CHECK 3.18) είναι name/regex-based → **τυφλό** σε structural clones με άλλο όνομα (π.χ. `clipHatch` vs `clipHatchByPoly`). Το jscpd (token-based, MIT) τα πιάνει **ανεξάρτητα ονόματος, ακόμα και εντός ενός diff**.

**Δύο layers (mirror CHECK 3.22):**
- **Layer 1 — pre-commit (CHECK 3.28, Phase 0.6):** `jscpd --diff` στα staged src αρχεία → ΜΠΛΟΚ σε νέα same-commit sibling clones. Escape: `SKIP_JSCPD_DIFF=1` (justify to Giorgio).
- **Layer 2 — CI (`jscpd-ratchet.yml`):** full `src/` scan → ratchet του συνολικού clone count vs `.jscpd-baseline.json`. Duplication **μόνο μειώνεται**.

**Config SSoT:** `.jscpdrc.json` (min-tokens **50**, formats, ignores). **ΜΗΝ** hardcode-άρεις δεύτερο threshold. **ΜΗΝ** φτιάξεις νέο ratchet engine — υπάρχει `scripts/check-jscpd-ratchet.js` (μιμείται το `check-ssot-discover-ratchet.js`).

**Μετά από νόμιμο de-duplication:** `npm run jscpd:baseline` (κλείδωσε την πρόοδο προς τα κάτω). Baseline: 4548 clones (2026-07-08).

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
7. **ADR Numbering**: Use the next sequential number after the highest existing ADR (currently **ADR-370 = next free** as of 2026-05-20). ⚠️ AVOID ADR-145 — it is already duplicated in 2 files (`ADR-145-super-admin-ai-assistant.md` and `ADR-145-property-types-ssot.md`); do NOT create a third. Other historical gaps (e.g. 162, 163) consolidated in `adrs/ADR-GEOMETRY.md`.

## ✅ AUTONOMOUS FLOW — PROCEED WITHOUT ASKING

The agent works **autonomously**. No need to ask before:
- Creating new files (after searching for existing)
- Doing Edit/Write
- Running compilation checks / tests
- ⚠️ **git commit FORBIDDEN** without explicit order (see N.(-1))
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
3. **COMPILATION CHECK**: ❌ ΜΗΝ τρέχεις `tsc` / έλεγχο TypeScript σφαλμάτων (βλ. N.17 — απαγορεύεται για πράκτορες· jest επιτρέπεται)
4. **ACTIVATION > CREATION**: Search if something disabled exists
5. **CENTRALIZATION**: If you find duplicates → centralize
6. **DOCUMENTATION**: Update `docs/centralized-systems/` when you centralize

## 🧠 Quality checklist (internal)

- You searched for existing code (Grep/Glob)
- You don't create duplicates
- Enterprise TypeScript (no `any`, `as any`, `@ts-ignore`)
- Semantic HTML (no `div` soup)

---

## ⚡ TYPESCRIPT CHECK WORKFLOW — ΑΠΑΓΟΡΕΥΜΕΝΟΣ ΓΙΑ ΠΡΑΚΤΟΡΕΣ (βλ. N.17)

**ΚΑΝΟΝΑΣ**: Ο πράκτορας **ΠΟΤΕ** δεν τρέχει έλεγχο TypeScript σφαλμάτων (`tsc` / `tsc --noEmit` /
`npx tsc` / typecheck scripts) — ούτε foreground, ούτε background, ούτε targeted, ούτε full-project.
Γράψε τον κώδικα και **σταμάτα**. Δες **N.17** για το πλήρες σκεπτικό.

- 🟢🟡🔴 **Όλες οι περιπτώσεις (1, 10 ή 100 αρχεία)** → **ΟΧΙ tsc.** Καμία εξαίρεση.
- ✅ **jest tests** επιτρέπονται (γρήγορα, στοχευμένα) — τρέξ' τα όπου έχει νόημα.
- 🧑‍🔧 Τον έλεγχο TypeScript τον κάνει **ο Giorgio ανά τακτά διαστήματα** + το **pre-commit hook** στο commit.

**WHY**: full type-check = 60-90s σε αδύναμο PC, σε κάθε μικρή αλλαγή = τεράστια σπατάλη χρόνου, ενώ τα
σφάλματα τύπου είναι ελάχιστα και πιάνονται αλλού (περιοδικός έλεγχος Giorgio / pre-commit hook).

---

## 🔄 GIT / VERCEL / BACKUP — Quick reference

**Core rule (aggiornata 2026-05-16)**: **Giorgio fa i commit. Giorgio fa i push.** L'agente NON committa MAI e NON pusha MAI autonomamente — neanche "dopo successo", neanche "per comodità", neanche se il task è finito. L'agente prepara il lavoro (`git add`, `git status`, `git diff` per verifica), poi **si ferma** e aspetta l'ordine esplicito di Giorgio. Vedi N.(-1) per zero-tolerance enforcement.

**Commit/push happen ONLY when Giorgio says** (greco/italiano/inglese):
- Commit: "commit", "κάνε commit", "fai commit", "commit it"
- Push: "push", "στείλε", "ανέβασε", "πήγαινε Vercel", "send it", "upload"

**"Safety checkpoint"** = commit + push ONLY when Giorgio explicitly asks (does not mean BACKUP_SUMMARY.json or ZIP).

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

## 🚨 DXF VIEWER ARCHITECTURE — MANDATORY READ/UPDATE RULE

**BEFORE touching ANY of these files, READ ADR-040:**
`docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md`

**AFTER any architectural change, UPDATE the ADR-040 changelog (same commit).**

### Performance-critical files (micro-leaf subscriber pattern, ADR-040):

| File | Architecture role |
|------|------------------|
| `components/dxf-layout/CanvasSection.tsx` | Orchestrator — MUST NOT subscribe to high-freq stores (Phase XXII.A: uses `useCanvasRefs()` only, reads transform via `getImmediateTransform()` at event time) |
| `components/dxf-layout/CanvasLayerStack.tsx` | Shell — MUST NOT subscribe to high-freq stores (receives transform via Bridge wrapper) |
| `components/dxf-layout/CanvasLayerStackTransformBridge.tsx` | Sole transform subscriber on CanvasSection→Shell path (ADR-040 Phase XXII.A). MUST stay thin — only `useTransformValue()` + pass-through to `<CanvasLayerStack>` |
| `components/dxf-layout/canvas-layer-stack-leaves.tsx` | Micro-leaves — the ONLY subscribers to high-freq stores |
| `canvas-v2/dxf-canvas/dxf-canvas-renderer.ts` | Bitmap cache — invalidation rules in ADR-040 |
| `canvas-v2/dxf-canvas/DxfRenderer.ts` | Entity render pipeline |
| `hooks/state/useGuideActions.ts` | Mutations-only — NO useSyncExternalStore |
| `hooks/state/useGuideState.ts` | Reactive — ONLY for leaf renderers |
| `hooks/canvas/guide-click-handlers.ts` | Click-time reads — MUST use getter, not snapshot |
| `hooks/canvas/useCanvasContextMenu.ts` | Event-time reads — MUST use getter, not snapshot |
| `systems/hover/HoverStore.ts` | Hover SSoT — zero React state |
| `systems/cursor/ImmediatePositionStore.ts` | Cursor SSoT — zero React state |
| `systems/cursor/ImmediateTransformStore.ts` | Transform SSoT — zero React state. Read via `getImmediateTransform()` (event-time) or `useTransformValue()` (leaf subscriber). Sole writer: `useViewportManager.setTransform` + `CanvasContext.setTransform`. `TRANSFORM_CANVAS_IDS` includes `webgl-line-canvas` (ADR-639 Στάδιο 5). |
| `rendering/core/UnifiedFrameScheduler.ts` | RAF orchestrator |
| `canvas-v2/webgl-lines/` (whole folder) | ADR-639 Στάδιο 5 — GPU line layer (z5): `WebglLineLayerManager` (imperative, reads `getImmediateTransform()` at tick time), pure buffer/ortho/LOD helpers, activation+owned-ids store. Persistent `LineSegments2`, camera-matrix-only pan/zoom. |
| `components/dxf-layout/canvas-layer-stack-webgl-line-leaf.tsx` | ADR-639 Στάδιο 5 — thin React leaf for the WebGL line layer. ZERO high-freq `useSyncExternalStore` (transform via tick getter); LOW-freq scene/DPR/content only. Unregister-before-dispose. |
| `canvas-v2/dxf-canvas/dxf-entity-layer-skip.ts` | SSoT layer/isolate/cut-plane skip predicate — shared by `DxfRenderer` (delegates) + the WebGL buffer builder (same question → no gap/double-draw). |

### Cardinal rules (violations cause 60fps re-renders or stale data):

1. **Orchestrators (CanvasSection, CanvasLayerStack) MUST NOT call `useSyncExternalStore`** — push subscriptions to leaves
2. **Event handlers MUST receive `getX: () => store.getX()` getters**, not snapshot values — snapshots become stale when orchestrator skips re-renders
3. **Bitmap cache (dxf-bitmap-cache.ts) MUST NOT include `hoveredEntityId` / `selectedEntityIds` / `gripInteractionState` in its cache key** — causes 60fps full-scene rebuild → FPS 1
4. **Each leaf subscriber renders ≤1 canvas element and calls ≤2 high-frequency hooks**

### Pre-commit checks (BLOCKING):
- **CHECK 6B (BLOCK)**: Modifying micro-leaf architecture files (CanvasSection, DxfRenderer, HoverStore, ImmediatePositionStore, UnifiedFrameScheduler, etc.) **without staging ADR-040** → commit blocked.
- **CHECK 6C (BLOCK)**: `useSyncExternalStore` in `CanvasSection.tsx` / `CanvasLayerStack.tsx` → commit blocked.
- **CHECK 6D (BLOCK)**: Modifying canvas drawing files (entity renderers, DxfCanvas, LayerCanvas, cursor/, hover/, rulers-grid/, snap/, DxfViewerContent, useDxfViewerEffects, useKeyboardShortcuts) **without any ADR/doc staged** → commit blocked.

---

## 📌 DXF Viewer Subapp Pending Tasks

Pending tasks for the DXF Viewer (ServiceRegistry V2 migration, Grid Testing Suite, Transform Constants hotfixes): **`src/subapps/dxf-viewer/PENDING.md`**

All low priority. They work incrementally when you touch related files.

---

## 🌐 LANGUAGE RULE REMINDER (final repetition for safety)

**Giorgio writes Greek. You respond in Greek always. NEVER English. NEVER Italian.** This file is in English purely for token efficiency. The instructions are in English; the responses to Giorgio are ALWAYS in Greek.
