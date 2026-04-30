# ADR-336 — Quote Signatory Auto-Resolution & Vendor Relationship

**Status:** IMPLEMENTED
**Date:** 2026-04-30
**Author:** Giorgio Pagonis
**Related:** ADR-327 (procurement), ADR-080 (AI pipeline), ADR-171 (autonomous agent), `src/services/contact-relationships/`

---

## Context

When the AI agent analyzes a procurement quote PDF (e.g. `QT-0008` from THERMOLAND), the footer often contains a **signatory / sales rep** identity:

> Υπεύθυνος Πωλητής
> Δολμές Γεώργιος
> Διπλ. Μηχανολόγος Μηχανικός Α.Π.Θ.
> 6979552020

Today the AI extraction schema (`RawExtractedQuote` in `src/subapps/procurement/services/external/quote-analyzer.schemas.ts`) captures **only company-level** vendor info (`vendorName`, `vendorPhone`, `vendorEmails`, `vendorAddress`, `vendorVat`). The human signing the offer is **not** extracted, **not** materialized as an `IndividualContact`, and **no relationship** is created between the legal entity (Thermoland) and the natural person (Δολμές Γεώργιος).

The objective: extend the pipeline so that — when the AI extracts a signatory with sufficient confidence — the system:

1. Extracts signatory fields (firstName, lastName, role, profession, mobile, email).
2. Resolves an existing `IndividualContact` OR creates a new one.
3. Creates a `contact_relationships` edge between the vendor (CompanyContact) and the signatory (IndividualContact) with a typed role (e.g. `representative`, `employee`, `vendor`).

## What already exists (reuse — do not duplicate)

| Building block | File / Module |
|---|---|
| AI extraction (OpenAI structured outputs + per-field confidence) | `src/subapps/procurement/services/external/openai-quote-analyzer.ts` + `quote-analyzer.schemas.ts` |
| Contact types `individual | company | service` | `src/types/contacts/contracts.ts` |
| `IndividualContact` with `firstName/lastName/profession/employer/mobile` | same file (lines 91–170) |
| `contact_relationships` collection + service | `src/services/contact-relationships/ContactRelationshipService.ts` |
| 30+ relationship types (employee / representative / sales_rep / manager / etc.) | `src/types/contacts/relationships/core/relationship-types.ts` |

## Gap

| Item | State |
|---|---|
| AI schema captures signatory | ❌ absent |
| Resolver "find-or-create" individual contact from quote | ❌ absent |
| Auto-create vendor↔signatory relationship | ❌ absent |
| UI surface (review panel) for signatory override | ❌ absent |

## Open design questions (filled iteratively in dialog)

To be answered one at a time. Each answer is appended below as it arrives.

### Q1 — Match logic for natural person

**Initial proposal (rejected):** lookup priority `mobile` → `email` → `firstName + lastName + employerId`. Single-field match.

**Giorgio's concern:** A phone number can be reassigned (employee leaves company → new employee gets the same line). Single-field matching on `mobile` would attribute the phone to the wrong person.

**Final decision (2026-04-30):** **Multi-field cross-check — at least 2 fields must agree simultaneously.** Single-field match never auto-links.

**STRONG MATCH (auto-link, no confirmation):**
- `vatNumber` (ΑΦΜ) of the natural person, when present in the quote (rare — most quotes show only company VAT). Unique by definition.
- `mobile` **AND** `firstName + lastName` both equal.
- `email` **AND** `firstName + lastName` both equal.
- `firstName + lastName` **AND** `employerId (companyId of vendor)` **AND** `profession` all equal.

**WEAK MATCH (single field hits, ask user):**
- Only `mobile` equal but name differs → modal: "Found existing contact with this mobile under different name. Same person now? [Yes / No, create new / Defer]"
- Only `email` equal → same modal pattern.
- Only `firstName + lastName` equal but employer differs → "Same person who changed jobs?"

**NO MATCH:** create a fresh `IndividualContact` with all extracted data.

**Why this works (Google-level rationale):**
- Strong match requires **identity-grade pairs** (something stable + something individual). Mobile alone is not stable enough; name alone is not individual enough; combo is.
- Weak match preserves data quality by **flagging suspicious overlaps for human review** instead of silently merging.
- Reassigned-phone scenario (Giorgio's example): old contact "Νίκος Παπαδόπουλος / 6979552020 / Thermoland" + new offer "Δολμές Γεώργιος / 6979552020 / Thermoland" → mobile alone matches, but full name differs → falls into WEAK MATCH bucket → user sees the conflict and decides → never auto-attributes the phone to the wrong name.

**Implementation note:** the resolver returns a `MatchResult = { kind: 'strong', contactId } | { kind: 'weak', candidates: [...] } | { kind: 'none' }`. UI handles each kind explicitly.

**Giorgio's answer:** ✅ ΝΑΙ ΣΥΜΦΩΝΩ (2026-04-30)

### Q2 — Confidence threshold (revised after Q3 dialog)

**Initial decision (rejected after Q3 clarification):** silent auto-persist when confidence ≥85%.

**Final decision (2026-04-30, post Q3):** **Never silent auto-persist.** The system always surfaces a button the user clicks to commit. Confidence only controls the **button color/copy + which fields are pre-filled**, never whether persistence happens.

| Confidence | Field state | Commit button |
|---|---|---|
| **≥ 85%** (high) | Pre-filled in proposal panel, green border. | Active green button: «Καταχώρηση επαφής + σχέσης» |
| **60–84%** (medium) | Pre-filled, yellow border, hint to review. | Active yellow button: «Επιβεβαίωσε & καταχώρησε» |
| **< 60%** (low) | Empty field, red border with PDF excerpt highlighted. | Inactive until user types value manually |

**Why this works (Google-level rationale):**
- Mirrors the existing **button-driven vendor flow** Giorgio confirmed works well (no silent vendor auto-create — user clicks "αλλάξε σε Thermoland"). UX consistency.
- Confidence band drives **UX guidance**, not **persistence policy**. Persistence is always user-initiated → zero risk of silent wrong writes.
- Per-field bands still apply: a quote can have mobile at 95% (green) but profession at 68% (yellow) → user reviews only the yellow field before clicking commit.
- Aligns with ADR-333 `QuoteEditMode` color coding (green/yellow/red borders) — consistent mental model.

**Implementation note:** thresholds live as named constants in a single SSoT module:
```ts
// src/subapps/procurement/services/signatory-confidence.ts
export const SIGNATORY_CONFIDENCE_HIGH = 85;
export const SIGNATORY_CONFIDENCE_MEDIUM = 60;
```
Re-used by extraction service + UI panel — never hardcoded.

**Giorgio's answer:** ✅ ΝΑΙ ΣΥΜΦΩΝΩ (2026-04-30) — refined post-Q3 to button-driven commit.

### Q3 — Vendor company auto-create + signatory commit pattern

**Clarification (2026-04-30):** The vendor company is **not** auto-created today. The current UX shows a button «αλλάξε σε Thermoland» that the user clicks to apply the AI suggestion. This pattern has worked well in production.

**Final decision (2026-04-30):** **Same button-driven pattern for the signatory.** No silent auto-create — for either the vendor company or the signatory.

- Vendor company: **leave as-is** (button-driven, user clicks to apply).
- Signatory + relationship: **new feature, same pattern** — AI proposes, user clicks one button to commit (with the confidence-coded UI from Q2 revised).
- Goal stated by Giorgio verbatim: «αυτό που με ενδιαφέρει πάνω απ' όλα είναι το σωστό αποτέλεσμα.» Number of files / scope is secondary; correctness is the only constraint.

**Why this works (Google-level rationale):**
- Reuses a UX the user trusts and has battle-tested. Lowest risk of regression on the working vendor flow.
- One commit-button per derived entity (signatory, vendor) gives the user a transparent audit checkpoint — no surprises post-extraction.
- Maintains the principle: **AI proposes, human decides.** The system never silently writes a contact or relationship.
- Implementation simplifies: no need to revise the `/api/quotes/scan` contract (still requires `vendorContactId`); we add a separate post-extraction surface for the signatory.

**Implementation surface (V1 scope):**
1. AI extraction populates `extractedData.signatory` (no DB writes from extraction itself).
2. Quote review panel renders a **«Πρόταση υπεύθυνου πωλητή»** card with the extracted fields (color-coded per confidence).
3. Card has one primary button: «Καταχώρηση επαφής + σχέσης» that:
   - Runs the multi-field resolver (Q1) → strong / weak / none.
   - On strong match → links existing contact + creates relationship → toast success.
   - On weak match → opens disambiguation modal (Q1: "same person / different person / defer").
   - On no match → creates new `IndividualContact` + relationship → toast success.
4. Until the button is clicked, **no contact + no relationship are persisted**. The quote itself saves normally.

**Giorgio's answer:** ✅ Βάσει εμπειρίας: button-driven, ίδιο pattern με την εταιρεία. Σωστό αποτέλεσμα > λιγότερα αρχεία. (2026-04-30)

### Q4 — Relationship type taxonomy: self-extending with auto-normalization & auto-reverse

**Final decision (2026-04-30):** Self-extending taxonomy. AI suggests a type from the existing 30+ registry (`src/types/contacts/relationships/core/relationship-types.ts`); when no good match exists, the user types a new label and the system permanently extends the registry, **but with safeguards**:

**1. Auto-normalization (anti-duplicate)** — before persisting a new type the system normalizes the label:
- lowercase
- strip Greek + Latin diacritics
- trim + collapse whitespace
- Then looks up existing types by normalized key. If a near-match exists, prompt: *«Υπάρχει ήδη το «X». Να το χρησιμοποιήσω;»* with [Use existing] / [Create anyway] buttons. Default: use existing.

**2. Auto-reverse type (zero-friction UX)** — every relationship is bidirectional. When the user creates `Δολμές → υπεύθυνος προμηθειών → Thermoland`, the reverse view (`Thermoland → ??? → Δολμές`) must exist too.
- AI suggests the reverse from a heuristic table (employment-class → `εργοδότης`, customer-class → `πελάτης`, etc.).
- The reverse field is shown collapsed under «προχωρημένα ▾» — user only sees one input by default. Single-click commit.
- 95% of cases the AI suggestion is correct; the disclosure stays out of the user's way.

**3. Auto-translation** — el label is the canonical input; en label is auto-generated (OpenAI translation pass) at create time and stored alongside. User can edit later from Settings. No prompt at create time.

**4. Auto-category** — AI classifies the new type into one of the existing `RelationshipCategory` buckets defined by `src/types/contacts/relationships/core/relationship-metadata.ts` — namely `employment | ownership | government | professional | personal | property`. Default fallback when uncertain: `professional` (most common for B2B custom relationships introduced via quote signatories).

**5. Permission scope** — V1: all authenticated users may extend the registry. Admin-only restriction is deferred (separate ADR if needed).

**Why this works (Google-level rationale):**
- One input, one button, one click. Matches Giorgio's «σωστό αποτέλεσμα» principle: every decision is yours, but the system handles plumbing.
- The normalization layer prevents the registry from drifting into 200 near-duplicates over 6 months — the failure mode of every uncurated taxonomy.
- Auto-reverse + auto-translate + auto-category are *high-confidence inferences* the AI can make from a single string. Surfacing them to the user adds friction without value (proven UX pattern: HubSpot tags, Notion select fields, Salesforce custom picklists).
- The «προχωρημένα ▾» escape hatch preserves user agency for the 5% edge cases without polluting the default flow.

**Implementation surface:**
- `relationship-types.ts` registry becomes a Firestore collection (`contact_relationship_type_registry`) seeded with the current 30+ static types. Reads cached client-side.
- New helper `findOrCreateRelationshipType(label, ctx)` does the normalize → match → create flow atomically.
- UI: small modal embedded in the signatory commit panel from Q3, with collapsible «προχωρημένα ▾» disclosure for the reverse type.

**Giorgio's answer:** ✅ ΝΑΙ ΣΥΜΦΩΝΩ (2026-04-30) — auto-normalization mandatory, auto-reverse default with disclosure escape hatch.

### Q5 — Metadata defaults for dynamic types (Phase 1 Recognition follow-up)

**Context:** ADR-318 established `RELATIONSHIP_METADATA` (`src/types/contacts/relationships/core/relationship-metadata.ts`) as SSoT for type semantics. Every static type carries:
- `category: RelationshipCategory`
- `derivesWorkAddress: 'always' | 'optional' | 'never'`
- `isEmployment / isOwnership / isGovernment / isProperty: boolean`
- `allowedFor: ContactType[]`

When a user creates a custom type via Q4's self-extending registry, these metadata fields MUST be populated — otherwise `useDerivedWorkAddresses`, type-collection helpers (`EMPLOYMENT_RELATIONSHIP_TYPES`, etc.), and ContactType validation all break.

**Final decision (2026-04-30, Phase 1 Recognition):**

| Field | Default for dynamic type | Rationale |
|---|---|---|
| `category` | AI auto-classify (Q4 §4) → fallback `professional` | Most B2B signatory relationships are professional. |
| `derivesWorkAddress` | `'optional'` | User may flag the relationship as workplace via `ContactRelationship.isWorkplace=true`. Avoids automatic work-address inflation on every custom type. |
| `isEmployment` | derived: `true` iff `category === 'employment'` | Boolean flags follow category — preserves the invariant in `relationship-metadata.ts`. |
| `isOwnership` | derived: `true` iff `category === 'ownership'` | — |
| `isGovernment` | derived: `true` iff `category === 'government'` | — |
| `isProperty` | derived: `true` iff `category === 'property'` | — |
| `allowedFor` | `['company', 'service']` for `employment | ownership | government | professional`; `['individual', 'company', 'service']` for `personal | property` | Mirrors static-registry convention; permissive enough for legit use, strict enough that an obviously personal type doesn't get attached to a company. |

**Implementation note:** `findOrCreateRelationshipType()` constructs the full metadata block from the AI-inferred category + the rules above and persists it in Firestore alongside the label. Reads cache the metadata client-side along with the type list.

**Why this works (Google-level rationale):**
- Conservative: never auto-derives a work-address (always opt-in via `isWorkplace`) → zero risk of inflating the contact's address book whenever a user invents a custom type.
- Preserves invariants: derived boolean flags stay consistent with `category`, so `EMPLOYMENT_RELATIONSHIP_TYPES`-style filtering keeps working without code changes.
- `allowedFor` defaults are permissive enough not to block legitimate use, strict enough that an obviously personal type like `friend` doesn't get attached to a `company`.

**Giorgio's answer:** ✅ ΝΑΙ — implicit acceptance via «ok» on Phase 2 kickoff (2026-04-30). Defaults can be overridden per-type in a follow-up Settings UI if needed.

---

## Final consolidated scope (V1)

After all four answers:

### Files to create
1. `src/subapps/procurement/services/external/quote-analyzer.schemas.ts` — extend `RawExtractedQuote` with `signatory: { firstName, lastName, role, profession, mobile, email }` + parallel confidence object. Extend Greek prompt to extract footer "Υπεύθυνος ..." block.
2. `src/subapps/procurement/types/quote.ts` — extend `ExtractedQuoteData` with `signatory` field.
3. **NEW** `src/subapps/procurement/services/signatory-confidence.ts` — `SIGNATORY_CONFIDENCE_HIGH` / `SIGNATORY_CONFIDENCE_MEDIUM` constants (SSoT).
4. **NEW** `src/services/contacts/signatory-resolver.ts` — multi-field match-or-create resolver returning `MatchResult = { kind: 'strong', contactId } | { kind: 'weak', candidates } | { kind: 'none' }`.
5. **NEW** `src/services/contact-relationships/relationship-type-registry.ts` — Firestore-backed registry with `findOrCreateRelationshipType(label, reverseLabel?, ctx)` + normalization helpers + AI reverse inference + AI translation.
6. **NEW** Migration script — seed `contact_relationship_type_registry` collection with the existing 30+ static types from `relationship-types.ts`.
7. **NEW** API route `POST /api/quotes/[id]/commit-signatory` — orchestrates resolver → relationship type registry → contact + relationship creation. Idempotent.
8. **NEW** UI component `SignatoryProposalCard.tsx` — color-coded card (green/yellow/red per Q2) with single commit button.
9. **NEW** UI component `RelationshipTypePicker.tsx` — combobox with type-ahead, "create new" affordance, collapsible «προχωρημένα ▾» reverse field.
10. **NEW** UI component `SignatoryDisambiguationModal.tsx` — weak-match resolution dialog (Q1: same / different / defer).
11. Wire `SignatoryProposalCard` into existing `ExtractedDataReviewPanel` (or `QuoteRightPane` review tab).
12. i18n el+en — keys for proposal card, modal, picker, errors.
13. ADR-336 → status IMPLEMENTED on commit.

### Constraints
- **Pre-extraction `vendorContactId` flow remains unchanged.** No regressions on the existing scan endpoint.
- **No silent writes.** Every contact + relationship creation is user-initiated via button click.
- **SSoT preserved.** Existing `ContactRelationshipService` is used — never duplicated. Registry move from static module to Firestore is migrated, not parallelized.
- **Confidence-driven UX, not policy.** Persistence is always user-initiated.
- **Idempotency.** Re-clicking commit on the same quote does not create duplicates — resolver hits the strong-match path on the second pass.

### Estimated scope
~12 files (8 new + 4 modified + ADR + i18n + migration). 1 commit. ~3-5h focused work on Opus 4.7.

## Out of scope (deferred)

- Multi-signatory (several signatures on the same offer) — V2.
- Auto-relationship between signatory and *project* (only signatory ↔ vendor in V1).
- Auto-merge of duplicate individual contacts beyond exact-match keys — V2.

## References

- ADR-327 §Phase G — extracted-data review panel (UI scaffolding to extend)
- ADR-080 — AI pipeline canonical flow
- ADR-171 — autonomous agent tool calling pattern
- ADR-294 — SSoT ratchet (must not duplicate `ContactRelationshipService`)

## Changelog

| Date | Change |
|------|--------|
| 2026-04-30 | Stub created. Questions Q1–Q4 opened, awaiting Giorgio's answers in Greek dialog. |
| 2026-04-30 | Q1 closed. Multi-field cross-check decided (strong/weak/none). Single-field mobile match rejected — phone reassignment risk. |
| 2026-04-30 | Q2 closed (initially). Three-tier confidence band per field: ≥85 auto, 60–84 review-pending, <60 manual. |
| 2026-04-30 | Q3 closed → Q2 **revised**. Vendor company stays button-driven (no silent auto-create — confirmed by Giorgio: existing UX with «αλλάξε σε Thermoland» button works well). Signatory follows the same pattern. Q2 updated: confidence drives UI color/copy, persistence is always user-initiated via button click. Goal: «το σωστό αποτέλεσμα», not minimum files. |
| 2026-04-30 | Q4 closed. Self-extending taxonomy with auto-normalization (anti-duplicate), auto-reverse with «προχωρημένα ▾» disclosure, auto-translation, auto-category. Registry migrates from static module to Firestore collection. ALL FOUR QUESTIONS RESOLVED — design phase complete, ready for implementation in a fresh session. |
| 2026-04-30 | Status: PROPOSED → READY-FOR-IMPLEMENTATION. Full scope consolidated (12 files). Implementation deferred to a new session for clean context. |
| 2026-04-30 | Phase 1 Recognition (new session) complete. Q4 §4 corrected: categories now match the actual `RelationshipCategory` enum (`employment | ownership | government | professional | personal | property`) — previous bucket list `corporate / other` was inaccurate vs `relationship-metadata.ts`. New §Q5 added: metadata defaults for dynamic types (`derivesWorkAddress: 'optional'`, derived boolean flags from `category`, sensible `allowedFor` per category). Implementation Phase 2 kicks off. Status: READY-FOR-IMPLEMENTATION → IN-PROGRESS. |
| 2026-04-30 | Phase 2 Implementation complete. Status: IN-PROGRESS → IMPLEMENTED. Files shipped: <br>• `quote-analyzer.schemas.ts` extended with `RawSignatory` + `QUOTE_SIGNATORY` JSON schema + Greek prompt block for footer "Υπεύθυνος ..." extraction. <br>• `types/quote.ts` extended with `ExtractedSignatory` (FieldWithConfidence wrapped) + `signatory` field on `ExtractedQuoteData`. <br>• `openai-quote-analyzer.ts` `normalizeSignatory()` + `buildEmptySignatory()` helpers; fallback path includes signatory. <br>• **NEW** `src/subapps/procurement/services/signatory-confidence.ts` — SSoT thresholds 85/60 + `getSignatoryConfidenceBand()` + `aggregateSignatoryBand()`. <br>• **NEW** `src/services/contacts/signatory-resolver.ts` — multi-field strong/weak/none resolver with normalized phone/email/name/vat matching. Tenant-scoped fetch capped at 5000. <br>• **NEW** `src/services/contact-relationships/relationship-type-ai-inference.ts` — single OpenAI call inferring labelEn + reverseLabelEl + reverseLabelEn + category. Deterministic fallback when key absent. <br>• **NEW** `src/services/contact-relationships/relationship-type-registry.ts` — `findOrCreateRelationshipType()` with normalize-key dedupe; merges static (code) + dynamic (Firestore). Q5 metadata defaults applied. <br>• **NEW** `scripts/seed-relationship-type-registry.ts` — optional one-shot seed of static types into Firestore (idempotent, not required for V1 runtime). <br>• **NEW** Collection const `CONTACT_RELATIONSHIP_TYPE_REGISTRY` added to `firestore-collections.ts`. <br>• **NEW** `src/subapps/procurement/services/commit-signatory-service.ts` — orchestration: resolver → registry → contact create/link → relationship create. Custom types persisted as `relationshipType: 'other'` + `customFields.customRelationshipType*` (V1 strict-union compromise). Idempotent. <br>• **NEW** `src/app/api/quotes/[id]/commit-signatory/route.ts` — POST endpoint with `withAuth` + `withStandardRateLimit` + `discriminatedUnion` zod schema. 409 on weak match returns disambiguation candidates. <br>• **NEW** UI: `signatory/types.ts`, `RelationshipTypePicker.tsx` (static dropdown + custom mode + «προχωρημένα ▾» reverse disclosure), `SignatoryDisambiguationModal.tsx` (link / create-anyway / cancel), `SignatoryProposalCard.tsx` (per-field confidence colors + aggregate band button). <br>• `ExtractedDataReviewPanel.tsx` wired: SignatoryProposalCard renders only when extraction returned at least one populated signatory field. <br>• i18n: `quotes.signatory.*` keys added in `el/quotes.json` + `en/quotes.json`. <br><br>**Deferred (V1 → V2):** auto-listing of previously-created custom types in the picker (V1 only shows static; custom types still dedupe via normalized key on findOrCreate). Multi-signatory per offer. Auto-relationship signatory↔project. Migration of existing static `RELATIONSHIP_METADATA` consumers to Firestore reads. |
