# ADR-327 HANDOFF — Quote Management & Comparison System

**Date**: 2026-04-25
**Previous session ended at**: Context ~80%, ADR-327 APPROVED (20/20 Q&A done), commit `docs: ADR-327 APPROVED after 20 Q&A`
**Next session goal**: Pre-implementation clarification Q&A → then P1a implementation

---

## 🎯 PROTOCOL FOR NEXT SESSION (in this exact order)

### Step 1 — Re-read ADR-327
Read fully: `docs/centralized-systems/reference/adrs/ADR-327-quote-management-comparison-system.md`

Specifically scan:
- §5 Decision (domain model + architecture)
- §10 Phasing
- §13 Open Questions (already answered — see §17)
- §17 Decision Log (the 20 answered Q&A)
- §15 Related Files (file map μετά την υλοποίηση)
- §16 Appendix A (reuse map με file paths)

### Step 2 — Identify clarification gaps
After re-reading, ask yourself:
- Είναι ξεκάθαρα όλα τα domain types και τα fields τους;
- Είναι ξεκάθαρες οι Firestore rules για τις 6 νέες collections;
- Υπάρχουν decisions που είναι too high-level και χρειάζονται drill-down πριν την υλοποίηση;
- Υπάρχουν edge cases που δεν καλύφθηκαν στις 20 Q&A;

**Πιθανές περιοχές για clarification** (non-exhaustive):
- Quote `attachments` policy: μέγιστο μέγεθος, accepted MIME types, retention period
- Quote draft auto-save vs explicit save behavior
- RFQ deadline timezone (Greece local time? UTC? Per-project setting?)
- Vendor invitation accept/decline flow (πριν την υποβολή προσφοράς)
- Άν ο vendor είναι ήδη στις επαφές χωρίς `SupplierPersona`, αυτόματη προσθήκη flag ή manual?
- Quote currency: μόνο EUR (όπως PO) ή multi-currency για ξένους προμηθευτές;
- Tax/VAT handling για international vendors (reverse charge, intra-EU);
- Comparison view: πόσες προσφορές max να εμφανίζει side-by-side (UI scaling);
- Soft-delete vs hard-delete policy για RFQs/Quotes;
- Notification preferences storage (per-user σε `users/{uid}/notification_prefs` ή centralized;)
- Audit trail retention (forever ή X χρόνια;)
- Rate limit thresholds για το vendor portal (per-token vs per-IP;)

### Step 3 — Q&A loop (one question at a time)
- Greek language, simple words, με concrete παραδείγματα
- After κάθε απάντηση → update ADR-327 §17 Decision Log (Q21+)
- Continue μέχρι να μη μένουν ambiguities

### Step 4 — Start P1a implementation
Only AFTER όλες οι clarifications ολοκληρωθούν.

---

## 📋 CURRENT STATUS (snapshot)

- ✅ ADR-327 APPROVED (20 Q&A complete, decision log §17 πλήρες)
- ✅ Commit: `docs: ADR-327 APPROVED after 20 Q&A — Quote Management & Comparison System ready for P1a`
- ⏸️ NO implementation yet
- ⏸️ ADR index auto-regenerates next run of `generate-adr-index.cjs`
- ⏸️ Pending memory entry για ADR-327 (vedi §6)

### Branch state
- Current branch: `main`
- Last commits relevant: ADR-327 draft + APPROVED
- Working tree: clean (assuming previous session committed)

---

## 🚀 P1a SCOPE — Domain Foundation (when ready)

**Goal**: Backend foundation, NO UI. Sets up types, collections, services, APIs.

**Files to create** (~12-15):
```
src/subapps/procurement/types/
  ├─ quote.ts                     [Quote, QuoteLine, ExtractedQuoteData, QuoteStatus, etc.]
  ├─ rfq.ts                       [RFQ, RfqStatus, AwardMode, ReminderTemplate]
  ├─ vendor-invite.ts             [VendorInvite, DeliveryChannel, InviteStatus]
  ├─ trade.ts                     [Trade, TradeCode, TradeGroup]
  └─ comparison.ts                [QuoteComparisonResult, ComparisonWeights, ComparisonTemplate]

src/subapps/procurement/data/
  └─ trades.ts                    [Initial 32 trades / 8 groups SSoT seed data]

src/subapps/procurement/services/
  ├─ quote-service.ts             [CRUD + FSM transitions]
  ├─ rfq-service.ts               [RFQ lifecycle]
  ├─ trade-registry.ts            [Trade SSoT lookup + admin ops]
  └─ quote-counters.ts            [Atomic QT-NNNN counter]

src/app/api/quotes/
  └─ route.ts                     [GET list, POST create — admin only, withAuth]

src/app/api/rfqs/
  └─ route.ts                     [GET list, POST create — admin only, withAuth]

[MODIFIED]
src/config/firestore-collections.ts            +6 new collection constants
src/config/enterprise-id.service.ts            +QT prefix generator
src/types/contacts/personas.ts                 +tradeSpecialties: TradeCode[] στο SupplierPersona
.ssot-registry.json                            +5 modules (quote-entity, rfq-entity, trade-taxonomy, vendor-portal-token-stub, quote-comparison-stub)
firestore.rules                                +rules για 6 νέες collections (Admin SDK only για quotes write)
src/i18n/locales/{el,en}/quotes.json           [NEW namespace, basic keys]
```

**Out of scope για P1a** (αυτά πάνε αλλού):
- ❌ UI components (RfqBuilder, QuoteForm, ComparisonPanel, ...) → P1b
- ❌ AI scan service (`OpenAIQuoteAnalyzer`) → P2
- ❌ Vendor portal (HMAC, public POST, signed URL upload) → P3
- ❌ Comparison scoring engine → P4
- ❌ BOQ/PO integration → P5

**Tests required** (Google presubmit pattern):
- Unit: trade-registry, quote-service FSM transitions, RFQ lifecycle, counter atomicity
- Integration: API routes με mock Firestore Admin SDK
- Schema: validate Firestore rules against test fixtures

**Commit pattern**: μικρές logical commits, πχ:
1. `feat(quotes): add Trade SSoT taxonomy (32 trades, 8 groups)`
2. `feat(quotes): add Quote/RFQ domain types`
3. `feat(quotes): add Firestore collections + rules`
4. `feat(quotes): add quote-service + rfq-service CRUD`
5. `feat(quotes): add API routes (auth-protected)`
6. `feat(quotes): extend SupplierPersona with tradeSpecialties`
7. `chore(ssot): register 5 new modules in .ssot-registry.json`
8. `docs(adr-327): Phase 1a complete — changelog`

---

## ⚠️ CRITICAL — DO NOT

1. ❌ **DO NOT start P1a** until clarification Q&A is complete
2. ❌ **DO NOT write UI code** in P1a (UI = P1b)
3. ❌ **DO NOT use `any`/`as any`/`@ts-ignore`** (CLAUDE.md SOS. N.2/3)
4. ❌ **DO NOT push** without explicit order (CLAUDE.md SOS. N.(-1))
5. ❌ **DO NOT skip ADR Phase 3 update** at end of P1a
6. ❌ **DO NOT skip ADR-327 §17 update** after κάθε clarification απάντηση
7. ❌ **DO NOT use `addDoc()` / inline `crypto.randomUUID()`** — only enterprise-id service με QT prefix (CLAUDE.md SOS. N.6)
8. ❌ **DO NOT bypass SSoT registry** — register 5 new modules in `.ssot-registry.json` (CLAUDE.md SOS. N.12)
9. ❌ **DO NOT hardcode strings** in `.ts/.tsx` — μόνο `t('namespace.key')` με keys σε `src/i18n/locales/{el,en}/quotes.json` (CLAUDE.md SOS. N.11)
10. ❌ **DO NOT forget per-quote `companyId`** σε όλα τα Firestore queries (CHECK 3.10)

---

## 🎯 MODEL RECOMMENDATION (CLAUDE.md N.14)

**For Step 1-3 (re-read ADR + clarification Q&A)**:
- 🎯 Modello: **Sonnet 4.6**
- Motivo: Document review + structured Q&A, no architectural deep-dive needed
- Switch: `/model sonnet`

**For Step 4 (P1a implementation)**:
- 🎯 Modello: **Sonnet 4.6**
- Motivo: ~12-15 files focused implementation, patterns από ADR-267 are clear
- Switch: `/model sonnet`

**Avoid Opus** για το next session: το heavy thinking έγινε σε αυτό το session με Opus 4.7. Sonnet basta για execution.

---

## 📚 KEY REUSE MAP (από §16 του ADR)

Επανάχρηση patterns — έτοιμα να copy/extend:

| What | From file:line | Reuse στο P1a? |
|------|---------------|----------------|
| Atomic counter | `src/services/procurement/procurement-repository.ts:47-63` (PURCHASE_ORDER_COUNTERS) | ✅ Direct copy → quote-counters |
| 6-state FSM pattern | `src/types/procurement/purchase-order.ts:30-38` (PO_STATUS_TRANSITIONS) | ✅ Adapt για 7-state Quote FSM |
| Supplier persona | `src/types/contacts/personas.ts:200-206` | ✅ Extend με tradeSpecialties[] |
| Storage path builder | `src/services/upload/utils/storage-path.ts:264` | 🟡 Reuse στο P2 (όχι P1a) |
| HMAC token utility | `src/services/attendance/qr-token-service.ts:58-79` | 🟡 Reuse στο P3 |
| AI Vision analyzer | `src/subapps/accounting/services/external/openai-document-analyzer.ts:301` | 🟡 Reuse στο P2 |

---

## 📝 SESSION INIT CHECKLIST (paste σε first message του next session)

```
Continuing ADR-327 (Quote Management & Comparison System).

1. Re-read: docs/centralized-systems/reference/adrs/ADR-327-quote-management-comparison-system.md
2. Re-read: adrs/ADR-327-HANDOFF.md
3. Identify clarification gaps NOT covered στο §17 Decision Log
4. Ask one question at a time σε ελληνικά simple Greek με παραδείγματα
5. Update ADR §17 after each answer
6. When clarifications done: implement P1a (Domain Foundation, no UI)

Model: Sonnet 4.6 throughout (per N.14, paste before start: /model sonnet)
```

---

## 🔗 RELATED MEMORIES (in `~/.claude/projects/C--Nestor-Pagonis/memory/`)

- `feedback_no_push_without_order.md` — never push without explicit order
- `feedback_adr_phase3_mandatory.md` — never commit code without ADR update same commit
- `feedback_google_quality_standard.md` — Google-level quality standard
- `feedback_ssot_ratchet_enforcement.md` — SSoT registry must be updated
- `feedback_model_suggestion_rule.md` — model enforcement N.14
- `feedback_pure_greek_locale.md` — el locale zero English words

---

## 🏁 SUCCESS CRITERIA του next session

1. ✅ ADR re-read complete
2. ✅ Όλες οι clarification questions ρωτήθηκαν και απαντήθηκαν
3. ✅ §17 Decision Log updated με Q21+
4. ✅ P1a implementation complete (12-15 files)
5. ✅ Tests passing
6. ✅ ADR-327 changelog updated με Phase 1a entry
7. ✅ Commits autonomous (NO push)
8. ✅ End-of-session handoff για P1b
