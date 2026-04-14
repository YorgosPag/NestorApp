# ADR-304 — Project Ownership Table (Πίνακας Χιλιοστών) Mutation Impact Guard

**Status:** Implemented
**Data:** 2026-04-14
**Autori:** YorgosPag
**Correlati:** ADR-302 (Project Field Mutation Impact System), ADR-303 (Project Addresses Mutation Impact Guard), ADR-235 (Ownership Percentage Table), ADR-244 (Multi-Buyer Co-Ownership)

---

## 1. Contesto

La tab "Πίνακας Χιλιοστών" contiene il sistema più critico del progetto dal punto di vista delle
dipendenze downstream. L'operazione `FINALIZE` scrive dati in 3 collezioni Firestore simultaneamente:

| Collezione target | Campi scritti | Trigger |
|---|---|---|
| `properties` | `millesimalShares`, `commercial.owners`, `commercial.ownerContactIds` | `finalizeTable()` |
| `storage_units` | `millesimalShares` (se `hasOwnShares=true`), `commercial.owners`, `commercial.ownerContactIds` | `finalizeTable()` |
| `parking_spots` | `millesimalShares`, `commercial.owners`, `commercial.ownerContactIds` | auto-populate |

L'operazione `UNLOCK` re-abilita la modifica di dati legalmente vincolanti (millesimalShares
già scritti in contratti, atti notarili, Κτηματολόγιο).

Questo ADR estende il sistema ADR-302/303 alla tab Ownership Table, con guard dedicato
per `FINALIZE` e `UNLOCK`.

---

## 2. Analisi denormalizzazione — Risultato ricognizione (2026-04-14)

### 2.1 Collezioni che consumano i dati dell'ownership table

| Collection | Campo | Tipo copia | Note |
|---|---|---|---|
| `properties` | `millesimalShares` | COPY | Scritto da `finalizeTable()` per ogni row |
| `properties` | `commercial.owners` | SNAPSHOT | `PropertyOwnerEntry[]` (ADR-244) |
| `properties` | `commercial.ownerContactIds` | COPY | Array flat per query Firestore |
| `storage_units` | `millesimalShares` | COPY condizionale | Solo se `LinkedSpaceDetail.hasOwnShares=true` |
| `storage_units` | `commercial.owners` | SNAPSHOT | Idem |
| `parking_spots` | `millesimalShares` | COPY | `participatesInCalculation=false` |

### 2.2 Non denormalizzato (confermato)

| Collection | Motivo |
|---|---|
| `legal_contracts` | Nessun campo ownership snapshot trovato nel codice |
| `accounting_invoices` | Nessuna referenza diretta trovata |
| `buildings` | Nessuna denormalizzazione shares |
| `purchase_orders` | Nessuna referenza diretta trovata |

> Nota: i contratti referenziano le properties (che hanno `millesimalShares`), non direttamente
> l'ownership table. Il guard intercetta questo collegamento indiretto.

---

## 3. Operazioni monitorate

### 3.1 `FINALIZE` — matrice dipendenze

| Dipendenza | Query | Mode | Razionale |
|-----------|-------|------|-----------|
| `soldProperties > 0` | `properties where projectId==id AND commercialStatus=='sold'` | **block** | Unità già vendute = obblighi notarili. Shares non riscrittibili. |
| `legalContracts > 0` | `legal_contracts where projectId==id` | warn | Contratti usano millesimalShares via properties. |
| `propertyPaymentPlans > 0` | subcollection fan-out per properties | warn | Piani calcolati su valori di proprietà che includono shares. |
| `tableVersion > 0` | dato dalla request (no Firestore query) | warn forced | Re-finalizzazione = sovrascrittura. Sempre notifica. |

**Se `soldProperties > 0` → BLOCK immediatamente (break).**

### 3.2 `UNLOCK` — matrice dipendenze

| Condizione | Dipendenza | Mode | Razionale |
|-----------|-----------|------|-----------|
| `tableStatus === 'registered'` | — (local check) | **block** | KAEK codes = κτηματολόγιο completato. Legalmente immutabile. |
| `soldProperties > 0` | `soldProperties` | **block** | Atti notarili già firmati con queste shares. |
| `legalContracts > 0` | `legalContracts` | warn | Contratti referenziano la tabella finalizzata. |
| Sempre (alwaysNotify) | — | warn forced | Unlock = evento significativo. Dialog sempre mostrato. |

**Se `registered` O `soldProperties > 0` → BLOCK immediatamente (break).**

### 3.3 Operazioni locali (nessuna API, gestione inline nel componente)

| Operazione | Guard | Note |
|-----------|-------|------|
| `SAVE` | nessuno | Draft only, no cascade |
| `DELETE DRAFT` | `confirm()` inline | Già implementato in `useOwnershipTableHandlers.handleDeleteDraft` |
| `AUTO-POPULATE` | `confirm()` inline | Già gestito con validazione building |
| `CALCULATE` | validazione locale | Check air rights e aree già implementato |

---

## 4. Architettura implementazione

### 4.1 Pattern — Opzione A (service separato, ADR-303 identical)

Input schema incompatibile con guard generale (`ProjectUpdatePayload` vs `OwnershipImpactRequest`).
Scelta: service separato, route dedicata, stesso dialog/hook/tipo output.

### 4.2 Flusso FINALIZE (con guard)

```
OwnershipTableTab
  └─ useOwnershipTableHandlers({ projectId, ... })
       └─ handleFinalize()
            └─ runOwnershipOperation({ operation: 'finalize', tableId, tableVersion, tableStatus })
                 └─ POST /api/projects/{id}/ownership-impact-preview
                      └─ previewOwnershipMutationImpact(projectId, req)
                           └─ collectCounts() — 3 query parallele
                           └─ buildDependencies() → RuleResult
                      └─ ProjectMutationImpactDialog (se warn/block)
                 └─ Se approved → finalize(userId)
```

### 4.3 `forcedWarn` pattern (ADR-302 alwaysNotify esteso)

Per FINALIZE con `tableVersion > 0` e zero dipendenze Firestore → `forcedWarn = true`.
Per UNLOCK senza blocked → `forcedWarn = true` (sempre notifica).
Comportamento: `deps.length === 0 && !forcedWarn → allow`. Se `forcedWarn → warn`.

---

## 5. File coinvolti

### File CREATI

| File | Ruolo | Righe |
|---|---|---|
| `src/lib/firestore/project-ownership-mutation-impact.service.ts` | Query engine (3 query parallele) + rule engine per finalize/unlock | ~225 |
| `src/app/api/projects/[projectId]/ownership-impact-preview/route.ts` | POST endpoint Zod+withAuth+withStandardRateLimit | ~55 |
| `src/hooks/useProjectOwnershipMutationImpactGuard.tsx` | Base guard hook (Google INP pattern, ADR-303 identical) | ~120 |
| `src/hooks/useGuardedOwnershipTableMutation.tsx` | Thin wrapper con `runOwnershipOperation(finalize\|unlock)` | ~30 |

### File MODIFICATI

| File | Modifica |
|---|---|
| `src/config/domain-constants.ts` | Aggiunto `API_ROUTES.PROJECTS.OWNERSHIP_IMPACT_PREVIEW` |
| `src/i18n/locales/el/projects.json` | Aggiunto `impactGuard.ownershipMutation.*` (8 chiavi) |
| `src/i18n/locales/en/projects.json` | Idem |
| `src/components/projects/tabs/useOwnershipTableHandlers.ts` | `handleFinalize` + `handleUnlock` cablati su guard; `projectId` in deps; `ImpactDialog` + `guardChecking` restituiti |
| `src/components/projects/tabs/OwnershipTableTab.tsx` | Passa `projectId` ai handlers; renderizza `handlers.ImpactDialog` |

### File NON toccati (riutilizzati)

- `src/components/projects/dialogs/ProjectMutationImpactDialog.tsx` — riutilizzato as-is ✓
- `src/hooks/useProjectMutationImpactGuard.tsx` — non toccato ✓
- `src/types/project-mutation-impact.ts` — `ProjectMutationImpactPreview` invariato ✓

---

## 6. Chiavi i18n (8 chiavi — `impactGuard.ownershipMutation.*`)

| Chiave | Trigger |
|-------|---------|
| `finalizeWithContracts` | FINALIZE + legalContracts > 0 |
| `finalizeWithPaymentPlans` | FINALIZE + propertyPaymentPlans > 0 |
| `finalizeReFinalize` | FINALIZE + tableVersion > 0 (nessun'altra dep) |
| `finalizeSoldProperties` | FINALIZE + soldProperties > 0 → BLOCK |
| `unlockRegistered` | UNLOCK + status=registered → BLOCK |
| `unlockSoldProperties` | UNLOCK + soldProperties > 0 → BLOCK |
| `unlockWithContracts` | UNLOCK + legalContracts > 0 → WARN |
| `unlockWithHistory` | UNLOCK senza altre dep → WARN forced |

---

## 7. Scenari di test (Fase D)

1. Progetto con `soldProperties > 0` → FINALIZE → dialog **BLOCK** ✓
2. Progetto con `legalContracts > 0` → FINALIZE → dialog **WARN** ✓
3. Tabella `version > 0` (già finalizzata), nessuna dep → FINALIZE → dialog **WARN** (forcedWarn) ✓
4. Tabella prima finalizzazione, nessuna dep → FINALIZE → **allow diretto** ✓
5. Tabella `status=registered` → UNLOCK → dialog **BLOCK** ✓
6. Tabella `soldProperties > 0` → UNLOCK → dialog **BLOCK** ✓
7. Tabella `legalContracts > 0` → UNLOCK → dialog **WARN** ✓
8. Tabella nessuna dep → UNLOCK → dialog **WARN** (forcedWarn — alwaysNotify) ✓
9. DELETE/AUTO-POPULATE/SAVE/CALCULATE → nessuna API call, behavior invariato ✓

---

## 8. Changelog

| Data | Versione | Cambiamento |
|------|---------|-------------|
| 2026-04-14 | 1.0.0 | ADR creata. Ricognizione completa denormalizzazione (3 collezioni target). Matrice impatto per FINALIZE (4 regole) e UNLOCK (4 regole). |
| 2026-04-14 | 2.0.0 | Implementazione completa. 4 file creati, 5 modificati. `forcedWarn` pattern per re-finalize e unlock-alwaysNotify. Draft → Implemented. |
