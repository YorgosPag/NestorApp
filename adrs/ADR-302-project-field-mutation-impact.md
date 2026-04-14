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

## 5. Campo `status` — Matrice transizioni (Decisioni approvate 2026-04-14)

### 5.1 Tipi TypeScript

```typescript
type StatusTransitionTarget =
  | 'completed'
  | 'cancelled'
  | 'on_hold'
  | 'in_progress'
  | 'planning';

type TransitionRule = Partial<Record<ProjectMutationDependencyId, 'block' | 'warn' | 'info'>>;

/** Per transizioni speciali: regole dipendenti dallo status di partenza */
interface DirectionalTransitionRule {
  readonly from: ReadonlyArray<ProjectStatus>;
  readonly to: ReadonlyArray<ProjectStatus>;
  readonly dependencies: TransitionRule;
  /**
   * Se true: mostra sempre il dialog (anche con count = 0).
   * Usato per la riapertura di progetti completati/cancellati.
   */
  readonly alwaysNotify?: boolean;
}

type StatusTransitionRegistry = {
  readonly byTarget: Record<StatusTransitionTarget, TransitionRule>;
  readonly directional: ReadonlyArray<DirectionalTransitionRule>;
};
```

### 5.2 Matrice per target-status (indipendente da where-from)

| Dipendenza | → completed | → cancelled | → on_hold | Messaggio utente (el) |
|------------|:-----------:|:-----------:|:---------:|----------------------|
| `legalContracts` | warn | **🔴 block** | warn | Συμβόλαια σε εξέλιξη |
| `obligations` | warn | **🔴 block** | warn | Εκκρεμείς υποχρεώσεις |
| `purchaseOrders` | warn | **🔴 block** | warn | Εκκρεμείς παραγγελίες |
| `soldProperties`* | — | **🔴 block** | — | Πωλημένες μονάδες |
| `propertyPaymentPlans` | warn | warn | — | Πρόγραμμα δόσεων |
| `properties` | info | warn | — | Συνδεδεμένες μονάδες |
| `attendanceEvents` | warn | warn | warn | Παρουσίες εργαζομένων |
| `employmentRecords` | warn | warn | warn | Εγγραφές ΕΦΚΑ |
| `boqItems` | warn | warn | — | Εκκρεμή BoQ |
| `buildings` | info | warn | info | Συνδεδεμένα κτήρια |
| `contactLinks` | — | warn | — | Ενεργοί σύνδεσμοι |
| `ownershipTables` | info | warn | — | Πίνακες ιδιοκτησίας |
| `accountingInvoices` | info | info | — | Τιμολόγια |
| `files` | info | info | — | Αρχεία |

> **`soldProperties`*** — nuova query compound:
> `collection: properties, where: projectId == id AND commercial.saleStatus == 'sold'`
> Da aggiungere come 15° dipendenza in `PROJECT_MUTATION_DEPENDENCY_IDS`.
> Verifica durante implementazione il nome esatto del campo `saleStatus`.

### 5.3 Transizioni speciali — Direzionali

#### 5.3.1 `planning → in_progress` (avvio cantiere)

Caso speciale: INFO proattiva quando count **= 0** (non > 0 come tutti gli altri).

| Condizione | Dipendenza | Mode | Messaggio utente |
|-----------|-----------|------|-----------------|
| `buildings = 0` | buildings | **info** | "Δεν έχετε δημιουργήσει κτήρια για αυτό το έργο." |
| `employmentRecords = 0` | employmentRecords | **info** | "Δεν υπάρχουν εγγεγραμμένοι εργαζόμενοι." |

Se entrambi = 0 → dialog INFO con checklist di avvio.
Se entrambi > 0 → allow diretto (cantiere già configurato).

#### 5.3.2 Re-apertura: `completed` / `cancelled` → qualsiasi

Sempre WARN, indipendentemente dai count. Riaprire un progetto chiuso è sempre un evento significativo.

| Dipendenza | Mode | Messaggio utente |
|-----------|------|-----------------|
| *(sempre)* | **warn** | "Ανοίγετε εκ νέου ένα κλειστό έργο. Ελέγξτε δηλώσεις ΕΦΚΑ και συμβόλαια." |
| `employmentRecords > 0` | **warn** | + "Υπάρχουν εγγραφές απασχόλησης που χρειάζονται επανέλεγχο." |

Flag: `alwaysNotify: true` → dialog appare anche con zero dipendenze.

#### 5.3.3 `in_progress` / `on_hold` → `planning` (retrocessione)

| Dipendenza | Mode | Messaggio |
|-----------|------|----------|
| `buildings > 0` | warn | "Υπάρχουν ήδη κτήρια δημιουργημένα." |
| `properties > 0` | warn | "Υπάρχουν ήδη συνδεδεμένες μονάδες." |
| `attendanceEvents > 0` | warn | "Υπάρχουν παρουσίες καταγεγραμμένες." |

### 5.4 Razionale decisioni critiche

| Decisione | Razionale |
|-----------|-----------|
| `cancelled` + `legalContracts/obligations/purchaseOrders` → **BLOCK** | Esposizione legale attiva. L'utente DEVE risolvere prima. Nessuna eccezione. |
| `cancelled` + `soldProperties` → **BLOCK** | Unità già vendute = obblighi verso acquirenti. Non cancellabile. |
| `cancelled` + `properties` (non vendute) → **WARN** | Unità disponibili possono essere ri-assegnate. Non bloccante. |
| `completed` + tutti i pending → **WARN** (non block) | Il completamento amministrativo può precedere la chiusura documentale. Legittimo. |
| `on_hold` + `attendanceEvents/employmentRecords` → **WARN** | Impatto su dichiarazioni ΕΦΚΑ (ADR-090). Avviso obbligatorio. |
| Riapertura → **WARN sempre** | Evento raro e significativo. Dialog sempre, anche con progetto vuoto. |
| `planning → in_progress` senza edifici → **INFO** (count=0) | Checklist proattiva Google-style. Guida l'utente invece di bloccarlo. |

---

## 6. Analisi per campo — Campi scheda Generale (non-status)

> **Metodo**: solo le dipendenze con `projectName` **salvato in Firestore** contano.
> Servizi che leggono il nome a runtime (report, PDF, email) NON sono dipendenze —
> prendono il dato diretto dal documento progetto al momento dell'uso.

---

### 6.1 Campo `name` (titolo progetto)

**Analisi denormalizzazione:**

| Collezione Firestore | Campo | Salvato? | Note |
|----------------------|-------|----------|------|
| `legal_contracts` | `projectName: string` | ✅ SÌ | ObligationDocument — già tracciato come `legalContracts` |
| `calendar_events` | `projectName?: string` | ✅ SÌ | "resolved from projectId" ma persistito — **nuova dipendenza #16** |
| `buildings` | — | ❌ NO | Link via `projectId`, nome non denormalizzato |
| `properties` | — | ❌ NO | Link via `projectId` |
| `files` | — | ❌ NO | Link via `projectId` |
| `contact_links` | — | ❌ NO | Link via `targetEntityId` |
| `interest_calculator` | `projectName` | ❌ NO | Computed at runtime, non persisted |

**Regole approvate:**

| Dipendenza | Mode | Messaggio utente (el) |
|------------|------|-----------------------|
| `legalContracts` | **warn** | "X συμβόλαια έχουν το παλιό όνομα αποθηκευμένο. Ενημερώστε τα χειροκίνητα." |
| `calendarEvents` *(nuova #16)* | **info** | "X ημερολογιακά γεγονότα αναφέρουν το παλιό όνομα." |

**Query per `calendarEvents`:**
```
collection: COLLECTIONS.CALENDAR
where: projectId == projectId
```

**Scenario**: `projectIdentity` — `name` + `title` + `description`

---

### 6.2 Campo `title` (licenseTitle — τίτλος αρχιτεκτονικής μελέτης)

**Analisi denormalizzazione:** Nessuna. `title` è salvato SOLO nel documento progetto.
Nessun altra collezione Firestore lo persiste.

**Regola:** → **allow sempre** (nessun dialog).

---

### 6.3 Campi permesso: `licenseNumber` / `issuingAuthority` / `issueDate` / `buildingBlock` / `protocolNumber`

**Analisi denormalizzazione:**

| Collezione Firestore | Campo | Salvato? |
|----------------------|-------|----------|
| `legal_contracts` | Possibile riferimento al numero licenza | ⚠️ DA VERIFICARE implementazione |
| `buildings` | Dati permesso copiati? | ⚠️ DA VERIFICARE |

**Regole approvate (conservative — da raffinare se verifica conferma):**

| Dipendenza | Mode | Messaggio utente (el) |
|------------|------|-----------------------|
| `legalContracts` | **warn** | "Ελέγξτε αν τα συμβόλαια αναφέρονται στον αριθμό άδειας." |
| `buildings` | **info** | "Τα κτήρια μπορεί να έχουν αντίγραφο των στοιχείων άδειας." |

**Scenario**: `permitMetadata` (già definito in `PROJECT_MUTATION_FIELD_KIND_MAP`)

---

### 6.4 Campo `description`

**Analisi denormalizzazione:** Nessuna. Campo libero, nessuna dipendenza Firestore.

**Regola:** → **allow sempre** (nessun dialog).

---

### 6.5 Campo `linkedCompanyId` (company link — ADR-232)

**Già implementato correttamente nel service attuale:**

| Tipo cambio | Mode | Dipendenze bloccanti |
|------------|------|---------------------|
| `link` (nuovo link) | warn | tutte le 14 dipendenze |
| `unlink` (rimuove link) | **block** | tutte le 14 dipendenze |
| `reassign` (cambia company) | **block** | tutte le 14 dipendenze |

**Nessuna modifica necessaria per questo campo.**

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
| 2026-04-14 | 1.1.0 | §5 completato: matrice status approvata. 5 decisioni: cancelled+contracts=BLOCK, cancelled+soldProperties=BLOCK, planning→in_progress senza edifici=INFO, riapertura=WARN sempre, on_hold→cancelled stesse regole cancelled. Aggiunta 15° dipendenza `soldProperties`. |
| 2026-04-14 | 1.2.0 | §6 completato: analisi denormalizzazione per tutti i campi non-status. `name`→legalContracts(WARN)+calendarEvents(INFO nuova dep #16). `title`→allow. `description`→allow. `licenseNumber/issuingAuthority/issueDate/buildingBlock/protocolNumber`→legalContracts(WARN)+buildings(INFO). `linkedCompanyId`→invariato. |
