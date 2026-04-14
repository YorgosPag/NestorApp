# ADR-305 — Project Landowners & Engineers Tab Mutation Impact Guard

**Status:** Implemented
**Data:** 2026-04-14
**Autori:** YorgosPag
**Correlati:** ADR-302 (General Tab), ADR-303 (Addresses Tab), ADR-304 (Ownership Table Tab), ADR-244 (Landowner Denormalization), ADR-032 (Entity Associations)

---

## 1. Contesto

Questa ADR estende il sistema impact-guard (ADR-302/303/304) a due tab del progetto:

1. **Οικοπεδούχοι (Landowners)** — Gestione oikopedoukhoi + bartexPercentage
2. **Μηχανικοί Έργου (Project Engineers)** — Gestione associazioni contatti via `contact_links`

La tab Landowners aveva già un guard parziale (`useLandownerUnlinkGuard` + `LandownerRemovalDialog`) per la rimozione per-contatto. Questo ADR copre le operazioni non ancora guardate.

---

## 2. Analisi denormalizzazione

### 2.1 Tab Οικοπεδούχοι

**Campi progetto:**
- `landowners: LandownerEntry[]` — array { contactId, name, landOwnershipPct, allocatedShares }
- `bartexPercentage: number | null`
- `landownerContactIds: string[]` — IDs denormalizzati (ADR-244, array-contains queries)

| Collection | Campo | Tipo copia | Trigger |
|---|---|---|---|
| `ownership_tables` | `bartex.landowners[]` | SNAPSHOT | Calcolato dalla tabella al momento del calcolo |
| `ownership_tables` | `bartex.bartexPercentage` | COPY | Idem |
| `properties` | `commercial.owners[]` | SNAPSHOT | Scritto da `finalizeTable()` — NON da handleSave |
| `parking_spaces` | `commercial.owners[]` | SNAPSHOT | Idem |
| `storage_units` | `commercial.owners[]` | SNAPSHOT | Idem |

> **Nota:** `properties/parking_spaces/storage_units` non vengono aggiornate dal SAVE della
> tab Landowners — solo da `finalizeTable()` (ownership table). Il guard SAVE avvisa
> sull'`ownership_tables` snapshot, non sulle properties direttamente.

**Guard esistente (NON modificato):** `useLandownerUnlinkGuard` + `LandownerRemovalDialog`
gestisce REMOVE per-contatto con BLOCK se properties/parking/storage hanno questo owner.

### 2.2 Tab Μηχανικοί Έργου

**Storage:** solo `contact_links` collection.
**Nessun campo denormalizzato** sul documento progetto per gli ingegneri.
**Dipendenze downstream verificate:**

| Collection | Campo | Trovato? |
|---|---|---|
| `legal_contracts` | engineer contactId | ❌ NO |
| `accounting_invoices` | engineer contactId | ❌ NO |
| `purchase_orders` | engineer contactId | ❌ NO |
| `obligations` | `assigneeId` | ✅ SÌ |

---

## 3. Operazioni e matrice impatto

### 3.1 Tab Landowners — Operazione SAVE

| Condizione | Dipendenza | Mode | Messaggio chiave |
|---|---|---|---|
| `ownershipTables > 0` (bartexChanged=false) | `ownershipTables` | **warn** | `impactGuard.landownersSave.withOwnershipTables` |
| `ownershipTables > 0` (bartexChanged=true) | `ownershipTables` | **warn** | `impactGuard.landownersSave.withBartexChange` |
| `ownershipTables == 0` | — | allow | — |

### 3.2 Tab Landowners — Operazione REMOVE (guard esistente — invariato)

| Condizione | Dipendenza | Mode |
|---|---|---|
| properties/parking/storage con questo owner | blocking | **block** |
| ownership_tables con riferimento | warning | warn |
| nessuna dipendenza | — | confirm |

### 3.3 Tab Engineers — Operazione REMOVE

| Condizione | Dipendenza | Mode | Messaggio chiave |
|---|---|---|---|
| `obligations where assigneeId==contactId AND projectId==X > 0` | `obligations` | **warn** | `impactGuard.engineerRemove.withObligations` |
| 0 obbligazioni | — | allow | — |

### 3.4 Tab Engineers — ADD / CHANGE ROLE

→ **allow sempre** (nessuna dipendenza downstream).

---

## 4. Architettura implementazione

Pattern identico a ADR-303/304: service separato, route dedicata, riuso `ProjectMutationImpactDialog` + `ProjectMutationImpactPreview`.

### Differenza chiave — Engineering tab

`EntityAssociationsManager` è un componente generico. Il guard è iniettato via prop
`onRemoveIntercept?: (contactId, role, proceed) => void` (approccio "open for extension"):
- Quando presente: bypass dell'AlertDialog standard, il caller gestisce guard + dialog
- Quando assente: comportamento originale (AlertDialog standard)

---

## 5. File coinvolti

### File CREATI

| File | Ruolo | Righe |
|---|---|---|
| `src/lib/firestore/project-landowners-save-impact.service.ts` | Query `ownership_tables`, rule engine SAVE | ~110 |
| `src/app/api/projects/[projectId]/landowners-save-preview/route.ts` | POST endpoint — Zod, withAuth, withStandardRateLimit | ~55 |
| `src/hooks/useProjectLandownersSaveImpactGuard.tsx` | Base guard hook (Google INP pattern) | ~105 |
| `src/hooks/useGuardedLandownersSave.tsx` | Thin wrapper con `runSaveOperation()` | ~25 |
| `src/lib/firestore/project-engineer-remove-impact.service.ts` | Query `obligations where assigneeId==X`, rule engine REMOVE | ~105 |
| `src/app/api/projects/[projectId]/engineer-impact-preview/route.ts` | POST endpoint — Zod, withAuth, withStandardRateLimit | ~55 |
| `src/hooks/useProjectEngineerRemoveImpactGuard.tsx` | Base guard hook (Google INP pattern) | ~105 |
| `src/hooks/useGuardedEngineerRemoval.tsx` | Thin wrapper con `runRemoveOperation()` | ~25 |

### File MODIFICATI

| File | Modifica |
|---|---|
| `src/config/domain-constants.ts` | `LANDOWNERS_SAVE_PREVIEW` + `ENGINEER_IMPACT_PREVIEW` route constants |
| `src/components/projects/tabs/ProjectLandownersTab.tsx` | `useGuardedLandownersSave` integrato; `handleSave` → `runSaveOperation` |
| `src/components/associations/EntityAssociationsManager.tsx` | Prop `onRemoveIntercept` aggiunta (backward-compatible) |
| `src/components/projects/tabs/ProjectAssociationsTab.tsx` | `useGuardedEngineerRemoval` cablato; `onRemoveIntercept` passato |
| `src/i18n/locales/el/projects.json` | `impactGuard.landownersSave.*` (2 chiavi) + `impactGuard.engineerRemove.*` (1 chiave) |
| `src/i18n/locales/en/projects.json` | Idem |

### File NON toccati (riutilizzati as-is)

- `src/lib/firestore/landowner-unlink-guard.ts` — guard remove per-contatto ✓
- `src/components/shared/owners/LandownerRemovalDialog.tsx` — dialog remove ✓
- `src/hooks/useLandownerUnlinkGuard.ts` — hook remove ✓
- `src/components/projects/dialogs/ProjectMutationImpactDialog.tsx` — riutilizzato ✓
- `src/types/project-mutation-impact.ts` — `ProjectMutationImpactPreview` invariato ✓

---

## 6. Chiavi i18n (3 nuove chiavi sotto `impactGuard.*`)

| Chiave | Trigger |
|---|---|
| `impactGuard.landownersSave.withOwnershipTables` | SAVE + ownershipTables > 0 (landowners change) |
| `impactGuard.landownersSave.withBartexChange` | SAVE + ownershipTables > 0 + bartexPercentage cambia |
| `impactGuard.engineerRemove.withObligations` | REMOVE engineer + obligations assignee > 0 |

---

## 7. Scenari di test

1. Progetto con `ownershipTables > 0` → SAVE landowners → dialog WARN ✓
2. Progetto con `ownershipTables > 0` + bartexPct cambia → SAVE → dialog WARN (messaggio bartex) ✓
3. Progetto con `ownershipTables == 0` → SAVE → allow diretto ✓
4. REMOVE landowner già in properties → BLOCK (guard esistente, invariato) ✓
5. Engineer REMOVE con `obligations.assigneeId > 0` → dialog WARN ✓
6. Engineer REMOVE senza obbligazioni → allow diretto (bypass dialog) ✓
7. Engineer ADD → allow sempre ✓
8. Engineer CHANGE ROLE → allow sempre (nessun guard) ✓
9. `EntityAssociationsManager` su building (non project) → `onRemoveIntercept` assente → AlertDialog standard ✓

---

## 8. Changelog

| Data | Versione | Cambiamento |
|---|---|---|
| 2026-04-14 | 1.0.0 | ADR creata. Analisi denormalizzazione completa per entrambe le tab. Matrice impatto approvata. Status: Draft. |
| 2026-04-14 | 2.0.0 | Implementazione completa. 8 file creati, 6 modificati. `onRemoveIntercept` prop su EntityAssociationsManager. Draft → Implemented. |
