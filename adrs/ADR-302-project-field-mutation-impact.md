# ADR-302 — Project Field Mutation Impact System

**Status:** Draft  
**Date:** 2026-04-14  
**Authors:** YorgosPag  
**Related:** ADR-297 (Contact Dependency Registry SSoT), ADR-256 (Project Detail Read Path), ADR-232 (Project–Company Link), ADR-090 (EFKA/IKA Attendance)

---

## 1. Context

La scheda "Generale" di un progetto contiene campi critici. Quando un utente modifica
uno di questi campi, possono esserci conseguenze su altre entità del database
(edifici, contratti legali, presenze cantiere, piani di pagamento, ecc.).

Il sistema analogo per i Contatti (**ADR-297**) ha dimostrato che un registry
dichiarativo + engine di query centralizzato è l'architettura corretta per
questo problema. Lo stesso pattern deve essere applicato ai Progetti.

### Campi monitorati nella scheda Generale

| Campo | Tipo | Note |
|-------|------|------|
| `status` | enum | planning / in_progress / completed / on_hold / cancelled |
| `name` | string | Titolo progetto (denormalizzato) |
| `title` | string | Titolo licenza/permesso |
| `description` | string | Descrizione libera |
| `buildingBlock` | string | Τετραγωνισμα |
| `protocolNumber` | string | Numero protocollo |
| `licenseNumber` | string | Numero licenza |
| `issuingAuthority` | string | Autorità emittente |
| `issueDate` | string | Data emissione |
| `linkedCompanyId` | string | Link azienda (ADR-232) |

---

## 2. Stato corrente — Infrastruttura già implementata

Prima di questa ADR, esiste già una pipeline parziale:

### 2.1 File esistenti

| File | Ruolo | Completezza |
|------|-------|-------------|
| `src/config/project-mutation-impact.ts` | Definisce 5 field-group e 14 dependency ID | ✅ Struttura OK, manca logica status |
| `src/lib/firestore/project-mutation-impact-preview.service.ts` | Query engine: conta 14 collezioni in parallelo | ⚠️ `buildDependencies()` non differenzia per transizione |
| `src/types/project-mutation-impact.ts` | Tipi TypeScript | ✅ Completo |
| `src/app/api/projects/[projectId]/impact-preview/route.ts` | POST endpoint autenticato | ✅ Completo |
| `src/hooks/useProjectMutationImpactGuard.tsx` | Hook React (pattern pattern completo) | ✅ Completo |
| `src/hooks/useGuardedProjectMutation.tsx` | Hook usato da GeneralProjectTab | ✅ Completo |
| `src/components/projects/dialogs/ProjectMutationImpactDialog.tsx` | Dialog UI warn/block | ✅ Completo |
| `src/components/projects/general-tab/GeneralProjectTab.tsx` | Usa `useGuardedProjectMutation` | ✅ Già cablato |

### 2.2 Flusso attuale (funzionante)

```
GeneralProjectTab
  └─ useGuardedProjectMutation
       └─ previewBeforeMutate(updates)
            └─ POST /api/projects/{id}/impact-preview
                 └─ previewProjectMutationImpact(project, updates)
                      └─ collectDependencyCounts(projectId)  ← 14 query parallele
                      └─ buildDependencies(counts, companyLinkChange, kinds)
                           └─ PROBLEMA: logica incompleta ↓
```

### 2.3 Dipendenze già tracciate (14 collezioni)

| ID | Collezione Firestore | Campo query |
|----|---------------------|-------------|
| `buildings` | `buildings` | `projectId == id` |
| `properties` | `properties` | `projectId == id` |
| `propertyPaymentPlans` | `properties/{id}/payment_plans` | subcollection fan-out |
| `contactLinks` | `contact_links` | `targetEntityType=='project' && targetEntityId==id` |
| `communications` | `communications` | `projectId == id` |
| `obligations` | `obligations` | `projectId == id` |
| `legalContracts` | `legal_contracts` | `projectId == id` |
| `ownershipTables` | `ownership_tables` | `projectId == id` |
| `purchaseOrders` | `purchase_orders` | `projectId == id` |
| `attendanceEvents` | `attendance_events` | `projectId == id` |
| `employmentRecords` | `employment_records` | `projectId == id` |
| `accountingInvoices` | `accounting_invoices` | `projectId == id` |
| `files` | `files` | `projectId == id` |
| `boqItems` | `boq_items` | `projectId == id` |

---

## 3. Gap Analysis — Cosa manca

### Gap 1: Nessuna logica status-specifica

`buildDependencies()` assegna `warn` a TUTTO tranne company unlink/reassign (→ `block`).
Non esiste differenziazione per **quale** transizione di status sta avvenendo.

**Esempio del problema:**
- Cancellare un progetto con contratti legali attivi → dovrebbe essere `block`
- Attualmente → `warn` (l'utente può procedere)

### Gap 2: Architettura imperativa vs dichiarativa

Il sistema contatti (ADR-297) usa `CONTACT_DEPENDENCY_REGISTRY`: un array dichiarativo
dove ogni entry specifica per ogni scenario (`deletion`, `nameChange`, ecc.) quale
`mode` applicare. Il sistema progetti ha logica hard-coded in `buildDependencies()`.

**Conseguenza:** aggiungere una nuova regola richiede modificare codice imperativo
invece di aggiungere una entry al registry.

### Gap 3: Nessuna matrice di transizione status

Non esiste una definizione formale di quali dipendenze bloccano/avvertono
per ogni coppia `(from_status, to_status)`.

---

## 4. Decision — Architettura target

Estendere il sistema esistente con:

1. **`PROJECT_STATUS_TRANSITION_REGISTRY`** — matrice dichiarativa in `project-mutation-impact.ts`
2. **Logica status-aware in `buildDependencies()`** — consulta il registry per la transizione specifica
3. **Chiavi i18n** per messaggi di transizione specifici

L'API route, il dialog, il hook e il cablaggio UI restano invariati.

---

## 5. Matrice transizioni status (Decision Core)

### 5.1 Definizioni

```typescript
type StatusTransitionTarget =
  | 'completed'
  | 'cancelled'
  | 'on_hold'
  | 'in_progress'
  | 'planning';

type TransitionRule = Partial<Record<ProjectMutationDependencyId, 'block' | 'warn' | 'info'>>;

// Registry: per ogni target-status, regole da applicare
// (indipendente dallo status di partenza, salvo eccezioni)
type StatusTransitionRegistry = Record<StatusTransitionTarget, TransitionRule>;
```

### 5.2 Matrice completa

| Dipendenza | → completed | → cancelled | → on_hold | → in_progress | → planning |
|------------|-------------|-------------|-----------|---------------|------------|
| `buildings` | info | warn | info | info | — |
| `properties` | info | warn | — | — | — |
| `propertyPaymentPlans` | warn | warn | — | — | — |
| `contactLinks` | — | warn | — | — | — |
| `communications` | — | info | — | — | — |
| `obligations` | warn | **block** | warn | — | — |
| `legalContracts` | warn | **block** | warn | — | — |
| `ownershipTables` | info | warn | — | — | — |
| `purchaseOrders` | warn | **block** | warn | — | — |
| `attendanceEvents` | warn | warn | warn | — | — |
| `employmentRecords` | warn | warn | warn | — | — |
| `accountingInvoices` | info | info | — | — | — |
| `files` | info | info | — | — | — |
| `boqItems` | warn | warn | — | — | — |

### 5.3 Razionale per le scelte critiche

**`cancelled` + `legalContracts/obligations/purchaseOrders` → BLOCK**
Obblighi legali/contrattuali attivi: cancellare il progetto crea esposizione legale.
L'utente DEVE prima risolvere (chiudere/trasferire) questi record.

**`completed` + `attendanceEvents/employmentRecords` → WARN**
Lavoratori ancora registrati come presenti in cantiere: il progetto "completato"
dovrebbe avere zero presenze attive. Avverto ma non blocco (potrebbe essere un
ritardo amministrativo legittimo).

**`completed` + `legalContracts` → WARN (non block)**
Contratti possono rimanere come documentazione storica. Non bloccante.

**`on_hold` + `attendanceEvents/employmentRecords` → WARN**
Sospendere il progetto con dipendenti attivi: impatto su EFKA (ADR-090).
Avverto l'utente.

**`in_progress` / `planning` — quasi nessuna regola**
Transizioni "forward" sono generalmente sicure.

---

## 6. Analisi dipendenze per campo (non-status)

### 6.1 `name` / `title`

| Dipendenza | Mode | Razionale |
|------------|------|-----------|
| `buildings` | warn | `projectName` potrebbe essere denormalizzato negli edifici |
| `files` | info | Documenti indicizzati per nome progetto |
| `contactLinks` | info | Link con label progetto |

**Scenario**: `projectIdentity` (già definito in `PROJECT_MUTATION_FIELD_KIND_MAP`)

### 6.2 `licenseNumber` / `issuingAuthority` / `issueDate`

| Dipendenza | Mode | Razionale |
|------------|------|-----------|
| `legalContracts` | warn | Contratti possono referenziare numero licenza |
| `buildings` | info | Dati permesso copiati nell'edificio |

**Scenario**: `permitMetadata` (già definito)

### 6.3 `description`

Nessuna dipendenza critica. → `allow` sempre.

### 6.4 `linkedCompanyId` (company link)

**Già implementato correttamente:**
- `link` (nessun link precedente → nuovo): `warn` 
- `unlink` (rimuove link): `block` se qualsiasi dipendenza > 0
- `reassign` (cambia company): `block` se qualsiasi dipendenza > 0

---

## 7. Piano implementazione

### Fase A — Registry dichiarativo (config)

**File:** `src/config/project-mutation-impact.ts`

Aggiungere `PROJECT_STATUS_TRANSITION_REGISTRY: StatusTransitionRegistry`
con la matrice della §5.2.

### Fase B — Service status-aware

**File:** `src/lib/firestore/project-mutation-impact-preview.service.ts`

Aggiornare `buildDependencies()`:
1. Se `mutationKinds` include `projectStatus`, estrarre `from` e `to` dai `changes`
2. Consultare `PROJECT_STATUS_TRANSITION_REGISTRY[toStatus]`
3. Per ogni dipendenza con count > 0, applicare il mode dal registry
4. Combinare con la logica companyLink esistente (invariata)

### Fase C — i18n

**File:** `src/i18n/locales/el/projects.json`, `src/i18n/locales/en/projects.json`

Aggiungere chiavi per messaggi specifici per transizione:
```
impactGuard.statusTransition.toCompleted
impactGuard.statusTransition.toCancelled
impactGuard.statusTransition.toOnHold
```

### Fase D — Verifica manuale

Scenari di test:
1. Progetto con `legalContracts > 0` → status → `cancelled` → dialog BLOCK
2. Progetto con `attendanceEvents > 0` → status → `completed` → dialog WARN
3. Progetto senza dati → qualsiasi status → allow diretto
4. Company unlink → BLOCK (comportamento invariato)
5. Nome cambio → WARN se buildings > 0

---

## 8. File coinvolti

### Da MODIFICARE
- `src/config/project-mutation-impact.ts` — `PROJECT_STATUS_TRANSITION_REGISTRY`
- `src/lib/firestore/project-mutation-impact-preview.service.ts` — `buildDependencies()`
- `src/i18n/locales/el/projects.json` — chiavi i18n transizione
- `src/i18n/locales/en/projects.json` — chiavi i18n transizione

### NON toccare
- `src/app/api/projects/[projectId]/impact-preview/route.ts` — corretto
- `src/hooks/useProjectMutationImpactGuard.tsx` — corretto
- `src/hooks/useGuardedProjectMutation.tsx` — corretto
- `src/components/projects/dialogs/ProjectMutationImpactDialog.tsx` — corretto
- `src/components/projects/general-tab/GeneralProjectTab.tsx` — già cablato

---

## 9. Changelog

| Data | Versione | Cambiamento |
|------|---------|-------------|
| 2026-04-14 | 1.0.0 | ADR creata. Ricerca completa. Status: Draft. |
