# HANDOFF: ADR-259 Production Readiness — 4 SPECs Implementation

**Ημερομηνία**: 2026-03-23
**Κατάσταση**: Έρευνα + τεκμηρίωση ΟΛΟΚΛΗΡΩΘΗΚΕ. Υλοποίηση κώδικα ΕΚΚΡΕΜΕΙ.

---

## ΤΙ ΕΓΙΝΕ

Ολοκληρώθηκε καθολική έρευνα (code audit) σε 6 κρίσιμα σημεία της εφαρμογής.
Δημιουργήθηκαν 5 αρχεία τεκμηρίωσης — ΚΑΝΕΝΑΣ κώδικας δεν γράφτηκε:

| Αρχείο | Περιεχόμενο |
|--------|------------|
| `docs/centralized-systems/reference/adrs/ADR-259-production-readiness-audit.md` | Master document — 6 ευρήματα με ακριβή file paths και line numbers |
| `docs/centralized-systems/reference/adrs/SPEC-259A-openai-usage-tracking-cost-protection.md` | OpenAI usage tracking, daily cap, cost protection |
| `docs/centralized-systems/reference/adrs/SPEC-259B-firestore-security-hardening.md` | Fix 6 unprotected Firestore collections |
| `docs/centralized-systems/reference/adrs/SPEC-259C-silent-failure-recovery-e2e-test.md` | 5 silent failure fixes + E2E test plan |
| `docs/centralized-systems/reference/adrs/SPEC-259D-error-monitoring-integration.md` | Sentry integration ή lightweight alternative |

---

## ΤΙ ΠΡΕΠΕΙ ΝΑ ΓΙΝΕΙ

### Σειρά εκτέλεσης:

```
SPEC-259A (Cost Protection) ──┐
                               ├──→ SPEC-259C (Silent Failures + E2E) ──→ SPEC-259D (Monitoring)
SPEC-259B (Security Rules)  ──┘
```

**259A και 259B γίνονται παράλληλα, πριν push.**
**259C γίνεται μετά push (χρειάζεται production deployment).**
**259D είναι ανεξάρτητο.**

---

### SPEC-259A: OpenAI Usage Tracking + Cost Protection

**Τι λύνει**: Μηδέν token tracking — cost runaway risk

**Αρχεία που αλλάζουν**:
- `src/services/ai-pipeline/agentic-loop.ts` — Capture `data.usage` από OpenAI response (line ~445 αγνοεί το usage object)
- `src/config/ai-analysis-config.ts` — Pricing constants (gpt-4o-mini: $0.15/1M input, $0.60/1M output)
- `src/services/ai-pipeline/pipeline-orchestrator.ts` — Daily cap check πριν executeAgenticPath(), record usage μετά
- `src/config/firestore-collections.ts` — Νέα collection `AI_USAGE: 'ai_usage'`
- `src/services/enterprise-id.service.ts` — Νέος generator `generateAiUsageId()`
- **ΝΕΟ**: `src/services/ai-pipeline/ai-usage.service.ts` — Usage service (record, check cap, get stats)

**Κρίσιμες αλλαγές**:
1. `callChatCompletions()` (agentic-loop.ts:401-468): Πρέπει να διαβάζει `data.usage` και να το επιστρέφει
2. maxIterations: 8 για customers, 15 για admin (τώρα είναι 15 για ΟΛΟΥΣ — line 108)
3. Daily cap: 50 msg/day per customer (admin unlimited)
4. Auto-cutoff message: "Ξεπεράσατε το ημερήσιο όριο"
5. Firestore document: `ai_usage/{channel}_{userId}_{YYYY-MM}` → daily counters

---

### SPEC-259B: Firestore Security Hardening

**Τι λύνει**: 6 collections χωρίς companyId tenant isolation

**Αρχεία που αλλάζουν**:
- `firestore.rules` — Fix 6 collections
- `src/services/companies.service.ts` — Add WHERE clause (line 78-83)

**6 collections που χρειάζονται fix**:

| Collection | Lines στο firestore.rules | Τι χρειάζεται |
|-----------|--------------------------|---------------|
| notifications | 732-752 | `belongsToCompany(resource.data.companyId)` ή `resource.data.userId == request.auth.uid` |
| tasks | 770-823 | `belongsToCompany(resource.data.companyId)` ή assigned/created by user |
| workspaces | 1341-1368 | `belongsToCompany(resource.data.companyId)` |
| users | 1305-1322 | Own doc ή `belongsToCompany(resource.data.companyId)` |
| companies | 502-520 | `belongsToCompany(companyId)` (doc ID = companyId) |
| system | 1516-1540 | `isCompanyAdminOfCompany(resource.data.companyId)` |

**Helper functions ΗΔΗ υπάρχουν** (lines 3080-3225): `belongsToCompany()`, `isSuperAdminOnly()`, `isCompanyAdminOfCompany()`

**Deploy**: `firebase deploy --only firestore:rules --project pagonis-87766`

---

### SPEC-259C: Silent Failure Recovery + E2E Test

**Τι λύνει**: 5 σημεία όπου ο buyer δεν βλέπει τίποτα χωρίς error message

**Αρχεία που αλλάζουν**:
- `src/app/api/communications/webhooks/telegram/handler.ts` — User-friendly messages (lines 318-320, 360-362, 496-498)
- `src/services/ai-pipeline/tools/agentic-tool-executor.ts` — FAILED_PRECONDITION flag (lines 345-377)
- `src/services/ai-pipeline/pipeline-orchestrator.ts` — linkedUnitIds=[] handling

**5 silent failures**:
1. Contact not recognized → "Δεν σας αναγνωρίσαμε..." (handler.ts:318)
2. linkedUnitIds=[] → "Δεν βρέθηκαν ιδιοκτησίες..." (pipeline-orchestrator.ts)
3. FAILED_PRECONDITION → AI gets "[FALLBACK: unfiltered results]" warning (executor.ts:345)
4. Pipeline enqueue fails → retry once, then "Δοκιμάστε ξανά" (handler.ts:496)
5. Firebase unavailable → "Η υπηρεσία δεν είναι διαθέσιμη" (handler.ts:360)

**E2E test plan** (μετά push): ngrok + dev bot + test contact_link data + 8 test cases (αναλυτικά στο SPEC)

---

### SPEC-259D: Error Monitoring

**Τι λύνει**: Κανένα Sentry — errors χάνονται στα Vercel logs

**Πρόταση**: `@sentry/nextjs` (MIT license ✅, free tier 5K errors/month)

**Αρχεία**:
- **ΝΕΑ**: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- `next.config.ts` — Wrap με `withSentryConfig()`
- `agentic-loop.ts` — `captureException()` on final failure
- `agentic-tool-executor.ts` — `captureMessage()` on FAILED_PRECONDITION
- `handler.ts` — `captureException()` on webhook errors
- `package.json` — Add `@sentry/nextjs`
- Vercel env: `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`

**Εναλλακτική** (αν ο Γιώργος δεν θέλει external service): Lightweight error logging σε Firestore `error_logs` + Telegram notification στον Γιώργο.

---

## GIT STATUS

```
Branch: main
Last commit: 4628a57c — feat(ADR-257): customer AI access control — 7 SPECs (257A-G)
Push status: ΟΧΙ — περιμένει εντολή Γιώργου

Υπάρχουν ΚΑΙ ΑΛΛΕΣ uncommitted αλλαγές:
- ADR-258 (dxf-viewer overlay coloring) — ΔΕΝ σχετίζεται
- ADR-259 + 4 SPECs (τα αρχεία που μόλις δημιουργήθηκαν) — ΜΟΝΟ docs, ΟΧΙ κώδικας
```

---

## ΟΔΗΓΙΕΣ ΓΙΑ ΤΟΝ DEVELOPER AGENT

1. **ΔΙΑΒΑΣΕ ΠΡΩΤΑ** τα 4 SPEC αρχεία — περιέχουν ακριβή file paths, line numbers, before/after code
2. **ΞΕΚΙΝΑ από SPEC-259A** (cost protection) — είναι η πιο κρίσιμη αλλαγή
3. **ΜΗΝ κάνεις push** χωρίς εντολή Γιώργου
4. **ΜΗΝ κάνεις install** νέο package χωρίς license check (MIT/Apache/BSD μόνο)
5. **ADR-driven workflow**: Φάση 1 Plan → Φάση 2 Code → Φάση 3 Update ADR → Φάση 4 Commit
6. **Κώδικας = Source of Truth** — αν ADR λέει κάτι διαφορετικό από τον κώδικα, ο κώδικας κερδίζει
