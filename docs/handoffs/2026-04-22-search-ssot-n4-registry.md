# HANDOFF — Step N+4: SSoT Registry + ADR Index (ADR-029)

**Date**: 2026-04-22 (fine giornata)
**Prior session**: Opus 4.7 — N+1 (clean re-commit), N+2 (deploy + verify), N+3 (8 domain cleanups)
**Recommended model next session**: **Sonnet 4.6** (registry config + ADR index — scoped docs/config work, non architettura)

---

## 1. Stato attuale (committed to `main`, NOT pushed)

Ultimi 10 commit locali:

```
0503e9ec Phase D.8 opportunities
9b89609e Phase D.7 ai-pipeline
f632c66f Phase D.6 storages
49147824 Phase D.5 parking
5499ffd2 Phase D.4 properties
0336f4e9 Phase D.3 buildings
7bef3c02 Phase D.2 projects
7093a60c Phase D.1 contacts+communications
73194b5d docs ADR-029 Phase A/B/C rewrite
6a56d1f6 Phase C re-commit (4 file, no bleed)
```

Deploy Cloud Functions: **LIVE** su `pagonis-87766`. Verificato end-to-end via contatto ALFA (`cont_ba3c483f-a613-4caf-9319-c871364232f0`) → title "Unknown" → "ALFA".

---

## 2. Parallel agent (ADR-316 Project Showcase) — NEVER touch

Altro agente ha committato durante la sessione. File vietati (lista da handoff precedente + aggiornamento):

- `src/types/sharing.ts`, `src/types/project-showcase.ts`
- `src/services/project-showcase/**`
- `src/services/pdf/ProjectShowcasePDFService.ts`, `src/services/pdf/renderers/ProjectShowcaseRenderer.ts`
- `src/app/api/projects/[projectId]/showcase/**`, `src/app/api/project-showcase/**`, `src/app/api/showcase/**`
- `src/services/sharing/resolvers/project-showcase.resolver.ts`, `src/services/sharing/resolvers/index.ts`
- `src/components/project-showcase/**`, `src/components/property-showcase/**`
- `src/components/shared/pages/**`
- `src/components/projects/ProjectDetailsHeader.tsx`, `src/components/projects/project-details.tsx`
- `src/i18n/locales/**/showcase.json`, `src/i18n/locales/**/projects.json`
- `docs/.../ADR-316-project-showcase.md`

**Git hygiene**: `git commit -- file1 file2 -m "..."` con path espliciti. Mai `git add -A`.

---

## 3. Remaining work — Step N+4

### 3.1 — `.ssot-registry.json`: add `search-index-config` module (Tier 3)

Registra il modulo SSoT con `forbiddenPatterns` che blocca ri-dichiarazione di `SEARCH_INDEX_CONFIG` fuori dai 2 file canonici.

**Canonical files (allowlist)**:
- `src/config/search-index-config.ts`
- `functions/src/search/search-config.mirror.ts`

**Entry proposto** (da rivedere contro pattern esistenti Tier 3):

```json
{
  "id": "search-index-config",
  "tier": 3,
  "canonical": [
    "src/config/search-index-config.ts",
    "functions/src/search/search-config.mirror.ts"
  ],
  "forbiddenPatterns": [
    "const\\s+SEARCH_INDEX_CONFIG\\s*=",
    "export\\s+const\\s+SEARCH_INDEX_CONFIG"
  ],
  "reason": "ADR-029 SSoT — entity config declared only in main-app config + functions mirror"
}
```

**⚠️ Coordinamento richiesto**: altro agente (ADR-316) può voler aggiungere moduli allo stesso `.ssot-registry.json`. Giorgio deve confermare che l'altro agente non sta toccando il file mentre committi.

Run dopo modifica:
```bash
npm run ssot:baseline   # aggiorna baseline
npm run ssot:audit      # verifica
```

### 3.2 — `docs/centralized-systems/reference/adr-index.md`: verify ADR-029 entry

Controllare che la riga di ADR-029 sia ancora corretta (titolo, stato "ACCEPTED", link al file giusto). Potrebbe essere già ok — è un verify, non necessariamente edit.

### 3.3 — (Opzionale) Pre-commit hook sync check

Wire `npm run search-config:sync` in `.husky/pre-commit` o `scripts/check-ssot.mjs`. Se lo fai, aggiungi solo dietro touch di:
- `src/config/search-index-config.ts`
- `functions/src/search/search-config.mirror.ts`

Così non rallenta gli altri commit.

### 3.4 — ADR-029 changelog: chiudi Phase D

Aggiungi riga finale al changelog di `docs/centralized-systems/reference/adrs/ADR-029-global-search-system-v1.md`:

```markdown
| 2026-04-22 | Claude | SUMMARY (Phase D complete): 8 domini ripuliti (contacts, projects, buildings, properties, parking, storages, ai-pipeline, opportunities), 15 siti rimossi, 0 regression. Single-writer invariant enforced. |
```

E magari aggiorna §8 (GOL Checklist) se qualche voce passa da ⚠️ a ✅.

### 3.5 — Push & deploy decision

Tutto local. Push? Deploy di altro? **Giorgio decide**. Non pushare senza ordine esplicito.

---

## 4. Prompt per nuova sessione

```
Leggi docs/handoffs/2026-04-22-search-ssot-n4-registry.md e segui la §3.

Step N+4.1: aggiungi il modulo `search-index-config` a `.ssot-registry.json`
(coordina con me — altro agente può toccare lo stesso file).

Step N+4.2: verifica entry ADR-029 in adr-index.md.

Step N+4.3 opzionale: wire search-config:sync nel pre-commit (solo su
touch dei 2 file canonici).

Step N+4.4: chiudi Phase D con riga SUMMARY nel changelog di ADR-029.

Step N+4.5: fermati e chiedi a me se pushare.

Regole:
- Altro agente lavora in parallelo su ADR-316. File vietati: §2 del handoff.
- Git: `git commit -- <file> -m "..."` con path espliciti. Mai `git add -A`.
- Senza ordine esplicito: no push.
- GOL + SSOT attivi.

Model: Sonnet 4.6.
```

---

## 5. Files miei (safe to modify)

- `.ssot-registry.json` (⚠️ con coordinamento)
- `docs/centralized-systems/reference/adr-index.md` (⚠️ con coordinamento — altro agente potrebbe aggiornare anche lui)
- `docs/centralized-systems/reference/adrs/ADR-029-global-search-system-v1.md`
- `.husky/pre-commit` o `scripts/check-ssot.mjs`

---

## 6. Context da ricordare

- `FUNCTIONS_DISCOVERY_TIMEOUT=60` necessario per deploy Cloud Functions (modulo carica in ~4.6s, default CLI 10s troppo vicino).
- Admin SDK `.update()` con stesso valore = no-op deduplicato, non fires trigger. Per testare trigger: update di un campo diverso o additivo.
- Multi-agent git hygiene: `-- <paths>` salva la vita. Già testato 4 volte oggi senza conflitti.
- Pre-commit hook ogni tanto fallisce con `fatal: unable to write new index file` (race con altro agente) — il commit comunque atterra. Verifica con `git log --oneline -1`. Se atterrato, `git reset HEAD -- <files>` per ripulire index.
