# ADR-131: Multi-Intent Pipeline — Πολλαπλά Intents σε Ένα Μήνυμα

| Metadata | Value |
|----------|-------|
| **Status** | ✅ IMPLEMENTED |
| **Date** | 2026-02-09 |
| **Category** | AI Architecture / Pipeline Infrastructure |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Supersedes** | — |
| **Related** | ADR-080 (Pipeline Implementation), ADR-169 (Modular AI Architecture), ADR-103 (Operator Briefing) |

---

## 1. Context

### Πρόβλημα

Ένας πελάτης μπορεί να στείλει email που περιέχει **πολλαπλά αιτήματα** σε ένα μήνυμα. Παράδειγμα:

> «Θέλω ραντεβού και ψάχνω στούντιο περίπου 50 τ.μ.»

Πριν από αυτή την αλλαγή, η pipeline αναγνώριζε **μόνο ένα intent** (π.χ. `appointment_request` 85%) και αγνοούσε πλήρως τα υπόλοιπα (π.χ. `property_search`). Αυτό σημαίνει ότι η εταιρεία χάνει αιτήματα πελατών.

### Στόχος

Ένα μήνυμα → **πολλαπλά intents** → **πολλαπλά UC modules** → **ΜΙΑ ενιαία σύνθετη απάντηση**.

---

## 2. Decision

Υιοθετούμε **multi-intent pipeline** — πλήρες refactor σε 4 φάσεις, backward compatible.

### Alternatives Considered

| Εναλλακτική | Γιατί απορρίφθηκε |
|-------------|-------------------|
| **Lightweight wrapper** | Δύο sequential calls στο AI — πιο αργό, πιο ακριβό, δεν εκμεταλλεύεται τη δομή |
| **Split message πριν pipeline** | Ρίσκο λανθασμένου split, απώλεια context μεταξύ μερών μηνύματος |
| **Κανένα — μόνο primary** | Χάνονται αιτήματα πελατών — μη αποδεκτό |

---

## 3. Architecture

### 3.1 AI Schema — Multi-Intent Detection

**Νέο OpenAI schema** (`AI_MULTI_INTENT_SCHEMA`) αντικαθιστά το `AI_MESSAGE_INTENT_SCHEMA`:

```
primaryIntent: { intentType, confidence, rationale }
secondaryIntents: [{ intentType, confidence, rationale }, ...]
```

- Κάθε intent παίρνει δικό του confidence score (0.0-1.0)
- `secondaryIntents` κενό array αν υπάρχει μόνο 1 intent
- System prompt ενημερωμένο με MULTI-INTENT RULES

**Αρχείο**: `src/config/ai-analysis-config.ts`

> **ADR-145 Extension (2026-02-09)**: Admin commands χρησιμοποιούν `AI_ADMIN_COMMAND_SCHEMA` — ίδια δομή με `AI_MULTI_INTENT_SCHEMA` αλλά με `EXTRACTED_ADMIN_ENTITIES_SCHEMA` (14 πεδία αντί 5) ώστε τα admin-specific entities (recipientName, emailContent, contactName κλπ.) να μη γίνονται stripped από το OpenAI strict mode.

### 3.2 Zod Validation — MultiIntentAnalysisSchema

Νέο μέλος στο discriminated union `AIAnalysisResultSchema`:

```
kind: 'multi_intent' → MultiIntentAnalysisSchema
kind: 'message_intent' → MessageIntentAnalysisSchema (legacy, backward compat)
kind: 'document_classify' → DocumentClassifyAnalysisSchema
```

**Αρχείο**: `src/schemas/ai-analysis.ts`

> **ADR-145 Extension (2026-02-09)**: `ExtractedEntitiesSchema` χρησιμοποιεί `.passthrough()` ώστε admin-specific πεδία (από `EXTRACTED_ADMIN_ENTITIES_SCHEMA`) να περνούν Zod validation χωρίς αφαίρεση.

### 3.3 Pipeline Types — DetectedIntent + UnderstandingResult

```typescript
interface DetectedIntent {
  intent: PipelineIntentTypeValue;
  confidence: number; // 0-100
  rationale: string;
}

interface UnderstandingResult {
  // Backward compatible (primary intent)
  intent: PipelineIntentTypeValue;
  confidence: number;
  rationale: string;
  // NEW: All detected intents
  detectedIntents: DetectedIntent[];
  // ... υπόλοιπα πεδία αμετάβλητα
}
```

**Αρχείο**: `src/types/ai-pipeline.ts`

### 3.4 Multi-Intent Router

**Νέα μέθοδος** `routeMultiple()` στο `IntentRouter`:

```typescript
interface MultiRoutingResult {
  primaryRoute: IntentRoutingResult;
  secondaryRoutes: IntentRoutingResult[];
  allModules: IUCModule[];
  needsManualReview: boolean;
  allAutoApprovable: boolean;
}
```

- Secondary intents κάτω από `SECONDARY_INTENT_THRESHOLD` (50%) αγνοούνται
- Deduplicated modules (αν 2 intents → ίδιο module, τρέχει 1 φορά)

**Αρχείο**: `src/services/ai-pipeline/intent-router.ts`

### 3.5 Module Registry — Multi-Lookup

**Νέα μέθοδος** `getModulesForIntents()`:

```typescript
getModulesForIntents(intents: PipelineIntentTypeValue[]): IUCModule[]
```

Deduplicated, ordered by input order (primary first).

**Αρχείο**: `src/services/ai-pipeline/module-registry.ts`

### 3.6 Orchestrator — Multi-Module Flow

```
INTAKE → UNDERSTAND → routeMultiple() →
  stepMultiLookup() → stepMultiPropose() → composeProposal() →
  stepApproveMulti() → stepMultiExecute() → ACKNOWLEDGE
```

| Μέθοδος | Ρόλος |
|---------|-------|
| `stepMultiLookup()` | Τρέχει `lookup()` σε κάθε module, αποθηκεύει σε `multiLookupData` |
| `stepMultiPropose()` | Τρέχει `propose()` σε κάθε module, κάθε module βλέπει τα δικά του lookup data |
| `composeProposal()` | Συνθέτει N proposals σε 1 (merge actions, summaries, approvals) |
| `stepApproveMulti()` | Auto-approve μόνο αν ΟΛΑ τα modules είναι auto-approvable |
| `stepMultiExecute()` | Εκτελεί ΟΛΑ τα modules, κάθε module βλέπει τα σωστά lookup data |
| `resolveModulesForExecution()` | Για `resumeFromApproval()` — βρίσκει modules από `contributingModules` |

**Single-module shortcut**: Αν 1 module, zero overhead — `composeProposal()` επιστρέφει as-is.

**Error handling**: Primary module failure = fatal. Secondary module failure = logged, skipped.

**Αρχείο**: `src/services/ai-pipeline/pipeline-orchestrator.ts`

### 3.7 PipelineContext Extension

```typescript
interface PipelineContext {
  // NEW
  multiLookupData?: Record<string, Record<string, unknown>>;
  contributingModules?: string[];
  // ... υπόλοιπα αμετάβλητα
}
```

### 3.8 Composite Reply Generator

`generateCompositeReply()` — Ενοποιεί N μερικές απαντήσεις σε 1 ενιαία email:

- Single reply → zero overhead (pass-through)
- Multi reply → OpenAI call με dedicated COMPOSITE_REPLY_SYSTEM_PROMPT
- Fallback → concatenation αν AI αποτύχει

**Αρχείο**: `src/services/ai-pipeline/shared/ai-reply-generator.ts`

### 3.9 Operator Inbox UI — Multi-Intent Display

- **Badge**: "2 intents detected" στο AI Understanding section
- **Primary/Secondary** labels με ξεχωριστά confidence scores
- **Υπάρχουσα λογική** actions/draft editing δουλεύει ήδη (`.map()` στα suggestedActions)

**Αρχείο**: `src/components/admin/operator-inbox/ProposalReviewCard.tsx`

---

## 4. Configuration

| Parameter | Value | Location |
|-----------|-------|----------|
| `SECONDARY_INTENT_THRESHOLD` | 50 | `ai-pipeline-config.ts` |
| `AUTO_APPROVE_THRESHOLD` | 90 | `ai-pipeline-config.ts` |
| `MANUAL_TRIAGE_THRESHOLD` | 60 | `ai-pipeline-config.ts` |
| `QUARANTINE_THRESHOLD` | 30 | `ai-pipeline-config.ts` |

---

## 5. Backward Compatibility

| Στοιχείο | Συμπεριφορά |
|----------|-------------|
| `UnderstandingResult.intent` | = primary intent (αμετάβλητο) |
| `UnderstandingResult.confidence` | = primary confidence (αμετάβλητο) |
| Single-intent messages | `detectedIntents` = 1 element → same flow |
| `route()` | Δεν αλλάζει — νέα `routeMultiple()` |
| `getModuleForIntent()` | Δεν αλλάζει — νέα `getModulesForIntents()` |
| Legacy `message_intent` AI responses | Handled by `mapAIResultToUnderstanding()` |
| Existing UC modules | **Δεν χρειάζονται αλλαγές** |

---

## 6. Files Changed

| # | Αρχείο | Αλλαγή |
|---|--------|--------|
| 1 | `src/config/ai-analysis-config.ts` | `AI_MULTI_INTENT_SCHEMA` + `MULTI_INTENT_SYSTEM` prompt |
| 2 | `src/schemas/ai-analysis.ts` | `MultiIntentAnalysisSchema` + `DetectedIntentSchema` + `isMultiIntentAnalysis()` |
| 3 | `src/types/ai-pipeline.ts` | `DetectedIntent` + `detectedIntents[]` + `multiLookupData` + `contributingModules` |
| 4 | `src/services/ai-analysis/providers/OpenAIAnalysisProvider.ts` | Χρήση `AI_MULTI_INTENT_SCHEMA` |
| 5 | `src/services/ai-pipeline/pipeline-orchestrator.ts` | Multi-module flow (6 νέες μέθοδοι) |
| 6 | `src/services/ai-pipeline/module-registry.ts` | `getModulesForIntents()` |
| 7 | `src/services/ai-pipeline/intent-router.ts` | `routeMultiple()` + `MultiRoutingResult` |
| 8 | `src/config/ai-pipeline-config.ts` | `SECONDARY_INTENT_THRESHOLD` |
| 9 | `src/services/ai-pipeline/shared/ai-reply-generator.ts` | `generateCompositeReply()` |
| 10 | `src/components/admin/operator-inbox/ProposalReviewCard.tsx` | Multi-intent UI badges |
| 11 | `src/i18n/locales/el/admin.json` | Νέα κλειδιά `multiIntent.*` |
| 12 | `src/i18n/locales/en/admin.json` | Νέα κλειδιά `multiIntent.*` |

---

## 7. Verification

1. `npx tsc --noEmit` → 0 errors ✅
2. Email με 1 intent → ίδια ροή (backward compat)
3. Email με 2 intents → αναγνώριση, 2 modules, composite reply
4. Operator Inbox → πολλαπλά badges, πολλαπλά actions
5. Approve → εκτέλεση ΟΛΩΝ των actions
