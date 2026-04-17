# ADR-310 — AI Property Description Generator

| Field | Value |
|-------|-------|
| **Status** | ✅ IMPLEMENTED |
| **Date** | 2026-04-17 |
| **Category** | AI Pipeline / Property Details |
| **Canonical Location** | `src/services/ai/` + `src/app/api/properties/[id]/generate-description/route.ts` |

---

## 1. Problem

Property records in the "Ταυτότητα Μονάδας" section have a free-text "Περιγραφή" field used for marketing copy (placeholder `"Προσθέστε περιγραφή για τη μονάδα..."`). Admins previously wrote every description by hand, even though the rest of the property record already carries rich structured data (type, area, floor, layout, heating/cooling, orientation, energy class, finishes, features, linked spaces, commercial status).

**Pain point**: for each unit the admin re-types the same patterns ("modern apartment, 2nd floor, A+ energy class, parking included"). Time-consuming and inconsistent across units.

---

## 2. Decision

Add a one-shot AI generator callable from the edit form. User clicks "Δημιουργία με AI" next to the description field → a preview dialog opens → OpenAI (`gpt-4o-mini`) writes a 2-4 sentence Greek description from the structured property data → user edits / accepts / regenerates → text lands in the form state, saved through the existing property mutation pipeline (which keeps field locking and audit trail ADR-195 intact).

**Why not agentic loop (ADR-171)?** Over-engineered. No tool calls, no iteration, no RBAC-aware schema. One system prompt + one user prompt + one `generateText()` call.

**Why preview dialog, not direct overwrite?** Marketing text is creative. Admins need to see and edit before committing. Avoids accidental overwrite of existing descriptions.

---

## 3. Architecture

Four layers, each respecting the relevant SSoT:

| Layer | Path | SSoT anchor |
|------|------|------------|
| Config (prompt + tokens + temp) | `src/config/ai-analysis-config.ts` (`AI_ANALYSIS_PROMPTS.PROPERTY_DESCRIPTION_SYSTEM`, `AI_COST_CONFIG.LIMITS.PROPERTY_DESCRIPTION_*`) | All AI prompts centralized (ADR-294) |
| OpenAI provider | `src/services/ai/openai-provider.ts` | Extracted from `vercel-ai-engine.ts`. New SSoT module in `.ssot-registry.json` — `createOpenAI(` outside allowlist blocked |
| Prompt builder + service | `src/services/ai/property-prompt-builder.ts`, `src/services/ai/property-description-generator.service.ts` | Enum labels read from `src/i18n/locales/{el,en}/properties-enums.json` — zero duplicate label maps |
| API route | `src/app/api/properties/[id]/generate-description/route.ts` | `withAuth` + `withStandardRateLimit` + tenant isolation on `companyId` |
| UI | `src/hooks/usePropertyDescriptionGenerator.ts` + `src/features/property-details/components/PropertyDescriptionAIDialog.tsx` + integration in `PropertyFieldsEditForm.tsx` | shadcn `Dialog` primitive, `Textarea`, `Button` |
| i18n | `src/i18n/locales/{el,en}/properties-detail.json` | New `fields.identity.aiGenerateButton`/`aiGenerateTooltip` + `aiDescriptionDialog.*` namespace |

---

## 4. Prompt Design

**System prompt** (`PROPERTY_DESCRIPTION_SYSTEM`) enforces:
- 2-4 sentences, 60-140 words
- Professional tone, no clichés ("μοναδική ευκαιρία", "όνειρο" banned)
- **No fabrication**: AI uses only data that was provided
- No price / commercial details in marketing copy (admin decides separately)
- Greek-only output (no English words)
- No opening with "Αυτή η μονάδα..." / "Το ακίνητο..." — start with type + key attribute

**User prompt** (`buildPropertyUserPrompt`) serializes the property into a labelled list. Enum values resolve through the i18n locale JSON (`properties-enums.json`) — the exact same source used by the read-only UI labels. Changing a label there automatically propagates to AI prompts.

Example output (property: 85m² apartment, 2nd floor, A+ energy, oak floor, parking):

> Μοντέρνο διαμέρισμα 85 τ.μ. στον 2ο όροφο, σε εξαιρετική κατάσταση. Διαθέτει δύο υπνοδωμάτια, δύο μπάνια και ένα WC, με αυτόνομη θέρμανση και σπλιτ κλιματιστικά. Ενεργειακή κλάση Α+, δρύινα δάπεδα, αλουμινένια κουφώματα με διπλά τζάμια. Συνοδεύεται από μία θέση στάθμευσης.

---

## 5. Security

| Concern | Mitigation |
|--------|-----------|
| Unauthenticated access | `withAuth()` with `properties:properties:update` permission |
| Cross-tenant leak | API re-reads property from Firestore server-side and compares `companyId` to `ctx.companyId` — rejects 403 on mismatch |
| Abuse / cost overrun | `withStandardRateLimit` (60 req/min) + `maxOutputTokens=300` + 30s timeout |
| Prompt injection via property data | Property data appears only in the user prompt; system prompt enforces "do not invent features". Field values are plain strings — no executable content |
| Write to wrong field | API returns text only. Client writes to form state → user reviews → saved via existing mutation pipeline with field-locking policy |

---

## 6. Cost

| Item | Value |
|-----|------|
| Model | `gpt-4o-mini` (`$0.15` / 1M input, `$0.60` / 1M output) |
| Typical prompt size | ~500 input tokens, ~150 output tokens |
| Typical cost | ~$0.0001–0.001 per generation |
| 100 generations/day | ~$0.03 /day |

Temperature `0.7` — creative but consistent.

---

## 7. SSoT Impact

New module registered in `.ssot-registry.json` (Tier 2 Security):

```json
"openai-provider": {
  "ssotFile": "src/services/ai/openai-provider.ts",
  "forbiddenPatterns": ["createOpenAI\\s*\\("],
  "allowlist": ["src/services/ai/openai-provider.ts"]
}
```

`vercel-ai-engine.ts` updated to import the shared provider — zero duplicate singletons.

---

## 8. Verification

- Type check: `npx tsc --noEmit` (background, non-blocking)
- SSoT audit: `npm run ssot:audit` — expect 0 new violations
- i18n audit: `npm run i18n:audit` — expect baseline unchanged
- Manual: navigate to a property detail tab Πληροφορίες → edit mode → click "Δημιουργία με AI" → verify dialog + output + accept/regenerate
- Audit trail: save the description after accepting → confirm `entity_audit_trail` row records the diff

---

## 9. Changelog

| Date | Change |
|------|--------|
| 2026-04-17 | Initial — feature implemented end-to-end. Prompt SSoT, OpenAI provider SSoT, tenant-isolated API, preview-dialog UX, audit trail via existing mutation pipeline. |
