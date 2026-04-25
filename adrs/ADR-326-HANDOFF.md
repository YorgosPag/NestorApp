# ADR-326 — Handoff per Phase 0 Implementation

**Created**: 2026-04-25
**Per**: Νέα συνεδρία Claude Code (clean context)
**Status**: ADR v1.0 APPROVED, ready for code

---

## TL;DR

Implementa la **Phase 0** di `adrs/ADR-326-tenant-org-structure-departmental-routing.md` (sezione §7).

**Goal**: SSoT primitives — types + config + tree utils + resolver + tests. **Zero UI, zero migration**.

**Durata stimata**: 1.5 giorni.

**Modello consigliato**: **Sonnet 4.6** (implementazione mirata, no architettura). Subagenti se necessario su Haiku per lookup.

---

## File da creare (Phase 0)

```
src/types/org/org-structure.ts                              ← Schema (vedi §3.2 ADR)
src/config/department-codes.ts                              ← 12 canonical + CUSTOM
src/services/org-structure/utils/build-org-tree.ts          ← ≤40 righe (rule N.7.1)
src/services/org-structure/utils/validate-org-hierarchy.ts  ← cycle/orphan/depth/canonical-uniqueness
src/services/org-structure/org-routing-resolver.ts          ← 4-step cascade + backup-fallback (G3)
src/i18n/locales/el/org-structure.json                      ← ~50 keys greek
src/i18n/locales/en/org-structure.json                      ← ~50 keys english

__tests__/build-org-tree.test.ts
__tests__/validate-org-hierarchy.test.ts
__tests__/org-routing-resolver.test.ts
```

## File da modificare (Phase 0)

```
src/config/notification-events.ts        ← extend (modulo esistente, NON nuovo)
.ssot-registry.json                      ← aggiungere modulo "org-structure" Tier 2
```

---

## Constraints critici (NON dimenticare)

1. **GOL apply** (CLAUDE.md N.7 + N.7.1 + N.7.2):
   - Funzioni ≤40 righe
   - File ≤500 righe (eccetto types/config)
   - Test coverage ≥95% per services
   - Declare ✅/⚠️/❌ Google-level alla fine

2. **SSoT** (CLAUDE.md N.0 + N.12):
   - PRIMA di creare qualsiasi file, grep `.ssot-registry.json` per duplicati
   - Department codes = SSoT, no hardcoded department names altrove

3. **i18n** (CLAUDE.md N.11):
   - 0 hardcoded strings in `.ts/.tsx`
   - Tutti gli i18n keys in locales/ JSON files

4. **Enterprise IDs** (CLAUDE.md N.6):
   - `org_xxx` per OrgStructure root (genera generatore in `enterprise-id.service.ts`)
   - `odep_xxx` per OrgDepartment
   - `omem_xxx` per OrgMember

5. **No `any`, no `as any`, no `@ts-ignore`** (CLAUDE.md anti-patterns)

6. **Test data wiped** before production — quindi NESSUNO script di migration in Phase 0 (G2 decision)

---

## Acceptance criteria Phase 0

- [ ] `npm run typecheck` ✅
- [ ] `npm test src/services/org-structure` coverage ≥95% ✅
- [ ] `npm run ssot:audit` non aumenta violations ✅
- [ ] Pre-commit hook ✅
- [ ] GOL declaration esplicita

---

## Workflow ADR (CLAUDE.md N.0.1)

**4 phases mandatory:**
1. **RECOGNITION** (Plan mode): leggi ADR-326 §3.2-3.5 + §7 Phase 0. Verifica stato attuale codebase.
2. **IMPLEMENTATION**: scrivi codice secondo plan
3. **ADR UPDATE**: dopo implementation, update changelog ADR-326 con «v1.1 — Phase 0 IMPLEMENTED»
4. **COMMIT**: codice + ADR update nello stesso commit

---

## Decisioni-chiave (riepilogo da v1.0)

| Decisione | Riferimento ADR |
|-----------|-----------------|
| Scope: L1 + L2 full hierarchy, L3 simplified (responsiblePersons enriched) | §3.1 + Q1+Q6 |
| Department codes: 12 canonical + unlimited custom (case-insensitive match) | §3.3 + Q2 |
| Hierarchy: Google manager-pointer pattern (reportsTo) | §3.11 + Q3 |
| Member↔User link: optional per L1 only | §3.10 + Q4 + G8 |
| 3-mode UX (Link/Create/Plain) per OrgMember | §3.10 |
| Resolver cascade: 4-step (override → head → backup → dept-level → null) | §3.5 + Q5+Q7+Q8+G1+G3 |
| AI integration: 5 agentic tools (Phase 7) | §3.12 |
| UI: unified `Settings → Εταιρεία` 4 tabs | Q10 |
| Onboarding: skippable + persistent banner + 4 default toggles | Q9+Q11 |
| Canonical uniqueness: max 1 per code, custom unlimited | G6 |
| ContactRelationships smart import banner (one-time, L2 tab first open) | §3.13 + G7 |
| NO env var fallback (G1) — Vercel removal Phase 9 | Q8+G1 |
| NO migration script (G2) — DB wiped pre-launch | §3.14 + G2 |

---

## Comando per iniziare nuova sessione

```
Λοιπόν, διάβασε το adrs/ADR-326-HANDOFF.md και υλοποίησε Phase 0 του ADR-326.
Ακολούθησε ADR-driven workflow (4 phases). GOL apply.
```

Ή πιο σύντομο:

```
Implementa Phase 0 di ADR-326. Vedi adrs/ADR-326-HANDOFF.md.
```

---

## Linguaggio

Γιώργος γράφει στα ελληνικά. Claude απαντάει **στα ιταλικά** (CLAUDE.md language rule).

**ECCEZIONE durante questa sessione conclusa**: Discussione design tutta in greco (richiesta esplicita Γιώργου per Q&A). Nuova sessione **ritorna a italiano** standard.
